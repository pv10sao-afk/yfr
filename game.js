// Firebase Firestore functions and db are exposed via window.db and window._fs
// by firebase-config.js (loaded as a module before this script).
// This file is intentionally a regular script (not a module) so it loads
// even if Firebase CDN is temporarily unavailable.

// ========== DEBUG FLAG ==========
// Щоб увімкнути логи у консолі: window.DEBUG = true
window.DEBUG = window.DEBUG || false;

// ========== PROGRESSION ==========
// userDeck, unlockedCards, userGold, usedPromos, userStats,
// selectedAvatar/Skin/Theme, ownedAvatars/Skins/Themes,
// dailyQuestsProgress, saveProgression(), currentLang,
// campaignProgress, copyToClipboard()
// → винесено в progression.js. Підключіть його в index.html ПЕРЕД game.js.

// ========== UI UTILITIES ==========
// updateUserInfo, showAlert, showToast, showConfirmModal,
// animateCardSlot, showSpellVisual, showDamageFloat, setLanguage
// → винесено в ui.js. Підключіть його в index.html ПЕРЕД game.js.

class Game {
    constructor(customDeck = null, gridSize = 3, isMultiplayer = false, enableEvents = false, isTurboMode = false) {
        this.gridSize = gridSize;
        this.enableEvents = enableEvents;
        this.isTurboMode = isTurboMode;
        this.cellEvents = new Map(); // index -> { type: 'heal'|'damage'|'armor_up'|'armor_down'|'attack_down', duration: 2 }

        // Turbo Mode start mana implementation
        const startMana = this.isTurboMode ? 5 : 1;
        this.mana = startMana;
        this.maxMana = startMana;
        this.enemyMana = startMana;
        this.enemyMaxMana = startMana;
        this.playerHp = 50;
        this.enemyHp = 50;
        this.turn = 1;
        this.hand = [];
        this.enemyHand = [];
        this.deck = [];
        this.enemyDeck = [];
        this.field = new Array(gridSize * gridSize).fill(null);
        this.lastPlayedPlayerUnitIdx = null;
        this.maxHandSize = 5;
        this.deckSize = 10;
        this.customDeckSource = customDeck;

        // PRNG для мультиплеєра - гарантує що рандом однаково генерується у Хоста і Гостя
        // Mulberry32 — period ~4 млрд, рівномірний розподіл, без циклів на короткій грі
        this.prngSeed = 1337;

        // Мультиплеєр: визначення черги ходу
        this.isMultiplayer = isMultiplayer;
        this.turnPlayer = 'host'; // Завжди починає хост

        // Стан для системи вибору через кліки
        this.selectedCardInfo = null; // { index, location, card }

        // Прапорці для завершення ходу обома гравцями
        this.localEndTurnRequested = false;
        this.remoteEndTurnRequested = false;

        this.isGameOver = false;

        this.turnStartSnapshot = null;
        this.magicChainTarget = null;
        this.doubleNextUnitStats = false; // Прапорець для Артема (ID 53)

        // Мережевий таймер ходу
        this.turnTimerInterval = null;
        this.TURN_TIME_LIMIT = 60; // 60 секунд на хід
        this.turnTimeLeft = this.TURN_TIME_LIMIT;

        // Глобальний обробник для скидання вибору при кліку на порожнє місце
        this._globalClickHandler = (e) => {
            // Якщо клік був по кнопці, яка має свій обробник, не скидаємо вибір тут
            if (e.target.closest('button') || e.target.closest('.card') || e.target.closest('.grid-slot') || e.target.closest('.boss-avatar') || e.target.closest('#discard-pile')) {
                return;
            }
            if (this.selectedCardInfo) {
                if (window.DEBUG) console.log("Global click - deselecting card");
                this.selectedCardInfo = null;
                this.updateUI();
            }
        };
        document.addEventListener('click', this._globalClickHandler);

        this.initDecks(customDeck);
        this.updateUI();
        this.setupEventListeners();

        for (let i = 0; i < 3; i++) {
            this.drawCard();
            this.drawEnemyCard();
        }
    }

