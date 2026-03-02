// ========== SETTINGS.JS ==========
// Екран налаштувань.
// Залежності: sound.js, game.js (setDeviceMode, toggleFullscreen, setLanguage),
//             auth.js (logoutUser, openAuthModal), ui.js (showConfirmModal, showToast)

const GAME_VERSION = 'v8.4';

// ========== ВІДКРИТТЯ ЕКРАНУ ==========

window.openSettingsScreen = function () {
    window.showScreen?.('settings-screen');
    _syncAll();
};

function _syncAll() {
    _syncSound();
    _syncGameplay();
    _syncInterface();
    _syncAccount();
}

// ========== 🔊 ЗВУК ==========

function _syncSound() {
    const vol = Math.round((window.SoundEngine?.volume ?? 0.3) * 100);
    _setSlider('sett-vol-slider', 'sett-vol-val', vol, '%');

    const muted = window.SoundEngine?.muted ?? false;
    _setToggle('sett-sound-toggle', !muted);
}

window.settOnVolumeChange = function (val) {
    const v = parseInt(val) / 100;
    if (window.SoundEngine) {
        window.SoundEngine.volume = v;
        localStorage.setItem('soundVolume', v);
    }
    _setSliderVal('sett-vol-val', val, '%');
};

window.settOnSoundToggle = function (checked) {
    if (window.SoundEngine) {
        window.SoundEngine.muted = !checked;
        localStorage.setItem('soundMuted', String(!checked));
        const mainBtn = document.getElementById('sound-toggle');
        if (mainBtn) mainBtn.textContent = window.SoundEngine.muted ? '🔇' : '🔊';
    }
};

// ========== 🎮 ГЕЙМПЛЕЙ ==========

function _syncGameplay() {
    _setToggle('sett-anim-toggle',      localStorage.getItem('fastAnimations') !== 'true');
    _setToggle('sett-confirm-toggle',   localStorage.getItem('exitConfirmDisabled') !== 'true');
    _setToggle('sett-tips-toggle',      localStorage.getItem('hideTips') !== 'true');
    _setToggle('sett-cardshine-toggle', localStorage.getItem('noCardShine') !== 'true');
}

window.settOnAnimToggle = function (checked) {
    localStorage.setItem('fastAnimations', String(!checked));
    document.body.classList.toggle('fast-animations', !checked);
};

window.settOnConfirmToggle = function (checked) {
    localStorage.setItem('exitConfirmDisabled', String(!checked));
};

window.settOnTipsToggle = function (checked) {
    localStorage.setItem('hideTips', String(!checked));
    document.body.classList.toggle('hide-tips', !checked);
};

window.settOnCardShineToggle = function (checked) {
    localStorage.setItem('noCardShine', String(!checked));
    document.body.classList.toggle('no-card-shine', !checked);
};

// ========== 🖥️ ІНТЕРФЕЙС ==========

function _syncInterface() {
    // Мова
    const lang = window.currentLang || localStorage.getItem('gameLang') || 'uk';
    document.querySelectorAll('.sett-lang-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.lang === lang)
    );

    // Пристрій
    const mode = document.body.classList.contains('mobile-mode') ? 'mobile' : 'pc';
    document.querySelectorAll('.sett-device-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === mode)
    );
}

window.settSetLang = function (lang) {
    window.setLanguage?.(lang);
    document.querySelectorAll('.sett-lang-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.lang === lang)
    );
};

window.settSetDevice = function (mode) {
    window.setDeviceMode?.(mode);
    document.querySelectorAll('.sett-device-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === mode)
    );
};

window.settToggleFullscreen = function () {
    window.toggleFullscreen?.();
};

// ========== 👤 АКАУНТ ==========

function _syncAccount() {
    const logged = !!window.currentUser;
    _showRow('sett-row-login',      !logged);
    _showRow('sett-row-register',   !logged);
    _showRow('sett-row-logout',      logged);
    _showRow('sett-row-reset',       logged);
    _showRow('sett-row-changepass',  logged);
}

window.settOpenLogin    = () => { window.showScreen?.('main-menu'); setTimeout(() => window.openAuthModal?.('login'),    150); };
window.settOpenRegister = () => { window.showScreen?.('main-menu'); setTimeout(() => window.openAuthModal?.('register'), 150); };

