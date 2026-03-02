// ========== DECK-BUILDER.JS ==========
// Конструктор колоди: базова логіка + фільтри/сортування/пошук.
// Залежності: cards.js (CARD_DATABASE), constants.js (MAX_DECK_SIZE),
//             store.js (Store), progression.js (saveProgression),
//             translations.js (TRANSLATIONS), ui.js (showAlert, createSimpleCardEl)
//
// ВИПРАВЛЕННЯ:
//   1. clearBtn      — removeEventListener через збережене посилання (_clearBtnHandler)
//   2. applyFilters  — data-driven ре-рендер з CARD_DATABASE (не переміщення DOM-вузлів)
//   3. debounce 200ms на поле пошуку
//   4. userDeck.push/splice/= [] → Store.push / Store.removeAt / Store.set  ← НОВЕ

// ========== DEBOUNCE UTILITY ==========

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ========== COMPACT DECK LIST RENDERER ==========

function renderCompactDeckList() {
    const listEl  = document.getElementById('selected-deck-list');
    const slotsEl = document.getElementById('slots-filled');
    const barFill = document.getElementById('slots-bar-fill');
    const emptyHint = document.getElementById('deck-empty-hint');
    const statsBar  = document.getElementById('deck-stats-bar');
    if (!listEl) return;

    const deck = Store.get('userDeck') || [];
    const max  = window.MAX_DECK_SIZE;

    if (slotsEl) slotsEl.textContent = deck.length;
    if (barFill) {
        barFill.style.width = `${(deck.length / max) * 100}%`;
        barFill.classList.toggle('full', deck.length >= max);
    }
    if (emptyHint) emptyHint.classList.toggle('hidden', deck.length > 0);

    listEl.innerHTML = '';
    deck.forEach((cardId, index) => {
        const card = window.CARD_DATABASE.find(c => c.id === cardId);
        if (!card) return;
        const cardEl = window.createSimpleCardEl(card);
        cardEl.style.animationDelay = `${index * 0.04}s`;
        cardEl.title = card.name[window.currentLang];
        cardEl.onclick = () => {
            window.SoundEngine?.play('click');
            // ВИПРАВЛЕННЯ: Store.removeAt замість window.userDeck.splice(index, 1)
            Store.removeAt('userDeck', index);
            window.saveProgression();
            renderCompactDeckList();
            refreshInDeckMarkers();
        };
        listEl.appendChild(cardEl);
    });

    if (statsBar) {
        const T = window.TRANSLATIONS[window.currentLang] || {};
        const deckCards = deck.map(id => window.CARD_DATABASE.find(c => c.id === id)).filter(Boolean);
        const avgMana = deckCards.length
            ? (deckCards.reduce((s, c) => s + c.mana, 0) / deckCards.length).toFixed(1)
            : '—';
        const units  = deckCards.filter(c => c.type === 'unit').length;
        const spells = deckCards.filter(c => c.type === 'spell').length;
        statsBar.innerHTML = `
            <div class="deck-stat">💎 ${T.deckAvgMana || 'Мана'}<span>${avgMana}</span></div>
            <div class="deck-stat">⚔️ ${T.deckUnits   || 'Юніти'}<span>${units}</span></div>
            <div class="deck-stat">✨ ${T.deckSpells  || 'Закляття'}<span>${spells}</span></div>
        `;
    }
}

function refreshInDeckMarkers() {
    const allCardsList = document.getElementById('all-cards-list');
    if (!allCardsList) return;
    const deckSet = new Set(Store.get('userDeck') || []);
    allCardsList.querySelectorAll('.card').forEach(el => {
        const id = parseInt(el.dataset.cardId);
        el.classList.toggle('in-deck', deckSet.has(id));
    });
}

// ========== RARITY LIMIT CHECK ==========
// Виділено в окрему функцію щоб не дублювати між baseInitDeckBuilder і applyFilters

