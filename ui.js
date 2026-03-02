// ========== UI.JS ==========
// Всі UI-утиліти гри: сповіщення, модалки, анімації, мова, інфо користувача.
// Залежності: translations.js, sound.js (SoundEngine), constants.js
// Підключається в index.html ПЕРЕД game.js, ПІСЛЯ translations.js

// ========== USER INFO ==========

// Функція оновлення інформації користувача.
// Кнопки зберігаються в окремому #user-action-btns —
// повністю перебудовується при кожному виклику: жодного дублювання навіть
// якщо батьківський контейнер очищується між викликами.
window.updateUserInfo = function () {
    const emailDisplay = document.getElementById('user-email-display');
    const goldDisplay  = document.getElementById('user-gold-display');
    const userInfoDiv  = document.getElementById('user-info-display');

    const currentUser = window.currentUser || (window.auth && window.auth.currentUser);

    if (currentUser) {
        if (userInfoDiv) {
            userInfoDiv.classList.remove('hidden');
            userInfoDiv.style.display    = 'flex';
            userInfoDiv.style.alignItems = 'center';
            userInfoDiv.style.gap        = '10px';

            // Виділений контейнер для кнопок дій.
            // Знаходимо або створюємо один раз, потім завжди очищуємо і перебудовуємо —
            // це гарантує ідемпотентність незалежно від стану батьківського DOM.
            let actionsDiv = document.getElementById('user-action-btns');
            if (!actionsDiv) {
                actionsDiv = document.createElement('div');
                actionsDiv.id = 'user-action-btns';
                actionsDiv.style.cssText = 'display:flex;gap:4px;align-items:center';
                userInfoDiv.appendChild(actionsDiv);
            }
            actionsDiv.innerHTML = '';   // завжди перебудовуємо — дублювання неможливе

            const mkBtn = (id, icon, title, onClick) => {
                const btn = document.createElement('button');
                btn.id        = id;
                btn.innerHTML = icon;
                btn.title     = title;
                btn.style.cssText = 'background:none;border:none;cursor:pointer;color:#ecf0f1;font-size:1.2em;padding:0 2px';
                btn.onclick   = onClick;
                return btn;
            };

            actionsDiv.appendChild(mkBtn('save-data-btn', '💾', 'Зберегти в хмару (Upload)', function () {
                this.style.transform = 'scale(0.9)';
                setTimeout(() => { this.style.transform = 'scale(1)'; }, 100);
                window.saveProgression();
            }));

            actionsDiv.appendChild(mkBtn('sync-data-btn', '🔄', 'Завантажити з хмари (Download)', function () {
                this.style.transition = 'transform 0.5s';
                this.style.transform  = 'rotate(360deg)';
                if (typeof window.loadProgress === 'function') window.loadProgress();
                setTimeout(() => { this.style.transform = 'rotate(0deg)'; }, 500);
            }));
        }
        if (emailDisplay) emailDisplay.textContent = currentUser.email;
        if (goldDisplay)  goldDisplay.textContent  = `💰 ${window.userGold}`;
    } else {
        if (userInfoDiv) {
            userInfoDiv.classList.add('hidden');
            userInfoDiv.style.display = 'none';
        }
    }

    // Update Stats UI
    const stats = window.userStats || { bot: { played: 0, won: 0, lost: 0 }, multiplayer: { played: 0, won: 0, lost: 0 } };

    const setStat = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setStat('stat-bot-played', stats.bot.played);
    setStat('stat-bot-won', stats.bot.won);
    setStat('stat-bot-lost', stats.bot.lost);

    setStat('stat-multi-played', stats.multiplayer.played);
    setStat('stat-multi-won', stats.multiplayer.won);
    setStat('stat-multi-lost', stats.multiplayer.lost);
};

// ========== ALERT MODAL ==========

function showAlert(title, message, isNewCard = false, cardData = null) {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('custom-modal-title');
    const modalBody = document.getElementById('custom-modal-body');
    const okBtn = document.getElementById('custom-modal-ok-btn');

    if (!modal || !modalTitle || !modalBody || !okBtn) {
        alert(message);
        return;
    }

    modalTitle.textContent = title;
    modalBody.innerHTML = '';

    const msgP = document.createElement('p');
    msgP.textContent = message;
    modalBody.appendChild(msgP);

    if (isNewCard && cardData) {
        const cardPreview = window.createSimpleCardEl(cardData);
        cardPreview.classList.add('new-card-preview');
        modalBody.appendChild(cardPreview);
    }

    okBtn.textContent = window.TRANSLATIONS[window.currentLang].ok;
    okBtn.onclick = () => {
        modal.classList.add('hidden');
    };

    modal.classList.remove('hidden');
}

