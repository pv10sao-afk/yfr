// ========== DRAFT.JS ==========
// Система Драфту: startDraft, renderDraftRound, draftPickCard, finishDraft.
// Залежності:
//   - cards.js        (window.CARD_DATABASE, window.createSimpleCardEl)
//   - translations.js (window.TRANSLATIONS, window.currentLang)
//   - sound.js        (window.SoundEngine)
//   - game.js         (window.showScreen, window.startGame, window.conn)
//
// ВИПРАВЛЕННЯ:
//   1. Fisher-Yates shuffle замість splice() — рівномірний розподіл
//   2. Race condition у finishDraft() — обидва гравці тепер коректно стартують

// ========== DRAFT STATE ==========
window.draftState = null;
window.opponentDraftReady = false;

// ========== UTILS ==========

/**
 * Fisher-Yates shuffle — не мутує оригінал, рівномірний розподіл.
 * @param {Array} arr
 * @returns {Array} перемішана копія
 */
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ========== START DRAFT ==========

function startDraft(gridSize, isMultiplayer, isAntiDraft = false) {
    window.opponentDraftReady = false;
    window.draftState = {
        cards: [],
        round: 0,
        maxRounds: 10,
        gridSize: gridSize,
        isMultiplayer: isMultiplayer,
        isAntiDraft: isAntiDraft,
        finished: false,
        picking: false
    };

    window.showScreen('draft-screen');
    document.getElementById('draft-picked-list').innerHTML = '';
    document.getElementById('draft-choices').innerHTML = '';

    const T = window.TRANSLATIONS[window.currentLang];
    const titleEl = document.querySelector('.lang-draft-title');
    if (titleEl) {
        titleEl.textContent = isAntiDraft
            ? window.TRANSLATIONS[window.currentLang].modeAntidraft
            : T.draftTitle;
    }

    const roundLabel = document.querySelector('.lang-draft-round');
    if (roundLabel) roundLabel.textContent = T.draftRound;
    const pickedLabel = document.querySelector('.lang-draft-picked');
    if (pickedLabel) pickedLabel.textContent = T.draftPicked;
    document.getElementById('draft-round-max').textContent = window.draftState.maxRounds;

    renderDraftRound();
}
window.startDraft = startDraft;

// ========== RENDER DRAFT ROUND ==========

function renderDraftRound() {
    const state = window.draftState;
    if (!state) return;

    state.picking = false;
    state.round++;
    document.getElementById('draft-round-num').textContent = state.round;

    const choicesEl = document.getElementById('draft-choices');
    choicesEl.innerHTML = '';

    const CARD_DATABASE = window.CARD_DATABASE;

    // Рахуємо рідкості вже обраних карт
    const draftDeckCards = state.cards.map(id => CARD_DATABASE.find(c => c.id === id)).filter(Boolean);
    const rarityCounts = {
        legendary: draftDeckCards.filter(c => c.rarity === 'legendary').length,
        epic:      draftDeckCards.filter(c => c.rarity === 'epic').length,
        rare:      draftDeckCards.filter(c => c.rarity === 'rare').length,
        common:    draftDeckCards.filter(c => c.rarity === 'common').length
    };

    // Ключ кешу — рядок лімітів рідкостей, унікально ідентифікує набір правил фільтрації.
    // Якщо ліміти не змінились з минулого раунду — повторно фільтрувати не потрібно.
    const cacheKey = `${rarityCounts.legendary}:${rarityCounts.epic}:${rarityCounts.rare}`;
    if (!state._eligibleCache || state._eligibleCacheKey !== cacheKey) {
        state._eligibleCache = CARD_DATABASE.filter(card => {
            if (card.rarity === 'legendary' && rarityCounts.legendary >= 1) return false;
            if (card.rarity === 'epic'      && rarityCounts.epic      >= 3) return false;
            if (card.rarity === 'rare'      && rarityCounts.rare      >= 5) return false;
            return true;
        });
        state._eligibleCacheKey = cacheKey;
    }
    const eligible = state._eligibleCache;

    // Fisher-Yates shuffle + беремо перші 3
    // Не мутуємо оригінальний масив eligible
    const shuffled = shuffleArray(eligible);
    const choices = shuffled.slice(0, 3);

    choices.forEach(card => {
        const cardEl = window.createSimpleCardEl(card);
        cardEl.classList.add('draft-choice-card');
        cardEl.onclick = () => draftPickCard(card, cardEl);
        choicesEl.appendChild(cardEl);
    });
}
window.renderDraftRound = renderDraftRound;

