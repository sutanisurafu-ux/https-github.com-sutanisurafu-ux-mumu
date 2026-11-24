import {
  BLOOD_CASTLE_CONFIG,
  CHARACTER_SCALING,
  DROP_RATES,
  SERVER_CONFIG,
} from '../config';
import {
  CharacterAttributes,
  CharacterClassId,
  ClassDefinition,
  ClassTier,
  DerivedStats,
  EquipmentItem,
  GROUND_LOOT_TTL_MS,
  HuntingCampDefinition,
  ItemRarity,
  ItemSlot,
  LootDrop,
  MapFenceLine,
  MapRiverStream,
  MapSceneryProp,
  MapTrailSegment,
  PlayerProgressState,
  TerritoryDefinition,
  TerritoryId,
  TerritoryMapLayout,
} from './types';

export const TERRITORIES: TerritoryDefinition[] = [
  {
    id: 'lorencia',
    name: '1. Город Лоренсия (Lorencia)',
    subtitle: 'Имперская столица рыцарей, Лавка Ханзо и первые лагеря Скелетов',
    recommendedLevel: 1,
    groundColor: '#141915',
    tileAccentColor: '#1c241e',
    gridColor: 'rgba(195, 165, 100, 0.09)',
    accentColor: '#d4a853',
    enemyLevelMultiplier: 1.0,
    targetKillsForBoss: 20,
    bossName: 'Король Скелетов Лоренсии',
  },
  {
    id: 'noria',
    name: '2. Лесной Город Нория (Noria)',
    subtitle: 'Изумрудный полис эльфов и рощи тяжёлых Каменных Големов (×2.6 мощь врагов)',
    recommendedLevel: 12,
    groundColor: '#0f1c16',
    tileAccentColor: '#162920',
    gridColor: 'rgba(52, 211, 153, 0.1)',
    accentColor: '#34d399',
    enemyLevelMultiplier: 2.6,
    targetKillsForBoss: 22,
    bossName: 'Древний Титан Нории',
  },
  {
    id: 'elbeland',
    name: '3. Бастион Эльбеланд (Elbeland)',
    subtitle: 'Туманный город призывателей, руины озера и проклятые Тотемы (×5.2 мощь врагов)',
    recommendedLevel: 24,
    groundColor: '#171524',
    tileAccentColor: '#211e33',
    gridColor: 'rgba(192, 132, 252, 0.11)',
    accentColor: '#c084fc',
    enemyLevelMultiplier: 5.2,
    targetKillsForBoss: 24,
    bossName: 'Проклятый Волк Эльбеланда',
  },
  {
    id: 'devias',
    name: '4. Снежная Крепость Девиас (Devias)',
    subtitle: 'Северная цитадель гильдий, Собор Жрицы Себины и ледяные рыцари (×9.5 мощь врагов)',
    recommendedLevel: 36,
    groundColor: '#111b24',
    tileAccentColor: '#182633',
    gridColor: 'rgba(120, 195, 245, 0.11)',
    accentColor: '#67b7e8',
    enemyLevelMultiplier: 9.5,
    targetKillsForBoss: 25,
    bossName: 'Ледяная Королева Девиаса',
  },
  {
    id: 'dungeon',
    name: '5. Цитадель Подземелья (Dungeon)',
    subtitle: 'Базальтовый бастион Личей и Горгон — споты Квестовой Реликвии 1-й Профы (Ур. 50 · ×16 мощь)',
    recommendedLevel: 48,
    groundColor: '#17111a',
    tileAccentColor: '#231826',
    gridColor: 'rgba(225, 110, 80, 0.1)',
    accentColor: '#e06d53',
    enemyLevelMultiplier: 16.0,
    targetKillsForBoss: 28,
    bossName: 'Повелитель Горгон',
  },
  {
    id: 'atlans',
    name: '6. Подводный Город Атланс (Atlans)',
    subtitle: 'Коралловый купол глубин, руины тритонов и логово Гидры (×26 мощь врагов)',
    recommendedLevel: 60,
    groundColor: '#0c1926',
    tileAccentColor: '#122638',
    gridColor: 'rgba(56, 189, 248, 0.12)',
    accentColor: '#38bdf8',
    enemyLevelMultiplier: 26.0,
    targetKillsForBoss: 30,
    bossName: 'Гидра Бездны Атланса',
  },
  {
    id: 'lost_tower',
    name: '7. Затерянная Башня (Lost Tower)',
    subtitle: 'Осадный гарнизон у подножия проклятой цитадели Балрога (×40 мощь врагов)',
    recommendedLevel: 74,
    groundColor: '#1c1210',
    tileAccentColor: '#291a16',
    gridColor: 'rgba(251, 146, 60, 0.12)',
    accentColor: '#fb923c',
    enemyLevelMultiplier: 40.0,
    targetKillsForBoss: 32,
    bossName: 'Демон Балрог (Balrog)',
  },
  {
    id: 'tarkan',
    name: '8. Пустынный Форпост Таркан (Tarkan)',
    subtitle: 'Раскалённый город в песках Мутантов и Кровавых Волков Заикана (×60 мощь врагов)',
    recommendedLevel: 88,
    groundColor: '#21170e',
    tileAccentColor: '#2e2013',
    gridColor: 'rgba(245, 158, 11, 0.12)',
    accentColor: '#f59e0b',
    enemyLevelMultiplier: 60.0,
    targetKillsForBoss: 34,
    bossName: 'Заикан: Повелитель Песков',
  },
  {
    id: 'icarus',
    name: '9. Небесный Город Икарус (Icarus)',
    subtitle: 'Парящий бастион в облаках, гнездовья Алквимов и Огненного Феникса (×88 мощь врагов)',
    recommendedLevel: 102,
    groundColor: '#101a28',
    tileAccentColor: '#172538',
    gridColor: 'rgba(125, 211, 252, 0.12)',
    accentColor: '#7dd3fc',
    enemyLevelMultiplier: 88.0,
    targetKillsForBoss: 36,
    bossName: 'Огненный Феникс Икаруса',
  },
  {
    id: 'kalima',
    name: '10. Затонувший Храм Калима (Kalima)',
    subtitle: 'Древнее святилище морских глубин и иллюзий Кундуна (×126 мощь врагов)',
    recommendedLevel: 115,
    groundColor: '#0e1d22',
    tileAccentColor: '#142a30',
    gridColor: 'rgba(45, 212, 191, 0.12)',
    accentColor: '#2dd4bf',
    enemyLevelMultiplier: 126.0,
    targetKillsForBoss: 38,
    bossName: 'Иллюзия Кундуна Калимы',
  },
  {
    id: 'valley_of_loren',
    name: '11. Долина Лорен (Valley of Loren)',
    subtitle: 'Королевская осадная цитадель, крепостные рвы и гвардия Ерохима (×176 мощь врагов)',
    recommendedLevel: 128,
    groundColor: '#1a1612',
    tileAccentColor: '#26201a',
    gridColor: 'rgba(234, 179, 8, 0.12)',
    accentColor: '#eab308',
    enemyLevelMultiplier: 176.0,
    targetKillsForBoss: 40,
    bossName: 'Лорд Ерохим (Erohim)',
  },
  {
    id: 'crywolf',
    name: '12. Крепость Крайвульф (Crywolf)',
    subtitle: 'Оборонительный город Алтаря Волка против тёмных легионов Балгасса (×240 мощь врагов)',
    recommendedLevel: 142,
    groundColor: '#161822',
    tileAccentColor: '#202330',
    gridColor: 'rgba(165, 180, 252, 0.12)',
    accentColor: '#a5b4fc',
    enemyLevelMultiplier: 240.0,
    targetKillsForBoss: 42,
    bossName: 'Тёмный Эльф Крайвульфа',
  },
  {
    id: 'aida',
    name: '13. Проклятый Лес Аида (Aida)',
    subtitle: '💎 ДРОП JEWEL OF CHAOS (150+ Ур.) · Сумрачный бастион Адского Майна (×330 мощь врагов)',
    recommendedLevel: 155,
    groundColor: '#131b15',
    tileAccentColor: '#1b261e',
    gridColor: 'rgba(132, 204, 22, 0.12)',
    accentColor: '#84cc16',
    enemyLevelMultiplier: 330.0,
    targetKillsForBoss: 44,
    bossName: 'Демон Hell Maine',
  },
  {
    id: 'kanturu_ruins',
    name: '14. Руины Кантуру (Kanturu Ruins)',
    subtitle: '💎 ДРОП CHAOS (150+ Ур.) · Империя древних машин Кантуру (×450 мощь врагов)',
    recommendedLevel: 168,
    groundColor: '#1c1814',
    tileAccentColor: '#28221c',
    gridColor: 'rgba(251, 191, 36, 0.12)',
    accentColor: '#fbbf24',
    enemyLevelMultiplier: 450.0,
    targetKillsForBoss: 46,
    bossName: 'Механический Титан Кантуру',
  },
  {
    id: 'kanturu_relics',
    name: '15. Святилище Кантуру (Kanturu Relics)',
    subtitle: '💎 ДРОП CHAOS (150+ Ур.) · Башня Очищения и врата Кошмара (×610 мощь · Реком. 1 Ресет)',
    recommendedLevel: 180,
    groundColor: '#181424',
    tileAccentColor: '#231d33',
    gridColor: 'rgba(168, 85, 247, 0.12)',
    accentColor: '#a855f7',
    enemyLevelMultiplier: 610.0,
    targetKillsForBoss: 48,
    bossName: 'Повелитель Кошмара (Nightmare)',
  },
  {
    id: 'barrack_of_balgass',
    name: '16. Казармы Балгасса (Balgass Barracks)',
    subtitle: '💎 ДРОП CHAOS (150+ Ур.) · Военный плацдарм Балгасса (×820 мощь · Реком. 1+ Ресет)',
    recommendedLevel: 192,
    groundColor: '#201114',
    tileAccentColor: '#2d181c',
    gridColor: 'rgba(248, 113, 113, 0.12)',
    accentColor: '#f87171',
    enemyLevelMultiplier: 820.0,
    targetKillsForBoss: 50,
    bossName: 'Полководец Балгасс (Balgass)',
  },
  {
    id: 'karutan',
    name: '17. Пустоши Карутана (Karutan)',
    subtitle: '💎 ДРОП CHAOS (150+ Ур.) · Ядовитые каньоны Кондры (×1100 мощь · Реком. 2+ Ресета)',
    recommendedLevel: 205,
    groundColor: '#1d1911',
    tileAccentColor: '#292318',
    gridColor: 'rgba(250, 204, 21, 0.12)',
    accentColor: '#facc15',
    enemyLevelMultiplier: 1100.0,
    targetKillsForBoss: 52,
    bossName: 'Император Скорпионов Кондра',
  },
  {
    id: 'raklion',
    name: '18. Ледяное Логово Раклион (Raklion)',
    subtitle: '💎 ДРОП CHAOS (150+ Ур.) · Логово паука Селупана (×1450 мощь · Реком. 2+ Ресета)',
    recommendedLevel: 218,
    groundColor: '#0e1b26',
    tileAccentColor: '#152736',
    gridColor: 'rgba(56, 189, 248, 0.13)',
    accentColor: '#38bdf8',
    enemyLevelMultiplier: 1450.0,
    targetKillsForBoss: 54,
    bossName: 'Ледяной Паук Селупан (Selupan)',
  },
  {
    id: 'swamp_of_calmness',
    name: '19. Болото Покоя (Swamp of Calmness)',
    subtitle: '💎 ДРОП CHAOS (150+ Ур.) · Четыре сектора Медузы (×1900 мощь · Реком. 3+ Ресета)',
    recommendedLevel: 230,
    groundColor: '#101d19',
    tileAccentColor: '#172924',
    gridColor: 'rgba(16, 185, 129, 0.13)',
    accentColor: '#10b981',
    enemyLevelMultiplier: 1900.0,
    targetKillsForBoss: 56,
    bossName: 'Королева Болот Медуза',
  },
  {
    id: 'vulcanus',
    name: '20. Огненный Город Вулканус (Vulcanus)',
    subtitle: '💎 ДРОП CHAOS (150+ Ур.) · Жерло вулкана Игниса (×2500 мощь · Реком. 3+ Ресета)',
    recommendedLevel: 242,
    groundColor: '#23110e',
    tileAccentColor: '#311814',
    gridColor: 'rgba(249, 115, 22, 0.13)',
    accentColor: '#f97316',
    enemyLevelMultiplier: 2500.0,
    targetKillsForBoss: 58,
    bossName: 'Вулканический Лорд Игнис',
  },
  {
    id: 'acheron',
    name: '21. Древний Город Ахерон (Acheron)',
    subtitle: '💎 ДРОП CHAOS (150+ Ур.) · Столица пентаграмм Арка (×3300 мощь · Реком. 4+ Ресета)',
    recommendedLevel: 255,
    groundColor: '#161326',
    tileAccentColor: '#201c36',
    gridColor: 'rgba(217, 70, 239, 0.13)',
    accentColor: '#d946ef',
    enemyLevelMultiplier: 3300.0,
    targetKillsForBoss: 60,
    bossName: 'Хранитель Пентаграмм Уркан',
  },
  {
    id: 'ferea',
    name: '22. Королевский Бастион Ферея (Ferea)',
    subtitle: '💎 ДРОП CHAOS (150+ Ур.) · Замок кристальных копий (×4400 мощь · Реком. 4+ Ресета)',
    recommendedLevel: 268,
    groundColor: '#1b1622',
    tileAccentColor: '#272030',
    gridColor: 'rgba(244, 114, 182, 0.13)',
    accentColor: '#f472b6',
    enemyLevelMultiplier: 4400.0,
    targetKillsForBoss: 62,
    bossName: 'Лорд-Генерал Фереи',
  },
  {
    id: 'nixies_lake',
    name: '23. Озеро Никси (Nixies Lake)',
    subtitle: '💎 ДРОП CHAOS (150+ Ур.) · Город вечной мерзлоты Никси (×5850 мощь · Реком. 5+ Ресетов)',
    recommendedLevel: 282,
    groundColor: '#0d1929',
    tileAccentColor: '#14243b',
    gridColor: 'rgba(96, 165, 250, 0.14)',
    accentColor: '#60a5fa',
    enemyLevelMultiplier: 5850.0,
    targetKillsForBoss: 64,
    bossName: 'Дух Льда Никси (Nix)',
  },
  {
    id: 'blood_castle',
    name: '24. Цитадель Кундуна (Kundun Sanctum)',
    subtitle: '💎 ДРОП CHAOS (150+ Ур.) · Финальный трон Владыки Кундуна (×7800 мощь · Реком. 5+ Ресетов)',
    recommendedLevel: 295,
    groundColor: '#1f0e13',
    tileAccentColor: '#2c141b',
    gridColor: 'rgba(244, 63, 94, 0.14)',
    accentColor: '#f43f5e',
    enemyLevelMultiplier: 7800.0,
    targetKillsForBoss: 68,
    bossName: 'Кундун: Владыка Континента MU',
  },
];