    getRandom() {
        if (this.isMultiplayer) {
            // Mulberry32 — period ~2³², рівномірний розподіл, без циклів при довгих іграх.
            // Замінює LCG (period 233280) який створював видимі патерни після ~200 викликів.
            let t = (this.prngSeed += 0x6D2B79F5) | 0;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
        return Math.random();
    }

    initDecks(customDeck) {
        let botRarityCounts = { legendary: 0, epic: 0, rare: 0, common: 0 };
        for (let i = 0; i < this.deckSize; i++) {
            if (window.isAntiDraftGame && !this.isMultiplayer) {
                // В режимі АнтиДрафт з ботом: гравець грає випадковою колодою (згенерованою ботом)
                // А бот грає колодою, яку зібрав гравець
                this.deck.push(this.generateRarityBasedCard(null, false, botRarityCounts));
                this.enemyDeck.push(this.generateRarityBasedCard(customDeck, true));
            } else {
                this.deck.push(this.generateRarityBasedCard(customDeck, false));
                this.enemyDeck.push(this.generateRarityBasedCard(null, true, botRarityCounts));
            }
        }
        this.log(window.TRANSLATIONS[window.currentLang].welcome);
    }

    generateRarityBasedCard(customDeck, isEnemy, rarityCounts = null) {
        const rand = this.getRandom() * 100;
        let rarity;
        if (rand < 5) rarity = 'legendary';
        else if (rand < 60) rarity = 'common';
        else if (rand < 90) rarity = 'rare';
        else rarity = 'epic';

        // Apply deck limits if tracking is enabled (for bot)
        if (rarityCounts && (!customDeck || customDeck.length === 0)) {
            // Downgrade rarity if limits are reached (only if generating from full database)
            if (rarity === 'legendary' && rarityCounts.legendary >= 1) rarity = 'epic';
            if (rarity === 'epic' && rarityCounts.epic >= 3) rarity = 'rare';
            if (rarity === 'rare' && rarityCounts.rare >= 5) rarity = 'common';

            if (rarityCounts[rarity] !== undefined) rarityCounts[rarity]++;
        }

        let availableCards;
        if (customDeck && customDeck.length > 0) {
            // Фільтруємо вибрану колоду за рідкістю
            availableCards = customDeck
                .map(id => CARD_DATABASE.find(c => c.id === id))
                .filter(c => c && c.rarity === rarity);

            // Якщо такої рідкості немає в колоді, беремо будь-яку з колоди
            if (availableCards.length === 0) {
                availableCards = customDeck.map(id => CARD_DATABASE.find(c => c.id === id)).filter(Boolean);
            }
        } else {
            // Для бота або якщо немає кастомної колоди - беремо з усієї бази
            availableCards = CARD_DATABASE.filter(c => c.rarity === rarity);
            if (availableCards.length === 0) availableCards = CARD_DATABASE;
        }

        const cardData = availableCards[Math.floor(this.getRandom() * availableCards.length)];
        return {
            ...cardData,
            instanceId: (isEnemy ? 'e_' : 'p_') + this.getRandom().toString(36).substr(2, 9),
            hasMovedThisTurn: false,
            isEnemy: isEnemy,
            isRevealed: !isEnemy
        };
    }

    triggerUnitPlayedPassives(playedUnit) {
        // Rustam: The Analyst (ID 50) Passive
        this.field.forEach(card => {
            if (card && card.id === 50) {
                card.hp += 2;
                card.armor += 2;
                this.applyStatCaps(card);
                this.log(`Рустам поглинає енергію: +2 HP/Armor`);
            }
        });
    }

    applyStatCaps(card) {
        if (!card) return;
        // Визначаємо ліміт на основі рідкості
        let maxStat = 20; // common
        if (card.rarity === 'rare') maxStat = 40;
        if (card.rarity === 'epic') maxStat = 60;
        if (card.rarity === 'legendary') maxStat = 80;

        // Override if set (e.g. by Artem ID 53)
        if (card.statCapOverride) {
            maxStat = Math.max(maxStat, card.statCapOverride);
        }

        let capped = false;

        // Застосовуємо ліміт до здоров'я, атаки та броні
        if (card.hp > maxStat) { card.hp = maxStat; capped = true; }
        if (card.damage > maxStat) { card.damage = maxStat; capped = true; }
        if (card.armor > maxStat) { card.armor = maxStat; capped = true; }

        // Minimum armor is 0
        if (card.armor < 0) card.armor = 0;

        if (capped) {
            this.log(`${card.name[window.currentLang]}: Досягнуто ліміт характеристик!`);
        }
    }

    drawCard() {
        if (this.deck.length === 0) this.refillPlayerDeck();
        if (this.hand.length >= this.maxHandSize) {
            this.deck.pop();
            return;
        }
        const card = this.deck.pop();
        card.justDrawn = true; // For animation
        this.hand.push(card);

        if (this.isMultiplayer) {
            this.sendAction({ type: 'DRAW_CARD' });
        }

        this.updateUI();
    }

    refillPlayerDeck() {
        const currentCustomDeck = this.customDeckSource || (window.userDeck && window.userDeck.length >= window.MAX_DECK_SIZE ? window.userDeck : null);
        for (let i = 0; i < this.deckSize; i++) {
            this.deck.push(this.generateRarityBasedCard(currentCustomDeck, false));
        }
    }

    drawEnemyCard() {
        if (this.isMultiplayer) return;
        if (this.enemyDeck.length === 0) this.refillEnemyDeck();
        if (this.enemyHand.length < this.maxHandSize) {
            const card = this.enemyDeck.pop();
            card.justDrawn = true; // For animation
            this.enemyHand.push(card);
        }
    }

    refillEnemyDeck() {
        let botRarityCounts = { legendary: 0, epic: 0, rare: 0, common: 0 };
        for (let i = 0; i < this.deckSize; i++) {
            this.enemyDeck.push(this.generateRarityBasedCard(null, true, botRarityCounts));
        }
    }

    createTurnSnapshot() {
        this.turnStartSnapshot = {
            playerHp: this.playerHp,
            enemyHp: this.enemyHp,
            field: this.field.map(card => card ? { ...card } : null)
        };
    }

    restoreTurnSnapshot() {
        if (!this.turnStartSnapshot) return;
        this.playerHp = this.turnStartSnapshot.playerHp;
        this.enemyHp = this.turnStartSnapshot.enemyHp;
        this.field = this.turnStartSnapshot.field.map(card => card ? { ...card } : null);
        this.updateUI();
        this.log(window.TRANSLATIONS[window.currentLang].timeLoopActivated || "Час повернуто назад!");
    }

    processStartTurnEffects(isEnemyTurn) {
        this.magicChainTarget = null;
        if (isEnemyTurn) {
            this.createTurnSnapshot();
        }

        // --- Сквайр (ID 22): ЩОХІДНИЙ баф — на початку ХОДу власника дає +1 Атаки союзнику попереду ---
        // Навмисно НЕ використовується stack/diff система: кожен хід незалежно додає +1,
        // завдяки чому баф справді накопичується ("start of turn: give +1") а не просто "аура".
        this.field.forEach((sq, sqIdx) => {
            if (!sq || sq.id !== 22 || sq.isEnemy !== isEnemyTurn) return;
            const sqRow = Math.floor(sqIdx / this.gridSize);
            const sqCol = sqIdx % this.gridSize;
            // Ряд попереду: для ворожих юнітів (рухаються вниз) — +1, для гравця — -1
            const frontRow = sq.isEnemy ? sqRow + 1 : sqRow - 1;
            if (frontRow < 0 || frontRow >= this.gridSize) return;
            const frontIdx = frontRow * this.gridSize + sqCol;
            const frontUnit = this.field[frontIdx];
            if (frontUnit && frontUnit.isEnemy === sq.isEnemy) {
                frontUnit.damage += 1;
                this.applyStatCaps(frontUnit);
                this.log(`⚔️ ${sq.name[window.currentLang]} дає +1 атаки ${frontUnit.name[window.currentLang]}!`);
            }
        });

        this.field.forEach((card, idx) => {
            if (card && card.isEnemy === isEnemyTurn) {

                // Осквернитель (ID 26): Урон сусідам
                if (card.id === 26) {
                    const row = Math.floor(idx / this.gridSize);
                    const col = idx % this.gridSize;
                    const neighbors = [
                        { r: row - 1, c: col }, { r: row + 1, c: col },
                        { r: row, c: col - 1 }, { r: row, c: col + 1 }
                    ];

                    neighbors.forEach(n => {
                        if (n.r >= 0 && n.r < this.gridSize && n.c >= 0 && n.c < this.gridSize) {
                            const nIdx = n.r * this.gridSize + n.c;
                            if (this.field[nIdx]) {
                                this.takeDamage(nIdx, 1, card.name[window.currentLang]);
                            }
                        }
                    });
                }

                // Максим: Зірка Політехніки (ID 52): Лікування всіх союзників
                if (card.id === 52) {
                    this.field.forEach(u => {
                        if (u && u.isEnemy === card.isEnemy) {
                            u.hp += 2;
                            this.applyStatCaps(u);
                        }
                    });
                    this.log(`${card.name[window.currentLang]} підтримує здоров'я юнітів! (+2 HP)`);
                }

                // Нестабільний Елементаль (ID 55): Щоходу втрачає 2 HP і отримує +5 Атаки
                if (card.id === 55) {
                    card.damage += 5;
                    this.applyStatCaps(card);
                    this.takeDamage(idx, 2, card.name[window.currentLang]);
                    this.log(`${card.name[window.currentLang]} накопичує нестабільність: -2 HP, +5 Атаки`);
                }
            }
        });
    }

    processEndTurnEffects(isEnemyTurn) {
        this.field.forEach((card, idx) => {
            if (card && card.isEnemy === isEnemyTurn) {
                // Вартовий Порталу (ID 24): Обмін місцями
                if (card.id === 24) {
                    const allies = this.field
                        .map((c, i) => ({ c, i }))
                        .filter(({ c, i }) => c && c.isEnemy === isEnemyTurn && i !== idx);

                    if (allies.length > 0) {
                        const randomAlly = allies[Math.floor(this.getRandom() * allies.length)];
                        this.field[idx] = randomAlly.c;
                        this.field[randomAlly.i] = card;
                        this.log(`${card.name[window.currentLang]} міняється місцями з ${randomAlly.c.name[window.currentLang]}!`);
                    }
                }

                // Жриця Життя (ID 32): Лікування сусідів
                if (card.id === 32) {
                    const row = Math.floor(idx / this.gridSize);
                    const col = idx % this.gridSize;
                    const neighbors = [
                        { r: row - 1, c: col },
                        { r: row + 1, c: col },
                        { r: row, c: col - 1 },
                        { r: row, c: col + 1 }
                    ];

                    neighbors.forEach(pos => {
                        if (pos.r >= 0 && pos.r < this.gridSize && pos.c >= 0 && pos.c < this.gridSize) {
                            const nIdx = pos.r * this.gridSize + pos.c;
                            const neighbor = this.field[nIdx];
                            if (neighbor && neighbor.isEnemy === isEnemyTurn) {
                                const modifier = this.getHealingModifier(neighbor);
                                const healAmount = Math.floor(2 * modifier);
                                if (healAmount > 0) {
                                    neighbor.hp += healAmount;
                                    this.applyStatCaps(neighbor);
                                    this.log(`${card.name[window.currentLang]} лікує ${neighbor.name[window.currentLang]} (+${healAmount})`);
                                }
                            }
                        }
                    });
                }

                // Нікіта: Залізний Кураж (ID 51): +2 Attack сусіднім союзникам в кінці ходу
                if (card.id === 51) {
                    const row = Math.floor(idx / this.gridSize);
                    const col = idx % this.gridSize;
                    const neighbors = [
                        { r: row - 1, c: col },
                        { r: row + 1, c: col },
                        { r: row, c: col - 1 },
                        { r: row, c: col + 1 }
                    ];
                    let buffed = 0;
                    neighbors.forEach(pos => {
                        if (pos.r >= 0 && pos.r < this.gridSize && pos.c >= 0 && pos.c < this.gridSize) {
                            const nIdx = pos.r * this.gridSize + pos.c;
                            const neighbor = this.field[nIdx];
                            if (neighbor && neighbor.isEnemy === isEnemyTurn) {
                                neighbor.damage += 2;
                                this.applyStatCaps(neighbor);
                                buffed++;
                            }
                        }
                    });
                    if (buffed > 0) {
                        this.log(`💪 ${card.name[window.currentLang]} надихає ${buffed} союзників! (+2 ⚔️)`);
                    }
                }
            }
        });
    }

    startTurnTimer() {
        if (!this.isMultiplayer) return;

        this.stopTurnTimer(); // Clear any existing timer
        this.turnTimeLeft = this.TURN_TIME_LIMIT;

        const container = document.getElementById('turn-timer-container');
        const bar = document.getElementById('turn-timer-bar');

        if (container) {
            container.classList.remove('hidden');
            container.style.display = 'block'; // Force display just in case
        }
        if (bar) {
            bar.style.width = '100%';
            bar.classList.remove('timer-warning');
        }

        this.turnTimerInterval = setInterval(() => {
            if (this.isGameOver) {
                this.stopTurnTimer();
                return;
            }

            this.turnTimeLeft--;

            if (bar) {
                const percentage = (this.turnTimeLeft / this.TURN_TIME_LIMIT) * 100;
                bar.style.width = `${percentage}%`;

                if (this.turnTimeLeft <= 15 && this.turnTimeLeft > 0) {
                    bar.classList.add('timer-warning');
                    // Play ticking sound if it's our turn
                    if (this.turnPlayer === playerRole) {
                        try {
                            SoundEngine.play('tick'); // Окремий звук таймера (не звук кнопки)
                        } catch (e) { }
                    }
                }
            }

            if (this.turnTimeLeft <= 0) {
                this.stopTurnTimer();
                // Force end turn if it's our turn
                if (this.turnPlayer === playerRole) {
                    this.log("⏳ Час вичерпано!");
                    this.endTurn();
                }
            }
        }, 1000);
    }

    stopTurnTimer() {
        if (this.turnTimerInterval) {
            clearInterval(this.turnTimerInterval);
            this.turnTimerInterval = null;
        }
        const bar = document.getElementById('turn-timer-bar');
        if (bar) {
            bar.classList.remove('timer-warning');
        }
    }

    endTurn() {
        if (this.isMultiplayer) {
            if (this.turnPlayer !== playerRole) {
                this.log(window.TRANSLATIONS[window.currentLang].notYourTurn);
                return;
            }

            this.stopTurnTimer(); // Зупиняємо таймер при заврешенні ходу

            // Активний гравець завершує хід
            if (playerRole === 'host') {
                this.executeTurnTransition();
                // Хост надсилає абсолютний стан для Гостя
                this.sendAction({
                    type: 'END_TURN_HOST',
                    state: {
                        turn: this.turn,
                        hostMaxMana: this.maxMana,
                        hostMana: this.mana,
                        guestMaxMana: this.enemyMaxMana,
                        guestMana: this.enemyMana,
                        hostHp: this.playerHp,
                        guestHp: this.enemyHp
                    }
                });
            } else {
                // Гість просить Хоста підтвердити завершення ходу (для синхронізації мани)
                this.log(window.TRANSLATIONS[window.currentLang].turnEndWaiting);
                this.sendAction({ type: 'END_TURN_REQUEST' });
                const endTurnBtn = document.getElementById('end-turn-btn');
                if (endTurnBtn) endTurnBtn.disabled = true;
            }
            return;
        }

        this.processEndTurnEffects(false); // Ефекти кінця ходу гравця

        // Process Cell Events (End of Player Turn)
        if (this.enableEvents) this.processCellEvents();

        // Тимчасово оновлюємо UI, щоб гравець бачив, що почався хід бота (ще на поточному раунді)
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            turnIndicator.textContent = window.TRANSLATIONS[window.currentLang].enemyTurn;
            turnIndicator.classList.remove('my-turn');
            turnIndicator.classList.add('enemy-turn');
        }
        const endTurnBtn = document.getElementById('end-turn-btn');
        if (endTurnBtn) endTurnBtn.disabled = true;
        const attackBtn = document.getElementById('attack-btn');
        if (attackBtn) attackBtn.disabled = true;

        // Додаємо візуальну затримку, щоб гравець бачив розділення ходів
        setTimeout(() => {
            this.processStartTurnEffects(true); // Ефекти початку ходу ворога
            this.aiTurn();
            this.processEndTurnEffects(true); // Ефекти кінця ходу ворога

            // Process Cell Events (End of Enemy Turn)
            if (this.enableEvents) this.processCellEvents();

            this.turn++;

            // FATIGUE: Sudden Death after turn 25
            if (this.turn > 25) {
                this.playerHp -= 2;
                this.enemyHp -= 2;
                this.log(`⚠️ ВТОМА: Обидва гравці втрачають 2 HP! (Хід ${this.turn})`);
                if (this.checkGameOver()) return;
            }

            const increment = 1;
            this.maxMana = Math.min(this.maxMana + increment, 10);
            this.mana = this.maxMana;
            this.field.forEach(card => {
                if (card) {
                    card.hasMovedThisTurn = false;
                    if (card.isFrozen > 0) card.isFrozen--;
                }
            });

            this.processStartTurnEffects(false); // Ефекти початку ходу гравця (включаючи снепшот)
            for (let i = 0; i < 3; i++) this.drawCard();
            this.updateUI();
        }, 1000); // Затримка 1 секунда
    }

