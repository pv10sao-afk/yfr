// ========== GAME-COMBAT.JS ==========
// Бойова логіка: canAttack, attack, takeDamage, applyEffect, playCard та ін.
// Object.assign mixin на Game.prototype. Завантажувати ПІСЛЯ game.js.

Object.assign(Game.prototype, {

checkProximityReveal() {
    for (let i = 0; i < this.field.length; i++) {
        const card = this.field[i];
        if (card && !card.isEnemy) {
            const row = Math.floor(i / this.gridSize);
            const col = i % this.gridSize;
            for (let r = row - 1; r <= row + 1; r++) {
                for (let c = col - 1; c <= col + 1; c++) {
                    if (r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize) {
                        const nIdx = r * this.gridSize + c;
                        const neighbor = this.field[nIdx];
                        if (neighbor && neighbor.isEnemy && !neighbor.isRevealed) {
                            neighbor.isRevealed = true;
                            this.log(`${window.TRANSLATIONS[window.currentLang].revealed} ${neighbor.name[window.currentLang]}!`);
                        }
                    }
                }
            }
        }
    }
},

isPathBlocked(fromIdx, targetIdx) {
    const unit = this.field[fromIdx];
    if (!unit) return true;

    if (targetIdx === -1 || targetIdx === -2) {
        const col = fromIdx % this.gridSize;
        const row = Math.floor(fromIdx / this.gridSize);

        if (targetIdx === -1) { // Ворожий бос зверху
            for (let r = row - 1; r >= 0; r--) {
                if (this.field[r * this.gridSize + col] !== null) return true;
            }
        } else { // Свій бос знизу
            for (let r = row + 1; r < this.gridSize; r++) {
                if (this.field[r * this.gridSize + col] !== null) return true;
            }
        }
        return false;
    }

    const r1 = Math.floor(fromIdx / this.gridSize);
    const c1 = fromIdx % this.gridSize;
    const r2 = Math.floor(targetIdx / this.gridSize);
    const c2 = targetIdx % this.gridSize;

    if (r1 === r2) {
        const minC = Math.min(c1, c2);
        const maxC = Math.max(c1, c2);
        for (let c = minC + 1; c < maxC; c++) {
            if (this.field[r1 * this.gridSize + c] !== null) return true;
        }
        return false;
    } else if (c1 === c2) {
        const minR = Math.min(r1, r2);
        const maxR = Math.max(r1, r2);
        for (let r = minR + 1; r < maxR; r++) {
            if (this.field[r * this.gridSize + c1] !== null) return true;
        }
        return false;
    }

    return false;
},

isPathBlockedByEnemy(fromIdx, targetIdx) {
    // Перевіряє, чи є ВОРОГ на шляху
    // Використовується для стрільців (range > 1) при атаці БОСА
    const unit = this.field[fromIdx];
    if (!unit) return true;

    if (targetIdx === -1 || targetIdx === -2) {
        const col = fromIdx % this.gridSize;
        const row = Math.floor(fromIdx / this.gridSize);

        if (targetIdx === -1) { // Ворожий бос зверху
            for (let r = row - 1; r >= 0; r--) {
                const obstacleIdx = r * this.gridSize + col;
                const obstacle = this.field[obstacleIdx];

                if (obstacle) {
                    // obstacle.isEnemy === unit.isEnemy  -> Союзник (прозорий)
                    // obstacle.isEnemy !== unit.isEnemy  -> Ворог (блокує)
                    if (obstacle.isEnemy !== unit.isEnemy) return true;
                }
            }
        } else { // Свій бос знизу (для ворожих стрільців)
            for (let r = row + 1; r < this.gridSize; r++) {
                const obstacleIdx = r * this.gridSize + col;
                const obstacle = this.field[obstacleIdx];

                if (obstacle) {
                    if (obstacle.isEnemy !== unit.isEnemy) return true;
                }
            }
        }
        return false;
    }

    // Для атаки по юнітах
    const r1 = Math.floor(fromIdx / this.gridSize);
    const c1 = fromIdx % this.gridSize;
    const r2 = Math.floor(targetIdx / this.gridSize);
    const c2 = targetIdx % this.gridSize;

    if (r1 === r2) {
        const minC = Math.min(c1, c2);
        const maxC = Math.max(c1, c2);
        for (let c = minC + 1; c < maxC; c++) {
            const obstacle = this.field[r1 * this.gridSize + c];
            if (obstacle && obstacle.isEnemy !== unit.isEnemy) return true;
        }
        return false;
    } else if (c1 === c2) {
        const minR = Math.min(r1, r2);
        const maxR = Math.max(r1, r2);
        for (let r = minR + 1; r < maxR; r++) {
            const obstacle = this.field[r * this.gridSize + c1];
            if (obstacle && obstacle.isEnemy !== unit.isEnemy) return true;
        }
        return false;
    }

    return false;
},

getDistance(fromIdx, targetIdx) {
    if (targetIdx === -1) { // Ворожий бос
        return Math.floor(fromIdx / this.gridSize);
    }
    if (targetIdx === -2) { // Свій бос
        return (this.gridSize - 1) - Math.floor(fromIdx / this.gridSize);
    }

    const r1 = Math.floor(fromIdx / this.gridSize);
    const c1 = fromIdx % this.gridSize;
    const r2 = Math.floor(targetIdx / this.gridSize);
    const c2 = targetIdx % this.gridSize;
    return Math.abs(r1 - r2) + Math.abs(c1 - c2);
},

canAttack(fromIdx, targetIdx) {
    const unit = this.field[fromIdx];
    if (!unit || unit.hasMovedThisTurn || unit.isFrozen) return false;

    // Логіка атаки по босу
    if (targetIdx === -1 || targetIdx === -2) {
        const isEnemyBoss = targetIdx === -1;
        if (unit.isEnemy === isEnemyBoss) return false;

        const range = Number(unit.range) || 1;

        // Списоносець Авангарду (ID 58): атакує тільки по своєму стовпчику
        if (unit.id === 58) {
            if (!this.isPathBlockedByEnemy(fromIdx, targetIdx)) return true;
            return false;
        }

        // Лучники (range > 1) можуть атакувати боса тільки якщо на їхній лінії немає ворогів
        if (range > 1) {
            if (!this.isPathBlockedByEnemy(fromIdx, targetIdx)) return true;
            return false;
        }

        // Звичайні карти (range 1) дістають до боса з будь-якого ряду, якщо перед ними ПУСТО (немає нікого)
        if (!this.isPathBlocked(fromIdx, targetIdx)) return true;

        return false;
    }

    // Логіка атаки по юнітах на полі
    const gridTotal = this.gridSize * this.gridSize;
    if (targetIdx >= 0 && targetIdx < gridTotal) {
        const target = this.field[targetIdx];
        if (!target || target.isEnemy === unit.isEnemy) return false;

        const dist = this.getDistance(fromIdx, targetIdx);
        const range = Number(unit.range) || 1;

        if (dist > range) return false;

        // Списоносець Авангарду (ID 58): атакує тільки по своєму стовпчику (пряма лінія)
        if (unit.id === 58) {
            const c1 = fromIdx % this.gridSize;
            const c2 = targetIdx % this.gridSize;
            if (c1 !== c2) return false;
            // Перевіряємо чи немає юнітів на шляху
            if (this.isPathBlocked(fromIdx, targetIdx)) return false;
            return true;
        }

        if (range <= 1) {
            // Ближній бій перевіряє чи є хтось на шляху
            if (this.isPathBlocked(fromIdx, targetIdx)) return false;
        } else {
            // Дальній бій (range > 1) може атакувати тільки юнітів на своїй лінії
            const c1 = fromIdx % this.gridSize;
            const c2 = targetIdx % this.gridSize;
            if (c1 !== c2) return false;
        }
        return true;
    }

    return false;
},

moveUnit(fromIdx, toIdx, isRemote = false) {
    const card = this.field[fromIdx];
    if (!card || ((card.hasMovedThisTurn || card.isFrozen) && !isRemote)) return false;

    if (this.isMultiplayer && !isRemote && this.turnPlayer !== playerRole) {
        this.log(window.TRANSLATIONS[window.currentLang].notYourTurn);
        return false;
    }

    const dist = Math.abs(Math.floor(fromIdx / this.gridSize) - Math.floor(toIdx / this.gridSize)) + Math.abs((fromIdx % this.gridSize) - (toIdx % this.gridSize));

    // Перевірка обмеження по рядах (не можна заходити в тил ворога)
    const targetRow = Math.floor(toIdx / this.gridSize);
    if (card.isEnemy) {
        // Ворог не може заходити на останній ряд гравця
        if (targetRow === this.gridSize - 1) {
            if (!isRemote) this.log(window.TRANSLATIONS[window.currentLang].wrongRowEnemy);
            return false;
        }
    } else {
        // Гравець не може заходити на нульовий ряд ворога
        if (targetRow === 0) {
            if (!isRemote) this.log(window.TRANSLATIONS[window.currentLang].wrongRowPlayer);
            return false;
        }
    }

    if (dist === 1 && this.field[toIdx] === null) {
        this.field[toIdx] = card;
        this.field[fromIdx] = null;
        card.hasMovedThisTurn = true;
        this.checkProximityReveal();
        this.updateUI();
        this.log(window.TRANSLATIONS[window.currentLang].unitMoved);

        if (this.isMultiplayer && !isRemote) {
            this.sendAction({ type: 'MOVE_UNIT', from: fromIdx, to: toIdx });
        }
        return true;
    }
    return false;
},

attack(fromIdx, targetIdx, isRemote = false) {
    if (this.checkGameOver()) return false;

    const unit = this.field[fromIdx];
    if (!this.canAttack(fromIdx, targetIdx) && !isRemote) return false;

    if (this.isMultiplayer && !isRemote && this.turnPlayer !== playerRole) {
        this.log(window.TRANSLATIONS[window.currentLang].notYourTurn);
        return false;
    }

    const target = targetIdx < 0 ? { name: { uk: "Боса", en: "Boss" }, hp: (targetIdx === -1 ? this.enemyHp : this.playerHp) } : this.field[targetIdx];

    // Виконання атаки
    SoundEngine.play('attack');
    const boardEl = document.getElementById('game-board');
    if (boardEl) { boardEl.classList.add('board-shake'); setTimeout(() => boardEl.classList.remove('board-shake'), 300); }

    // Attack animation on attacker
    if (fromIdx >= 0) animateCardSlot(fromIdx, 'card-attack-src', 450);
    // Hit animation on target
    if (targetIdx >= 0) {
        setTimeout(() => animateCardSlot(targetIdx, 'card-hit', 500), 150);
    }
    if (targetIdx === -1) {
        this.enemyHp -= unit.damage;
        this.log(`${unit.name[window.currentLang]} атакує ворожого боса на ${unit.damage}!`);

        // Daily Quest Progress (only if it's the player's unit, checked by not being a remote attack originally)
        if (!unit.isEnemy) {
            window.updateQuestProgress('deal_damage', unit.damage);
            window.achOnDamage?.(unit.damage);
            // Card Challenge: deal_dmg
            window.updateCardChallengeProgress?.('deal_dmg', unit.id, unit.damage);
        }

        // Вампір (ID 21) або Lifesteal
        if (unit.id === 21 || (unit.appliedAuras && unit.appliedAuras.includes('lifesteal'))) {
            const modifier = this.getHealingModifier(unit);
            const heal = Math.floor(unit.damage * modifier);
            if (heal > 0) {
                unit.hp += heal;
                this.applyStatCaps(unit);
                this.log(`${unit.name[window.currentLang]} ${window.TRANSLATIONS[window.currentLang].lifestealLog} ${heal} ${window.TRANSLATIONS[window.currentLang].life}`);
            }
        }
    } else if (targetIdx === -2) {
        this.playerHp -= unit.damage;
        this.log(`${unit.name[window.currentLang]} атакує вашого боса на ${unit.damage}!`);

        // Вампір (ID 21) або Lifesteal
        if (unit.id === 21 || (unit.appliedAuras && unit.appliedAuras.includes('lifesteal'))) {
            const modifier = this.getHealingModifier(unit);
            const heal = Math.floor(unit.damage * modifier);
            if (heal > 0) {
                unit.hp += heal;
                this.applyStatCaps(unit);
                this.log(`${unit.name[window.currentLang]} ${window.TRANSLATIONS[window.currentLang].lifestealLog} ${heal} ${window.TRANSLATIONS[window.currentLang].life}`);
            }
        }
    } else {
        // Атака юніта
        let effectiveArmor = Math.max(0, target.armor || 0);
        let attackDamage = unit.damage;

        // Нікіта: Залізний Кураж (ID 51) - Пасивка: +2 HP коли отримує урон
        if (target.id === 51) {
            if (!target.maxHp) target.maxHp = target.hp; // Ensure maxHp exists
            target.hp += 2;
            target.maxHp += 2; // Збільшуємо також макс. здоров'я
            this.applyStatCaps(target);
            if (target.maxHp > 80) target.maxHp = 80; // Hard cap for maxHp
            this.log(`${target.name[window.currentLang]} стає міцнішим від удару! (+2 ❤️)`);
        }

        // Драконоборець (ID 45) - подвійний урон по цілях з HP > 10
        if (unit.id === 45 && target.hp > 10) {
            attackDamage *= 2;
            this.log(`${unit.name[window.currentLang]} наносить подвійний урон по велетню!`);
        }

        // Чумний Лікар (ID 43) - ігнорує 50% броні
        if (unit.id === 43) {
            effectiveArmor = Math.floor(effectiveArmor * 0.5);
            this.log(`${unit.name[window.currentLang]} ігнорує частину броні!`);
        }

        // Важкий Арбалетник (ID 46) - ігнорує 1 одиницю броні
        if (unit.id === 46 && effectiveArmor > 0) {
            effectiveArmor = Math.max(0, effectiveArmor - 1);
            this.log(`${unit.name[window.currentLang]} пробиває броню!`);
        }

        // Артем: Тіньовий Стратег (ID 53) - Точне Пробиття (ігнорує броню)
        if (unit.id === 53) {
            effectiveArmor = 0;
            this.log(`${unit.name[window.currentLang]} знаходить слабке місце! (Броня зігнорована)`);
        }

        // Мисливець на Відьом (ID 63) - Подвійний урон по цілях з бафами
        if (unit.id === 63 && target.appliedAuras && target.appliedAuras.length > 0) {
            attackDamage *= 2;
            this.log(`🔥 ${unit.name[window.currentLang]} очищує магію! Подвійний урон!`);
        }

        const damageDealt = Math.max(0, attackDamage - effectiveArmor);

        // Зменшення броні після атаки (якщо була броня)
        if ((target.armor || 0) > 0) {
            target.armor -= 1;
            target.animation = 'armor-crack'; // Додаємо анімацію тріщини
            this.log(`${target.name[window.currentLang]} втрачає 1 одиницю броні!`);
        }

        target.hp -= damageDealt;
        this.log(`${unit.name[window.currentLang]} атакує ${target.name[window.currentLang]} на ${damageDealt} шкоди.`);
        if (damageDealt > 0 && targetIdx >= 0) showDamageFloat(targetIdx, `-${damageDealt}`, '');

        // Card Challenge: deal_dmg (тільки для юнітів гравця)
        if (!unit.isEnemy && damageDealt > 0) {
            window.updateCardChallengeProgress?.('deal_dmg', unit.id, damageDealt);
        }

        // Тіньовий Зв'язківець (ID 56)
        if (target.id === 56 && damageDealt > 0) {
            const reflectDamage = Math.ceil(damageDealt / 2);
            const enemies = this.field.map((u, i) => ({ u, i })).filter(x => x.u && x.u.isEnemy !== target.isEnemy);
            if (enemies.length > 0) {
                const randomEnemy = enemies[Math.floor(this.getRandom() * enemies.length)];
                this.log(`${target.name[window.currentLang]} передає ${reflectDamage} урону ${randomEnemy.u.name[window.currentLang]}!`);
                this.takeDamage(randomEnemy.i, reflectDamage, "Віддача тіні");
            }
        }

        // Гідра (ID 38)
        if (target.id === 38 && damageDealt > 0 && target.hp > 0) {
            target.damage *= 2;
            this.applyStatCaps(target);
            this.log(`${target.name[window.currentLang]} лютує! Атака подвоєна (зараз ${target.damage})`);
        }

        // Берсерк (ID 19) — +1 до атаки при отриманні урону
        if (target.id === 19 && damageDealt > 0 && target.hp > 0) {
            target.damage += 1;
            this.applyStatCaps(target);
            this.log(`${target.name[window.currentLang]} лютує! Дамаг +1 (зараз ${target.damage})`);
        }

        // Вампір (ID 21) або Lifesteal
        if ((unit.id === 21 || (unit.appliedAuras && unit.appliedAuras.includes('lifesteal'))) && damageDealt > 0) {
            const modifier = this.getHealingModifier(unit);
            const heal = Math.floor(damageDealt * modifier);
            if (heal > 0) {
                unit.hp += heal;
                this.applyStatCaps(unit);
                this.log(`${unit.name[window.currentLang]} ${window.TRANSLATIONS[window.currentLang].lifestealLog} ${heal} ${window.TRANSLATIONS[window.currentLang].life}`);
            }
        }

        // Дракон Пустоти (ID 27)
        if (unit.id === 27) {
            const tRow = Math.floor(targetIdx / this.gridSize);
            const tCol = targetIdx % this.gridSize;
            let behindIdx = -1;

            if (unit.isEnemy) {
                // Ворог атакує вниз (збільшення row) -> позаду це row + 1
                behindIdx = (tRow + 1) * this.gridSize + tCol;
            } else {
                // Гравець атакує вгору (зменшення row) -> позаду це row - 1
                behindIdx = (tRow - 1) * this.gridSize + tCol;
            }

            if (behindIdx >= 0 && behindIdx < this.gridSize * this.gridSize) {
                const behindUnit = this.field[behindIdx];
                if (behindUnit && behindUnit.isEnemy === target.isEnemy) {
                    const pierceDamage = Math.floor(unit.damage / 2);
                    this.takeDamage(behindIdx, pierceDamage, `${unit.name[window.currentLang]} (Splash)`, fromIdx);
                }
            }
        }

        if (this.magicChainTarget !== null && this.magicChainTarget !== targetIdx && damageDealt > 0) {
            const chainedUnit = this.field[this.magicChainTarget];
            if (chainedUnit && chainedUnit.hp > 0 && chainedUnit.isEnemy === target.isEnemy) {
                this.takeDamage(this.magicChainTarget, damageDealt, "Магічний Ланцюг", fromIdx);
            }
        }

        // Контратака видалена на прохання користувача
        /*
        if (unit.range === 1 && target.range === 1 && target.hp > 0) {
            const counterDamage = Math.max(0, target.damage - (unit.armor || 0));
            
            if ((unit.armor || 0) > 0) {
                unit.armor -= 1;
                unit.animation = 'armor-crack';
                this.log(`${unit.name[window.currentLang]} втрачає 1 одиницю броні від контратаки!`);
            }
 
            unit.hp -= counterDamage;
            this.log(`${target.name[window.currentLang]} контратакує на ${counterDamage} шкоди.`);
        }
        */

        // Шипи (Thorns)
        const totalThorns = (target.thorns || 0) + (target.thornsBonus || 0);
        if (totalThorns > 0 && damageDealt > 0 && unit.hp > 0) {
            this.takeDamage(fromIdx, totalThorns, `Шипи: ${target.name[window.currentLang]}`, targetIdx);
            const thornsLog = window.currentLang === 'uk' ? 'повертає' : 'returns';
            const dmgText = window.currentLang === 'uk' ? 'урону нападнику' : 'damage to attacker';
            this.log(`🌵 ${target.name[window.currentLang]} ${thornsLog} ${totalThorns} ${dmgText}!`);
        }

        if (target.hp <= 0) {
            // Чумний Щур (ID 57) - Deathrattle
            if (target.id === 57 && unit.hp > 0) {
                this.log(`☠️ ${target.name[window.currentLang]} заражає вбивцю перед смертю!`);
                unit.armor = Math.max(0, (unit.armor || 0) - 2);
                this.takeDamage(fromIdx, 2, "Deathrattle: Чумний Щур");
            }

            // Майстер Рикошету (ID 62)
            if (unit.id === 62) {
                const tRow = Math.floor(targetIdx / this.gridSize);
                const tCol = targetIdx % this.gridSize;
                let behindIdx = -1;

                if (unit.isEnemy) {
                    behindIdx = (tRow + 1) * this.gridSize + tCol;
                } else {
                    behindIdx = (tRow - 1) * this.gridSize + tCol;
                }

                if (behindIdx >= 0 && behindIdx < this.gridSize * this.gridSize) {
                    const behindUnit = this.field[behindIdx];
                    if (behindUnit && behindUnit.isEnemy === target.isEnemy) {
                        this.log(`🏹 ${unit.name[window.currentLang]} прошиває ціль! Стріла летить у ${behindUnit.name[window.currentLang]}!`);
                        this.takeDamage(behindIdx, unit.damage, `${unit.name[window.currentLang]} (Рикошет)`, fromIdx);
                    }
                }
            }

            this.log(`${target.name[window.currentLang]} загинув!`);

            // If the player killed an enemy unit
            if (target.isEnemy && !unit.isEnemy) {
                window.updateQuestProgress('destroy_units', 1);
                window.achOnUnitDestroyed?.();
            }

            // Death animation
            animateCardSlot(targetIdx, 'card-death', 550);
            showDamageFloat(targetIdx, '💀', '');
            setTimeout(() => { this.field[targetIdx] = null; this.updateUI(); }, 560);
        }
    }

    // Камікадзе (ID 33) - помирає після атаки
    if (unit.id === 33 && unit.hp > 0) {
        unit.hp = 0;
        this.log(`${unit.name[window.currentLang]} ${window.TRANSLATIONS[window.currentLang].kamikazeDeath}`);
    }

    let hasPendingDeathAnim = false;
    if (unit.hp <= 0) {
        this.log(`${unit.name[window.currentLang]} загинув!`);
        // Death animation for attacker
        animateCardSlot(fromIdx, 'card-death', 550);
        showDamageFloat(fromIdx, '💀', '');
        hasPendingDeathAnim = true;
        setTimeout(() => { this.field[fromIdx] = null; this.updateUI(); }, 560);
        // skip normal flow since we delay cleanup
    } else {
        unit.hasMovedThisTurn = true;
    }

    if (this.isMultiplayer && !isRemote) {
        this.sendAction({ type: 'ATTACK', from: fromIdx, to: targetIdx });
    }

    this.checkGameOver();
    // Оновлюємо UI одразу тільки якщо немає запланованих анімацій смерті
    if (!hasPendingDeathAnim) {
        this.updateUI();
    }
    return true;
},

// Допоміжна функція для кнопки "Атакувати"
attackEnemy(fromIdx, column) {
    const unit = this.field[fromIdx];
    if (!unit || unit.isEnemy || unit.hasMovedThisTurn || unit.isFrozen) return false;

    // Пріоритет 1: Ворожий бос (якщо в радіусі)
    if (this.canAttack(fromIdx, -1)) {
        this.attack(fromIdx, -1);
        return true;
    }

    // Пріоритет 2: Вороги на полі (шукаємо всіх в радіусі)
    // Сортуємо цілі: спочатку ті, кого можна вбити, потім по найменшому HP
    let validTargets = [];
    for (let i = 0; i < this.gridSize * this.gridSize; i++) {
        if (this.canAttack(fromIdx, i)) {
            validTargets.push(i);
        }
    }

    if (validTargets.length > 0) {
        validTargets.sort((a, b) => {
            const targetA = this.field[a];
            const targetB = this.field[b];
            const canKillA = targetA.hp <= Math.max(0, unit.damage - (targetA.armor || 0));
            const canKillB = targetB.hp <= Math.max(0, unit.damage - (targetB.armor || 0));

            if (canKillA && !canKillB) return -1;
            if (!canKillA && canKillB) return 1;
            return targetA.hp - targetB.hp; // Ascending HP (attack weakest)
        });

        this.attack(fromIdx, validTargets[0]);
        return true;
    }

    return false;
},

takeDamage(targetIdx, amount, sourceName, sourceIndex = null) {
    if (this.checkGameOver()) return;

    const target = this.field[targetIdx];
    if (!target) return;

    let remainingDamage = amount;

    // Закляття та ефекти ігнорують броню і б'ють прямо по HP
    if (remainingDamage > 0) {
        target.hp -= remainingDamage;
        this.log(`${sourceName} ${window.TRANSLATIONS[window.currentLang].hitHp} ${target.name[window.currentLang]} (${remainingDamage} ❤️)`);

        // Apply hit visual effects
        if (target.hp > 0) {
            target.animation = 'taking-damage';
        }
        setTimeout(() => { showDamageFloat(targetIdx, `-${remainingDamage}`, 'damage'); }, 50);

        // Daily Quest for destroy_units by spell (if spell killed an enemy, target.hp <= 0 is checked below, handled in death logic though, but wait takeDamage handles death later)

        // Тіньовий Зв'язківець (ID 56)
        if (target.id === 56 && remainingDamage > 0 && sourceName !== "Віддача тіні") {
            const reflectDamage = Math.ceil(remainingDamage / 2);
            const enemies = this.field.map((u, i) => ({ u, i })).filter(x => x.u && x.u.isEnemy !== target.isEnemy && x.u.hp > 0);
            if (enemies.length > 0) {
                const randomEnemy = enemies[Math.floor(this.getRandom() * enemies.length)];
                this.log(`${target.name[window.currentLang]} передає ${reflectDamage} урону ${randomEnemy.u.name[window.currentLang]}!`);
                this.takeDamage(randomEnemy.i, reflectDamage, "Віддача тіні", targetIdx);
            }
        }

        // Пасивна здатність Берсерка (id 19)
        if (target.id === 19 && target.hp > 0) {
            target.damage += 1;
            this.applyStatCaps(target);
            this.log(`${target.name[window.currentLang]} лютує! Дамаг +1 (зараз ${target.damage})`);
        }

        // Гідра (ID 38) — подвоює атаку при БУДЬ-ЯКОМУ отриманому урону (в т.ч. від заклять)
        // Для звичайних атак це обробляється окремо в блоці фізичного бою.
        if (target.id === 38 && target.hp > 0) {
            target.damage *= 2;
            this.applyStatCaps(target);
            this.log(`${target.name[window.currentLang]} лютує! Атака подвоєна (зараз ${target.damage})`);
        }

        // Нікіта: Залізний Кураж (ID 51) — +2 HP при БУДЬ-ЯКОМУ отриманому урону (в т.ч. від заклять)
        if (target.id === 51 && target.hp > 0) {
            if (!target.maxHp) target.maxHp = target.hp;
            target.hp += 2;
            target.maxHp += 2;
            this.applyStatCaps(target);
            if (target.maxHp > 80) target.maxHp = 80;
            this.log(`${target.name[window.currentLang]} стає міцнішим від удару! (+2 ❤️)`);
        }

        // Магічний Ланцюг (ID 25)
        if (this.magicChainTarget !== null && this.magicChainTarget !== targetIdx && sourceName !== "Магічний Ланцюг") {
            const chainedUnit = this.field[this.magicChainTarget];
            // Ланцюг спрацьовує тільки якщо ціль і зв'язаний юніт належать одній стороні (обидва вороги або обидва свої)
            if (chainedUnit && chainedUnit.hp > 0 && chainedUnit.isEnemy === target.isEnemy) {
                this.takeDamage(this.magicChainTarget, remainingDamage, "Магічний Ланцюг", sourceIndex);
            }
        }

        // Кровопивця (ID 61) - відхил при нанесенні урону будь-кому
        this.field.forEach((unit, idx) => {
            if (unit && unit.id === 61 && unit.hp > 0) {
                if (unit.hp < 40) {
                    unit.hp += 1;
                    if (unit.hp > 40) unit.hp = 40;
                    showDamageFloat(idx, "+1", "heal");
                    this.log(`🦇 ${unit.name[window.currentLang]} п'є пролиту кров і відновлює 1 HP!`);
                }
            }
        });
    }

    if (target.isEnemy) target.isRevealed = true;

    if (target.hp <= 0) {
        // Останнє Бажання (ID 64) - відродження
        if (target.appliedAuras && target.appliedAuras.includes('buff_revive')) {
            // Видалити ауру
            target.appliedAuras = target.appliedAuras.filter(a => a !== 'buff_revive');

            target.hp = 5; // Відроджується з 5 HP
            target.animation = 'heal_aura'; // Просто анімація, щоб показати ефект

            this.log(`✨ ${target.name[window.currentLang]} ${window.TRANSLATIONS[window.currentLang].resurrectMsg}`);
            showDamageFloat(targetIdx, window.TRANSLATIONS[window.currentLang].resurrectFloat, "heal");
            this.updateUI();
            return; // Смерть скасовано
        }

        if (target.isDying) return;
        target.isDying = true;
        target.animation = 'dying';

        // Чумний Щур (ID 57) - Deathrattle
        if (target.id === 57 && sourceName && sourceName !== "Deathrattle: Чумний Щур") {
            let killerIdx = sourceIndex;

            // Якщо sourceIndex не передано, пробуємо знайти за ім'ям (старий метод для сумісності з закляттями)
            if (killerIdx === null) {
                killerIdx = this.field.findIndex(u => u && u.hp > 0 && (sourceName.includes(u.name.uk) || sourceName.includes(u.name.en) || u.name.uk === sourceName || u.name.en === sourceName));
            }

            if (killerIdx !== -1 && killerIdx !== null && this.field[killerIdx]) {
                const killerUnit = this.field[killerIdx];
                this.log(`☠️ ${target.name[window.currentLang]} заражає вбивцю перед смертю!`);
                killerUnit.armor = Math.max(0, (killerUnit.armor || 0) - 2);
                // Викликаємо takeDamage на наступному кроці, щоб уникнути конфліктів стану
                setTimeout(() => {
                    this.takeDamage(killerIdx, 2, "Deathrattle: Чумний Щур", targetIdx);
                }, 0);
            }
        }

        // Check if player killed an enemy unit via spell or effect in takeDamage
        if (target.isEnemy && sourceName && (!sourceName.includes("Deathrattle") && !sourceName.includes("Віддача тіні"))) {
            window.updateQuestProgress('destroy_units', 1);
            window.achOnUnitDestroyed?.();
        }

        this.log(`${target.name[window.currentLang]} ${window.TRANSLATIONS[window.currentLang].died}`);

        setTimeout(() => {
            if (this.field[targetIdx] === target) {
                this.field[targetIdx] = null;
                if (window.game) window.game.updateUI();
            }
        }, 380);

    } else if (target.id === 55 && target.hp < 3) {
        // Нестабільний Елементаль (ID 55): Трансформація
        this.log(`⚠️ ${target.name[window.currentLang]} вибухає!`);

        // Запобігаємо нескінченному циклу, змінюючи ID одразу
        target.id = "55_titan";
        target.name = { uk: "Вогняний Титан", en: "Fire Titan" };
        target.hp = 20;
        target.damage = 15;
        target.armor = 0;
        target.rarity = 'epic';

        // Наносимо 6 урону сусідам
        const row = Math.floor(targetIdx / this.gridSize);
        const col = targetIdx % this.gridSize;
        const neighbors = [
            { r: row - 1, c: col }, { r: row + 1, c: col },
            { r: row, c: col - 1 }, { r: row, c: col + 1 }
        ];

        neighbors.forEach(n => {
            if (n.r >= 0 && n.r < this.gridSize && n.c >= 0 && n.c < this.gridSize) {
                const nIdx = n.r * this.gridSize + n.c;
                if (this.field[nIdx] && nIdx !== targetIdx) {
                    this.takeDamage(nIdx, 6, "Вибух Елементаля");
                }
            }
        });

        this.log(`🔥 На місці вибуху з'являється ${target.name[window.currentLang]}!`);
        this.updateUI();
    }
},

handleOnPlayEffect(effect, unitIndex, isRemote) {
    switch (effect.type) {
        case 'reduce_enemy_mana':
            // Rustam: The Analyst
            if (isRemote) {
                // Enemy played it -> reduce MY mana
                this.mana = Math.max(0, this.mana - effect.value);
                this.log(`Ефект Рустама: Ви втрачаєте ${effect.value} мани!`);
            } else {
                // We played it -> reduce ENEMY mana
                this.enemyMana = Math.max(0, this.enemyMana - effect.value);
                this.log(`Ефект Рустама: Ворог втрачає ${effect.value} мани!`);
            }
            break;
        case 'add_mana':
            if (isRemote) {
                this.enemyMana += effect.value;
            } else {
                this.mana += effect.value;
            }
            this.log(`Ефект: +${effect.value} до мани на цей хід.`);
            break;
        case 'draw_card':
            if (isRemote) {
                this.drawEnemyCard();
            } else {
                this.drawCard();
            }
            this.log(`Ефект: додаткова карта отримана.`);
            break;
        case 'weaken_row':
            const row = Math.floor(unitIndex / this.gridSize);
            let affectedCount = 0;
            for (let c = 0; c < this.gridSize; c++) {
                const idx = row * this.gridSize + c;
                const unit = this.field[idx];
                // isRemote - це той хто поставив карту.
                // unit.isEnemy - це чи є юніт ворогом для ЛОКАЛЬНОГО гравця.
                // Якщо isRemote == false (ми поставили), то вороги це unit.isEnemy == true.
                // Якщо isRemote == true (ворог поставив), то вороги це unit.isEnemy == false (наші юніти).
                if (unit && unit.isEnemy !== isRemote) {
                    unit.damage = Math.max(0, unit.damage - effect.value);
                    affectedCount++;
                }
            }
            if (affectedCount > 0) {
                this.log(`Ефект: ослаблено ${affectedCount} ворогів у ряду.`);
            }
            break;
        case 'freeze_all_enemies':
            // Максим: Зірка Політехніки (ID 52)
            let frozenCount = 0;
            this.field.forEach(unit => {
                // Заморожуємо всіх, хто НЕ на нашій стороні (вороги того, хто зіграв карту)
                if (unit && unit.isEnemy !== isRemote) {
                    unit.isFrozen = (unit.isFrozen || 0) + 1;
                    frozenCount++;
                }
            });
            if (frozenCount > 0) {
                this.log(`Максим заморозив ${frozenCount} ворогів своїм інтелектом!`);
            }
            break;
        case 'prime_next_unit_x2':
            // Артем: Тіньовий Стратег (ID 53)
            this.doubleNextUnitStats = true;
            this.log(window.TRANSLATIONS[window.currentLang].artemPlan);
            break;
    }
    this.updateUI();
},

getHealingModifier(targetUnit) {
    if (!targetUnit) return 1;
    // Перевіряємо, чи є на полі ворожий Чорнокнижник Розпаду (ID 29)
    const hasEnemyWarlock = this.field.some(card =>
        card && card.id === 29 && card.isEnemy !== targetUnit.isEnemy
    );

    if (hasEnemyWarlock) {
        if (window.DEBUG) console.log("Healing reduced by Decay Warlock aura!");
        return 0.5;
    }
    return 1;
},

applyEffect(card, targetIndex, isRemote = false, sourceIndex = null) {
    if (!card.effect) return true;
    const target = this.field[targetIndex];
    const effect = card.effect;
    const lang = window.TRANSLATIONS[window.currentLang];

    // Руйнівник Чар (ID 37) - Імунітет до ворожої магії
    // Перевірка для цільових заклять
    if (target && target.id === 37 && target.isEnemy !== isRemote) {
        this.log(`${target.name[window.currentLang]} має імунітет до магії!`);
        return false;
    }

    // Артем: Тіньовий Стратег (ID 53) - Невидимий, якщо є союзники
    if (target && target.id === 53 && target.isEnemy !== isRemote) {
        const allies = this.field.filter(u => u && u.isEnemy === target.isEnemy && u !== target);
        if (allies.length > 0) {
            this.log(`${target.name[window.currentLang]} прихований за спинами союзників!`);
            return false;
        }
    }

    switch (effect.type) {
        case 'damage_row':
            const tRow = Math.floor(targetIndex / this.gridSize);
            let hits = 0;
            for (let c = 0; c < this.gridSize; c++) {
                const idx = tRow * this.gridSize + c;
                const unit = this.field[idx];
                // Target enemies of the caster
                if (unit && unit.isEnemy !== isRemote) {
                    if (unit.id === 37) {
                        this.log(`${unit.name[window.currentLang]} поглинає магію!`);
                        continue;
                    }
                    showSpellVisual('fireball', idx, isRemote ? 'enemy' : 'player');
                    this.takeDamage(idx, effect.value, card.name[window.currentLang]);
                    hits++;
                }
            }
            return hits > 0;
        case 'half_hp':
            if (target && target.isEnemy !== isRemote) {
                if (target.id === 37) {
                    this.log(`${target.name[window.currentLang]} має імунітет!`);
                    return false;
                }
                const originalHp = target.hp;
                target.hp = Math.ceil(target.hp / 2);
                const damage = originalHp - target.hp;
                showSpellVisual('fireball', targetIndex, isRemote ? 'enemy' : 'player');
                setTimeout(() => showDamageFloat(targetIndex, `-${damage}`, 'damage'), 50);
                this.log(`${card.name[window.currentLang]} зменшує здоров'я ${target.name[window.currentLang]} вдвічі (-${damage} HP)!`);
                this.updateUI();
                return true;
            }
            return false;
        case 'destroy_armor':
            if (target && target.isEnemy !== isRemote) {
                if (target.id === 37) {
                    this.log(`${target.name[window.currentLang]} має імунітет!`);
                    return false;
                }
                if (target.armor > 0) {
                    target.armor = 0;
                    showSpellVisual('fireball', targetIndex, isRemote ? 'enemy' : 'player');
                    this.log(`${card.name[window.currentLang]} знищує всю броню ${target.name[window.currentLang]}!`);
                } else {
                    // Карта зіграна, хоча броні і так немає
                    this.log(`${card.name[window.currentLang]} зіграна, але ${target.name[window.currentLang]} не має броні!`);
                }
                this.updateUI();
                return true;
            }
            return false;
        case 'damage':
            if (target) {
                // В мультиплеєрі isRemote означає що дію виконує суперник
                if ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy)) {
                    showSpellVisual('fireball', targetIndex, sourceIndex !== null ? sourceIndex : (isRemote ? 'enemy' : 'player'));
                    this.takeDamage(targetIndex, effect.value, card.name[window.currentLang]);
                    return true;
                }
            }
            return false;
        case 'move_any':
            // Якщо це віддалена дія, ми отримуємо sourceIndex відразу
            if (isRemote && sourceIndex !== null) {
                const localSource = (this.gridSize * this.gridSize - 1) - sourceIndex;
                const localTarget = targetIndex;
                const unit = this.field[localSource];
                if (unit) {
                    this.field[localTarget] = unit;
                    this.field[localSource] = null;
                    this.log(`${card.name[window.currentLang]} перемістив ${unit.name[window.currentLang]}`);
                    this.updateUI();
                    return true;
                }
                return false;
            }

            const unitToMove = this.field[targetIndex];
            // Крок 1: Вибір юніта для телепортації
            if (unitToMove && unitToMove.isEnemy === isRemote) {
                this.teleportSourceIdx = targetIndex;
                this.log(`Вибрано ${unitToMove.name[window.currentLang]} для телепортації. Тепер виберіть вільну клітину.`);
                return true; // Повертаємо true, але в handleTargetSelection ми перевіримо teleportSourceIdx
            }
            // Крок 2: Вибір цілі для телепортації
            else if (this.teleportSourceIdx !== undefined && this.field[targetIndex] === null) {
                const unit = this.field[this.teleportSourceIdx];
                this.field[targetIndex] = unit;
                this.field[this.teleportSourceIdx] = null;
                this.log(`${card.name[window.currentLang]} перемістив ${unit.name[window.currentLang]}`);
                this.teleportSourceIdx = undefined;
                this.updateUI();
                return true;
            }
            this.log(window.TRANSLATIONS[window.currentLang].selectUnitFirst);
            return false;
        case 'destroy_all':
            this.field.forEach((unit, idx) => {
                if (unit) {
                    // Перевірка імунітету Руйнівника Чар (ID 37)
                    if (unit.id === 37 && unit.isEnemy !== isRemote) {
                        this.log(`${unit.name[window.currentLang]} виживає завдяки імунітету!`);
                        return;
                    }
                    this.takeDamage(idx, 9999, card.name[window.currentLang]);
                }
            });
            return true;
        case 'steal_unit':
            if (target && ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy))) {
                // Перевірка: не можна красти з "першого ряду" (спавн-зони)
                const tRow = Math.floor(targetIndex / this.gridSize);

                // Якщо це ворожий юніт (ми крадемо), його перший ряд - 0
                if (target.isEnemy && tRow === 0) {
                    this.log(window.TRANSLATIONS[window.currentLang].cantStealFrontRow);
                    return false;
                }
                // Якщо це наш юніт (бот краде), наш перший ряд - останній (gridSize - 1)
                if (!target.isEnemy && tRow === this.gridSize - 1) {
                    if (!isRemote) this.log(window.TRANSLATIONS[window.currentLang].cantStealFrontRow);
                    return false;
                }

                target.isEnemy = !target.isEnemy;
                target.hasMovedThisTurn = true; // "Викликана" хвороба (не може ходити відразу)
                this.log(`${card.name[window.currentLang]} захоплює контроль над ${target.name[window.currentLang]}!`);
                this.updateUI();
                return true;
            }
            return false;
        case 'damage_all_enemies':
            this.field.forEach((unit, idx) => {
                if (unit && unit.isEnemy !== isRemote) {
                    // Перевірка імунітету Руйнівника Чар (ID 37)
                    if (unit.id === 37) {
                        this.log(`${unit.name[window.currentLang]} поглинає магію!`);
                        return;
                    }
                    showSpellVisual('fireball', idx, isRemote ? 'enemy' : 'player');
                    this.takeDamage(idx, effect.value, card.name[window.currentLang]);
                }
            });
            return true;
        case 'heal_all_allies':
            this.field.forEach((unit, idx) => {
                if (unit && unit.isEnemy === isRemote) {
                    const modifier = this.getHealingModifier(unit);
                    const amount = Math.floor(effect.value * modifier);
                    if (amount > 0) {
                        unit.hp += amount;
                        this.applyStatCaps(unit);
                        showSpellVisual('heal_aura', idx);
                        this.log(`${card.name[window.currentLang]} полікував ${unit.name[window.currentLang]} на ${amount}`);
                    }
                }
            });
            return true;
        case 'freeze':
            if (target && target.isEnemy !== isRemote) {
                target.isFrozen = (target.isFrozen || 0) + effect.duration;
                this.log(`${card.name[window.currentLang]} заморозив ${target.name[window.currentLang]} на ${effect.duration} хід.`);
                return true;
            }
            return false;
        case 'push_back':
            if (target && target.isEnemy !== isRemote) {
                const row = Math.floor(targetIndex / this.gridSize);
                const col = targetIndex % this.gridSize;
                let nextRow = target.isEnemy ? row - 1 : row + 1; // Відштовхуємо НАЗАД

                // Перевірка чи не виходить за межі поля
                if (nextRow >= 0 && nextRow < this.gridSize) {
                    const nextIdx = nextRow * this.gridSize + col;
                    if (this.field[nextIdx] === null) {
                        this.field[nextIdx] = target;
                        this.field[targetIndex] = null;
                        this.log(`${card.name[window.currentLang]} відштовхнув ${target.name[window.currentLang]} назад.`);
                        this.updateUI();
                        return true;
                    } else {
                        this.log(window.TRANSLATIONS[window.currentLang].pathBlocked);
                    }
                } else {
                    this.log(window.TRANSLATIONS[window.currentLang].noPushTarget);
                }
            }
            return false;
        case 'reduce_armor':
            if (target && ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy))) {
                target.armor = Math.max(0, target.armor - effect.value);
                this.log(`${card.name[window.currentLang]} знищує броню ${target.name[window.currentLang]} (-${effect.value})`);
                return true;
            }
            return false;
        case 'magic_chain':
            if (target && ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy))) {
                this.magicChainTarget = targetIndex;
                this.log(`${card.name[window.currentLang]} пов'язує ${target.name[window.currentLang]} магічним ланцюгом!`);
                return true;
            }
            return false;
        case 'time_loop':
            this.restoreTurnSnapshot();
            return true;
        case 'heal':
            if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                const modifier = this.getHealingModifier(target);
                const amount = Math.floor(effect.value * modifier);
                if (amount > 0) {
                    target.hp += amount;
                    this.applyStatCaps(target);
                    showSpellVisual('heal_aura', targetIndex);
                    this.log(`${card.name[window.currentLang]} ${lang.spellHealLog} ${target.name[window.currentLang]} (+${amount})`);
                }
                return true;
            }
            return false;
        case 'buff_armor':
            if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                target.armor += effect.value;
                this.applyStatCaps(target);
                showSpellVisual('armor_aura', targetIndex);
                this.log(`${card.name[window.currentLang]} ${lang.spellBuffLog} ${target.name[window.currentLang]} (+${effect.value})`);
                return true;
            }
            return false;
        case 'buff_damage':
            if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                target.damage += effect.value;
                this.applyStatCaps(target);
                this.log(`${card.name[window.currentLang]} ${lang.spellBuffDamage} ${target.name[window.currentLang]} (+${effect.value})`);
                this.updateUI();
                return true;
            }
            return false;
        case 'permanent_weaken':
            if (target && ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy))) {
                target.damage = Math.max(0, target.damage - effect.value);
                this.log(`${card.name[window.currentLang]} послабив ${target.name[window.currentLang]} (-${effect.value} DMG)`);
                this.updateUI();
                return true;
            }
            return false;
        case 'copy_stats':
            if (target) {
                // Якщо це бот (isRemote), робимо все за один крок
                if (isRemote) {
                    // Ціль (target) має бути союзником бота (кого бафаємо)
                    if (target.isEnemy) {
                        // Шукаємо найкраще джерело (найсильнішого ворога - юніта гравця)
                        let bestSource = null;
                        let bestVal = -1;
                        this.field.forEach(u => {
                            if (u && !u.isEnemy) { // Player unit
                                const val = u.damage + u.hp + (u.armor || 0);
                                if (val > bestVal) {
                                    bestVal = val;
                                    bestSource = u;
                                }
                            }
                        });

                        if (bestSource) {
                            target.hp = bestSource.hp;
                            target.damage = bestSource.damage;
                            target.armor = bestSource.armor;
                            this.applyStatCaps(target);
                            this.log(`${target.name[window.currentLang]} копіює статси ${bestSource.name[window.currentLang]}!`);
                            this.updateUI();
                            return true;
                        }
                    }
                    return false; // Немає кого копіювати або невірна ціль
                }

                // Для гравця залишаємо покрокову логіку
                // Якщо ціль - "ворожий" для того хто чаклує юніт
                // Для локального гравця це target.isEnemy === true
                const isTargetEnemyForCaster = target.isEnemy;

                if (isTargetEnemyForCaster) {
                    this.copySource = { ...target };
                    this.log(lang.spellCopyLogSource || `Вибрано ${target.name[window.currentLang]} як джерело для копіювання.`);
                    return true;
                }
                // Якщо ціль - "свій" юніт
                else if (!isTargetEnemyForCaster && this.copySource) {
                    target.hp = this.copySource.hp;
                    target.damage = this.copySource.damage;
                    target.armor = this.copySource.armor;
                    this.applyStatCaps(target);
                    this.log(`${target.name[window.currentLang]} ${lang.spellCopyLog} ${this.copySource.name[window.currentLang]}!`);
                    this.copySource = null;
                    this.updateUI();
                    return true;
                }
            }
            return false;
        case 'buff_lifesteal':
            if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                if (!target.appliedAuras) target.appliedAuras = [];
                if (!target.appliedAuras.includes('lifesteal')) {
                    target.appliedAuras.push('lifesteal');
                    this.log(`${card.name[window.currentLang]} ${lang.spellBuffLifesteal} ${target.name[window.currentLang]}!`);
                    this.updateUI();
                    return true;
                } else {
                    this.log(`${target.name[window.currentLang]} ${lang.alreadyHasAbility}`);
                    return false;
                }
            }
            return false;
        case 'buff_revive':
            if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                if (!target.appliedAuras) target.appliedAuras = [];
                if (!target.appliedAuras.includes('buff_revive')) {
                    target.appliedAuras.push('buff_revive');
                    this.log(`${card.name[window.currentLang]}: ${target.name[window.currentLang]} отримав здатність переродитися після смерті!`);
                    this.updateUI();
                    return true;
                } else {
                    this.log(`${target.name[window.currentLang]} вже має це благословення!`);
                    return false;
                }
            }
            return false;
        case 'buff_thorns':
            if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                if (!target.appliedAuras) target.appliedAuras = [];
                if (!target.appliedAuras.includes('buff_thorns')) target.appliedAuras.push('buff_thorns');
                target.thornsBonus = (target.thornsBonus || 0) + effect.value;
                const langThorns = window.currentLang === 'uk' ? 'отримує Шипи' : 'gains Thorns';
                this.log(`🌵 ${card.name[window.currentLang]}: ${target.name[window.currentLang]} ${langThorns} (${effect.value})!`);
                this.updateUI();
                return true;
            }
            return false;
        case 'adrenaline':
            if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                target.hasMovedThisTurn = false;
                target.hp -= 3;
                this.log(`${card.name[window.currentLang]} використовується на ${target.name[window.currentLang]}: може атакувати ще раз, але втрачає 3 HP!`);

                if (target.hp <= 0) {
                    this.log(`${target.name[window.currentLang]} не витримав навантаження і загинув!`);
                    this.field[targetIndex] = null;
                    this.checkGameOver();
                }
                this.updateUI();
                return true;
            }
            return false;
        case 'energy_surge':
            if (target && ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy))) {
                // Рахуємо ману що залишиться ПІСЛЯ розігрування карти
                const totalMana = isRemote ? this.enemyMana : this.mana;
                const remainingMana = Math.max(0, totalMana - card.mana);
                if (remainingMana > 0) {
                    showSpellVisual('fireball', targetIndex, isRemote ? 'enemy' : 'player');
                    this.takeDamage(targetIndex, remainingMana, card.name[window.currentLang]);
                    this.log(`${card.name[window.currentLang]} наносить ${remainingMana} урону!`);
                } else {
                    this.log(`${card.name[window.currentLang]} зіграно, але мани не залишилось (урон 0).`);
                }
                this.updateUI();
                return true;
            }
            return false;
    }
    return true;
},