export const CLASSES: Record<CharacterClassId, ClassDefinition> = {
  dark_knight: {
    id: 'dark_knight',
    name: 'Dark Knight',
    tierTitles: {
      1: 'Dark Knight (Тёмный Рыцарь)',
      2: 'Blade Knight (Рыцарь Клинка)',
      3: 'Blade Master (Мастер Клинка)',
    },
    setName: 'Hyon Dragon Set',
    loreShort: 'Воин ближнего боя в доспехах Чёрного Дракона. Исполняет смертоносные комбо-удары.',
    accentColor: '#e14d43',
    secondaryColor: '#f59e0b',
    baseAttributes: { str: 28, agi: 20, vit: 25, ene: 12 },
    startingWeapon: {
      id: 'start_dk_sword',
      name: 'Клинок Хаоса',
      slot: 'weapon',
      rarity: 'magic',
      level: 1,
      lifeOption: 4,
      baseAttack: 24,
      baseDefense: 0,
      critChanceBonus: 4,
      moveSpeedBonus: 0,
      setName: 'Hyon Dragon Set',
      classRestriction: 'dark_knight',
      valueZen: 350,
    },
    startingArmor: {
      id: 'start_dk_armor',
      name: 'Кираса Чёрного Дракона',
      slot: 'armor',
      rarity: 'magic',
      level: 1,
      lifeOption: 4,
      baseAttack: 0,
      baseDefense: 22,
      critChanceBonus: 0,
      moveSpeedBonus: 0,
      setName: 'Hyon Dragon Set',
      classRestriction: 'dark_knight',
      valueZen: 400,
    },
    startingHelm: {
      id: 'start_dk_helm',
      name: 'Шлем Чёрного Дракона',
      slot: 'helm',
      rarity: 'magic',
      level: 1,
      lifeOption: 0,
      baseAttack: 0,
      baseDefense: 14,
      critChanceBonus: 2,
      moveSpeedBonus: 0,
      setName: 'Hyon Dragon Set',
      classRestriction: 'dark_knight',
      valueZen: 300,
    },
    skills: [
      {
        id: 'cyclone_slash',
        name: 'Cyclone Slash',
        bookName: 'Фолиант Cyclone Slash',
        requiredLevel: 3,
        bookPriceZen: 350,
        roleClue: 'Рассекающий удар [Комбо Шаг 1]',
        keyBinding: '1',
        manaCost: 6,
        cooldownSec: 0.65,
        damageMultiplier: 1.45,
        range: 110,
        aoeRadius: 90,
        requiredTier: 1,
        pattern: 'melee_arc',
        color: '#f87171',
      },
      {
        id: 'twisting_slash',
        name: 'Twisting Slash',
        bookName: 'Сфера Twisting Slash',
        requiredLevel: 12,
        bookPriceZen: 1400,
        roleClue: 'Вихрь клинков 360° [Комбо Шаг 2]',
        keyBinding: '2',
        manaCost: 14,
        cooldownSec: 2.0,
        damageMultiplier: 2.15,
        range: 140,
        aoeRadius: 140,
        requiredTier: 1,
        pattern: 'spin_aoe',
        color: '#fbbf24',
      },
      {
        id: 'death_stab',
        name: 'Blow of Fury',
        bookName: 'Сфера Blow of Fury',
        requiredLevel: 26,
        bookPriceZen: 3800,
        roleClue: 'Землетрясение [Финал Комбо 1→2→3]',
        keyBinding: '3',
        manaCost: 22,
        cooldownSec: 4.0,
        damageMultiplier: 3.25,
        range: 170,
        aoeRadius: 160,
        requiredTier: 1,
        pattern: 'ground_slam',
        color: '#ef4444',
      },
      {
        id: 'combo_nova',
        name: 'Sword Blast (Ульта)',
        bookName: 'Древний Том Sword Blast',
        requiredLevel: 50,
        bookPriceZen: 9000,
        roleClue: 'Взрыв тысячи клинков Мастера (1+ Проф.)',
        keyBinding: '4',
        manaCost: 34,
        cooldownSec: 6.5,
        damageMultiplier: 4.5,
        range: 220,
        aoeRadius: 210,
        requiredTier: 2,
        pattern: 'combo_nova',
        color: '#38bdf8',
      },
    ],
  },
  dark_wizard: {
    id: 'dark_wizard',
    name: 'Dark Wizard',
    tierTitles: {
      1: 'Dark Wizard (Тёмный Маг)',
      2: 'Soul Master (Повелитель Душ)',
      3: 'Grand Master (Гранд Мастер)',
    },
    setName: 'Anubis Legendary Set',
    loreShort: 'Повелитель стихий и духов тьмы, сжигающий легионы врагов заклинаниями по площади.',
    accentColor: '#60a5fa',
    secondaryColor: '#c084fc',
    baseAttributes: { str: 14, agi: 18, vit: 18, ene: 35 },
    startingWeapon: {
      id: 'start_dw_staff',
      name: 'Посох Легендарной Души',
      slot: 'weapon',
      rarity: 'magic',
      level: 1,
      lifeOption: 4,
      baseAttack: 28,
      baseDefense: 0,
      critChanceBonus: 6,
      moveSpeedBonus: 0,
      setName: 'Anubis Legendary Set',
      classRestriction: 'dark_wizard',
      valueZen: 380,
    },
    startingArmor: {
      id: 'start_dw_armor',
      name: 'Мантия Анубиса',
      slot: 'armor',
      rarity: 'magic',
      level: 1,
      lifeOption: 4,
      baseAttack: 0,
      baseDefense: 16,
      critChanceBonus: 2,
      moveSpeedBonus: 5,
      setName: 'Anubis Legendary Set',
      classRestriction: 'dark_wizard',
      valueZen: 360,
    },
    startingHelm: {
      id: 'start_dw_helm',
      name: 'Венец Анубиса',
      slot: 'helm',
      rarity: 'magic',
      level: 1,
      lifeOption: 0,
      baseAttack: 4,
      baseDefense: 11,
      critChanceBonus: 3,
      moveSpeedBonus: 0,
      setName: 'Anubis Legendary Set',
      classRestriction: 'dark_wizard',
      valueZen: 310,
    },
    skills: [
      {
        id: 'aqua_beam',
        name: 'Aqua Beam',
        bookName: 'Свиток Aqua Beam',
        requiredLevel: 3,
        bookPriceZen: 350,
        roleClue: 'Пронзающий луч света [Комбо Шаг 1]',
        keyBinding: '1',
        manaCost: 8,
        cooldownSec: 0.7,
        damageMultiplier: 1.55,
        range: 245,
        aoeRadius: 80,
        requiredTier: 1,
        pattern: 'dark_beam',
        color: '#38bdf8',
      },
      {
        id: 'evil_spirits',
        name: 'Evil Spirits',
        bookName: 'Свиток Evil Spirits',
        requiredLevel: 12,
        bookPriceZen: 1400,
        roleClue: 'Вихрь теневых духов [Комбо Шаг 2]',
        keyBinding: '2',
        manaCost: 18,
        cooldownSec: 2.3,
        damageMultiplier: 2.4,
        range: 235,
        aoeRadius: 215,
        requiredTier: 1,
        pattern: 'evil_spirits',
        color: '#a855f7',
      },
      {
        id: 'hellfire_meteor',
        name: 'Hellfire',
        bookName: 'Свиток Hellfire',
        requiredLevel: 26,
        bookPriceZen: 3800,
        roleClue: 'Метеоритный шторм [Финал Комбо 1→2→3]',
        keyBinding: '3',
        manaCost: 26,
        cooldownSec: 4.3,
        damageMultiplier: 3.5,
        range: 220,
        aoeRadius: 185,
        requiredTier: 1,
        pattern: 'meteor_strike',
        color: '#f97316',
      },
      {
        id: 'soul_supernova',
        name: 'Nova (Сверхновая)',
        bookName: 'Древний Свиток Nova',
        requiredLevel: 50,
        bookPriceZen: 9000,
        roleClue: 'Коллапс звезды Гранд Мастера (1+ Проф.)',
        keyBinding: '4',
        manaCost: 38,
        cooldownSec: 6.8,
        damageMultiplier: 4.75,
        range: 250,
        aoeRadius: 235,
        requiredTier: 2,
        pattern: 'soul_supernova',
        color: '#e879f9',
      },
    ],
  },
  fairy_elf: {
    id: 'fairy_elf',
    name: 'Fairy Elf',
    tierTitles: {
      1: 'Fairy Elf (Эльф Нории)',
      2: 'Muse Elf (Муза-Эльф)',
      3: 'High Elf (Высший Эльф)',
    },
    setName: 'Gywen Guardian Set',
    loreShort: 'Лучница Нории с веерным залпом стрел, морозным замедлением и аурой исцеления.',
    accentColor: '#34d399',
    secondaryColor: '#fde047',
    baseAttributes: { str: 16, agi: 32, vit: 19, ene: 18 },
    startingWeapon: {
      id: 'start_fe_bow',
      name: 'Лук Серебряного Крыла',
      slot: 'weapon',
      rarity: 'magic',
      level: 1,
      lifeOption: 4,
      baseAttack: 25,
      baseDefense: 0,
      critChanceBonus: 9,
      moveSpeedBonus: 8,
      setName: 'Gywen Guardian Set',
      classRestriction: 'fairy_elf',
      valueZen: 370,
    },
    startingArmor: {
      id: 'start_fe_armor',
      name: 'Доспех Стража Нории',
      slot: 'armor',
      rarity: 'magic',
      level: 1,
      lifeOption: 4,
      baseAttack: 0,
      baseDefense: 18,
      critChanceBonus: 4,
      moveSpeedBonus: 10,
      setName: 'Gywen Guardian Set',
      classRestriction: 'fairy_elf',
      valueZen: 390,
    },
    startingHelm: {
      id: 'start_fe_helm',
      name: 'Диадема Стража Нории',
      slot: 'helm',
      rarity: 'magic',
      level: 1,
      lifeOption: 0,
      baseAttack: 2,
      baseDefense: 13,
      critChanceBonus: 4,
      moveSpeedBonus: 4,
      setName: 'Gywen Guardian Set',
      classRestriction: 'fairy_elf',
      valueZen: 310,
    },
    skills: [
      {
        id: 'triple_shot',
        name: 'Triple Shot',
        bookName: 'Книга Triple Shot',
        requiredLevel: 3,
        bookPriceZen: 350,
        roleClue: 'Веер из 5 стрел [Комбо Шаг 1]',
        keyBinding: '1',
        manaCost: 7,
        cooldownSec: 0.6,
        damageMultiplier: 1.5,
        range: 265,
        aoeRadius: 100,
        requiredTier: 1,
        pattern: 'triple_arrow',
        color: '#4ade80',
      },
      {
        id: 'ice_arrow',
        name: 'Ice Arrow',
        bookName: 'Книга Ice Arrow',
        requiredLevel: 12,
        bookPriceZen: 1400,
        roleClue: 'Морозный залп и заморозка [Комбо Шаг 2]',
        keyBinding: '2',
        manaCost: 15,
        cooldownSec: 2.1,
        damageMultiplier: 2.25,
        range: 250,
        aoeRadius: 145,
        requiredTier: 1,
        pattern: 'ice_arrow',
        color: '#38bdf8',
      },
      {
        id: 'starfall_blessing',
        name: 'Starfall + Heal',
        bookName: 'Книга Starfall + Heal',
        requiredLevel: 26,
        bookPriceZen: 3800,
        roleClue: 'Звёздный ливень и +25% ОЗ [Финал Комбо]',
        keyBinding: '3',
        manaCost: 24,
        cooldownSec: 4.2,
        damageMultiplier: 2.95,
        range: 225,
        aoeRadius: 175,
        requiredTier: 1,
        pattern: 'guardian_buff',
        color: '#facc15',
      },
      {
        id: 'infinity_arrow_storm',
        name: 'Infinity Storm (Ульта)',
        bookName: 'Древняя Книга Infinity Storm',
        requiredLevel: 50,
        bookPriceZen: 9000,
        roleClue: 'Небесный шквал стрел Высшего Эльфа (1+ Проф.)',
        keyBinding: '4',
        manaCost: 34,
        cooldownSec: 6.2,
        damageMultiplier: 4.4,
        range: 260,
        aoeRadius: 220,
        requiredTier: 2,
        pattern: 'infinity_arrow_storm',
        color: '#34d399',
      },
    ],
  },
};

export function getClassDisplayTitle(classId: CharacterClassId, tier: ClassTier = 1): string {
  return CLASSES[classId].tierTitles[tier];
}

export function getFirstProfQuestItemName(classId: CharacterClassId): string {
  if (classId === 'dark_knight') return 'Осколок Меча Императора (Broken Sword)';
  if (classId === 'dark_wizard') return 'Душа Древнего Пророка (Soul of Wizard)';
  return 'Слеза Эльфийской Богини (Tear of Elf)';
}

export function calculateItemEffectiveAttack(item: EquipmentItem | null): number {
  if (!item) return 0;
  const eq = CHARACTER_SCALING.equipmentScaling;
  const rarityMult = eq.rarityMultiplier[item.rarity] ?? 1.0;
  const upgradeBonus =
    item.level * eq.attackPerUpgradeLevel +
    (item.level >= 7 ? (item.level - 6) * eq.attackExtraPerLevelFrom7 : 0);
  const lifeBonus = item.lifeOption ?? 0;
  return Math.round(item.baseAttack * rarityMult + (item.baseAttack > 0 ? upgradeBonus + lifeBonus : 0));
}

export function calculateItemEffectiveDefense(item: EquipmentItem | null): number {
  if (!item) return 0;
  const eq = CHARACTER_SCALING.equipmentScaling;
  const rarityMult = eq.rarityMultiplier[item.rarity] ?? 1.0;
  const upgradeBonus =
    item.level * eq.defensePerUpgradeLevel +
    (item.level >= 7 ? (item.level - 6) * eq.defenseExtraPerLevelFrom7 : 0);
  const lifeBonus = Math.round((item.lifeOption ?? 0) * eq.lifeOptionDefenseRatio);
  return Math.round(item.baseDefense * rarityMult + (item.baseDefense > 0 ? upgradeBonus + lifeBonus : 0));
}

export interface WingUpgradeBonus {
  level: number;
  speedBonusPct: number;
  speedMultiplier: number;
  visualScaleMultiplier: number;
  visualGrowthPct: number;
}

/**
 * Calculates wing upgrade bonuses:
 * - Each upgrade level (+1..+15) grants +1% additional speed to maximum movement speed.
 * - Each upgrade level also increases the visual size/wingspan of the rendered wings.
 */
