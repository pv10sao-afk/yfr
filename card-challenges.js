// ========== CARD CHALLENGES ==========
// Система завдань для кожної карти.
// Прогрес зберігається в window.cardChallengesProgress → Firebase (через saveProgression).
// Залежності: cards.js (CARD_DATABASE), progression.js (saveProgression)

(function () {

    // ── Конфігурація завдань по рарності ─────────────────────────────

    const RARITY_CONFIG = {
        //             goals: [play_n, dmg/eff, win]   rewards: [play, dmg/eff, win]
        common:    { goals: [3,  20, 2], rewards: [15,  12,  30] },
        rare:      { goals: [5,  40, 3], rewards: [25,  20,  45] },
        epic:      { goals: [8,  60, 5], rewards: [40,  30,  75] },
        legendary: { goals: [10, 80, 8], rewards: [60,  50, 120] },
    };

    function getChallenges(card) {
        const r   = card.rarity || 'common';
        const cfg = RARITY_CONFIG[r] || RARITY_CONFIG.common;

        if (card.type === 'unit') {
            return [
                { key: 'play_n',   label_uk: `Зіграй юнітом ${cfg.goals[0]} разів`,            label_en: `Play this unit ${cfg.goals[0]} times`,              goal: cfg.goals[0], reward: cfg.rewards[0] },
                { key: 'deal_dmg', label_uk: `Нанеси ${cfg.goals[1]} урону цим юнітом`,         label_en: `Deal ${cfg.goals[1]} damage with this unit`,         goal: cfg.goals[1], reward: cfg.rewards[1] },
                { key: 'win_with', label_uk: `Виграй ${cfg.goals[2]} ігор з картою в колоді`,   label_en: `Win ${cfg.goals[2]} games with this card in deck`,    goal: cfg.goals[2], reward: cfg.rewards[2] },
            ];
        } else {
            return [
                { key: 'play_n',    label_uk: `Зіграй заклинанням ${cfg.goals[0]} разів`,       label_en: `Play this spell ${cfg.goals[0]} times`,             goal: cfg.goals[0], reward: cfg.rewards[0] },
                { key: 'total_eff', label_uk: `Накопич ${cfg.goals[1]} ефекту (урон/хіл)`,      label_en: `Accumulate ${cfg.goals[1]} total effect (dmg/heal)`, goal: cfg.goals[1], reward: cfg.rewards[1] },
                { key: 'win_with',  label_uk: `Виграй ${cfg.goals[2]} ігор з картою в колоді`,  label_en: `Win ${cfg.goals[2]} games with this card in deck`,   goal: cfg.goals[2], reward: cfg.rewards[2] },
            ];
        }
    }
    window.getCardChallenges = getChallenges;

    // ── Accessor до прогресу ─────────────────────────────────────────
    // window.cardChallengesProgress ініціалізується в progression.js (fallback)
    // і перезаписується Firebase у _applyCloudData (auth.js).

    function getProgress() {
        if (!window.cardChallengesProgress || typeof window.cardChallengesProgress !== 'object') {
            window.cardChallengesProgress = {};
        }
        return window.cardChallengesProgress;
    }

    // ── Оновлення прогресу (викликається з гри) ──────────────────────

    window.updateCardChallengeProgress = function (type, cardId, amount = 1) {
        if (!cardId) return;
        const card = (window.CARD_DATABASE || []).find(c => c.id === cardId);
        if (!card) return;
        const challenges = getChallenges(card);
        const ch = challenges.find(c => c.key === type);
        if (!ch) return;

        const data  = getProgress();
        const stKey = `${cardId}_${type}`;
        if (!data[stKey]) data[stKey] = { progress: 0, claimed: false };
        if (data[stKey].claimed) return;

        data[stKey].progress = Math.min(data[stKey].progress + amount, ch.goal * 2);
        window.saveProgression?.();
    };

    // ── Отримання нагороди ───────────────────────────────────────────

    window.claimCardChallengeReward = function (cardId, challengeKey) {
        const card = (window.CARD_DATABASE || []).find(c => c.id === cardId);
        if (!card) return false;
        const challenges = getChallenges(card);
        const ch = challenges.find(c => c.key === challengeKey);
        if (!ch) return false;

        const data  = getProgress();
        const entry = data[`${cardId}_${challengeKey}`] || { progress: 0, claimed: false };
        if (entry.claimed || entry.progress < ch.goal) return false;

        entry.claimed = true;
        data[`${cardId}_${challengeKey}`] = entry;

        window.userGold = (window.userGold || 0) + ch.reward;
        window.saveProgression?.();
        window.updateUserInfo?.();
        return ch.reward;
    };

    // ── Гук: перемога у грі ──────────────────────────────────────────

    window.cardChallengesOnGameEnd = function (isWin) {
        if (!isWin) return;
        const deck = Array.isArray(window.userDeck) ? window.userDeck : [];
        [...new Set(deck)].forEach(id => {
            window.updateCardChallengeProgress('win_with', id, 1);
        });
    };

    // ── Рендер панелі завдань ────────────────────────────────────────

    window.renderCardChallengesPanel = function (card, container) {
        const lang       = window.currentLang || 'uk';
        const challenges = getChallenges(card);
        const data       = getProgress();

        container.innerHTML = '';

        const totalReward  = challenges.reduce((s, c) => s + c.reward, 0);
        const earnedReward = challenges.reduce((s, c) => {
            const e = data[`${card.id}_${c.key}`];
            return s + (e?.claimed ? c.reward : 0);
        }, 0);

        const header = document.createElement('div');
        header.className = 'cc-panel-header';
        header.innerHTML = `
            <span class="cc-panel-title">📜 ${lang === 'uk' ? 'Завдання картки' : 'Card Challenges'}</span>
            <span class="cc-panel-gold">💰 ${earnedReward} / ${totalReward}</span>
        `;
        container.appendChild(header);

        challenges.forEach(ch => {
            const entry    = data[`${card.id}_${ch.key}`] || { progress: 0, claimed: false };
            const progress = Math.min(entry.progress, ch.goal);
            const pct      = Math.floor((progress / ch.goal) * 100);
            const done     = progress >= ch.goal;
            const claimed  = entry.claimed;

            const row = document.createElement('div');
            row.className = 'cc-row' + (claimed ? ' cc-claimed' : done ? ' cc-done' : '');

            const labelText = lang === 'uk' ? ch.label_uk : ch.label_en;
            const icon = claimed ? '✅' : done ? '🎉' : '📌';

            row.innerHTML = `
                <div class="cc-row-top">
                    <span class="cc-label">${icon} ${labelText}</span>
                    <button class="cc-claim-btn${done && !claimed ? ' cc-claim-ready' : ''}"
                            data-card="${card.id}" data-key="${ch.key}"
                            ${(!done || claimed) ? 'disabled' : ''}>
                        ${claimed ? (lang === 'uk' ? 'Отримано' : 'Claimed') : `💰 ${ch.reward}`}
                    </button>
                </div>
                <div class="cc-progress-wrap">
                    <div class="cc-progress-bar">
                        <div class="cc-progress-fill${done ? ' cc-fill-done' : ''}" style="width:${pct}%"></div>
                    </div>
                    <span class="cc-progress-text">${progress} / ${ch.goal}</span>
                </div>
            `;
            container.appendChild(row);
        });

        container.querySelectorAll('.cc-claim-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const earned = window.claimCardChallengeReward(parseInt(btn.dataset.card), btn.dataset.key);
                if (earned) {
                    window.showToast?.(`💰 +${earned} монет!`, 'success', '🏆', 2500);
                    window.renderCardChallengesPanel(card, container);
                }
            });
        });
    };

    // ── Рендер вкладки Завдань ────────────────────────────────────────

    const FILTER_LABELS = {
        uk: { all: 'Всі', unit: '⚔️ Юніти', spell: '✨ Закляття', done: '✅ Виконані' },
        en: { all: 'All', unit: '⚔️ Units',  spell: '✨ Spells',   done: '✅ Done'     },
    };

    let _ccActiveFilter  = 'all';
    let _ccSelectedCard  = null;

    window.renderChallengesTab = function () {
        const lang     = window.currentLang || 'uk';
        const unlocked = window.unlockedCards instanceof Set
            ? window.unlockedCards
            : new Set((window.unlockedCards || []).map(Number));

        const filterEl = document.getElementById('cc-filters');
        const gridEl   = document.getElementById('cc-card-grid');
        if (!filterEl || !gridEl) return;

        const FL = FILTER_LABELS[lang] || FILTER_LABELS.uk;

        // ── Filters bar ──
        filterEl.innerHTML = '';
        ['all','unit','spell','done'].forEach(key => {
            const btn = document.createElement('button');
            btn.className = 'cc-filter-btn' + (_ccActiveFilter === key ? ' active' : '');
            btn.textContent = FL[key];
            btn.onclick = () => { _ccActiveFilter = key; window.renderChallengesTab(); };
            filterEl.appendChild(btn);
        });

        // ── Card list ──
        const RARITY_ORDER = { legendary: 4, epic: 3, rare: 2, common: 1 };
        const data = getProgress();

        let cards = (window.CARD_DATABASE || [])
            .filter(c => unlocked.has(c.id))
            .filter(c => {
                if (_ccActiveFilter === 'unit')  return c.type === 'unit';
                if (_ccActiveFilter === 'spell') return c.type === 'spell';
                if (_ccActiveFilter === 'done')  return getChallenges(c).every(ch => (data[`${c.id}_${ch.key}`]?.progress || 0) >= ch.goal);
                return true;
            })
            .sort((a, b) => (RARITY_ORDER[b.rarity] || 1) - (RARITY_ORDER[a.rarity] || 1));

        gridEl.innerHTML = '';
        if (cards.length === 0) {
            gridEl.innerHTML = `<div style="color:#555;text-align:center;padding:30px;grid-column:1/-1">Немає карт</div>`;
        }

        // Auto-select first if none selected or previous not in list
        if (!_ccSelectedCard || !cards.find(c => c.id === _ccSelectedCard.id)) {
            _ccSelectedCard = cards[0] || null;
        }

        cards.forEach(card => {
            const challenges = getChallenges(card);
            const doneCount  = challenges.filter(c => (data[`${card.id}_${c.key}`]?.progress || 0) >= c.goal).length;
            const allDone    = doneCount === challenges.length;
            const isSelected = _ccSelectedCard?.id === card.id;

            const RARITY_COLORS = { common:'#7f8c8d', rare:'#3498db', epic:'#9b59b6', legendary:'#f0c040' };
            const rc = RARITY_COLORS[card.rarity] || '#7f8c8d';

            const tile = document.createElement('div');
            tile.className = 'cc-card-tile' + (isSelected ? ' cc-tile-selected' : '');
            tile.dataset.rarity = card.rarity;

            // Mini progress bars
            const barsHtml = challenges.map(ch => {
                const prog = Math.min(data[`${card.id}_${ch.key}`]?.progress || 0, ch.goal);
                const pct  = Math.floor(prog / ch.goal * 100);
                const done = prog >= ch.goal;
                return `<div class="cc-mini-bar"><div class="cc-mini-fill${done ? ' cc-mini-done' : ''}" style="width:${pct}%"></div></div>`;
            }).join('');

            tile.innerHTML = `
                ${allDone ? '<div class="cc-all-done-badge">✅</div>' : ''}
                <div class="cc-tile-name">${card.name[lang]}</div>
                <div class="cc-tile-mana">💧 ${card.mana}</div>
                <div class="cc-mini-bars">${barsHtml}</div>
                <div class="cc-tile-count">${doneCount}/${challenges.length}</div>
            `;
            tile.onclick = () => {
                _ccSelectedCard = card;
                if (document.body.classList.contains('mobile-mode')) {
                    _openMobileDrawer(card, lang);
                } else {
                    window.renderChallengesTab();
                }
            };
            gridEl.appendChild(tile);
        });

        // ── Detail panel (тільки для ПК) ──
        if (!document.body.classList.contains('mobile-mode')) {
            _renderChallengeDetail(_ccSelectedCard, lang);
        }
    };

    // ── Mobile bottom drawer ──────────────────────────────────────────
    function _openMobileDrawer(card, lang) {
        const overlay  = document.getElementById('cc-mobile-drawer-overlay');
        const drawer   = document.getElementById('cc-mobile-drawer');
        const content  = document.getElementById('cc-drawer-content');
        const titleEl  = document.getElementById('cc-drawer-card-name');
        const closeBtn = document.getElementById('cc-drawer-close-btn');
        if (!overlay || !drawer || !content) return;

        // Рендеримо вміст у drawer
        titleEl.textContent = card.name[lang];
        _renderChallengeDetail(card, lang, content);

        // Відкриваємо
        overlay.classList.add('active');
        requestAnimationFrame(() => drawer.classList.add('open'));

        function closeDrawer() {
            drawer.classList.remove('open');
            setTimeout(() => overlay.classList.remove('active'), 300);
            overlay.removeEventListener('click', closeDrawer);
            if (closeBtn) closeBtn.removeEventListener('click', closeDrawer);
        }

        overlay.addEventListener('click', closeDrawer);
        if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    }

    function _renderChallengeDetail(card, lang, panelOverride) {
        const panel = panelOverride || document.getElementById('cc-detail-content');
        if (!panel) return;

        if (!card) {
            panel.innerHTML = '<div style="color:#555;text-align:center;padding:40px;font-size:14px;">Оберіть карту зліва</div>';
            return;
        }

        const challenges  = getChallenges(card);
        const data        = getProgress();
        const RARITY_META = {
            common:    { color: '#7f8c8d', label_uk: 'Звичайна',   label_en: 'Common'    },
            rare:      { color: '#3498db', label_uk: 'Рідкісна',   label_en: 'Rare'      },
            epic:      { color: '#9b59b6', label_uk: 'Епічна',     label_en: 'Epic'      },
            legendary: { color: '#f0c040', label_uk: 'Легендарна', label_en: 'Legendary' },
        };
        const rc = RARITY_META[card.rarity] || RARITY_META.common;
        const rarityLabel = rc[`label_${lang}`] || rc.label_uk;

        const totalReward  = challenges.reduce((s, c) => s + c.reward, 0);
        const earnedReward = challenges.reduce((s, c) => s + (data[`${card.id}_${c.key}`]?.claimed ? c.reward : 0), 0);
        const doneCount    = challenges.filter(c => (data[`${card.id}_${c.key}`]?.progress || 0) >= c.goal).length;
        const overallPct   = Math.floor(doneCount / challenges.length * 100);

        panel.innerHTML = '';

        // ── Top row: real card + meta ──
        const topRow = document.createElement('div');
        topRow.className = 'cc-detail-top';

        // Real game card via createSimpleCardEl
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'cc-real-card-wrap';
        if (window.createSimpleCardEl) {
            const cardEl = window.createSimpleCardEl(card);
            cardEl.style.cursor = 'default';
            cardEl.onclick = null;
            cardWrapper.appendChild(cardEl);
        }
        topRow.appendChild(cardWrapper);

        // Meta section
        const metaDiv = document.createElement('div');
        metaDiv.className = 'cc-detail-meta';
        metaDiv.innerHTML = `
            <div class="cc-detail-title-row">
                <span class="cc-detail-card-name">${card.name[lang]}</span>
                <span class="cc-rarity-badge" style="border-color:${rc.color};color:${rc.color}">${rarityLabel}</span>
            </div>
            <div class="cc-detail-subtitle">
                ${card.type === 'unit' ? '⚔️ ' + (lang === 'uk' ? 'Юніт' : 'Unit') : '✨ ' + (lang === 'uk' ? 'Закляття' : 'Spell')}
                &nbsp;·&nbsp; 💧 ${card.mana}
            </div>
            <div class="cc-overall-progress">
                <div class="cc-overall-labels">
                    <span>${lang === 'uk' ? 'Прогрес завдань' : 'Challenge progress'}</span>
                    <span class="cc-gold-earned">💰 ${earnedReward} / ${totalReward}</span>
                </div>
                <div class="cc-overall-bar-wrap">
                    <div class="cc-overall-bar" style="width:${overallPct}%; background:linear-gradient(90deg,${rc.color},#f0c040)"></div>
                </div>
                <div class="cc-overall-sub">${doneCount} / ${challenges.length} ${lang === 'uk' ? 'виконано' : 'completed'}</div>
            </div>
        `;
        topRow.appendChild(metaDiv);
        panel.appendChild(topRow);

        // Divider
        const divider = document.createElement('div');
        divider.className = 'cc-divider';
        panel.appendChild(divider);

        // ── Challenge rows ──
        const listEl = document.createElement('div');
        listEl.className = 'cc-challenges-list';

        challenges.forEach(ch => {
            const entry    = data[`${card.id}_${ch.key}`] || { progress: 0, claimed: false };
            const progress = Math.min(entry.progress, ch.goal);
            const pct      = Math.floor(progress / ch.goal * 100);
            const done     = progress >= ch.goal;
            const claimed  = entry.claimed;
            const labelText = lang === 'uk' ? ch.label_uk : ch.label_en;
            const icon = claimed ? '✅' : done ? '🎉' : '📌';

            const row = document.createElement('div');
            row.className = 'cc-row' + (claimed ? ' cc-claimed' : done ? ' cc-done' : '');
            row.innerHTML = `
                <div class="cc-row-icon">${icon}</div>
                <div class="cc-row-body">
                    <div class="cc-label">${labelText}</div>
                    <div class="cc-progress-wrap">
                        <div class="cc-progress-bar">
                            <div class="cc-progress-fill${done?' cc-fill-done':''}" style="width:${pct}%"></div>
                        </div>
                        <span class="cc-progress-text">${progress} / ${ch.goal}</span>
                    </div>
                </div>
                <button class="cc-claim-btn${done && !claimed ? ' cc-claim-ready' : ''}"
                        ${!done || claimed ? 'disabled' : ''}
                        data-card="${card.id}" data-key="${ch.key}">
                    ${claimed ? (lang === 'uk' ? 'Отримано' : 'Claimed') : `💰 ${ch.reward}`}
                </button>
            `;
            listEl.appendChild(row);
        });

        listEl.querySelectorAll('.cc-claim-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const earned = window.claimCardChallengeReward(parseInt(btn.dataset.card), btn.dataset.key);
                if (earned) {
                    window.showToast?.(`💰 +${earned} монет!`, 'success', '🏆', 2500);
                    window.renderChallengesTab();
                }
            });
        });

        panel.appendChild(listEl);
    }

})();

