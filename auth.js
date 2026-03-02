// ========== AUTH.JS ==========
// ES-модуль. Авторизація через Firebase Auth + хмарне збереження.
//
// ВИПРАВЛЕННЯ (Issue #3 — змішання модулів та скриптів):
//
//   1. Кнопки Register/Login блокуються під час запиту (disabled + loader)
//      щоб запобігти подвійному відправленню при швидкому подвійному кліку.
//
//   2. Всі функції перевіряють window.firebaseError перед викликом Firebase.
//      Якщо Firebase недоступний — одразу показується зрозуміле повідомлення
//      замість мовчазного падіння.
//
//   3. saveProgress / loadProgress чекають window.firebaseReady перш ніж
//      намагатися звернутися до Firestore — усуває race condition коли
//      не-модульний скрипт викликає saveProgress до того як модуль ініціалізувався.

import { auth, db } from "./firebase-config.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ========== HELPER: перевірка Firebase ==========

function _assertFirebase() {
    if (window.firebaseError || !auth || !db) {
        const T = window.TRANSLATIONS?.[window.currentLang || 'uk'] || {};
        window.showAlert?.(
            T.errorTitle || 'Помилка',
            T.firebaseUnavailable || 'Хмарний сервіс недоступний. Перевірте з\'єднання та спробуйте пізніше.'
        );
        return false;
    }
    return true;
}

// ========== HELPER: блокування кнопки під час запиту ==========

function _setButtonLoading(btnEl, isLoading, originalText) {
    if (!btnEl) return;
    btnEl.disabled = isLoading;
    btnEl.textContent = isLoading ? '⏳' : originalText;
}

// ==========================================
// UI Helper Functions
// ==========================================

window.updateAuthUI = function (isLoggedIn) {
    const loginBtn    = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn   = document.getElementById('logout-btn');
    if (isLoggedIn) {
        loginBtn?.classList.add('hidden');
        registerBtn?.classList.add('hidden');
        logoutBtn?.classList.remove('hidden');
    } else {
        loginBtn?.classList.remove('hidden');
        registerBtn?.classList.remove('hidden');
        logoutBtn?.classList.add('hidden');
    }
};

window.openAuthModal = function (mode) {
    const modal      = document.getElementById('auth-modal');
    const title      = document.getElementById('auth-modal-title');
    const submitBtn  = document.getElementById('auth-submit-btn');
    const closeBtn   = document.getElementById('auth-modal-close-btn');
    const emailInput = document.getElementById('auth-email');
    const passInput  = document.getElementById('auth-password');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.dataset.mode = mode;

    const lang = window.currentLang || 'uk';
    const T = window.TRANSLATIONS?.[lang];
    if (T) {
        if (title)      title.textContent      = mode === 'login' ? T.login    : T.register;
        if (submitBtn)  submitBtn.textContent  = mode === 'login' ? T.loginBtn : T.registerBtn;
        if (closeBtn)   closeBtn.textContent   = T.cancel;
        if (emailInput) emailInput.placeholder = T.emailPlaceholder;
        if (passInput)  passInput.placeholder  = T.passwordPlaceholder;
    }

    // Показуємо банер якщо Firebase недоступний
    const offlineBanner = modal.querySelector('.auth-offline-banner') || (() => {
        const b = document.createElement('div');
        b.className = 'auth-offline-banner';
        b.style.cssText = 'display:none;background:rgba(231,76,60,0.15);border:1px solid #e74c3c;border-radius:6px;padding:8px 12px;margin-bottom:12px;color:#e74c3c;font-size:0.85em;text-align:center;';
        modal.querySelector('.auth-form-body, .confirm-box, form')?.prepend(b);
        return b;
    })();

    if (window.firebaseError) {
        offlineBanner.textContent = '⚠️ Хмарний сервіс недоступний';
        offlineBanner.style.display = 'block';
        if (submitBtn) submitBtn.disabled = true;
    } else {
        offlineBanner.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
    }
};

window.closeAuthModal = function () {
    document.getElementById('auth-modal')?.classList.add('hidden');
};

// ==========================================
// Core Auth
// ==========================================