function _checkRarityLimit(card) {
    const currentDeckCards = (Store.get('userDeck') || [])
        .map(id => window.CARD_DATABASE.find(c => c.id === id))
        .filter(Boolean);

    const counts = {
        legendary: currentDeckCards.filter(c => c.rarity === 'legendary').length,
        epic:      currentDeckCards.filter(c => c.rarity === 'epic').length,
        rare:      currentDeckCards.filter(c => c.rarity === 'rare').length,
    };
    const T = window.TRANSLATIONS[window.currentLang];

    if (card.rarity === 'legendary' && counts.legendary >= 1) { window.showAlert(T.alertTitle, T.deckLimitLegendary); return false; }
    if (card.rarity === 'epic'      && counts.epic      >= 3) { window.showAlert(T.alertTitle, T.deckLimitEpic);      return false; }
    if (card.rarity === 'rare'      && counts.rare      >= 5) { window.showAlert(T.alertTitle, T.deckLimitRare);      return false; }
    return true;
}

function _addCardToDeck(card, onSuccess) {
    const T = window.TRANSLATIONS[window.currentLang];
    const deck = Store.get('userDeck') || [];

    if (deck.length >= window.MAX_DECK_SIZE) {
        window.showAlert(T.alertTitle, T.deckFullAlert);
        return;
    }
    if (!_checkRarityLimit(card)) return;

    window.SoundEngine?.play('cardPlay');
    // ВИПРАВЛЕННЯ: Store.push замість window.userDeck.push(card.id)
    Store.push('userDeck', card.id);
    window.saveProgression();
    onSuccess?.();
}

// ========== BASE DECK BUILDER ==========

let _clearBtnHandler = null;

function baseInitDeckBuilder() {
    const allCardsList = document.getElementById('all-cards-list');
    if (!allCardsList) return;

    allCardsList.innerHTML = '';

    window.CARD_DATABASE.forEach(card => {
        if (!window.unlockedCards.has(card.id)) return;
        const cardEl = window.createSimpleCardEl(card);
        cardEl.dataset.cardId = card.id;
        cardEl.dataset.mana   = card.mana;
        cardEl.dataset.rarity = card.rarity || 'common';
        cardEl.title = card.name[window.currentLang];

        cardEl.onclick = () => {
            _addCardToDeck(card, () => {
                renderCompactDeckList();
                refreshInDeckMarkers();
            });
        };
        allCardsList.appendChild(cardEl);
    });

    renderCompactDeckList();
    refreshInDeckMarkers();

    const clearBtn = document.getElementById('deck-clear-btn');
    if (clearBtn) {
        if (_clearBtnHandler) {
            clearBtn.removeEventListener('click', _clearBtnHandler);
        }
        _clearBtnHandler = () => {
            if ((Store.get('userDeck') || []).length === 0) return;
            window.showConfirmModal(
                window.TRANSLATIONS[window.currentLang].deckClearConfirm || 'Очистити колоду?',
                () => {
                    // ВИПРАВЛЕННЯ: Store.set замість window.userDeck = []
                    Store.set('userDeck', []);
                    window.saveProgression();
                    renderCompactDeckList();
                    refreshInDeckMarkers();
                },
                null, '🗑️'
            );
        };
        clearBtn.addEventListener('click', _clearBtnHandler);
    }
}

// ========== IMPROVED DECK BUILDER (filter / sort / search) ==========