playCard(handIndex, fieldIndex) {
    if (this.isMultiplayer && this.turnPlayer !== playerRole) {
        this.log(window.TRANSLATIONS[window.currentLang].notYourTurn);
        return false;
    }

    const card = this.hand[handIndex];
    if (!card) return false;

    if (window.DEBUG) console.log(`Trying to play card: ${card.name[window.currentLang]}, cost: ${card.mana}, current mana: ${this.mana}`);
    if (Number(this.mana) < Number(card.mana)) {
        if (window.DEBUG) console.log("Not enough mana!");
        this.log(window.TRANSLATIONS[window.currentLang].noMana);
        return false;
    }
    if (card.type === 'unit') {
        const minRow = (this.gridSize === 3) ? 6 : 12; // 3x3: ряд 2 (індекси 6-8), 4x4: ряд 3 (індекси 12-15)
        if (fieldIndex < minRow) {
            this.log(window.TRANSLATIONS[window.currentLang].wrongRow);
            return false;
        }
        if (this.field[fieldIndex] !== null) { this.log(window.TRANSLATIONS[window.currentLang].slotOccupied); return false; }
        this.field[fieldIndex] = Object.assign(structuredClone(card), { maxHp: card.hp, hasMovedThisTurn: true, isEnemy: false, isRevealed: true });

        // Spawn animation (runs after updateUI renders the card)
        setTimeout(() => animateCardSlot(fieldIndex, 'card-spawn', 550), 50);

        // Артем: Тіньовий Стратег (ID 53) - посилення наступного юніта
        if (this.doubleNextUnitStats) {
            const u = this.field[fieldIndex];
            u.statCapOverride = 80;
            u.hp *= 2;
            u.damage *= 2;
            u.armor *= 2;
            if (u.maxHp) u.maxHp *= 2;
            this.applyStatCaps(u);
            this.doubleNextUnitStats = false;
            this.log(`${u.name[window.currentLang]} отримує x2 підсилення від Артема!`);
        }

        this.lastPlayedPlayerUnitIdx = fieldIndex;

        this.triggerUnitPlayedPassives(this.field[fieldIndex]);

        // Ефекти при виставленні (onPlayEffect)
        if (card.onPlayEffect) {
            this.handleOnPlayEffect(card.onPlayEffect, fieldIndex, false);
        }

        if (this.isMultiplayer) {
            this.sendAction({ type: 'PLAY_CARD', card: card, slotIndex: fieldIndex });
        }
    } else if (card.type === 'spell') {
        if (!this.applyEffect(card, fieldIndex)) return false;
        if (this.isMultiplayer) {
            this.sendAction({ type: 'PLAY_CARD', card: card, slotIndex: fieldIndex });
        }
    }

    // Daily Quest hook for play_cards
    window.updateQuestProgress('play_cards', 1);
    window.achOnCardPlayed?.();

    // Card Challenge: play_n
    window.updateCardChallengeProgress?.('play_n', card.id, 1);

    this.mana -= card.mana;
    this.hand.splice(handIndex, 1);
    SoundEngine.play('cardPlay');
    SoundEngine.play('manaSpend');
    this.updateUI();
    this.log(`${window.TRANSLATIONS[window.currentLang].played} ${card.name[window.currentLang]}`);
    return true;
},