window.registerUser = function (email, password) {
    if (!_assertFirebase()) return;

    const submitBtn = document.getElementById('auth-submit-btn');
    const origText  = submitBtn?.textContent;
    _setButtonLoading(submitBtn, true, origText);

    createUserWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
            const user = userCredential.user;
            const userDocRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(userDocRef);
            if (!docSnap.exists()) {
                await setDoc(userDocRef, {
                    gold: 100,
                    unlockedCards: [1,2,3,4,5,6,7,8,9,10],
                    usedPromos: [],
                    userDeck: [1,2,3,4,5,6,7,8,9,10],
                    stats: { bot: { played:0, won:0, lost:0 }, multiplayer: { played:0, won:0, lost:0 } },
                    ownedEmojis:    ['👍','😮','😠','😂','😭','🤝'],
                    equippedEmojis: ['👍','😮','😠','😂','😭','🤝'],
                    dailyQuestsProgress: window.createEmptyQuestProgress?.() || window.dailyQuestsProgress,
                    campaignProgress: { completed: [], current: 0 },
                    email: email,
                    savedAt: Date.now(),
                    createdAt: serverTimestamp()
                });
            }
            window.closeAuthModal();
            const T = window.TRANSLATIONS?.[window.currentLang || 'uk'];
            window.showAlert?.(T?.alertTitle || 'Info', T?.registrationSuccess || 'Реєстрація успішна!');
            setTimeout(() => window.loadProgress?.(), 500);
        })
        .catch((error) => {
            const T = window.TRANSLATIONS?.[window.currentLang || 'uk'];
            window.showAlert?.(T?.errorTitle || 'Error', (T?.authError || 'Помилка') + ': ' + error.message);
        })
        .finally(() => {
            // Завжди розблоковуємо кнопку після завершення (успіх або помилка)
            _setButtonLoading(submitBtn, false, origText);
        });
};

window.loginUser = function (email, password) {
    if (!_assertFirebase()) return;

    const submitBtn = document.getElementById('auth-submit-btn');
    const origText  = submitBtn?.textContent;
    _setButtonLoading(submitBtn, true, origText);

    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            window.closeAuthModal();
            const T = window.TRANSLATIONS?.[window.currentLang || 'uk'];
            window.showAlert?.(T?.alertTitle || 'Info', T?.welcomeBack || 'Вхід виконано!');
            setTimeout(() => window.loadProgress?.(), 500);
        })
        .catch((error) => {
            const T = window.TRANSLATIONS?.[window.currentLang || 'uk'];
            window.showAlert?.(T?.errorTitle || 'Error', (T?.authError || 'Помилка') + ': ' + error.message);
        })
        .finally(() => {
            _setButtonLoading(submitBtn, false, origText);
        });
};

window.logoutUser = function () {
    if (!_assertFirebase()) return;

    signOut(auth)
        .then(() => {
            ['userGold','unlockedCards','usedPromos','userDeck','userStats',
             'dailyQuestsProgress','campaignProgress','savedAt'].forEach(k => localStorage.removeItem(k));

            const reset = {
                userGold: 0,
                unlockedCards: new Set([1,2,3,4,5,6,7,8,9,10]),
                usedPromos: [],
                userDeck: [1,2,3,4,5,6,7,8,9,10],
                userStats: { bot:{played:0,won:0,lost:0}, multiplayer:{played:0,won:0,lost:0} },
                ownedEmojis:    ['👍','😮','😠','😂','😭','🤝'],
                equippedEmojis: ['👍','😮','😠','😂','😭','🤝'],
                dailyQuestsProgress: window.createEmptyQuestProgress?.(),
                campaignProgress: { completed: [], current: 0 }
            };
            // Скидаємо через Store щоб підписники отримали сповіщення
            if (window.Store) {
                window.Store.setMany(reset);
            } else {
                Object.assign(window, reset);
            }
            window.currentUser = null;

            const T = window.TRANSLATIONS?.[window.currentLang || 'uk'];
            window.showAlert?.(T?.alertTitle || 'Info', T?.logoutSuccess || 'Ви вийшли з акаунту.');
            setTimeout(() => location.reload(), 500);
        })
        .catch(console.error);
};