export function calculateWingUpgradeBonus(wings: EquipmentItem | null): WingUpgradeBonus {
  if (!wings || wings.slot !== 'wings') {
    return {
      level: 0,
      speedBonusPct: 0,
      speedMultiplier: 1,
      visualScaleMultiplier: 1,
      visualGrowthPct: 0,
    };
  }
  const eq = CHARACTER_SCALING.equipmentScaling;
  const clampedLevel = Math.max(0, Math.min(15, Math.floor(wings.level ?? 0)));
  const speedPctPerLevel = eq.wingSpeedPctPerLevel ?? 0.01;
  const visualScalePerLevel = eq.wingVisualScalePerLevel ?? 0.024;
  return {
    level: clampedLevel,
    speedBonusPct: Math.round(clampedLevel * speedPctPerLevel * 100),
    speedMultiplier: 1 + clampedLevel * speedPctPerLevel,
    visualScaleMultiplier: Number((1 + clampedLevel * visualScalePerLevel).toFixed(4)),
    visualGrowthPct: Math.round(clampedLevel * visualScalePerLevel * 100),
  };
}

export function calculateDerivedStats(state: PlayerProgressState): DerivedStats {
  const { attributes, level, equipped, classId, classTier, resets } = state;
  const cls = CLASSES[classId];
  const eq = CHARACTER_SCALING.equipmentScaling;
  const df = CHARACTER_SCALING.derivedFormulas;
  const gr = CHARACTER_SCALING.grandReset;

  const slots: ItemSlot[] = ['weapon', 'armor', 'helm', 'wings', 'ring', 'pendant'];
  let totalEquipAtk = 0;
  let totalEquipDef = 0;
  let equipCrit = 0;
  let equipSpeed = 0;
  let activeSetPieceCount = 0;

  for (const s of slots) {
    const it = equipped[s];
    if (!it) continue;
    totalEquipAtk += calculateItemEffectiveAttack(it);
    totalEquipDef += calculateItemEffectiveDefense(it);
    equipCrit += it.critChanceBonus;
    equipSpeed += it.moveSpeedBonus;
    if (it.setName === cls.setName) {
      activeSetPieceCount += 1;
    }
  }

  const hasFullSetBonus = activeSetPieceCount >= eq.fullSetPiecesRequired;
  const setAtkMultiplier = hasFullSetBonus
    ? eq.fullSetAtkMult
    : activeSetPieceCount >= 2
      ? eq.twoPieceSetAtkMult
      : 1.0;
  const tierBonusMult =
    classTier === 3
      ? CHARACTER_SCALING.classTierDamageMultiplier.tier3
      : classTier === 2
        ? CHARACTER_SCALING.classTierDamageMultiplier.tier2
        : CHARACTER_SCALING.classTierDamageMultiplier.tier1;
  const resetPowerMult = 1 + resets * gr.powerMultiplierPerReset;

  const w = CHARACTER_SCALING.classPrimaryDamageWeights[classId];
  const primaryAttr = attributes.str * w.str + attributes.agi * w.agi + attributes.ene * w.ene;

  const baseDmg = Math.round(
    (primaryAttr + level * df.damagePerLevel + totalEquipAtk + resets * gr.flatAttackPerReset) *
      setAtkMultiplier *
      tierBonusMult *
      resetPowerMult
  );
  const minDamage = Math.max(df.minDamageFloor, Math.round(baseDmg * df.minDamageRatio));
  const maxDamage = Math.max(minDamage + df.minSpreadGap, Math.round(baseDmg * df.maxDamageRatio));

  const defense = Math.round(
    (attributes.agi * df.defensePerAgi +
      level * df.defensePerLevel +
      totalEquipDef +
      resets * gr.flatDefensePerReset) *
      (hasFullSetBonus ? eq.fullSetDefMult : 1.0) *
      resetPowerMult
  );
  const maxHp = Math.round(
    (df.hpBase +
      attributes.vit * df.hpPerVit +
      level * df.hpPerLevel +
      (equipped.wings ? df.wingsFlatHpBonus : 0) +
      (hasFullSetBonus ? df.fullSetFlatHpBonus : 0) +
      resets * gr.flatHpPerReset) *
      (1 + resets * gr.hpMultiplierPerReset)
  );
  const maxMp = Math.round(
    df.mpBase +
      attributes.ene * df.mpPerEne +
      level * df.mpPerLevel +
      (hasFullSetBonus ? df.fullSetFlatMpBonus : 0)
  );

  const critChance = Math.min(
    df.critCap,
    Math.round(
      df.critBase + attributes.agi * df.critPerAgi + equipCrit + (hasFullSetBonus ? df.fullSetCritBonus : 0)
    )
  );
  const doubleDamageChance = hasFullSetBonus
    ? df.doubleDamageFullSet
    : activeSetPieceCount >= 2
      ? df.doubleDamageTwoSetPieces
      : df.doubleDamageBase;

  const wingBonus = calculateWingUpgradeBonus(equipped.wings);
  const baseCappedSpeed = Math.min(
    df.moveSpeedCap,
    df.moveSpeedBase + attributes.agi * df.moveSpeedPerAgi + equipSpeed
  );
  const effectiveMoveSpeedCap = Math.round(df.moveSpeedCap * wingBonus.speedMultiplier);
  const moveSpeed = Math.min(
    effectiveMoveSpeedCap,
    Math.round(baseCappedSpeed * wingBonus.speedMultiplier)
  );
  const cpw = df.combatPowerWeights;
  const combatPower = Math.round(
    (minDamage + maxDamage) * cpw.damageSum +
      defense * cpw.defense +
      maxHp * cpw.maxHp +
      critChance * cpw.critChance +
      doubleDamageChance * cpw.doubleDamageChance
  );

  return {
    maxHp,
    maxMp,
    minDamage,
    maxDamage,
    defense,
    critChance,
    doubleDamageChance,
    moveSpeed,
    combatPower,
    activeSetPieceCount,
    activeSetName: cls.setName,
  };
}

export function calculateExpToNextLevel(level: number): number {
  const c = CHARACTER_SCALING.expCurve;
  return Math.round(c.base + level * c.linearPerLevel + Math.pow(level, c.exponent) * c.powerCoeff);
}

export function createInitialPlayerState(classId: CharacterClassId = 'dark_knight'): PlayerProgressState {
  const cls = CLASSES[classId];
  const init = CHARACTER_SCALING.initialPlayer;
  return {
    classId,
    classTier: 1,
    resets: 0,
    level: init.startLevel,
    exp: 0,
    expToNext: calculateExpToNextLevel(init.startLevel),
    statPoints: init.startStatPoints,
    attributes: { ...cls.baseAttributes },
    zen: init.startZen,
    jewels: { ...init.startJewels },
    potions: init.startHpPotions,
    hpPotions: init.startHpPotions,
    largeHpPotions: init.startLargeHpPotions,
    mpPotions: init.startMpPotions,
    hasFirstProfQuestItem: false,
    bloodScrolls: 0,
    bloodFangs: 0,
    bloodCastleTickets: 0,
    inBloodCastle: false,
    bloodCastleClears: 0,
    learnedSkills: [],
    equipped: {
      weapon: null,
      armor: null,
      helm: null,
      wings: null,
      ring: null,
      pendant: null,
    },
    inventory: [],
    territoryId: init.startTerritoryId,
    killsInTerritory: 0,
    totalKills: 0,
    bossesDefeated: 0,
    highestReachedTerritoryIdx: init.startHighestReachedTerritoryIdx,
  };
}

export interface ShopEquipmentCatalogEntry {
  catalogId: string;
  requiredLevel: number;
  priceZen: number;
  itemTemplate: EquipmentItem;
}

export function getShopEquipmentCatalog(classId: CharacterClassId): ShopEquipmentCatalogEntry[] {
  const cls = CLASSES[classId];
  const starterWeaponNames: Record<CharacterClassId, string> = {
    dark_knight: 'Короткий Меч Лоренсии',
    dark_wizard: 'Ученический Посох Лоренсии',
    fairy_elf: 'Короткий Лук Лоренсии',
  };
  const starterArmorNames: Record<CharacterClassId, string> = {
    dark_knight: 'Кожаный Доспех Лоренсии',
    dark_wizard: 'Холщовая Мантия Лоренсии',
    fairy_elf: 'Лёгкая Туника Лоренсии',
  };
  const starterHelmNames: Record<CharacterClassId, string> = {
    dark_knight: 'Кожаный Шлем Лоренсии',
    dark_wizard: 'Повязка Ученика Лоренсии',
    fairy_elf: 'Обруч Рощи Лоренсии',
  };

  return [
    {
      catalogId: 'starter_weapon',
      requiredLevel: 1,
      priceZen: 250,
      itemTemplate: {
        ...cls.startingWeapon,
        id: `shop_wep_1_${classId}`,
        name: starterWeaponNames[classId],
        rarity: 'normal',
        level: 0,
        lifeOption: 0,
        baseAttack: Math.max(14, cls.startingWeapon.baseAttack - 8),
        setName: undefined,
        valueZen: 250,
      },
    },
    {
      catalogId: 'starter_armor',
      requiredLevel: 1,
      priceZen: 220,
      itemTemplate: {
        ...cls.startingArmor,
        id: `shop_arm_1_${classId}`,
        name: starterArmorNames[classId],
        rarity: 'normal',
        level: 0,
        lifeOption: 0,
        baseDefense: Math.max(10, cls.startingArmor.baseDefense - 5),
        setName: undefined,
        valueZen: 220,
      },
    },
    {
      catalogId: 'starter_helm',
      requiredLevel: 1,
      priceZen: 180,
      itemTemplate: {
        ...cls.startingHelm,
        id: `shop_hlm_1_${classId}`,
        name: starterHelmNames[classId],
        rarity: 'normal',
        level: 0,
        lifeOption: 0,
        baseDefense: Math.max(7, cls.startingHelm.baseDefense - 3),
        setName: undefined,
        valueZen: 180,
      },
    },
    {
      catalogId: 'starter_ring',
      requiredLevel: 4,
      priceZen: 520,
      itemTemplate: {
        id: `shop_rng_1_${classId}`,
        name: 'Кольцо Боевой Ярости',
        slot: 'ring',
        rarity: 'magic',
        level: 1,
        lifeOption: 4,
        baseAttack: 9,
        baseDefense: 6,
        critChanceBonus: 4,
        moveSpeedBonus: 4,
        classRestriction: classId,
        valueZen: 520,
      },
    },
    {
      catalogId: 'magic_weapon',
      requiredLevel: 8,
      priceZen: 950,
      itemTemplate: {
        ...cls.startingWeapon,
        id: `shop_wep_2_${classId}`,
        rarity: 'magic',
        level: 2,
        lifeOption: 4,
        baseAttack: cls.startingWeapon.baseAttack + 8,
        valueZen: 950,
      },
    },
    {
      catalogId: 'magic_armor',
      requiredLevel: 8,
      priceZen: 880,
      itemTemplate: {
        ...cls.startingArmor,
        id: `shop_arm_2_${classId}`,
        rarity: 'magic',
        level: 2,
        lifeOption: 4,
        baseDefense: cls.startingArmor.baseDefense + 7,
        valueZen: 880,
      },
    },
  ];
}

export function buyShopEquipmentToInventory(
  state: PlayerProgressState,
  catalogId: string,
  isNearShop = true
): { nextState: PlayerProgressState; success: boolean; message: string; boughtItem?: EquipmentItem } {
  if (!isNearShop) {
    return {
      nextState: state,
      success: false,
      message: '🔒 Вы слишком далеко от Лавки! Подойдите к Торговцу Ханзо в городе.',
    };
  }

  const catalog = getShopEquipmentCatalog(state.classId);
  const entry = catalog.find((c) => c.catalogId === catalogId);
  if (!entry) {
    return {
      nextState: state,
      success: false,
      message: 'Этот предмет не найден в лавке.',
    };
  }

  if (state.level < entry.requiredLevel) {
    return {
      nextState: state,
      success: false,
      message: `Для покупки «${entry.itemTemplate.name}» требуется Уровень ${entry.requiredLevel} (сейчас Ур. ${state.level}/${entry.requiredLevel}).`,
    };
  }

  if (state.zen < entry.priceZen) {
    return {
      nextState: state,
      success: false,
      message: `Недостаточно золота! «${entry.itemTemplate.name}» стоит ${entry.priceZen} Zen (у вас ${state.zen} Zen).`,
    };
  }

  if (state.inventory.length >= 24) {
    return {
      nextState: state,
      success: false,
      message: 'Сетка инвентаря полна! Освободите ячейку.',
    };
  }

  const boughtItem: EquipmentItem = {
    ...entry.itemTemplate,
    id: `shop_${entry.catalogId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  };

  return {
    nextState: {
      ...state,
      zen: state.zen - entry.priceZen,
      inventory: [boughtItem, ...state.inventory],
    },
    success: true,
    message: `Куплено в инвентарь: ${boughtItem.name}${boughtItem.level > 0 ? ` +${boughtItem.level}` : ''} за ${entry.priceZen} Zen! Наведите мышь для просмотра статов или перетащите на куклу героя.`,
    boughtItem,
  };
}

export function buySkillBookWithZen(
  state: PlayerProgressState,
  skillId: string,
  isNearShop = true
): { nextState: PlayerProgressState; success: boolean; message: string } {
  if (!isNearShop) {
    return {
      nextState: state,
      success: false,
      message: '🔒 Вы слишком далеко от Лавки! Подойдите к Торговцу Ханзо в городе, чтобы купить книгу навыка.',
    };
  }

  const cls = CLASSES[state.classId];
  const skill = cls.skills.find((s) => s.id === skillId);
  if (!skill) {
    return {
      nextState: state,
      success: false,
      message: 'Такой книги навыка нет у вашего класса.',
    };
  }

  if (state.learnedSkills.includes(skill.id)) {
    return {
      nextState: state,
      success: false,
      message: `Навык «${skill.name}» уже изучен!`,
    };
  }

  if ((skill.requiredTier ?? 1) > state.classTier) {
    return {
      nextState: state,
      success: false,
      message: `Для изучения «${skill.bookName}» требуется 1-я Профессия (квест Жрицы Себины на 50 Ур.)!`,
    };
  }

  if (state.level < skill.requiredLevel) {
    return {
      nextState: state,
      success: false,
      message: `Для чтения «${skill.bookName}» требуется Уровень ${skill.requiredLevel} (сейчас Ур. ${state.level}/${skill.requiredLevel}).`,
    };
  }

  if (state.zen < skill.bookPriceZen) {
    return {
      nextState: state,
      success: false,
      message: `Недостаточно золота для покупки «${skill.bookName}»! Нужно ${skill.bookPriceZen} Zen (у вас ${state.zen} Zen).`,
    };
  }

  return {
    nextState: {
      ...state,
      zen: state.zen - skill.bookPriceZen,
      learnedSkills: [...state.learnedSkills, skill.id],
    },
    success: true,
    message: `Вы купили и перетащили в инвентарь «${skill.bookName}» за ${skill.bookPriceZen} Zen! Навык [${skill.keyBinding}] ${skill.name} изучен!`,
  };
}

export function buyStarterEquipmentWithZen(
  state: PlayerProgressState,
  slot: 'weapon' | 'armor' | 'helm'
): { nextState: PlayerProgressState; success: boolean; message: string } {
  const cls = CLASSES[state.classId];
  const template =
    slot === 'weapon'
      ? cls.startingWeapon
      : slot === 'armor'
        ? cls.startingArmor
        : cls.startingHelm;
  const cost = template.valueZen;

  if (state.zen < cost) {
    return {
      nextState: state,
      success: false,
      message: `Недостаточно Zen! «${template.name}» стоит ${cost} Zen (у вас ${state.zen} Zen).`,
    };
  }

  const boughtItem: EquipmentItem = {
    ...template,
    id: `shop_${slot}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    rarity: 'normal',
    level: 0,
    lifeOption: 0,
  };

  if (state.equipped[slot] === null) {
    return {
      nextState: {
        ...state,
        zen: state.zen - cost,
        equipped: {
          ...state.equipped,
          [slot]: boughtItem,
        },
      },
      success: true,
      message: `Куплено и надето: ${boughtItem.name} за ${cost} Zen!`,
    };
  }

  if (state.inventory.length >= 24) {
    return {
      nextState: state,
      success: false,
      message: 'Сетка инвентаря полна! Освободите место.',
    };
  }

  return {
    nextState: {
      ...state,
      zen: state.zen - cost,
      inventory: [boughtItem, ...state.inventory],
    },
    success: true,
    message: `Куплено в рюкзак: ${boughtItem.name} за ${cost} Zen!`,
  };
}

