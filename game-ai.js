// ========== GAME-AI.JS ==========
// ШІ бота: логіка ходу, оцінка позицій, пошук цілей, аури.
// Виокремлено з game.js як Object.assign mixin на Game.prototype.

Object.assign(Game.prototype, {

    // ═══════════════════════════════════════════════════════════════════
    //  ГОЛОВНИЙ ХІД БОТА
    // ═══════════════════════════════════════════════════════════════════

    aiTurn() {
        try {
            this.log(window.TRANSLATIONS[window.currentLang].enemyTurn);

            if (this.turn > 1) {
                this.enemyMaxMana = Math.min(this.enemyMaxMana + 1, 10);
            }
            this.enemyMana = this.enemyMaxMana;
            for (let i = 0; i < 3; i++) this.drawEnemyCard();
            this.updateUI();

            this.isLethalTurn = false;

            // ── Летал до будь-яких дій? ─────────────────────────────────────────
            if (this._aiCheckAndExecuteLethal()) return;

            // ── ЕТАП 1: РОЗІГРАШ КАРТ ───────────────────────────────────────────
            this._aiSortHandByPriority(); // Оптимальний порядок: бафи → контроль → юніти
            const MAX_ATTEMPTS = this.enemyHand.length * 4 + 10;
            let attempts = 0;

            while (this.enemyMana > 0 && attempts < MAX_ATTEMPTS) {
                attempts++;
                if (this._aiCheckAndExecuteLethal()) return;

                let bestMove = null;
                let bestScore = -Infinity;

                // Оцінюємо кожну карту в руці
                this.enemyHand.forEach((card, handIdx) => {
                    if (card.mana > this.enemyMana) return;

                    if (card.type === 'unit') {
                        for (let col = 0; col < this.gridSize; col++) {
                            if (this.field[col] === null) {
                                const score = this.evaluateUnitSpawn(card, col);
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestMove = { type: 'unit', handIdx, slot: col };
                                }
                            }
                        }
                    } else if (card.type === 'spell') {
                        this.field.forEach((target, targetIdx) => {
                            if (target) {
                                const score = this.evaluateSpellCast(card, target, targetIdx);
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestMove = { type: 'spell', handIdx, targetIdx };
                                }
                            }
                        });
                        // Заклинання без цілі на полі (heal_all_allies, destroy_all, damage_all_enemies, time_loop)
                        const noTargetScore = this.evaluateSpellNoTarget(card);
                        if (noTargetScore > bestScore) {
                            bestScore = noTargetScore;
                            bestMove = { type: 'spell_notarget', handIdx };
                        }
                    }
                });

                if (bestMove && bestScore >= 0) {
                    const card = this.enemyHand[bestMove.handIdx];

                    if (bestMove.type === 'unit') {
                        const newCard = Object.assign(structuredClone(card), {
                            hasMovedThisTurn: true,
                            isEnemy: true,
                            isRevealed: false
                        });

                        // Артем (ID 53): doubleNextUnitStats
                        if (this.doubleNextUnitStats) {
                            newCard.statCapOverride = 80;
                            newCard.hp *= 2;
                            newCard.damage *= 2;
                            newCard.armor *= 2;
                            if (newCard.maxHp) newCard.maxHp *= 2;
                            this.applyStatCaps(newCard);
                            this.doubleNextUnitStats = false;
                            this.log(`${newCard.name[window.currentLang]} отримує x2 підсилення від Артема!`);
                        }

                        this.field[bestMove.slot] = newCard;
                        this.log(`${window.TRANSLATIONS[window.currentLang].enemyPlayed} ${card.name[window.currentLang]}`);
                        this.triggerUnitPlayedPassives(newCard);

                        if (card.onPlayEffect) {
                            this.handleOnPlayEffect(card.onPlayEffect, bestMove.slot, true);
                        }

                    } else if (bestMove.type === 'spell') {
                        this.applyEffect(card, bestMove.targetIdx, true);

                    } else if (bestMove.type === 'spell_notarget') {
                        // Заклинання що не потребують цілі (heal_all, destroy_all тощо)
                        // Передаємо будь-який валідний targetIdx — applyEffect сам визначить
                        const anyIdx = this.field.findIndex(u => u !== null);
                        this.applyEffect(card, anyIdx !== -1 ? anyIdx : 0, true);
                    }

                    this.enemyHand.splice(bestMove.handIdx, 1);
                    this.enemyMana -= card.mana;
                    this.updateUI();

                } else {
                    // Розумне скидання
                    let discardIdx = -1;

                    if (this.enemyHand.length > 2) {
                        for (let i = 0; i < this.enemyHand.length; i++) {
                            const c = this.enemyHand[i];
                            if (c.mana > this.enemyMana) continue;
                            if (!this._aiCardHasPossiblePlay(c)) {
                                discardIdx = i;
                                break;
                            }
                        }
                    }

                    if (discardIdx === -1 && this.enemyHand.length >= this.maxHandSize) {
                        let worstScore = Infinity;
                        let worstIdx = -1;
                        this.enemyHand.forEach((c, i) => {
                            const s = this._aiCardWorstCaseScore(c);
                            if (s < worstScore) { worstScore = s; worstIdx = i; }
                        });
                        discardIdx = worstIdx !== -1 ? worstIdx : 0;
                    }

                    if (discardIdx !== -1) {
                        const discardedCard = this.enemyHand[discardIdx];
                        this.enemyHand.splice(discardIdx, 1);
                        this.log(`${window.TRANSLATIONS[window.currentLang].discarded} ${discardedCard.name[window.currentLang]} (AI)`);
                        continue;
                    }

                    break;
                }
            }

            // ── ЕТАП 2: ДІЇ ЮНІТІВ ─────────────────────────────────────────────
            if (this._aiCheckAndExecuteLethal()) return;

            let totalDamageToFace = 0;
            this.field.forEach((u, idx) => {
                if (u && u.isEnemy && !u.hasMovedThisTurn && !u.isFrozen) {
                    if (this.canAttack(idx, -2)) totalDamageToFace += Math.max(0, u.damage);
                }
            });

            if (totalDamageToFace >= this.playerHp) {
                this.isLethalTurn = true;
                this.log("AI бачить можливість перемоги! (Lethal)");
            }

            const enemyUnits = this.field
                .map((unit, idx) => ({ unit, idx }))
                .filter(item => item.unit && item.unit.isEnemy && !item.unit.hasMovedThisTurn);

            enemyUnits.forEach(({ unit, idx }) => {
                if (this.field[idx] !== unit) return;
                const bestTarget = this.findBestAttackTarget(unit, idx);
                if (bestTarget !== null) {
                    this.attack(idx, bestTarget);
                } else {
                    const bestMove = this.findBestMove(unit, idx);
                    if (bestMove !== -1) this.moveUnit(idx, bestMove);
                }
            });

            this.field.forEach(card => { if (card) card.hasMovedThisTurn = false; });
            this.checkProximityReveal();
            this.updateUI();

        } catch (error) {
            console.error("Critical error in AI Turn:", error);
            this.log("AI error, skipping turn logic...");
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    //  ДОПОМІЖНІ МЕТОДИ
    // ═══════════════════════════════════════════════════════════════════

    _aiCheckAndExecuteLethal() {
        let totalDamage = 0;
        const attackers = [];

        this.field.forEach((u, idx) => {
            if (u && u.isEnemy && !u.hasMovedThisTurn && !u.isFrozen) {
                if (this.canAttack(idx, -2)) {
                    totalDamage += Math.max(0, u.damage);
                    attackers.push(idx);
                }
            }
        });

        if (totalDamage >= this.playerHp && attackers.length > 0) {
            this.isLethalTurn = true;
            this.log("AI знаходить летал! Атакуємо по лицю!");
            attackers.forEach(idx => {
                if (this.field[idx] && this.field[idx].isEnemy && !this.field[idx].hasMovedThisTurn) {
                    this.attack(idx, -2);
                }
            });
            this.field.forEach(card => { if (card) card.hasMovedThisTurn = false; });
            this.checkProximityReveal();
            this.updateUI();
            return true;
        }
        return false;
    },

    _aiCardHasPossiblePlay(card) {
        if (card.type === 'unit') {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.field[col] === null) return true;
            }
            return false;
        }
        if (card.type === 'spell') {
            if (card.effect) {
                const noTargetTypes = ['heal_all_allies', 'destroy_all', 'damage_all_enemies',
                    'time_loop', 'freeze_all_enemies'];
                if (noTargetTypes.includes(card.effect.type)) return true;
            }
            for (let i = 0; i < this.field.length; i++) {
                const target = this.field[i];
                if (target && this.evaluateSpellCast(card, target, i) > 0) return true;
            }
            return false;
        }
        return true;
    },

    _aiCardWorstCaseScore(card) {
        const futureValue = card.mana * 8;
        if (card.type === 'unit') {
            let hasSlot = false;
            for (let col = 0; col < this.gridSize; col++) {
                if (this.field[col] === null) { hasSlot = true; break; }
            }
            if (!hasSlot) return -50;
            return futureValue + card.damage * 5 + card.hp * 2;
        }
        if (card.type === 'spell') {
            let maxScore = -100;
            this.field.forEach((target, targetIdx) => {
                if (target) {
                    const s = this.evaluateSpellCast(card, target, targetIdx);
                    if (s > maxScore) maxScore = s;
                }
            });
            const noTargetScore = this.evaluateSpellNoTarget(card);
            if (noTargetScore > maxScore) maxScore = noTargetScore;
            return maxScore + futureValue;
        }
        return futureValue;
    },

    // ═══════════════════════════════════════════════════════════════════
    //  ОЦІНКА СПАВНУ ЮНІТА — з синергіями
    // ═══════════════════════════════════════════════════════════════════

    evaluateUnitSpawn(card, col) {
        let score = card.mana * 10;
        const row = 0; // Enemy spawns at row 0

        // ── СИНЕРГІЯ: Артем активний ─ НАЙВИЩИЙ ПРІОРИТЕТ ───────────────────────
        if (this.doubleNextUnitStats) {
            // Чим цінніший юніт, тим краще — x2 на легендарного краще ніж на Common
            const unitValue = card.damage * 5 + card.hp * 2 + card.armor * 3;
            // Рідкість теж важлива
            const rarityBonus = { common: 0, rare: 30, epic: 60, legendary: 100 }[card.rarity] || 0;
            score += 300 + unitValue * 4 + rarityBonus;
        }

        // ── СИНЕРГІЯ: Артем у руці ── підготовка ────────────────────────────────
        const artemInHand = this.enemyHand.some(c => c.id === 53 && c !== card);
        if (artemInHand && card.mana <= 3) {
            // Кращий кандидат для x2 — той хто має більше stats
            const unitValue = card.damage * 5 + card.hp * 2 + card.armor * 3;
            score += 40 + unitValue;
        }

        // ── СИНЕРГІЯ: Молодий Маг (13) — є дорогі заклинання в руці ────────────
        if (card.id === 13) {
            const expensiveSpells = this.enemyHand.filter(c => c.type === 'spell' && c.mana >= 4);
            if (expensiveSpells.length > 0) score += 40 * expensiveSpells.length;
        }

        // ── СИНЕРГІЯ: Алхімік (17) — добирає карту, цінно коли мало карт ───────
        if (card.id === 17) {
            const emptyHandBonus = Math.max(0, (4 - this.enemyHand.length) * 20);
            score += emptyHandBonus;
        }

        // ── СИНЕРГІЯ: Командир Гвардії (65) — є Common юніти на полі ────────────
        if (card.id === 65) {
            const commonCount = this.field.filter(u => u && u.isEnemy && u.rarity === 'common').length;
            score += commonCount * 40;
        }
        // Якщо Командир вже є — Common юніти стають ціннішими
        const hasCommander = this.field.some(u => u && u.isEnemy && u.id === 65);
        if (hasCommander && card.rarity === 'common') {
            score += 60; // Командир вже дає +2/+2, новий Common-юніт одразу їх отримує
        }

        // ── СИНЕРГІЯ: Прапороносець (34) — другий посилює обох ─────────────────
        if (card.id === 34) {
            const flagBearerCount = this.field.filter(u => u && u.isEnemy && u.id === 34).length;
            score += flagBearerCount * 80; // Два Прапороносці = +2/+2 всім
        }

        // ── СИНЕРГІЯ: Рустам (50) — пасив росте від кожного юніта ───────────────
        const hasRustam = this.field.some(u => u && u.isEnemy && u.id === 50);
        if (hasRustam && card.type === 'unit') score += 25;

        // ── СИНЕРГІЯ: Кровопивця (61) — краще коли є бій на полі ─────────────────
        if (card.id === 61) {
            const battleIntensity = this.field.filter(u => u && !u.isEnemy).length * 10;
            score += battleIntensity; // Чим більше ворогів — тим частіше б'ються, тим більше лікування
        }

        // ── СИНЕРГІЯ: Нікіта (51) — ставити поруч з дамагерами ─────────────────
        if (card.id === 51) {
            // Нікіта дає +2 атаки сусідам кожен хід — хочемо мати сильних сусідів
            // Оцінка: є сильні союзники поруч?
            const leftNeighbor = this.field[row * this.gridSize + col - 1];
            const rightNeighbor = this.field[row * this.gridSize + col + 1];
            if (leftNeighbor && leftNeighbor.isEnemy && leftNeighbor.damage >= 3) score += 50;
            if (rightNeighbor && rightNeighbor.isEnemy && rightNeighbor.damage >= 3) score += 50;
        }

        // ── СИНЕРГІЯ: Дзеркальний Дроїд (54) — ставити навпроти сильного ────────
        if (card.id === 54) {
            // Шукаємо ворожий юніт з максимальним дамагом у тій же колонці
            let maxEnemyDmg = 0;
            for (let r = 1; r < this.gridSize; r++) {
                const u = this.field[r * this.gridSize + col];
                if (u && !u.isEnemy && u.damage > maxEnemyDmg) maxEnemyDmg = u.damage;
            }
            score += maxEnemyDmg * 15; // Дзеркало = копіюємо дамаг ворога
            // Якщо немає сильного ворога навпроти — майже марний
            if (maxEnemyDmg === 0) score -= 50;
        }

        // ── СИНЕРГІЯ: Гідра (38) — ставити де її атакуватимуть ─────────────────
        if (card.id === 38) {
            // Гідра подвоює атаку від кожного удару. Хочемо щоб ворог її атакував.
            // Ставимо на лінію де є ворожий юніт з дальністю >= відстані до Гідри
            let threatInLane = 0;
            for (let r = 1; r < this.gridSize; r++) {
                const u = this.field[r * this.gridSize + col];
                if (u && !u.isEnemy) threatInLane += u.damage;
            }
            // Трохи небезпечно але вигідно — бонус за загрозу
            score += threatInLane * 5;
        }

        // ── СИНЕРГІЯ: Нестабільний Елементаль (55) — окремий простір ───────────
        if (card.id === 55) {
            // Вибухає коли HP < 3, наносить 6 урону сусідам. Не ставити поряд з союзниками
            const leftNeighbor = this.field[row * this.gridSize + col - 1];
            const rightNeighbor = this.field[row * this.gridSize + col + 1];
            if (leftNeighbor && leftNeighbor.isEnemy) score -= 80; // Вибух зашкодить союзнику
            if (rightNeighbor && rightNeighbor.isEnemy) score -= 80;
            score += 30; // Базовий бонус — він сильний
        }

        // ── СИНЕРГІЯ: Осквернитель (26) — наносить 1 урону сусідам ─────────────
        if (card.id === 26) {
            // Небажано стояти поруч з союзниками
            const leftNeighbor = this.field[row * this.gridSize + col - 1];
            const rightNeighbor = this.field[row * this.gridSize + col + 1];
            if (leftNeighbor && leftNeighbor.isEnemy) score -= 40;
            if (rightNeighbor && rightNeighbor.isEnemy) score -= 40;
            // Краще ставити в ізоляцію або там де вороги поруч
            const enemyNeighborLeft = this.field[(row + 1) * this.gridSize + col - 1];
            const enemyNeighborRight = this.field[(row + 1) * this.gridSize + col + 1];
            if (enemyNeighborLeft && !enemyNeighborLeft.isEnemy) score += 20;
            if (enemyNeighborRight && !enemyNeighborRight.isEnemy) score += 20;
        }

        // ── СИНЕРГІЯ: Камікадзе (33) — ефективний тільки коли хтось блокує ─────
        if (card.id === 33) {
            // 10 дамагу але помирає після. Ставити туди де є ворог якого можна вбити
            let killTarget = false;
            for (let r = 1; r < this.gridSize; r++) {
                const u = this.field[r * this.gridSize + col];
                if (u && !u.isEnemy) {
                    if (u.hp <= 10 - (u.armor || 0)) killTarget = true;
                }
            }
            if (killTarget) score += 80;
            // Якщо є заклинання підсилення в руці — Камікадзе отримає ще більший дамаг
            const hasBuff = this.enemyHand.some(c => c.effect && c.effect.type === 'buff_damage');
            if (hasBuff) score += 60;
        }

        // ── СИНЕРГІЯ: Чумний Щур (57) — дешевий deathrattle ─────────────────────
        if (card.id === 57) {
            // Корисний якщо є сильний ворог якого треба ослабити перед смертю
            const strongEnemies = this.field.filter(u => u && !u.isEnemy && u.armor > 0).length;
            score += strongEnemies * 15;
        }

        // ── АНАЛІЗ ЛІНІЇ ─────────────────────────────────────────────────────────
        let threatInLane = 0;
        let allyInFront = false;
        let enemyInFront = false;

        for (let r = 0; r < this.gridSize; r++) {
            const idx = r * this.gridSize + col;
            const unit = this.field[idx];
            if (unit) {
                if (!unit.isEnemy) {
                    threatInLane += unit.damage;
                    if (r === 1) enemyInFront = true;
                } else {
                    if (r > 0) allyInFront = true;
                }
            }
        }

        const isTank = card.hp >= 5 || card.armor > 0 || card.id === 47;
        const isRanged = (card.range || 1) > 1;
        const isHighDmg = card.damage >= 4;

        if (isTank) score += threatInLane * 2;
        if (isHighDmg && !isTank) {
            if (!enemyInFront) score += 30;
            if (threatInLane >= card.hp) score -= 50;
        }
        if (isRanged) {
            if (allyInFront) score += 40;
            if (enemyInFront && threatInLane >= card.hp) score -= 30;
        }

        // ── СИНЕРГІЯ: Сквайр (22) — потрібен юніт ПОПЕРЕДУ ─────────────────────
        // Сквайр дає +1 атаки юніту спереду (row+1). Ставимо ЗА сильним юнітом.
        if (card.id === 22) {
            const frontIdx = (row + 1) * this.gridSize + col;
            if (frontIdx < this.field.length) {
                const frontUnit = this.field[frontIdx];
                if (frontUnit && frontUnit.isEnemy) {
                    // Чим сильніший юніт попереду — тим цінніший Сквайр
                    score += 30 + frontUnit.damage * 8;
                } else {
                    score -= 20; // Нема кого посилювати
                }
            }
        }

        // ── СИНЕРГІЯ: Охоронець (47) — поруч з крихкими/дальнобійними ─────────
        if (card.id === 47) {
            // Дає +1 броні сусідам. Найціннішим є для дальнобійників з 0 бронею
            const neighbors = [];
            if (col > 0) neighbors.push(row * this.gridSize + col - 1);
            if (col < this.gridSize - 1) neighbors.push(row * this.gridSize + col + 1);

            let neighborBonus = 0;
            neighbors.forEach(nIdx => {
                const n = this.field[nIdx];
                if (n && n.isEnemy) {
                    // Дальнобійники особливо вдячні броні
                    if ((n.range || 1) > 1) neighborBonus += 40;
                    // Слабкі юніти теж
                    if (n.hp <= 4) neighborBonus += 25;
                    neighborBonus += 10;
                }
            });
            score += neighborBonus;
        }
        // Якщо є Охоронець на полі — крихкі та дальнобійні хочуть стати поряд
        else {
            const bodyguardPositions = this.field
                .map((u, i) => ({ u, i }))
                .filter(x => x.u && x.u.isEnemy && x.u.id === 47);

            bodyguardPositions.forEach(bg => {
                const bgRow = Math.floor(bg.i / this.gridSize);
                const bgCol = bg.i % this.gridSize;
                const dist = Math.abs(bgCol - col);
                if (dist === 1 && bgRow === row && isRanged) {
                    score += 50; // Дальнобійник хоче стати поруч з Охоронцем
                }
            });
        }

        // ── СИНЕРГІЯ: Жриця Життя (32) — поруч з сильними юнітами ──────────────
        if (card.id === 32) {
            // Жриця лікує сусідів наприкінці ходу. Цінна поряд з живучими юнітами.
            const neighbors = [];
            if (col > 0) neighbors.push(row * this.gridSize + col - 1);
            if (col < this.gridSize - 1) neighbors.push(row * this.gridSize + col + 1);

            let healBonus = 0;
            neighbors.forEach(nIdx => {
                const n = this.field[nIdx];
                if (n && n.isEnemy) {
                    healBonus += n.hp * 2 + n.damage * 3; // Чим важливіший юніт, тим ціннішe лікування
                }
            });
            score += healBonus;
        }
        // Якщо Жриця вже є — ставимо сильних юнітів поруч з нею
        else {
            const priestessPositions = this.field
                .map((u, i) => ({ u, i }))
                .filter(x => x.u && x.u.isEnemy && x.u.id === 32);

            priestessPositions.forEach(pr => {
                const prRow = Math.floor(pr.i / this.gridSize);
                const prCol = pr.i % this.gridSize;
                const dist = Math.abs(prCol - col) + Math.abs(prRow - row);
                if (dist === 1) score += 30; // Стати поруч з Жрицею
            });
        }

        // Сусіди на Row 0 (стандартні синергії)
        const neighbors = [];
        if (col > 0) neighbors.push(row * this.gridSize + col - 1);
        if (col < this.gridSize - 1) neighbors.push(row * this.gridSize + col + 1);

        neighbors.forEach(nIdx => {
            const neighbor = this.field[nIdx];
            if (neighbor && neighbor.isEnemy) {
                if (neighbor.id === 34 && card.id === 34) score += 50;
                if (neighbor.id === 47 && isRanged) score += 30;
                if (neighbor.id === 51 && isHighDmg) score += 40; // Поруч з Нікітою = +2 атаки/хід
            }
        });

        if (card.hp < 4 && threatInLane > 0) score -= 10;
        if (threatInLane >= this.enemyHp) score += 1000;

        // Тактичний бій
        if (enemyInFront) {
            for (let r = 0; r < this.gridSize; r++) {
                const enemy = this.field[r * this.gridSize + col];
                if (enemy && !enemy.isEnemy) {
                    const myDmg = Math.max(0, card.damage - (enemy.armor || 0));
                    const enemyDmg = Math.max(0, enemy.damage - (card.armor || 0));
                    if (enemy.hp <= myDmg && card.hp > enemyDmg) score += 60;
                    else if (enemy.hp <= myDmg && enemy.damage * 5 + enemy.hp * 2 > card.damage * 5 + card.hp * 2) score += 40;
                    break;
                }
            }
        }

        // Бонус за ефективне використання мани (добираємо залишок)
        const manaCost = card.mana || 0;
        const manaLeft = this.enemyMana - manaCost;
        if (manaLeft === 0) score += 15; // Ідеальне використання всієї мани

        score += Math.random() * 5;
        return score;
    },

    // ═══════════════════════════════════════════════════════════════════
    //  ОЦІНКА ЗАКЛЯТТЯ — з синергіями
    // ═══════════════════════════════════════════════════════════════════

    evaluateSpellCast(card, target, targetIdx) {
        let score = -100;
        const isEnemy = target.isEnemy;   // союзник бота
        const isPlayerUnit = !target.isEnemy;  // юніт гравця
        const effect = card.effect;
        if (!effect) return -100;

        switch (effect.type) {
            // ── DAMAGE SPELLS ──────────────────────────────────────────────────
            case 'damage_row': {
                const tRow = Math.floor(targetIdx / this.gridSize);
                let totalDamage = 0, unitsHit = 0;
                for (let c = 0; c < this.gridSize; c++) {
                    const u = this.field[tRow * this.gridSize + c];
                    if (u && !u.isEnemy) {
                        if (u.id === 37) continue;
                        unitsHit++;
                        totalDamage += effect.value;
                        if (u.hp <= effect.value) totalDamage += 5;
                        totalDamage += u.damage * 2;
                    }
                }
                score = totalDamage * 10 + unitsHit * 20;
                break;
            }

            case 'damage':
                if (isPlayerUnit) {
                    score = effect.value * 10;
                    if (target.hp <= effect.value) score += 60; // Вбивство!
                    if (target.hp <= effect.value + 2) score += 30; // Майже вбивство
                    score += target.damage * 2;
                } else if (!isEnemy && targetIdx === -2) {
                    // Пряме пошкодження гравцю в обличчя
                    score = effect.value * 8;
                    if (this.playerHp <= effect.value) score = 999_999; // Летал!
                    if (this.playerHp < 10) score += 80;
                }
                break;

            // ── FREEZE ────────────────────────────────────────────────────────
            case 'freeze':
                if (isPlayerUnit) {
                    score = (effect.duration || 1) * 10;
                    score += target.damage * 5;
                    if (target.hp >= 10) score += 20;
                    if (!target.hasMovedThisTurn) score += 25;

                    // ── COMBO: Freeze + наш атакер може добити замороженого ──────
                    // Заморожений не може ухилятись — наші юніти атакують без ризику
                    const canFollowUp = this.field.some(u =>
                        u && u.isEnemy && !u.hasMovedThisTurn && this.canAttack(
                            this.field.indexOf(u), targetIdx
                        )
                    );
                    if (canFollowUp) score += 40;
                }
                break;

            // ── ARMOR MANIPULATION ─────────────────────────────────────────────
            case 'destroy_armor':
                if (isPlayerUnit && target.armor > 0) {
                    score = target.armor * 15;
                    // ── COMBO: Кислотна Бомба + Камікадзе/Вбивця Тіней ──────────
                    // Якщо є юніт що ігнорує 0 броні і може вбити після дебафу
                    const killers = this.field.filter(u => u && u.isEnemy && u.damage > 0);
                    killers.forEach(killer => {
                        const dmgAfterDebuff = killer.damage;
                        if (target.hp <= dmgAfterDebuff && target.hp > dmgAfterDebuff - target.armor) {
                            score += 80; // Кислота відкриває вбивство!
                        }
                    });
                }
                break;

            case 'reduce_armor':
                if (isPlayerUnit && target.armor > 0) {
                    score = Math.min(target.armor, effect.value) * 15;
                    // ── COMBO: Іржа + атакер ────────────────────────────────────
                    const killers = this.field.filter(u => u && u.isEnemy && u.damage > 0);
                    killers.forEach(killer => {
                        const armorAfter = Math.max(0, target.armor - effect.value);
                        const dmgAfter = Math.max(0, killer.damage - armorAfter);
                        if (target.hp <= dmgAfter && target.hp > Math.max(0, killer.damage - target.armor)) {
                            score += 80; // Іржа відкриває вбивство!
                        }
                    });
                }
                break;

            // ── HEALING SPELLS ─────────────────────────────────────────────────
            case 'heal':
                if (isEnemy) {
                    const missingHp = (target.maxHp || 10) - target.hp;
                    if (missingHp <= 0) return 0;
                    score = Math.min(missingHp, effect.value) * 15;
                    score += target.damage * 5;
                    if (target.id === 47) score += 30;

                    let incomingDamage = 0;
                    const tCol = targetIdx % this.gridSize;
                    for (let r = 0; r < this.gridSize; r++) {
                        const u = this.field[r * this.gridSize + tCol];
                        if (u && !u.isEnemy) incomingDamage += u.damage;
                    }
                    if (incomingDamage >= target.hp && incomingDamage < target.hp + effect.value) score += 100;

                    // Пріоритет лікування: Легендарні > Епіки
                    const rarityBonus = { legendary: 40, epic: 20, rare: 10, common: 0 }[target.rarity] || 0;
                    score += rarityBonus;
                }
                break;

            // ── BUFF SPELLS ────────────────────────────────────────────────────
            case 'buff_armor':
                if (isEnemy) {
                    const bRow = Math.floor(targetIdx / this.gridSize);
                    score = effect.value * 10 + target.damage * 2;
                    if (target.id === 47) score += 30;
                    if (target.hp < 5) score += 10;
                    if (bRow === 1 || bRow === 2) score += 20;
                    if (bRow === 0) score -= 20;

                    // ── COMBO: Броня + Шипи (Thorns юніти) ─────────────────────
                    // Броньований юніт з шипами — перевага: виживає, наносить шипи
                    if (target.thorns || (target.appliedAuras && target.appliedAuras.includes('buff_thorns'))) {
                        score += 40;
                    }
                }
                break;

            case 'buff_damage':
                if (isEnemy) {
                    score = effect.value * 5;
                    if (!target.hasMovedThisTurn && !target.isFrozen) score += effect.value * 15;
                    score += target.hp * 2;

                    // ── ПРІОРИТЕТ: Камікадзе отримує МАКСИМАЛЬНИЙ бонус ─────────
                    // +3 на Камікадзе = 13 дамагу. Ймовірно вб'є будь-якого нетанка.
                    if (target.id === 33) score += 120;
                    // Вбивця Тіней теж відмінний кандидат
                    if (target.id === 11) score += 60;
                    // Берсерк вже накапливає сам, але +3 стартовий теж корисно
                    if (target.id === 19) score += 30;
                    // Дракон Пустоти з дальністю 3 + бафф дамагу
                    if (target.id === 27) score += 50;
                }
                break;

            case 'buff_lifesteal':
                if (isEnemy && !target.appliedAuras?.includes('lifesteal')) {
                    score = target.damage * 5 + target.hp * 2;
                    // ── ПРІОРИТЕТ: Найкращі кандидати для Вампіризму ────────────
                    if (target.id === 51) score += 80;  // Нікіта — атакує, лікується, ще живучіший
                    if (target.id === 53) score += 70;  // Артем — ігнорує броню + lifesteal
                    if (target.id === 27) score += 60;  // Дракон — дальній + piercing + lifesteal
                    if (target.id === 8) score += 50;  // Гігант — великий HP, ліфстіл продовжить
                    // Не витрачати на Вампіра (21) — він вже має вбудований lifesteal
                    if (target.id === 21) score -= 100;
                }
                break;

            case 'buff_thorns':
                if (isEnemy) {
                    // ── ПРІОРИТЕТ: Шипи найцінніші на танків та Кровопивцю ──────
                    score = effect.value * 15 + (target.armor || 0) * 5;
                    // Кровопивця (61) — шипи + lifesteal: кожен удар = він шипить + лікується
                    if (target.id === 61) score += 80;
                    // Вже шипові юніти отримують стакінг
                    if (target.thorns) score += target.thorns * 20;
                    // Гідра (38) — шипи підсилять її здатність (кожен удар → подвоєння атаки)
                    if (target.id === 38) score += 60;
                    // Залізний Лицар (3) — тяжкий і довго живе під ударами
                    if (target.id === 3) score += 40;
                    // Терновий Вартовий (68) вже має шипи 3
                    if (target.id === 68) score += 50;
                    // НЕ давати шипи Камікадзе — він вмирає після першої атаки
                    if (target.id === 33) score -= 50;
                }
                break;

            case 'buff_revive':
                if (isEnemy && !target.appliedAuras?.includes('buff_revive')) {
                    // ── ПРІОРИТЕТ: Останнє Бажання на легендарних/ключових ──────
                    const rarityVal = { legendary: 100, epic: 60, rare: 30, common: 10 }[target.rarity] || 0;
                    score = rarityVal + target.damage * 8 + target.hp * 3;
                    // Нікіта (51) — аура: відродження дозволяє аурі ще один хід
                    if (target.id === 51) score += 80;
                    // Рустам (50) — його пасив накопичується, відродження = ще більше стаків
                    if (target.id === 50) score += 70;
                    // Артем (53) — відродження = другий шанс на x2 buff
                    if (target.id === 53) score += 60;
                    // Командир Гвардії (65) — аура Common-юнітів
                    if (target.id === 65) score += 50;
                }
                break;

            // ── CONTROL SPELLS ─────────────────────────────────────────────────
            case 'half_hp':
                if (isPlayerUnit) {
                    score = (target.hp / 2) * 10;
                    if (target.hp >= 10) score += 40;
                    // ── COMBO: Sunder + атакер доб'є ────────────────────────────
                    const halfHp = Math.floor(target.hp / 2);
                    const killers = this.field.filter(u => u && u.isEnemy && u.damage > 0);
                    killers.forEach(killer => {
                        if (halfHp <= Math.max(0, killer.damage - (target.armor || 0))) {
                            score += 80; // Sunder відкриває вбивство!
                        }
                    });
                }
                break;

            case 'permanent_weaken':
                if (isPlayerUnit) {
                    score = effect.value * 20;
                    score += target.damage * 10; // Ослаблення небезпечних юнітів пріоритет
                    // Особливо ціннисто проти юнітів які атакують декілька разів (Берсерк, Гідра)
                    if (target.id === 19) score += 30; // Берсерк — ослаблений буде накопичувати менше
                    if (target.id === 38) score += 50; // Гідра — якщо вона вже накопичила дамаг
                }
                break;

            case 'steal_unit':
                if (isPlayerUnit) {
                    const tRow = Math.floor(targetIdx / this.gridSize);
                    if (tRow === this.gridSize - 1) {
                        score = -100;
                    } else {
                        score = (target.damage * 5 + target.hp * 2 + target.mana * 10) * 2;
                        // Красти легендарних — найвигідніше
                        const rarityBonus = { legendary: 100, epic: 50, rare: 20, common: 0 }[target.rarity] || 0;
                        score += rarityBonus;
                    }
                }
                break;

            case 'magic_chain':
                if (isPlayerUnit) {
                    score = target.hp * 5;
                    score += target.damage * 8;
                    // Зв'язуємо найнебезпечнішого ворога — тепер він отримує урон від наших спелів на інших
                    if (target.damage >= 5) score += 40;
                }
                break;

            case 'copy_stats':
                if (isEnemy) {
                    let bestSourceVal = 0;
                    this.field.forEach(u => {
                        if (u && !u.isEnemy) {
                            const val = u.damage + u.hp + (u.armor || 0);
                            if (val > bestSourceVal) bestSourceVal = val;
                        }
                    });
                    const targetVal = target.damage + target.hp + (target.armor || 0);
                    if (bestSourceVal > targetVal + 5) score = (bestSourceVal - targetVal) * 5;
                }
                break;

            case 'adrenaline':
                if (isEnemy) {
                    // Дозволяє атакувати ще раз, але -3 HP
                    // ── ПРІОРИТЕТ: Найкращий кандидат для Адреналіну ────────────
                    if (target.hasMovedThisTurn) {
                        // Юніт вже ходив — Адреналін дає ще один удар
                        score = target.damage * 15;

                        // Камікадзе (33) — НЕБАЖАНО (він вмирає після першої атаки)
                        if (target.id === 33) score = -100;

                        // Дракон (27) + Майстер Рикошету (62) — дальній + подвійна атака = смерть
                        if (target.id === 27 || target.id === 62) score += 80;
                        // Вампір (21) — лікується від кожної атаки
                        if (target.id === 21) score += 50;
                        // Тіньовий Зв'язківець (56) — відбиває урон ДВІЧІ
                        if (target.id === 56) score += 40;

                        // Не варто на юніт з малими HP (може загинути від -3 HP)
                        if (target.hp <= 5) score -= 60;
                        // Добре якщо може добити героя
                        if (this.playerHp <= target.damage * 2) score += 120;
                    } else {
                        score = -50; // Юніт ще не ходив — немає сенсу
                    }
                }
                break;

            case 'energy_surge':
                if (isPlayerUnit) {
                    // Наносить X дамагу де X = мана що залишилась ПІСЛЯ розігрування
                    const remainingMana = Math.max(0, this.enemyMana - card.mana);
                    if (remainingMana > 0) {
                        score = remainingMana * 15;
                        if (target.hp <= remainingMana) score += 60; // Вбивство!
                        score += target.damage * 2;
                    } else {
                        score = -100; // Немає мани — марний
                    }
                }
                break;

            case 'push_back':
                if (isPlayerUnit) {
                    score = 20;
                    // ── ПРІОРИТЕТ: відштовхнути юніта що загрожує лицю ─────────
                    const pRow = Math.floor(targetIdx / this.gridSize);
                    if (pRow === this.gridSize - 1 && target.range <= 1) {
                        score += 50; // Вже на позиції атаки — відкидаємо!
                    }
                    score += target.damage * 3;
                }
                break;

            case 'destroy_all':
                // Оцінюємо в evaluateSpellNoTarget
                score = -100;
                break;

            case 'damage_all_enemies':
                // Оцінюємо в evaluateSpellNoTarget
                score = -100;
                break;

            case 'heal_all_allies':
                // Оцінюємо в evaluateSpellNoTarget
                score = -100;
                break;

            case 'time_loop':
                score = -100;
                break;

            default:
                if ((isPlayerUnit && ['permanent_weaken'].includes(effect.type)) ||
                    (isEnemy && ['heal_all_allies'].includes(effect.type))) {
                    score = 20;
                }
        }
        return score;
    },

    // ═══════════════════════════════════════════════════════════════════
    //  ОЦІНКА ЗАКЛЯТЬ БЕЗ КОНКРЕТНОЇ ЦІЛІ
    // ═══════════════════════════════════════════════════════════════════

    evaluateSpellNoTarget(card) {
        if (!card.effect) return -100;

        switch (card.effect.type) {
            case 'heal_all_allies': {
                // Святе Сяйво (20) — лікує всіх союзників на 3 HP
                const totalMissing = this.field.reduce((sum, u) => {
                    if (u && u.isEnemy) {
                        const missing = (u.maxHp || 10) - u.hp;
                        return sum + Math.min(missing, card.effect.value);
                    }
                    return sum;
                }, 0);
                return totalMissing > 0 ? totalMissing * 10 : -100;
            }

            case 'damage_all_enemies': {
                // Землетрус (14) — 2 урону всім ворогам
                let totalDmg = 0;
                this.field.forEach(u => {
                    if (u && !u.isEnemy) {
                        if (u.id === 37) return;
                        totalDmg += card.effect.value;
                        if (u.hp <= card.effect.value) totalDmg += 10; // Вбивство!
                    }
                });
                return totalDmg > 0 ? totalDmg * 10 : -100;
            }

            case 'destroy_all': {
                // Армагеддон (35) — знищує ВСЕ
                let enemyVal = 0, myVal = 0;
                this.field.forEach(u => {
                    if (u) {
                        const val = (u.damage || 0) * 5 + (u.hp || 0) * 2 + (u.mana || 0) * 5;
                        if (u.isEnemy) myVal += val; else enemyVal += val;
                    }
                });
                // Граємо Армагеддон тільки якщо противник значно сильніший
                if (enemyVal > myVal * 1.5 || (enemyVal > 30 && myVal < 10)) {
                    return (enemyVal - myVal) + 50;
                }
                return -100;
            }

            case 'time_loop': {
                // Часова Петля (28) — повертає стан до початку ходу
                // Грати тільки якщо ми сильно програємо (отримали більше шкоди ніж нанесли)
                const snapshot = this.turnStartSnapshot;
                if (!snapshot) return -100;
                let botHpLoss = 0;
                this.field.forEach((u, i) => {
                    if (u && u.isEnemy) {
                        const snapUnit = snapshot.field ? snapshot.field[i] : null;
                        if (snapUnit) botHpLoss += Math.max(0, snapUnit.hp - u.hp);
                    }
                });
                return botHpLoss >= 10 ? botHpLoss * 8 : -100;
            }

            default:
                return -100;
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    //  ПОШУК НАЙКРАЩОЇ ЦІЛІ ДЛЯ АТАКИ
    // ═══════════════════════════════════════════════════════════════════

    findBestAttackTarget(unit, idx) {
        let bestTarget = null;
        let bestScore = -Infinity;

        // 1. Атака по Герою
        if (this.canAttack(idx, -2)) {
            let score = 50;
            if (this.isLethalTurn || this.playerHp <= unit.damage) {
                score = 1_000_000;
            } else if (this.playerHp < 15) {
                score += 100;
            } else if (this.playerHp < 25) {
                score += 40;
            }
            if (score > bestScore) { bestScore = score; bestTarget = -2; }
        }

        // 2. Атака по юнітах
        for (let i = 0; i < this.gridSize * this.gridSize; i++) {
            if (!this.canAttack(idx, i)) continue;

            const target = this.field[i];
            let score = 10;

            // Особливості атакера
            const attackerIgnoresArmor = unit.id === 53; // Артем ігнорує броню
            const attackerHalfArmor = unit.id === 43; // Чумний Лікар ігнорує 50% броні
            const effectiveArmor = attackerIgnoresArmor ? 0
                : attackerHalfArmor ? Math.floor((target.armor || 0) / 2)
                    : (target.armor || 0);

            const damageDealt = Math.max(0, unit.damage - effectiveArmor);
            const selfDamage = Math.max(0, target.damage - (unit.armor || 0));

            // Урон від шипів цілі
            const thornsDamage = target.thorns || 0;
            const totalSelfDmg = selfDamage + thornsDamage;

            const targetDies = target.hp <= damageDealt;
            const weDie = unit.hp <= totalSelfDmg;

            // Загальна небезпека цілі — дамаг + шипи + спецздатності
            score += target.damage * 10;

            // Бонус за знищення юніта що вже атакував і завдав шкоди
            if (!target.hasMovedThisTurn) score += 15; // Ще не атакував цього ходу — небезпечний

            // Якщо ціль може вбити нашого героя наступного ходу — пріоритет
            const threatToHero = this._aiEstimateUnitThreatToHero(target);
            if (threatToHero >= this.enemyHp) score += 200;
            else if (threatToHero > 0) score += threatToHero * 5;

            // Вбивство
            if (targetDies) {
                score += 150;
                const overkill = damageDealt - target.hp;
                if (overkill > 2) score -= overkill * 5;
            }

            // Майже мертва ціль
            if (target.hp <= 3) score += 80;
            else if (target.hp <= 6) score += 30;

            // Ключові цілі
            if (target.id === 47) score += 30; // Охоронець
            if ([34, 65].includes(target.id)) score += 25; // Аурники
            if (target.id === 51) score += 40; // Нікіта — небезпечний
            if (target.id === 61) score += 20; // Кровопивця — відновлює HP

            // Зняття броні
            if (target.armor > 0 && damageDealt > 0) score += 20;

            // ── НЕ атакувати Шипових якщо дороге коштуватиме нам більше ────────
            if (thornsDamage > 0) {
                const unitValue = unit.damage * 5 + unit.hp * 2;
                const thornsThreat = thornsDamage;
                // Якщо шипи можуть нас вбити і ціль не дуже цінна
                if (weDie && thornsDamage >= unit.hp) {
                    const targetValue = target.damage * 5 + target.hp * 2;
                    if (targetValue < unitValue * 0.7) score -= 60;
                }
            }

            // ── Торгівля значеннями ──────────────────────────────────────────
            const myValue = unit.damage * 5 + unit.hp * 2;
            const targetValue = target.damage * 5 + target.hp * 2;

            if (weDie) {
                if (targetDies) {
                    const valueDiff = targetValue - myValue;
                    if (valueDiff > 0) score += 50 + valueDiff;
                    else score -= 50 + Math.abs(valueDiff);
                } else {
                    score -= 100;
                    if (target.hp <= 3 && target.damage > 5) score += 40;
                }
            } else {
                if (targetDies) {
                    score += 200;
                    if (selfDamage === 0) score += 50;
                } else {
                    score += (damageDealt * 2 - totalSelfDmg * 2);
                    if (targetValue > 20) score += 20;
                }
            }

            if (score > bestScore) { bestScore = score; bestTarget = i; }
        }

        return bestTarget;
    },

    // ═══════════════════════════════════════════════════════════════════
    //  ПОШУК НАЙКРАЩОГО РУХУ
    // ═══════════════════════════════════════════════════════════════════

    findBestMove(unit, idx) {
        const row = Math.floor(idx / this.gridSize);
        const col = idx % this.gridSize;
        const range = unit.range || 1;

        // Дальнобійники стоять на місці якщо вже є ціль
        if (range > 1) {
            let hasTarget = this.canAttack(idx, -2);
            if (!hasTarget) {
                for (let i = 0; i < this.gridSize * this.gridSize; i++) {
                    if (this.canAttack(idx, i)) { hasTarget = true; break; }
                }
            }
            if (hasTarget) return -1;
        }

        // Будуємо список кандидатів на переміщення з оцінкою
        const candidates = [];

        // 1. Вперед (пріоритет)
        if (row < this.gridSize - 1) {
            const fwd = (row + 1) * this.gridSize + col;
            if (this.field[fwd] === null) candidates.push({ dest: fwd, score: 100 });
        }

        // 2. Бокові переміщення — шукаємо колонку з ворогами або прохід вперед
        for (const dc of [-1, 1]) {
            const newCol = col + dc;
            if (newCol < 0 || newCol >= this.gridSize) continue;
            const sideIdx = row * this.gridSize + newCol;
            if (this.field[sideIdx] !== null) continue; // зайнято

            let sideScore = 10;

            // Бонус якщо з нової колонки можна вийти вперед
            if (row < this.gridSize - 1) {
                const fwdFromSide = (row + 1) * this.gridSize + newCol;
                if (this.field[fwdFromSide] === null) sideScore += 40;
            }

            // Бонус якщо в колонці є ворог якого можна атакувати
            for (let r = 0; r < this.gridSize; r++) {
                const u = this.field[r * this.gridSize + newCol];
                if (u && !u.isEnemy) { sideScore += 30 + u.damage * 5; break; }
            }

            // Бонус якщо поруч є союзний аурник (Охоронець, Жриця, Нікіта)
            const leftAura = this.field[row * this.gridSize + newCol - 1];
            const rightAura = this.field[row * this.gridSize + newCol + 1];
            [leftAura, rightAura].forEach(a => {
                if (a && a.isEnemy && [47, 32, 51].includes(a.id)) sideScore += 25;
            });

            candidates.push({ dest: sideIdx, score: sideScore });
        }

        if (candidates.length === 0) return -1;
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].dest;
    },

    // ═══════════════════════════════════════════════════════════════════
    //  ОНОВЛЕННЯ АУР
    // ═══════════════════════════════════════════════════════════════════

    // ─── Оцінка потенційної загрози юніта нашому герою ────────────────────────
    _aiEstimateUnitThreatToHero(unit) {
        if (!unit || unit.isEnemy) return 0;
        // Скільки може нанести за 1 хід (дальність дозволяє?)
        const range = unit.range || 1;
        let minRowToHero = Infinity;
        this.field.forEach((u, i) => {
            if (u === unit) {
                const r = Math.floor(i / this.gridSize);
                minRowToHero = Math.min(minRowToHero, this.gridSize - 1 - r);
            }
        });
        if (minRowToHero <= range) return Math.max(0, unit.damage);
        return 0;
    },

    // ─── Порядок гри: спочатку бафф-спели, потім юніти ─────────────────────────
    _aiSortHandByPriority() {
        if (!this.enemyHand.length) return;
        this.enemyHand.sort((a, b) => {
            // Buff/heal спели — грати першими (щоб юніти отримали бафф до атаки)
            const isBuffA = a.type === 'spell' && a.effect && ['buff_damage', 'buff_armor', 'buff_lifesteal', 'buff_thorns', 'heal', 'adrenaline'].includes(a.effect.type);
            const isBuffB = b.type === 'spell' && b.effect && ['buff_damage', 'buff_armor', 'buff_lifesteal', 'buff_thorns', 'heal', 'adrenaline'].includes(b.effect.type);
            if (isBuffA && !isBuffB) return -1;
            if (!isBuffA && isBuffB) return 1;

            // Control спели другими (freeze, destroy_armor тощо)
            const isCtrlA = a.type === 'spell' && !isBuffA;
            const isCtrlB = b.type === 'spell' && !isBuffB;
            if (isCtrlA && !isCtrlB) return -1;
            if (!isCtrlA && isCtrlB) return 1;

            // Юніти — дешевші спочатку (щоб не застрягти з незіграними картами)
            return a.mana - b.mana;
        });
    },

    updateAuras() {
        const flagBearers = this.field
            .map((card, idx) => ({ card, idx }))
            .filter(item => item.card && item.card.id === 34);

        const bodyguards = this.field
            .map((card, idx) => ({ card, idx }))
            .filter(item => item.card && item.card.id === 47);

        this.field.forEach((unit, unitIdx) => {
            if (!unit) return;

            // --- Дзеркальний Дроїд (ID 54) ---
            if (unit.id === 54) {
                const unitRow = Math.floor(unitIdx / this.gridSize);
                const unitCol = unitIdx % this.gridSize;
                let targetEnemy = null;
                let minDist = Infinity;

                for (let r = 0; r < this.gridSize; r++) {
                    const otherUnit = this.field[r * this.gridSize + unitCol];
                    if (otherUnit && otherUnit.isEnemy !== unit.isEnemy) {
                        const dist = Math.abs(r - unitRow);
                        if (dist < minDist) { minDist = dist; targetEnemy = otherUnit; }
                    }
                }

                const newDamage = targetEnemy ? targetEnemy.damage : 0;
                if (unit.damage !== newDamage) {
                    unit.damage = newDamage;
                    this.applyStatCaps(unit);
                }
            }

            // --- Прапороносець (ID 34) ---
            const stackCount = flagBearers.filter(fb => fb.card.isEnemy === unit.isEnemy).length;
            const currentStacks = unit.flagBearerStacks || 0;

            if (stackCount !== currentStacks) {
                const diff = stackCount - currentStacks;
                unit.damage += diff;
                unit.armor = (unit.armor || 0) + diff;
                this.applyStatCaps(unit);
                unit.flagBearerStacks = stackCount;

                if (stackCount > 0) {
                    if (!unit.appliedAuras) unit.appliedAuras = [];
                    if (!unit.appliedAuras.includes('flag_bearer')) unit.appliedAuras.push('flag_bearer');
                } else {
                    if (unit.appliedAuras) unit.appliedAuras = unit.appliedAuras.filter(a => a !== 'flag_bearer');
                }
            }

            // --- Охоронець (ID 47) ---
            const unitRow = Math.floor(unitIdx / this.gridSize);
            const unitCol = unitIdx % this.gridSize;
            let bodyguardBuffs = 0;

            bodyguards.forEach(bg => {
                if (bg.card.isEnemy === unit.isEnemy && bg.idx !== unitIdx) {
                    const bgRow = Math.floor(bg.idx / this.gridSize);
                    const bgCol = bg.idx % this.gridSize;
                    if (Math.abs(unitRow - bgRow) + Math.abs(unitCol - bgCol) === 1) bodyguardBuffs++;
                }
            });

            const currentBodyguardStacks = unit.bodyguardStacks || 0;
            if (bodyguardBuffs !== currentBodyguardStacks) {
                const diff = bodyguardBuffs - currentBodyguardStacks;
                unit.armor = (unit.armor || 0) + diff;
                this.applyStatCaps(unit);
                unit.bodyguardStacks = bodyguardBuffs;

                if (bodyguardBuffs > 0) {
                    if (!unit.appliedAuras) unit.appliedAuras = [];
                    if (!unit.appliedAuras.includes('bodyguard_aura')) unit.appliedAuras.push('bodyguard_aura');
                } else {
                    if (unit.appliedAuras) unit.appliedAuras = unit.appliedAuras.filter(a => a !== 'bodyguard_aura');
                }
            }

            // --- Командир Гвардії (ID 65) ---
            if (unit.rarity === 'common') {
                const commanderCount = this.field.filter(c => c && c.id === 65 && c.isEnemy === unit.isEnemy).length;
                const currentCmdStacks = unit.commanderStacks || 0;

                if (commanderCount !== currentCmdStacks) {
                    const diff = commanderCount - currentCmdStacks;
                    unit.damage += (diff * 2);
                    unit.armor = (unit.armor || 0) + (diff * 2);
                    this.applyStatCaps(unit);
                    unit.commanderStacks = commanderCount;

                    if (commanderCount > 0) {
                        if (!unit.appliedAuras) unit.appliedAuras = [];
                        if (!unit.appliedAuras.includes('commander_aura')) unit.appliedAuras.push('commander_aura');
                    } else {
                        if (unit.appliedAuras) unit.appliedAuras = unit.appliedAuras.filter(a => a !== 'commander_aura');
                    }
                }
            }
        });
    }

}); // Object.assign(Game.prototype, ...)