window.handleAuthSubmit = function () {
    const modal    = document.getElementById('auth-modal');
    const email    = document.getElementById('auth-email')?.value?.trim();
    const password = document.getElementById('auth-password')?.value;
    const mode     = modal?.dataset.mode;

    if (!email || !password) {
        const T = window.TRANSLATIONS?.[window.currentLang || 'uk'];
        window.showAlert?.(T?.alertTitle || 'Info', T?.enterEmailPass || 'Введіть email та пароль!');
        return;
    }
    mode === 'login' ? window.loginUser(email, password) : window.registerUser(email, password);
};

// ==========================================
// Data Persistence — з версіонуванням
// ==========================================

/**
 * Зберігає прогрес у Firestore.
 *
 * ВИПРАВЛЕННЯ (Issue #3): чекаємо window.firebaseReady перш ніж звертатись
 * до Firestore. Це вирішує race condition коли не-модульний скрипт викликає
 * saveProgress() до того як цей модуль завершив ініціалізацію.
 */
window.saveProgress = async function () {
    // Чекаємо готовності Firebase (не блокуємо UI — це async)
    try {
        await window.firebaseReady;
    } catch {
        // Firebase не ініціалізовано — тихо ігноруємо, дані вже в localStorage
        if (window.DEBUG) console.log('[auth] saveProgress skipped — Firebase unavailable');
        return;
    }

    if (!auth?.currentUser) return;
    const user = auth.currentUser;

    const toArr = v => v instanceof Set ? Array.from(v) : (Array.isArray(v) ? v : []);

    const clientTimestamp = Date.now();

    const dataToSave = {
        gold:            Number(window.userGold) || 0,
        unlockedCards:   toArr(window.unlockedCards),
        usedPromos:      window.usedPromos || [],
        userDeck:        window.userDeck || [],
        stats:           window.userStats || { bot:{played:0,won:0,lost:0}, multiplayer:{played:0,won:0,lost:0} },

        selectedAvatar:    window.selectedAvatar    || '❤️',
        ownedAvatars:      toArr(window.ownedAvatars),
        selectedCardSkin:  window.selectedCardSkin  || 'default',
        ownedCardSkins:    toArr(window.ownedCardSkins),
        selectedMenuTheme: window.selectedMenuTheme || 'default',
        ownedMenuThemes:   toArr(window.ownedMenuThemes),

        ownedEmojis:    toArr(window.ownedEmojis)    || ['👍','😮','😠','😂','😭','🤝'],
        equippedEmojis: toArr(window.equippedEmojis) || ['👍','😮','😠','😂','😭','🤝'],

        dailyQuestsProgress: window.dailyQuestsProgress,
        campaignProgress:    window.campaignProgress || { completed:[], current:0 },
        achievementsData:    window._achievementsData || null,
        cardChallengesProgress: window.cardChallengesProgress || {},

        email:     user.email,
        savedAt:   clientTimestamp,
        updatedAt: serverTimestamp()
    };

    localStorage.setItem('savedAt', clientTimestamp.toString());

    setDoc(doc(db, 'users', user.uid), dataToSave, { merge: true })
        .then(() => {
            if (window.DEBUG) console.log('[auth] Progress saved to Firestore ☁️');
            const info = document.getElementById('user-info-display');
            if (info) {
                info.style.color = '#2ecc71';
                setTimeout(() => { info.style.color = ''; }, 1000);
            }
        })
        .catch(err => console.error('[auth] saveProgress error:', err));
};

/**
 * Завантажує прогрес з Firestore.
 * Також чекає firebaseReady перед зверненням до Firestore.
 */