window.settLogout = function () {
    const T = _T();
    window.showConfirmModal?.(
        T.logoutConfirm || 'Ви дійсно хочете вийти з акаунту?',
        () => { window.logoutUser?.(); window.showScreen?.('main-menu'); },
        null, '🚪'
    );
};

window.settResetProgress = function () {
    const T = _T();
    window.showConfirmModal?.(
        T.resetProgressConfirm || '⚠️ Скинути весь прогрес?\n\nЗолото, карти, статистика та досягнення будуть видалені. Дія незворотна!',
        () => {
            // localStorage
            ['userGold','unlockedCards','usedPromos','userDeck','userStats',
             'dailyQuestsProgress','campaignProgress','achievementsData','savedAt']
                .forEach(k => localStorage.removeItem(k));

            // Store
            const defaults = {
                userGold: 0,
                unlockedCards: new Set([1,2,3,4,5,6,7,8,9,10]),
                usedPromos: [],
                userDeck: [1,2,3,4,5,6,7,8,9,10],
                userStats: { bot:{played:0,won:0,lost:0}, multiplayer:{played:0,won:0,lost:0} },
                dailyQuestsProgress: window.createEmptyQuestProgress?.(),
                campaignProgress: { completed:[], current:0 }
            };
            window.Store?.setMany(defaults);

            // Досягнення
            if (window._achievementsData) {
                const emptyAch = {};
                (window.ACHIEVEMENTS_LIST || []).forEach(a => {
                    emptyAch[a.id] = { progress:0, unlocked:false, unlockedAt:null };
                });
                window._achievementsData = {
                    achievements: emptyAch,
                    stats: {
                        total_games:0, total_wins:0,
                        multiplayer_played:0, multiplayer_wins:0,
                        total_damage:0, units_destroyed:0, cards_played:0,
                        campaign_completed:0, gold_earned:0, cards_unlocked:0,
                        quests_completed:0, promos_used:0, bought_theme:0
                    }
                };
                localStorage.removeItem('achievementsData');
            }

            window.saveProgression?.();
            window.showToast?.(T.progressReset || 'Прогрес скинуто! 🔄', 'success', '✅');
            window.showScreen?.('main-menu');
        },
        null, '⚠️'
    );
};

window.settChangePassword = function () {
    const T = _T();
    const email = window.currentUser?.email;
    if (!email) return;

    window.showConfirmModal?.(
        (T.changePasswordConfirm || 'Надіслати лист для скидання пароля на') + '\n' + email + '?',
        async () => {
            try {
                const { auth } = await import('./firebase-config.js');
                const { sendPasswordResetEmail } = await import(
                    'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js'
                );
                await sendPasswordResetEmail(auth, email);
                window.showToast?.(T.passwordResetSent || 'Лист надіслано на ' + email, 'success', '✉️', 5000);
            } catch (e) {
                console.error('[settings] changePassword error:', e);
                window.showToast?.(T.errorTitle || 'Помилка', 'error', '❌');
            }
        },
        null, '🔑'
    );
};

// ========== HELPERS ==========

function _T() {
    return window.TRANSLATIONS?.[window.currentLang || 'uk'] || {};
}

function _setSlider(sliderId, valId, val, suffix) {
    const s = document.getElementById(sliderId);
    if (s) s.value = val;
    _setSliderVal(valId, val, suffix);
}

function _setSliderVal(valId, val, suffix) {
    const el = document.getElementById(valId);
    if (el) el.textContent = val + (suffix || '');
}

function _setToggle(id, checked) {
    const inp = document.getElementById(id);
    if (!inp) return;
    // Скидаємо inline-стилі, щоб CSS :checked міг працювати вільно
    const track = inp.nextElementSibling;
    const thumb = track?.nextElementSibling;
    if (track) { track.style.background=''; track.style.borderColor=''; track.style.boxShadow=''; }
    if (thumb) { thumb.style.transform=''; thumb.style.background=''; }
    inp.checked = checked;
}

function _showRow(id, visible) {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? 'flex' : 'none';
}

// ========== BIND ==========

document.addEventListener('DOMContentLoaded', () => {
    // Застосовуємо збережені налаштування
    if (localStorage.getItem('fastAnimations') === 'true') document.body.classList.add('fast-animations');
    if (localStorage.getItem('hideTips') === 'true') document.body.classList.add('hide-tips');
    if (localStorage.getItem('noCardShine') === 'true') document.body.classList.add('no-card-shine');
});