export function buyPotionsWithZen(
  state: PlayerProgressState,
  potionType: 'hp' | 'large_hp' | 'mp',
  packSize: 5 | 20 = 5,
  isNearShop = true
): { nextState: PlayerProgressState; success: boolean; message: string } {
  if (!isNearShop) {
    return {
      nextState: state,
      success: false,
      message: '🔒 Вы слишком далеко от Лавки! Подойдите к Торговцу Ханзо в городе, чтобы купить банки.',
    };
  }

  const potCfg = CHARACTER_SCALING.potions;
  const unitPrice =
    potionType === 'large_hp'
      ? potCfg.largeHpUnitPrice
      : potionType === 'hp'
        ? potCfg.smallHpUnitPrice
        : potCfg.mpUnitPrice;
  const cost = packSize === 20 ? Math.round(unitPrice * 20 * 0.9) : unitPrice * packSize;

  if (state.zen < cost) {
    return {
      nextState: state,
      success: false,
      message: `Недостаточно золота! Для покупки ${packSize} шт. требуется ${cost} Zen (у вас ${state.zen} Zen).`,
    };
  }

  if (potionType === 'large_hp') {
    const nextLargeHpPotions = (state.largeHpPotions ?? 0) + packSize;
    return {
      nextState: {
        ...state,
        zen: state.zen - cost,
        largeHpPotions: nextLargeHpPotions,
      },
      success: true,
      message: `Куплено +${packSize} Больших Банок ОЗ (+${potCfg.largeHpHeal} HP) за ${cost} Zen (всего: ${nextLargeHpPotions} шт.).`,
    };
  }

  if (potionType === 'hp') {
    const nextHpPotions = state.hpPotions + packSize;
    return {
      nextState: {
        ...state,
        zen: state.zen - cost,
        hpPotions: nextHpPotions,
        potions: nextHpPotions,
      },
      success: true,
      message: `Куплено +${packSize} Банок ОЗ (+${potCfg.smallHpHeal} HP) за ${cost} Zen (всего: ${nextHpPotions} шт.).`,
    };
  }

  const nextMpPotions = state.mpPotions + packSize;
  return {
    nextState: {
      ...state,
      zen: state.zen - cost,
      mpPotions: nextMpPotions,
    },
    success: true,
    message: `Куплено +${packSize} Банок МН за ${cost} Zen (всего: ${nextMpPotions} шт.).`,
  };
}

export function equipItemFromInventory(
  state: PlayerProgressState,
  item: EquipmentItem
): { nextState: PlayerProgressState; success: boolean; message: string } {
  const slot = item.slot;
  const currentEquipped = state.equipped[slot];
  const remainingInventory = state.inventory.filter((i) => i.id !== item.id);
  if (currentEquipped) {
    remainingInventory.unshift(currentEquipped);
  }
  return {
    nextState: {
      ...state,
      equipped: {
        ...state.equipped,
        [slot]: item,
      },
      inventory: remainingInventory,
    },
    success: true,
    message: `Надето: ${item.name} +${item.level}.`,
  };
}

export function unequipItemToInventory(
  state: PlayerProgressState,
  slot: ItemSlot
): { nextState: PlayerProgressState; success: boolean; message: string } {
  const currentEquipped = state.equipped[slot];
  if (!currentEquipped) {
    return {
      nextState: state,
      success: false,
      message: 'В этом слоте нет надетого предмета.',
    };
  }
  if (state.inventory.length >= 24) {
    return {
      nextState: state,
      success: false,
      message: 'Сетка инвентаря заполнена! Продайте лишние трофеи.',
    };
  }
  return {
    nextState: {
      ...state,
      equipped: {
        ...state.equipped,
        [slot]: null,
      },
      inventory: [currentEquipped, ...state.inventory],
    },
    success: true,
    message: `Снято в инвентарь: ${currentEquipped.name} +${currentEquipped.level}.`,
  };
}

export function dropItemFromInventory(
  state: PlayerProgressState,
  itemId: string
): {
  nextState: PlayerProgressState;
  droppedItem: EquipmentItem | null;
  success: boolean;
  message: string;
} {
  const target = state.inventory.find((i) => i.id === itemId) ?? null;
  if (!target) {
    return {
      nextState: state,
      droppedItem: null,
      success: false,
      message: 'Предмет не найден в инвентаре.',
    };
  }
  return {
    nextState: {
      ...state,
      inventory: state.inventory.filter((i) => i.id !== itemId),
    },
    droppedItem: target,
    success: true,
    message: `Выброшено на землю: ${target.name} +${target.level} (исчезнет через 60 сек).`,
  };
}

export function dropEquippedItemToGround(
  state: PlayerProgressState,
  slot: ItemSlot
): {
  nextState: PlayerProgressState;
  droppedItem: EquipmentItem | null;
  success: boolean;
  message: string;
} {
  const currentEquipped = state.equipped[slot];
  if (!currentEquipped) {
    return {
      nextState: state,
      droppedItem: null,
      success: false,
      message: 'В этом слоте нет надетого предмета.',
    };
  }
  return {
    nextState: {
      ...state,
      equipped: {
        ...state.equipped,
        [slot]: null,
      },
    },
    droppedItem: currentEquipped,
    success: true,
    message: `Снято и выброшено на землю: ${currentEquipped.name} +${currentEquipped.level} (исчезнет через 60 сек).`,
  };
}

export function allocateStatPoint(
  state: PlayerProgressState,
  stat: keyof CharacterAttributes,
  amount = 1
): PlayerProgressState {
  if (state.statPoints < amount || amount <= 0) return state;
  return {
    ...state,
    statPoints: state.statPoints - amount,
    attributes: {
      ...state.attributes,
      [stat]: state.attributes[stat] + amount,
    },
  };
}

export function grantExperience(
  state: PlayerProgressState,
  expGain: number,
  maxLevelsOverride?: number | null
): { nextState: PlayerProgressState; leveledUp: boolean; levelsGained: number } {
  let exp = state.exp + Math.max(0, Math.round(expGain));
  let level = state.level;
  let expToNext = state.expToNext;
  let statPoints = state.statPoints;
  let leveledUp = false;
  let levelsGained = 0;

  const effectiveMaxLevels =
    maxLevelsOverride !== undefined ? maxLevelsOverride : CHARACTER_SCALING.maxLevelsPerKill;
  const hasLevelCap =
    typeof effectiveMaxLevels === 'number' &&
    Number.isFinite(effectiveMaxLevels) &&
    effectiveMaxLevels > 0;

  const ptsCfg = CHARACTER_SCALING.statPointsPerLevelByTier;
  const pointsPerLevel =
    state.classTier === 3 ? ptsCfg.tier3 : state.classTier === 2 ? ptsCfg.tier2 : ptsCfg.tier1;

  while (exp >= expToNext) {
    if (hasLevelCap && levelsGained >= (effectiveMaxLevels as number)) {
      // Classic MU cap: prevent gaining more than maxLevelsPerKill from a single kill (clamp to 99% of next level)
      exp = Math.max(0, expToNext - 1);
      break;
    }
    exp -= expToNext;
    level += 1;
    levelsGained += 1;
    statPoints += pointsPerLevel;
    expToNext = calculateExpToNextLevel(level);
    leveledUp = true;
  }

  return {
    nextState: {
      ...state,
      level,
      exp,
      expToNext,
      statPoints,
    },
    leveledUp,
    levelsGained,
  };
}

/**
 * Computes classic MU Online bottom EXP bar metrics:
 * - `totalPct`: 0..100 progress toward the next level across the 10-segment bar
 * - `segmentDigit`: 0..9 tens-digit indicator displayed to the right of the bar
 *   (0 = 0..9.9%, 1 = 10..19.9%, 3 = 30..39.9%, ..., 9 = 90..100%)
 */
export function computeExpBarProgress(
  exp: number,
  expToNext: number
): { totalPct: number; segmentDigit: number } {
  const safeNext = Math.max(1, Number.isFinite(expToNext) ? expToNext : 1);
  const safeExp = Math.max(0, Number.isFinite(exp) ? exp : 0);
  const ratio = Math.max(0, Math.min(1, safeExp / safeNext));
  const totalPct = Math.round(ratio * 1000) / 10;
  const segmentDigit = Math.min(9, Math.floor(ratio * 10 + 1e-9));
  return { totalPct, segmentDigit };
}

export function evolveCharacterClass(
  state: PlayerProgressState
): { nextState: PlayerProgressState; success: boolean; message: string } {
  if (state.classTier >= 3) {
    return {
      nextState: state,
      success: false,
      message: 'Вы уже достигли высшей профессии Мастера!',
    };
  }

  const isFirstProfUpgrade = state.classTier === 1;
  const profCfg = isFirstProfUpgrade
    ? CHARACTER_SCALING.professions.first
    : CHARACTER_SCALING.professions.second;
  const reqLevel = profCfg.requiredLevel;
  const zenCost = profCfg.zenCost;
  const bonusPoints = profCfg.bonusStatPoints;
  const questItemName = getFirstProfQuestItemName(state.classId);

  if (state.level < reqLevel) {
    return {
      nextState: state,
      success: false,
      message: `Для этой профессии требуется Уровень ${reqLevel} (сейчас Ур. ${state.level}/${reqLevel}).`,
    };
  }

  if (profCfg.requiresQuestRelic && !state.hasFirstProfQuestItem) {
    return {
      nextState: state,
      success: false,
      message: `Требуется квестовая реликвия «${questItemName}»! Выбейте её с элитных квестовых монстров (★ Личи, Минотавры/Големы или Боссы на спотах).`,
    };
  }

  if (state.zen < zenCost) {
    return {
      nextState: state,
      success: false,
      message: `Для ритуала Жрицы Себины требуется ${zenCost} Zen.`,
    };
  }

  const nextTier = (state.classTier + 1) as ClassTier;
  const newTitle = getClassDisplayTitle(state.classId, nextTier);

  return {
    nextState: {
      ...state,
      classTier: nextTier,
      zen: state.zen - zenCost,
      statPoints: state.statPoints + bonusPoints,
      hasFirstProfQuestItem: isFirstProfUpgrade ? false : state.hasFirstProfQuestItem,
    },
    success: true,
    message: `Поздравляем! Вы сдали реликвию Себине и получили профессию ${newTitle}! Открыт 4-й ультимативный навык и +${bonusPoints} очков характеристик!`,
  };
}

export function getTerritoryEffectiveRequiredLevel(
  baseRecommendedLevel: number,
  playerResets = 0
): number {
  const safeResets = Math.max(0, Math.floor(playerResets || 0));
  const reduction =
    safeResets * CHARACTER_SCALING.grandReset.territoryLevelReductionPerReset;
  return Math.max(1, baseRecommendedLevel - reduction);
}

export function getGrandResetRequirements(currentResets = 0): {
  nextResetNumber: number;
  requiredLevel: number;
  zenCost: number;
  bonusStatPoints: number;
  currentTerritoryLevelReduction: number;
  nextTerritoryLevelReduction: number;
} {
  const gr = CHARACTER_SCALING.grandReset;
  const safeResets = Math.max(0, Math.floor(currentResets || 0));
  const nextResetNumber = safeResets + 1;
  const requiredLevel = gr.requiredLevel + safeResets * gr.extraRequiredLevelPerReset;
  const zenCost = gr.baseZenCost + safeResets * gr.extraZenCostPerReset;
  const bonusStatPoints = nextResetNumber * gr.bonusStatPoints;
  return {
    nextResetNumber,
    requiredLevel,
    zenCost,
    bonusStatPoints,
    currentTerritoryLevelReduction: safeResets * gr.territoryLevelReductionPerReset,
    nextTerritoryLevelReduction: nextResetNumber * gr.territoryLevelReductionPerReset,
  };
}

export function canEnterTerritory(
  playerLevel: number,
  territoryId: TerritoryId,
  playerResets = 0
): {
  allowed: boolean;
  requiredLevel: number;
  baseRequiredLevel: number;
  levelReduction: number;
  territory: TerritoryDefinition;
} {
  const territory = TERRITORIES.find((t) => t.id === territoryId) ?? TERRITORIES[0];
  const baseRequiredLevel = territory.recommendedLevel;
  const requiredLevel = getTerritoryEffectiveRequiredLevel(baseRequiredLevel, playerResets);
  const levelReduction = Math.max(0, baseRequiredLevel - requiredLevel);
  return {
    allowed: playerLevel >= requiredLevel,
    requiredLevel,
    baseRequiredLevel,
    levelReduction,
    territory,
  };
}

export function performGrandReset(
  state: PlayerProgressState
): { nextState: PlayerProgressState; success: boolean; message: string } {
  const gr = CHARACTER_SCALING.grandReset;
  const req = getGrandResetRequirements(state.resets);

  if (state.level < req.requiredLevel) {
    return {
      nextState: state,
      success: false,
      message: `Гранд Ресет #${req.nextResetNumber} доступен с ${req.requiredLevel}-го уровня (сейчас Ур. ${state.level}/${req.requiredLevel}).`,
    };
  }

  if (state.zen < req.zenCost) {
    return {
      nextState: state,
      success: false,
      message: `Для Гранд Ресета #${req.nextResetNumber} требуется ${req.zenCost.toLocaleString('ru-RU')} Zen (сейчас ${state.zen.toLocaleString('ru-RU')} Zen).`,
    };
  }

  const nextResets = req.nextResetNumber;
  const cls = CLASSES[state.classId];
  const resetStatPoints = req.bonusStatPoints;

  return {
    nextState: {
      ...state,
      resets: nextResets,
      zen: state.zen - req.zenCost,
      level: 1,
      exp: 0,
      expToNext: calculateExpToNextLevel(1),
      attributes: { ...cls.baseAttributes },
      statPoints: resetStatPoints,
      territoryId: 'lorencia',
      inBloodCastle: false,
      killsInTerritory: 0,
      highestReachedTerritoryIdx: 0,
    },
    success: true,
    message: `Гранд Ресет #${nextResets} выполнен за ${req.zenCost.toLocaleString('ru-RU')} Zen! Статы сожжены до базы, герой в Лоренсии (Ур. 1), получено ${resetStatPoints} очков (${nextResets}×${gr.bonusStatPoints}) и −${req.nextTerritoryLevelReduction} ур. к телепорту в города!`,
  };
}

