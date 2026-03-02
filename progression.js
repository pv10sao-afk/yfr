// ========== PROGRESSION.JS ==========
// Весь стан прогресу гравця: ініціалізація, збереження, завантаження.
// Залежності: store.js (Store), constants.js (DAILY_QUESTS, MAX_DECK_SIZE)
// Підключається в index.html: store.js → constants.js → progression.js

// ========== HELPER: порожній прогрес квестів ==========
// Винесено окремо щоб уникнути дублювання між progression.js і quests.js

function createEmptyQuestProgress() {
    return {
        date: new Date().toISOString().split('T')[0],
        quests: Object.fromEntries(
            (window.DAILY_QUESTS || []).map(q => [q.id, { progress: 0, claimed: false }])
        )
    };
}
window.createEmptyQuestProgress = createEmptyQuestProgress;

// ========== HELPER: безпечний JSON.parse ==========

function safeParse(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw) ?? fallback;
    } catch (e) {
        console.warn(`[progression] Failed to parse localStorage["${key}"]`, e);
        return fallback;
    }
}

// ========== ІНІЦІАЛІЗАЦІЯ ЧЕРЕЗ STORE ==========

// Якщо DAILY_QUESTS ще не визначено (constants.js не завантажено) —
// Store запишемо після завантаження в DOMContentLoaded.
// Але для більшості сценаріїв constants.js вже завантажений раніше.

function _initProgression() {
    const defaultDeck = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // Завантаження і валідація колоди: фільтруємо ID яких немає в CARD_DATABASE
    let rawDeck = safeParse('userDeck', defaultDeck);
    if (window.CARD_DATABASE) {
        const validIds = new Set(window.CARD_DATABASE.map(c => c.id));
        rawDeck = rawDeck.filter(id => validIds.has(id));
    }

    // Статистика — з валідацією структури
    const defaultStats = { bot: { played: 0, won: 0, lost: 0 }, multiplayer: { played: 0, won: 0, lost: 0 } };
    let savedStats = safeParse('userStats', defaultStats);
    if (!savedStats || typeof savedStats !== 'object' || !savedStats.bot) {
        savedStats = defaultStats;
    }

    // Промо-коди
    let savedPromos = safeParse('usedPromos', []);
    if (!Array.isArray(savedPromos)) savedPromos = [];

    // Щоденні квести
    let dailyProgress = safeParse('dailyQuestsProgress', null);
    if (!dailyProgress || typeof dailyProgress !== 'object' || !dailyProgress.quests) {
        dailyProgress = createEmptyQuestProgress();
    }

    // Аватари, скіни, теми
    let ownedAvatars  = new Set(safeParse('ownedAvatars',      ['❤️']));
    let ownedSkins    = new Set(safeParse('ownedCardSkins',    ['default']));
    let ownedThemes   = new Set(safeParse('ownedMenuThemes',   ['default']));
    let ownedBoards   = new Set(safeParse('ownedBoardSkins',   ['default']));
    let unlockedCards = new Set(safeParse('unlockedCards',     defaultDeck));

    // ===== Завантаження в Store =====
    Store.setMany({
        userDeck:           rawDeck,
        unlockedCards:      unlockedCards,
        userGold:           parseInt(safeParse('userGold', 0)) || 0,
        usedPromos:         savedPromos,
        userStats:          savedStats,

        selectedAvatar:     localStorage.getItem('selectedAvatar')    || '❤️',
        ownedAvatars:       ownedAvatars,

        selectedCardSkin:   localStorage.getItem('selectedCardSkin')  || 'default',
        ownedCardSkins:     ownedSkins,

        selectedMenuTheme:  localStorage.getItem('selectedMenuTheme') || 'default',
        ownedMenuThemes:    ownedThemes,

        selectedBoardSkin:  localStorage.getItem('selectedBoardSkin') || 'default',
        ownedBoardSkins:    ownedBoards,

        dailyQuestsProgress: dailyProgress,
        currentLang:        localStorage.getItem('gameLang') || 'uk',
        campaignProgress:   safeParse('campaignProgress', { completed: [], current: 0 }),
    });

    // Card Challenges progress — окремо, не через Store (великий об'єкт)
    window.cardChallengesProgress = safeParse('cardChallengesProgress', {});
}

