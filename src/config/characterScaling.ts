/**
 * ============================================================================
 * ПРОКАЧКА ПЕРСОНАЖА, ПРИРОСТ ПАРАМЕТРОВ ОТ УРОВНЯ И СТАТОВ (Character Scaling)
 * ============================================================================
 * Все формулы урона, защиты, HP/MP, опыта, профессий, ресетов и скейлинга вещей.
 */

export const CHARACTER_SCALING = {
  /** Стартовые параметры нового персонажа */
  initialPlayer: {
    startLevel: 1,
    startStatPoints: 15,
    startZen: 600,
    startJewels: {
      bless: 2,
      soul: 1,
      life: 1,
      chaos: 0,
    },
    startHpPotions: 3,
    startLargeHpPotions: 0,
    startMpPotions: 3,
    startTerritoryId: 'lorencia' as const,
    startHighestReachedTerritoryIdx: 1,
  },

  /** Параметры банок здоровья и маны */
  potions: {
    /** Обычная банка ОЗ: восстанавливает 250 HP, быстрый откат */
    smallHpHeal: 250,
    /** Большая банка ОЗ: восстанавливает 500 HP, в 10 раз дороже обычной */
    largeHpHeal: 500,
    /** Быстрый откат банок ОЗ (сек) — можно пить чаще */
    hpCooldownSec: 0.45,
    /** Откат банок маны (сек) */
    mpCooldownSec: 1.0,
    /** Цена 1 обычной банки ОЗ (Zen) */
    smallHpUnitPrice: 50,
    /** Цена 1 большой банки ОЗ (в 10 раз дороже обычной = 500 Zen) */
    largeHpUnitPrice: 500,
    /** Цена 1 банки маны (Zen) */
    mpUnitPrice: 40,
  },

  /** Максимальный размер инвентаря (ячеек) */
  maxInventorySlots: 24,
  /** Максимальное число предметов после завершения трейда */
  maxTradeInventoryOverflow: 32,

  /**
   * Кривая требуемого опыта для следующего уровня:
   *   expToNext(level) = round(base + level * linear + level^exponent * powerCoeff)
   */
  expCurve: {
    base: 90,
    linearPerLevel: 45,
    exponent: 1.52,
    powerCoeff: 11,
  },

  /**
   * Максимальное количество уровней, которое можно получить за убийство ОДНОГО монстра:
   *  - 1 (по умолчанию) = нельзя перепрыгнуть более 1 уровня за одного моба (излишек опыта обрезается до 99% нового уровня)
   *  - 0 или null = без ограничений (можно поднять сразу несколько уровней с одного моба)
   *  - N > 1 = максимум N уровней за одного монстра
   */
  maxLevelsPerKill: 1 as number | null,

  /** Сколько свободных очков характеристик даётся за каждый новый уровень по тиру профессии */
  statPointsPerLevelByTier: {
    tier1: 5,
    tier2: 6,
    tier3: 7,
  },

  /**
   * Прирост урона от основных характеристик для каждого класса:
   *   DK  = str * 1.48 + ene * 0.42
   *   DW  = ene * 1.58 + str * 0.30
   *   Elf = agi * 1.48 + str * 0.45
   */
  classPrimaryDamageWeights: {
    dark_knight: { str: 1.48, agi: 0, ene: 0.42 },
    dark_wizard: { str: 0.3, agi: 0, ene: 1.58 },
    fairy_elf: { str: 0.45, agi: 1.48, ene: 0 },
  },

  /** Прирост боевых параметров от уровня и характеристик */
  derivedFormulas: {
    /** Прирост базового урона за каждый уровень персонажа */
    damagePerLevel: 4.5,
    /** Разброс минимального/максимального урона от базового */
    minDamageRatio: 0.85,
    maxDamageRatio: 1.2,
    minDamageFloor: 10,
    minSpreadGap: 5,

    /** Защита (DEF) = (agi * defensePerAgi + level * defensePerLevel + equipDef + resetDef) * mults */
    defensePerAgi: 0.8,
    defensePerLevel: 2.8,

    /** Здоровье (HP) = (hpBase + vit * hpPerVit + level * hpPerLevel + wingsHp + setHp + resetHp) * resetHpMult */
    hpBase: 150,
    hpPerVit: 7.5,
    hpPerLevel: 25,
    wingsFlatHpBonus: 95,
    fullSetFlatHpBonus: 120,

    /** Мана (MP) = mpBase + ene * mpPerEne + level * mpPerLevel + fullSetMpBonus */
    mpBase: 75,
    mpPerEne: 4.8,
    mpPerLevel: 13,
    fullSetFlatMpBonus: 60,

    /** Крит (%) = min(critCap, critBase + agi * critPerAgi + equipCrit + fullSetCritBonus) */
    critBase: 8,
    critPerAgi: 0.35,
    fullSetCritBonus: 12,
    critCap: 80,

    /** Шанс двойного урона (%) */
    doubleDamageBase: 4,
    doubleDamageTwoSetPieces: 10,
    doubleDamageFullSet: 20,

    /** Скорость передвижения = min(moveSpeedCap, moveSpeedBase + agi * moveSpeedPerAgi + equipSpeed) */
    moveSpeedBase: 192,
    moveSpeedPerAgi: 0.72,
    moveSpeedCap: 350,

    /** Веса расчёта боевой мощи (Combat Power / CP) */
    combatPowerWeights: {
      damageSum: 1.45,
      defense: 1.85,
      maxHp: 0.35,
      critChance: 4.5,
      doubleDamageChance: 6,
    },
  },

  /** Множители редкости и бонусы заточки экипировки */
  equipmentScaling: {
    rarityMultiplier: {
      normal: 1.0,
      magic: 1.14,
      excellent: 1.36,
      ancient: 1.58,
    },
    /** Прирост атаки за +1 уровень заточки (+дополнительный бонус начиная с +7) */
    attackPerUpgradeLevel: 5,
    attackExtraPerLevelFrom7: 4,
    /** Прирост защиты за +1 уровень заточки (+дополнительный бонус начиная с +7) */
    defensePerUpgradeLevel: 4,
    defenseExtraPerLevelFrom7: 3,
    /** Коэффициент перевода опции Jewel of Life в защиту (0.75) */
    lifeOptionDefenseRatio: 0.75,
    /** Бонусы комплекта (Set Bonus) */
    twoPieceSetAtkMult: 1.08,
    fullSetPiecesRequired: 3,
    fullSetAtkMult: 1.18,
    fullSetDefMult: 1.15,
  },

  /** Множитель силы персонажа от уровня профессии (Tier 1 / 2 / 3) */
  classTierDamageMultiplier: {
    tier1: 1.0,
    tier2: 1.12,
    tier3: 1.25,
  },

  /** Требования и награды за 1-ю и 2-ю профессии (Жрица Себина) */
  professions: {
    first: {
      requiredLevel: 50,
      zenCost: 3000,
      bonusStatPoints: 40,
      requiresQuestRelic: true,
    },
    second: {
      requiredLevel: 160,
      zenCost: 12_000,
      bonusStatPoints: 70,
      requiresQuestRelic: false,
    },
  },

  /**
   * Гранд Ресет (Grand Reset) — требования и награда за каждый ресет:
   * - Сжигает все вкачанные и нераспределённые очки характеристик до базовых статов класса
   * - Начисляет строго `resets * 350` свободных очков (1 ресет = 350, 2 = 700, 3 = 1050 и т.д.)
   */
  grandReset: {
    requiredLevel: 300,
    bonusStatPoints: 350,
    /** +45% множитель к итоговой атаке и защите за каждый ресет */
    powerMultiplierPerReset: 0.45,
    /** +35% множитель к итоговому HP за каждый ресет */
    hpMultiplierPerReset: 0.35,
    /** Плоские бонусы за каждый ресет до множителей */
    flatAttackPerReset: 1450,
    flatDefensePerReset: 880,
    flatHpPerReset: 7500,
  },

  /** Скейлинг брони монстров по enemyLevelMultiplier территории */
  monsterDefenseScaling: {
    minMultiplierThreshold: 1.05,
    exponent: 0.86,
    coefficient: 16,
  },

  /** Бонус опыта и дележа в кооперативной пати на одной локации */
  partyCoopBonus: {
    /** +20% опыта убийце за каждого союзника в той же локации */
    killerExpBonusPctPerAlly: 20,
    /** Базовая доля опыта союзникам в той же локации (65% + 5% за каждого доп. союзника) */
    allyBaseExpShareRatio: 0.65,
    allyExtraExpSharePerAlly: 0.05,
    /** Доля золота (Zen) союзникам */
    allyZenShareRatio: 0.55,
  },
} as const;

export type CharacterScalingConfig = typeof CHARACTER_SCALING;