function initDeckBuilder() {
    baseInitDeckBuilder();

    const allCardsSection = document.getElementById('all-cards-section');
    if (!allCardsSection) return;
    const T = window.TRANSLATIONS[window.currentLang];

    const existingFilter = allCardsSection.querySelector('.deck-filter-bar');
    if (existingFilter) existingFilter.remove();

    const filterBar = document.createElement('div');
    filterBar.className = 'deck-filter-bar';
    filterBar.innerHTML = `
        <button class="filter-btn active" data-filter="all">${T.filterAll || 'Всі'}</button>
        <button class="filter-btn" data-filter="unit">${T.filterUnit || 'Юніти'}</button>
        <button class="filter-btn" data-filter="spell">${T.filterSpell || 'Закляття'}</button>
        <span style="color:rgba(255,255,255,0.18);font-size:0.9em">│</span>
        <button class="filter-btn" data-filter="common">${T.rarityCommon || 'Common'}</button>
        <button class="filter-btn" data-filter="rare">${T.rarityRare || 'Rare'}</button>
        <button class="filter-btn" data-filter="epic">${T.rarityEpic || 'Epic'}</button>
        <button class="filter-btn" data-filter="legendary">${T.rarityLegendary || 'Legendary'}</button>
        <span style="color:rgba(255,255,255,0.18);font-size:0.9em">│</span>
        <select id="deck-sort-select" class="deck-sort-select">
            <option value="name">${T.sortByName || 'Назва'}</option>
            <option value="mana">${T.sortByMana || 'Мана'}</option>
            <option value="rarity">${T.sortByRarity || 'Рідкість'}</option>
        </select>
        <input type="text" class="deck-search" placeholder="🔍 ${T.filterSearch || 'Пошук...'}" id="deck-search-input">
    `;

    const wrapper = allCardsSection.querySelector('#all-cards-list-wrapper');
    if (wrapper) allCardsSection.insertBefore(filterBar, wrapper);
    else allCardsSection.prepend(filterBar);

    let activeTypeFilter   = 'all';
    let activeRarityFilter = null;

    filterBar.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
            const f = btn.dataset.filter;
            const isTypeFilter = ['all', 'unit', 'spell'].includes(f);
            if (isTypeFilter) {
                activeTypeFilter = f;
                filterBar.querySelectorAll('.filter-btn').forEach(b => {
                    if (['all','unit','spell'].includes(b.dataset.filter)) b.classList.remove('active');
                });
                btn.classList.add('active');
            } else {
                if (activeRarityFilter === f) {
                    activeRarityFilter = null;
                    btn.classList.remove('active');
                } else {
                    filterBar.querySelectorAll('.filter-btn').forEach(b => {
                        if (!['all','unit','spell'].includes(b.dataset.filter)) b.classList.remove('active');
                    });
                    activeRarityFilter = f;
                    btn.classList.add('active');
                }
            }
            applyFilters();
        };
    });

    const searchInput = document.getElementById('deck-search-input');
    const sortSelect  = document.getElementById('deck-sort-select');

    if (searchInput) searchInput.oninput = debounce(() => applyFilters(), 200);
    if (sortSelect)  sortSelect.onchange = () => applyFilters();

    const rarityOrder = { common: 1, rare: 2, epic: 3, legendary: 4 };

    function applyFilters() {
        const query   = (searchInput?.value || '').toLowerCase();
        const cardsEl = document.getElementById('all-cards-list');
        if (!cardsEl) return;

        const sortMode = sortSelect?.value || 'name';
        const lang     = window.currentLang;

        let filtered = window.CARD_DATABASE.filter(card => {
            if (!window.unlockedCards.has(card.id))                                      return false;
            if (activeTypeFilter === 'unit'  && card.type !== 'unit')                    return false;
            if (activeTypeFilter === 'spell' && card.type !== 'spell')                   return false;
            if (activeRarityFilter && (card.rarity || 'common') !== activeRarityFilter)  return false;
            if (query && !card.name[lang].toLowerCase().includes(query))                 return false;
            return true;
        });

        filtered.sort((a, b) => {
            if (sortMode === 'mana') {
                const diff = (a.mana || 0) - (b.mana || 0);
                if (diff !== 0) return diff;
            } else if (sortMode === 'rarity') {
                const diff = (rarityOrder[b.rarity] || 1) - (rarityOrder[a.rarity] || 1);
                if (diff !== 0) return diff;
            }
            return (a.name[lang] || '').toLowerCase().localeCompare((b.name[lang] || '').toLowerCase());
        });

        const deckSet  = new Set(Store.get('userDeck') || []);
        const fragment = document.createDocumentFragment();

        filtered.forEach(card => {
            const cardEl = window.createSimpleCardEl(card);
            cardEl.dataset.cardId = card.id;
            cardEl.dataset.mana   = card.mana;
            cardEl.dataset.rarity = card.rarity || 'common';
            cardEl.title          = card.name[lang];
            cardEl.classList.toggle('in-deck', deckSet.has(card.id));

            cardEl.onclick = () => {
                _addCardToDeck(card, () => {
                    renderCompactDeckList();
                    applyFilters();
                });
            };
            fragment.appendChild(cardEl);
        });

        cardsEl.replaceChildren(fragment);
    }
}