    executeTurnTransition() {
        // Завершення ходу попереднього гравця
        this.processEndTurnEffects(this.turnPlayer !== playerRole); // Якщо був хід ворога, то true

        // Process Cell Events at the end of the round (before turn increment)
        if (this.enableEvents) {
            this.processCellEvents();
        }

        // Зміна активного гравця
        this.turnPlayer = (this.turnPlayer === 'host' ? 'guest' : 'host');

        // Number of rounds only increments when the turn comes back to the Host (Player 1)
        if (!this.isMultiplayer || this.turnPlayer === 'host') {
            this.turn++;
        }

        // FATIGUE: Sudden Death after turn 25
        if (this.turn > 25) {
            this.playerHp -= 2;
            this.enemyHp -= 2;
            this.log(`⚠️ ВТОМА: Обидва гравці втрачають 2 HP! (Хід ${this.turn})`);
            if (this.checkGameOver()) return;
        }

        // Calculate new max mana
        let newMax;
        if (this.isTurboMode) {
            // In turbo mode, start at 5 and add 2 per turn, max 10
            newMax = Math.min(5 + (this.turn - 1) * 2, 10);
        } else {
            // Standard mode: starts at 1, +1 per turn, max 10
            newMax = Math.min(this.turn, 10);
        }

        // Оновлення мани для того, чий зараз хід
        if (this.turnPlayer === playerRole) {
            this.maxMana = newMax;
            this.mana = this.maxMana;
        } else {
            this.enemyMaxMana = newMax;
            this.enemyMana = this.enemyMaxMana;
        }

        // Скидання прапорців руху
        this.field.forEach(card => {
            if (card && ((this.turnPlayer === playerRole && !card.isEnemy) || (this.turnPlayer !== playerRole && card.isEnemy))) {
                card.hasMovedThisTurn = false;
                if (card.isFrozen > 0) card.isFrozen--;
            }
        });

        // Початок ходу нового гравця
        this.processStartTurnEffects(this.turnPlayer !== playerRole);

        // Добираємо карту тому, чий зараз хід
        if (this.turnPlayer === playerRole) {
            for (let i = 0; i < 3; i++) this.drawCard();
        }

        this.remoteEndTurnRequested = false;
        this.localEndTurnRequested = false;

        // Start the turn timer for the new player (if multiplayer)
        if (this.isMultiplayer) {
            this.startTurnTimer();
        }

        this.updateUI();
    }

    // Допоміжні методи для мультиплеєра

