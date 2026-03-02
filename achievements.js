// ========== ACHIEVEMENTS.JS ==========
// Система досягнень: визначення, перевірка прогресу, збереження у Firebase.
// Залежності: store.js, progression.js, translations.js, sound.js, ui.js

// ========== ВИЗНАЧЕННЯ ДОСЯГНЕНЬ ==========

window.ACHIEVEMENTS_LIST = [
    // ── Перші кроки ──────────────────────────────────────
    {
        id: 'first_game',
        icon: '🎮', rarity: 'common',
        category: 'games',
        type: 'count', stat: 'total_games', target: 1
    },
    {
        id: 'first_win',
        icon: '🏆', rarity: 'common',
        category: 'games',
        type: 'count', stat: 'total_wins', target: 1
    },
    {
        id: 'first_multiplayer',
        icon: '🌐', rarity: 'common',
        category: 'multiplayer',
        type: 'count', stat: 'multiplayer_played', target: 1
    },

    // ── Бої ──────────────────────────────────────────────
    {
        id: 'veteran',
        icon: '⚔️', rarity: 'common',
        category: 'games',
        type: 'count', stat: 'total_games', target: 10
    },
    {
        id: 'warrior',
        icon: '🗡️', rarity: 'rare',
        category: 'games',
        type: 'count', stat: 'total_games', target: 50
    },
    {
        id: 'legend',
        icon: '🌟', rarity: 'epic',
        category: 'games',
        type: 'count', stat: 'total_games', target: 100
    },
    {
        id: 'unstoppable',
        icon: '💫', rarity: 'legendary',
        category: 'games',
        type: 'count', stat: 'total_games', target: 500
    },

    // ── Перемоги ─────────────────────────────────────────
    {
        id: 'winner',
        icon: '🥇', rarity: 'common',
        category: 'games',
        type: 'count', stat: 'total_wins', target: 10
    },
    {
        id: 'champion',
        icon: '🏅', rarity: 'rare',
        category: 'games',
        type: 'count', stat: 'total_wins', target: 50
    },
    {
        id: 'grandmaster',
        icon: '👑', rarity: 'epic',
        category: 'games',
        type: 'count', stat: 'total_wins', target: 100
    },

    // ── Мультиплеєр ──────────────────────────────────────
    {
        id: 'multi_veteran',
        icon: '🤝', rarity: 'rare',
        category: 'multiplayer',
        type: 'count', stat: 'multiplayer_played', target: 10
    },
    {
        id: 'multi_champion',
        icon: '🏆', rarity: 'epic',
        category: 'multiplayer',
        type: 'count', stat: 'multiplayer_wins', target: 10
    },
    {
        id: 'multi_legend',
        icon: '🌐', rarity: 'legendary',
        category: 'multiplayer',
        type: 'count', stat: 'multiplayer_wins', target: 50
    },

    // ── Бойові дії ───────────────────────────────────────
    {
        id: 'damage_dealer',
        icon: '💥', rarity: 'common',
        category: 'combat',
        type: 'count', stat: 'total_damage', target: 100
    },
    {
        id: 'destroyer',
        icon: '💀', rarity: 'rare',
        category: 'combat',
        type: 'count', stat: 'total_damage', target: 1000
    },
    {
        id: 'annihilator',
        icon: '☠️', rarity: 'epic',
        category: 'combat',
        type: 'count', stat: 'total_damage', target: 5000
    },
    {
        id: 'unit_slayer',
        icon: '🔥', rarity: 'common',
        category: 'combat',
        type: 'count', stat: 'units_destroyed', target: 20
    },
    {
        id: 'mass_destruction',
        icon: '💣', rarity: 'rare',
        category: 'combat',
        type: 'count', stat: 'units_destroyed', target: 100
    },
    {
        id: 'card_master',
        icon: '🃏', rarity: 'common',
        category: 'combat',
        type: 'count', stat: 'cards_played', target: 50
    },
    {
        id: 'card_addict',
        icon: '🎴', rarity: 'rare',
        category: 'combat',
        type: 'count', stat: 'cards_played', target: 500
    },

    // ── Кампанія ─────────────────────────────────────────
    {
        id: 'campaign_start',
        icon: '🏰', rarity: 'common',
        category: 'campaign',
        type: 'count', stat: 'campaign_completed', target: 1
    },
    {
        id: 'campaign_half',
        icon: '🗺️', rarity: 'rare',
        category: 'campaign',
        type: 'count', stat: 'campaign_completed', target: 5
    },
    {
        id: 'campaign_master',
        icon: '🎖️', rarity: 'epic',
        category: 'campaign',
        type: 'count', stat: 'campaign_completed', target: 10
    },

    // ── Золото & Колекція ─────────────────────────────────
    {
        id: 'rich',
        icon: '💰', rarity: 'common',
        category: 'collection',
        type: 'count', stat: 'gold_earned', target: 500
    },
    {
        id: 'wealthy',
        icon: '💎', rarity: 'rare',
        category: 'collection',
        type: 'count', stat: 'gold_earned', target: 2000
    },
    {
        id: 'millionaire',
        icon: '🤑', rarity: 'epic',
        category: 'collection',
        type: 'count', stat: 'gold_earned', target: 10000
    },
    {
        id: 'collector',
        icon: '📦', rarity: 'rare',
        category: 'collection',
        type: 'count', stat: 'cards_unlocked', target: 20
    },
    {
        id: 'full_collection',
        icon: '🃏', rarity: 'legendary',
        category: 'collection',
        type: 'count', stat: 'cards_unlocked', target: 50
    },

    // ── Особливі ─────────────────────────────────────────
    {
        id: 'daily_streak',
        icon: '🔥', rarity: 'rare',
        category: 'special',
        type: 'count', stat: 'quests_completed', target: 10
    },
    {
        id: 'promo_hunter',
        icon: '🎁', rarity: 'rare',
        category: 'special',
        type: 'count', stat: 'promos_used', target: 3
    },
    {
        id: 'customizer',
        icon: '🎨', rarity: 'epic',
        category: 'special',
        type: 'flag', stat: 'bought_theme', target: 1
    },
];