window.initDeckBuilder       = initDeckBuilder;
window.baseInitDeckBuilder   = baseInitDeckBuilder;
window.renderCompactDeckList = renderCompactDeckList;

// ========== COLLECTION TAB (inside deck builder) ==========

function renderCollectionTab() {
    const cardsEl = document.getElementById('all-cards-list');
    if (!cardsEl) return;

    const lang     = window.currentLang || 'uk';
    const unlocked = window.unlockedCards instanceof Set
        ? window.unlockedCards
        : new Set((window.unlockedCards || []).map(Number));
    const total    = window.CARD_DATABASE.length;
    const ownedN   = window.CARD_DATABASE.filter(c => unlocked.has(c.id)).length;

    const counter = document.getElementById('deck-collection-counter');
    if (counter) counter.textContent = `${ownedN} / ${total}`;

    const rarityOrder = { common: 1, rare: 2, epic: 3, legendary: 4 };
    const sorted = [...window.CARD_DATABASE].sort((a, b) => {
        const rd = (rarityOrder[b.rarity] || 1) - (rarityOrder[a.rarity] || 1);
        if (rd !== 0) return rd;
        return (a.name[lang] || '').localeCompare(b.name[lang] || '');
    });

    cardsEl.innerHTML = '';
    let activeChallengePanel = null;
    let activeCardId = null;

    sorted.forEach(card => {
        const isOwned = unlocked.has(card.id);
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display  = 'inline-block';

        const cardEl = window.createSimpleCardEl(card);
        cardEl.dataset.cardId = card.id;
        if (!isOwned) {
            cardEl.classList.add('locked-card');
            cardEl.title = '🔒 ' + card.name[lang];
        } else {
            // Mini challenge progress dots
            const challenges = window.getCardChallenges?.(card) || [];
            const progress   = JSON.parse(localStorage.getItem('cardChallenges') || '{}');
            const doneCount  = challenges.filter(c => (progress[`${card.id}_${c.key}`]?.progress || 0) >= c.goal).length;

            if (challenges.length > 0) {
                const dots = document.createElement('div');
                dots.className = 'cc-dots';
                dots.innerHTML = challenges.map((c, i) => {
                    const done = (progress[`${card.id}_${c.key}`]?.progress || 0) >= c.goal;
                    const claimed = progress[`${card.id}_${c.key}`]?.claimed;
                    return `<span class="cc-dot${claimed ? ' cc-dot-claimed' : done ? ' cc-dot-done' : ''}"></span>`;
                }).join('');
                wrapper.appendChild(dots);
            }

            cardEl.title = card.name[lang];
            cardEl.onclick = (e) => {
                e.stopPropagation();

                // Мобільний режим: відкриваємо drawer
                if (document.body.classList.contains('mobile-mode')) {
                    const drawerContent = document.getElementById('cc-drawer-content');
                    const drawerTitle   = document.getElementById('cc-drawer-card-name');
                    const overlay       = document.getElementById('cc-mobile-drawer-overlay');
                    const drawer        = document.getElementById('cc-mobile-drawer');
                    if (drawerContent && overlay && drawer) {
                        drawerTitle.textContent = card.name[lang];
                        window.renderCardChallengesPanel(card, drawerContent);
                        overlay.classList.add('active');
                        requestAnimationFrame(() => drawer.classList.add('open'));
                        function closeDrawer() {
                            drawer.classList.remove('open');
                            setTimeout(() => overlay.classList.remove('active'), 300);
                            overlay.removeEventListener('click', closeDrawer);
                            const closeBtn = document.getElementById('cc-drawer-close-btn');
                            if (closeBtn) closeBtn.removeEventListener('click', closeDrawer);
                        }
                        overlay.addEventListener('click', closeDrawer);
                        const closeBtn = document.getElementById('cc-drawer-close-btn');
                        if (closeBtn) { closeBtn.removeEventListener('click', closeDrawer); closeBtn.addEventListener('click', closeDrawer); }
                    }
                    return;
                }

                // Toggle panel (ПК режим)
                if (activeCardId === card.id && activeChallengePanel) {
                    activeChallengePanel.remove();
                    activeChallengePanel = null;
                    activeCardId = null;
                    cardEl.classList.remove('cc-selected');
                    return;
                }

                // Remove old panel
                if (activeChallengePanel) {
                    activeChallengePanel.remove();
                    document.querySelectorAll('.cc-selected').forEach(el => el.classList.remove('cc-selected'));
                }

                cardEl.classList.add('cc-selected');
                activeCardId = card.id;

                // Insert panel after the grid row (append to all-cards-list after cards)
                const panel = document.createElement('div');
                panel.className = 'cc-panel';
                panel.style.gridColumn = '1 / -1';
                window.renderCardChallengesPanel?.(card, panel);
                cardsEl.appendChild(panel);
                activeChallengePanel = panel;
                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            };
        }

        wrapper.appendChild(cardEl);
        cardsEl.appendChild(wrapper);
    });
}