window.showAlert = showAlert;

// ========== TOAST NOTIFICATION SYSTEM ==========

function showToast(message, type = 'info', icon = 'ℹ️', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `game-toast ${type}`;
    toast.innerHTML = `
        <span class="game-toast-icon">${icon}</span>
        <span class="game-toast-msg">${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 350);
    }, duration);
}
window.showToast = showToast;

// ========== STYLED CONFIRM MODAL ==========

function showConfirmModal(message, onConfirm, onCancel, icon = '⚠️') {
    // Remove existing confirm modal if present
    const existing = document.querySelector('.confirm-overlay');
    if (existing) existing.remove();

    const T = window.TRANSLATIONS[window.currentLang];
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-box">
            <div class="confirm-icon">${icon}</div>
            <div class="confirm-message">${message}</div>
            <div class="confirm-buttons">
                <button class="confirm-btn yes">${T.exitConfirmYes || 'Так'}</button>
                <button class="confirm-btn no">${T.exitConfirmNo || 'Ні'}</button>
            </div>
        </div>
    `;

    const yesBtn = overlay.querySelector('.confirm-btn.yes');
    const noBtn = overlay.querySelector('.confirm-btn.no');

    yesBtn.onclick = () => {
        overlay.remove();
        if (onConfirm) onConfirm();
    };
    noBtn.onclick = () => {
        overlay.remove();
        if (onCancel) onCancel();
    };

    document.body.appendChild(overlay);
    SoundEngine.play('click');
}
window.showConfirmModal = showConfirmModal;

// ========== CARD ANIMATION HELPERS ==========

function animateCardSlot(fieldIndex, animClass, duration = 500) {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) return;
    const slot = gridContainer.children[fieldIndex];
    if (!slot) return;
    const cardEl = slot.querySelector('.card');
    if (!cardEl) return;
    cardEl.classList.add(animClass);
    setTimeout(() => cardEl.classList.remove(animClass), duration);
}

function showSpellVisual(type, targetIdx, source = 'player') {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) return;
    const targetSlot = gridContainer.children[targetIdx];
    if (!targetSlot) return;

    const targetRect = targetSlot.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    if (type === 'fireball') {
        let sourceRect;
        if (source === 'player') {
            const avatar = document.querySelector('.player-avatar');
            sourceRect = avatar ? avatar.getBoundingClientRect() : { left: targetX, top: targetY + 200, width: 0, height: 0 };
        } else if (source === 'enemy') {
            const avatar = document.querySelector('.enemy-avatar');
            sourceRect = avatar ? avatar.getBoundingClientRect() : { left: targetX, top: targetY - 200, width: 0, height: 0 };
        } else if (typeof source === 'number' && gridContainer.children[source]) {
            sourceRect = gridContainer.children[source].getBoundingClientRect();
        } else {
            sourceRect = { left: targetX, top: targetY + 200, width: 0, height: 0 };
        }

        const startX = sourceRect.left + sourceRect.width / 2;
        const startY = sourceRect.top + sourceRect.height / 2;

        const projectile = document.createElement('div');
        projectile.className = 'spell-projectile';
        projectile.textContent = '☄️';
        projectile.style.left = `${startX}px`;
        projectile.style.top = `${startY}px`;

        const angle = Math.atan2(targetY - startY, targetX - startX) * 180 / Math.PI;
        projectile.style.transform = `translate(-50%, -50%) rotate(${angle + 45}deg)`;

        document.body.appendChild(projectile);

        // Force reflow
        projectile.getBoundingClientRect();

        projectile.style.left = `${targetX}px`;
        projectile.style.top = `${targetY}px`;

        setTimeout(() => {
            projectile.remove();

            const explosion = document.createElement('div');
            explosion.className = 'spell-explosion';
            explosion.textContent = '💥';
            explosion.style.left = `${targetX}px`;
            explosion.style.top = `${targetY}px`;
            document.body.appendChild(explosion);

            // Adding a red shake effect to the slot if not killed instantly
            animateCardSlot(targetIdx, 'taking-damage', 400);

            setTimeout(() => explosion.remove(), 400);
        }, 400); // 400ms matches the transition time in css
    } else if (type === 'heal_aura' || type === 'armor_aura') {
        const aura = document.createElement('div');
        aura.className = type === 'heal_aura' ? 'spell-heal-aura' : 'spell-armor-aura';

        targetSlot.style.position = 'relative';
        targetSlot.appendChild(aura);

        if (type === 'heal_aura') {
            setTimeout(() => showDamageFloat(targetIdx, '💚', 'heal'), 50);
        } else {
            setTimeout(() => showDamageFloat(targetIdx, '🛡️', 'armor'), 50);
        }

        setTimeout(() => aura.remove(), 800);
    }
}
window.showSpellVisual = showSpellVisual;