    discardCard(handIndex) {
        const card = this.hand[handIndex];
        if (card) {
            this.log(`${window.TRANSLATIONS[window.currentLang].discarded}${card.name[window.currentLang]}`);
            this.hand.splice(handIndex, 1);
            this.selectedCardInfo = null;
            this.updateUI();
        }
    }

    log(msg) {
        const logContent = document.getElementById('log-content');
        if (logContent) {
            const p = document.createElement('p'); p.textContent = msg;
            p.classList.add('new-entry');
            logContent.prepend(p);
            if (logContent.children.length > 50) {
                logContent.removeChild(logContent.lastChild);
            }
        } else {
            const logEl = document.getElementById('message-log');
            if (logEl) {
                const p = document.createElement('p'); p.textContent = msg; p.classList.add('new-entry'); logEl.prepend(p);
            }
        }
    }

    showGameOver(isWin, reward = 0) {
        SoundEngine.play(isWin ? 'victory' : 'defeat');
        // Очищення глобального обробника кліку щоб уникнути витоку пам'яті
        if (this._globalClickHandler) {
            document.removeEventListener('click', this._globalClickHandler);
            this._globalClickHandler = null;
        }
        if (this._keyboardHandler) {
            document.removeEventListener('keydown', this._keyboardHandler);
            this._keyboardHandler = null;
        }
        this.stopTurnTimer();
        // Update stats
        if (!this.statsUpdated) {
            this.statsUpdated = true;
            if (!window.userStats) {
                window.userStats = { bot: { played: 0, won: 0, lost: 0 }, multiplayer: { played: 0, won: 0, lost: 0 } };
            }
            // Ensure structure integrity
            if (!window.userStats.bot) window.userStats.bot = { played: 0, won: 0, lost: 0 };
            if (!window.userStats.multiplayer) window.userStats.multiplayer = { played: 0, won: 0, lost: 0 };

            const type = this.isMultiplayer ? 'multiplayer' : 'bot';
            window.userStats[type].played++;
            if (isWin) {
                window.userStats[type].won++;
            } else {
                window.userStats[type].lost++;
            }
            window.saveProgression();

            // Daily Quests Progress
            window.updateQuestProgress('play_games', 1);
            if (isWin && this.isMultiplayer) {
                window.updateQuestProgress('win_multiplayer', 1);
            }

            // Achievements
            window.achOnGameEnd?.(isWin, this.isMultiplayer);
            window.cardChallengesOnGameEnd?.(isWin);
        }

        let title, message;

        if (isWin) {
            title = window.TRANSLATIONS[window.currentLang].win || (window.currentLang === 'uk' ? "Перемога!" : "Victory!");
            message = `${window.TRANSLATIONS[window.currentLang].gameOverWon} +${reward} 💰`;
        } else {
            title = window.TRANSLATIONS[window.currentLang].lose || (window.currentLang === 'uk' ? "Поразка" : "Defeat");
            message = window.TRANSLATIONS[window.currentLang].gameOverLost;
        }

        const modal = document.getElementById('custom-modal');
        const modalTitle = document.getElementById('custom-modal-title');
        const modalBody = document.getElementById('custom-modal-body');
        const okBtn = document.getElementById('custom-modal-ok-btn');

        if (!modal || !modalTitle || !modalBody || !okBtn) {
            alert(message);
            location.reload();
            return;
        }

        modalTitle.textContent = title;
        modalTitle.style.color = isWin ? '#f1c40f' : '#e74c3c';

        modalBody.innerHTML = '';
        const msgP = document.createElement('p');
        msgP.textContent = message;
        msgP.style.fontSize = '1.5em';
        msgP.style.margin = '20px 0';
        modalBody.appendChild(msgP);

        okBtn.textContent = window.TRANSLATIONS[window.currentLang].exit;
        okBtn.onclick = () => {
            location.reload();
        };

        modal.classList.remove('hidden');
    }
}

// Export Game class to window so non-module scripts (campaign.js etc.) can access it
window.Game = Game;

// Make showScreen global so it can be called from HTML onclick attributes
window.showScreen = function (screenId) {
    if (window.DEBUG) console.log(`Перемикання на екран: ${screenId}`);
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
    } else {
        console.error(`Екран з ID "${screenId}" не знайдено!`);
    }
}


// ========== DECK BUILDER ==========
// baseInitDeckBuilder() та initDeckBuilder() → винесено в deck-builder.js
// window.updateDeckBuilderUI = initDeckBuilder (також в deck-builder.js)

// Додаємо глобальні обробники для ПКМ зуму, які працюватимуть всюди (і в грі, і в конструкторі)
function setupGlobalZoomListeners() {
    // Забороняємо контекстне меню, щоб працював зум на ПКМ
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.card')) {
            e.preventDefault();
        }
    });

    // Обробка ПКМ для зуму
    document.addEventListener('mousedown', (e) => {
        const cardEl = e.target.closest('.card');
        if (cardEl && e.button === 2) { // 2 - це права кнопка миші
            cardEl.classList.add('zoomed');
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 2) {
            document.querySelectorAll('.card.zoomed').forEach(el => el.classList.remove('zoomed'));
        }
    });

    // На випадок якщо мишка вийшла за межі вікна під час затиснутої кнопки
    document.addEventListener('mouseleave', () => {
        document.querySelectorAll('.card.zoomed').forEach(el => el.classList.remove('zoomed'));
    });
}

// Глобальні змінні для Мережі (PeerJS)
let peer = null;
let conn = null;
window.conn = null;
let currentRoomId = null;
let playerRole = null; // 'host' or 'guest'
let matchmakingDocId = null;

window.addEventListener('beforeunload', () => {
    if (matchmakingDocId) {
        window._fs?.deleteDoc(window._fs?.doc(window.db, "matchmaking", matchmakingDocId)).catch(e => console.error(e));
    }
    // If we're connected to an opponent, explicitly tell them we are leaving
    if (conn && conn.open) {
        conn.send({ type: 'OPPONENT_QUIT' });
    }
});

// Initialize PeerJS
function initNetwork() {
    if (peer) return; // Вже ініціалізовано

    if (window.DEBUG) console.log("Ініціалізація PeerJS...");
    const statusBadge = document.getElementById('db-status-badge');

    try {
        if (typeof Peer === 'undefined') {
            console.error("PeerJS SDK не завантажено!");
            if (statusBadge) {
                statusBadge.textContent = window.TRANSLATIONS[window.currentLang].netSdkNotFound;
                statusBadge.style.color = "#e74c3c";
            }
            return;
        }

        // Створюємо Peer без фіксованого ID (отримаємо випадковий від сервера)
        peer = new Peer();

        peer.on('open', (id) => {
            if (window.DEBUG) console.log("PeerJS: Connected ✅ ID:", id);
            if (statusBadge) {
                statusBadge.textContent = window.TRANSLATIONS[window.currentLang].netReady;
                statusBadge.style.color = "#2ecc71";
            }
        });

        peer.on('error', (err) => {
            console.error("PeerJS Error:", err);
            if (statusBadge) {
                statusBadge.textContent = window.TRANSLATIONS[window.currentLang].netError;
                statusBadge.style.color = "#e74c3c";
            }
            // Якщо ID вже зайнятий або інша помилка, пробуємо перепідключитися
            if (err.type === 'unavailable-id') {
                setTimeout(initNetwork, 3000);
            }
        });

        // Обробка вхідних з'єднань (для Хоста)
        peer.on('connection', (incomingConn) => {
            if (playerRole === 'host') {
                conn = incomingConn;
                window.conn = conn;
                if (window.DEBUG) console.log("Суперник підключився!");
                // CLEANUP: Якщо ми були в черзі випадкового пошуку, видаляємо наш документ
                if (matchmakingDocId) {
                    window._fs?.deleteDoc(window._fs?.doc(window.db, "matchmaking", matchmakingDocId)).catch(e => console.error(e));
                    matchmakingDocId = null;
                }

                const statusText = document.getElementById('status-text');
                if (statusText) statusText.textContent = window.TRANSLATIONS[window.currentLang].netOpponentJoined;

                // Хост автоматично запускає гру після невеликої затримки
                setTimeout(() => {
                    const gridSize = window.lastGridSize || 3;
                    const enableEvents = window.lastEnableEvents || false;
                    const isTurboMode = window.lastTurboMode || false;

                    if (window.lastDraftMode) {
                        window.lastDraftMode = false;
                        conn.send({ type: 'START_DRAFT', gridSize: gridSize, hostAvatar: window.selectedAvatar || '❤️', isAntiDraft: window.isAntiDraftGame });
                        window.startDraft(gridSize, true, window.isAntiDraftGame);
                    } else {
                        conn.send({ type: 'START_GAME', gridSize: gridSize, enableEvents: enableEvents, isTurboMode: isTurboMode, hostAvatar: window.selectedAvatar || '❤️' });
                        startGame(gridSize, true, enableEvents, null, isTurboMode);
                    }
                }, 1500);
            }
        });

    } catch (e) {
        console.error("Помилка під час ініціалізації мережі:", e);
    }
}