function initDeckBuilderTabs() {
    const tabBuilder    = document.getElementById('tab-builder-btn');
    const tabCollection = document.getElementById('tab-collection-btn');
    const tabChallenges = document.getElementById('tab-challenges-btn');
    const deckSection   = document.getElementById('selected-deck-section');
    const mainSection   = document.querySelector('#deck-builder main');
    const challengesInner = document.getElementById('challenges-screen-inner');
    const deckBuilderEl = document.getElementById('deck-builder');
    if (!tabBuilder || !tabCollection) return;

    function setActiveTab(tab) {
        [tabBuilder, tabCollection, tabChallenges].forEach(b => b?.classList.remove('active'));
        tab.classList.add('active');
    }

    function switchToBuilder() {
        setActiveTab(tabBuilder);
        if (deckBuilderEl) deckBuilderEl.classList.remove('challenges-active');
        if (deckSection)     deckSection.style.display = '';
        if (mainSection)     mainSection.style.display = '';
        if (challengesInner) { challengesInner.style.display = 'none'; challengesInner.classList.add('hidden'); }
        document.getElementById('deck-collection-counter').textContent = '';
        initDeckBuilder();
    }

    function switchToCollection() {
        setActiveTab(tabCollection);
        if (deckBuilderEl) deckBuilderEl.classList.remove('challenges-active');
        if (deckSection)     deckSection.style.display = 'none';
        if (mainSection)     mainSection.style.display = '';
        if (challengesInner) { challengesInner.style.display = 'none'; challengesInner.classList.add('hidden'); }
        const filterBar = document.querySelector('.deck-filter-bar');
        if (filterBar) filterBar.remove();
        renderCollectionTab();
    }

    function switchToChallenges() {
        setActiveTab(tabChallenges);
        if (deckBuilderEl) deckBuilderEl.classList.add('challenges-active');
        if (deckSection)     deckSection.style.display = 'none';
        if (mainSection)     mainSection.style.display = 'none';
        if (challengesInner) { challengesInner.style.display = 'flex'; challengesInner.classList.remove('hidden'); }
        document.getElementById('deck-collection-counter').textContent = '';
        const filterBar = document.querySelector('.deck-filter-bar');
        if (filterBar) filterBar.remove();
        window.renderChallengesTab?.();
    }

    tabBuilder.onclick    = switchToBuilder;
    tabCollection.onclick = switchToCollection;
    if (tabChallenges) tabChallenges.onclick = switchToChallenges;
}

window.initDeckBuilderTabs   = initDeckBuilderTabs;
window.renderCollectionTab   = renderCollectionTab;
