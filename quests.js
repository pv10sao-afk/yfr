// ========== QUESTS.JS ==========
// Щоденні завдання: скидання, прогрес, нагорода, рендер.
// Залежності:
//   - constants.js    (DAILY_QUESTS)
//   - store.js        (Store)
//   - progression.js  (createEmptyQuestProgress, saveProgression)
//   - translations.js (TRANSLATIONS, currentLang)
//   - sound.js        (SoundEngine)
//   - ui.js           (showToast, showScreen)

// ========== CHECK DAILY RESET ==========

window.checkDailyQuestsReset = function () {
    const today = new Date().toISOString().split('T')[0];
    const progress = window.dailyQuestsProgress;

    if (!progress || progress.date !== today) {
        if (window.DEBUG) console.log('[quests] Resetting daily quests for:', today);

        const fresh = window.createEmptyQuestProgress
            ? window.createEmptyQuestProgress()
            : {
                date: today,
                quests: Object.fromEntries(
                    (window.DAILY_QUESTS || []).map(q => [q.id, { progress: 0, claimed: false }])
                )
            };

        Store.set('dailyQuestsProgress', fresh);
        window.saveProgression();
    }
};

// ========== UPDATE QUEST PROGRESS ==========

window.updateQuestProgress = function (questId, amount) {
    const dailyProgress = window.dailyQuestsProgress;
    if (!dailyProgress?.quests?.[questId]) return;

    const questData = dailyProgress.quests[questId];
    if (questData.claimed) return;

    const questDef = window.DAILY_QUESTS.find(q => q.id === questId);
    if (!questDef) return;

    // Якщо вже виконано — нічого не робимо
    if (questData.progress >= questDef.target) return;

    questData.progress = Math.min(questData.progress + amount, questDef.target);

    if (window.DEBUG) {
        console.log(`[quests] ${questId}: ${questData.progress}/${questDef.target}`);
    }

    // Toast + бейдж показуємо в момент виконання квесту
    if (questData.progress >= questDef.target) {
        const T = window.TRANSLATIONS?.[window.currentLang] || {};
        const questTitle = T['quest_' + questId] || questId;
        if (typeof window.showToast === 'function') {
            window.showToast(`🎯 ${questTitle} — ${T.claimReward || 'Забери нагороду!'}`, 'success', '🎁', 4000);
        }
        _updateDailyQuestsBadge();
    }

    window.saveProgression();
};

// ========== CLAIM QUEST REWARD ==========

window.claimQuestReward = function (questId) {
    const dailyProgress = window.dailyQuestsProgress;
    if (!dailyProgress?.quests?.[questId]) return;

    const questData = dailyProgress.quests[questId];
    const questDef  = window.DAILY_QUESTS.find(q => q.id === questId);
    if (!questDef) return;

    if (questData.progress < questDef.target || questData.claimed) return;

    questData.claimed = true;

    Store.update('userGold', gold => (Number(gold) || 0) + questDef.reward);
    window.achOnGoldEarned?.(questDef.reward);
    window.achOnQuestCompleted?.();

    window.saveProgression();
    window.SoundEngine.play('victory');

    const T = window.TRANSLATIONS?.[window.currentLang] || {};
    if (typeof window.showToast === 'function') {
        window.showToast(`+${questDef.reward} 💰`, 'success', '🎁');
    }

    _updateDailyQuestsBadge();
    window.renderDailyQuests();
};

// ========== BADGE НА КНОПЦІ КВЕСТІВ ==========

function _updateDailyQuestsBadge() {
    const btn = document.getElementById('daily-quests-btn') || document.getElementById('quests-btn');
    if (!btn) return;

    const progress = window.dailyQuestsProgress;
    if (!progress?.quests) { btn.classList.remove('has-badge'); return; }

    const hasClaimable = window.DAILY_QUESTS.some(q => {
        const qd = progress.quests[q.id];
        return qd && qd.progress >= q.target && !qd.claimed;
    });

    btn.classList.toggle('has-badge', hasClaimable);
}
window._updateDailyQuestsBadge = _updateDailyQuestsBadge;

