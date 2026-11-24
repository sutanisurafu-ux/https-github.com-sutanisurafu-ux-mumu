/**
 * ============================================================================
 * РЕЙТЫ ВЫПАДЕНИЯ ВЕЩЕЙ, КАМНЕЙ, КРАФТА И ЗАТОЧКИ (Drop & Craft Rates Config)
 * ============================================================================
 * Все вероятности задаются в диапазоне от 0.0 (0%) до 1.0 (100%).
 * Значения умножаются на SERVER_CONFIG.rates.dropChanceMultiplier там, где применимо.
 */

export const DROP_RATES = {
  /** Выпадение золота (Zen) с монстров */
  zen: {
    /** Шанс выпадения кучки Zen с обычного монстра (65%) */
    regularMonsterChance: 0.65,
    /** Шанс выпадения Zen с монстра на мосту Blood Castle (60%) */
    bloodCastleMonsterChance: 0.6,
    /** С босса Zen выпадает всегда (100%) */
    bossGuaranteed: true,
  },

  /** Выпадение экипировки (оружие, броня, шлем) */
  equipment: {
    /** Шанс выпадения шмотки с обычного монстра (7%) */
    regularMonsterChance: 0.07,
    /** Шанс выпадения шмотки с босса территории (100%) */
    bossChance: 1.0,
    /** Количество гарантированных редких (Magic/Excellent/Ancient) вещей с Золотого Босса */
    bossRareDropCount: 2,
    /** Распределение слотов выпавшей вещи: [0..weaponMax) -> weapon, [weaponMax..armorMax) -> armor, иначе helm */
    slotThresholds: {
      weaponMax: 0.42,
      armorMax: 0.75,
    },
    /**
     * Пороги редкости (Normal / Magic / Excellent / Ancient) по индексу локации (0 = Лоренсия ... 23 = конец)
     * Чем выше локация, тем выше шанс Excellent и Ancient.
     */
    rarityByTerritoryBand: {
      /** Города 1–3 (idx <= 2): только Normal */
      earlyMaxIdx: 2,
      earlyRegularPlusOneThreshold: 0.65,
      /** Города 4–7 (idx <= 6): Normal + Magic */
      midEarlyMaxIdx: 6,
      midEarlyMagicThreshold: 0.62,
      midEarlyLifeOptThreshold: 0.65,
      /** Города 8–14 (idx <= 13): Normal + Magic + первые Excellent */
      midMaxIdx: 13,
      midBossExcellentThreshold: 0.42,
      midRegularExcellentThreshold: 0.82,
      midRegularMagicThreshold: 0.32,
      midRegularLifeOptThreshold: 0.45,
      /** Города 15–19 (idx <= 18): Magic + Excellent + редкий Ancient */
      lateMaxIdx: 18,
      lateBossAncientThreshold: 0.62,
      lateRegularAncientThreshold: 0.88,
      lateRegularExcellentThreshold: 0.42,
      /** Города 20–24 (idx >= 19): Высокий Excellent и Ancient */
      endgameBossAncientThreshold: 0.35,
      endgameRegularAncientThreshold: 0.72,
      endgameRegularExcellentThreshold: 0.22,
    },
  },

  /** Выпадение квестовой реликвии на 1-ю профессию (с элитных квестовых мобов и боссов) */
  firstProfessionQuestItem: {
    /** Шанс с квестового монстра (★ Лич, Минотавр/Голем): 38% */
    questMonsterChance: 0.38,
    /** Шанс с босса территории: 100% */
    bossChance: 1.0,
  },

  /**
   * Выпадение камней заточки и крафта (Jewel of Bless / Soul / Life / Chaos)
   * Все пороги — накопительные (кумулятивные) от 0 до 1.
   */
  jewels: {
    /** Минимальный рекомендуемый уровень локации для дропа Jewel of Chaos с обычных мобов */
    minTerritoryLevelForRegularChaos: 150,

    /** Суммарный шанс выпадения ЛЮБОГО камня с обычного монстра (8%) */
    regularTotalChance: 0.08,

    /**
     * Распределение внутри regularTotalChance для локаций >= 150 ур. (где падает Chaos):
     *   [0 .. chaosMax)         -> Jewel of Chaos (2.2%)
     *   [chaosMax .. lifeMax)   -> Jewel of Life  (1.8%)
     *   [lifeMax .. soulMax)    -> Jewel of Soul  (2.0%)
     *   [soulMax .. total)      -> Jewel of Bless (2.0%)
     */
    regularHighTierCumulative: {
      chaosMax: 0.022,
      lifeMax: 0.04,
      soulMax: 0.06,
    },

    /**
     * Распределение внутри regularTotalChance для локаций < 150 ур. (без Chaos):
     *   [0 .. lifeMax)          -> Jewel of Life  (2.4%)
     *   [lifeMax .. soulMax)    -> Jewel of Soul  (2.8%)
     *   [soulMax .. total)      -> Jewel of Bless (2.8%)
     */
    regularLowTierCumulative: {
      lifeMax: 0.024,
      soulMax: 0.052,
    },

    /**
     * С боссов территории камень выпадает ВСЕГДА (100%):
     *   [0 .. chaosMax)         -> Jewel of Chaos (20%)
     *   [chaosMax .. lifeMax)   -> Jewel of Life  (30%)
     *   [lifeMax .. soulMax)    -> Jewel of Soul  (28%)
     *   [soulMax .. 1.0)        -> Jewel of Bless (22%)
     */
    bossCumulative: {
      chaosMax: 0.2,
      lifeMax: 0.5,
      soulMax: 0.78,
    },
  },

  /** Ингредиенты для варки билета в Blood Castle (Кровавый Свиток и Кровавый Клык) */
  bloodCastleMaterials: {
    /** Обычный монстр: [0..0.055) -> Blood Scroll (5.5%), [0.055..0.11) -> Blood Fang (5.5%) */
    regularScrollMax: 0.055,
    regularFangMax: 0.11,
    /** Босс территории: [0..0.35) -> Blood Scroll (35%), [0.35..0.70) -> Blood Fang (35%) */
    bossScrollMax: 0.35,
    bossFangMax: 0.7,
  },

  /** Машина Хаоса (Chaos Machine) — крафт крыльев и билета Blood Castle */
  chaosMachine: {
    /** Шанс успешной варки билета Blood Castle (80%) */
    bloodCastleTicketSuccessRate: 0.8,
    /** Стоимость синтеза Крыльев Хаоса (Zen) */
    wingsCraftZenCost: 800,
    /** Количество Jewel of Chaos на синтез Крыльев */
    wingsCraftChaosCost: 1,
  },

  /** Заточка вещей камнями (Bless / Soul / Life) */
  itemUpgrades: {
    /** Максимальный уровень заточки (+15) */
    maxItemLevel: 15,
    /** Порог безопасной заточки Jewel of Bless (до +6 = 100%) */
    blessGuaranteedBelowLevel: 6,
    /** Шанс заточки Jewel of Bless до порога */
    blessLowLevelRate: 1.0,
    /** Шанс заточки Jewel of Bless на +6 и выше (72%) */
    blessHighLevelRate: 0.72,
    /** Шанс заточки Jewel of Soul (80%) */
    soulSuccessRate: 0.8,
    /** Уровень, начиная с которого неудачный Soul снижает заточку на -1 */
    soulDowngradeMinLevel: 7,
    /** Шаг усиления Jewel of Life (+4 за камень) */
    lifeOptionStep: 4,
    /** Максимальная доп. опция Jewel of Life (+28) */
    lifeOptionMax: 28,
    /** Множитель цены продажи вещи при успешном Bless/Soul */
    valueMultiplierOnLevelUp: 1.25,
    /** Множитель цены продажи вещи при усилении Jewel of Life */
    valueMultiplierOnLifeUp: 1.2,
  },
} as const;

export type DropRatesConfig = typeof DROP_RATES;