processCellEvents() {
    if (!this.enableEvents) return;

    if (window.DEBUG) console.log("Processing Cell Events...");
    // 1. Apply effects and decrement duration
    for (let i = 0; i < this.gridSize * this.gridSize; i++) {
        if (this.cellEvents.has(i)) {
            const event = this.cellEvents.get(i);
            const card = this.field[i];

            // Apply effect if a unit is standing there
            if (card && card.type === 'unit') {
                // Apply only if it's the end of the turn for the unit's owner?
                // Or just apply every turn end?
                // "якшо стоїш" -> let's apply at the end of ANY turn (so effectively every turn)
                // But maybe only once per round?
                // Let's apply it now since this function is called once per turn transition.

                let applied = false;
                switch (event.type) {
                    case 'heal':
                        if (card.hp < card.maxHp) { // Optional: cap at maxHp? User didn't specify. Assuming no cap or cap at max?
                            // User said "дає +1 хп", usually means heal.
                            card.hp += 1;
                            this.applyStatCaps(card);
                            this.log(`${window.TRANSLATIONS[window.currentLang].event}: ${card.name[window.currentLang]} +1 HP`);
                            applied = true;
                        }
                        break;
                    case 'damage':
                        card.hp -= 1;
                        this.log(`${window.TRANSLATIONS[window.currentLang].event}: ${card.name[window.currentLang]} -1 HP`);
                        applied = true;
                        break;
                    case 'armor_up':
                        card.armor += 1;
                        this.applyStatCaps(card);
                        this.log(`${window.TRANSLATIONS[window.currentLang].event}: ${card.name[window.currentLang]} +1 Armor`);
                        applied = true;
                        break;
                    case 'armor_down':
                        if (card.armor > 0) {
                            card.armor = Math.max(0, card.armor - 1);
                            this.log(`${window.TRANSLATIONS[window.currentLang].event}: ${card.name[window.currentLang]} -1 Armor`);
                            applied = true;
                        }
                        break;
                    case 'attack_down':
                        if (card.damage > 0) {
                            card.damage = Math.max(0, card.damage - 1);
                            this.log(`${window.TRANSLATIONS[window.currentLang].event}: ${card.name[window.currentLang]} -1 Attack`);
                            applied = true;
                        }
                        break;
                }
                if (applied && card.hp <= 0) {
                    // Handle death logic if needed, or let standard checks handle it
                    // Standard checks usually happen after attacks. 
                    // We might need to clean up dead units here.
                    this.field[i] = null;
                    this.log(`${card.name[window.currentLang]} загинув від події!`);
                }
            }

            // Decrement duration
            event.duration--;
            if (event.duration <= 0) {
                this.cellEvents.delete(i);
                // Restore normal cell visual? handled in updateUI
            } else {
                this.cellEvents.set(i, event);
            }
        }
    }

    // 2. Spawn new events
    this.spawnRandomEventCell();
},