function setupConnectionHandlers() {
    if (!conn || conn._handlersAttached) return;
    conn._handlersAttached = true;

    conn.on('open', () => {
        if (window.DEBUG) console.log("З'єднання встановлено!");
    });

    conn.on('data', (data) => {
        if (window.DEBUG) console.log("Отримано дані:", data);
        handleNetworkData(data);
    });

    conn.on('close', () => {
        if (window.DEBUG) console.log("З'єднання розірвано");
        handleOpponentDisconnect();
    });

    // Additional tracking for abrupt disconnects
    if (conn.peerConnection) {
        conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
            const state = conn.peerConnection.iceConnectionState;
            if (window.DEBUG) console.log("ICE state changed to:", state);
            if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                handleOpponentDisconnect();
            }
        });
    }
}

function handleOpponentDisconnect() {
    if (window._opponentDisconnectedHandled) return;
    window._opponentDisconnectedHandled = true;

    // If we are actively in a game
    if (window.game && window.game.isMultiplayer) {
        showConfirmModal(
            window.TRANSLATIONS[window.currentLang].opponentDisconnected || "Суперник відключився! Ви перемогли.",
            () => {
                window.game.showGameOver(true, 50);
            },
            () => {
                window.game.showGameOver(true, 50);
            },
            '🏆'
        );
    } else {
        showToast(window.TRANSLATIONS[window.currentLang].netOpponentDisconnected, "error", "❌");
        setTimeout(() => location.reload(), 2000);
    }
}

function updateEnemyAvatar(avatarEmoji) {
    if (!avatarEmoji) return;
    window.enemyAvatarEmoji = avatarEmoji;

    const enemyAvatarDisplay = document.getElementById('enemy-avatar-display');
    if (enemyAvatarDisplay) enemyAvatarDisplay.textContent = avatarEmoji;

    const enemyBossIcon = document.querySelector('#enemy-boss .boss-icon');
    if (enemyBossIcon) enemyBossIcon.textContent = avatarEmoji;
}

function handleNetworkData(data) {
    if (data.type === 'OPPONENT_QUIT') {
        if (window.DEBUG) console.log("Opponent explicitly quit the game via beforeunload.");
        handleOpponentDisconnect();
        return;
    }
    if (data.type === 'START_GAME') {
        if (data.hostAvatar) {
            window.enemyAvatarEmoji = data.hostAvatar;
            setTimeout(() => updateEnemyAvatar(data.hostAvatar), 100);
        }
        conn.send({ type: 'SYNC_AVATAR', avatar: window.selectedAvatar || '❤️' });
        startGame(data.gridSize, true, data.enableEvents || false, null, data.isTurboMode || false);
    }
    if (data.type === 'START_DRAFT') {
        if (data.hostAvatar) {
            window.enemyAvatarEmoji = data.hostAvatar;
            setTimeout(() => updateEnemyAvatar(data.hostAvatar), 100);
        }
        conn.send({ type: 'SYNC_AVATAR', avatar: window.selectedAvatar || '❤️' });
        // Guest receives draft start signal
        window.isAntiDraftGame = data.isAntiDraft || false;
        window.startDraft(data.gridSize, true, window.isAntiDraftGame);
    }
    if (data.type === 'SYNC_AVATAR') {
        window.enemyAvatarEmoji = data.avatar;
        // Small delay ensures DOM is ready if it's still transitioning screens
        setTimeout(() => updateEnemyAvatar(data.avatar), 500);
    }
    if (data.type === 'DRAFT_READY') {
        // The other player finished drafting
        window.opponentDraftReady = true;
        window.opponentDraftDeck = data.deck;
        if (window.draftState && window.draftState.finished) {
            // Both ready, start the game
            let deckToUse = window.draftState.isAntiDraft ? window.opponentDraftDeck : window.draftState.cards;
            startGame(window.draftState.gridSize, true, false, deckToUse);
        }
    }
    // Тут будуть інші типи даних: ходи, карти тощо
    if (window.game && window.game.isMultiplayer) {
        window.game.handleRemoteAction(data);
    }
}

// Функція-заглушка для сумісності
function initFirebase() { initNetwork(); }
function initAuth() { }
function monitorConnection() { }

// Multiplayer Logic
function initMultiplayerHandlers() {
    if (window.DEBUG) console.log("Ініціалізація мультиплеєрних обробників...");
    const bindClick = (id, handler) => {
        const el = document.getElementById(id);
        if (el) {
            el.onclick = () => {
                if (window.DEBUG) console.log(`Клік по кнопці мультиплеєра: ${id}`);
                handler();
            };
        } else {
            if (window.DEBUG) console.warn(`Кнопку з ID "${id}" не знайдено для мультиплеєра`);
        }
    };

    bindClick('multiplayer-btn', () => showScreen('multiplayer-screen'));

    bindClick('create-room-btn', () => {
        if (!peer || !peer.id) {
            showToast(window.TRANSLATIONS[window.currentLang].netNotReady, "warning", "🔌");
            initNetwork(); // Спробувати переініціалізувати
            return;
        }
        playerRole = 'host';
        currentRoomId = peer.id;

        const codeDisplay = document.getElementById('generated-room-code');
        if (codeDisplay) codeDisplay.textContent = currentRoomId;

        showScreen('create-room-screen');
    });

    bindClick('start-create-room-btn', () => {
        const gridSelect = document.getElementById('create-grid-select');
        const modeSelect = document.getElementById('create-mode-select');
        const gridSize = gridSelect ? parseInt(gridSelect.value) : 3;
        const mode = modeSelect ? modeSelect.value : 'standard';

        if (mode === 'standard') createNetworkRoom(gridSize, false, false);
        else if (mode === 'events') createNetworkRoom(gridSize, true, false);
        else if (mode === 'draft') { window.lastDraftMode = true; window.isAntiDraftGame = false; createNetworkRoom(gridSize, false, false); }
        else if (mode === 'antidraft') { window.lastDraftMode = true; window.isAntiDraftGame = true; createNetworkRoom(gridSize, false, false); }
        else if (mode === 'turbo') createNetworkRoom(gridSize, false, true);
    });

    bindClick('join-room-btn', () => showScreen('join-room-screen'));
    bindClick('random-match-btn', () => showScreen('random-match-screen'));

    bindClick('start-random-match-btn', () => {
        const gridSelect = document.getElementById('random-grid-select');
        const modeSelect = document.getElementById('random-mode-select');
        const gridSize = gridSelect ? parseInt(gridSelect.value) : 3;
        const mode = modeSelect ? modeSelect.value : 'standard';

        if (mode === 'standard') joinRandomMatch(gridSize, false, false, false, false);
        else if (mode === 'events') joinRandomMatch(gridSize, true, false, false, false);
        else if (mode === 'draft') joinRandomMatch(gridSize, false, true, false, false);
        else if (mode === 'antidraft') joinRandomMatch(gridSize, false, true, true, false);
        else if (mode === 'turbo') joinRandomMatch(gridSize, false, false, false, true);
    });

    bindClick('confirm-join-btn', () => {
        const codeInput = document.getElementById('join-code-input');
        const code = codeInput ? codeInput.value.trim() : "";
        if (code.length > 0) {
            joinNetworkRoom(code);
        } else {
            showToast(window.TRANSLATIONS[window.currentLang].netEnterHostId, "warning", "⚠️");
        }
    });
}

