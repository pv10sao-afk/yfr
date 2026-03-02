// ========== GAME-NETWORK.JS ==========
// Мережеві методи: sendAction, handleRemoteAction, remotePlayCard, remoteMoveUnit, remoteAttack
// Object.assign mixin на Game.prototype. Завантажувати ПІСЛЯ game.js.

Object.assign(Game.prototype, {

sendAction(data) {
    if (conn && conn.open) {
        conn.send(data);
    }
},

handleRemoteAction(data) {
    if (window.DEBUG) console.log("Обробка віддаленої дії:", data);
    switch (data.type) {
        case 'EMOJI':
            // Show emoji over enemy boss
            if (typeof showFloatingEmoji === 'function') {
                showFloatingEmoji('enemy-emoji-float', data.emoji);
            }
            break;
        case 'END_TURN_REQUEST':
            // На запит Гостя Хост здійснює перехід і надсилає підтвердження + стан
            if (playerRole === 'host') {
                // Safety check: only process if it is currently the guest's turn
                if (this.turnPlayer === 'guest') {
                    this.executeTurnTransition();
                    this.sendAction({
                        type: 'END_TURN_GUEST_CONFIRM',
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
                }
            }
            break;
        case 'END_TURN_GUEST_CONFIRM':
        case 'END_TURN_HOST':
            if (playerRole === 'guest') {
                // Safety check: for GUEST_CONFIRM we expect turnPlayer to be 'guest'.
                // For END_TURN_HOST we expect turnPlayer to be 'host'.
                const expectedTurnForGuest = data.type === 'END_TURN_HOST' ? 'host' : 'guest';
                if (this.turnPlayer === expectedTurnForGuest) {
                    this.log(window.TRANSLATIONS[window.currentLang].newTurnStart);
                    this.executeTurnTransition();

                    // Явна синхронізація всіх станів від Хоста
                    if (data.state) {
                        this.turn = data.state.turn;
                        this.maxMana = data.state.guestMaxMana;
                        this.mana = data.state.guestMana;
                        this.enemyMaxMana = data.state.hostMaxMana;
                        this.enemyMana = data.state.hostMana;
                        this.playerHp = data.state.guestHp;
                        this.enemyHp = data.state.hostHp;
                    }
                    this.updateUI();
                }
            }
            break;
        case 'END_TURN':
        case 'END_TURN_CONFIRM':
            // Для сумісності під час активної сесії старого коду
            this.executeTurnTransition();
            break;
        case 'PLAY_CARD':
            this.remotePlayCard(data);
            break;
        case 'MOVE_UNIT':
            this.remoteMoveUnit(data);
            break;
        case 'ATTACK':
            this.remoteAttack(data);
            break;
        case 'DRAW_CARD':
            // Суперник додав карту в руку
            this.enemyHand.push({}); // Додаємо порожній об'єкт просто для лічильника
            this.updateUI();
            break;
    }
},

remotePlayCard(data) {
    if (window.DEBUG) console.log("Суперник грає карту:", data);
    const { card, slotIndex } = data;

    if (card.type === 'unit') {
        // Інвертуємо індекс для локального поля (суперник бачить поле навпаки)
        const localSlot = (this.gridSize * this.gridSize - 1) - slotIndex;
        this.field[localSlot] = Object.assign(structuredClone(card), { maxHp: card.hp, isEnemy: true, isRevealed: false, hasMovedThisTurn: true });
        this.log(`Суперник зіграв карту (приховано)`);

        this.triggerUnitPlayedPassives(this.field[localSlot]);

        // Ефекти при виставленні для ворожих юнітів
        if (card.onPlayEffect) {
            this.handleOnPlayEffect(card.onPlayEffect, localSlot, true);
        }
    } else if (card.type === 'spell') {
        // Для заклять інвертуємо ціль, якщо вона на полі
        let localTarget = slotIndex;
        if (slotIndex >= 0) {
            localTarget = (this.gridSize * this.gridSize - 1) - slotIndex;
        } else {
            // Боси: -1 (ворожий бос для того хто атакує), -2 (власний бос)
            localTarget = (slotIndex === -1 ? -2 : -1);
        }
        this.applyEffect(card, localTarget, true, data.sourceIndex);
        this.log(`Суперник використав закляття ${card.name[window.currentLang]}`);
    }

    if (this.enemyHand.length > 0) {
        this.enemyHand.pop(); // Видаляємо карту з руки суперника
    }

    this.enemyMana -= card.mana;
    this.checkProximityReveal();
    this.updateUI();
},

remoteMoveUnit(data) {
    const { from, to } = data;
    const localFrom = (this.gridSize * this.gridSize - 1) - from;
    const localTo = (this.gridSize * this.gridSize - 1) - to;
    this.moveUnit(localFrom, localTo, true);
},

remoteAttack(data) {
    const { from, to } = data;
    const localFrom = (this.gridSize * this.gridSize - 1) - from;
    let localTo = to;
    if (to >= 0) {
        localTo = (this.gridSize * this.gridSize - 1) - to;
    } else {
        // Боси: -1 (ворожий бос для того хто атакує), -2 (власний бос)
        localTo = (to === -1 ? -2 : -1);
    }
    this.attack(localFrom, localTo, true);
}

}); // Object.assign(Game.prototype, ...)