spawnRandomEventCell() {
    const maxEvents = this.gridSize === 3 ? 2 : 4;
    const currentEvents = this.cellEvents.size;

    if (currentEvents >= maxEvents) return;

    // Chance to spawn: 30% per turn if below limit?
    if (this.getRandom() > 0.3) return;

    // Find empty spots (no event, preferably no unit?)
    // User said: "просто звичайна клітинка заміняється на цю"
    // Can it spawn under a unit? Yes, probably.
    const availableIndices = [];
    for (let i = 0; i < this.gridSize * this.gridSize; i++) {
        if (!this.cellEvents.has(i)) {
            availableIndices.push(i);
        }
    }

    if (availableIndices.length === 0) return;

    const idx = availableIndices[Math.floor(this.getRandom() * availableIndices.length)];

    // Random event type
    const types = ['heal', 'damage', 'armor_up', 'armor_down', 'attack_down'];
    const type = types[Math.floor(this.getRandom() * types.length)];

    this.cellEvents.set(idx, {
        type: type,
        duration: 2 // Lasts 2 turns (rounds?) "знаходиться 2 хода"
        // If called every turn, 2 turns = 1 round (Player + Enemy)? 
        // Or 2 full rounds?
        // "2 хода" usually means 2 player turns. 
        // Since this function is called every turn transition (Player -> Enemy, Enemy -> Player),
        // "2 хода" = 2 calls.
    });

    if (window.DEBUG) console.log(`Spawned event ${type} at ${idx}`);
}

}); // Object.assign(Game.prototype, ...)
