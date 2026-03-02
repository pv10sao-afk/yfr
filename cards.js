const CARD_DATABASE = [
    {
        id: 1,
        name: { uk: "Воїн Світла", en: "Light Warrior" },
        type: "unit",
        mana: 1,
        hp: 5,
        damage: 2,
        armor: 1,
        range: 1,
        rarity: 'common',
        description: { uk: "Базовий юніт, дальність 1.", en: "Basic unit, range 1." }
    },
    {
        id: 2,
        name: { uk: "Лучник Лісу", en: "Forest Archer" },
        type: "unit",
        mana: 2,
        hp: 3,
        damage: 4,
        armor: 0,
        range: 3,
        rarity: 'rare',
        description: { uk: "Стріляє здалеку, дальність 3.", en: "Shoots from afar, range 3." }
    },
    {
        id: 3,
        name: { uk: "Залізний Лицар", en: "Iron Knight" },
        type: "unit",
        mana: 3,
        hp: 8,
        damage: 3,
        armor: 3,
        range: 1,
        rarity: 'rare',
        description: { uk: "Стіна з металу, дальність 1.", en: "A wall of metal, range 1." }
    },
    {
        id: 4,
        name: { uk: "Магічне Зілля", en: "Magic Potion" },
        type: "spell",
        mana: 1,
        hp: 0,
        damage: 0,
        armor: 0,
        range: 9,
        rarity: 'common',
        effect: { type: "heal", value: 4 },
        description: { uk: "Відновлює 4 HP союзнику.", en: "Restores 4 HP to an ally." }
    },
    {
        id: 5,
        name: { uk: "Сталева Шкіра", en: "Steel Skin" },
        type: "spell",
        mana: 2,
        hp: 0,
        damage: 0,
        armor: 0,
        range: 9,
        rarity: 'common',
        effect: { type: "buff_armor", value: 2 },
        description: { uk: "+2 до броні назавжди.", en: "Adds +2 armor permanently." }
    },
    {
        id: 6,
        name: { uk: "Вогняна куля", en: "Fireball" },
        type: "spell",
        mana: 2,
        hp: 0,
        damage: 0,
        armor: 0,
        range: 9,
        rarity: 'rare',
        effect: { type: "damage", value: 3 },
        description: { uk: "3 урону будь-кому.", en: "3 damage to anyone." }
    },
    {
        id: 7,
        name: { uk: "Магічне Дзеркало", en: "Magic Mirror" },
        type: "spell",
        mana: 4,
        hp: 0,
        damage: 0,
        armor: 0,
        range: 9,
        rarity: 'epic',
        effect: { type: "copy_stats" },
        description: { uk: "Копіює статы ворожої карти.", en: "Copies stats of an enemy card." }
    },
    {
        id: 8,
        name: { uk: "Гігант", en: "Giant" },
        type: "unit",
        mana: 5,
        hp: 13,
        damage: 5,
        armor: 2,
        range: 1,
        rarity: 'epic',
        description: { uk: "Могутній велетень, дальність 1.", en: "Powerful giant, range 1." }
    },
    {
        id: 9,
        name: { uk: "Отруйний Плющ", en: "Poison Ivy" },
        type: "spell",
        mana: 1,
        hp: 0,
        damage: 0,
        armor: 0,
        range: 9,
        rarity: 'common',
        effect: { type: "damage", value: 1 },
        description: { uk: "Наносить 1 одиницю урону.", en: "Deals 1 damage." }
    },
    {
        id: 10,
        name: { uk: "Щит Оберігач", en: "Guardian Shield" },
        type: "unit",
        mana: 2,
        hp: 6,
        damage: 1,
        armor: 4,
        range: 1,
        rarity: 'rare',
        description: { uk: "Висока броня, дальність 1.", en: "High armor, range 1." }
    },
    {
        id: 11,
        name: { uk: "Вбивця Тіней", en: "Shadow Assassin" },
        type: "unit",
        mana: 3,
        hp: 3,
        damage: 6,
        armor: 0,
        range: 1,
        rarity: 'rare',
        description: { uk: "Величезний урон, але слабке здоров'я.", en: "Huge damage, but low health." }
    },
    {
        id: 12,
        name: { uk: "Телепорт", en: "Teleport" },
        type: "spell",
        mana: 1,
        rarity: 'epic',
        effect: { type: "move_any" },
        description: { uk: "Перемісти свою карту в будь-яку вільну клітину.", en: "Move your card to any free cell." }
    },
    {
        id: 13,
        name: { uk: "Молодий Маг", en: "Young Mage" },
        type: "unit",
        mana: 2,
        hp: 4,
        damage: 2,
        armor: 0,
        range: 2,
        rarity: 'rare',
        onPlayEffect: { type: "add_mana", value: 1 },
        description: { uk: "При виставленні дає +1 ману на цей хід.", en: "Gains +1 mana this turn when played." }
    },
    {
        id: 14,
        name: { uk: "Землетрус", en: "Earthquake" },
        type: "spell",
        mana: 5,
        rarity: 'epic',
        effect: { type: "damage_all_enemies", value: 2 },
        description: { uk: "Наносить 2 урону всім ворогам на полі.", en: "Deals 2 damage to all enemies on board." }
    },
    {
        id: 15,
        name: { uk: "Кам'яний Голем", en: "Stone Golem" },
        type: "unit",
        mana: 4,
        hp: 9,
        damage: 3,
        armor: 1,
        range: 1,
        rarity: 'rare',
        description: { uk: "Важкий та надійний юніт.", en: "Heavy and reliable unit." }
    },
    {
        id: 16,
        name: { uk: "Крижана Стріла", en: "Ice Arrow" },
        type: "spell",
        mana: 2,
        rarity: 'rare',
        effect: { type: "freeze", duration: 1 },
        description: { uk: "Заморожує ворога (він не може ходити 1 хід).", en: "Freezes an enemy (cannot move for 1 turn)." }
    },
    {
        id: 17,
        name: { uk: "Алхімік", en: "Alchemist" },
        type: "unit",
        mana: 3,
        hp: 5,
        damage: 2,
        armor: 0,
        range: 2,
        rarity: 'rare',
        onPlayEffect: { type: "draw_card", value: 1 },
        description: { uk: "При появі дозволяє взяти ще одну карту.", en: "Draws an extra card when played." }
    },
    {
        id: 18,
        name: { uk: "Порив Вітру", en: "Wind Gust" },
        type: "spell",
        mana: 1,
        rarity: 'common',
        effect: { type: "push_back" },
        description: { uk: "Відштовхує ворожу карту на 1 клітину назад.", en: "Pushes an enemy card back by 1 cell." }
    },
    {
        id: 19,
        name: { uk: "Берсерк", en: "Berserker" },
        type: "unit",
        mana: 3,
        hp: 7,
        damage: 3,
        armor: 0,
        range: 1,
        rarity: 'rare',
        description: { uk: "Отримує +1 до атаки, коли його б'ють.", en: "Gains +1 attack when damaged." }
    },
    {
        id: 20,
        name: { uk: "Святе Сяйво", en: "Holy Radiance" },
        type: "spell",
        mana: 4,
        rarity: 'epic',
        effect: { type: "heal_all_allies", value: 3 },
        description: { uk: "Лікує всіх твоїх юнітів на 3 HP.", en: "Heals all your units for 3 HP." }
    },
    {
        id: 21,
        name: { uk: "Вампір", en: "Vampire" },
        type: "unit",
        mana: 5,
        hp: 4,
        damage: 3,
        armor: 0,
        range: 1,
        rarity: 'epic',
        description: { uk: "Викрадення життя: відновлює HP рівне нанесеному урону.", en: "Lifesteal: restores HP equal to damage dealt." }
    },
    {
        id: 22,
        name: { uk: "Сквайр", en: "Squire" },
        type: "unit",
        mana: 1,
        hp: 3,
        damage: 1,
        armor: 0,
        range: 1,
        rarity: 'common',
        description: { uk: "На початку ходу дає +1 атаки союзнику попереду.", en: "Start of turn: gives +1 Attack to ally in front." }
    },
    {
        id: 23,
        name: { uk: "Іржа", en: "Rust" },
        type: "spell",
        mana: 1,
        rarity: 'common',
        effect: { type: "reduce_armor", value: 2 },
        description: { uk: "Зменшує броню ворога на 2.", en: "Reduces enemy armor by 2." }
    },
    {
        id: 24,
        name: { uk: "Вартовий Порталу", en: "Portal Guardian" },
        type: "unit",
        mana: 3,
        hp: 5,
        damage: 2,
        armor: 1,
        range: 2,
        rarity: 'rare',
        description: { uk: "В кінці ходу міняється місцями з випадковим союзником.", en: "End of turn: swaps with random ally." }
    },
    {
        id: 25,
        name: { uk: "Магічний Ланцюг", en: "Magic Chain" },
        type: "spell",
        mana: 2,
        rarity: 'rare',
        effect: { type: "magic_chain" },
        description: { uk: "Ціль отримує такий же урон, як і інші вороги в цей хід.", en: "Target takes same damage as other enemies this turn." }
    },
    {
        id: 26,
        name: { uk: "Осквернитель", en: "Defiler" },
        type: "unit",
        mana: 4,
        hp: 6,
        damage: 3,
        armor: 0,
        range: 1,
        rarity: 'rare',
        description: { uk: "На початку кожного ходу: 1 урон усім сусідам.", en: "Start of every turn: 1 damage to all neighbors." }
    },
    {
        id: 27,
        name: { uk: "Дракон Пустоти", en: "Void Dragon" },
        type: "unit",
        mana: 6,
        hp: 10,
        damage: 4,
        armor: 2,
        range: 3,
        rarity: 'epic',
        description: { uk: "Пробиває ціль: наносить 50% урону юніту позаду.", en: "Piercing attack: deals 50% damage to unit behind." }
    },
    {
        id: 28,
        name: { uk: "Часова Петля", en: "Time Loop" },
        type: "spell",
        mana: 4,
        rarity: 'epic',
        effect: { type: "time_loop" },
        description: { uk: "Повертає HP та Armor всіх карт до стану на початок ходу.", en: "Reverts HP and Armor of all cards to start of turn." }
    },
    {
        id: 29,
        name: { uk: "Чорнокнижник Розпаду", en: "Decay Warlock" },
        type: "unit",
        mana: 3,
        hp: 4,
        damage: 2,
        armor: 1,
        range: 1,
        rarity: 'rare',
        description: { uk: "Аура: Зменшує лікування ворогів на 50%.", en: "Aura: Reduces enemy healing by 50%." }
    },
    {
        id: 30,
        name: { uk: "Старе Прокляття", en: "Ancient Curse" },
        type: "spell",
        mana: 2,
        rarity: 'rare',
        effect: { type: "permanent_weaken", value: 2 },
        description: { uk: "Назавжди зменшує урон ворога на 2 (мінімум до 0).", en: "Permanently reduces enemy damage by 2 (min 0)." }
    },
    {
        id: 31,
        name: { uk: "Примарний Кат", en: "Spectral Executioner" },
        type: "unit",
        mana: 4,
        hp: 4,
        damage: 2,
        armor: 0,
        range: 1,
        rarity: 'epic',
        onPlayEffect: { type: "weaken_row", value: 1 },
        description: { uk: "При виставленні: -1 урону всім ворогам у ряду назавжди.", en: "On Play: -1 damage to all enemies in this row permanently." }
    },
    {
        id: 32,
        name: { uk: "Жриця Життя", en: "Priestess of Life" },
        type: "unit",
        mana: 4,
        hp: 5,
        damage: 1,
        armor: 0,
        range: 1,
        rarity: 'rare',
        description: { uk: "Аура: В кінці ходу лікує сусідніх союзників на 2 HP.", en: "Aura: Heals adjacent allies by 2 HP at end of turn." }
    },
    {
        id: 33,
        name: { uk: "Камікадзе", en: "Kamikaze" },
        type: "unit",
        mana: 2,
        hp: 1,
        damage: 10,
        armor: 0,
        range: 1,
        rarity: 'common',
        description: { uk: "Помирає після першої ж атаки.", en: "Dies after first attack." }
    },
    {
        id: 34,
        name: { uk: "Прапороносець", en: "Flag Bearer" },
        type: "unit",
        mana: 4,
        hp: 5,
        damage: 1,
        armor: 2,
        range: 0,
        rarity: 'rare',
        description: { uk: "Аура: Всі союзники отримують +1 до атаки і +1 до броні.", en: "Aura: All allies gain +1 attack +1 armor." }
    },
    {
        id: 35,
        name: { uk: "Армагеддон", en: "Armageddon" },
        type: "spell",
        mana: 9,
        rarity: 'epic',
        effect: { type: "destroy_all" },
        description: { uk: "Знищує ВСІХ юнітів на полі (і твоїх теж).", en: "Destroys ALL units on the board." }
    },
    {
        id: 36,
        name: { uk: "Контроль Розуму", en: "Mind Control" },
        type: "spell",
        mana: 7,
        rarity: 'epic',
        effect: { type: "steal_unit" },
        description: { uk: "Забирає ворожого юніта на твій бік.", en: "Steals an enemy unit to your side." }
    },
    {
        id: 37,
        name: { uk: "Руйнівник Чар", en: "Spellbreaker" },
        type: "unit",
        mana: 4,
        hp: 6,
        damage: 3,
        armor: 1,
        range: 1,
        rarity: 'rare',
        description: { uk: "Імунітет до заклять ворога.", en: "Immune to enemy spells." }
    },
    {
        id: 38,
        name: { uk: "Гідра", en: "Hydra" },
        type: "unit",
        mana: 6,
        hp: 5,
        damage: 2,
        armor: 0,
        range: 1,
        rarity: 'epic',
        description: { uk: "Кожен раз, коли отримує урон, подвоює атаку.", en: "Doubles attack whenever it takes damage." }
    },
    {
        id: 39,
        name: { uk: "Вампіризм", en: "Vampirism" },
        type: "spell",
        mana: 4,
        rarity: 'epic',
        effect: { type: "buff_lifesteal" },
        description: { uk: "Надає союзнику здатність лікуватися від атак.", en: "Gives ally Lifesteal ability." }
    },
    {
        id: 40,
        name: { uk: "Гвардієць", en: "Guardsman" },
        type: "unit",
        mana: 2,
        hp: 4,
        damage: 2,
        armor: 3,
        range: 1,
        rarity: 'common',
        description: { uk: "Має вроджену високу броню.", en: "Has high innate armor." }
    },
    {
        id: 41,
        name: { uk: "Метальник Ножів", en: "Knife Thrower" },
        type: "unit",
        mana: 2,
        hp: 2,
        damage: 3,
        armor: 0,
        range: 2,
        rarity: 'common',
        description: { uk: "Дешевий юніт дальнього бою.", en: "Cheap ranged unit." }
    },
    {
        id: 42,
        name: { uk: "Лють Берсерка", en: "Berserker Rage" },
        type: "spell",
        mana: 4,
        rarity: 'rare',
        effect: { type: "buff_damage", value: 3 },
        description: { uk: "Юніт отримує +3 до Атаки назавжди.", en: "Unit gets +3 Attack permanently." }
    },
    {
        id: 43,
        name: { uk: "Чумний Лікар", en: "Plague Doctor" },
        type: "unit",
        mana: 3,
        hp: 4,
        damage: 2,
        armor: 0,
        range: 1,
        rarity: 'rare',
        description: { uk: "Його атаки ігнорують 50% броні.", en: "Attacks ignore 50% armor." }
    },
    {
        id: 44,
        name: { uk: "Стіна Вогню", en: "Wall of Fire" },
        type: "spell",
        mana: 4,
        rarity: 'epic',
        effect: { type: "damage_row", value: 3 },
        description: { uk: "Наносить 3 урону всім ворогам у ряду.", en: "Deals 3 damage to all enemies in a row." }
    },
    {
        id: 45,
        name: { uk: "Драконоборець", en: "Dragonslayer" },
        type: "unit",
        mana: 4,
        hp: 5,
        damage: 3,
        armor: 1,
        range: 1,
        rarity: 'epic',
        description: { uk: "Наносить подвійний урон, якщо у цілі більше 10 HP.", en: "Double damage if target has >10 HP." }
    },
    {
        id: 46,
        name: { uk: "Важкий Арбалетник", en: "Heavy Crossbowman" },
        type: "unit",
        mana: 3,
        hp: 3,
        damage: 3,
        armor: 1,
        range: 3,
        rarity: 'rare',
        description: { uk: "Ігнорує 1 одиницю броні цілі.", en: "Ignores 1 point of target's armor." }
    },
    {
        id: 47,
        name: { uk: "Охоронець", en: "Bodyguard" },
        type: "unit",
        mana: 2,
        hp: 3,
        damage: 1,
        armor: 1,
        range: 1,
        rarity: 'common',
        description: { uk: "Сусідні союзники отримують +1 Броні.", en: "Adjacent allies get +1 Armor." }
    },
    {
        id: 48,
        name: { uk: "Кислотна Бомба", en: "Acid Bomb" },
        type: "spell",
        mana: 3,
        rarity: 'rare',
        effect: { type: "destroy_armor" },
        description: { uk: "Знищує всю броню обраного юніта.", en: "Destroys all armor of target unit." }
    },
    {
        id: 49,
        name: { uk: "Розколювання", en: "Sunder" },
        type: "spell",
        mana: 3,
        rarity: 'rare',
        effect: { type: "half_hp" },
        description: { uk: "Зменшує поточне здоров'я ворога вдвічі.", en: "Halves enemy's current health." }
    },
    {
        id: 50,
        name: { uk: "Рустам: Аналітик", en: "Rustam: The Analyst" },
        type: "unit",
        mana: 4,
        hp: 12,
        damage: 1,
        armor: 4,
        range: 2,
        rarity: 'legendary',
        onPlayEffect: { type: "reduce_enemy_mana", value: 2 },
        description: {
            uk: "При виході: ворог -2 мани. Пасивно: +2 HP/Armor за кожен зіграний юніт.",
            en: "On Play: enemy -2 mana. Passive: +2 HP/Armor per unit played."
        }
    },
    {
        id: 51,
        name: { uk: "Нікіта: Залізний Кураж", en: "Nikita: Iron Courage" },
        type: "unit",
        mana: 6,
        hp: 14,
        damage: 4,
        armor: 3,
        range: 1,
        rarity: 'legendary',
        description: {
            uk: "Аура: В кінці ходу сусіди отримують +2 до Атаки. Коли його атакують: отримує +2 до HP.",
            en: "Aura: Adjacent allies gain +2 Attack at turn end. When attacked: gains +2 HP."
        }
    },
    {
        id: 52,
        name: { uk: "Максим: Зірка Політехніки", en: "Max: Star of Polytechnic" },
        type: "unit",
        mana: 5,
        hp: 16,
        damage: 0,
        armor: 4,
        range: 1,
        rarity: 'legendary',
        onPlayEffect: { type: "freeze_all_enemies" },
        description: {
            uk: "При виході: вороги не можуть ходити та атакувати 1 хід. Щоходу: всі союзні юніти +2 HP.",
            en: "On Play: enemies cannot move or attack for 1 turn. Every turn: all allied units +2 HP."
        }
    },
    {
        id: 53,
        name: { uk: "Артем: Тіньовий Стратег", en: "Artem: Shadow Strategist" },
        type: "unit",
        mana: 6,
        hp: 10,
        damage: 4,
        armor: 2,
        range: 2,
        rarity: 'legendary',
        onPlayEffect: { type: "prime_next_unit_x2" },
        description: {
            uk: "Невидимий для магії, поки є союзники. Ігнорує броню. Наступний ваш юніт отримує x2 до всіх статів.",
            en: "Untargetable by spells while allies present. Ignores armor. Your next unit gets x2 to all stats."
        }
    },
    {
        id: 54,
        name: { uk: "Дзеркальний Дроїд", en: "Mirror Droid" },
        type: "unit",
        mana: 4,
        hp: 6,
        damage: 0,
        armor: 2,
        range: 1,
        rarity: 'epic',
        description: {
            uk: "Його Атака завжди дорівнює Атаці юніта навпроти нього. Якщо навпроти порожньо — Атака 0.",
            en: "Its Attack always equals the Attack of the unit opposite to it. If opposite is empty - Attack 0."
        }
    },
    {
        id: 55,
        name: { uk: "Нестабільний Елементаль", en: "Unstable Elemental" },
        type: "unit",
        mana: 6,
        hp: 8,
        damage: 4,
        armor: 2,
        range: 1,
        rarity: 'epic',
        description: {
            uk: "Щоходу втрачає 2 HP і отримує +5 Атаки. Коли HP впаде нижче 3, вибухає (6 урону сусідам) і стає Вогняним Титаном (20 HP / 15 Атаки).",
            en: "Loses 2 HP and gains +5 Attack each turn. When HP drops below 3, explodes (6 damage to neighbors) and becomes a Fire Titan (20 HP / 15 Attack)."
        }
    },
    {
        id: 56,
        name: { uk: "Тіньовий Зв'язківець", en: "Shadow Binder" },
        type: "unit",
        mana: 3,
        hp: 8,
        damage: 3,
        armor: 2,
        range: 1,
        rarity: 'rare',
        description: {
            uk: "Коли отримує урон, він передає 50% цього урону випадковому ворожому юніту.",
            en: "When damaged, it reflects 50% of the damage to a random enemy unit."
        }
    },
    {
        id: 57,
        name: { uk: "Чумний Щур", en: "Plague Rat" },
        type: "unit",
        mana: 1,
        hp: 2,
        damage: 1,
        armor: 0,
        range: 1,
        rarity: 'common',
        description: {
            uk: "Deathrattle: Коли цей юніт гине, він наносить 2 урону юніту, який його вбив, і зменшує його броню на 2.",
            en: "Deathrattle: When this unit dies, it deals 2 damage to its killer and reduces its armor by 2."
        }
    },
    {
        id: 58,
        name: { uk: "Списоносець Авангарду", en: "Vanguard Spearman" },
        type: "unit",
        mana: 2,
        hp: 6,
        damage: 3,
        armor: 1,
        range: 2,
        rarity: 'common',
        description: {
            uk: "Має Range 2, але може атакувати тільки по прямій лінії (у своєму стовпчику).",
            en: "Has Range 2, but can only attack in a straight line (in its own column)."
        }
    },
    {
        id: 59,
        name: { uk: "Адреналін", en: "Adrenaline" },
        type: "spell",
        mana: 1,
        rarity: 'common',
        effect: { type: "adrenaline" },
        description: {
            uk: "Вибраний юніт може атакувати ще раз у цей хід, але втрачає 3 HP.",
            en: "Selected unit can attack again this turn, but loses 3 HP."
        }
    },
    {
        id: 60,
        name: { uk: "Енергетичний Сплеск", en: "Energy Surge" },
        type: "spell",
        mana: 2,
        rarity: 'rare',
        effect: { type: "energy_surge" },
        description: {
            uk: "Наносить X урону ворожому юніту, де X — ваша поточна мана, що залишилася після розігрування цієї карти.",
            en: "Deals X damage to an enemy unit, where X is your remaining mana after playing this card."
        }
    },
    {
        id: 61,
        name: { uk: "Кровопивця", en: "Bloodsucker" },
        type: "unit",
        mana: 3,
        hp: 6,
        damage: 3,
        armor: 1,
        range: 1,
        rarity: 'rare',
        description: {
            uk: "Щоразу, коли будь-який юніт на полі отримує урон, цей юніт відновлює собі 1 HP (до ліміту 40).",
            en: "Whenever any unit takes damage, this unit restores 1 HP to itself (up to 40 max)."
        }
    },
    {
        id: 62,
        name: { uk: "Майстер Рикошету", en: "Master of Ricochet" },
        type: "unit",
        mana: 4,
        hp: 6,
        damage: 4,
        armor: 0,
        range: 3,
        rarity: 'epic',
        description: {
            uk: "Якщо його атака вбиває ціль, стріла летить далі у випадкового ворога за спиною цілі, наносячи ті самі 4 урону.",
            en: "If its attack kills the target, the arrow continues to an enemy behind the target, dealing the same 4 damage."
        }
    },
    {
        id: 63,
        name: { uk: "Мисливець на Відьом", en: "Witch Hunter" },
        type: "unit",
        mana: 3,
        hp: 6,
        damage: 3,
        armor: 0,
        range: 2,
        rarity: 'rare',
        description: {
            uk: "Наносить подвійний урон по юнітах, які мають будь-які активні бафи (appliedAuras).",
            en: "Deals double damage to units with any active buffs (appliedAuras)."
        }
    },
    {
        id: 64,
        name: { uk: "Останнє Бажання", en: "Last Wish" },
        type: "spell",
        mana: 3,
        rarity: 'epic',
        effect: { type: "buff_revive" },
        description: {
            uk: "Виберіть союзного юніта. Наступного разу, коли він загине, він автоматично відродиться з 5 HP на тій самій клітині.",
            en: "Select an allied unit. The next time it dies, it will automatically revive with 5 HP on the same cell."
        }
    },
    {
        id: 65,
        name: { uk: "Командир Гвардії", en: "Commander of the Guard" },
        type: "unit",
        mana: 4,
        hp: 10,
        damage: 3,
        armor: 3,
        range: 1,
        rarity: 'epic',
        description: {
            uk: "Аура: Всі ваші юніти з рідкістю Common отримують +2 до Атаки та +2 до Броні, поки він на полі.",
            en: "Aura: All your Common rarity units gain +2 Attack and +2 Armor while he is on the field."
        }
    },
    {
        id: 66,
        name: { uk: "Молодий Кактус", en: "Young Cactus" },
        type: "unit",
        mana: 1,
        hp: 4,
        damage: 1,
        armor: 0,
        range: 1,
        rarity: 'common',
        thorns: 1,
        description: { uk: "Шипи I: Повертає 1 урону нападнику.", en: "Thorns I: Returns 1 damage to attacker." }
    },
    {
        id: 67,
        name: { uk: "Залізний Їжак", en: "Iron Hedgehog" },
        type: "unit",
        mana: 3,
        hp: 7,
        damage: 2,
        armor: 1,
        range: 1,
        rarity: 'rare',
        thorns: 2,
        description: { uk: "Шипи II: Повертає 2 урону нападнику.", en: "Thorns II: Returns 2 damage to attacker." }
    },
    {
        id: 68,
        name: { uk: "Терновий Вартовий", en: "Thorn Guardian" },
        type: "unit",
        mana: 5,
        hp: 12,
        damage: 3,
        armor: 2,
        range: 1,
        rarity: 'epic',
        thorns: 3,
        description: { uk: "Шипи III: Повертає 3 урону нападнику.", en: "Thorns III: Returns 3 damage to attacker." }
    },
    {
        id: 69,
        name: { uk: "Тернова Оболонка", en: "Thorn Shell" },
        type: "spell",
        mana: 1,
        rarity: 'common',
        effect: { type: "buff_thorns", value: 1 },
        description: { uk: "Надає юніту Шипи I (1 урон у відповідь).", en: "Gives a unit Thorns I (1 return damage)." }
    },
    {
        id: 70,
        name: { uk: "Шипована Броня", en: "Spiked Armor" },
        type: "spell",
        mana: 2,
        rarity: 'rare',
        effect: { type: "buff_thorns", value: 2 },
        description: { uk: "Надає юніту Шипи II (2 урона у відповідь).", en: "Gives a unit Thorns II (2 return damage)." }
    },
    {
        id: 71,
        name: { uk: "Прокляття Тернів", en: "Curse of Thorns" },
        type: "spell",
        mana: 3,
        rarity: 'epic',
        effect: { type: "buff_thorns", value: 3 },
        description: { uk: "Надає юніту Шипи III (3 урона у відповідь).", en: "Gives a unit Thorns III (3 return damage)." }
    }
];
window.CARD_DATABASE = CARD_DATABASE;
