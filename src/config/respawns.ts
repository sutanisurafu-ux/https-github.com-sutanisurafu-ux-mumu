/**
 * ============================================================================
 * НАСТРОЙКИ РЕСПАУНА МОНСТРОВ, СПОТОВ И BLOOD CASTLE (Respawns & World Config)
 * ============================================================================
 * Каждый юнит на локации имеет индивидуальный таймер респауна по серверному времени:
 *   respawnSec = (baseSec + round(unitHash * randomSpreadSec)) * SERVER_CONFIG.rates.respawnTimeMultiplier
 */

export const WORLD_BOUNDS_CONFIG = {
  /** Половина размера карты территории (мир от -5200 до +5200 по X и Y) */
  arenaHalfSize: 5200,
  /** Отступ спавна монстров от внешнего края карты */
  arenaEdgePadding: 130,
  /** Радиус безопасной зоны города (Safe Zone) */
  townSafeRadius: 560,
  /** Минимальный буфер, на который спавн монстров отодвигается от Safe Zone */
  townSpawnBufferMin: 280,
  /** Целевое расстояние выталкивания от Safe Zone при попадании внутрь буфера */
  townSpawnPushOut: 360,
} as const;

export const MONSTER_RESPAWN_CONFIG = {
  /** Резервный интервал респауна, если сервер не передал индивидуальное время (сек) */
  fallbackIndividualRespawnSec: 14,

  /**
   * Индивидуальное время респауна каждого типа монстра (в секундах):
   * Итоговый таймер конкретного юнита = baseSec .. (baseSec + varianceSec)
   */
  byArchetype: {
    /** Скелеты-воины / ближний бой: 14–22 сек */
    swarmer_skeleton: {
      baseSec: 4,
      varianceSec: 8,
    },
    /** Личи-стрелки / шаманы (обычные): 19–28 сек */
    kiter_lich: {
      baseSec: 9,
      varianceSec: 9,
    },
    /** ВИП дальнебойные мобы на VIP-спотах: 28–38 сек */
    vip_ranged_lich: {
      baseSec: 8,
      varianceSec: 10,
    },
    /** Быки / Големы / Минотавры: 22–32 сек */
    charger_bull: {
      baseSec: 2,
      varianceSec: 10,
    },
    /** Золотые Боссы территорий: раз в 15 минут (900 сек) по серверному времени */
    territory_boss: {
      baseSec: 900,
      varianceSec: 0,
    },
  },

  /**
   * Настройки Золотых Боссов (Golden Invasion):
   * - Появляются 1 раз в 15 минут по серверному времени (:00, :15, :30, :45) на каждой локации
   * - Не более 1 босса на локации за раз; если босс ещё жив при наступлении новой 15-минутки, слот пропускается
   * - Спавнятся случайно на карте ВНЕ зон респа обычных монстров и бродят по карте
   */
  goldenBoss: {
    /** Интервал появления по серверному времени (сек): 900 = 15 минут */
    spawnIntervalSec: 900,
    /** Минимальная дистанция появления от центра любого спота обычных/VIP монстров (px) */
    minDistFromCampPx: 760,
    /** Минимальная дистанция появления от границы безопасной зоны города (px) */
    minDistFromTownEdgePx: 320,
    /** Дистанция шага случайного блуждания Золотого Босса по карте (px) */
    roamMinStepPx: 520,
    roamMaxStepPx: 1450,
  },

  /**
   * Разброс точек появления монстров вокруг центра охотничьего спота (в пикселях):
   * Задаёт более естественное («размазанное») распределение без слипания в одну кучу.
   */
  campSpread: {
    /** Минимальный радиус от центра спота */
    minRadiusPx: 120,
    /** Основной радиус кольца распределения */
    ringSpanPx: 245,
    /** Дополнительный индивидуальный сдвиг радиуса */
    extraJitterPx: 55,
    /** Случайный сдвиг при каждом перерождении обычного монстра вокруг его якоря */
    respawnJitterMinPx: 22,
    respawnJitterSpanPx: 58,
    /** Случайный сдвиг при появлении босса */
    bossJitterMinPx: 40,
    bossJitterSpanPx: 55,
  },

  /**
   * Базовые статы и награды монстров на спотах (до умножения на enemyLevelMultiplier территории)
   */
  unitBaseStats: {
    swarmer_skeleton: {
      hp: 175,
      damage: 30,
      moveSpeed: 122,
      attackRange: 56,
      radius: 20,
      expBase: 68,
      zenBase: 115,
    },
    kiter_lich: {
      hp: 155,
      vipHp: 175,
      damage: 36,
      vipDamage: 39,
      moveSpeed: 108,
      attackRange: 235,
      radius: 21,
      vipRadius: 23,
      expBase: 68,
      vipExpBase: 88,
      zenBase: 115,
      vipZenBase: 150,
    },
    charger_bull: {
      hp: 275,
      damage: 44,
      moveSpeed: 132,
      attackRange: 200,
      radius: 25,
      expBase: 68,
      zenBase: 115,
    },
    territory_boss: {
      hp: 980,
      damage: 56,
      moveSpeed: 106,
      attackRange: 175,
      radius: 36,
      expBase: 320,
      zenBase: 850,
    },
    /** Степень скейлинга EXP от множителя территории */
    territoryExpPower: 0.72,
    /** Степень скейлинга Zen от множителя территории */
    territoryZenPower: 0.58,
  },
} as const;

/**
 * Настройки ивент-зоны Blood Castle (отдельные монстры моста, 5с респаун, лимит 3 минуты)
 */
export const BLOOD_CASTLE_CONFIG = {
  /** Индивидуальный респаун каждого монстра на мосту Blood Castle (сек) */
  respawnDurationSec: 5,
  /** Лимит времени на прохождение Blood Castle (сек) — 180 сек = 3 минуты */
  timeLimitSec: 180,
  /** Количество отдельных слотов монстров на мосту */
  bridgeUnitCount: 36,
  /** Цель 1-го этапа: сколько монстров убить на мосту */
  targetBridgeKills: 100,
  /** Геометрия моста Blood Castle */
  bridgeHalfWidth: 340,
  gateY: -1320,
  statueY: -1920,
  heroStartY: 1920,
  /** Разброс перерождения на мосту вокруг якоря */
  respawnJitterMinPx: 18,
  respawnJitterSpanPx: 38,
  /** Базовые награды и множители монстров Blood Castle */
  enemyMultiplierFactor: 0.65,
  expBase: 95,
  expTerritoryPower: 0.75,
  expPerPlayerLevelBonus: 0.11,
  zenBase: 145,
  zenTerritoryPower: 0.6,
  /** Награды за полное выполнение квеста Архангела в Blood Castle */
  questRewards: {
    jewelOfChaosCount: 3,
    expMultiplierOfNextLevel: 3.5,
    zenBase: 15_000,
    zenPerPlayerLevel: 150,
  },
} as const;

export type MonsterRespawnConfig = typeof MONSTER_RESPAWN_CONFIG;
export type BloodCastleConfig = typeof BLOOD_CASTLE_CONFIG;
