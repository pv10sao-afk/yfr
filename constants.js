// ========== CONSTANTS.JS ==========
// Всі бази даних та константи гри. Підключається перед game.js.

// ========== AVATAR DATABASE ==========
const AVATAR_DATABASE = [
    { id: 'heart', emoji: '❤️', name: { uk: 'Серце', en: 'Heart' }, price: 0, rarity: 'common' },
    { id: 'dragon', emoji: '🐉', name: { uk: 'Дракон', en: 'Dragon' }, price: 100, rarity: 'common' },
    { id: 'lion', emoji: '🦁', name: { uk: 'Лев', en: 'Lion' }, price: 100, rarity: 'common' },
    { id: 'fire', emoji: '🔥', name: { uk: 'Вогонь', en: 'Fire' }, price: 150, rarity: 'rare' },
    { id: 'bolt', emoji: '⚡', name: { uk: 'Блискавка', en: 'Lightning' }, price: 150, rarity: 'rare' },
    { id: 'star', emoji: '🌟', name: { uk: 'Зірка', en: 'Star' }, price: 200, rarity: 'rare' },
    { id: 'mask', emoji: '🎭', name: { uk: 'Маска', en: 'Mask' }, price: 200, rarity: 'rare' },
    { id: 'fox', emoji: '🦊', name: { uk: 'Лисиця', en: 'Fox' }, price: 250, rarity: 'epic' },
    { id: 'gem', emoji: '💎', name: { uk: 'Діамант', en: 'Diamond' }, price: 300, rarity: 'epic' },
    { id: 'sword', emoji: '🗡️', name: { uk: 'Меч', en: 'Sword' }, price: 300, rarity: 'epic' },
    { id: 'crown', emoji: '👑', name: { uk: 'Корона', en: 'Crown' }, price: 400, rarity: 'legendary' },
    { id: 'skull', emoji: '💀', name: { uk: 'Череп', en: 'Skull' }, price: 500, rarity: 'legendary' }
];
window.AVATAR_DATABASE = AVATAR_DATABASE;

// ========== CARD SKIN DATABASE ==========
const CARD_SKIN_DATABASE = [
    { id: 'default', cssClass: '', name: { uk: 'Стандартний', en: 'Default' }, price: 0, rarity: 'common' },
    { id: 'frost', cssClass: 'card-skin-frost', name: { uk: 'Крижаний', en: 'Frost' }, price: 200, rarity: 'rare' },
    { id: 'inferno', cssClass: 'card-skin-inferno', name: { uk: 'Пекельний', en: 'Inferno' }, price: 300, rarity: 'rare' },
    { id: 'nature', cssClass: 'card-skin-nature', name: { uk: 'Природа', en: 'Nature' }, price: 250, rarity: 'rare' },
    { id: 'shadow', cssClass: 'card-skin-shadow', name: { uk: 'Тіньовий', en: 'Shadow' }, price: 400, rarity: 'epic' },
    { id: 'royal', cssClass: 'card-skin-royal', name: { uk: 'Королівський', en: 'Royal' }, price: 500, rarity: 'legendary' }
];
window.CARD_SKIN_DATABASE = CARD_SKIN_DATABASE;

// ========== MENU THEME DATABASE ==========
const MENU_THEME_DATABASE = [
    { id: 'default', name: { uk: 'Класичний', en: 'Classic' }, price: 0, rarity: 'common', cssClass: '' },
    { id: 'neon', name: { uk: 'Неон', en: 'Neon' }, price: 200, rarity: 'rare', cssClass: 'theme-neon' },
    { id: 'blood', name: { uk: 'Кривавий', en: 'Blood' }, price: 250, rarity: 'rare', cssClass: 'theme-blood' },
    { id: 'ocean', name: { uk: 'Океан', en: 'Ocean' }, price: 300, rarity: 'rare', cssClass: 'theme-ocean' },
    { id: 'emerald', name: { uk: 'Смарагд', en: 'Emerald' }, price: 350, rarity: 'epic', cssClass: 'theme-emerald' },
    { id: 'golden', name: { uk: 'Золотий', en: 'Golden' }, price: 500, rarity: 'legendary', cssClass: 'theme-golden' }
];
window.MENU_THEME_DATABASE = MENU_THEME_DATABASE;

// ========== BOARD SKIN DATABASE ==========
const BOARD_SKIN_DATABASE = [
    { id: 'default',  cssClass: '',                  name: { uk: 'Класичне',  en: 'Classic'  }, price: 0,   rarity: 'common'    },
    { id: 'stone',    cssClass: 'board-skin-stone',   name: { uk: 'Камінь',    en: 'Stone'    }, price: 100, rarity: 'rare'      },
    { id: 'ice',      cssClass: 'board-skin-ice',     name: { uk: 'Крига',     en: 'Ice'      }, price: 100, rarity: 'rare'      },
    { id: 'lava',     cssClass: 'board-skin-lava',    name: { uk: 'Лава',      en: 'Lava'     }, price: 200, rarity: 'epic'      },
    { id: 'forest',   cssClass: 'board-skin-forest',  name: { uk: 'Ліс',       en: 'Forest'   }, price: 200, rarity: 'epic'      },
    { id: 'void',     cssClass: 'board-skin-void',    name: { uk: 'Пустота',   en: 'Void'     }, price: 400, rarity: 'legendary' },
];
window.BOARD_SKIN_DATABASE = BOARD_SKIN_DATABASE;

// ========== EMOJI DATABASE ==========
window.AVAILABLE_EMOJIS = [
    { id: '👍', price: 0 },
    { id: '😮', price: 0 },
    { id: '😠', price: 0 },
    { id: '😂', price: 0 },
    { id: '😭', price: 0 },
    { id: '🤝', price: 0 },
    { id: '😎', price: 100 },
    { id: '🔥', price: 150 },
    { id: '💀', price: 200 },
    { id: '🤡', price: 250 },
    { id: '🎉', price: 100 },
    { id: '💩', price: 300 }
];

// ========== DAILY QUESTS ==========
window.DAILY_QUESTS = [
    { id: 'play_games', target: 3, reward: 50 },
    { id: 'win_multiplayer', target: 1, reward: 100 },
    { id: 'play_cards', target: 10, reward: 40 },
    { id: 'deal_damage', target: 50, reward: 60 },
    { id: 'destroy_units', target: 5, reward: 50 }
];

// ========== GAME CONSTANTS ==========
window.MAX_DECK_SIZE = 10;
