// ========== SHOP.JS ==========
// Магазин: паки, аватари, скіни карт, скіни поля, теми меню, емодзі.
// Залежності: constants.js, progression.js, translations.js, ui.js, sound.js, cards.js

let currentShopTab = 'packs';

// ========== HELPERS ==========

const RARITY_NAMES = {
    uk: { common: 'Звичайна', rare: 'Рідкісна', epic: 'Епічна', legendary: 'Легендарна' },
    en: { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' },
};

function _T() { return window.TRANSLATIONS?.[window.currentLang] || {}; }
function _lang() { return window.currentLang || 'uk'; }

function _makeCard({ rarity = 'common', equipped = false, owned = false, previewHtml = '',
    name = '', rarityLabel = '', btnHtml = '', badgeHtml = '', cardPreview = false } = {}) {
    const el = document.createElement('div');
    el.className = `s-card rarity-${rarity}${equipped ? ' s-equipped' : ''}${owned ? ' s-owned' : ''}`;
    const previewCls = cardPreview ? 's-preview s-preview-card' : 's-preview';
    el.innerHTML = `
        <div class="s-rarity-bar"></div>
        ${badgeHtml}
        ${equipped ? '<div class="s-check">✓</div>' : ''}
        <div class="${previewCls}">${previewHtml}</div>
        <div class="s-name">${name}</div>
        <div class="s-rarity-label">${rarityLabel}</div>
        ${btnHtml}
    `;
    return el;
}

function _btn(cls, text) {
    return `<button class="s-btn ${cls}">${text}</button>`;
}

// ========== INIT ==========

function initShopScreen() {
    const container = document.getElementById('shop-container');
    const goldDisplay = document.getElementById('shop-gold');
    const tabsEl = document.getElementById('shop-tabs');
    if (!container) return;

    const T = _T();
    const lang = _lang();

    if (goldDisplay) {
        goldDisplay.className = 'shop-gold-pill';
        goldDisplay.innerHTML = `<span>💰</span> ${window.userGold ?? 0}`;
    }

    if (tabsEl) {
        tabsEl.innerHTML = '';
        const tabs = [
            { key: 'packs', label: T.shopTabPacks || '📦 Паки' },
            { key: 'avatars', label: T.shopTabAvatars || '😊 Аватари' },
            { key: 'skins', label: T.shopTabSkins || '🎨 Дизайни' },
            { key: 'board', label: T.shopTabBoard || '🗺️ Поле' },
            { key: 'themes', label: T.shopTabThemes || '✨ Теми' },
            { key: 'emojis', label: T.shopTabEmojis || '💬 Емодзі' },
        ];
        tabs.forEach(({ key, label }) => {
            const btn = document.createElement('button');
            btn.className = 'shop-tab' + (key === currentShopTab ? ' active' : '');
            btn.textContent = label;
            btn.onclick = () => { currentShopTab = key; initShopScreen(); };
            tabsEl.appendChild(btn);
        });
    }

    container.innerHTML = '';
    container.className = 'shop-container s-grid';

    if (currentShopTab === 'packs') renderPacksTab(container, T, lang);
    else if (currentShopTab === 'avatars') renderAvatarsTab(container, T, lang);
    else if (currentShopTab === 'skins') renderSkinsTab(container, T, lang);
    else if (currentShopTab === 'board') renderBoardTab(container, T, lang);
    else if (currentShopTab === 'themes') renderThemesTab(container, T, lang);
    else if (currentShopTab === 'emojis') renderEmojisTab(container, T, lang);
}
window.initShopScreen = initShopScreen;

// ========== PACKS ==========

function renderPacksTab(container, T, lang) {
    container.className = 'shop-container s-grid s-grid-packs';
    const packs = [
        { tier: 'bronze', name: T.shopBronze || 'Бронзовий пак', desc: T.shopBronzeDesc || '1 карта · мін. Звичайна', price: 50, icon: '📦', guaranteed: 'common' },
        { tier: 'silver', name: T.shopSilver || 'Срібний пак', desc: T.shopSilverDesc || '1 карта · мін. Рідкісна', price: 150, icon: '🎁', guaranteed: 'rare' },
        { tier: 'gold-pack', name: T.shopGold || 'Золотий пак', desc: T.shopGoldDesc || '1 карта · мін. Епічна', price: 300, icon: '👑', guaranteed: 'epic' },
    ];
    packs.forEach(pack => {
        const el = document.createElement('div');
        el.className = `s-pack-card ${pack.tier}`;
        el.innerHTML = `
            <div class="s-pack-icon">${pack.icon}</div>
            <div class="s-pack-name">${pack.name}</div>
            <div class="s-pack-desc">${pack.desc}</div>
            <div class="s-pack-price">💰 ${pack.price}</div>
        `;
        el.onclick = () => openPack({ ...pack, tier: pack.tier === 'gold-pack' ? 'gold' : pack.tier });
        container.appendChild(el);
    });
}

// ========== AVATARS ==========

function renderAvatarsTab(container, T, lang) {
    AVATAR_DATABASE.forEach(avatar => {
        const isOwned = window.ownedAvatars?.has(avatar.emoji);
        const isEquipped = window.selectedAvatar === avatar.emoji;
        const el = _makeCard({
            rarity: avatar.rarity,
            equipped: isEquipped,
            owned: isOwned && !isEquipped,
            previewHtml: `<span style="font-size:2.4em">${avatar.emoji}</span>`,
            name: avatar.name[lang],
            rarityLabel: RARITY_NAMES[lang][avatar.rarity],
            badgeHtml: isOwned && !isEquipped ? `<div class="s-owned-badge">${T.ownedBadge || 'Є'}</div>` : '',
            btnHtml: isEquipped
                ? _btn('s-btn-equipped', T.equippedBadge || '✓ Вдягнуто')
                : isOwned
                    ? _btn('s-btn-equip', T.equipBtn || 'Надіти')
                    : _btn('s-btn-buy', `💰 ${avatar.price}`),
        });
        const btn = el.querySelector('.s-btn');
        if (btn && !isEquipped) {
            btn.onclick = e => {
                e.stopPropagation();
                if (isOwned) {
                    Store.set('selectedAvatar', avatar.emoji);
                } else {
                    if (window.userGold < avatar.price) { showAlert(_T().errorTitle, _T().notEnoughGold); return; }
                    Store.update('userGold', g => (Number(g) || 0) - avatar.price);
                    Store.addToSet('ownedAvatars', avatar.emoji);
                    Store.set('selectedAvatar', avatar.emoji);
                    SoundEngine.play('victory');
                }
                const av = document.getElementById('player-avatar-display');
                if (av) av.textContent = avatar.emoji;
                window.saveProgression(); SoundEngine.play('click'); initShopScreen();
            };
        }
        container.appendChild(el);
    });
}

// ========== CARD SKINS ==========

function renderSkinsTab(container, T, lang) {
    CARD_SKIN_DATABASE.forEach(skin => {
        const isOwned = window.ownedCardSkins?.has(skin.id);
        const isEquipped = window.selectedCardSkin === skin.id;
        const skinCls = skin.cssClass ? ' ' + skin.cssClass : '';
        const previewHtml = `
            <div class="card unit common${skinCls}" style="width:78px;height:104px;margin:0 auto;pointer-events:none;font-size:0.52em;">
                <div class="card-rarity rarity-common">${RARITY_NAMES[lang].common}</div>
                <div class="card-header"><span class="card-name">Preview</span><span class="card-mana">3</span></div>
                <div class="card-body">Sample</div>
                <div class="card-footer"><span class="card-damage">⚔️4</span><span class="card-armor">🛡️2</span><span class="card-hp">❤️6</span></div>
            </div>`;
        const el = _makeCard({
            rarity: skin.rarity,
            equipped: isEquipped,
            owned: isOwned && !isEquipped,
            previewHtml,
            cardPreview: true,
            name: skin.name[lang],
            rarityLabel: RARITY_NAMES[lang][skin.rarity],
            badgeHtml: isOwned && !isEquipped ? `<div class="s-owned-badge">${T.ownedBadge || 'Є'}</div>` : '',
            btnHtml: isEquipped
                ? _btn('s-btn-equipped', T.equippedBadge || '✓ Вдягнуто')
                : isOwned
                    ? _btn('s-btn-equip', T.equipBtn || 'Надіти')
                    : _btn('s-btn-buy', `💰 ${skin.price}`),
        });
        const btn = el.querySelector('.s-btn');
        if (btn && !isEquipped) {
            btn.onclick = e => {
                e.stopPropagation();
                if (isOwned) {
                    Store.set('selectedCardSkin', skin.id);
                } else {
                    if (window.userGold < skin.price) { showAlert(_T().errorTitle, _T().notEnoughGold); return; }
                    Store.update('userGold', g => (Number(g) || 0) - skin.price);
                    Store.addToSet('ownedCardSkins', skin.id);
                    Store.set('selectedCardSkin', skin.id);
                    SoundEngine.play('victory');
                }
                window.saveProgression(); SoundEngine.play('click'); initShopScreen();
            };
        }
        container.appendChild(el);
    });
}

// ========== BOARD SKINS ==========

function renderBoardTab(container, T, lang) {
    BOARD_SKIN_DATABASE.forEach(skin => {
        const isOwned = window.ownedBoardSkins?.has(skin.id);
        const isEquipped = window.selectedBoardSkin === skin.id;
        const cells = Array(9).fill('<div class="bp-cell"></div>').join('');
        const previewHtml = `<div class="board-preview bp-${skin.id}">${cells}</div>`;
        const el = _makeCard({
            rarity: skin.rarity,
            equipped: isEquipped,
            owned: isOwned && !isEquipped,
            previewHtml,
            name: skin.name[lang],
            rarityLabel: RARITY_NAMES[lang][skin.rarity],
            badgeHtml: isOwned && !isEquipped ? `<div class="s-owned-badge">${T.ownedBadge || 'Є'}</div>` : '',
            btnHtml: isEquipped
                ? _btn('s-btn-equipped', T.equippedBadge || '✓ Вдягнуто')
                : isOwned || skin.price === 0
                    ? _btn('s-btn-equip', skin.price === 0 && !isOwned ? (T.freeBadge || 'Безкоштовно') : (T.equipBtn || 'Надіти'))
                    : _btn('s-btn-buy', `💰 ${skin.price}`),
        });
        const btn = el.querySelector('.s-btn');
        if (btn && !isEquipped) {
            btn.onclick = e => {
                e.stopPropagation();
                if (isOwned || skin.price === 0) {
                    if (!isOwned) Store.addToSet('ownedBoardSkins', skin.id);
                    Store.set('selectedBoardSkin', skin.id);
                } else {
                    if (window.userGold < skin.price) { showAlert(_T().errorTitle, _T().notEnoughGold); return; }
                    Store.update('userGold', g => (Number(g) || 0) - skin.price);
                    Store.addToSet('ownedBoardSkins', skin.id);
                    Store.set('selectedBoardSkin', skin.id);
                    SoundEngine.play('victory');
                }
                applyBoardSkin();
                window.saveProgression(); SoundEngine.play('click'); initShopScreen();
            };
        }
        container.appendChild(el);
    });
}

// ========== THEMES ==========

function renderThemesTab(container, T, lang) {
    const themeEmojis = { default: '⭐', neon: '💠', blood: '🩸', ocean: '🌊', emerald: '💎', golden: '👑' };
    MENU_THEME_DATABASE.forEach(theme => {
        const isOwned = window.ownedMenuThemes?.has(theme.id);
        const isEquipped = window.selectedMenuTheme === theme.id;
        const previewCls = theme.cssClass ? ' ' + theme.cssClass : '';
        const previewHtml = `
            <div class="theme-preview${previewCls}">
                <div class="theme-preview-emoji">${themeEmojis[theme.id] || '✨'}</div>
                <div class="theme-preview-btn">Button</div>
            </div>`;
        const el = _makeCard({
            rarity: theme.rarity,
            equipped: isEquipped,
            owned: isOwned && !isEquipped,
            previewHtml,
            name: theme.name[lang],
            rarityLabel: RARITY_NAMES[lang][theme.rarity],
            badgeHtml: isOwned && !isEquipped ? `<div class="s-owned-badge">${T.ownedBadge || 'Є'}</div>` : '',
            btnHtml: isEquipped
                ? _btn('s-btn-equipped', T.equippedBadge || '✓ Вдягнуто')
                : isOwned
                    ? _btn('s-btn-equip', T.equipBtn || 'Надіти')
                    : _btn('s-btn-buy', `💰 ${theme.price}`),
        });
        const btn = el.querySelector('.s-btn');
        if (btn && !isEquipped) {
            btn.onclick = e => {
                e.stopPropagation();
                if (isOwned) {
                    Store.set('selectedMenuTheme', theme.id); applyMenuTheme();
                } else {
                    if (window.userGold < theme.price) { showAlert(_T().errorTitle, _T().notEnoughGold); return; }
                    Store.update('userGold', g => (Number(g) || 0) - theme.price);
                    Store.addToSet('ownedMenuThemes', theme.id);
                    Store.set('selectedMenuTheme', theme.id);
                    applyMenuTheme();
                    window.achOnThemeBought?.();
                    SoundEngine.play('victory');
                }
                window.saveProgression(); SoundEngine.play('click'); initShopScreen();
            };
        }
        container.appendChild(el);
    });
}

// ========== EMOJIS ==========

function renderEmojisTab(container, T, lang) {
    container.className = 'shop-container s-grid s-grid-emojis';
    const infoEl = document.createElement('div');
    infoEl.className = 's-emojis-info';
    infoEl.innerHTML = `${T.equippedEmojisLimit || 'Екіпіровано'}: <strong>${(window.equippedEmojis || []).length}/6</strong>`;
    container.appendChild(infoEl);
    if (!window.AVAILABLE_EMOJIS) return;

    // Автоматично додаємо безкоштовні емодзі до ownedEmojis якщо їх там немає
    const freeEmojis = window.AVAILABLE_EMOJIS.filter(e => e.price === 0).map(e => e.id);
    let ownedNow = [...(window.ownedEmojis || [])];
    let ownedChanged = false;
    freeEmojis.forEach(id => { if (!ownedNow.includes(id)) { ownedNow.push(id); ownedChanged = true; } });
    if (ownedChanged) Store.set('ownedEmojis', ownedNow);

    window.AVAILABLE_EMOJIS.forEach(emojiObj => {
        const isOwned = emojiObj.price === 0 || (window.ownedEmojis || []).includes(emojiObj.id);
        const isEquipped = (window.equippedEmojis || []).includes(emojiObj.id);
        const el = document.createElement('div');
        el.className = `s-card s-emoji-card${isEquipped ? ' s-equipped' : ''}${isOwned && !isEquipped ? ' s-owned' : ''}`;
        el.innerHTML = `
            ${isEquipped ? '<div class="s-check">✓</div>' : ''}
            <div class="s-emoji-face">${emojiObj.id}</div>
            ${emojiObj.price === 0 ? `<div class="s-free-badge">${T.freeBadge || 'Безкоштовно'}</div>` : `<div class="s-emoji-price">💰 ${emojiObj.price}</div>`}
            ${isEquipped ? _btn('s-btn-unequip', T.unEquipBtn || 'Зняти') : isOwned ? _btn('s-btn-equip', T.equipBtn || 'Надіти') : _btn('s-btn-buy', T.buyBtn || 'Купити')}
        `;
        const btn = el.querySelector('.s-btn');
        btn.onclick = e => {
            e.stopPropagation();
            if (isEquipped) {
                Store.set('equippedEmojis', (window.equippedEmojis || []).filter(e2 => e2 !== emojiObj.id));
            } else if (isOwned) {
                if ((window.equippedEmojis || []).length >= 6) { showAlert(_T().errorTitle, _T().maxEmojisEquipped || 'Максимум 6!'); return; }
                Store.push('equippedEmojis', emojiObj.id);
            } else {
                if (window.userGold < emojiObj.price) { showAlert(_T().errorTitle, _T().notEnoughGold); return; }
                Store.update('userGold', g => (Number(g) || 0) - emojiObj.price);
                Store.push('ownedEmojis', emojiObj.id);
                if ((window.equippedEmojis || []).length < 6) Store.push('equippedEmojis', emojiObj.id);
                SoundEngine.play('victory');
            }
            window.saveProgression(); SoundEngine.play('click');
            if (typeof window.updateEmojiPickerUI === 'function') window.updateEmojiPickerUI();
            initShopScreen();
        };
        container.appendChild(el);
    });
}

// ========== APPLY ==========

function applyMenuTheme() {
    MENU_THEME_DATABASE.forEach(t => { if (t.cssClass) document.body.classList.remove(t.cssClass); });
    const theme = MENU_THEME_DATABASE.find(t => t.id === window.selectedMenuTheme);
    if (theme?.cssClass) document.body.classList.add(theme.cssClass);
}
window.applyMenuTheme = applyMenuTheme;

function applyBoardSkin() {
    const grid = document.querySelector('.grid-container');
    if (!grid) return;
    BOARD_SKIN_DATABASE?.forEach(s => { if (s.cssClass) grid.classList.remove(s.cssClass); });
    const skin = BOARD_SKIN_DATABASE?.find(s => s.id === window.selectedBoardSkin);
    if (skin?.cssClass) grid.classList.add(skin.cssClass);
}
window.applyBoardSkin = applyBoardSkin;

// ========== OPEN PACK ==========

function openPack(pack) {
    const T = _T();
    if (window.userGold < pack.price) { showAlert(T.errorTitle, T.notEnoughGold); return; }
    const lockedCards = CARD_DATABASE.filter(c => !window.unlockedCards.has(c.id));
    if (lockedCards.length === 0) { showAlert(T.alertTitle, T.noMoreCards); return; }
    Store.update('userGold', g => (Number(g) || 0) - pack.price);
    const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
    const minIdx = rarityOrder.indexOf(pack.guaranteed);
    let pool = lockedCards.filter(c => rarityOrder.indexOf(c.rarity) >= minIdx);
    if (pool.length === 0) pool = lockedCards;
    const rand = Math.random() * 100;
    let targetRarity;
    if (pack.tier === 'gold') targetRarity = rand < 25 ? 'legendary' : 'epic';
    else if (pack.tier === 'silver') targetRarity = rand < 10 ? 'epic' : (rand < 50 ? 'rare' : 'common');
    else targetRarity = rand < 5 ? 'rare' : 'common';
    let finalPool = pool.filter(c => c.rarity === targetRarity);
    if (finalPool.length === 0) finalPool = pool;
    const card = finalPool[Math.floor(Math.random() * finalPool.length)];
    Store.addToSet('unlockedCards', card.id);
    window.achOnCardUnlocked?.(window.unlockedCards?.size || 0);
    window.saveProgression();
    showPackOpenAnimation(card);
    initShopScreen();
}
window.openPack = openPack;

// ========== PACK ANIMATION ==========

function showPackOpenAnimation(card) {
    const overlay = document.getElementById('pack-opening-overlay'), flipper = document.getElementById('pack-card-flipper'),
        rarityLabel = document.getElementById('pack-rarity-label'), cardName = document.getElementById('pack-card-name'),
        particles = document.getElementById('pack-particles'), skipBtn = document.getElementById('pack-skip-btn');
    if (!overlay || !flipper) return;
    overlay.classList.remove('hidden');
    flipper.className = 'pack-card-flipper'; rarityLabel.className = 'pack-rarity-label'; rarityLabel.textContent = '';
    cardName.className = 'pack-card-name'; cardName.textContent = ''; particles.innerHTML = '';
    const rarity = card.rarity || 'common', lang = _lang();
    const cardFace = overlay.querySelector('.pack-card-face-content');
    const skinObj = CARD_SKIN_DATABASE.find(s => s.id === window.selectedCardSkin);
    const skinClass = skinObj?.cssClass ? ' ' + skinObj.cssClass : '';
    cardFace.innerHTML = `
        <div class="card ${card.type} ${rarity}${skinClass}" style="width:100%;height:100%;margin:0;pointer-events:none;">
            <div class="card-rarity rarity-${rarity}">${RARITY_NAMES[lang][rarity]}</div>
            <div class="card-header"><span class="card-name">${card.name[lang]}</span><span class="card-mana">${card.mana}</span></div>
            <div class="card-body">${card.description[lang]}${card.type === 'unit' ? `<div class="card-range">🎯 Range: ${card.range || 1}</div>` : ''}</div>
            <div class="card-footer">${card.type === 'unit' ? `<span class="card-damage">⚔️ ${card.damage}</span><span class="card-armor">🛡️ ${card.armor}</span><span class="card-hp">❤️ ${card.hp}</span>` : `<span class="card-spell-icon">✨ Spell</span>`}</div>
        </div>`;
    const colors = { legendary: ['#f1c40f', '#ffd700', '#e67e22', '#fff4cc'], epic: ['#9b59b6', '#8e44ad', '#c39bd3', '#d2b4de'], rare: ['#3498db', '#2980b9', '#85c1e9', '#aed6f1'], common: ['#bdc3c7', '#ecf0f1', '#95a5a6', '#d5dbdb'] }[rarity] || ['#bdc3c7'];
    SoundEngine.play('packOpen'); flipper.classList.add('spinning');
    setTimeout(() => {
        flipper.classList.remove('spinning'); flipper.classList.add('revealed', `rarity-${rarity}`);
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2, count = rarity === 'legendary' ? 60 : rarity === 'epic' ? 40 : 20;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div'); p.className = 'pack-particle';
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5, dist = 100 + Math.random() * 200;
            p.style.cssText = `left:${cx}px;top:${cy}px;background:${colors[Math.floor(Math.random() * colors.length)]};width:${3 + Math.random() * 5}px;height:${3 + Math.random() * 5}px;--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist}px;animation-delay:${Math.random() * 0.3}s;animation-duration:${1 + Math.random()}s;`;
            particles.appendChild(p);
        }
        if (rarity === 'legendary' || rarity === 'epic') SoundEngine.play('victory');
    }, 1000);
    setTimeout(() => {
        rarityLabel.textContent = RARITY_NAMES[lang][rarity].toUpperCase();
        rarityLabel.classList.add('visible', `rarity-${rarity}`);
        cardName.textContent = card.name[lang]; cardName.classList.add('visible');
    }, 1800);
    skipBtn.onclick = () => overlay.classList.add('hidden');
}
window.showPackOpenAnimation = showPackOpenAnimation;