function createNetworkRoom(gridSize, enableEvents = false, isTurboMode = false) {
    if (window.DEBUG) console.log(`Хост готує кімнату: ${currentRoomId}, сітка: ${gridSize}, події: ${enableEvents}, турбо: ${isTurboMode}`);
    window.lastGridSize = gridSize;
    window.lastEnableEvents = enableEvents;
    window.lastTurboMode = isTurboMode;

    const roomIdEl = document.getElementById('current-room-id');
    if (roomIdEl) roomIdEl.textContent = currentRoomId;

    const statusText = document.getElementById('status-text');
    if (statusText) statusText.textContent = window.TRANSLATIONS[window.currentLang].netYourIdReady;

    showScreen('waiting-room-screen');
}

function joinNetworkRoom(hostId) {
    if (window.DEBUG) console.log(`Приєднання до хоста: ${hostId}`);
    if (!peer) return;

    playerRole = 'guest';

    const statusText = document.getElementById('status-text');
    if (statusText) statusText.textContent = `Підключення до ${hostId}...`;
    showScreen('waiting-room-screen');

    conn = peer.connect(hostId);
    window.conn = conn;

    // Додаємо таймаут на випадок якщо хост не знайдений
    setTimeout(() => {
        if (!conn.open) {
            if (window.DEBUG) console.log("Не вдалося підключитися (timeout)");
            if (statusText) statusText.textContent = window.TRANSLATIONS[window.currentLang].netConnectError;
            setTimeout(() => showScreen('multiplayer-screen'), 2000);
        }
    }, 5000);
}

// Заглушки для сумісності зі старим кодом
function createFirebaseRoom(gridSize) { createNetworkRoom(gridSize); }
function joinFirebaseRoom(code) { joinNetworkRoom(code); }

async function joinRandomMatch(gridSize, enableEvents, isDraft, isAntiDraft = false, isTurboMode = false) {
    if (!peer || !peer.id) {
        showToast(window.TRANSLATIONS[window.currentLang].netNotReady, "warning", "🔌");
        initNetwork();
        return;
    }

    // Save to globals so if we are host, we start correctly
    window.lastGridSize = gridSize;
    window.lastEnableEvents = enableEvents;
    window.lastDraftMode = isDraft;
    window.isAntiDraftGame = isAntiDraft;
    window.lastTurboMode = isTurboMode;

    const statusText = document.getElementById('status-text');
    if (statusText) statusText.textContent = window.TRANSLATIONS[window.currentLang].netSearching;
    const roomIdEl = document.getElementById('current-room-id');
    if (roomIdEl) roomIdEl.textContent = window.TRANSLATIONS[window.currentLang].netSearchingShort;

    showScreen('waiting-room-screen');

    try {
        const q = window._fs?.query(window._fs?.collection(window.db, "matchmaking"), window._fs?.where("status", "==", "waiting"));
        const querySnapshot = await window._fs?.getDocs(q);

        let foundHost = null;
        let foundDocId = null;

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (!foundHost && data.hostPeerId !== peer.id &&
                data.gridSize === gridSize &&
                data.enableEvents === enableEvents &&
                !!data.isDraft === !!isDraft &&
                !!data.isAntiDraft === !!isAntiDraft &&
                !!data.isTurboMode === !!isTurboMode) {
                foundHost = data.hostPeerId;
                foundDocId = docSnap.id;
            }
        });

        if (foundHost) {
            if (window.DEBUG) console.log("Found opponent in queue:", foundHost);
            // Delete the document so others don't join
            await window._fs?.deleteDoc(window._fs?.doc(window.db, "matchmaking", foundDocId));

            // Connect
            joinNetworkRoom(foundHost);
        } else {
            if (window.DEBUG) console.log("No opponents found. Creating room in queue...");
            playerRole = 'host';
            currentRoomId = peer.id;

            if (roomIdEl) roomIdEl.textContent = `Очікуємо гравця... (Випадковий ${gridSize}x${gridSize})`;
            if (statusText) statusText.textContent = window.TRANSLATIONS[window.currentLang].netInQueue;

            const docRef = await window._fs?.addDoc(window._fs?.collection(window.db, "matchmaking"), {
                hostPeerId: peer.id,
                status: 'waiting',
                gridSize: gridSize,
                enableEvents: enableEvents,
                isDraft: isDraft,
                isAntiDraft: isAntiDraft,
                isTurboMode: isTurboMode,
                createdAt: Date.now()
            });
            matchmakingDocId = docRef.id;
        }
    } catch (e) {
        console.error("Matchmaking error:", e);
        window.showAlert(window.TRANSLATIONS[window.currentLang].errorTitle, (window.TRANSLATIONS[window.currentLang].netSearchError || "Search error: ") + e.message);
        showScreen('multiplayer-screen');
    }
}

function startGame(gridSize, isMultiplayer = false, enableEvents = false, customDeck = null, isTurboMode = false) {
    if (window.DEBUG) console.log(`Запуск гри: сітка ${gridSize}, мультиплеєр: ${isMultiplayer}, події: ${enableEvents}, турбо: ${isTurboMode}`);
    // If starting a standard mode, we use customDeck if provided, else userDeck.
    // In Draft mode, customDeck is explicitly passed, so we must NOT mutate window.userDeck here.
    let selectedDeck = customDeck || window.userDeck;
    if (!customDeck && window.userDeck.length < window.MAX_DECK_SIZE) {
        showConfirmModal(
            window.TRANSLATIONS[window.currentLang].deckNotFull,
            () => {
                // User confirmed — use random deck
                showToast(window.TRANSLATIONS[window.currentLang].toastRandomDeck, 'warning', '🎴');
                _doStartGame(gridSize, isMultiplayer, enableEvents, null, isTurboMode);
            },
            null,
            '🎴'
        );
        return;
    }

    _doStartGame(gridSize, isMultiplayer, enableEvents, selectedDeck, isTurboMode);
}

function _doStartGame(gridSize, isMultiplayer, enableEvents, selectedDeck, isTurboMode = false) {
    showScreen('game-container');

    const boardTitle = document.querySelector('#game-board h2');
    if (boardTitle) {
        boardTitle.textContent = gridSize === 3 ? window.TRANSLATIONS[window.currentLang].board3x3 : window.TRANSLATIONS[window.currentLang].board4x4;
        if (enableEvents) boardTitle.textContent += " (Events)";
    }

    const gridContainer = document.querySelector('.grid-container');
    if (gridContainer) {
        gridContainer.id = gridSize === 3 ? 'grid-3x3' : 'grid-4x4';
        gridContainer.className = gridSize === 3 ? 'grid-container' : 'grid-container grid-4x4';
        gridContainer.innerHTML = '';

        for (let i = 0; i < gridSize * gridSize; i++) {
            const slot = document.createElement('div');
            slot.className = 'grid-slot';
            slot.dataset.index = i;
            gridContainer.appendChild(slot);
        }
    }

    window.game = new Game(selectedDeck, gridSize, isMultiplayer, enableEvents, isTurboMode);

    if (window.game.isMultiplayer) {
        window.game.startTurnTimer();
    }
}