window.loadProgress = async function () {
    try {
        await window.firebaseReady;
    } catch {
        if (window.DEBUG) console.log('[auth] loadProgress skipped — Firebase unavailable');
        return;
    }

    if (!auth?.currentUser) return;
    const user = auth.currentUser;

    getDoc(doc(db, 'users', user.uid))
        .then((docSnap) => {
            if (!docSnap.exists()) {
                console.warn('[auth] No cloud data — saving local to create document');
                window.saveProgress();
                return;
            }

            const cloud = docSnap.data();
            const cloudTs = typeof cloud.savedAt === 'number' ? cloud.savedAt : 0;
            const localTs = parseInt(localStorage.getItem('savedAt') || '0');

            const CONFLICT_THRESHOLD_MS = 5 * 60 * 1000;
            const diff = Math.abs(cloudTs - localTs);

            if (diff > CONFLICT_THRESHOLD_MS && localTs > 0 && cloudTs > 0) {
                _showConflictModal(cloudTs, localTs, cloud);
            } else if (cloudTs >= localTs) {
                _applyCloudData(cloud);
            } else {
                console.log('[auth] Local data is newer — uploading to cloud');
                window.saveProgress();
                _showSyncToast('local');
            }
        })
        .catch(err => console.error('[auth] loadProgress error:', err));
};

// ==========================================
// CONFLICT RESOLUTION
// ==========================================

function _showConflictModal(cloudTs, localTs, cloudData) {
    const cloudDate = new Date(cloudTs).toLocaleString();
    const localDate = new Date(localTs).toLocaleString();

    document.getElementById('_conflict-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = '_conflict-modal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.85);
        display:flex; align-items:center; justify-content:center;
        z-index:99999; font-family:Arial,sans-serif;
    `;
    modal.innerHTML = `
        <div style="background:#1a1a2e; border:2px solid #e74c3c; border-radius:12px;
                    padding:28px; max-width:380px; width:90%; color:#fff; text-align:center;">
            <div style="font-size:2.5em; margin-bottom:12px;">⚠️</div>
            <h3 style="color:#e74c3c; margin:0 0 12px;">Конфлікт збереження</h3>
            <p style="color:#aaa; font-size:0.85em; margin-bottom:18px; line-height:1.5;">
                Знайдено дві різні версії даних. Оберіть яку використати:
            </p>
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:18px;">
                <button id="_conflict-cloud" style="background:#2980b9; border:none; border-radius:8px;
                        color:#fff; padding:12px; cursor:pointer; font-size:0.95em;">
                    ☁️ Хмара<br>
                    <small style="opacity:0.75">${cloudDate}</small>
                </button>
                <button id="_conflict-local" style="background:#27ae60; border:none; border-radius:8px;
                        color:#fff; padding:12px; cursor:pointer; font-size:0.95em;">
                    💾 Цей пристрій<br>
                    <small style="opacity:0.75">${localDate}</small>
                </button>
            </div>
            <p style="color:#666; font-size:0.75em;">Незбережена версія буде втрачена</p>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('_conflict-cloud').onclick = () => {
        modal.remove();
        _applyCloudData(cloudData);
    };
    document.getElementById('_conflict-local').onclick = () => {
        modal.remove();
        window.saveProgress();
        _showSyncToast('local');
    };
}

// ==========================================
// APPLY CLOUD DATA
// ==========================================

