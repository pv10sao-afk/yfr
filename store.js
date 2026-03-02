// ========== STORE.JS ==========
// Централізований стан гри. Замінює розкидані window.* глобальні змінні.
// Підключати в index.html ПЕРШИМ, перед constants.js та progression.js.
//
// API:
//   Store.set('userGold', 100)           → зберігає в Store._state І window.userGold
//   Store.get('userGold')                → читає з Store._state
//   Store.update('userGold', n => n + 5) → атомарне оновлення (не мутує window напряму)
//   Store.push('userDeck', cardId)       → безпечний push в масив
//   Store.remove('userDeck', id)         → видалення елементу з масиву за значенням
//   Store.removeAt('userDeck', index)    → видалення елементу з масиву за індексом
//   window.userGold                      → все ще працює (backward compat)

const Store = (() => {
    // ========== PRIVATE STATE ==========
    const _state = {};

    // ========== LISTENERS ==========
    const _listeners = {};

    // ========== PUBLIC API ==========
    const store = {

        /**
         * Встановити значення.
         * Автоматично синхронізує з window.* для backward compatibility.
         */
        set(key, value) {
            _state[key] = value;
            window[key] = value;

            if (_listeners[key]) {
                _listeners[key].forEach(fn => {
                    try { fn(value); } catch (e) { console.error(`Store listener error [${key}]:`, e); }
                });
            }
            return value;
        },

        /**
         * Отримати значення.
         */
        get(key) {
            return _state[key];
        },

        /**
         * Атомарне оновлення через функцію-трансформер.
         * Єдиний правильний спосіб змінювати числа та примітиви.
         *
         * Замість:  window.userGold += 50          ← мутує window напряму
         * Писати:   Store.update('userGold', n => n + 50)  ← через Store
         *
         * @param {string} key
         * @param {Function} updater — отримує поточне значення, повертає нове
         */
        update(key, updater) {
            const current = _state[key];
            const next = updater(current);
            return this.set(key, next);
        },

        /**
         * Безпечний push в масив.
         * Створює новий масив (не мутує _state напряму), потім викликає set().
         * Сповіщає підписників.
         *
         * Замість:  window.userDeck.push(id)       ← Store не знає про зміну
         * Писати:   Store.push('userDeck', id)
         */
        push(key, value) {
            const arr = _state[key];
            if (!Array.isArray(arr)) {
                console.warn(`[Store] push: "${key}" is not an array`);
                return;
            }
            return this.set(key, [...arr, value]);
        },

        /**
         * Видалення першого входження значення з масиву.
         *
         * Замість:  const idx = window.userDeck.indexOf(id); window.userDeck.splice(idx,1)
         * Писати:   Store.remove('userDeck', id)
         */
        remove(key, value) {
            const arr = _state[key];
            if (!Array.isArray(arr)) {
                console.warn(`[Store] remove: "${key}" is not an array`);
                return;
            }
            const idx = arr.indexOf(value);
            if (idx === -1) return;
            return this.set(key, arr.filter((_, i) => i !== idx));
        },

        /**
         * Видалення елементу масиву за індексом.
         *
         * Замість:  window.userDeck.splice(index, 1)
         * Писати:   Store.removeAt('userDeck', index)
         */
        removeAt(key, index) {
            const arr = _state[key];
            if (!Array.isArray(arr)) {
                console.warn(`[Store] removeAt: "${key}" is not an array`);
                return;
            }
            return this.set(key, arr.filter((_, i) => i !== index));
        },

        /**
         * Додати елемент до Set.
         * Замість:  window.unlockedCards.add(id)
         * Писати:   Store.addToSet('unlockedCards', id)
         */
        addToSet(key, value) {
            const s = _state[key];
            if (!(s instanceof Set)) {
                console.warn(`[Store] addToSet: "${key}" is not a Set`);
                return;
            }
            const next = new Set(s);
            next.add(value);
            return this.set(key, next);
        },

        /**
         * Ініціалізувати ключ зі значенням (якщо вже є — не перезаписує).
         */
        init(key, value) {
            if (_state[key] === undefined) {
                this.set(key, value);
            }
            return _state[key];
        },

        /**
         * Отримати копію всього стану (для збереження).
         */
        getAll() {
            return { ..._state };
        },

        /**
         * Оновити одразу кілька ключів.
         */
        setMany(obj) {
            Object.entries(obj).forEach(([k, v]) => this.set(k, v));
        },

        /**
         * Підписатись на зміну конкретного ключа.
         * Повертає функцію для відписки.
         */
        onChange(key, fn) {
            if (!_listeners[key]) _listeners[key] = [];
            _listeners[key].push(fn);
            return () => {
                _listeners[key] = _listeners[key].filter(f => f !== fn);
            };
        },

        /**
         * Перевірити чи ключ ініціалізований.
         */
        has(key) {
            return _state[key] !== undefined;
        },

        /**
         * Скинути ключ (видалити зі стору та window).
         */
        delete(key) {
            delete _state[key];
            delete window[key];
        },

        /**
         * DEBUG: вивести поточний стан у консоль.
         */
        debug() {
            console.table(
                Object.fromEntries(
                    Object.entries(_state).map(([k, v]) => [
                        k,
                        v instanceof Set ? `Set(${v.size})` :
                        Array.isArray(v) ? `Array(${v.length})` :
                        typeof v === 'object' && v !== null ? `{...}` :
                        v
                    ])
                )
            );
        }
    };

    return store;
})();

window.Store = Store;

// ========== ЗВОРОТНЯ СУМІСНІСТЬ ==========
// Store.set() вже пише в window[key] напряму — цього достатньо.
// Якщо якісь значення вже були у window до завантаження store.js — переносимо їх.

const SYNCED_KEYS = [
    'userGold', 'userDeck', 'unlockedCards', 'userStats',
    'selectedAvatar', 'selectedCardSkin', 'selectedMenuTheme',
    'currentLang', 'campaignProgress', 'dailyQuestsProgress'
];

SYNCED_KEYS.forEach(key => {
    if (window[key] !== undefined) {
        Store.set(key, window[key]);
    }
});