// ========== DRAFT PICK CARD ==========

function draftPickCard(card, cardEl) {
    const state = window.draftState;
    if (!state || state.picking) return;
    state.picking = true;

    window.SoundEngine.play('click');
    cardEl.classList.add('draft-picked-anim');

    state.cards.push(card.id);

    // Відображаємо мінікарту у списку обраних
    const pickedList = document.getElementById('draft-picked-list');
    const miniCard = document.createElement('div');
    miniCard.className = `draft-mini-card rarity-${card.rarity || 'common'}`;
    miniCard.textContent = card.name[window.currentLang];
    miniCard.title = card.name[window.currentLang];
    pickedList.appendChild(miniCard);

    if (state.round >= state.maxRounds) {
        state.finished = true;
        setTimeout(() => finishDraft(), 500);
    } else {
        setTimeout(() => renderDraftRound(), 400);
    }
}
window.draftPickCard = draftPickCard;

// ========== FINISH DRAFT ==========

function finishDraft() {
    const state = window.draftState;
    if (!state) return;

    if (state.isMultiplayer) {
        // Повідомляємо опонента що ми готові
        const conn = window.conn;
        if (conn && conn.open) {
            conn.send({ type: 'DRAFT_READY', deck: state.cards, isAntiDraft: state.isAntiDraft });
        }

        if (window.opponentDraftReady) {
            // Обидва готові — стартуємо гру
            // Захист від подвійного запуску (якщо _onOpponentDraftReady вже спрацював)
            if (state._gameStarted) return;
            state._gameStarted = true;

            const deckToUse = state.isAntiDraft ? window.opponentDraftDeck : state.cards;
            window.startGame(state.gridSize, true, false, deckToUse);
        } else {
            // Чекаємо на опонента
            const T = window.TRANSLATIONS[window.currentLang];
            const choicesEl = document.getElementById('draft-choices');
            choicesEl.innerHTML = `
                <div class="draft-waiting">
                    <div class="loader"></div>
                    <p>${T.draftReady}</p>
                </div>
            `;
            // Коли прийде DRAFT_READY від опонента, game.js викличе
            // window._onOpponentDraftReady() — і та функція запустить гру,
            // бо state.finished вже буде true.
        }
    } else {
        // Соло: стартуємо з драфтовою колодою
        window.isAntiDraftGame = state.isAntiDraft;
        window.startGame(state.gridSize, false, false, state.cards);
    }
}
window.finishDraft = finishDraft;

// ========== ОБРОБНИК DRAFT_READY ВІД ОПОНЕНТА ==========
// Викликається з game.js коли приходить повідомлення DRAFT_READY від опонента.
// Є єдиною точкою логіки — game.js не дублює її, просто делегує сюди.
//
// Сценарії:
//   A) Опонент фінішував РАНІШЕ нас  → ставимо прапор, чекаємо finishDraft()
//   B) Опонент фінішував ПІЗНІШЕ нас → state.finished вже true, одразу стартуємо

window._onOpponentDraftReady = function (opponentDeck) {
    window.opponentDraftReady = true;
    window.opponentDraftDeck = opponentDeck;

    const state = window.draftState;
    if (!state || !state.finished) return; // Сценарій A — чекаємо

    // Сценарій B — ми вже закінчили, стартуємо гру
    // Захист від подвійного запуску (якщо finishDraft вже запустив startGame)
    if (state._gameStarted) return;
    state._gameStarted = true;

    const deckToUse = state.isAntiDraft ? opponentDeck : state.cards;
    window.startGame(state.gridSize, true, false, deckToUse);
};
