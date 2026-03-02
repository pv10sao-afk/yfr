// ========== GAME-RENDERER.JS ==========
// UI/Рендер: updateUI, createCardElement, handleCardClick, handleTargetSelection та ін.
// Object.assign mixin на Game.prototype. Завантажувати ПІСЛЯ game.js.

Object.assign(Game.prototype, {

    scheduleUIUpdate() {
        if (this._uiScheduled) return;
        this._uiScheduled = true;
        requestAnimationFrame(() => {
            this._uiScheduled = false;
            this._doUpdateUI();
        });
    },

    // Публічний псевдонім для зворотної сумісності (викликається ззовні як window.game.updateUI())
    updateUI() {
        this.scheduleUIUpdate();
    },

    _doUpdateUI() {
        this.updateAuras();
        if (window.DEBUG) console.log("Оновлення UI...");
        // Оновлення індикатора ходу
        const turnIndicator = document.getElementById('turn-indicator');
        const endTurnBtn = document.getElementById('end-turn-btn');
        const attackBtn = document.getElementById('attack-btn');

        if (turnIndicator) {
            turnIndicator.classList.remove('my-turn', 'enemy-turn');
            if (this.isMultiplayer) {
                if (this.turnPlayer === playerRole) {
                    turnIndicator.textContent = window.TRANSLATIONS[window.currentLang].yourTurn;
                    turnIndicator.classList.add('my-turn');
                    if (endTurnBtn) endTurnBtn.disabled = false;
                    if (attackBtn) attackBtn.disabled = false;
                } else {
                    turnIndicator.textContent = window.TRANSLATIONS[window.currentLang].enemyTurn;
                    turnIndicator.classList.add('enemy-turn');
                    if (endTurnBtn) endTurnBtn.disabled = true;
                    if (attackBtn) attackBtn.disabled = true;
                }
            } else {
                turnIndicator.textContent = window.TRANSLATIONS[window.currentLang].yourTurn + " (Solo)";
                turnIndicator.classList.add('my-turn');
                if (endTurnBtn) endTurnBtn.disabled = false;
                if (attackBtn) attackBtn.disabled = false;
            }
        }

        // Оновлення індикатора чий зараз хід у мультиплеєрі (старий статус)
        const statusText = document.getElementById('status-text');
        if (this.isMultiplayer && statusText) {
            if (this.turnPlayer === playerRole) {
                statusText.textContent = window.TRANSLATIONS[window.currentLang].yourTurnStatus;
                statusText.style.color = "#2ecc71";
            } else {
                statusText.textContent = window.TRANSLATIONS[window.currentLang].opponentTurnStatus;
                statusText.style.color = "#f1c40f";
            }
        }

        // Оновлення тексту заголовку поля
        const boardTitle = document.querySelector('#game-board h2');
        if (boardTitle) {
            boardTitle.textContent = this.gridSize === 3 ? window.TRANSLATIONS[window.currentLang].board3x3 : window.TRANSLATIONS[window.currentLang].board4x4;
        }

        const discardPile = document.getElementById('discard-pile');
        if (discardPile) {
            discardPile.classList.remove('highlight-target');
            if (this.selectedCardInfo && this.selectedCardInfo.location === 'hand') {
                discardPile.classList.add('highlight-target');
            }
        }

        // Update avatar display
        const playerAvatarEl = document.getElementById('player-avatar-display');
        if (playerAvatarEl) playerAvatarEl.textContent = window.selectedAvatar;

        const playerBossIcon = document.querySelector('#player-boss .boss-icon');
        if (playerBossIcon) playerBossIcon.textContent = window.selectedAvatar;

        // Force update enemy avatar to prevent overwrites or lost states
        if (this.isMultiplayer && window.enemyAvatarEmoji) {
            const enemyAvatarEl = document.getElementById('enemy-avatar-display');
            if (enemyAvatarEl) enemyAvatarEl.textContent = window.enemyAvatarEmoji;
            const enemyBossIcon = document.querySelector('#enemy-boss .boss-icon');
            if (enemyBossIcon) enemyBossIcon.textContent = window.enemyAvatarEmoji;
        } else if (!this.isMultiplayer) {
            const enemyAvatarEl = document.getElementById('enemy-avatar-display');
            if (enemyAvatarEl) enemyAvatarEl.textContent = '💀';
            const enemyBossIcon = document.querySelector('#enemy-boss .boss-icon');
            if (enemyBossIcon) enemyBossIcon.textContent = '😈';
        }

        document.getElementById('player-hp').textContent = this.playerHp;
        document.getElementById('enemy-hp').textContent = this.enemyHp;
        document.getElementById('current-mana').textContent = this.mana;
        document.getElementById('enemy-mana').textContent = this.enemyMana;
        document.getElementById('turn-count').textContent = this.turn;
        document.getElementById('deck-count').textContent = this.deck.length;
        document.getElementById('enemy-hand-count').textContent = this.enemyHand.length;

        // Update Progress Bars and Floating HP
        const maxHp = 50;
        const playerHpPercent = Math.max(0, Math.min(100, (this.playerHp / maxHp) * 100));
        const enemyHpPercent = Math.max(0, Math.min(100, (this.enemyHp / maxHp) * 100));

        const playerManaPercent = Math.max(0, Math.min(100, (this.mana / this.maxMana) * 100));
        const enemyManaPercent = Math.max(0, Math.min(100, (this.enemyMana / this.enemyMaxMana) * 100));

        const playerHpBar = document.getElementById('player-hp-bar');
        if (playerHpBar) playerHpBar.style.width = `${playerHpPercent}%`;

        const enemyHpBar = document.getElementById('enemy-hp-bar');
        if (enemyHpBar) enemyHpBar.style.width = `${enemyHpPercent}%`;

        const playerManaBar = document.getElementById('player-mana-bar');
        if (playerManaBar) playerManaBar.style.width = `${playerManaPercent}%`;

        const enemyManaBar = document.getElementById('enemy-mana-bar');
        if (enemyManaBar) enemyManaBar.style.width = `${enemyManaPercent}%`;

        const playerHpFloat = document.getElementById('player-hp-float');
        if (playerHpFloat) playerHpFloat.textContent = Math.max(0, this.playerHp);

        const enemyHpFloat = document.getElementById('enemy-hp-float');
        if (enemyHpFloat) enemyHpFloat.textContent = Math.max(0, this.enemyHp);

        // Оновлення аватарів босів
        const playerBoss = document.getElementById('player-boss');
        const enemyBoss = document.getElementById('enemy-boss');

        playerBoss.onclick = (e) => {
            e.stopPropagation();
            if (window.DEBUG) console.log("Player Boss clicked");
            if (this.isMultiplayer && this.turnPlayer !== playerRole) {
                this.log(window.TRANSLATIONS[window.currentLang].opponentTurn);
                return;
            }
            if (this.selectedCardInfo) this.handleTargetSelection(-2);
        };
        enemyBoss.onclick = (e) => {
            e.stopPropagation();
            if (window.DEBUG) console.log("Enemy Boss clicked");
            if (this.isMultiplayer && this.turnPlayer !== playerRole) {
                this.log(window.TRANSLATIONS[window.currentLang].opponentTurn);
                return;
            }
            if (this.selectedCardInfo) this.handleTargetSelection(-1);
        };

        playerBoss.classList.remove('highlight-target');
        enemyBoss.classList.remove('highlight-target');

        if (this.selectedCardInfo) {
            const fromIdx = this.selectedCardInfo.index;
            const location = this.selectedCardInfo.location;
            if (location === 'field' && !this.selectedCardInfo.card.isEnemy) {
                if (this.canAttack(fromIdx, -1)) enemyBoss.classList.add('highlight-target');
            }
        }

        const handEl = document.getElementById('player-hand');
        handEl.innerHTML = '';
        this.hand.forEach((card, index) => {
            const cardEl = this.createCardElement(card, index, 'hand');
            if (this.selectedCardInfo && this.selectedCardInfo.location === 'hand' && this.selectedCardInfo.index === index) {
                cardEl.classList.add('selected');
            }
            handEl.appendChild(cardEl);
        });

        const gridContainer = document.querySelector('.grid-container');
        gridContainer.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;

        // Add class for 4x4 styling
        if (this.gridSize === 4) {
            gridContainer.classList.add('grid-4x4');
        } else {
            gridContainer.classList.remove('grid-4x4');
        }

        gridContainer.innerHTML = ''; // Очищаємо і створюємо наново для динамічного розміру

        // Застосовуємо скін поля
        if (typeof window.applyBoardSkin === 'function') window.applyBoardSkin();

        for (let index = 0; index < this.field.length; index++) {
            const slot = document.createElement('div');
            slot.className = 'grid-slot';
            slot.dataset.index = index;

            // Висадка тільки на останній ряд (сірий)
            const playerBackLineStart = (this.gridSize - 1) * this.gridSize;
            const playerBackLineEnd = this.gridSize * this.gridSize - 1;
            if (index >= playerBackLineStart && index <= playerBackLineEnd) {
                slot.classList.add('player-zone');
            }

            // Event visualization
            if (this.enableEvents && this.cellEvents.has(index)) {
                const event = this.cellEvents.get(index);
                slot.classList.add(`event-${event.type}`);

                // Add icon or tooltip
                const eventIcon = document.createElement('div');
                eventIcon.className = 'event-icon';
                switch (event.type) {
                    case 'heal': eventIcon.textContent = '💚'; break; // +1 HP
                    case 'damage': eventIcon.textContent = '🔥'; break; // -1 HP
                    case 'armor_up': eventIcon.textContent = '🛡️+'; break; // +1 Armor
                    case 'armor_down': eventIcon.textContent = '🛡️-'; break; // -1 Armor
                    case 'attack_down': eventIcon.textContent = '⚔️-'; break; // -1 Attack
                }
                slot.appendChild(eventIcon);
            }

            const card = this.field[index];
            if (card && !card.isDying) {
                const cardEl = this.createCardElement(card, index, 'field');
                if (this.selectedCardInfo && this.selectedCardInfo.location === 'field' && this.selectedCardInfo.index === index) {
                    cardEl.classList.add('selected');
                }
                slot.appendChild(cardEl);
                slot.classList.add('occupied');
            }

            // Підсвітка доступних цілей для заклять або висадки
            if (this.selectedCardInfo) {
                const selected = this.selectedCardInfo.card;
                if (selected.type === 'unit' && this.selectedCardInfo.location === 'hand') {
                    if (index >= playerBackLineStart && index <= playerBackLineEnd && !card) {
                        slot.classList.add('highlight-target');
                    }
                } else if (selected.type === 'spell' && this.selectedCardInfo.location === 'hand') {
                    slot.classList.add('highlight-target');
                } else if (this.selectedCardInfo.location === 'field' && !selected.isEnemy) {
                    // Для переміщення юніта
                    const fromIdx = this.selectedCardInfo.index;
                    const dist = this.getDistance(fromIdx, index);
                    const targetRow = Math.floor(index / this.gridSize);
                    // Гравець не може переміщуватися на нульовий ряд (тил ворога)
                    if (dist === 1 && !card && targetRow !== 0) slot.classList.add('highlight-target');
                }
            }

            slot.onclick = () => {
                if (window.DEBUG) console.log(`Slot clicked: ${index}`);
                if (this.selectedCardInfo) {
                    this.handleTargetSelection(index);
                }
            };

            // Підсвітка радіуса атаки
            slot.onmouseenter = () => this.highlightAttackTargets(index);
            slot.onmouseleave = () => this.clearAttackHighlights();

            gridContainer.appendChild(slot);
        }

        // Обробка hover для босів
        if (playerBoss) {
            playerBoss.onmouseenter = () => this.highlightAttackTargets(-2);
            playerBoss.onmouseleave = () => this.clearAttackHighlights();
        }
        if (enemyBoss) {
            enemyBoss.onmouseenter = () => this.highlightAttackTargets(-1);
            enemyBoss.onmouseleave = () => this.clearAttackHighlights();
        }
    },

    highlightAttackTargets(sourceIdx) {
        if (!this.selectedCardInfo) {
            const unit = sourceIdx >= 0 ? this.field[sourceIdx] : null;

            // Only highlight if it's a valid player unit (not enemy, not frozen/moved)
            if (unit && !unit.isEnemy && !unit.hasMovedThisTurn && !unit.isFrozen) {
                // Highlight bosses if they can be attacked
                const playerBoss = document.getElementById('player-boss');
                const enemyBoss = document.getElementById('enemy-boss');

                if (enemyBoss && this.canAttack(sourceIdx, -1)) {
                    enemyBoss.classList.add('attack-target-highlight');
                }

                // Highlight regular slots
                for (let i = 0; i < this.gridSize * this.gridSize; i++) {
                    if (this.canAttack(sourceIdx, i)) {
                        const targetSlot = document.querySelector(`.grid-slot[data-index='${i}']`);
                        if (targetSlot) {
                            targetSlot.classList.add('attack-target-highlight');
                        }
                    }
                }
            }
        }
    },

    clearAttackHighlights() {
        document.querySelectorAll('.attack-target-highlight').forEach(el => {
            el.classList.remove('attack-target-highlight');
        });
    },

    // Перевірка завершення гри
    checkGameOver() {
        if (this.isGameOver) return true;

        if (this.playerHp <= 0) {
            this.playerHp = 0; // Візуальне обмеження
            this.isGameOver = true;
            this.updateUI(); // Оновити UI для відображення 0 HP
            this.showGameOver(false);
            return true;
        } else if (this.enemyHp <= 0) {
            this.enemyHp = 0; // Візуальне обмеження
            this.isGameOver = true;
            this.updateUI(); // Оновити UI для відображення 0 HP
            const reward = 25; // Нагорода за перемогу
            window.userGold += reward;
            window.saveProgression();
            this.showGameOver(true, reward);
            return true;
        }
        return false;
    },

    createCardElement(card, index, location) {
        const div = document.createElement('div');
        const rarityClass = card.rarity || 'common';
        const skinObj = CARD_SKIN_DATABASE.find(s => s.id === window.selectedCardSkin);
        const skinClass = skinObj && skinObj.cssClass ? ' ' + skinObj.cssClass : '';
        div.className = `card ${card.type} ${rarityClass}${skinClass}`;

        if (card.isFrozen > 0) div.classList.add('frozen');

        // Перевірка на вампіризм (ID 21 або аура lifesteal)
        if (card.id === 21 || (card.appliedAuras && card.appliedAuras.includes('lifesteal'))) {
            div.classList.add('lifesteal');
        }

        if (card.isEnemy && !card.isRevealed) div.classList.add('enemy', 'concealed');
        else if (card.isEnemy && card.isRevealed) div.classList.add('enemy', 'revealed');

        if (card.hasTaunt) div.classList.add('taunt'); // Will trigger the shield border and emoji

        // Анімація (наприклад, тріщина броні, або damage/shake)
        if (card.animation) {
            div.classList.add(card.animation);
            // Очищаємо анімацію з моделі, щоб вона не повторювалася при наступних оновленнях
            setTimeout(() => { delete card.animation; }, 600);
        }

        // Поява карти (вилітає з колоди)
        if (card.justDrawn) {
            div.classList.add('card-draw');
            // Remove justDrawn so it doesn't animate on next updateUI
            setTimeout(() => { delete card.justDrawn; }, 600);
        }

        div.draggable = false;
        div.dataset.index = index; div.dataset.location = location;

        div.onclick = (e) => {
            if (e.button === 0) this.handleCardClick(index, location, card);
        };

        div.title = card.name[window.currentLang];

        const rarityNames = {
            uk: { common: "Звичайна", rare: "Рідкісна", epic: "Епічна", legendary: "Легендарна" },
            en: { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" }
        };
        const rarityName = rarityNames[window.currentLang][rarityClass];

        div.innerHTML = `
        <div class="card-rarity rarity-${rarityClass}">${rarityName}</div>
        <div class="card-header">
            <span class="card-name">${card.name[window.currentLang]}</span>
            <span class="card-mana">${card.mana}</span>
        </div>
        <div class="card-body">
            ${card.description[window.currentLang]}
            ${card.type === 'unit' ? `<div class="card-range">🎯 Range: ${card.range || 1}</div>` : ''}
        </div>
        <div class="card-footer">
            ${card.type === 'unit' ? `
                <span class="card-damage">⚔️ ${card.damage}</span>
                <span class="card-armor">🛡️ ${card.armor}</span>
                <span class="card-hp">❤️ ${Math.max(0, card.hp)}</span>
                ${(card.thorns || 0) + (card.thornsBonus || 0) > 0 ? `<span class="card-thorns" title="Шипи (Віддача урону)">🌵 ${(card.thorns || 0) + (card.thornsBonus || 0)}</span>` : ''}
            ` : `
                <span class="card-spell-icon">✨ Spell</span>
            `}
        </div>
    `;
        return div;
    },

    handleCardClick(index, location, card) {
        if (window.DEBUG) console.log(`Clicked card at ${location} index ${index}`);
        // Перевірка чий зараз хід у мультиплеєрі
        if (this.isMultiplayer && this.turnPlayer !== playerRole) {
            // Можна тільки дивитися (зум ПКМ працює окремо)
            if (location === 'field' && card.isEnemy) {
                // Дозволяємо вибір ворога як цілі (хоча хід не наш, але UI може оновитися)
                // Але краще просто заборонити будь-які дії крім огляду
            }
            this.log(window.TRANSLATIONS[window.currentLang].opponentTurn);
            return;
        }

        // Зупиняємо розповсюдження події, щоб не спрацював клік по слоту під картою
        if (window.event) window.event.stopPropagation();

        // Якщо клікнули по ворожій карті, вона може бути ціллю
        if (card && card.isEnemy && location === 'field') {
            if (this.selectedCardInfo) {
                this.handleTargetSelection(index);
                return;
            }
        }

        // Якщо клікнули по своїй карті (в руці або на полі)
        if (location === 'hand' || (location === 'field' && !card.isEnemy)) {
            // СПЕЦІАЛЬНИЙ ВИПАДОК: Якщо вже вибрано закляття з руки, і ми клікаємо на свого юніта на полі
            if (this.selectedCardInfo &&
                this.selectedCardInfo.location === 'hand' &&
                this.selectedCardInfo.card.type === 'spell' &&
                location === 'field') {
                if (window.DEBUG) console.log("Applying spell from hand to friendly unit");
                this.handleTargetSelection(index);
                return;
            }

            if (this.selectedCardInfo && this.selectedCardInfo.location === location && this.selectedCardInfo.index === index) {
                // Скасувати вибір
                if (window.DEBUG) console.log("Deselecting card");
                this.selectedCardInfo = null;
            } else {
                // Вибрати нову карту
                if (window.DEBUG) console.log("Selecting card:", card.name[window.currentLang]);
                this.selectedCardInfo = { index, location, card };
            }
            this.updateUI();
        } else if (this.selectedCardInfo) {
            // Якщо вибрана карта вже є, і ми тиснули кудись ще
            this.handleTargetSelection(index);
        }
    },

    handleTargetSelection(targetIndex) {
        if (!this.selectedCardInfo) return;

        // Перевірка чий зараз хід у мультиплеєрі
        if (this.isMultiplayer && this.turnPlayer !== playerRole) {
            this.log(window.TRANSLATIONS[window.currentLang].opponentTurn);
            this.selectedCardInfo = null;
            this.updateUI();
            return;
        }

        if (window.DEBUG) console.log(`Target selected: ${targetIndex}`);
        const { index: fromIndex, location, card } = this.selectedCardInfo;

        if (location === 'hand') {
            if (card.type === 'unit') {
                // Висадка тільки на останній ряд (синій)
                const playerBackLineStart = (this.gridSize - 1) * this.gridSize;
                const playerBackLineEnd = this.gridSize * this.gridSize - 1;

                if (targetIndex >= playerBackLineStart && targetIndex <= playerBackLineEnd) {
                    if (this.playCard(fromIndex, targetIndex)) {
                        this.selectedCardInfo = null;
                    }
                } else {
                    this.log(window.TRANSLATIONS[window.currentLang].wrongRow);
                }
            } else if (card.type === 'spell') {
                // Перевірка мани перед розігруванням закляття
                if (Number(this.mana) < Number(card.mana)) {
                    this.log(window.TRANSLATIONS[window.currentLang].noMana);
                    return;
                }

                const isMirror = card.effect && card.effect.type === 'copy_stats';
                const isTeleport = card.effect && card.effect.type === 'move_any';
                const prevTeleportSource = this.teleportSourceIdx;

                if (this.applyEffect(card, targetIndex)) {
                    // Якщо закляття вимагає другого кроку (як Телепорт), не скидаємо його поки що
                    if ((!isMirror && !isTeleport) ||
                        (isMirror && !this.copySource) ||
                        (isTeleport && this.teleportSourceIdx === undefined)) {

                        this.mana -= card.mana;
                        this.hand.splice(fromIndex, 1);

                        // Card Challenge: total_eff for spells
                        const effVal = card.effect?.value;
                        if (effVal) window.updateCardChallengeProgress?.('total_eff', card.id, effVal);

                        // Card Challenge: play_n for spells
                        window.updateCardChallengeProgress?.('play_n', card.id, 1);
                        window.updateQuestProgress?.('play_cards', 1);
                        window.achOnCardPlayed?.();

                        // Синхронізація в мультиплеєрі
                        if (this.isMultiplayer) {
                            const actionData = { type: 'PLAY_CARD', card: card, slotIndex: targetIndex };
                            if (isTeleport) {
                                actionData.sourceIndex = prevTeleportSource;
                            }
                            this.sendAction(actionData);
                        }

                        this.selectedCardInfo = null;
                        this.updateUI();
                        this.log(`${window.TRANSLATIONS[window.currentLang].played} ${card.name[window.currentLang]}`);
                    }
                }
            }
        } else if (location === 'field') {
            // Спроба перемістити юніта або атакувати
            const targetCard = this.field[targetIndex];
            if (!targetCard && targetIndex >= 0 && targetIndex < this.field.length) {
                if (window.DEBUG) console.log(`Attempting to move unit from ${fromIndex} to ${targetIndex}`);
                if (this.moveUnit(fromIndex, targetIndex)) {
                    this.selectedCardInfo = null;
                }
            } else if (targetCard && targetCard.isEnemy) {
                // Атака
                if (window.DEBUG) console.log(`Attempting to attack from ${fromIndex} to ${targetIndex}`);
                if (this.canAttack(fromIndex, targetIndex)) {
                    this.attack(fromIndex, targetIndex);
                    this.selectedCardInfo = null;
                } else {
                    if (window.DEBUG) console.log("Attack conditions not met (range or blockers)");
                }
            }
        }

        // КЛІК ПО БОСУ (окремий блок від поля)
        if (targetIndex === -1 || targetIndex === -2) {
            // Атака на боса (якщо вибрана карта на полі)
            if (location === 'field') {
                if (window.DEBUG) console.log(`Attempting to attack boss ${targetIndex} from ${fromIndex}`);
                if (this.canAttack(fromIndex, targetIndex)) {
                    this.attack(fromIndex, targetIndex);
                    this.selectedCardInfo = null;
                } else {
                    if (window.DEBUG) console.log("Boss attack conditions not met");
                }
            }
        }
        this.updateUI();
    },

    setupEventListeners() {
        const discardPile = document.getElementById('discard-pile');
        if (discardPile) {
            discardPile.onclick = (e) => {
                e.stopPropagation();
                if (this.selectedCardInfo && this.selectedCardInfo.location === 'hand') {
                    this.discardCard(this.selectedCardInfo.index);
                }
            };
        }

        const endTurnBtn = document.getElementById('end-turn-btn');
        if (endTurnBtn) {
            endTurnBtn.onclick = (e) => {
                e.stopPropagation();
                this.endTurn();
            };
        }

        const attackBtn = document.getElementById('attack-btn');
        if (attackBtn) {
            attackBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.DEBUG) console.log("Attack button clicked!");
                if (this.isMultiplayer && this.turnPlayer !== playerRole) {
                    this.log(window.TRANSLATIONS[window.currentLang].notYourTurn);
                    return;
                }

                let anyAttackPerformed = false;
                this.field.forEach((card, index) => {
                    if (card && !card.isEnemy) {
                        if (this.attackEnemy(index, index % this.gridSize)) {
                            anyAttackPerformed = true;
                        }
                    }
                });

                if (!anyAttackPerformed) {
                    this.log(window.TRANSLATIONS[window.currentLang].noTargets);
                }
            };
        }

        // Обробка кліку по босу (для ручної атаки)
        const enemyBoss = document.getElementById('enemy-boss');
        if (enemyBoss) {
            enemyBoss.onclick = (e) => {
                e.stopPropagation();
                // Якщо вибрано карту на полі, пробуємо атакувати боса
                if (this.selectedCardInfo && this.selectedCardInfo.location === 'field') {
                    this.handleTargetSelection(-1);
                }
            };
        }

        // ========== KEYBOARD SHORTCUTS ==========
        this._keyboardHandler = (e) => {
            // Ігноруємо, якщо фокус в текстовому полі
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Пробіл — закінчити хід
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                const endBtn = document.getElementById('end-turn-btn');
                if (endBtn && !endBtn.disabled) {
                    this.endTurn();
                    showToast('⏭️ Хід закінчено', 'info', '', 1000);
                }
                return;
            }

            // Escape — скасувати вибір
            if (e.code === 'Escape') {
                if (this.selectedCardInfo) {
                    this.selectedCardInfo = null;
                    this.updateUI();
                    showToast('❌ Вибір скасовано', 'info', '', 800);
                }
                return;
            }

            // Цифри 1-5 — вибрати карту в руці
            if (e.code >= 'Digit1' && e.code <= 'Digit5') {
                const idx = parseInt(e.code.replace('Digit', '')) - 1;
                if (idx < this.hand.length) {
                    const card = this.hand[idx];
                    if (this.selectedCardInfo && this.selectedCardInfo.location === 'hand' && this.selectedCardInfo.index === idx) {
                        // Повторне натискання — скасувати вибір
                        this.selectedCardInfo = null;
                    } else {
                        this.selectedCardInfo = { index: idx, location: 'hand', card };
                        showToast(`🃏 Вибрана карта: ${card.name[window.currentLang]}`, 'info', '', 1200);
                    }
                    this.updateUI();
                }
                return;
            }
        };
        document.addEventListener('keydown', this._keyboardHandler);
    }

}); // Object.assign(Game.prototype, ...)