// ========== DAMAGE FLOAT ==========

function showDamageFloat(fieldIndex, text, type = '') {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) return;
    const slot = gridContainer.children[fieldIndex];
    if (!slot) return;
    slot.style.position = 'relative';
    const floater = document.createElement('div');
    floater.className = `damage-float ${type}`;
    floater.textContent = text;
    slot.appendChild(floater);
    setTimeout(() => floater.remove(), 900);
}
window.animateCardSlot = animateCardSlot;
window.showDamageFloat = showDamageFloat;

// ========== LANGUAGE SWITCHER ==========

window.setLanguage = function (lang) {
    window.currentLang = lang;
    localStorage.setItem('gameLang', lang);
    // Використовуємо більш надійний селектор, який шукає підрядок "lang-" у будь-якому місці атрибута class
    document.querySelectorAll('[class*="lang-"]').forEach(el => {
        const classList = Array.from(el.classList);
        const langClass = classList.find(c => c.startsWith('lang-'));
        if (langClass) {
            // Handle placeholders
            if (langClass.startsWith('lang-placeholder-')) {
                const key = langClass.replace('lang-placeholder-', '');
                const camelKey = key.replace(/-([a-z0-9])/g, g => g[1].toUpperCase());
                if (window.TRANSLATIONS[lang][camelKey]) {
                    el.placeholder = window.TRANSLATIONS[lang][camelKey];
                }
            }
            // Handle text content
            else {
                const key = langClass.replace('lang-', '');
                const camelKey = key.replace(/-([a-z0-9])/g, g => g[1].toUpperCase());
                if (window.TRANSLATIONS[lang][camelKey]) {
                    el.textContent = window.TRANSLATIONS[lang][camelKey];
                }
            }
        }
    });
    // Оновити активну кнопку мови
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('lang-' + (lang === 'uk' ? 'uk' : 'en'));
    if (activeBtn) activeBtn.classList.add('active');

    // Якщо гра вже запущена, оновити UI
    if (window.game) window.game.updateUI();
    // Оновити конструктор колоди, якщо він відкритий
    if (!document.getElementById('deck-builder').classList.contains('hidden')) window.initDeckBuilder();

    // Оновлення модального вікна авторизації
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        const mode = authModal.dataset.mode;
        const title = document.getElementById('auth-modal-title');
        const submitBtn = document.getElementById('auth-submit-btn');
        const closeBtn = document.getElementById('auth-modal-close-btn');
        const emailInput = document.getElementById('auth-email');
        const passInput = document.getElementById('auth-password');

        if (mode === 'login') {
            if (title) title.textContent = window.TRANSLATIONS[lang].login;
            if (submitBtn) submitBtn.textContent = window.TRANSLATIONS[lang].loginBtn;
        } else {
            if (title) title.textContent = window.TRANSLATIONS[lang].register;
            if (submitBtn) submitBtn.textContent = window.TRANSLATIONS[lang].registerBtn;
        }

        if (closeBtn) closeBtn.textContent = window.TRANSLATIONS[lang].cancel;
        if (emailInput) emailInput.placeholder = window.TRANSLATIONS[lang].emailPlaceholder;
        if (passInput) passInput.placeholder = window.TRANSLATIONS[lang].passwordPlaceholder;
    }
};