function initMainNavigation() {
    if (window.DEBUG) console.log("Ініціалізація основної навігації...");
    const bindClick = (id, handler) => {
        const el = document.getElementById(id);
        if (el) {
            el.onclick = (e) => {
                if (window.DEBUG) console.log(`Клік по кнопці: ${id}`);
                handler(e);
            };
        } else {
            if (window.DEBUG) console.warn(`Кнопку з ID "${id}" не знайдено для ініціалізації навігації`);
        }
    };

    bindClick('play-bot-btn', () => showScreen('mode-selection'));
    bindClick('campaign-btn', () => { showScreen('campaign-screen'); window.initCampaignScreen(); });
    bindClick('shop-btn', () => { showScreen('shop-screen'); window.initShopScreen(); });

    bindClick('start-bot-match-btn', () => {
        const gridSelect = document.getElementById('bot-grid-select');
        const modeSelect = document.getElementById('bot-mode-select');
        const gridSize = gridSelect ? parseInt(gridSelect.value) : 3;
        const mode = modeSelect ? modeSelect.value : 'standard';

        window.isAntiDraftGame = (mode === 'antidraft');
        if (mode === 'standard') startGame(gridSize, false, false, null, false);
        else if (mode === 'events') startGame(gridSize, false, true, null, false);
        else if (mode === 'draft') window.startDraft(gridSize, false, false);
        else if (mode === 'antidraft') window.startDraft(gridSize, false, true);
        else if (mode === 'turbo') startGame(gridSize, false, false, null, true);
    });

    bindClick('back-from-modes-btn', () => showScreen('main-menu'));
    bindClick('deck-btn', () => { showScreen('deck-builder'); window.initDeckBuilder(); window.initDeckBuilderTabs?.(); });
    bindClick('promo-btn', () => showScreen('promo-screen'));
    bindClick('quests-btn', () => showScreen('quests-screen'));
    bindClick('settings-btn', () => window.openSettingsScreen?.());
    bindClick('achievements-btn', () => {
        window.showScreen('achievements-screen');
        window.renderAchievementTabs?.();
        window.renderAchievements?.('all');
    });
    bindClick('apply-promo-btn', () => handlePromoCode());
    bindClick('back-to-menu-btn', () => showScreen('main-menu'));
    bindClick('sound-toggle', () => SoundEngine.toggleMute());
    bindClick('exit-game-btn', () => {
        showConfirmModal(
            window.TRANSLATIONS[window.currentLang].exitConfirm || window.TRANSLATIONS[window.currentLang].confirmExit,
            () => location.reload(),
            null,
            '🚪'
        );
    });

    // Add Enter key listener for promo input
    const promoInput = document.getElementById('promo-input');
    if (promoInput) {
        promoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                window.handlePromoCode();
            }
        });
    }
}

window.handlePromoCode = function () {
    if (window.DEBUG) console.log("Handling Promo Code...");
    const promoInput = document.getElementById('promo-input');
    const code = promoInput.value.trim();

    // Ensure usedPromos is an array
    if (!Array.isArray(window.usedPromos)) {
        window.usedPromos = [];
    }

    if (window.usedPromos.includes(code)) {
        showAlert(window.TRANSLATIONS[window.currentLang].errorTitle, window.TRANSLATIONS[window.currentLang].promoInvalid);
        return;
    }

    if (code === '2323' || code === '3110' || code === 'HalaMadrid') {
        const reward = (code === 'HalaMadrid') ? 300 : 1000;
        if (window.DEBUG) console.log(`Promo code valid! Reward: ${reward}`);
        window.userGold += reward;
        window.usedPromos.push(code);
        window.achOnGoldEarned?.(reward);
        window.achOnPromoClaimed?.();

        // Save immediately
        window.saveProgression();

        showAlert(window.TRANSLATIONS[window.currentLang].promoTitle, `${window.TRANSLATIONS[window.currentLang].promoSuccess} ${reward} 💰!`);
        promoInput.value = '';

        // Update UI
        if (typeof window.updateUserInfo === 'function') {
            window.updateUserInfo();
        }

        // Return to menu after short delay
        setTimeout(() => {
            window.showScreen('main-menu');
        }, 1500);
    } else {
        if (window.DEBUG) console.warn(`Invalid promo code: ${code}`);
        showAlert(window.TRANSLATIONS[window.currentLang].errorTitle, window.TRANSLATIONS[window.currentLang].promoInvalid);
    }
}

// Функція для запуску ініціалізації
function runInitialization() {
    if (window.DEBUG) console.log("Запуск повної ініціалізації гри...");
    try {
        setLanguage(window.currentLang);
        setupGlobalZoomListeners();
        initFirebase();
        initAuth();
        initMultiplayerHandlers();
        initMainNavigation();
        applyMenuTheme();
        if (typeof window.applyBoardSkin === 'function') window.applyBoardSkin();
        if (typeof window.checkDailyQuestsReset === 'function') window.checkDailyQuestsReset();

        // Check if user is already logged in (if auth loaded fast)
        if (window.currentUser) {
            if (window.DEBUG) console.log("User already logged in at game init, updating UI");
            window.updateUserInfo();
        }

        if (window.DEBUG) console.log("Ініціалізація завершена успішно ✅");
    } catch (error) {
        console.error("Помилка під час ініціалізації:", error);
    }
}

// Чекаємо поки firebase-config.js (module) встановить window._fs і window.db.
// Після Ctrl+F5 CDN-модулі грузяться без кешу — може займати 200-1500ms.
// Ми перевіряємо кожні 50ms, максимум 10 секунд.
function waitForFirebaseThenInit() {
    const INTERVAL = 50;
    const MAX_WAIT = 10000;
    let elapsed = 0;

    function check() {
        if (window._fs && window.db) {
            runInitialization();
            return;
        }
        elapsed += INTERVAL;
        if (elapsed >= MAX_WAIT) {
            console.warn('[game] Firebase не завантажився за 10с — запуск без нього');
            runInitialization();
            return;
        }
        setTimeout(check, INTERVAL);
    }

    if (document.readyState === 'complete') {
        check();
    } else {
        window.addEventListener('load', check);
    }
}

waitForFirebaseThenInit();

function createSimpleCardEl(card) {
    const div = document.createElement('div');
    const rarityClass = card.rarity || 'common';
    const skinObj = CARD_SKIN_DATABASE.find(s => s.id === window.selectedCardSkin);
    const skinClass = skinObj && skinObj.cssClass ? ' ' + skinObj.cssClass : '';
    div.className = `card ${card.type} ${rarityClass}${skinClass}`;
    div.title = card.name[window.currentLang];
    div.dataset.mana = card.mana || 0;
    div.dataset.rarity = rarityClass;
    div.dataset.id = card.id;

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
                <span class="card-hp">❤️ ${card.hp}</span>
            ` : `
                <span class="card-spell-icon">✨ Spell</span>
            `}
        </div>
    `;
    return div;
}
window.createSimpleCardEl = createSimpleCardEl;

// Device Mode Toggle Logic
window.setDeviceMode = function (mode) {
    const body = document.body;
    const btnPc = document.getElementById('device-pc');
    const btnMobile = document.getElementById('device-mobile');

    if (window.DEBUG) console.log(`Switching to ${mode} mode`);
    // Save to localStorage
    try {
        localStorage.setItem('deviceMode', mode);
    } catch (e) {
        console.error("Could not save device mode:", e);
    }

    if (mode === 'mobile') {
        body.classList.add('mobile-mode');
        if (btnMobile) btnMobile.classList.add('active');
        if (btnPc) btnPc.classList.remove('active');
    } else {
        body.classList.remove('mobile-mode');
        if (btnPc) btnPc.classList.add('active');
        if (btnMobile) btnMobile.classList.remove('active');
    }

    // Trigger resize to update any canvas or dynamic sizing
    window.dispatchEvent(new Event('resize'));

    // Adjust Grid Layout if game is running
    if (window.game) {
        window.game.updateUI();
    }
};

// Fullscreen Toggle Logic
window.toggleFullscreen = function () {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
};

// Emoji System Logic
let emojiTimeout = null;

window.toggleEmojiMenu = function () {
    const menu = document.getElementById('emoji-picker-container');
    if (menu) {
        // Ensure UI is updated before showing
        if (menu.classList.contains('hidden')) {
            window.updateEmojiPickerUI();
        }
        menu.classList.toggle('hidden');
    }
};

window.updateEmojiPickerUI = function () {
    const container = document.getElementById('emoji-picker-container');
    if (!container) return;

    container.innerHTML = '';

    // Fallback if not initialized
    const equipped = window.equippedEmojis || ['👍', '😮', '😠', '😂', '😭', '🤝'];

    equipped.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'emoji-option';
        btn.textContent = emoji;
        btn.onclick = () => window.sendEmoji(emoji);
        container.appendChild(btn);
    });
};