// ========== КАТЕГОРІЇ ==========

window.ACHIEVEMENT_CATEGORIES = {
    all:        { uk: 'Усі',        en: 'All',        icon: '🏆' },
    games:      { uk: 'Бої',        en: 'Battles',    icon: '⚔️' },
    multiplayer:{ uk: 'Мультиплеєр',en: 'Multiplayer',icon: '🌐' },
    combat:     { uk: 'Дії',        en: 'Actions',    icon: '💥' },
    campaign:   { uk: 'Кампанія',   en: 'Campaign',   icon: '🏰' },
    collection: { uk: 'Колекція',   en: 'Collection', icon: '💎' },
    special:    { uk: 'Особливі',   en: 'Special',    icon: '✨' },
};

// ========== RARITY CONFIG ==========

const RARITY_CONFIG = {
    common:    { uk: 'Звичайне',   en: 'Common',    color: '#94a3b8', glow: 'rgba(148,163,184,0.3)', reward: 0 },
    rare:      { uk: 'Рідкісне',   en: 'Rare',      color: '#3b82f6', glow: 'rgba(59,130,246,0.35)', reward: 50 },
    epic:      { uk: 'Епічне',     en: 'Epic',      color: '#a855f7', glow: 'rgba(168,85,247,0.4)',  reward: 150 },
    legendary: { uk: 'Легендарне', en: 'Legendary', color: '#f59e0b', glow: 'rgba(245,158,11,0.45)', reward: 300 },
};

// ========== ІНІЦІАЛІЗАЦІЯ СТАНУ ==========

function _getDefaultAchievements() {
    const obj = {};
    window.ACHIEVEMENTS_LIST.forEach(a => {
        obj[a.id] = { progress: 0, unlocked: false, unlockedAt: null };
    });
    return obj;
}

function _getDefaultStats() {
    return {
        total_games: 0, total_wins: 0,
        multiplayer_played: 0, multiplayer_wins: 0,
        total_damage: 0, units_destroyed: 0, cards_played: 0,
        campaign_completed: 0, gold_earned: 0, cards_unlocked: 0,
        quests_completed: 0, promos_used: 0, bought_theme: 0,
    };
}

function _loadFromStorage() {
    try {
        const raw = localStorage.getItem('achievementsData');
        if (raw) {
            const parsed = JSON.parse(raw);
            // Додаємо нові досягнення якщо з'явились
            window.ACHIEVEMENTS_LIST.forEach(a => {
                if (!parsed.achievements[a.id]) {
                    parsed.achievements[a.id] = { progress: 0, unlocked: false, unlockedAt: null };
                }
            });
            // Додаємо нові стат-ключі
            const def = _getDefaultStats();
            Object.keys(def).forEach(k => {
                if (parsed.stats[k] === undefined) parsed.stats[k] = 0;
            });
            return parsed;
        }
    } catch (e) { console.warn('[achievements] load error', e); }
    return { achievements: _getDefaultAchievements(), stats: _getDefaultStats() };
}

// Глобальний стан
window._achievementsData = _loadFromStorage();

// ========== ЗБЕРЕЖЕННЯ ==========