export function upgradeItemWithJewel(
  state: PlayerProgressState,
  itemId: string,
  jewelType: 'bless' | 'soul' | 'life',
  deterministicRoll = 0.25
): { nextState: PlayerProgressState; success: boolean; message: string } {
  if (state.jewels[jewelType] <= 0) {
    const names = { bless: 'Jewel of Bless', soul: 'Jewel of Soul', life: 'Jewel of Life' };
    return {
      nextState: state,
      success: false,
      message: `Недостаточно камней (${names[jewelType]}).`,
    };
  }

  let targetItem: EquipmentItem | null = null;
  let equippedSlot: ItemSlot | null = null;

  (['weapon', 'armor', 'helm', 'wings', 'ring', 'pendant'] as ItemSlot[]).forEach((slot) => {
    if (state.equipped[slot]?.id === itemId) {
      targetItem = state.equipped[slot];
      equippedSlot = slot;
    }
  });

  if (!targetItem) {
    targetItem = state.inventory.find((i) => i.id === itemId) ?? null;
  }

  if (!targetItem) {
    return { nextState: state, success: false, message: 'Предмет не найден.' };
  }

  const upg = DROP_RATES.itemUpgrades;

  if (jewelType === 'life') {
    if ((targetItem.lifeOption ?? 0) >= upg.lifeOptionMax) {
      return {
        nextState: state,
        success: false,
        message: `Опция Jewel of Life уже достигла максимума +${upg.lifeOptionMax}!`,
      };
    }
    const nextLife = Math.min(upg.lifeOptionMax, (targetItem.lifeOption ?? 0) + upg.lifeOptionStep);
    const updatedItem: EquipmentItem = {
      ...targetItem,
      lifeOption: nextLife,
      valueZen: Math.round(targetItem.valueZen * upg.valueMultiplierOnLifeUp),
    };
    const nextJewels = { ...state.jewels, life: state.jewels.life - 1 };

    if (equippedSlot) {
      return {
        nextState: {
          ...state,
          jewels: nextJewels,
          equipped: { ...state.equipped, [equippedSlot]: updatedItem },
        },
        success: true,
        message: `Jewel of Life усилил ${updatedItem.name}: доп. опция +${nextLife}!`,
      };
    }
    return {
      nextState: {
        ...state,
        jewels: nextJewels,
        inventory: state.inventory.map((i) => (i.id === itemId ? updatedItem : i)),
      },
      success: true,
      message: `Jewel of Life усилил ${updatedItem.name}: доп. опция +${nextLife}!`,
    };
  }

  if (targetItem.level >= upg.maxItemLevel) {
    return {
      nextState: state,
      success: false,
      message: `Предмет уже достиг максимума +${upg.maxItemLevel}!`,
    };
  }

  const successRate =
    jewelType === 'bless'
      ? targetItem.level < upg.blessGuaranteedBelowLevel
        ? upg.blessLowLevelRate
        : upg.blessHighLevelRate
      : upg.soulSuccessRate;
  const isSuccess = deterministicRoll <= successRate;

  const newLevel = isSuccess
    ? targetItem.level + 1
    : jewelType === 'soul' && targetItem.level >= upg.soulDowngradeMinLevel
      ? Math.max(0, targetItem.level - 1)
      : targetItem.level;

  const updatedItem: EquipmentItem = {
    ...targetItem,
    level: newLevel,
    valueZen: Math.round(targetItem.valueZen * (isSuccess ? upg.valueMultiplierOnLevelUp : 1.0)),
  };

  const nextJewels = {
    ...state.jewels,
    [jewelType]: state.jewels[jewelType] - 1,
  };

  if (equippedSlot) {
    return {
      nextState: {
        ...state,
        jewels: nextJewels,
        equipped: {
          ...state.equipped,
          [equippedSlot]: updatedItem,
        },
      },
      success: isSuccess,
      message: isSuccess
        ? `Успех! ${updatedItem.name} улучшен до +${updatedItem.level}!`
        : `Камень погас... Уровень предмета: +${updatedItem.level}.`,
    };
  }

  return {
    nextState: {
      ...state,
      jewels: nextJewels,
      inventory: state.inventory.map((i) => (i.id === itemId ? updatedItem : i)),
    },
    success: isSuccess,
    message: isSuccess
      ? `Успех! ${updatedItem.name} улучшен до +${updatedItem.level}!`
      : `Камень погас... Уровень предмета: +${updatedItem.level}.`,
  };
}

export function craftChaosWings(
  state: PlayerProgressState
): { nextState: PlayerProgressState; success: boolean; message: string; craftedWings?: EquipmentItem } {
  const zenCost = DROP_RATES.chaosMachine.wingsCraftZenCost;
  const chaosCost = DROP_RATES.chaosMachine.wingsCraftChaosCost;
  if (state.jewels.chaos < chaosCost) {
    return {
      nextState: state,
      success: false,
      message: `Требуется ${chaosCost} Jewel of Chaos для Машины Хаоса.`,
    };
  }
  if (state.zen < zenCost) {
    return { nextState: state, success: false, message: `Требуется ${zenCost} Zen для запуска синтеза.` };
  }

  const hasTier2Wings = state.equipped.wings !== null;

  const wingNamesTier2: Record<CharacterClassId, string> = {
    dark_knight: 'Крылья Сатаны (Wings of Satan II)',
    dark_wizard: 'Крылья Небес (Wings of Heaven II)',
    fairy_elf: 'Крылья Эльфа (Wings of Elf II)',
  };

  const wingNamesTier3: Record<CharacterClassId, string> = {
    dark_knight: 'Крылья Шторма (Wings of Storm III)',
    dark_wizard: 'Крылья Вечности (Wings of Eternal III)',
    fairy_elf: 'Крылья Иллюзии (Wings of Illusion III)',
  };

  const currentWingLevel = state.equipped.wings?.level ?? 0;
  const newWings: EquipmentItem = {
    id: `wings_${state.classId}_${Date.now()}`,
    name: hasTier2Wings ? wingNamesTier3[state.classId] : wingNamesTier2[state.classId],
    slot: 'wings',
    rarity: hasTier2Wings ? 'ancient' : 'excellent',
    level: Math.min(15, currentWingLevel + 2),
    lifeOption: hasTier2Wings ? 12 : 8,
    baseAttack: hasTier2Wings ? 42 : 26,
    baseDefense: hasTier2Wings ? 36 : 22,
    critChanceBonus: hasTier2Wings ? 14 : 8,
    moveSpeedBonus: hasTier2Wings ? 32 : 24,
    setName: CLASSES[state.classId].setName,
    classRestriction: state.classId,
    excellentOption: hasTier2Wings
      ? 'Ancient Крылья 3-го Уровня: Игнорирование 10% брони + Аура Полёта'
      : 'Excellent Крылья 2-го Уровня: Поглощение 20% урона + Скорость полёта',
    valueZen: hasTier2Wings ? 4800 : 2500,
  };

  return {
    nextState: {
      ...state,
      zen: state.zen - zenCost,
      jewels: {
        ...state.jewels,
        chaos: state.jewels.chaos - 1,
      },
      equipped: {
        ...state.equipped,
        wings: newWings,
      },
    },
    success: true,
    message: `Синтез Хаоса завершён! Выкованы ${newWings.name} +${newWings.level} (надеты автоматически)!`,
    craftedWings: newWings,
  };
}