// ========== RENDER DAILY QUESTS ==========

const QUEST_ICONS = {
    play_games:      { icon: '🎮', color: '#3b82f6', glow: 'rgba(59,130,246,0.4)' },
    win_multiplayer: { icon: '🏆', color: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
    play_cards:      { icon: '🃏', color: '#8b5cf6', glow: 'rgba(139,92,246,0.4)' },
    deal_damage:     { icon: '⚔️', color: '#ef4444', glow: 'rgba(239,68,68,0.4)'  },
    destroy_units:   { icon: '💀', color: '#10b981', glow: 'rgba(16,185,129,0.4)' }
};

window.renderDailyQuests = function () {
    const container = document.getElementById('daily-quests-list');
    if (!container) return;

    const T = window.TRANSLATIONS[window.currentLang];
    container.innerHTML = '';

    const infoEl = document.createElement('div');
    infoEl.className = 'quest-reset-info';
    infoEl.innerHTML = `<span class="quest-reset-icon">🕗</span> ${T.dailyQuestsLimit}`;
    container.appendChild(infoEl);

    window.DAILY_QUESTS.forEach((questDef, index) => {
        const questData = window.dailyQuestsProgress?.quests?.[questDef.id] || { progress: 0, claimed: false };
        const isCompleted = questData.progress >= questDef.target;
        const isClaimed   = questData.claimed;
        const meta = QUEST_ICONS[questDef.id] || { icon: '📋', color: '#64748b', glow: 'rgba(100,116,139,0.3)' };

        const el = document.createElement('div');
        el.className = `quest-item${isCompleted ? ' completed' : ''}${isClaimed ? ' claimed' : ''}`;
        el.style.setProperty('--quest-color', meta.color);
        el.style.setProperty('--quest-glow', meta.glow);
        el.style.animationDelay = `${index * 0.07}s`;

        const percent  = Math.min(100, Math.floor((questData.progress / questDef.target) * 100));
        const titleStr = T['quest_' + questDef.id] || questDef.id;

        let btnContent;
        if (isClaimed)        btnContent = `<span class="quest-btn-icon">✅</span><span>${T.claimed}</span>`;
        else if (isCompleted) btnContent = `<span class="quest-btn-icon">🎁</span><span>${T.claimReward}</span>`;
        else                  btnContent = `<span class="quest-btn-icon">💰</span><span>${questDef.reward}</span>`;

        el.innerHTML = `
            <div class="quest-icon-wrap">
                <span class="quest-icon">${meta.icon}</span>
                ${isClaimed ? '<div class="quest-check">✓</div>' : ''}
            </div>
            <div class="quest-info">
                <div class="quest-header-row">
                    <h4 class="quest-title">${titleStr}</h4>
                    <span class="quest-percent-label">${percent}%</span>
                </div>
                <div class="quest-progress-container">
                    <div class="quest-progress-fill" style="width: ${percent}%"></div>
                    <div class="quest-progress-text">${questData.progress} / ${questDef.target}</div>
                </div>
            </div>
            <button class="quest-reward-btn${isCompleted && !isClaimed ? ' claimable' : ''}"
                    ${!isCompleted || isClaimed ? 'disabled' : ''}>
                ${btnContent}
            </button>
        `;

        if (isCompleted && !isClaimed) {
            el.querySelector('.quest-reward-btn').onclick = () => {
                el.classList.add('quest-claiming');
                setTimeout(() => window.claimQuestReward(questDef.id), 300);
            };
        }

        container.appendChild(el);
    });

    _updateDailyQuestsBadge();
};

// ========== BIND DAILY QUESTS BUTTON ==========

document.addEventListener('DOMContentLoaded', () => {
    const dailyBtn = document.getElementById('daily-quests-btn');
    if (dailyBtn) {
        dailyBtn.onclick = () => {
            window.checkDailyQuestsReset?.();
            window.showScreen('daily-quests-screen');
            window.renderDailyQuests();
        };
    }

    setTimeout(() => {
        window.checkDailyQuestsReset?.();
        _updateDailyQuestsBadge();
    }, 0);
});