let _saveTimer = null;
function _scheduleSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_doSave, 600);
}

function _doSave() {
    try {
        localStorage.setItem('achievementsData', JSON.stringify(window._achievementsData));
    } catch (e) { console.error('[achievements] save error', e); }

    // Firebase cloud save
    if (typeof window.saveAchievementsToCloud === 'function') {
        window.saveAchievementsToCloud();
    }
}

// ========== ОНОВЛЕННЯ СТАТИСТИКИ ==========

window.updateAchievementStat = function(statKey, amount) {
    if (!window._achievementsData) return;
    const stats = window._achievementsData.stats;
    if (stats[statKey] === undefined) return;

    stats[statKey] = (stats[statKey] || 0) + amount;
    _checkAll();
    _scheduleSave();
};

window.setAchievementStat = function(statKey, value) {
    if (!window._achievementsData) return;
    const stats = window._achievementsData.stats;
    if (stats[statKey] === undefined) return;
    stats[statKey] = value;
    _checkAll();
    _scheduleSave();
};

// ========== ПЕРЕВІРКА ДОСЯГНЕНЬ ==========

function _checkAll() {
    const data  = window._achievementsData;
    const stats = data.stats;
    let anyNew  = false;

    window.ACHIEVEMENTS_LIST.forEach(def => {
        const ach = data.achievements[def.id];
        if (ach.unlocked) return;

        let progress = 0;
        if (def.type === 'count' || def.type === 'flag') {
            progress = stats[def.stat] || 0;
        }

        ach.progress = Math.min(progress, def.target);

        if (progress >= def.target) {
            ach.unlocked   = true;
            ach.unlockedAt = Date.now();
            anyNew = true;
            _showUnlockToast(def);
            _giveReward(def);
        }
    });

    return anyNew;
}

function _giveReward(def) {
    const reward = RARITY_CONFIG[def.rarity]?.reward || 0;
    if (reward > 0) {
        Store.update('userGold', g => (Number(g) || 0) + reward);
        window.saveProgression?.();
    }
}

function _showUnlockToast(def) {
    const lang = window.currentLang || 'uk';
    const T    = window.TRANSLATIONS?.[lang] || {};
    const name = (T['ach_' + def.id]) || def.id;
    const reward = RARITY_CONFIG[def.rarity]?.reward || 0;
    const rewardText = reward > 0 ? ` +${reward}💰` : '';
    if (typeof window.showToast === 'function') {
        window.showToast(`${def.icon} ${name}${rewardText}`, 'success', '🏆', 5000);
    }
    window.SoundEngine?.play('victory');
    _updateAchievementsBadge();
}

// ========== BADGE НА КНОПЦІ ==========

function _updateAchievementsBadge() {
    const btn = document.getElementById('achievements-btn');
    if (!btn) return;
    const data = window._achievementsData;
    const hasNew = window.ACHIEVEMENTS_LIST.some(a => {
        const ach = data.achievements[a.id];
        return ach?.unlocked && !ach.seen;
    });
    btn.classList.toggle('has-badge', hasNew);
}
window._updateAchievementsBadge = _updateAchievementsBadge;

// ========== РЕНДЕР ЕКРАНУ ==========

let _currentCategory = 'all';