export function generateEquipmentDrop(
  classId: CharacterClassId,
  territoryIdx: number,
  isBoss: boolean,
  seedRoll = Math.random()
): EquipmentItem {
  // Proportional rarity progression by territory:
  // Cities 1-3 (idx 0..2): Strictly weak Common ('normal') items
  // Cities 4-7 (idx 3..6): Common ('normal') & Magic ('magic')
  // Cities 8-14 (idx 7..13): Normal, Magic & first Excellent items
  // Cities 15-19 (idx 14..18): Magic, Excellent & rare Ancient items
  // Cities 20-24 (idx 19..23): High Excellent & Ancient Set items
  let rarity: ItemRarity = 'normal';
  let itemLevel = 0;
  let lifeOption = 0;

  const rb = DROP_RATES.equipment.rarityByTerritoryBand;
  if (territoryIdx <= rb.earlyMaxIdx) {
    // Golden Bosses ALWAYS drop rare (Magic / Excellent) gear even in early cities; regular mobs drop Common
    if (isBoss) {
      rarity = seedRoll > 0.45 ? 'excellent' : 'magic';
      itemLevel = seedRoll > 0.7 ? 4 : 3;
      lifeOption = seedRoll > 0.5 ? 8 : 4;
    } else {
      rarity = 'normal';
      itemLevel = seedRoll > rb.earlyRegularPlusOneThreshold ? 1 : 0;
      lifeOption = 0;
    }
  } else if (territoryIdx <= rb.midEarlyMaxIdx) {
    if (isBoss) {
      rarity = seedRoll > 0.3 ? 'excellent' : 'magic';
      itemLevel = seedRoll > 0.6 ? 6 : 5;
      lifeOption = 8;
    } else {
      rarity = seedRoll > rb.midEarlyMagicThreshold ? 'magic' : 'normal';
      itemLevel = Math.floor(seedRoll * 2) + 1;
      lifeOption = seedRoll > rb.midEarlyLifeOptThreshold ? 4 : 0;
    }
  } else if (territoryIdx <= rb.midMaxIdx) {
    rarity = isBoss
      ? seedRoll > 0.72
        ? 'ancient'
        : 'excellent'
      : seedRoll > rb.midRegularExcellentThreshold
        ? 'excellent'
        : seedRoll > rb.midRegularMagicThreshold
          ? 'magic'
          : 'normal';
    itemLevel = isBoss ? 6 + Math.floor(seedRoll * 2) : Math.floor(seedRoll * 3) + 2;
    lifeOption = isBoss ? 12 : seedRoll > rb.midRegularLifeOptThreshold ? 4 : 0;
  } else if (territoryIdx <= rb.lateMaxIdx) {
    rarity = isBoss
      ? seedRoll > rb.lateBossAncientThreshold
        ? 'ancient'
        : 'excellent'
      : seedRoll > rb.lateRegularAncientThreshold
        ? 'ancient'
        : seedRoll > rb.lateRegularExcellentThreshold
          ? 'excellent'
          : 'magic';
    itemLevel = isBoss ? 8 + Math.floor(seedRoll * 2) : Math.floor(seedRoll * 3) + 4;
    lifeOption = isBoss ? 12 : 8;
  } else {
    rarity = isBoss
      ? seedRoll > rb.endgameBossAncientThreshold
        ? 'ancient'
        : 'excellent'
      : seedRoll > rb.endgameRegularAncientThreshold
        ? 'ancient'
        : seedRoll > rb.endgameRegularExcellentThreshold
          ? 'excellent'
          : 'magic';
    itemLevel = isBoss
      ? Math.min(13, 9 + Math.floor(seedRoll * 4))
      : Math.floor(seedRoll * 4) + 6;
    lifeOption = isBoss ? 16 : 12;
  }

  const slotRoll = Math.random();
  const slot: ItemSlot =
    slotRoll < DROP_RATES.equipment.slotThresholds.weaponMax
      ? 'weapon'
      : slotRoll < DROP_RATES.equipment.slotThresholds.armorMax
        ? 'armor'
        : 'helm';
  const tier = territoryIdx + 1;
  const cls = CLASSES[classId];

  const weaponNames: Record<CharacterClassId, string[]> = {
    dark_knight: [
      'Короткий Меч Лоренсии',
      'Клинок Изумрудной Нории',
      'Рунный Меч Эльбеланда',
      'Ледяной Клинок Девиаса',
      'Клинок Разрушения',
      'Трезубец Атланса',
      'Коса Балрога',
      'Клинок Заикана Таркана',
      'Меч Огненного Феникса',
      'Клинок Бездны Калимы',
      'Королевский Меч Лорена',
      'Божественный Меч Архангела',
    ],
    dark_wizard: [
      'Ученический Посох Лоренсии',
      'Посох Древней Нории',
      'Жезл Иллюзий Эльбеланда',
      'Ледяной Посох Девиаса',
      'Посох Души Дракона',
      'Посох Вод Атланса',
      'Посох Пламени Балрога',
      'Жезл Песков Таркана',
      'Посох Небес Икаруса',
      'Жезл Оракула Калимы',
      'Скипетр Империи Кантуру',
      'Посох Архангела Кундуна',
    ],
    fairy_elf: [
      'Короткий Лук Лоренсии',
      'Лук Королевы Нории',
      'Лук Ветров Эльбеланда',
      'Хрустальный Лук Девиаса',
      'Арбалет Святого Духа',
      'Коралловый Лук Атланса',
      'Лук Хаоса Башни',
      'Лук Золотых Песков',
      'Крылатый Лук Икаруса',
      'Арбалет Кошмара Кантуру',
      'Лук Ледяного Раклиона',
      'Божественный Арбалет Архангела',
    ],
  };

  const armorNames: Record<CharacterClassId, string[]> = {
    dark_knight: [
      'Кожаный Доспех Лоренсии',
      'Броня Стража Нории',
      'Доспех Рыцаря Эльбеланда',
      'Латы Северного Девиаса',
      'Латы Чёрного Феникса',
      'Чешуйчатый Доспех Атланса',
      'Броня Повелителя Башни',
      'Латы Пустынного Титана',
      'Доспех Небесного Дракона',
      'Броня Императора Кантуру',
      'Кираса Вечного Льда',
      'Доспех Великого Титана',
    ],
    dark_wizard: [
      'Холщовая Мантия Лоренсии',
      'Мантия Мудреца Нории',
      'Роба Туманов Эльбеланда',
      'Мантия Вьюги Девиаса',
      'Мантия Легендарного Духа',
      'Одеяние Бездны Атланса',
      'Мантия Затмения Башни',
      'Мантия Бури Таркана',
      'Одеяние Звёздного Икаруса',
      'Роба Реликвий Кантуру',
      'Мантия Пентаграмм Ахерона',
      'Мантия Вечности Кундуна',
    ],
    fairy_elf: [
      'Лёгкая Туника Лоренсии',
      'Доспех Стража Нории',
      'Туника Луны Эльбеланда',
      'Одеяние Снегов Девиаса',
      'Одеяние Красного Духа',
      'Латы Сирены Атланса',
      'Доспех Валькирии Башни',
      'Одеяние Оазиса Таркана',
      'Крылатый Доспех Икаруса',
      'Броня Стража Крайвульфа',
      'Латы Хрустальной Никси',
      'Божественные Латы Сильфиды',
    ],
  };

  const helmNames: Record<CharacterClassId, string[]> = {
    dark_knight: [
      'Кожаный Шлем Лоренсии',
      'Шлем Стража Нории',
      'Корона Эльбеланда',
      'Шлем Льдов Девиаса',
      'Шлем Чёрного Феникса',
      'Шлем Глубин Атланса',
      'Рогатый Шлем Балрога',
      'Шлем Песчаной Бури',
      'Корона Небесного Феникса',
      'Шлем Титана Кантуру',
      'Корона Фереи',
      'Корона Великого Титана',
    ],
    dark_wizard: [
      'Повязка Ученика Лоренсии',
      'Венец Нории',
      'Диадема Эльбеланда',
      'Корона Стужи Девиаса',
      'Венец Легендарного Духа',
      'Тиара Атланса',
      'Корона Затмения',
      'Венец Оракула Таркана',
      'Диадема Икаруса',
      'Венец Кошмара Кантуру',
      'Корона Ахерона',
      'Корона Вечности',
    ],
    fairy_elf: [
      'Обруч Рощи Лоренсии',
      'Диадема Стража Нории',
      'Тиара Эльбеланда',
      'Венец Льдов Девиаса',
      'Тиара Красного Духа',
      'Корона Сирены Атланса',
      'Диадема Валькирии',
      'Тиара Песков Таркана',
      'Венец Облаков Икаруса',
      'Корона Алтаря Волка',
      'Диадема Озера Никси',
      'Корона Сильфиды',
    ],
  };

  const namePool =
    slot === 'weapon'
      ? weaponNames[classId]
      : slot === 'armor'
        ? armorNames[classId]
        : helmNames[classId];
  const mappedNameIdx = Math.min(namePool.length - 1, Math.floor(territoryIdx / 2));
  const baseName = namePool[mappedNameIdx];
  const itemName =
    rarity === 'ancient'
      ? `Anc. ${baseName}`
      : rarity === 'excellent'
        ? `Exc. ${baseName}`
        : baseName;

  // Proportional base attack and defense scaling from weak Common gear in Lorencia to powerful endgame artifacts
  const proportionalBaseAttack =
    slot === 'weapon'
      ? Math.round(10 + tier * 8 + Math.pow(tier, 1.62) * 3.8 + (isBoss ? tier * 2 : 0))
      : slot === 'helm'
        ? Math.round(tier * 3)
        : 0;

  const proportionalBaseDefense =
    slot !== 'weapon'
      ? Math.round(7 + tier * 6 + Math.pow(tier, 1.56) * 2.8 + (isBoss ? Math.round(tier * 1.5) : 0))
      : 0;

  return {
    id: `drop_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    name: itemName,
    slot,
    rarity,
    level: itemLevel,
    lifeOption,
    baseAttack: proportionalBaseAttack,
    baseDefense: proportionalBaseDefense,
    critChanceBonus:
      rarity === 'ancient'
        ? 10 + Math.floor(tier / 2)
        : rarity === 'excellent'
          ? 6 + Math.floor(tier / 2)
          : rarity === 'magic'
            ? 2 + Math.floor(tier / 4)
            : 0,
    moveSpeedBonus: slot !== 'weapon' && (rarity === 'excellent' || rarity === 'ancient') ? 10 : 0,
    setName: rarity === 'ancient' || rarity === 'excellent' ? cls.setName : undefined,
    classRestriction: classId,
    excellentOption:
      rarity === 'ancient'
        ? 'Ancient Сет: +18% АТК и +20% Двойной урон (при 3+ вещах)'
        : rarity === 'excellent'
          ? slot === 'weapon'
            ? 'Excellent: +10% Крит. шанс и Урон +Уровень/20'
            : 'Excellent: Снижение урона +8% и Отражение +5%'
          : undefined,
    valueZen: (tier * 180 + itemLevel * 120) * (rarity === 'ancient' ? 4 : rarity === 'excellent' ? 2 : 1),
  };
}

export function canTerritoryDropChaos(territoryRecommendedLevel: number): boolean {
  return territoryRecommendedLevel >= DROP_RATES.jewels.minTerritoryLevelForRegularChaos;
}

export function rollJewelDropType(
  territoryRecommendedLevel: number,
  isBoss: boolean,
  jewelRoll = Math.random()
): 'jewel_bless' | 'jewel_soul' | 'jewel_life' | 'jewel_chaos' | null {
  const jCfg = DROP_RATES.jewels;
  const dropMult = SERVER_CONFIG.rates.dropChanceMultiplier;

  if (isBoss) {
    if (jewelRoll < jCfg.bossCumulative.chaosMax) {
      return 'jewel_chaos';
    }
    if (jewelRoll < jCfg.bossCumulative.lifeMax) {
      return 'jewel_life';
    }
    if (jewelRoll < jCfg.bossCumulative.soulMax) {
      return 'jewel_soul';
    }
    return 'jewel_bless';
  }

  const scaledRoll = dropMult > 0 ? jewelRoll / dropMult : jewelRoll;
  if (scaledRoll >= jCfg.regularTotalChance) {
    return null;
  }

  const allowChaos = canTerritoryDropChaos(territoryRecommendedLevel);

  if (allowChaos) {
    if (scaledRoll < jCfg.regularHighTierCumulative.chaosMax) {
      return 'jewel_chaos';
    }
    if (scaledRoll < jCfg.regularHighTierCumulative.lifeMax) {
      return 'jewel_life';
    }
    if (scaledRoll < jCfg.regularHighTierCumulative.soulMax) {
      return 'jewel_soul';
    }
    return 'jewel_bless';
  }

  if (scaledRoll < jCfg.regularLowTierCumulative.lifeMax) {
    return 'jewel_life';
  }
  if (scaledRoll < jCfg.regularLowTierCumulative.soulMax) {
    return 'jewel_soul';
  }
  return 'jewel_bless';
}

export function calculateTerritoryMonsterDefense(enemyLevelMultiplier: number): number {
  const md = CHARACTER_SCALING.monsterDefenseScaling;
  if (enemyLevelMultiplier <= md.minMultiplierThreshold) return 0;
  return Math.round(Math.pow(enemyLevelMultiplier - 1, md.exponent) * md.coefficient);
}

/**
 * Drops Blood Scroll (Кровавый Свиток) and Blood Fang (Кровавый Клык) from monsters
 * for crafting the Blood Castle Ticket (Invisibility Cloak) at the Chaos Goblin.
 */
export function rollBloodCastleMaterialDrop(
  isBoss: boolean,
  roll = Math.random()
): 'blood_scroll' | 'blood_fang' | null {
  const bcMat = DROP_RATES.bloodCastleMaterials;
  const dropMult = SERVER_CONFIG.rates.dropChanceMultiplier;
  if (isBoss) {
    if (roll < bcMat.bossScrollMax) return 'blood_scroll';
    if (roll < bcMat.bossFangMax) return 'blood_fang';
    return null;
  }
  const scaledRoll = dropMult > 0 ? roll / dropMult : roll;
  if (scaledRoll < bcMat.regularScrollMax) return 'blood_scroll';
  if (scaledRoll < bcMat.regularFangMax) return 'blood_fang';
  return null;
}

/**
 * Generates server-authoritative shared ground loot drops when a monster dies.
 * Used on `server.ts` so every player in the zone sees the exact same ground drops
 * (and also reused as the offline single-player fallback).
 */
export function generateMonsterGroundDrops(params: {
  classId: CharacterClassId;
  territoryId: TerritoryId;
  inBloodCastle: boolean;
  dropX: number;
  dropY: number;
  isBoss: boolean;
  zenReward: number;
  isQuestMonster?: boolean;
  allowQuestItem?: boolean;
  nowMs?: number;
  rng?: () => number;
}): LootDrop[] {
  const rng = params.rng ?? Math.random;
  const nowWall = params.nowMs ?? Date.now();
  const expiresAtMs = nowWall + GROUND_LOOT_TTL_MS;
  const territoryIdx = Math.max(
    0,
    TERRITORIES.findIndex((t) => t.id === params.territoryId)
  );
  const territory = TERRITORIES[territoryIdx] ?? TERRITORIES[0];
  const dropRateMult = SERVER_CONFIG.rates.dropChanceMultiplier;
  const drops: LootDrop[] = [];
  const uid = () => Math.floor(rng() * 1_000_000).toString(36);

  if (params.inBloodCastle) {
    if (rng() < Math.min(1, DROP_RATES.zen.bloodCastleMonsterChance * dropRateMult)) {
      drops.push({
        id: `srv_zen_${nowWall}_${uid()}`,
        type: 'zen',
        label: `${params.zenReward} Zen`,
        x: Math.round(params.dropX + (rng() * 24 - 12)),
        y: Math.round(params.dropY + (rng() * 24 - 12)),
        amount: Math.max(1, Math.round(params.zenReward)),
        rarityColor: '#facc15',
        spawnTime: nowWall,
        expiresAtMs,
      });
    }
    return drops;
  }

  if (
    (params.isBoss && DROP_RATES.zen.bossGuaranteed) ||
    rng() < Math.min(1, DROP_RATES.zen.regularMonsterChance * dropRateMult)
  ) {
    drops.push({
      id: `srv_zen_${nowWall}_${uid()}`,
      type: 'zen',
      label: `${params.zenReward} Zen`,
      x: Math.round(params.dropX + (rng() * 28 - 14)),
      y: Math.round(params.dropY + (rng() * 28 - 14)),
      amount: Math.max(1, Math.round(params.zenReward)),
      rarityColor: '#facc15',
      spawnTime: nowWall,
      expiresAtMs,
    });
  }

  const jType = rollJewelDropType(territory.recommendedLevel, params.isBoss, rng());
  if (jType) {
    const jLabel =
      jType === 'jewel_bless'
        ? 'Jewel of Bless'
        : jType === 'jewel_soul'
          ? 'Jewel of Soul'
          : jType === 'jewel_life'
            ? 'Jewel of Life'
            : 'Jewel of Chaos';
    drops.push({
      id: `srv_jewel_${nowWall}_${uid()}`,
      type: jType,
      label: jLabel,
      x: Math.round(params.dropX + (rng() * 36 - 18)),
      y: Math.round(params.dropY + (rng() * 36 - 18)),
      rarityColor: jType === 'jewel_life' ? '#34d399' : '#fbbf24',
      spawnTime: nowWall,
      expiresAtMs,
    });
  }

  const bcMat = rollBloodCastleMaterialDrop(params.isBoss, rng());
  if (bcMat) {
    const matLabel =
      bcMat === 'blood_scroll'
        ? '📜 Blood Scroll (Свиток Архангела)'
        : '🦴 Blood Fang (Клык Крови)';
    drops.push({
      id: `srv_bc_${nowWall}_${uid()}`,
      type: bcMat,
      label: matLabel,
      x: Math.round(params.dropX + (rng() * 36 - 18)),
      y: Math.round(params.dropY + (rng() * 36 - 18)),
      rarityColor: '#fb7185',
      spawnTime: nowWall,
      expiresAtMs,
    });
  }

  const equipChance = params.isBoss
    ? DROP_RATES.equipment.bossChance
    : Math.min(1, DROP_RATES.equipment.regularMonsterChance * dropRateMult);
  const equipDropCount = params.isBoss ? DROP_RATES.equipment.bossRareDropCount : 1;
  for (let dropIdx = 0; dropIdx < equipDropCount; dropIdx++) {
    if (!params.isBoss && rng() >= equipChance) continue;
    if (params.isBoss && dropIdx === 0 && rng() >= equipChance) continue;
    const eq = generateEquipmentDrop(params.classId, territoryIdx, params.isBoss);
    const eqColor =
      eq.rarity === 'ancient'
        ? '#c084fc'
        : eq.rarity === 'excellent'
          ? '#34d399'
          : eq.rarity === 'magic'
            ? '#38bdf8'
            : '#e7e5e4';
    const angle = dropIdx * 2.4 + rng() * 0.8;
    const spreadDist = params.isBoss ? 26 + dropIdx * 18 : 16;
    const lx = Math.round(params.dropX + Math.cos(angle) * spreadDist);
    const ly = Math.round(params.dropY + Math.sin(angle) * spreadDist);
    drops.push({
      id: `srv_eq_${eq.id}_${dropIdx}_${uid()}`,
      type: 'equipment',
      label: `${eq.name} +${eq.level}`,
      x: lx,
      y: ly,
      equipment: eq,
      rarityColor: eqColor,
      spawnTime: nowWall,
      expiresAtMs,
    });
  }

  const questDropChance = params.isBoss
    ? DROP_RATES.firstProfessionQuestItem.bossChance
    : Math.min(1, DROP_RATES.firstProfessionQuestItem.questMonsterChance * dropRateMult);
  if (params.isQuestMonster && params.allowQuestItem && rng() < questDropChance) {
    const qName = getFirstProfQuestItemName(params.classId);
    drops.push({
      id: `srv_quest_${nowWall}_${uid()}`,
      type: 'quest_item',
      label: `★ КВЕСТ: ${qName}`,
      x: Math.round(params.dropX),
      y: Math.round(params.dropY - 12),
      rarityColor: '#f59e0b',
      spawnTime: nowWall,
      expiresAtMs,
    });
  }

  return drops;
}

/**
 * Crafts a Blood Castle Ticket (Invisibility Cloak / Билет в Blood Castle) at the Chaos Goblin.
 * Recipe: 1 Blood Scroll + 1 Blood Fang + 1 Jewel of Chaos.
 */
export function craftBloodCastleTicket(
  state: PlayerProgressState,
  roll = Math.random()
): {
  nextState: PlayerProgressState;
  success: boolean;
  crafted: boolean;
  message: string;
} {
  if (state.bloodScrolls < 1 || state.bloodFangs < 1 || state.jewels.chaos < 1) {
    return {
      nextState: state,
      success: false,
      crafted: false,
      message: `Для варки Билета в Blood Castle нужны: 1 Blood Scroll (сейчас ${state.bloodScrolls}), 1 Blood Fang (сейчас ${state.bloodFangs}) и 1 Jewel of Chaos (сейчас ${state.jewels.chaos})!`,
    };
  }

  const nextAfterConsume: PlayerProgressState = {
    ...state,
    bloodScrolls: state.bloodScrolls - 1,
    bloodFangs: state.bloodFangs - 1,
    jewels: {
      ...state.jewels,
      chaos: state.jewels.chaos - 1,
    },
  };

  const successRate = DROP_RATES.chaosMachine.bloodCastleTicketSuccessRate;
  const pctLabel = Math.round(successRate * 100);
  const isSuccess = roll < successRate;
  if (!isSuccess) {
    return {
      nextState: nextAfterConsume,
      success: true,
      crafted: false,
      message: `🔥 Неудача синтеза (шанс ${pctLabel}%)! Blood Scroll, Blood Fang и Jewel of Chaos сгорели в Машине Хаоса.`,
    };
  }

  return {
    nextState: {
      ...nextAfterConsume,
      bloodCastleTickets: nextAfterConsume.bloodCastleTickets + 1,
    },
    success: true,
    crafted: true,
    message: `✨ Синтез успешен (${pctLabel}%)! Вы сварили Билет в Blood Castle (Плащ Невидимости)! Откройте Телепорт [T] или нажмите «Войти в Blood Castle».`,
  };
}

export function enterBloodCastle(state: PlayerProgressState): {
  nextState: PlayerProgressState;
  success: boolean;
  message: string;
} {
  if (state.inBloodCastle) {
    return {
      nextState: state,
      success: false,
      message: 'Вы уже находитесь на мосту Ивент-Зоны Blood Castle!',
    };
  }
  if (state.bloodCastleTickets < 1) {
    return {
      nextState: state,
      success: false,
      message:
        'Нужен Билет в Blood Castle! Выбейте Blood Scroll и Blood Fang с монстров и сварите билет у Гоблина Хаоса [K] (Scroll + Fang + Chaos, шанс 80%).',
    };
  }

  return {
    nextState: {
      ...state,
      bloodCastleTickets: state.bloodCastleTickets - 1,
      inBloodCastle: true,
    },
    success: true,
    message: `🩸 Вы вошли в Ивент-Зону BLOOD CASTLE! Этап 1/4: Убейте ${BLOOD_CASTLE_CONFIG.targetBridgeKills} монстров на узком мосту!`,
  };
}

export function exitBloodCastle(state: PlayerProgressState): PlayerProgressState {
  return {
    ...state,
    inBloodCastle: false,
  };
}

/**
 * Handles player death in the current zone:
 * - Inside Blood Castle: ONLY 1 attempt is allowed! Immediately exits Blood Castle
 *   (`inBloodCastle = false`) while keeping `territoryId` so the hero respawns in the exact
 *   city they departed from (cannot endlessly respawn or reset the Blood Castle timer).
 * - Outside Blood Castle: keeps the hero in their current territory to respawn in its Safe Zone.
 */
export function resolvePlayerDeathInZone(state: PlayerProgressState): {
  nextState: PlayerProgressState;
  exitedBloodCastle: boolean;
  originTerritoryId: TerritoryId;
  originTerritoryName: string;
  message: string;
} {
  const originTerritory =
    TERRITORIES.find((t) => t.id === state.territoryId) ?? TERRITORIES[0];

  if (state.inBloodCastle) {
    return {
      nextState: exitBloodCastle(state),
      exitedBloodCastle: true,
      originTerritoryId: originTerritory.id,
      originTerritoryName: originTerritory.name,
      message: `💀 Вы погибли в Blood Castle (только 1 попытка)! Возрождение в городе: ${originTerritory.name}.`,
    };
  }

  return {
    nextState: state,
    exitedBloodCastle: false,
    originTerritoryId: originTerritory.id,
    originTerritoryName: originTerritory.name,
    message: `💀 Герой пал в бою. Возрождение в безопасной зоне: ${originTerritory.name}.`,
  };
}

/**
 * Rolls Jewel of Chaos reward for completing Blood Castle:
 * - 80% -> 1 Jewel of Chaos
 * - 18% -> 2 Jewel of Chaos
 * -  2% -> 3 Jewel of Chaos
 */
export function rollBloodCastleChaosReward(roll = Math.random()): 1 | 2 | 3 {
  const safeRoll = Number.isFinite(roll) ? Math.max(0, Math.min(0.9999999, roll)) : 0;
  const { oneChaosChance, twoChaosChance } = BLOOD_CASTLE_CONFIG.questRewards.chaosRewardChances;
  if (safeRoll < oneChaosChance) return 1;
  if (safeRoll < oneChaosChance + twoChaosChance) return 2;
  return 3;
}

/**
 * Rewards the hero for completing the 4-stage Blood Castle event quest.
 */
export function completeBloodCastleQuest(
  state: PlayerProgressState,
  chaosRoll = Math.random()
): {
  nextState: PlayerProgressState;
  chaosReward: 1 | 2 | 3;
  expReward: number;
  zenReward: number;
  message: string;
} {
  const qr = BLOOD_CASTLE_CONFIG.questRewards;
  const chaosReward = rollBloodCastleChaosReward(chaosRoll);
  const expReward = Math.round(
    calculateExpToNextLevel(state.level) *
      qr.expMultiplierOfNextLevel *
      SERVER_CONFIG.rates.expMultiplier
  );
  const zenReward = Math.round(
    (qr.zenBase + state.level * qr.zenPerPlayerLevel) * SERVER_CONFIG.rates.zenMultiplier
  );

  // Quest completion grants full Archangel EXP reward without per-monster kill cap
  const { nextState } = grantExperience(state, expReward, null);

  return {
    nextState: {
      ...nextState,
      zen: nextState.zen + zenReward,
      jewels: {
        ...nextState.jewels,
        chaos: nextState.jewels.chaos + chaosReward,
      },
      bloodCastleClears: nextState.bloodCastleClears + 1,
    },
    chaosReward,
    expReward,
    zenReward,
    message: `🏆 КВЕСТ АРХАНГЕЛА В BLOOD CASTLE ВЫПОЛНЕН! Награда: +${chaosReward} Jewel of Chaos, +${expReward} Опыта и +${zenReward} Zen!`,
  };
}

/**
 * Returns the monster spawn composition for a given hunting camp.
 * Regular camps spawn 8 monsters.
 * VIP camps ("один спот будет вип на котором будет появляться +2 дальнебойных моба")
 * spawn 8 regular monsters + 2 guaranteed ranged monsters (10 total)!
 */
export function getCampSpawnSpecs(camp: HuntingCampDefinition): {
  totalCount: number;
  forceRangedFlags: boolean[];
} {
  const baseCount = camp.baseMonsterCount;
  const extraRanged = camp.isVip ? camp.vipExtraRangedCount : 0;
  const flags: boolean[] = [];
  for (let i = 0; i < baseCount; i++) {
    flags.push(false);
  }
  for (let r = 0; r < extraRanged; r++) {
    flags.push(true);
  }
  return {
    totalCount: baseCount + extraRanged,
    forceRangedFlags: flags,
  };
}

/**
 * Builds a unique, stylized map layout for each territory with winding trails (тропинки),
 * wooden/iron/stone fences (заборы), rivers & wooden bridges (речки и мостики),
 * trees/camps/signposts, and 8 hunting spots where 1 spot is a VIP spot (+2 ranged mobs).
 * City 1 (Lorencia) features an authentic handcrafted MU Online pastoral kingdom layout!
 */
export function getTerritoryMapLayout(territoryId: TerritoryId): TerritoryMapLayout {
  if (territoryId === 'lorencia') {
    const camps: HuntingCampDefinition[] = [
      {
        x: 0,
        y: -1850,
        title: '👑 ВИП-СПОТ: Северное Пастбище Личей (+2 Дальних)',
        isVip: true,
        baseMonsterCount: 8,
        vipExtraRangedCount: 2,
      },
      {
        x: 2050,
        y: 0,
        title: 'Восточный Тракт у Реки Лорен',
        isVip: false,
        baseMonsterCount: 8,
        vipExtraRangedCount: 0,
      },
      {
        x: 0,
        y: 2200,
        title: 'Южная Ферма и Загоны Быков',
        isVip: false,
        baseMonsterCount: 8,
        vipExtraRangedCount: 0,
      },
      {
        x: -2350,
        y: 0,
        title: 'Западная Лесопилка Лоренсии',
        isVip: false,
        baseMonsterCount: 8,
        vipExtraRangedCount: 0,
      },
      {
        x: 2950,
        y: -2850,
        title: 'СВ Старый Погост за Мостом',
        isVip: false,
        baseMonsterCount: 8,
        vipExtraRangedCount: 0,
      },
      {
        x: -3150,
        y: -3050,
        title: 'СЗ Заброшенный Хутор',
        isVip: false,
        baseMonsterCount: 8,
        vipExtraRangedCount: 0,
      },
      {
        x: 3450,
        y: 3350,
        title: 'ЮВ Излучина Реки и Камыши',
        isVip: false,
        baseMonsterCount: 8,
        vipExtraRangedCount: 0,
      },
      {
        x: -3750,
        y: 3650,
        title: 'ЮЗ Старый Форт Рыцарей',
        isVip: false,
        baseMonsterCount: 8,
        vipExtraRangedCount: 0,
      },
    ];

    const trails: MapTrailSegment[] = [
      // North Royal Dirt Trail from North Gate to VIP Spot & NE/NW branches
      {
        style: 'dirt_trail',
        width: 86,
        points: [
          { x: 0, y: -560 },
          { x: -110, y: -980 },
          { x: 95, y: -1420 },
          { x: 0, y: -1850 },
        ],
      },
      // East River Trail from East Gate across the Wooden Bridge to East Spot
      {
        style: 'dirt_trail',
        width: 82,
        points: [
          { x: 560, y: 0 },
          { x: 950, y: 80 },
          { x: 1320, y: 0 },
          { x: 1680, y: -90 },
          { x: 2050, y: 0 },
        ],
      },
      // South Pasture Trail from South Gate to Cattle Farm
      {
        style: 'dirt_trail',
        width: 84,
        points: [
          { x: 0, y: 560 },
          { x: 130, y: 1080 },
          { x: -95, y: 1640 },
          { x: 0, y: 2200 },
        ],
      },
      // West Mill Trail from West Gate to Lumber Camp
      {
        style: 'dirt_trail',
        width: 80,
        points: [
          { x: -560, y: 0 },
          { x: -1120, y: -110 },
          { x: -1740, y: 95 },
          { x: -2350, y: 0 },
        ],
      },
      // Branch trail from North VIP Spot to NE Cemetery across North River Bridge
      {
        style: 'dirt_trail',
        width: 66,
        points: [
          { x: 0, y: -1850 },
          { x: 1180, y: -1820 },
          { x: 2100, y: -2320 },
          { x: 2950, y: -2850 },
        ],
      },
      // Branch trail from North VIP Spot to NW Homestead
      {
        style: 'dirt_trail',
        width: 66,
        points: [
          { x: 0, y: -1850 },
          { x: -1240, y: -2150 },
          { x: -2250, y: -2600 },
          { x: -3150, y: -3050 },
        ],
      },
      // Branch trail from South Farm to SE River Bend across South River Bridge
      {
        style: 'dirt_trail',
        width: 66,
        points: [
          { x: 0, y: 2200 },
          { x: 1440, y: 2240 },
          { x: 2520, y: 2790 },
          { x: 3450, y: 3350 },
        ],
      },
      // Branch trail from West Mill to SW Knight Outpost
      {
        style: 'dirt_trail',
        width: 66,
        points: [
          { x: -2350, y: 0 },
          { x: -2780, y: 1320 },
          { x: -3290, y: 2480 },
          { x: -3750, y: 3650 },
        ],
      },
    ];

    const rivers: MapRiverStream[] = [
      // The Great Lorencia Brook (Река Лорен) flowing from North-East to South-East with 3 wooden bridges
      {
        width: 145,
        waterColor: '#0f364d',
        foamColor: 'rgba(125, 211, 252, 0.45)',
        points: [
          { x: 1580, y: -5100 },
          { x: 1320, y: -3450 },
          { x: 1180, y: -1820 },
          { x: 1440, y: -880 },
          { x: 1320, y: 0 },
          { x: 1160, y: 1050 },
          { x: 1440, y: 2240 },
          { x: 1290, y: 3680 },
          { x: 1620, y: 5100 },
        ],
        bridges: [
          { x: 1320, y: 0, angle: 0, width: 195, length: 115 },
          { x: 1180, y: -1820, angle: 0, width: 185, length: 98 },
          { x: 1440, y: 2240, angle: 0, width: 185, length: 98 },
        ],
      },
      // Western Creek (Западный Ручей Лоренсии)
      {
        width: 98,
        waterColor: '#103147',
        foamColor: 'rgba(125, 211, 252, 0.36)',
        points: [
          { x: -4950, y: -1650 },
          { x: -3550, y: -1450 },
          { x: -2150, y: -1350 },
          { x: -1680, y: -740 },
          { x: -1740, y: 95 },
          { x: -1950, y: 1180 },
          { x: -1640, y: 2550 },
          { x: -2080, y: 4950 },
        ],
        bridges: [
          { x: -1740, y: 95, angle: 0, width: 145, length: 100 },
        ],
      },
    ];

    const fences: MapFenceLine[] = [
      // Wooden fences along the North Road leading to the VIP Spot
      { x1: -145, y1: -640, x2: -195, y2: -1380, style: 'wood_fence' },
      { x1: 145, y1: -640, x2: 195, y2: -1380, style: 'wood_fence' },
      // Wooden corral fences enclosing the VIP North Pasture (with gateway gap)
      { x1: -410, y1: -1520, x2: -120, y2: -1460, style: 'wood_fence' },
      { x1: 120, y1: -1460, x2: 410, y2: -1520, style: 'wood_fence' },
      { x1: -410, y1: -1520, x2: -430, y2: -2180, style: 'wood_fence' },
      { x1: 410, y1: -1520, x2: 430, y2: -2180, style: 'wood_fence' },
      // Wooden fences along the East Trail toward Lorencia River Bridge
      { x1: 640, y1: -115, x2: 1160, y2: -95, style: 'wood_fence' },
      { x1: 640, y1: 115, x2: 1160, y2: 135, style: 'wood_fence' },
      // Wooden cattle paddock fences near the South Farm Spot
      { x1: -390, y1: 1840, x2: -115, y2: 1810, style: 'wood_fence' },
      { x1: 115, y1: 1810, x2: 390, y2: 1840, style: 'wood_fence' },
      { x1: -390, y1: 1840, x2: -390, y2: 2560, style: 'wood_fence' },
      { x1: 390, y1: 1840, x2: 390, y2: 2560, style: 'wood_fence' },
      // West Lumber Mill wooden fences
      { x1: -650, y1: -125, x2: -1480, y2: -185, style: 'wood_fence' },
      { x1: -650, y1: 125, x2: -1480, y2: 165, style: 'wood_fence' },
      // Iron cemetery railings around the North-East Graveyard Spot
      { x1: 2580, y1: -2520, x2: 3320, y2: -2520, style: 'iron_railing' },
      { x1: 3320, y1: -2520, x2: 3320, y2: -3180, style: 'iron_railing' },
    ];

    const props: MapSceneryProp[] = [
      // Signposts outside the 4 Lorencia City Gates
      { x: 110, y: -635, kind: 'signpost', label: '↑ ВИП-Спот (Сев. Пастбище)' },
      { x: 645, y: -85, kind: 'signpost', label: '→ Мост через Реку Лорен' },
      { x: 115, y: 645, kind: 'signpost', label: '↓ Южные Фермы Быков' },
      { x: -645, y: -85, kind: 'signpost', label: '← Западная Лесопилка' },
      // Wooden carts, barrels, campfires & wells around Lorencia roads
      { x: -240, y: -880, kind: 'cart' },
      { x: 255, y: -1180, kind: 'campfire' },
      { x: -260, y: -1490, kind: 'barrel_cluster' },
      { x: 890, y: -180, kind: 'well' },
      { x: 1620, y: 170, kind: 'cart' },
      { x: 220, y: 950, kind: 'barrel_cluster' },
      { x: -250, y: 1380, kind: 'campfire' },
      { x: -1020, y: 210, kind: 'cart' },
      // Road lantern posts illuminating Lorencia's four main avenues
      { x: -105, y: -720, kind: 'lantern_post' },
      { x: 105, y: -1120, kind: 'lantern_post' },
      { x: -105, y: -1520, kind: 'lantern_post' },
      { x: 740, y: -95, kind: 'lantern_post' },
      { x: 1120, y: 115, kind: 'lantern_post' },
      { x: 1620, y: -120, kind: 'lantern_post' },
      { x: -115, y: 780, kind: 'lantern_post' },
      { x: 115, y: 1320, kind: 'lantern_post' },
      { x: -780, y: -105, kind: 'lantern_post' },
      { x: -1360, y: 115, kind: 'lantern_post' },
      // Ancient stone ruins, weathered boulders & pastoral wildflower patches
      { x: 860, y: -880, kind: 'ancient_ruin' },
      { x: -980, y: -920, kind: 'ancient_ruin' },
      { x: 2480, y: -1820, kind: 'ancient_ruin' },
      { x: -2420, y: 1680, kind: 'ancient_ruin' },
      { x: 640, y: 820, kind: 'boulder' },
      { x: -740, y: 1120, kind: 'boulder' },
      { x: 1860, y: 920, kind: 'boulder' },
      { x: -1950, y: -980, kind: 'boulder' },
      { x: 340, y: -740, kind: 'flower_patch' },
      { x: -350, y: -980, kind: 'flower_patch' },
      { x: 780, y: 260, kind: 'flower_patch' },
      { x: -380, y: 920, kind: 'flower_patch' },
      { x: 360, y: 1240, kind: 'flower_patch' },
      { x: -1180, y: -320, kind: 'flower_patch' },
      // Lush Oak & Pine Trees dotting the Lorencia pastures and riverbanks
      { x: -460, y: -790, kind: 'oak_tree' },
      { x: 480, y: -840, kind: 'oak_tree' },
      { x: -580, y: -1320, kind: 'pine_tree' },
      { x: 590, y: -1290, kind: 'oak_tree' },
      { x: 1080, y: -520, kind: 'oak_tree' },
      { x: 1060, y: 540, kind: 'oak_tree' },
      { x: 1580, y: -480, kind: 'pine_tree' },
      { x: 1590, y: 520, kind: 'oak_tree' },
      { x: -490, y: 840, kind: 'oak_tree' },
      { x: 520, y: 890, kind: 'pine_tree' },
      { x: -890, y: -560, kind: 'oak_tree' },
      { x: -940, y: 590, kind: 'pine_tree' },
      { x: -520, y: -1950, kind: 'oak_tree' },
      { x: 530, y: -1960, kind: 'oak_tree' },
      { x: 2420, y: -380, kind: 'oak_tree' },
      { x: 2450, y: 390, kind: 'pine_tree' },
      { x: 2150, y: -1450, kind: 'oak_tree' },
      { x: -2250, y: -1650, kind: 'pine_tree' },
      { x: 2350, y: 1850, kind: 'oak_tree' },
      { x: -2450, y: 2250, kind: 'pine_tree' },
    ];

    return {
      territoryId: 'lorencia',
      biomeTheme: 'lorencia_pasture',
      camps,
      trails,
      rivers,
      fences,
      props,
    };
  }

  // Distinct procedural biome layouts for the other 23 cities so every territory map feels detailed & unique!
  const tIdx = Math.max(0, TERRITORIES.findIndex((t) => t.id === territoryId));
  const vipIndex = (tIdx + 1) % 8;
  const angleOffset = (tIdx * 0.28) % (Math.PI / 2);

  const biomeTheme: TerritoryMapLayout['biomeTheme'] =
    territoryId === 'noria' ||
    territoryId === 'aida' ||
    territoryId === 'swamp_of_calmness' ||
    territoryId === 'karutan'
      ? 'noria_forest'
      : territoryId === 'devias' || territoryId === 'raklion' || territoryId === 'nixies_lake'
        ? 'devias_snow'
        : territoryId === 'atlans' || territoryId === 'kalima'
          ? 'atlans_abyss'
          : territoryId === 'tarkan'
            ? 'tarkan_desert'
            : territoryId === 'lost_tower' ||
                territoryId === 'dungeon' ||
                territoryId === 'vulcanus' ||
                territoryId === 'blood_castle' ||
                territoryId === 'barrack_of_balgass'
              ? 'vulcanus_lava'
              : territoryId === 'icarus' ||
                  territoryId === 'kanturu_ruins' ||
                  territoryId === 'kanturu_relics' ||
                  territoryId === 'crywolf' ||
                  territoryId === 'acheron'
                ? 'icarus_sky'
                : territoryId === 'elbeland' ||
                    territoryId === 'ferea' ||
                    territoryId === 'valley_of_loren'
                  ? 'elbeland_marsh'
                  : 'lorencia_pasture';

  const baseCamps: { x: number; y: number; title: string }[] = [
    { x: 0, y: -1850, title: 'Северная Застава' },
    { x: 2050, y: 0, title: 'Восточный Рубеж' },
    { x: 0, y: 2200, title: 'Южный Форпост' },
    { x: -2350, y: 0, title: 'Западный Бастион' },
    { x: 2950, y: -2850, title: 'СВ Древний Алтарь' },
    { x: -3150, y: -3050, title: 'СЗ Проклятый Курган' },
    { x: 3450, y: 3350, title: 'ЮВ Каньон Чудовищ' },
    { x: -3750, y: 3650, title: 'ЮЗ Тёмный Цитадель' },
  ];

  const camps: HuntingCampDefinition[] = baseCamps.map((c, idx) => {
    const isVip = idx === vipIndex;
    return {
      x: c.x,
      y: c.y,
      title: isVip ? `👑 ВИП-СПОТ: ${c.title} (+2 Дальних)` : c.title,
      isVip,
      baseMonsterCount: 8,
      vipExtraRangedCount: isVip ? 2 : 0,
    };
  });

  const pathStyle: MapTrailSegment['style'] =
    biomeTheme === 'noria_forest'
      ? 'forest_path'
      : biomeTheme === 'devias_snow' ||
          biomeTheme === 'vulcanus_lava' ||
          biomeTheme === 'icarus_sky' ||
          biomeTheme === 'atlans_abyss'
        ? 'cobblestone_road'
        : 'dirt_trail';

  const trails: MapTrailSegment[] = [
    {
      style: pathStyle,
      width: 82,
      points: [
        { x: 0, y: -560 },
        { x: Math.round(Math.sin(angleOffset) * 180), y: -1200 },
        { x: 0, y: -1850 },
      ],
    },
    {
      style: pathStyle,
      width: 82,
      points: [
        { x: 560, y: 0 },
        { x: 1300, y: Math.round(Math.cos(angleOffset) * 160) },
        { x: 2050, y: 0 },
      ],
    },
    {
      style: pathStyle,
      width: 82,
      points: [
        { x: 0, y: 560 },
        { x: Math.round(-Math.sin(angleOffset) * 180), y: 1380 },
        { x: 0, y: 2200 },
      ],
    },
    {
      style: pathStyle,
      width: 82,
      points: [
        { x: -560, y: 0 },
        { x: -1450, y: Math.round(-Math.cos(angleOffset) * 160) },
        { x: -2350, y: 0 },
      ],
    },
    // Outer diagonal roads connecting inner camps to outer fortress camps
    {
      style: pathStyle,
      width: 64,
      points: [
        { x: 0, y: -1850 },
        { x: 1450, y: -2100 },
        { x: 2950, y: -2850 },
      ],
    },
    {
      style: pathStyle,
      width: 64,
      points: [
        { x: 0, y: -1850 },
        { x: -1550, y: -2300 },
        { x: -3150, y: -3050 },
      ],
    },
    {
      style: pathStyle,
      width: 64,
      points: [
        { x: 0, y: 2200 },
        { x: 1650, y: 2550 },
        { x: 3450, y: 3350 },
      ],
    },
    {
      style: pathStyle,
      width: 64,
      points: [
        { x: -2350, y: 0 },
        { x: -2950, y: 1850 },
        { x: -3750, y: 3650 },
      ],
    },
  ];

  const riverWaterColor =
    biomeTheme === 'vulcanus_lava'
      ? '#7f1d1d'
      : biomeTheme === 'noria_forest'
        ? '#14532d'
        : biomeTheme === 'devias_snow'
          ? '#1e3a8a'
          : biomeTheme === 'atlans_abyss'
            ? '#0c4a6e'
            : biomeTheme === 'tarkan_desert'
              ? '#78350f'
              : '#0f364d';

  const riverFoamColor =
    biomeTheme === 'vulcanus_lava'
      ? 'rgba(251, 146, 60, 0.58)'
      : biomeTheme === 'noria_forest'
        ? 'rgba(74, 222, 128, 0.44)'
        : biomeTheme === 'tarkan_desert'
          ? 'rgba(251, 191, 36, 0.42)'
          : 'rgba(125, 211, 252, 0.46)';

  const riverSide = tIdx % 2 === 0 ? 1 : -1;
  const rivers: MapRiverStream[] = [
    {
      width: 136,
      waterColor: riverWaterColor,
      foamColor: riverFoamColor,
      points: [
        { x: riverSide * 1420, y: -4950 },
        { x: riverSide * 1240, y: -2100 },
        { x: riverSide * 1300, y: 0 },
        { x: riverSide * 1200, y: 2450 },
        { x: riverSide * 1480, y: 4950 },
      ],
      bridges: [
        { x: riverSide * 1300, y: 0, angle: 0, width: 182, length: 108 },
        { x: riverSide * 1240, y: -2100, angle: 0, width: 170, length: 94 },
        { x: riverSide * 1200, y: 2450, angle: 0, width: 170, length: 94 },
      ],
    },
  ];

  const fenceStyle: MapFenceLine['style'] =
    biomeTheme === 'vulcanus_lava' || biomeTheme === 'elbeland_marsh'
      ? 'iron_railing'
      : biomeTheme === 'devias_snow' || biomeTheme === 'icarus_sky' || biomeTheme === 'atlans_abyss'
        ? 'stone_wall'
        : 'wood_fence';

  const fences: MapFenceLine[] = [
    { x1: -140, y1: -640, x2: -185, y2: -1360, style: fenceStyle },
    { x1: 140, y1: -640, x2: 185, y2: -1360, style: fenceStyle },
    { x1: 640, y1: -120, x2: 1180, y2: -120, style: fenceStyle },
    { x1: 640, y1: 120, x2: 1180, y2: 120, style: fenceStyle },
    { x1: -640, y1: -120, x2: -1280, y2: -120, style: fenceStyle },
    { x1: -640, y1: 120, x2: -1280, y2: 120, style: fenceStyle },
  ];

  // Pick biome-appropriate primary & secondary scenery props
  const primaryFlora: MapSceneryProp['kind'] =
    biomeTheme === 'devias_snow'
      ? 'pine_tree'
      : biomeTheme === 'vulcanus_lava'
        ? 'lava_vent'
        : biomeTheme === 'atlans_abyss' || biomeTheme === 'icarus_sky'
          ? 'crystal_spire'
          : biomeTheme === 'tarkan_desert' || biomeTheme === 'elbeland_marsh'
            ? 'dead_tree'
            : 'oak_tree';

  const secondaryFeature: MapSceneryProp['kind'] =
    biomeTheme === 'devias_snow' || biomeTheme === 'atlans_abyss' || biomeTheme === 'icarus_sky'
      ? 'crystal_spire'
      : biomeTheme === 'vulcanus_lava' || biomeTheme === 'tarkan_desert'
        ? 'boulder'
        : biomeTheme === 'noria_forest'
          ? 'flower_patch'
          : 'ancient_ruin';

  const props: MapSceneryProp[] = [
    {
      x: 115,
      y: -640,
      kind: 'signpost',
      label: `ВИП: ${camps[vipIndex].title.replace('👑 ВИП-СПОТ: ', '')}`,
    },
    { x: 645, y: -85, kind: 'signpost', label: '→ Восточный Рубеж' },
    { x: 115, y: 645, kind: 'signpost', label: '↓ Южный Форпост' },
    { x: -645, y: -85, kind: 'signpost', label: '← Западный Бастион' },
    // Road lantern posts around all 4 exits
    { x: -105, y: -760, kind: 'lantern_post' },
    { x: 105, y: -1220, kind: 'lantern_post' },
    { x: 780, y: -95, kind: 'lantern_post' },
    { x: 1680, y: 105, kind: 'lantern_post' },
    { x: -105, y: 840, kind: 'lantern_post' },
    { x: 105, y: 1460, kind: 'lantern_post' },
    { x: -820, y: -95, kind: 'lantern_post' },
    { x: -1640, y: 105, kind: 'lantern_post' },
    // Campfires, carts, barrels & wells
    { x: -240, y: -920, kind: 'campfire' },
    { x: 880, y: -190, kind: 'cart' },
    { x: 250, y: 1020, kind: 'campfire' },
    { x: -940, y: 210, kind: 'barrel_cluster' },
    { x: 960, y: 240, kind: 'well' },
    // Ancient Ruins framing the mid-map wilderness
    { x: 920, y: -960, kind: 'ancient_ruin' },
    { x: -960, y: -940, kind: 'ancient_ruin' },
    { x: 1040, y: 1080, kind: 'ancient_ruin' },
    { x: -1080, y: 1040, kind: 'ancient_ruin' },
    { x: 2350, y: -1480, kind: 'ancient_ruin' },
    { x: -2480, y: 1520, kind: 'ancient_ruin' },
  ];

  // Deterministically scatter 36 rich biome landmarks & flora across the 10400x10400 map
  const GOLDEN_ANGLE = 2.399963229728653;
  for (let i = 0; i < 36; i++) {
    const angle = tIdx * 0.7 + i * GOLDEN_ANGLE;
    const ring = 880 + ((i * 217 + tIdx * 97) % 3450);
    const px = Math.round(Math.cos(angle) * ring);
    const py = Math.round(Math.sin(angle) * ring);
    // Avoid blocking camp centers directly
    const tooCloseToCamp = camps.some((c) => Math.hypot(c.x - px, c.y - py) < 280);
    if (tooCloseToCamp) continue;
    const kind: MapSceneryProp['kind'] =
      i % 4 === 0
        ? secondaryFeature
        : i % 5 === 0
          ? 'boulder'
          : i % 7 === 0
            ? 'ancient_ruin'
            : primaryFlora;
    props.push({ x: px, y: py, kind });
  }

  return {
    territoryId,
    biomeTheme,
    camps,
    trails,
    rivers,
    fences,
    props,
  };
}