// Запускаємо ініціалізацію одразу
_initProgression();

// ========== SAVE PROGRESSION ==========
// Debounce 400ms: кілька синхронних викликів saveProgression() (наприклад,
// додавання карти у колоду) → лише один реальний запис у localStorage/хмару.

let _saveProgressionTimer = null;

window.saveProgression = function () {
    // Скасовуємо попередній відкладений виклик і плануємо новий
    clearTimeout(_saveProgressionTimer);
    _saveProgressionTimer = setTimeout(_flushSaveProgression, 400);
};

// Реальна логіка збереження — викликається через debounce
function _flushSaveProgression() {
    if (window.DEBUG) console.log('[progression] saveProgression called');

    // Санітізуємо золото
    const gold = parseInt(Store.get('userGold')) || 0;
    Store.set('userGold', gold);

    // Зберігаємо Set як Array
    const toArray = val => val instanceof Set ? Array.from(val) : val;

    const data = {
        userGold:            gold,
        unlockedCards:       toArray(Store.get('unlockedCards')),
        userDeck:            Store.get('userDeck'),
        usedPromos:          Store.get('usedPromos'),
        userStats:           Store.get('userStats'),
        selectedAvatar:      Store.get('selectedAvatar'),
        ownedAvatars:        toArray(Store.get('ownedAvatars')),
        selectedCardSkin:    Store.get('selectedCardSkin'),
        ownedCardSkins:      toArray(Store.get('ownedCardSkins')),
        selectedMenuTheme:   Store.get('selectedMenuTheme'),
        ownedMenuThemes:     toArray(Store.get('ownedMenuThemes')),
        selectedBoardSkin:   Store.get('selectedBoardSkin'),
        ownedBoardSkins:     toArray(Store.get('ownedBoardSkins')),
        dailyQuestsProgress: Store.get('dailyQuestsProgress'),
    };

    // Пишемо в localStorage
    Object.entries(data).forEach(([key, val]) => {
        try {
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
        } catch (e) {
            console.error(`[progression] Failed to save "${key}":`, e);
        }
    });

    // Зберігаємо мову окремо (рядок)
    localStorage.setItem('gameLang', Store.get('currentLang') || 'uk');

    // Card Challenges — зберігаємо окремо (не через Store)
    if (window.cardChallengesProgress) {
        try {
            localStorage.setItem('cardChallengesProgress', JSON.stringify(window.cardChallengesProgress));
        } catch (e) {
            console.error('[progression] Failed to save cardChallengesProgress:', e);
        }
    }

    // Cloud Save якщо залогінений
    if (typeof window.saveProgress === 'function') {
        window.saveProgress();
    } else if (window.currentUser) {
        console.warn('[progression] window.saveProgress is not defined — cloud save skipped');
    }

    // Оновити UI
    if (typeof window.updateUserInfo === 'function') {
        window.updateUserInfo();
    }
}

// ========== CLIPBOARD UTILITY ==========

window.copyToClipboard = function (elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const text = element.innerText;

    const onSuccess = () => {
        element.style.backgroundColor = 'rgba(46, 204, 113, 0.5)';
        setTimeout(() => { element.style.backgroundColor = ''; }, 500);
        const btn = element.nextElementSibling;
        if (btn?.classList.contains('copy-btn')) {
            const orig = btn.innerHTML;
            btn.innerHTML = '✅';
            setTimeout(() => { btn.innerHTML = orig; }, 1000);
        }
    };

    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(onSuccess).catch(() => _fallbackCopy(element, onSuccess));
    } else {
        _fallbackCopy(element, onSuccess);
    }
};

function _fallbackCopy(element, onSuccess) {
    try {
        const range = document.createRange();
        range.selectNode(element);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
        onSuccess();
    } catch (e) {
        alert('Не вдалося скопіювати код. Будь ласка, виділіть текст і скопіюйте вручну.');
    }
}