window.renderAchievements = function(category) {
    if (category) _currentCategory = category;

    const container = document.getElementById('achievements-list');
    const statsEl   = document.getElementById('achievements-stats-row');
    if (!container) return;

    const lang    = window.currentLang || 'uk';
    const T       = window.TRANSLATIONS?.[lang] || {};
    const data    = window._achievementsData;
    const total   = window.ACHIEVEMENTS_LIST.length;
    const unlocked = window.ACHIEVEMENTS_LIST.filter(a => data.achievements[a.id]?.unlocked).length;

    // Статистика вгорі
    if (statsEl) {
        const pct = Math.round((unlocked / total) * 100);
        statsEl.innerHTML = `
            <div class="ach-stats-inner">
                <div class="ach-stats-text">
                    <span class="ach-stats-count">${unlocked} / ${total}</span>
                    <span class="ach-stats-label">${T.achUnlocked || 'Відкрито'}</span>
                </div>
                <div class="ach-progress-bar-wrap">
                    <div class="ach-progress-bar-track">
                        <div class="ach-progress-bar-fill" style="width:${pct}%"></div>
                    </div>
                    <span class="ach-progress-bar-text">${pct}%</span>
                </div>
            </div>
        `;
    }

    // Фільтр по категоріях
    const filtered = _currentCategory === 'all'
        ? window.ACHIEVEMENTS_LIST
        : window.ACHIEVEMENTS_LIST.filter(a => a.category === _currentCategory);

    // Сортуємо: спочатку відкриті, потім решта за прогресом
    filtered.sort((a, b) => {
        const da = data.achievements[a.id];
        const db = data.achievements[b.id];
        if (da.unlocked && !db.unlocked) return -1;
        if (!da.unlocked && db.unlocked)  return 1;
        const pctA = da.progress / a.target;
        const pctB = db.progress / b.target;
        return pctB - pctA;
    });

    container.innerHTML = '';

    filtered.forEach((def, idx) => {
        const ach     = data.achievements[def.id];
        const rarity  = RARITY_CONFIG[def.rarity];
        const name    = T['ach_' + def.id] || def.id;
        const desc    = T['ach_desc_' + def.id] || '';
        const pct     = Math.min(100, Math.floor((ach.progress / def.target) * 100));
        const isNew   = ach.unlocked && !ach.seen;

        const el = document.createElement('div');
        el.className = `ach-item${ach.unlocked ? ' ach-unlocked' : ' ach-locked'}${isNew ? ' ach-new' : ''}`;
        el.dataset.rarity = def.rarity;
        el.style.animationDelay = `${idx * 0.04}s`;

        const unlockedDate = ach.unlockedAt
            ? new Date(ach.unlockedAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US')
            : '';

        const rewardText = rarity.reward > 0 ? `+${rarity.reward}💰` : '';

        const isSecret = !ach.unlocked && ach.progress === 0;

        el.innerHTML = `
            <div class="ach-icon-wrap${ach.unlocked ? '' : ' ach-icon-locked'}">
                <span class="ach-icon">${ach.unlocked ? def.icon : (isSecret ? '🔒' : def.icon)}</span>
                ${ach.unlocked ? '<div class="ach-check">✓</div>' : ''}
                ${isNew ? '<div class="ach-new-badge">NEW</div>' : ''}
            </div>
            <div class="ach-info">
                <div class="ach-header-row">
                    <h4 class="ach-title">${isSecret ? (T.achSecret || '???') : name}</h4>
                    <span class="ach-rarity-badge">${rarity[lang] || rarity.en}</span>
                </div>
                <p class="ach-desc">${isSecret ? (T.achSecretDesc || 'Виконай умову щоб розкрити') : desc}</p>
                <div class="ach-footer-row">
                    <div class="ach-progress-container">
                        <div class="ach-progress-fill" style="width:${pct}%"></div>
                    </div>
                    <span class="ach-progress-text">${ach.progress} / ${def.target}</span>
                    ${ach.unlocked
                        ? `<span class="ach-date">${unlockedDate}</span>`
                        : rewardText ? `<span class="ach-reward-hint">${rewardText}</span>` : ''}
                </div>
            </div>
        `;

        // Відмічаємо як "побачене" при відкритті екрану
        if (isNew) {
            ach.seen = true;
            _scheduleSave();
        }

        container.appendChild(el);
    });

    _updateAchievementsBadge();
};

// Рендер табів категорій
window.renderAchievementTabs = function() {
    const wrap = document.getElementById('achievements-tabs');
    if (!wrap) return;
    const lang = window.currentLang || 'uk';
    const data = window._achievementsData;

    wrap.innerHTML = '';
    Object.entries(window.ACHIEVEMENT_CATEGORIES).forEach(([key, cat]) => {
        const count   = key === 'all'
            ? window.ACHIEVEMENTS_LIST.filter(a => data.achievements[a.id]?.unlocked).length
            : window.ACHIEVEMENTS_LIST.filter(a => a.category === key && data.achievements[a.id]?.unlocked).length;
        const total   = key === 'all'
            ? window.ACHIEVEMENTS_LIST.length
            : window.ACHIEVEMENTS_LIST.filter(a => a.category === key).length;

        const btn = document.createElement('button');
        btn.className = `ach-tab${_currentCategory === key ? ' active' : ''}`;
        btn.innerHTML = `<span class="ach-tab-icon">${cat.icon}</span><span>${cat[lang]}</span><span class="ach-tab-count">${count}/${total}</span>`;
        btn.onclick = () => {
            _currentCategory = key;
            wrap.querySelectorAll('.ach-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.renderAchievements(key);
        };
        wrap.appendChild(btn);
    });
};

// ========== CLOUD SAVE / LOAD ==========

window.saveAchievementsToCloud = async function() {
    try {
        await window.firebaseReady;
    } catch { return; }

    const { auth, db } = await import('./firebase-config.js').catch(() => ({}));
    if (!auth?.currentUser || !db) return;

    const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    setDoc(
        doc(db, 'users', auth.currentUser.uid),
        { achievementsData: window._achievementsData },
        { merge: true }
    ).catch(e => console.error('[achievements] cloud save error', e));
};

window.loadAchievementsFromCloud = function(cloudData) {
    if (!cloudData) return;
    try {
        // Мерджимо: беремо максимальний прогрес
        const localData = window._achievementsData;
        window.ACHIEVEMENTS_LIST.forEach(def => {
            const cloud = cloudData.achievements?.[def.id];
            const local = localData.achievements[def.id];
            if (!cloud) return;
            if (cloud.unlocked && !local.unlocked) {
                local.unlocked   = cloud.unlocked;
                local.unlockedAt = cloud.unlockedAt;
                local.seen       = true; // не показуємо toast для старих
            }
            local.progress = Math.max(local.progress || 0, cloud.progress || 0);
        });
        // Stats — беремо максимум
        if (cloudData.stats) {
            Object.keys(localData.stats).forEach(k => {
                if (cloudData.stats[k] !== undefined) {
                    localData.stats[k] = Math.max(localData.stats[k] || 0, cloudData.stats[k] || 0);
                }
            });
        }
        _scheduleSave();
        _updateAchievementsBadge();
    } catch (e) { console.error('[achievements] cloud load error', e); }
};

// ========== ХУКИ ДЛЯ ПРИВ'ЯЗКИ ДО ІГРОВИХ ПОДІЙ ==========
// Викликаються ззовні (game.js, game-combat.js, shop.js тощо)

window.achOnGameEnd = function(won, isMultiplayer) {
    window.updateAchievementStat('total_games', 1);
    if (won) {
        window.updateAchievementStat('total_wins', 1);
    }
    if (isMultiplayer) {
        window.updateAchievementStat('multiplayer_played', 1);
        if (won) window.updateAchievementStat('multiplayer_wins', 1);
    }
};

window.achOnDamage = function(amount) {
    window.updateAchievementStat('total_damage', amount);
};

window.achOnUnitDestroyed = function() {
    window.updateAchievementStat('units_destroyed', 1);
};

window.achOnCardPlayed = function() {
    window.updateAchievementStat('cards_played', 1);
};

window.achOnGoldEarned = function(amount) {
    window.updateAchievementStat('gold_earned', amount);
};

window.achOnQuestCompleted = function() {
    window.updateAchievementStat('quests_completed', 1);
};

window.achOnPromoClaimed = function() {
    window.updateAchievementStat('promos_used', 1);
};

window.achOnThemeBought = function() {
    window.setAchievementStat('bought_theme', 1);
};

window.achOnCampaignLevel = function() {
    window.updateAchievementStat('campaign_completed', 1);
};

window.achOnCardUnlocked = function(totalUnlocked) {
    window.setAchievementStat('cards_unlocked', totalUnlocked);
};

// ========== ІНІЦІАЛІЗАЦІЯ ==========

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('achievements-btn');
    if (btn) {
        btn.onclick = () => {
            window.showScreen('achievements-screen');
            window.renderAchievementTabs();
            window.renderAchievements('all');
        };
    }

    // Синхронізуємо кількість карт
    const unlocked = window.unlockedCards;
    if (unlocked) {
        const count = unlocked instanceof Set ? unlocked.size : (Array.isArray(unlocked) ? unlocked.length : 0);
        if (count > 0) window.setAchievementStat('cards_unlocked', count);
    }

    // Синхронізуємо статистику з userStats — завжди перезаписуємо,
    // бо userStats є єдиним джерелом правди для лічильників ігор
    const stats = window.userStats;
    if (stats) {
        const s = window._achievementsData.stats;
        if (stats.bot) {
            s.total_games = stats.bot.played || 0;
            s.total_wins  = stats.bot.won   || 0;
        }
        if (stats.multiplayer) {
            s.multiplayer_played = stats.multiplayer.played || 0;
            s.multiplayer_wins   = stats.multiplayer.won   || 0;
        }
        // Скидаємо досягнення, що були помилково розблоковані через старий баг з +=
        window.ACHIEVEMENTS_LIST.forEach(def => {
            const ach = window._achievementsData.achievements[def.id];
            if (!ach || !ach.unlocked) return;
            const currentStat = window._achievementsData.stats[def.stat] || 0;
            if (currentStat < def.target) {
                ach.unlocked   = false;
                ach.unlockedAt = null;
                ach.seen       = false;
                ach.progress   = Math.min(currentStat, def.target);
            }
        });
        _checkAll();
        _scheduleSave();
    }

    setTimeout(_updateAchievementsBadge, 500);
});