function _applyCloudData(data) {
    if (window.DEBUG) console.log('[auth] Applying cloud data', data);

    // Використовуємо Store.setMany для синхронізації всіх підписників
    const applyViaStore = (key, val) => {
        if (window.Store) {
            window.Store.set(key, val);
        } else {
            window[key] = val;
        }
        try {
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(
                val instanceof Set ? Array.from(val) : val
            ));
        } catch (e) { console.warn(`[auth] localStorage write failed for "${key}":`, e); }
    };

    // Gold
    applyViaStore('userGold', Number(data.gold) || 0);

    // Cards
    let cards = Array.isArray(data.unlockedCards) ? data.unlockedCards : Object.values(data.unlockedCards || {});
    cards = cards.map(Number).filter(n => !isNaN(n) && n > 0);
    if (cards.length === 0) cards = [1,2,3,4,5,6,7,8,9,10];
    applyViaStore('unlockedCards', new Set(cards));

    // Deck
    if (data.userDeck) {
        let deck = Array.isArray(data.userDeck) ? data.userDeck : Object.values(data.userDeck);
        deck = deck.map(Number).filter(n => !isNaN(n) && n > 0);
        if (deck.length > 0) applyViaStore('userDeck', deck);
    }

    // Stats
    applyViaStore('userStats', data.stats || { bot:{played:0,won:0,lost:0}, multiplayer:{played:0,won:0,lost:0} });

    // Promos
    applyViaStore('usedPromos', Array.isArray(data.usedPromos) ? data.usedPromos : []);

    // Customization
    ['selectedAvatar','selectedCardSkin','selectedMenuTheme'].forEach(k => {
        if (data[k]) applyViaStore(k, data[k]);
    });
    const customSets = { ownedAvatars:'ownedAvatars', ownedCardSkins:'ownedCardSkins', ownedMenuThemes:'ownedMenuThemes' };
    Object.entries(customSets).forEach(([cloudKey, storeKey]) => {
        if (Array.isArray(data[cloudKey])) applyViaStore(storeKey, new Set(data[cloudKey]));
    });

    // Emojis
    if (Array.isArray(data.ownedEmojis))    applyViaStore('ownedEmojis',    data.ownedEmojis);
    if (Array.isArray(data.equippedEmojis)) applyViaStore('equippedEmojis', data.equippedEmojis);

    // Quests
    if (data.dailyQuestsProgress) {
        applyViaStore('dailyQuestsProgress', data.dailyQuestsProgress);
        window.checkDailyQuestsReset?.();
        window.renderDailyQuests?.();
    }

    // Campaign
    if (data.campaignProgress) {
        const cp = data.campaignProgress;
        if (!Array.isArray(cp.completed)) cp.completed = [];
        applyViaStore('campaignProgress', cp);
        window.renderCampaignMap?.();
    }

    // Achievements
    if (data.achievementsData) {
        window.loadAchievementsFromCloud?.(data.achievementsData);
    }

    // Card Challenges
    if (data.cardChallengesProgress && typeof data.cardChallengesProgress === 'object') {
        window.cardChallengesProgress = data.cardChallengesProgress;
        try {
            localStorage.setItem('cardChallengesProgress', JSON.stringify(data.cardChallengesProgress));
        } catch {}
    }

    if (typeof data.savedAt === 'number') {
        localStorage.setItem('savedAt', data.savedAt.toString());
    }

    window.renderEmojiNav?.();
    window.applyMenuTheme?.();
    window.updateUserInfo?.();
    window.updateDeckBuilderUI?.();

    _showSyncToast('cloud');
}

function _showSyncToast(source) {
    const msg = source === 'cloud'
        ? `☁️ Дані завантажено з хмари (${window.userGold} 💰, ${window.unlockedCards?.size || 0} 🃏)`
        : `💾 Локальні дані збережено в хмару`;

    if (typeof window.showToast === 'function') {
        window.showToast(msg, 'success', source === 'cloud' ? '☁️' : '💾', 4000);
    } else {
        const toast = document.createElement('div');
        toast.textContent = msg;
        Object.assign(toast.style, {
            position:'fixed', bottom:'20px', right:'20px',
            background:'rgba(46,204,113,0.9)', color:'#fff',
            padding:'10px 20px', borderRadius:'8px',
            zIndex:'99998', transition:'opacity 0.5s'
        });
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity='0'; setTimeout(() => toast.remove(), 500); }, 3000);
    }
}

// ==========================================
// Auth State Observer
// ==========================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (window.DEBUG) console.log('[auth] User logged in:', user.uid);
        window.auth = auth;
        window.currentUser = user;
        window.updateAuthUI?.(true);
        window.loadProgress?.();
    } else {
        if (window.DEBUG) console.log('[auth] User logged out');
        window.currentUser = null;
        window.updateAuthUI?.(false);
        window.updateUserInfo?.();
    }
});

// ==========================================
// DOM Listeners
// ==========================================

function initAuthListeners() {
    document.getElementById('login-btn')?.addEventListener('click', () => window.openAuthModal('login'));
    document.getElementById('register-btn')?.addEventListener('click', () => window.openAuthModal('register'));
    document.getElementById('logout-btn')?.addEventListener('click', window.logoutUser);
    document.getElementById('auth-submit-btn')?.addEventListener('click', window.handleAuthSubmit);
    document.getElementById('auth-modal-close-btn')?.addEventListener('click', window.closeAuthModal);

    // Enter в полях форми
    ['auth-email', 'auth-password'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', e => {
            if (e.key === 'Enter') window.handleAuthSubmit();
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthListeners);
} else {
    initAuthListeners();
}
