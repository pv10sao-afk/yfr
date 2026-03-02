// ========== GAME-EFFECTS.JS ==========
// EffectsEngine: рушій ефектів карт, виокремлений з класу Game.
// Містить три методи, які раніше були методами Game:
//   • getHealingModifier
//   • handleOnPlayEffect
//   • applyEffect
//
// Всі методи приймають першим аргументом `game` (екземпляр Game),
// що повністю замінює `this` з оригінальних методів.
//
// Залежності (глобали):
//   - window.TRANSLATIONS, window.currentLang   (translations.js)
//   - showSpellVisual, showDamageFloat           (ui.js)
//   - window.DEBUG                               (game.js)
//
// Підключається в index.html ПІСЛЯ ui.js, ПЕРЕД game.js.

const EffectsEngine = {

    // ─────────────────────────────────────────
    // getHealingModifier
    // Повертає множник лікування (0.5 якщо є ворожий Чорнокнижник Розпаду ID 29, інакше 1).
    // ─────────────────────────────────────────
    getHealingModifier(game, targetUnit) {
        if (!targetUnit) return 1;
        const hasEnemyWarlock = game.field.some(card =>
            card && card.id === 29 && card.isEnemy !== targetUnit.isEnemy
        );
        if (hasEnemyWarlock) {
            if (window.DEBUG) console.log("Healing reduced by Decay Warlock aura!");
            return 0.5;
        }
        return 1;
    },

    // ─────────────────────────────────────────
    // handleOnPlayEffect
    // Обробляє onPlayEffect карти (ефект при виставленні юніта на поле).
    // ─────────────────────────────────────────
    handleOnPlayEffect(game, effect, unitIndex, isRemote) {
        switch (effect.type) {
            case 'reduce_enemy_mana':
                // Rustam: The Analyst
                if (isRemote) {
                    game.mana = Math.max(0, game.mana - effect.value);
                    game.log(`Ефект Рустама: Ви втрачаєте ${effect.value} мани!`);
                } else {
                    game.enemyMana = Math.max(0, game.enemyMana - effect.value);
                    game.log(`Ефект Рустама: Ворог втрачає ${effect.value} мани!`);
                }
                break;
            case 'add_mana':
                if (isRemote) {
                    game.enemyMana += effect.value;
                } else {
                    game.mana += effect.value;
                }
                game.log(`Ефект: +${effect.value} до мани на цей хід.`);
                break;
            case 'draw_card':
                if (isRemote) {
                    game.drawEnemyCard();
                } else {
                    game.drawCard();
                }
                game.log(`Ефект: додаткова карта отримана.`);
                break;
            case 'weaken_row': {
                const row = Math.floor(unitIndex / game.gridSize);
                let affectedCount = 0;
                for (let c = 0; c < game.gridSize; c++) {
                    const idx = row * game.gridSize + c;
                    const unit = game.field[idx];
                    if (unit && unit.isEnemy !== isRemote) {
                        unit.damage = Math.max(0, unit.damage - effect.value);
                        affectedCount++;
                    }
                }
                if (affectedCount > 0) {
                    game.log(`Ефект: ослаблено ${affectedCount} ворогів у ряду.`);
                }
                break;
            }
            case 'freeze_all_enemies': {
                // Максим: Зірка Політехніки (ID 52)
                let frozenCount = 0;
                game.field.forEach(unit => {
                    if (unit && unit.isEnemy !== isRemote) {
                        unit.isFrozen = (unit.isFrozen || 0) + 1;
                        frozenCount++;
                    }
                });
                if (frozenCount > 0) {
                    game.log(`Максим заморозив ${frozenCount} ворогів своїм інтелектом!`);
                }
                break;
            }
            case 'prime_next_unit_x2':
                // Артем: Тіньовий Стратег (ID 53)
                game.doubleNextUnitStats = true;
                game.log(window.TRANSLATIONS[window.currentLang].artemPlan);
                break;
        }
        game.updateUI();
    },

    // ─────────────────────────────────────────
    // applyEffect
    // Застосовує ефект закляття/карти до цільового слоту.
    // Повертає true якщо ефект успішно застосовано, false — якщо ні.
    // ─────────────────────────────────────────
    applyEffect(game, card, targetIndex, isRemote = false, sourceIndex = null) {
        if (!card.effect) return true;
        const target = game.field[targetIndex];
        const effect = card.effect;
        const lang = window.TRANSLATIONS[window.currentLang];

        // Руйнівник Чар (ID 37) — Імунітет до ворожої магії
        if (target && target.id === 37 && target.isEnemy !== isRemote) {
            game.log(`${target.name[window.currentLang]} має імунітет до магії!`);
            return false;
        }

        // Артем: Тіньовий Стратег (ID 53) — Невидимий, якщо є союзники
        if (target && target.id === 53 && target.isEnemy !== isRemote) {
            const allies = game.field.filter(u => u && u.isEnemy === target.isEnemy && u !== target);
            if (allies.length > 0) {
                game.log(`${target.name[window.currentLang]} прихований за спинами союзників!`);
                return false;
            }
        }

        switch (effect.type) {
            case 'damage_row': {
                const tRow = Math.floor(targetIndex / game.gridSize);
                let hits = 0;
                for (let c = 0; c < game.gridSize; c++) {
                    const idx = tRow * game.gridSize + c;
                    const unit = game.field[idx];
                    if (unit && unit.isEnemy !== isRemote) {
                        if (unit.id === 37) {
                            game.log(`${unit.name[window.currentLang]} поглинає магію!`);
                            continue;
                        }
                        showSpellVisual('fireball', idx, isRemote ? 'enemy' : 'player');
                        game.takeDamage(idx, effect.value, card.name[window.currentLang]);
                        hits++;
                    }
                }
                return hits > 0;
            }
            case 'half_hp':
                if (target && target.isEnemy !== isRemote) {
                    if (target.id === 37) {
                        game.log(`${target.name[window.currentLang]} має імунітет!`);
                        return false;
                    }
                    const originalHp = target.hp;
                    target.hp = Math.ceil(target.hp / 2);
                    const damage = originalHp - target.hp;
                    showSpellVisual('fireball', targetIndex, isRemote ? 'enemy' : 'player');
                    setTimeout(() => showDamageFloat(targetIndex, `-${damage}`, 'damage'), 50);
                    game.log(`${card.name[window.currentLang]} зменшує здоров'я ${target.name[window.currentLang]} вдвічі (-${damage} HP)!`);
                    game.updateUI();
                    return true;
                }
                return false;
            case 'destroy_armor':
                if (target && target.isEnemy !== isRemote) {
                    if (target.id === 37) {
                        game.log(`${target.name[window.currentLang]} має імунітет!`);
                        return false;
                    }
                    if (target.armor > 0) {
                        target.armor = 0;
                        showSpellVisual('fireball', targetIndex, isRemote ? 'enemy' : 'player');
                        game.log(`${card.name[window.currentLang]} знищує всю броню ${target.name[window.currentLang]}!`);
                    } else {
                        game.log(`${card.name[window.currentLang]} зіграна, але ${target.name[window.currentLang]} не має броні!`);
                    }
                    game.updateUI();
                    return true;
                }
                return false;
            case 'damage':
                if (target) {
                    if ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy)) {
                        showSpellVisual('fireball', targetIndex, sourceIndex !== null ? sourceIndex : (isRemote ? 'enemy' : 'player'));
                        game.takeDamage(targetIndex, effect.value, card.name[window.currentLang]);
                        return true;
                    }
                }
                return false;
            case 'move_any':
                if (isRemote && sourceIndex !== null) {
                    const localSource = (game.gridSize * game.gridSize - 1) - sourceIndex;
                    const localTarget = targetIndex;
                    const unit = game.field[localSource];
                    if (unit) {
                        game.field[localTarget] = unit;
                        game.field[localSource] = null;
                        game.log(`${card.name[window.currentLang]} перемістив ${unit.name[window.currentLang]}`);
                        game.updateUI();
                        return true;
                    }
                    return false;
                }
                {
                    const unitToMove = game.field[targetIndex];
                    // Крок 1: Вибір юніта для телепортації
                    if (unitToMove && unitToMove.isEnemy === isRemote) {
                        game.teleportSourceIdx = targetIndex;
                        game.log(`Вибрано ${unitToMove.name[window.currentLang]} для телепортації. Тепер виберіть вільну клітину.`);
                        return true;
                    }
                    // Крок 2: Вибір цілі для телепортації
                    else if (game.teleportSourceIdx !== undefined && game.field[targetIndex] === null) {
                        const unit = game.field[game.teleportSourceIdx];
                        game.field[targetIndex] = unit;
                        game.field[game.teleportSourceIdx] = null;
                        game.log(`${card.name[window.currentLang]} перемістив ${unit.name[window.currentLang]}`);
                        game.teleportSourceIdx = undefined;
                        game.updateUI();
                        return true;
                    }
                    game.log(window.TRANSLATIONS[window.currentLang].selectUnitFirst);
                    return false;
                }
            case 'destroy_all':
                game.field.forEach((unit, idx) => {
                    if (unit) {
                        if (unit.id === 37 && unit.isEnemy !== isRemote) {
                            game.log(`${unit.name[window.currentLang]} виживає завдяки імунітету!`);
                            return;
                        }
                        game.takeDamage(idx, 9999, card.name[window.currentLang]);
                    }
                });
                return true;
            case 'steal_unit':
                if (target && ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy))) {
                    const tRow = Math.floor(targetIndex / game.gridSize);
                    if (target.isEnemy && tRow === 0) {
                        game.log(window.TRANSLATIONS[window.currentLang].cantStealFrontRow);
                        return false;
                    }
                    if (!target.isEnemy && tRow === game.gridSize - 1) {
                        if (!isRemote) game.log(window.TRANSLATIONS[window.currentLang].cantStealFrontRow);
                        return false;
                    }
                    target.isEnemy = !target.isEnemy;
                    target.hasMovedThisTurn = true;
                    game.log(`${card.name[window.currentLang]} захоплює контроль над ${target.name[window.currentLang]}!`);
                    game.updateUI();
                    return true;
                }
                return false;
            case 'damage_all_enemies':
                game.field.forEach((unit, idx) => {
                    if (unit && unit.isEnemy !== isRemote) {
                        if (unit.id === 37) {
                            game.log(`${unit.name[window.currentLang]} поглинає магію!`);
                            return;
                        }
                        showSpellVisual('fireball', idx, isRemote ? 'enemy' : 'player');
                        game.takeDamage(idx, effect.value, card.name[window.currentLang]);
                    }
                });
                return true;
            case 'heal_all_allies':
                game.field.forEach((unit, idx) => {
                    if (unit && unit.isEnemy === isRemote) {
                        const modifier = EffectsEngine.getHealingModifier(game, unit);
                        const amount = Math.floor(effect.value * modifier);
                        if (amount > 0) {
                            unit.hp += amount;
                            game.applyStatCaps(unit);
                            showSpellVisual('heal_aura', idx);
                            game.log(`${card.name[window.currentLang]} полікував ${unit.name[window.currentLang]} на ${amount}`);
                        }
                    }
                });
                return true;
            case 'freeze':
                if (target && target.isEnemy !== isRemote) {
                    target.isFrozen = (target.isFrozen || 0) + effect.duration;
                    game.log(`${card.name[window.currentLang]} заморозив ${target.name[window.currentLang]} на ${effect.duration} хід.`);
                    return true;
                }
                return false;
            case 'push_back':
                if (target && target.isEnemy !== isRemote) {
                    const row = Math.floor(targetIndex / game.gridSize);
                    const col = targetIndex % game.gridSize;
                    let nextRow = target.isEnemy ? row - 1 : row + 1;
                    if (nextRow >= 0 && nextRow < game.gridSize) {
                        const nextIdx = nextRow * game.gridSize + col;
                        if (game.field[nextIdx] === null) {
                            game.field[nextIdx] = target;
                            game.field[targetIndex] = null;
                            game.log(`${card.name[window.currentLang]} відштовхнув ${target.name[window.currentLang]} назад.`);
                            game.updateUI();
                            return true;
                        } else {
                            game.log(window.TRANSLATIONS[window.currentLang].pathBlocked);
                        }
                    } else {
                        game.log(window.TRANSLATIONS[window.currentLang].noPushTarget);
                    }
                }
                return false;
            case 'reduce_armor':
                if (target && ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy))) {
                    target.armor = Math.max(0, target.armor - effect.value);
                    game.log(`${card.name[window.currentLang]} знищує броню ${target.name[window.currentLang]} (-${effect.value})`);
                    return true;
                }
                return false;
            case 'magic_chain':
                if (target && ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy))) {
                    game.magicChainTarget = targetIndex;
                    game.log(`${card.name[window.currentLang]} пов'язує ${target.name[window.currentLang]} магічним ланцюгом!`);
                    return true;
                }
                return false;
            case 'time_loop':
                game.restoreTurnSnapshot();
                return true;
            case 'heal':
                if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                    const modifier = EffectsEngine.getHealingModifier(game, target);
                    const amount = Math.floor(effect.value * modifier);
                    if (amount > 0) {
                        target.hp += amount;
                        game.applyStatCaps(target);
                        showSpellVisual('heal_aura', targetIndex);
                        game.log(`${card.name[window.currentLang]} ${lang.spellHealLog} ${target.name[window.currentLang]} (+${amount})`);
                    }
                    return true;
                }
                return false;
            case 'buff_armor':
                if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                    target.armor += effect.value;
                    game.applyStatCaps(target);
                    showSpellVisual('armor_aura', targetIndex);
                    game.log(`${card.name[window.currentLang]} ${lang.spellBuffLog} ${target.name[window.currentLang]} (+${effect.value})`);
                    return true;
                }
                return false;
            case 'buff_damage':
                if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                    target.damage += effect.value;
                    game.applyStatCaps(target);
                    game.log(`${card.name[window.currentLang]} ${lang.spellBuffDamage} ${target.name[window.currentLang]} (+${effect.value})`);
                    game.updateUI();
                    return true;
                }
                return false;
            case 'permanent_weaken':
                if (target && ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy))) {
                    target.damage = Math.max(0, target.damage - effect.value);
                    game.log(`${card.name[window.currentLang]} послабив ${target.name[window.currentLang]} (-${effect.value} DMG)`);
                    game.updateUI();
                    return true;
                }
                return false;
            case 'copy_stats':
                if (target) {
                    if (isRemote) {
                        if (target.isEnemy) {
                            let bestSource = null;
                            let bestVal = -1;
                            game.field.forEach(u => {
                                if (u && !u.isEnemy) {
                                    const val = u.damage + u.hp + (u.armor || 0);
                                    if (val > bestVal) { bestVal = val; bestSource = u; }
                                }
                            });
                            if (bestSource) {
                                target.hp = bestSource.hp;
                                target.damage = bestSource.damage;
                                target.armor = bestSource.armor;
                                game.applyStatCaps(target);
                                game.log(`${target.name[window.currentLang]} копіює статси ${bestSource.name[window.currentLang]}!`);
                                game.updateUI();
                                return true;
                            }
                        }
                        return false;
                    }
                    const isTargetEnemyForCaster = target.isEnemy;
                    if (isTargetEnemyForCaster) {
                        game.copySource = { ...target };
                        game.log(lang.spellCopyLogSource || `Вибрано ${target.name[window.currentLang]} як джерело для копіювання.`);
                        return true;
                    } else if (!isTargetEnemyForCaster && game.copySource) {
                        target.hp = game.copySource.hp;
                        target.damage = game.copySource.damage;
                        target.armor = game.copySource.armor;
                        game.applyStatCaps(target);
                        game.log(`${target.name[window.currentLang]} ${lang.spellCopyLog} ${game.copySource.name[window.currentLang]}!`);
                        game.copySource = null;
                        game.updateUI();
                        return true;
                    }
                }
                return false;
            case 'buff_lifesteal':
                if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                    if (!target.appliedAuras) target.appliedAuras = [];
                    if (!target.appliedAuras.includes('lifesteal')) {
                        target.appliedAuras.push('lifesteal');
                        game.log(`${card.name[window.currentLang]} ${lang.spellBuffLifesteal} ${target.name[window.currentLang]}!`);
                        game.updateUI();
                        return true;
                    } else {
                        game.log(`${target.name[window.currentLang]} ${lang.alreadyHasAbility}`);
                        return false;
                    }
                }
                return false;
            case 'buff_revive':
                if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                    if (!target.appliedAuras) target.appliedAuras = [];
                    if (!target.appliedAuras.includes('buff_revive')) {
                        target.appliedAuras.push('buff_revive');
                        game.log(`${card.name[window.currentLang]}: ${target.name[window.currentLang]} отримав здатність переродитися після смерті!`);
                        game.updateUI();
                        return true;
                    } else {
                        game.log(`${target.name[window.currentLang]} вже має це благословення!`);
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
                    game.log(`🌵 ${card.name[window.currentLang]}: ${target.name[window.currentLang]} ${langThorns} (${effect.value})!`);
                    game.updateUI();
                    return true;
                }
                return false;
            case 'adrenaline':
                if (target && ((isRemote && target.isEnemy) || (!isRemote && !target.isEnemy))) {
                    target.hasMovedThisTurn = false;
                    target.hp -= 3;
                    game.log(`${card.name[window.currentLang]} використовується на ${target.name[window.currentLang]}: може атакувати ще раз, але втрачає 3 HP!`);
                    if (target.hp <= 0) {
                        game.log(`${target.name[window.currentLang]} не витримав навантаження і загинув!`);
                        game.field[targetIndex] = null;
                        game.checkGameOver();
                    }
                    game.updateUI();
                    return true;
                }
                return false;
            case 'energy_surge':
                if (target && ((isRemote && !target.isEnemy) || (!isRemote && target.isEnemy))) {
                    const totalMana = isRemote ? game.enemyMana : game.mana;
                    const remainingMana = Math.max(0, totalMana - card.mana);
                    if (remainingMana > 0) {
                        showSpellVisual('fireball', targetIndex, isRemote ? 'enemy' : 'player');
                        game.takeDamage(targetIndex, remainingMana, card.name[window.currentLang]);
                        game.log(`${card.name[window.currentLang]} наносить ${remainingMana} урону!`);
                    } else {
                        game.log(`${card.name[window.currentLang]} зіграно, але мани не залишилось (урон 0).`);
                    }
                    game.updateUI();
                    return true;
                }
                return false;
        }
        return true;
    }
};

window.EffectsEngine = EffectsEngine;