window.sendEmoji = function (emoji) {
    // Hide menu
    window.toggleEmojiMenu();

    // Show locally
    showFloatingEmoji('player-emoji-float', emoji);

    // Send to peer if in multiplayer
    if (window.game && window.game.isMultiplayer) {
        window.game.sendAction({
            type: 'EMOJI',
            emoji: emoji
        });
    }
};

function showFloatingEmoji(elementId, emoji) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.textContent = emoji;
    el.classList.remove('hidden', 'show');

    // Trigger reflow to restart animation
    void el.offsetWidth;

    el.classList.add('show');

    // Auto hide after animation (2s)
    setTimeout(() => {
        el.classList.remove('show');
        el.classList.add('hidden');
    }, 2000);
}

// Log toggle functionality
window.toggleLog = function () {
    const log = document.getElementById('message-log');
    const btn = document.getElementById('log-toggle-btn');
    if (log) {
        const isMinimized = log.classList.toggle('minimized');
        if (btn) btn.textContent = isMinimized ? '▲' : '▼';

        // Save preference
        try {
            localStorage.setItem('logMinimized', isMinimized);
        } catch (e) { }
    }
};

// Initialize device mode from localStorage
document.addEventListener('DOMContentLoaded', () => {
    // Initialize log state
    try {
        const isMinimized = localStorage.getItem('logMinimized') === 'true';
        if (isMinimized) {
            const log = document.getElementById('message-log');
            const btn = document.getElementById('log-toggle-btn');
            if (log) log.classList.add('minimized');
            if (btn) btn.textContent = '▲';
        }
    } catch (e) { }

    // Підсвітити активну кнопку мови при завантаженні
    try {
        const savedLang = localStorage.getItem('gameLang') || 'uk';
        const activeBtn = document.getElementById('lang-' + savedLang);
        if (activeBtn) activeBtn.classList.add('active');
    } catch (e) { }

    // Check if buttons exist and set initial state
    const btnPc = document.getElementById('device-pc');
    const btnMobile = document.getElementById('device-mobile');

    // Default to PC if nothing saved
    let savedMode = 'pc';
    try {
        savedMode = localStorage.getItem('deviceMode') || 'pc';
    } catch (e) {
        if (window.DEBUG) console.warn("Could not read device mode from storage", e);
    }

    if (window.DEBUG) console.log(`Loading saved device mode: ${savedMode}`);
    if (savedMode === 'mobile') {
        document.body.classList.add('mobile-mode');
        if (btnMobile) btnMobile.classList.add('active');
        if (btnPc) btnPc.classList.remove('active');
    } else {
        document.body.classList.remove('mobile-mode');
        if (btnPc) btnPc.classList.add('active');
        if (btnMobile) btnMobile.classList.remove('active');
    }

    // Initialize emoji picker UI
    if (typeof window.updateEmojiPickerUI === 'function') {
        setTimeout(() => window.updateEmojiPickerUI(), 500); // slight delay to ensure window.equippedEmojis is loaded by auth.js
    }
});

// Override showGameOver to handle campaign rewards
const origShowGameOver = Game.prototype.showGameOver;
Game.prototype.showGameOver = function (isWin, reward = 0) {
    if (this.isCampaign && isWin && this.campaignMission) {
        const m = this.campaignMission;
        reward = m.reward;
        if (!window.campaignProgress.completed.includes(m.id)) {
            window.campaignProgress.completed.push(m.id);
            localStorage.setItem('campaignProgress', JSON.stringify(window.campaignProgress));
            window.achOnCampaignLevel?.();
            if (m.cardReward && !window.unlockedCards.has(m.cardReward)) {
                window.unlockedCards.add(m.cardReward);
                const card = CARD_DATABASE.find(c => c.id === m.cardReward);
                if (card) {
                    setTimeout(() => window.showPackOpenAnimation(card), 1500);
                }
            }
        }
        window.userGold += reward;
        window.saveProgression();
    }
    origShowGameOver.call(this, isWin, reward);
};

// ========== DRAFT SYSTEM ==========
// Винесено у draft.js
// startDraft, renderDraftRound, draftPickCard, finishDraft → window.*

// ========== DAILY QUESTS LOGIC ==========
// Винесено у quests.js
// checkDailyQuestsReset, updateQuestProgress, claimQuestReward, renderDailyQuests → window.*



// ========== CARD TOOLTIP (Right-Click) ==========
document.addEventListener('contextmenu', (e) => {
    const tooltip = document.getElementById('card-tooltip');
    if (!tooltip) return;
    const cardEl = e.target.closest('.card');
    if (cardEl && !cardEl.classList.contains('concealed')) {
        e.preventDefault();
        const name = cardEl.querySelector('.card-name');
        const body = cardEl.querySelector('.card-body');
        const dmg = cardEl.querySelector('.card-damage');
        const armor = cardEl.querySelector('.card-armor');
        const hp = cardEl.querySelector('.card-hp');
        const mana = cardEl.querySelector('.card-mana');
        const rarity = cardEl.querySelector('.card-rarity');

        tooltip.innerHTML = `
            <div class="tooltip-name">${name ? name.textContent : ''}</div>
            <div class="tooltip-type">${rarity ? rarity.textContent : ''} ${mana ? '| Мана: ' + mana.textContent : ''}</div>
            ${dmg || armor || hp ? `<div class="tooltip-stats">
                ${dmg ? '<span style="color:#e74c3c">' + dmg.textContent + '</span>' : ''}
                ${armor ? '<span style="color:#95a5a6">' + armor.textContent + '</span>' : ''}
                ${hp ? '<span style="color:#2ecc71">' + hp.textContent + '</span>' : ''}
            </div>` : ''}
            <div class="tooltip-desc">${body ? body.textContent.trim() : ''}</div>
        `;
        tooltip.classList.add('visible');
        const x = Math.min(e.clientX + 15, window.innerWidth - 300);
        const y = Math.min(e.clientY + 15, window.innerHeight - 200);
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }
});
// Close tooltip on left-click anywhere
document.addEventListener('click', () => {
    const tooltip = document.getElementById('card-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
});

// ========== TUTORIAL ==========
// Логіка туторіалу винесена в tutorial.js
// (showTutorial викликається при DOMContentLoaded для нових гравців)


// ========== DECK BUILDER (improved) ==========
// initDeckBuilder() → винесено в deck-builder.js

// Sound toggle initial state and Apply Theme
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('sound-toggle');
    if (btn) btn.textContent = SoundEngine.muted ? '🔇' : '🔊';

    // Apply saved theme
    if (typeof window.applyMenuTheme === 'function') {
        window.applyMenuTheme();
    }
    if (typeof window.applyBoardSkin === 'function') {
        window.applyBoardSkin();
    }
});

// Stats Modal Functions
window.openStatsModal = function () {
    const modal = document.getElementById('stats-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    SoundEngine.play('click');
    if (typeof window.updateUserInfo === 'function') window.updateUserInfo();

    // Calculate win rates after a tick so animation plays
    setTimeout(() => {
        const stats = window.userStats || { bot: { played: 0, won: 0, lost: 0 }, multiplayer: { played: 0, won: 0, lost: 0 } };
        const botWR = stats.bot.played > 0 ? Math.round((stats.bot.won / stats.bot.played) * 100) : 0;
        const multiWR = stats.multiplayer.played > 0 ? Math.round((stats.multiplayer.won / stats.multiplayer.played) * 100) : 0;

        const botFill = document.getElementById('bot-winrate-fill');
        const botText = document.getElementById('bot-winrate-text');
        const multiFill = document.getElementById('multi-winrate-fill');
        const multiText = document.getElementById('multi-winrate-text');

        if (botFill) botFill.style.width = botWR + '%';
        if (botText) botText.textContent = `Win rate: ${botWR}%`;
        if (multiFill) multiFill.style.width = multiWR + '%';
        if (multiText) multiText.textContent = `Win rate: ${multiWR}%`;
    }, 100);
};

window.closeStatsModal = function () {
    const modal = document.getElementById('stats-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

// Close stats modal when clicking outside
window.addEventListener('click', function (event) {
    const modal = document.getElementById('stats-modal');
    if (event.target === modal) {
        window.closeStatsModal();
    }
});
