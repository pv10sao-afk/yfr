// ========== CAMPAIGN.JS ==========
// Кампанія: місії, запуск, відображення екрану.
// Залежності:
//   - progression.js  (campaignProgress, userDeck, MAX_DECK_SIZE)
//   - translations.js (TRANSLATIONS, currentLang)
//   - sound.js        (SoundEngine)
//   - ui.js           (showConfirmModal)
//   - cards.js        (CARD_DATABASE)
//   - game.js         (Game, showScreen) ← підключається ПІСЛЯ campaign.js
//
// УВАГА: патч Game.prototype.showGameOver залишається в game.js,
//        бо клас Game є ES-модулем і недоступний тут під час парсингу.

// ========== MISSION DATA ==========

const CAMPAIGN_MISSIONS = [
    { id: 1,  name: { uk: "Перша битва",   en: "First Battle"  }, desc: { uk: "Перемогти слабкого бота",   en: "Beat a weak bot"          }, botHp: 30,  botMaxMana: 5,  reward: 30,  cardReward: null },
    { id: 2,  name: { uk: "Тренування",    en: "Training"      }, desc: { uk: "Бот трохи сильніший",       en: "Bot is slightly stronger"  }, botHp: 35,  botMaxMana: 5,  reward: 40,  cardReward: null },
    { id: 3,  name: { uk: "Загартований",  en: "Hardened"      }, desc: { uk: "Бот має 40 HP",             en: "Bot has 40 HP"             }, botHp: 40,  botMaxMana: 6,  reward: 50,  cardReward: 11   },
    { id: 4,  name: { uk: "Натиск",        en: "Pressure"      }, desc: { uk: "Бот грає агресивніше",      en: "Bot plays aggressively"    }, botHp: 40,  botMaxMana: 6,  reward: 50,  cardReward: null },
    { id: 5,  name: { uk: "Стіна",         en: "The Wall"      }, desc: { uk: "Бот має багато броні",      en: "Bot has more armor"        }, botHp: 45,  botMaxMana: 7,  reward: 60,  cardReward: 14   },
    { id: 6,  name: { uk: "Маг",           en: "The Mage"      }, desc: { uk: "Бот використовує закляття", en: "Bot uses spells"           }, botHp: 45,  botMaxMana: 7,  reward: 70,  cardReward: null },
    { id: 7,  name: { uk: "Ветеран",       en: "Veteran"       }, desc: { uk: "Досвідчений ворог",         en: "Experienced enemy"         }, botHp: 50,  botMaxMana: 8,  reward: 80,  cardReward: 20   },
    { id: 8,  name: { uk: "Шторм",         en: "Storm"         }, desc: { uk: "Бот атакує без зупинки",    en: "Bot attacks relentlessly"  }, botHp: 50,  botMaxMana: 8,  reward: 80,  cardReward: null },
    { id: 9,  name: { uk: "Елітний",       en: "Elite"         }, desc: { uk: "Елітний ворог",             en: "Elite enemy"               }, botHp: 55,  botMaxMana: 9,  reward: 100, cardReward: 26   },
    { id: 10, name: { uk: "Полководець",   en: "Warlord"       }, desc: { uk: "Сильний полководець",       en: "Strong warlord"            }, botHp: 60,  botMaxMana: 9,  reward: 120, cardReward: 35   },
    { id: 11, name: { uk: "Темрява",       en: "Darkness"      }, desc: { uk: "Темний ворог",              en: "Dark enemy"                }, botHp: 65,  botMaxMana: 10, reward: 140, cardReward: null },
    { id: 12, name: { uk: "Некромант",     en: "Necromancer"   }, desc: { uk: "Ворог відроджує юнітів",    en: "Enemy revives units"       }, botHp: 70,  botMaxMana: 10, reward: 160, cardReward: 39   },
    { id: 13, name: { uk: "Дракон",        en: "Dragon"        }, desc: { uk: "Могутній ворог",            en: "Mighty enemy"              }, botHp: 75,  botMaxMana: 10, reward: 180, cardReward: 43   },
    { id: 14, name: { uk: "Титан",         en: "Titan"         }, desc: { uk: "Величезна сила",            en: "Enormous power"            }, botHp: 80,  botMaxMana: 10, reward: 200, cardReward: 50   },
    { id: 15, name: { uk: "Фінальний Бос", en: "Final Boss"    }, desc: { uk: "Останній виклик!",          en: "The final challenge!"      }, botHp: 100, botMaxMana: 10, reward: 500, cardReward: 52   }
];
window.CAMPAIGN_MISSIONS = CAMPAIGN_MISSIONS;

// ========== INIT CAMPAIGN SCREEN ==========

function initCampaignScreen() {
    const grid = document.getElementById('campaign-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const lang = window.currentLang;
    const progress = window.campaignProgress;

    CAMPAIGN_MISSIONS.forEach((m, idx) => {
        const isCompleted = progress.completed.includes(m.id);
        const isLocked = idx > 0 && !progress.completed.includes(CAMPAIGN_MISSIONS[idx - 1].id);
        const card = document.createElement('div');
        card.className = `mission-card ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}`;
        card.innerHTML = `
            <div class="mission-number">${m.id}</div>
            <div class="mission-name">${m.name[lang]}</div>
            <div class="mission-desc">${m.desc[lang]}</div>
            <div class="mission-reward">🏆 ${m.reward} 💰${m.cardReward ? ' + 🃏' : ''}</div>
        `;
        if (!isLocked) {
            card.onclick = () => {
                SoundEngine.play('click');
                startCampaignMission(idx);
            };
        }
        grid.appendChild(card);
    });
}
window.initCampaignScreen = initCampaignScreen;

// ========== START MISSION ==========

function startCampaignMission(missionIdx) {
    const mission = CAMPAIGN_MISSIONS[missionIdx];
    if (!mission) return;
    window.currentMission = mission;

    if (window.userDeck.length < window.MAX_DECK_SIZE) {
        window.showConfirmModal(
            window.TRANSLATIONS[window.currentLang].deckNotFull,
            () => { _startCampaignGame(missionIdx, mission, null); },
            null,
            '🎴'
        );
        return;
    }

    _startCampaignGame(missionIdx, mission, window.userDeck);
}
window.startCampaignMission = startCampaignMission;

function _startCampaignGame(missionIdx, mission, selectedDeck) {
    window.showScreen('game-container');
    const gridSize = missionIdx >= 10 ? 4 : 3;
    window.game = new Game(selectedDeck, gridSize, false, missionIdx >= 5);
    window.game.enemyHp = mission.botHp;
    // Застосовуємо botMaxMana з місії — раніше ігнорувалось і бот завжди мав дефолтну ману
    window.game.enemyMaxMana = mission.botMaxMana;
    window.game.enemyMana = mission.botMaxMana;
    window.game.isCampaign = true;
    window.game.campaignMission = mission;
    window.game.updateUI();
}
window._startCampaignGame = _startCampaignGame;
