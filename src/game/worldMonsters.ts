import {
  BLOOD_CASTLE_CONFIG,
  MONSTER_RESPAWN_CONFIG,
  SERVER_CONFIG,
  WORLD_BOUNDS_CONFIG,
} from '../config';
import { getCampSpawnSpecs, getTerritoryMapLayout, TERRITORIES } from './rules';
import {
  EnemyArchetype,
  SharedMonsterState,
  TerritoryId,
} from './types';

export const WORLD_ARENA_HALF_SIZE = WORLD_BOUNDS_CONFIG.arenaHalfSize;
export const WORLD_TOWN_SAFE_RADIUS = WORLD_BOUNDS_CONFIG.townSafeRadius;
export const GOLDEN_BOSS_INTERVAL_SEC: number = MONSTER_RESPAWN_CONFIG.goldenBoss.spawnIntervalSec;
export const BOSS_RESPAWN_DURATION_SEC = GOLDEN_BOSS_INTERVAL_SEC;

/**
 * Returns the 15-minute (900s) Server-Time slot index for Golden Boss invasions (:00, :15, :30, :45).
 */
export function getGoldenBossSlotIndex(
  nowGameSec: number,
  intervalSec = GOLDEN_BOSS_INTERVAL_SEC
): number {
  return Math.floor(Math.max(0, nowGameSec) / Math.max(1, intervalSec));
}

/**
 * Returns the exact Server Game Time (seconds) of the next 15-minute Golden Boss boundary.
 */
export function getNextGoldenBossSpawnSec(
  nowGameSec: number,
  intervalSec = GOLDEN_BOSS_INTERVAL_SEC
): number {
  const safeInterval = Math.max(1, intervalSec);
  return (getGoldenBossSlotIndex(nowGameSec, safeInterval) + 1) * safeInterval;
}

/**
 * Picks a random spawn coordinate on the territory map that is STRICTLY:
 *  1) Outside the City Safe Zone + safety buffer
 *  2) Outside every regular & VIP monster camp spawn zone (minDistFromCampPx)
 *  3) Safely inside arena borders
 */
export function pickGoldenBossRandomSpawnPoint(
  territoryId: TerritoryId,
  randFn: () => number = Math.random
): { x: number; y: number } {
  const layout = getTerritoryMapLayout(territoryId);
  const cfg = MONSTER_RESPAWN_CONFIG.goldenBoss;
  const minTownDist = WORLD_TOWN_SAFE_RADIUS + cfg.minDistFromTownEdgePx;
  const minCampDist = cfg.minDistFromCampPx;
  const bound = WORLD_ARENA_HALF_SIZE - 420;

  const isValid = (x: number, y: number): boolean => {
    if (Math.hypot(x, y) < minTownDist) return false;
    for (const camp of layout.camps) {
      if (Math.hypot(x - camp.x, y - camp.y) < minCampDist) return false;
    }
    return true;
  };

  for (let attempt = 0; attempt < 96; attempt++) {
    const x = Math.round((randFn() * 2 - 1) * bound);
    const y = Math.round((randFn() * 2 - 1) * bound);
    if (isValid(x, y)) {
      return { x, y };
    }
  }

  // Deterministic grid scan fallback so a valid point outside all camps is always guaranteed
  for (let gx = -bound + 300; gx <= bound - 300; gx += 480) {
    for (let gy = -bound + 300; gy <= bound - 300; gy += 480) {
      if (isValid(gx, gy)) {
        return { x: Math.round(gx), y: Math.round(gy) };
      }
    }
  }

  return { x: 1450, y: -1450 };
}

/**
 * Picks a random roaming waypoint across the wilderness (avoiding the Safe Town center)
 * so Golden Bosses actively wander around the entire map.
 */
export function pickGoldenBossRoamWaypoint(
  currentX: number,
  currentY: number,
  randFn: () => number = Math.random
): { x: number; y: number } {
  const cfg = MONSTER_RESPAWN_CONFIG.goldenBoss;
  const minTownDist = WORLD_TOWN_SAFE_RADIUS + 260;
  const bound = WORLD_ARENA_HALF_SIZE - 360;

  for (let i = 0; i < 24; i++) {
    const angle = randFn() * Math.PI * 2;
    const step = cfg.roamMinStepPx + randFn() * (cfg.roamMaxStepPx - cfg.roamMinStepPx);
    const nx = Math.max(-bound, Math.min(bound, Math.round(currentX + Math.cos(angle) * step)));
    const ny = Math.max(-bound, Math.min(bound, Math.round(currentY + Math.sin(angle) * step)));
    if (Math.hypot(nx, ny) >= minTownDist) {
      return { x: nx, y: ny };
    }
  }

  return { x: Math.round(Math.max(-bound, Math.min(bound, currentX + 700))), y: -1550 };
}

export interface ServerMonsterUnit {
  id: string; // Permanent deterministic slotId (e.g. lorencia_c0_u0 or boss_lorencia)
  territoryId: TerritoryId;
  campIdx: number;
  unitIdx: number;
  name: string;
  archetype: EnemyArchetype;
  isBoss: boolean;
  isStructure: boolean;
  isQuestMonster: boolean;
  isVipRanged: boolean;
  campX: number;
  campY: number;
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  attackDamage: number;
  moveSpeed: number;
  attackRange: number;
  expReward: number;
  zenReward: number;
  color: string;
  respawnDurationSec: number;
  alive: boolean;
  respawnAtGameTimeSec: number; // 0 when alive
  aiState: 'move' | 'windup' | 'active' | 'recover' | 'ko';
  stateTimer: number;
  telegraphX: number;
  telegraphY: number;
  facingAngle: number;
  walkDistance: number;
  chillTimer: number;
  orbitDirection: 1 | -1;
  roamTargetX?: number;
  roamTargetY?: number;
}

export interface ServerSimPlayerTarget {
  id: string;
  x: number;
  y: number;
  hp: number;
}

export interface ServerMonsterAttackEvent {
  territoryId: TerritoryId;
  enemyId: string;
  monsterName: string;
  archetype: EnemyArchetype;
  isBoss: boolean;
  hitCenterX: number;
  hitCenterY: number;
  hitRadius: number;
  attackDamage: number;
  timestamp: number;
}

/**
 * Simple deterministic PRNG hash from a string seed -> [0, 1).
 */
export function deterministicUnitHash(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 100000) / 100000;
}

/**
 * Clamps a spawn coordinate inside the arena bounds and safely outside the City Safe Zone.
 */
export function clampSafeMonsterSpawn(
  x: number,
  y: number,
  fallbackAngle = 0
): { x: number; y: number } {
  let sx = Math.max(
    -WORLD_ARENA_HALF_SIZE + WORLD_BOUNDS_CONFIG.arenaEdgePadding,
    Math.min(WORLD_ARENA_HALF_SIZE - WORLD_BOUNDS_CONFIG.arenaEdgePadding, x)
  );
  let sy = Math.max(
    -WORLD_ARENA_HALF_SIZE + WORLD_BOUNDS_CONFIG.arenaEdgePadding,
    Math.min(WORLD_ARENA_HALF_SIZE - WORLD_BOUNDS_CONFIG.arenaEdgePadding, y)
  );

  const distFromTown = Math.hypot(sx, sy);
  if (distFromTown < WORLD_TOWN_SAFE_RADIUS + WORLD_BOUNDS_CONFIG.townSpawnBufferMin) {
    const pushAngle = distFromTown > 1 ? Math.atan2(sy, sx) : fallbackAngle;
    const safeDist = WORLD_TOWN_SAFE_RADIUS + WORLD_BOUNDS_CONFIG.townSpawnPushOut;
    sx = Math.cos(pushAngle) * safeDist;
    sy = Math.sin(pushAngle) * safeDist;
  }

  return { x: Math.round(sx), y: Math.round(sy) };
}

/**
 * Computes a slightly randomized spawn point around a unit's personal anchor point
 * so respawns feel organic while staying slightly spread out across the spot.
 */
export function pickSpreadRespawnPoint(
  anchorX: number,
  anchorY: number,
  isBoss = false,
  randA = Math.random(),
  randB = Math.random()
): { x: number; y: number } {
  const angle = randA * Math.PI * 2;
  const { campSpread } = MONSTER_RESPAWN_CONFIG;
  const jitterRadius = isBoss
    ? campSpread.bossJitterMinPx + randB * campSpread.bossJitterSpanPx
    : campSpread.respawnJitterMinPx + randB * campSpread.respawnJitterSpanPx;
  return clampSafeMonsterSpawn(
    anchorX + Math.cos(angle) * jitterRadius,
    anchorY + Math.sin(angle) * jitterRadius,
    angle
  );
}

export interface TerritoryMonsterSpec {
  name: string;
  archetype: EnemyArchetype;
  color: string;
  isQuestMonster: boolean;
}

/**
 * 100% unique monster roster per territory across all 24 maps (72 distinct regular monster species).
 * No monster name repeats from map to map!
 * Tuple layout per territory: [0] Agile/Vanguard mob, [1] Ranged/Caster mob (also used for VIP +2 ranged spots), [2] Heavy/Elite bruiser mob.
 */
export const TERRITORY_MONSTER_ROSTERS: Record<
  TerritoryId,
  [TerritoryMonsterSpec, TerritoryMonsterSpec, TerritoryMonsterSpec]
> = {
  lorencia: [
    { name: 'Скелет-Воин Лоренсии', archetype: 'swarmer_skeleton', color: '#e7e5e4', isQuestMonster: false },
    { name: 'Лич-Стрелок Лоренсии', archetype: 'kiter_lich', color: '#c084fc', isQuestMonster: true },
    { name: 'Свирепый Бык Лоренсии', archetype: 'charger_bull', color: '#ea580c', isQuestMonster: true },
  ],
  noria: [
    { name: 'Гоблин-Следопыт Нории', archetype: 'swarmer_skeleton', color: '#86efac', isQuestMonster: false },
    { name: 'Лесная Ведьма Нории', archetype: 'kiter_lich', color: '#34d399', isQuestMonster: true },
    { name: 'Каменный Голем Нории', archetype: 'charger_bull', color: '#65a30d', isQuestMonster: true },
  ],
  elbeland: [
    { name: 'Проклятый Охотник Эльбеланда', archetype: 'swarmer_skeleton', color: '#d8b4fe', isQuestMonster: false },
    { name: 'Тёмный Шаман Эльбеланда', archetype: 'kiter_lich', color: '#a855f7', isQuestMonster: true },
    { name: 'Гризли-Тотем Эльбеланда', archetype: 'charger_bull', color: '#7c3aed', isQuestMonster: true },
  ],
  devias: [
    { name: 'Снежный Йети Девиаса', archetype: 'swarmer_skeleton', color: '#bae6fd', isQuestMonster: false },
    { name: 'Ледяной Маг Девиаса', archetype: 'kiter_lich', color: '#38bdf8', isQuestMonster: true },
    { name: 'Ледяной Рыцарь Девиаса', archetype: 'charger_bull', color: '#0284c7', isQuestMonster: true },
  ],
  dungeon: [
    { name: 'Призрак Склепа Подземелья', archetype: 'swarmer_skeleton', color: '#cbd5e1', isQuestMonster: false },
    { name: 'Тёмный Отравитель Подземелья', archetype: 'kiter_lich', color: '#f43f5e', isQuestMonster: true },
    { name: 'Адская Гончая Подземелья', archetype: 'charger_bull', color: '#dc2626', isQuestMonster: true },
  ],
  atlans: [
    { name: 'Бахамут Глубин Атланса', archetype: 'swarmer_skeleton', color: '#67e8f9', isQuestMonster: false },
    { name: 'Сирена Кораллов Атланса', archetype: 'kiter_lich', color: '#06b6d4', isQuestMonster: true },
    { name: 'Страж Глубин Атланса', archetype: 'orbiter_gorgon', color: '#0ea5e9', isQuestMonster: true },
  ],
  lost_tower: [
    { name: 'Тень Проклятой Башни', archetype: 'swarmer_skeleton', color: '#fdba74', isQuestMonster: false },
    { name: 'Проклятый Волшебник Башни', archetype: 'kiter_lich', color: '#f97316', isQuestMonster: true },
    { name: 'Рыцарь Смерти Башни', archetype: 'charger_bull', color: '#b91c1c', isQuestMonster: true },
  ],
  tarkan: [
    { name: 'Пустынный Мутант Таркана', archetype: 'swarmer_skeleton', color: '#fde68a', isQuestMonster: false },
    { name: 'Железное Колесо Таркана', archetype: 'kiter_lich', color: '#f59e0b', isQuestMonster: true },
    { name: 'Кровавый Волк Таркана', archetype: 'charger_bull', color: '#d97706', isQuestMonster: true },
  ],
  icarus: [
    { name: 'Алквим Облаков Икаруса', archetype: 'orbiter_gorgon', color: '#7dd3fc', isQuestMonster: false },
    { name: 'Фантомный Чародей Икаруса', archetype: 'kiter_lich', color: '#60a5fa', isQuestMonster: true },
    { name: 'Мега-Краст Икаруса', archetype: 'charger_bull', color: '#3b82f6', isQuestMonster: true },
  ],
  kalima: [
    { name: 'Аэгис Храма Калимы', archetype: 'swarmer_skeleton', color: '#5eead4', isQuestMonster: false },
    { name: 'Некромант Бездны Калимы', archetype: 'kiter_lich', color: '#14b8a6', isQuestMonster: true },
    { name: 'Шрикер-Палач Калимы', archetype: 'orbiter_gorgon', color: '#0d9488', isQuestMonster: true },
  ],
  valley_of_loren: [
    { name: 'Осадный Копейщик Лорен', archetype: 'swarmer_skeleton', color: '#fef08a', isQuestMonster: false },
    { name: 'Боевой Чародей Лорен', archetype: 'kiter_lich', color: '#eab308', isQuestMonster: true },
    { name: 'Железный Центурион Лорен', archetype: 'charger_bull', color: '#ca8a04', isQuestMonster: true },
  ],
  crywolf: [
    { name: 'Тёмный Пехотинец Крайвульфа', archetype: 'swarmer_skeleton', color: '#c7d2fe', isQuestMonster: false },
    { name: 'Колдун Балгасса Крайвульфа', archetype: 'kiter_lich', color: '#818cf8', isQuestMonster: true },
    { name: 'Молот-Берсерк Крайвульфа', archetype: 'charger_bull', color: '#4f46e5', isQuestMonster: true },
  ],
  aida: [
    { name: 'Ведьма Рощи Аиды', archetype: 'orbiter_gorgon', color: '#bef264', isQuestMonster: false },
    { name: 'Кровавый Всадник Аиды', archetype: 'kiter_lich', color: '#84cc16', isQuestMonster: true },
    { name: 'Синий Голем Аиды', archetype: 'charger_bull', color: '#4d7c0f', isQuestMonster: true },
  ],
  kanturu_ruins: [
    { name: 'Осколок-Разведчик Кантуру', archetype: 'swarmer_skeleton', color: '#fcd34d', isQuestMonster: false },
    { name: 'Кибер-Стрелок Кантуру', archetype: 'kiter_lich', color: '#f59e0b', isQuestMonster: true },
    { name: 'Берсерк-Автоматон Кантуру', archetype: 'orbiter_gorgon', color: '#b45309', isQuestMonster: true },
  ],
  kanturu_relics: [
    { name: 'Персона-Фантом Святилища', archetype: 'orbiter_gorgon', color: '#e9d5ff', isQuestMonster: false },
    { name: 'Твин-Тейл Святилища', archetype: 'kiter_lich', color: '#a855f7', isQuestMonster: true },
    { name: 'Дредфир Святилища', archetype: 'charger_bull', color: '#7e22ce', isQuestMonster: true },
  ],
  barrack_of_balgass: [
    { name: 'Солдат-Ветеран Казарм', archetype: 'swarmer_skeleton', color: '#fca5a5', isQuestMonster: false },
    { name: 'Тёмный Заклинатель Казарм', archetype: 'kiter_lich', color: '#f87171', isQuestMonster: true },
    { name: 'Генерал-Каратель Казарм', archetype: 'charger_bull', color: '#991b1b', isQuestMonster: true },
  ],
  karutan: [
    { name: 'Ядовитый Скорпион Карутана', archetype: 'swarmer_skeleton', color: '#fde047', isQuestMonster: false },
    { name: 'Крик-Охотник Карутана', archetype: 'kiter_lich', color: '#a3e635', isQuestMonster: true },
    { name: 'Голлох-Разрушитель Карутана', archetype: 'charger_bull', color: '#65a30d', isQuestMonster: true },
  ],
  raklion: [
    { name: 'Ледяной Мамонт Раклиона', archetype: 'charger_bull', color: '#93c5fd', isQuestMonster: false },
    { name: 'Култин-Колдун Раклиона', archetype: 'kiter_lich', color: '#38bdf8', isQuestMonster: true },
    { name: 'Хрустальный Страж Раклиона', archetype: 'orbiter_gorgon', color: '#0369a1', isQuestMonster: true },
  ],
  swamp_of_calmness: [
    { name: 'Сапи-Твин Болота', archetype: 'swarmer_skeleton', color: '#6ee7b7', isQuestMonster: false },
    { name: 'Тень Смерти Болота', archetype: 'kiter_lich', color: '#10b981', isQuestMonster: true },
    { name: 'Грозовой Напалм Болота', archetype: 'orbiter_gorgon', color: '#047857', isQuestMonster: true },
  ],
  vulcanus: [
    { name: 'Лавовый Зомби Вулкануса', archetype: 'swarmer_skeleton', color: '#fb923c', isQuestMonster: false },
    { name: 'Пламенный Эшкроу Вулкануса', archetype: 'kiter_lich', color: '#ef4444', isQuestMonster: true },
    { name: 'Пепельный Гладиатор Вулкануса', archetype: 'charger_bull', color: '#9a3412', isQuestMonster: true },
  ],
  acheron: [
    { name: 'Номад Ветров Ахерона', archetype: 'orbiter_gorgon', color: '#f0abfc', isQuestMonster: false },
    { name: 'Жрец Пентаграмм Ахерона', archetype: 'kiter_lich', color: '#d946ef', isQuestMonster: true },
    { name: 'Титан Элементов Ахерона', archetype: 'charger_bull', color: '#a21caf', isQuestMonster: true },
  ],
  ferea: [
    { name: 'Кристальный Рыцарь Фереи', archetype: 'swarmer_skeleton', color: '#fbcfe8', isQuestMonster: false },
    { name: 'Лучник Фереи', archetype: 'kiter_lich', color: '#f472b6', isQuestMonster: true },
    { name: 'Копейщик-Страж Фереи', archetype: 'orbiter_gorgon', color: '#db2777', isQuestMonster: true },
  ],
  nixies_lake: [
    { name: 'Морозный Дух Никси', archetype: 'orbiter_gorgon', color: '#bfdbfe', isQuestMonster: false },
    { name: 'Оракул Глубин Никси', archetype: 'kiter_lich', color: '#60a5fa', isQuestMonster: true },
    { name: 'Ледовый Страж Никси', archetype: 'charger_bull', color: '#1d4ed8', isQuestMonster: true },
  ],
  blood_castle: [
    { name: 'Гвардеец Кундуна', archetype: 'swarmer_skeleton', color: '#fda4af', isQuestMonster: false },
    { name: 'Архимаг Трона Кундуна', archetype: 'kiter_lich', color: '#fb7185', isQuestMonster: true },
    { name: 'Демон-Инквизитор Кундуна', archetype: 'orbiter_gorgon', color: '#be123c', isQuestMonster: true },
  ],
};

/**
 * Deterministically builds every individual monster unit slot for a territory:
 * - Each territory has its own 100% unique 3-species monster roster (zero repeats across all 24 maps!)
 * - Each unit has a permanent `id` (slotId)
 * - Each unit has slightly more spread-out spawn coordinates around its hunting camp (120..410px golden-angle distribution)
 * - Each unit has its own individual `respawnDurationSec` (14–38s depending on role + deterministic per-unit offset)
 */
export function buildTerritoryUnitBlueprints(territoryId: TerritoryId): ServerMonsterUnit[] {
  const territoryIdx = Math.max(
    0,
    TERRITORIES.findIndex((t) => t.id === territoryId)
  );
  const territory = TERRITORIES[territoryIdx] ?? TERRITORIES[0];
  const roster = TERRITORY_MONSTER_ROSTERS[territory.id] ?? TERRITORY_MONSTER_ROSTERS.lorencia;
  const layout = getTerritoryMapLayout(territory.id);
  const mult = territory.enemyLevelMultiplier;
  const baseStats = MONSTER_RESPAWN_CONFIG.unitBaseStats;
  const xpMult =
    Math.pow(territory.enemyLevelMultiplier, baseStats.territoryExpPower) *
    SERVER_CONFIG.rates.expMultiplier;
  const zenMult =
    Math.pow(territory.enemyLevelMultiplier, baseStats.territoryZenPower) *
    SERVER_CONFIG.rates.zenMultiplier;
  const respawnRate = SERVER_CONFIG.rates.respawnTimeMultiplier;
  const { byArchetype, campSpread } = MONSTER_RESPAWN_CONFIG;

  const units: ServerMonsterUnit[] = [];
  const GOLDEN_ANGLE = 2.399963229728653;

  for (let campIdx = 0; campIdx < layout.camps.length; campIdx++) {
    const camp = layout.camps[campIdx];
    const specs = getCampSpawnSpecs(camp);

    for (let unitIdx = 0; unitIdx < specs.forceRangedFlags.length; unitIdx++) {
      const forceRanged = specs.forceRangedFlags[unitIdx];
      const slotId = `${territory.id}_c${campIdx}_u${unitIdx}`;

      const hRole = deterministicUnitHash(`${slotId}:role`);
      const hPos = deterministicUnitHash(`${slotId}:pos`);
      const hAngle = deterministicUnitHash(`${slotId}:ang`);
      const hRespawn = deterministicUnitHash(`${slotId}:respawn`);
      const hOrbit = deterministicUnitHash(`${slotId}:orbit`);

      // Slightly spread out around the camp using golden-angle spacing
      // so individual mobs occupy distinct breathing room instead of tightly clumping.
      const baseAngle =
        campIdx * 0.85 + unitIdx * GOLDEN_ANGLE + (hAngle - 0.5) * 0.52;
      const normalizedRing = (unitIdx + 0.5) / Math.max(1, specs.totalCount);
      const spreadRadius =
        campSpread.minRadiusPx +
        Math.sqrt(normalizedRing) * campSpread.ringSpanPx +
        hPos * campSpread.extraJitterPx;

      const anchor = clampSafeMonsterSpawn(
        camp.x + Math.cos(baseAngle) * spreadRadius,
        camp.y + Math.sin(baseAngle) * spreadRadius,
        baseAngle
      );

      // Select one of this territory's 3 unique species (VIP forced ranged always picks slot [1])
      const species = forceRanged
        ? roster[1]
        : hRole < 0.4
          ? roster[0]
          : hRole < 0.72
            ? roster[1]
            : roster[2];

      const archetype: EnemyArchetype = forceRanged ? 'kiter_lich' : species.archetype;
      const name = forceRanged ? `👑 ВИП ${species.name} (Дальний)` : species.name;
      const isQuestMonster = forceRanged ? true : species.isQuestMonster;
      const color = forceRanged ? '#fde047' : species.color;

      let hp = Math.round(baseStats.swarmer_skeleton.hp * mult);
      let dmg = Math.round(baseStats.swarmer_skeleton.damage * mult);
      let spd: number = baseStats.swarmer_skeleton.moveSpeed;
      let rng: number = baseStats.swarmer_skeleton.attackRange;
      let radius: number = baseStats.swarmer_skeleton.radius;
      let respawnCfg: { readonly baseSec: number; readonly varianceSec: number } =
        byArchetype.swarmer_skeleton;

      if (archetype === 'kiter_lich') {
        hp = Math.round(
          (forceRanged ? baseStats.kiter_lich.vipHp : baseStats.kiter_lich.hp) * mult
        );
        dmg = Math.round(
          (forceRanged ? baseStats.kiter_lich.vipDamage : baseStats.kiter_lich.damage) * mult
        );
        spd = baseStats.kiter_lich.moveSpeed;
        rng = baseStats.kiter_lich.attackRange;
        radius = forceRanged ? baseStats.kiter_lich.vipRadius : baseStats.kiter_lich.radius;
        respawnCfg = forceRanged ? byArchetype.vip_ranged_lich : byArchetype.kiter_lich;
      } else if (archetype === 'charger_bull') {
        hp = Math.round(baseStats.charger_bull.hp * mult);
        dmg = Math.round(baseStats.charger_bull.damage * mult);
        spd = baseStats.charger_bull.moveSpeed;
        rng = baseStats.charger_bull.attackRange;
        radius = baseStats.charger_bull.radius;
        respawnCfg = byArchetype.charger_bull;
      } else if (archetype === 'orbiter_gorgon') {
        hp = Math.round(baseStats.charger_bull.hp * 0.92 * mult);
        dmg = Math.round(baseStats.charger_bull.damage * 0.96 * mult);
        spd = Math.round((baseStats.swarmer_skeleton.moveSpeed + baseStats.charger_bull.moveSpeed) * 0.5);
        rng = 170;
        radius = 22;
        respawnCfg = byArchetype.charger_bull;
      }

      const respawnDurationSec = Math.max(
        1,
        Math.round(
          (respawnCfg.baseSec + Math.round(hRespawn * respawnCfg.varianceSec)) * respawnRate
        )
      );

      units.push({
        id: slotId,
        territoryId: territory.id,
        campIdx,
        unitIdx,
        name,
        archetype,
        isBoss: false,
        isStructure: false,
        isQuestMonster,
        isVipRanged: forceRanged,
        campX: camp.x,
        campY: camp.y,
        anchorX: anchor.x,
        anchorY: anchor.y,
        x: anchor.x,
        y: anchor.y,
        radius,
        hp,
        maxHp: hp,
        attackDamage: dmg,
        moveSpeed: spd,
        attackRange: rng,
        expReward: Math.round(
          (forceRanged ? baseStats.kiter_lich.vipExpBase : baseStats.swarmer_skeleton.expBase) *
            xpMult
        ),
        zenReward: Math.round(
          (forceRanged ? baseStats.kiter_lich.vipZenBase : baseStats.swarmer_skeleton.zenBase) *
            zenMult
        ),
        color,
        respawnDurationSec,
        alive: true,
        respawnAtGameTimeSec: 0,
        aiState: 'move',
        stateTimer: 0.4 + hRole * 0.6,
        telegraphX: anchor.x,
        telegraphY: anchor.y,
        facingAngle: 0,
        walkDistance: 0,
        chillTimer: 0,
        orbitDirection: hOrbit >= 0.5 ? 1 : -1,
      });
    }
  }

  return units;
}

/**
 * Builds the authoritative Golden Territory Boss unit (`boss_<territoryId>`) with golden color
 * and a random spawn location strictly outside regular monster camps.
 */
export function createTerritoryBossUnit(
  territoryId: TerritoryId,
  randFn: () => number = Math.random
): ServerMonsterUnit {
  const territoryIdx = Math.max(
    0,
    TERRITORIES.findIndex((t) => t.id === territoryId)
  );
  const territory = TERRITORIES[territoryIdx] ?? TERRITORIES[0];
  const baseStats = MONSTER_RESPAWN_CONFIG.unitBaseStats;
  const bossStats = baseStats.territory_boss;
  const mult = territory.enemyLevelMultiplier;
  const xpMult =
    Math.pow(territory.enemyLevelMultiplier, baseStats.territoryExpPower) *
    SERVER_CONFIG.rates.expMultiplier;
  const zenMult =
    Math.pow(territory.enemyLevelMultiplier, baseStats.territoryZenPower) *
    SERVER_CONFIG.rates.zenMultiplier;

  const spawn = pickGoldenBossRandomSpawnPoint(territory.id, randFn);
  const maxHp = Math.round(bossStats.hp * mult);

  return {
    id: `boss_${territory.id}`,
    territoryId: territory.id,
    campIdx: -1,
    unitIdx: 99,
    name: `👑 Золотой ${territory.bossName}`,
    archetype: 'orbiter_gorgon',
    isBoss: true,
    isStructure: false,
    isQuestMonster: true,
    isVipRanged: false,
    campX: spawn.x,
    campY: spawn.y,
    anchorX: spawn.x,
    anchorY: spawn.y,
    x: spawn.x,
    y: spawn.y,
    radius: bossStats.radius,
    hp: maxHp,
    maxHp,
    attackDamage: Math.round(bossStats.damage * mult),
    moveSpeed: bossStats.moveSpeed,
    attackRange: bossStats.attackRange,
    expReward: Math.round(bossStats.expBase * xpMult),
    zenReward: Math.round(bossStats.zenBase * zenMult),
    color: '#fbbf24',
    respawnDurationSec: GOLDEN_BOSS_INTERVAL_SEC,
    alive: true,
    respawnAtGameTimeSec: 0,
    aiState: 'move',
    stateTimer: 0.8,
    telegraphX: spawn.x,
    telegraphY: spawn.y,
    facingAngle: 0,
    walkDistance: 0,
    chillTimer: 0,
    orbitDirection: 1,
    roamTargetX: pickGoldenBossRoamWaypoint(spawn.x, spawn.y, randFn).x,
    roamTargetY: pickGoldenBossRoamWaypoint(spawn.x, spawn.y, randFn).y,
  };
}

/**
 * Evaluates the 15-minute Server-Time Golden Boss invasion schedule for a territory:
 * - At most ONE Golden Boss can exist per territory at any time.
 * - If a Golden Boss is STILL ALIVE when a new 15-minute slot begins, NO second boss spawns
 *   and the slot is consumed (`nextProcessedSlot = currentSlot`), so killing the living boss
 *   will NOT spawn an extra boss inside the same 15-minute window!
 * - If no boss is alive and a new 15-minute slot has been reached (and not already cleared in this slot),
 *   spawns a fresh Golden Boss at a random wilderness position outside all regular monster camps.
 */
export function evaluateGoldenBoss15MinSpawn(
  zoneMap: Map<string, ServerMonsterUnit>,
  territoryId: TerritoryId,
  nowGameSec: number,
  lastProcessedSlot: number,
  randFn: () => number = Math.random,
  intervalSec = GOLDEN_BOSS_INTERVAL_SEC
): {
  spawnedBoss: ServerMonsterUnit | null;
  nextProcessedSlot: number;
  skippedBecauseAlive: boolean;
} {
  const currentSlot = getGoldenBossSlotIndex(nowGameSec, intervalSec);
  const bossId = `boss_${territoryId}`;
  const existingBoss = zoneMap.get(bossId);

  // Rule 1: Never allow >1 boss on a territory; if boss is still alive when 15-min cooldown passes,
  // consume/skip this 15-minute slot so no new boss spawns in this window.
  if (existingBoss && existingBoss.alive && existingBoss.hp > 0) {
    const skipped = currentSlot > lastProcessedSlot;
    return {
      spawnedBoss: null,
      nextProcessedSlot: Math.max(lastProcessedSlot, currentSlot),
      skippedBecauseAlive: skipped,
    };
  }

  // Respect pending respawn timestamp (e.g., boss was already slain during the current 15-minute window)
  if (existingBoss && existingBoss.respawnAtGameTimeSec > nowGameSec) {
    return {
      spawnedBoss: null,
      nextProcessedSlot: Math.max(lastProcessedSlot, currentSlot),
      skippedBecauseAlive: false,
    };
  }

  // Rule 2: Spawn 1 Golden Boss when a new 15-minute server slot arrives
  if (currentSlot > lastProcessedSlot) {
    const bossUnit = createTerritoryBossUnit(territoryId, randFn);
    zoneMap.set(bossUnit.id, bossUnit);
    return {
      spawnedBoss: bossUnit,
      nextProcessedSlot: currentSlot,
      skippedBecauseAlive: false,
    };
  }

  return {
    spawnedBoss: null,
    nextProcessedSlot: lastProcessedSlot,
    skippedBecauseAlive: false,
  };
}

/**
 * Initializes a territory's authoritative server monster map, honoring any still-pending
 * individual respawn timestamps from continuous Server Game Time.
 */
export function createInitialZoneMonsterMap(
  territoryId: TerritoryId,
  nowGameSec: number,
  deadRespawns?: Record<string, number>
): Map<string, ServerMonsterUnit> {
  const map = new Map<string, ServerMonsterUnit>();
  const blueprints = buildTerritoryUnitBlueprints(territoryId);
  for (const unit of blueprints) {
    const pendingRespawn = deadRespawns?.[unit.id];
    if (pendingRespawn && pendingRespawn > nowGameSec) {
      unit.alive = false;
      unit.hp = 0;
      unit.aiState = 'ko';
      unit.respawnAtGameTimeSec = pendingRespawn;
    } else {
      const pos = pickSpreadRespawnPoint(unit.anchorX, unit.anchorY, false);
      unit.x = pos.x;
      unit.y = pos.y;
      unit.telegraphX = pos.x;
      unit.telegraphY = pos.y;
    }
    map.set(unit.id, unit);
  }
  return map;
}

/**
 * Server-authoritative HP deduction for a single monster unit.
 * When HP reaches 0, stamps that unit's personal `respawnAtGameTimeSec` on Server Game Time.
 */
export function applyServerMonsterDamage(
  zoneMap: Map<string, ServerMonsterUnit>,
  enemyId: string,
  damage: number,
  nowGameSec: number,
  applyChill = false
): {
  found: boolean;
  alreadyDead: boolean;
  killed: boolean;
  unit?: ServerMonsterUnit;
  appliedDamage: number;
  respawnAtGameTimeSec: number;
} {
  const unit = zoneMap.get(enemyId);
  if (!unit) {
    return {
      found: false,
      alreadyDead: false,
      killed: false,
      appliedDamage: 0,
      respawnAtGameTimeSec: 0,
    };
  }
  if (!unit.alive || unit.hp <= 0) {
    return {
      found: true,
      alreadyDead: true,
      killed: false,
      unit,
      appliedDamage: 0,
      respawnAtGameTimeSec: unit.respawnAtGameTimeSec,
    };
  }

  const safeDamage = Math.max(1, Math.min(unit.maxHp, Math.round(damage)));
  unit.hp = Math.max(0, unit.hp - safeDamage);
  if (applyChill && !unit.isStructure) {
    unit.chillTimer = 3.0;
  }

  if (unit.hp <= 0) {
    unit.alive = false;
    unit.aiState = 'ko';
    // Golden Bosses respawn on the next 15-minute Server-Time boundary (:00, :15, :30, :45);
    // regular monsters use their individual per-unit respawn timer.
    unit.respawnAtGameTimeSec = unit.isBoss
      ? getNextGoldenBossSpawnSec(nowGameSec)
      : Math.round((nowGameSec + unit.respawnDurationSec) * 100) / 100;
    return {
      found: true,
      alreadyDead: false,
      killed: true,
      unit,
      appliedDamage: safeDamage,
      respawnAtGameTimeSec: unit.respawnAtGameTimeSec,
    };
  }

  return {
    found: true,
    alreadyDead: false,
    killed: false,
    unit,
    appliedDamage: safeDamage,
    respawnAtGameTimeSec: 0,
  };
}

/**
 * Checks all dead units in a territory against continuous Server Game Time and revives
 * ONLY those individual units whose own `respawnAtGameTimeSec <= nowGameSec`.
 */
export function reviveDueServerMonsters(
  zoneMap: Map<string, ServerMonsterUnit>,
  nowGameSec: number,
  randFn: () => number = Math.random
): ServerMonsterUnit[] {
  const revived: ServerMonsterUnit[] = [];
  for (const unit of zoneMap.values()) {
    if (unit.alive) continue;
    // Territory bosses stay dead once defeated until re-triggered (or if their cooldown passed and they are regular slots)
    if (unit.isBoss) continue;
    if (unit.respawnAtGameTimeSec > 0 && nowGameSec >= unit.respawnAtGameTimeSec) {
      const nextPos = pickSpreadRespawnPoint(
        unit.anchorX,
        unit.anchorY,
        false,
        randFn(),
        randFn()
      );
      unit.alive = true;
      unit.hp = unit.maxHp;
      unit.aiState = 'move';
      unit.stateTimer = 0.6;
      unit.chillTimer = 0;
      unit.respawnAtGameTimeSec = 0;
      unit.x = nextPos.x;
      unit.y = nextPos.y;
      unit.telegraphX = nextPos.x;
      unit.telegraphY = nextPos.y;
      revived.push(unit);
    }
  }
  return revived;
}

const SERVER_MAX_CONCURRENT_ATTACKERS = 5;
const SERVER_MONSTER_AGGRO_RANGE = 340;
const SERVER_BOSS_AGGRO_RANGE = 620;

/**
 * Pure, server-authoritative monster simulation step for a territory.
 * Monsters exist, patrol, roam (Golden Bosses), aggro, chase, telegraph, and attack
 * strictly relative to SERVER time — independent of any player tab being minimized or paused!
 */
export function stepServerZoneMonsters(
  zoneMap: Map<string, ServerMonsterUnit>,
  territoryId: TerritoryId,
  playersInZone: ServerSimPlayerTarget[],
  dtSec: number,
  nowMs: number,
  randFn: () => number = Math.random
): ServerMonsterAttackEvent[] {
  const dt = Math.max(0, Math.min(0.25, dtSec));
  if (dt <= 0) return [];

  const attacks: ServerMonsterAttackEvent[] = [];
  const arenaLimit = WORLD_ARENA_HALF_SIZE - 50;
  const activeOutsidePlayers = playersInZone.filter(
    (p) => p.hp > 0 && Math.hypot(p.x, p.y) > WORLD_TOWN_SAFE_RADIUS
  );

  let activeAttackers = 0;
  for (const u of zoneMap.values()) {
    if (u.alive && !u.isStructure && (u.aiState === 'windup' || u.aiState === 'active')) {
      activeAttackers++;
    }
  }

  for (const unit of zoneMap.values()) {
    if (!unit.alive || unit.hp <= 0 || unit.aiState === 'ko' || unit.isStructure) {
      continue;
    }

    if (unit.chillTimer > 0) {
      unit.chillTimer = Math.max(0, unit.chillTimer - dt);
    }

    const effSpeed = unit.moveSpeed * (unit.chillTimer > 0 ? 0.52 : 1.0);

    // Find closest living player outside Safe Town
    let nearestPlayer: ServerSimPlayerTarget | null = null;
    let bestDist = Infinity;
    for (const p of activeOutsidePlayers) {
      const d = Math.hypot(p.x - unit.x, p.y - unit.y);
      if (d < bestDist) {
        bestDist = d;
        nearestPlayer = p;
      }
    }

    const aggroRange = unit.isBoss ? SERVER_BOSS_AGGRO_RANGE : SERVER_MONSTER_AGGRO_RANGE;
    const isAggroed = nearestPlayer !== null && bestDist <= aggroRange;

    if (!isAggroed) {
      if (unit.aiState === 'windup' || unit.aiState === 'active') {
        unit.aiState = 'move';
        unit.stateTimer = 0.8;
      }

      if (unit.isBoss) {
        // Golden Boss roams continuously across the wilderness outside Safe Town
        if (unit.roamTargetX === undefined || unit.roamTargetY === undefined) {
          const wp = pickGoldenBossRoamWaypoint(unit.x, unit.y, randFn);
          unit.roamTargetX = wp.x;
          unit.roamTargetY = wp.y;
        }
        const rdx = unit.roamTargetX - unit.x;
        const rdy = unit.roamTargetY - unit.y;
        const rDist = Math.hypot(rdx, rdy);
        if (rDist < 75) {
          const wp = pickGoldenBossRoamWaypoint(unit.x, unit.y, randFn);
          unit.roamTargetX = wp.x;
          unit.roamTargetY = wp.y;
        } else {
          const roamSpd = effSpeed * 0.62;
          const rnx = rdx / rDist;
          const rny = rdy / rDist;
          unit.x += rnx * roamSpd * dt;
          unit.y += rny * roamSpd * dt;
          unit.facingAngle = Math.atan2(rny, rnx);
          unit.walkDistance += roamSpd * dt;
          const townD = Math.hypot(unit.x, unit.y);
          if (townD < WORLD_TOWN_SAFE_RADIUS + 90) {
            const pushA = townD > 1 ? Math.atan2(unit.y, unit.x) : 0;
            unit.x = Math.cos(pushA) * (WORLD_TOWN_SAFE_RADIUS + 95);
            unit.y = Math.sin(pushA) * (WORLD_TOWN_SAFE_RADIUS + 95);
            const detour = pickGoldenBossRoamWaypoint(unit.x, unit.y, randFn);
            unit.roamTargetX = detour.x;
            unit.roamTargetY = detour.y;
          }
        }
      } else {
        // Regular monster returns to camp or gently patrols around its camp anchor
        const toCampX = unit.campX - unit.x;
        const toCampY = unit.campY - unit.y;
        const distFromCamp = Math.hypot(toCampX, toCampY);
        if (distFromCamp > 280) {
          const rnx = toCampX / distFromCamp;
          const rny = toCampY / distFromCamp;
          unit.x += rnx * effSpeed * 0.7 * dt;
          unit.y += rny * effSpeed * 0.7 * dt;
          unit.facingAngle = Math.atan2(rny, rnx);
          unit.walkDistance += effSpeed * 0.7 * dt;
        } else {
          const patrolA = nowMs * 0.0008 * unit.orbitDirection + unit.campX;
          const px = Math.cos(patrolA);
          const py = Math.sin(patrolA);
          unit.x += px * effSpeed * 0.35 * dt;
          unit.y += py * effSpeed * 0.35 * dt;
          unit.facingAngle = Math.atan2(py, px);
          unit.walkDistance += effSpeed * 0.35 * dt;
        }
      }
    } else if (nearestPlayer) {
      const dx = nearestPlayer.x - unit.x;
      const dy = nearestPlayer.y - unit.y;
      const dist = Math.max(1, bestDist);
      unit.facingAngle = Math.atan2(dy, dx);

      if (unit.aiState === 'move') {
        if (unit.archetype === 'swarmer_skeleton') {
          if (dist > unit.attackRange) {
            unit.x += (dx / dist) * effSpeed * dt;
            unit.y += (dy / dist) * effSpeed * dt;
            unit.walkDistance += effSpeed * dt;
          } else if (activeAttackers < SERVER_MAX_CONCURRENT_ATTACKERS) {
            unit.aiState = 'windup';
            unit.stateTimer = 0.42;
            unit.telegraphX = nearestPlayer.x;
            unit.telegraphY = nearestPlayer.y;
            activeAttackers++;
          }
        } else if (unit.archetype === 'kiter_lich') {
          if (dist < 115) {
            unit.x -= (dx / dist) * effSpeed * 0.9 * dt;
            unit.y -= (dy / dist) * effSpeed * 0.9 * dt;
            unit.walkDistance += effSpeed * dt;
          } else if (dist > unit.attackRange) {
            unit.x += (dx / dist) * effSpeed * dt;
            unit.y += (dy / dist) * effSpeed * dt;
            unit.walkDistance += effSpeed * dt;
          } else {
            const perpX = (-dy / dist) * unit.orbitDirection;
            const perpY = (dx / dist) * unit.orbitDirection;
            unit.x += perpX * effSpeed * 0.65 * dt;
            unit.y += perpY * effSpeed * 0.65 * dt;
            unit.walkDistance += effSpeed * 0.65 * dt;
            unit.stateTimer -= dt;
            if (unit.stateTimer <= 0 && activeAttackers < SERVER_MAX_CONCURRENT_ATTACKERS) {
              unit.aiState = 'windup';
              unit.stateTimer = 0.55;
              unit.telegraphX = nearestPlayer.x;
              unit.telegraphY = nearestPlayer.y;
              activeAttackers++;
            }
          }
        } else if (unit.archetype === 'charger_bull') {
          if (dist > unit.attackRange) {
            unit.x += (dx / dist) * effSpeed * dt;
            unit.y += (dy / dist) * effSpeed * dt;
            unit.walkDistance += effSpeed * dt;
          } else if (activeAttackers < SERVER_MAX_CONCURRENT_ATTACKERS) {
            unit.aiState = 'windup';
            unit.stateTimer = 0.52;
            unit.telegraphX = Math.max(
              -arenaLimit,
              Math.min(arenaLimit, unit.x + (dx / dist) * 185)
            );
            unit.telegraphY = Math.max(
              -arenaLimit,
              Math.min(arenaLimit, unit.y + (dy / dist) * 185)
            );
            activeAttackers++;
          }
        } else {
          // orbiter_gorgon (Golden Boss & Winged Guardians)
          const perpX = (-dy / dist) * unit.orbitDirection;
          const perpY = (dx / dist) * unit.orbitDirection;
          const pull = dist > 135 ? 0.65 : -0.25;
          unit.x += ((dx / dist) * pull + perpX * 0.75) * effSpeed * dt;
          unit.y += ((dy / dist) * pull + perpY * 0.75) * effSpeed * dt;
          unit.walkDistance += effSpeed * dt;
          unit.stateTimer -= dt;
          if (unit.stateTimer <= 0 && activeAttackers < SERVER_MAX_CONCURRENT_ATTACKERS) {
            unit.aiState = 'windup';
            unit.stateTimer = 0.65;
            unit.telegraphX = nearestPlayer.x;
            unit.telegraphY = nearestPlayer.y;
            activeAttackers++;
          }
        }
      } else if (unit.aiState === 'windup') {
        unit.stateTimer -= dt;
        if (unit.stateTimer <= 0) {
          unit.aiState = 'active';
          unit.stateTimer = 0.18;
          if (unit.archetype === 'charger_bull') {
            unit.x = unit.telegraphX;
            unit.y = unit.telegraphY;
          }
          const hitCenterX = unit.archetype === 'swarmer_skeleton' ? unit.x : unit.telegraphX;
          const hitCenterY = unit.archetype === 'swarmer_skeleton' ? unit.y : unit.telegraphY;
          const hitRadius = unit.isBoss ? 105 : unit.archetype === 'kiter_lich' ? 68 : 62;
          attacks.push({
            territoryId,
            enemyId: unit.id,
            monsterName: unit.name,
            archetype: unit.archetype,
            isBoss: unit.isBoss,
            hitCenterX: Math.round(hitCenterX),
            hitCenterY: Math.round(hitCenterY),
            hitRadius,
            attackDamage: Math.round(unit.attackDamage),
            timestamp: nowMs,
          });
        }
      } else if (unit.aiState === 'active') {
        unit.stateTimer -= dt;
        if (unit.stateTimer <= 0) {
          unit.aiState = 'recover';
          unit.stateTimer = unit.isBoss ? 0.95 : 0.85;
        }
      } else if (unit.aiState === 'recover') {
        unit.stateTimer -= dt;
        if (unit.stateTimer <= 0) {
          unit.aiState = 'move';
          unit.stateTimer = unit.isBoss ? 0.8 : 0.9;
        }
      }
    }

    // Clamp strictly inside arena bounds and outside Safe Town perimeter
    unit.x = Math.max(-arenaLimit, Math.min(arenaLimit, unit.x));
    unit.y = Math.max(-arenaLimit, Math.min(arenaLimit, unit.y));
    const dTown = Math.hypot(unit.x, unit.y);
    if (dTown < WORLD_TOWN_SAFE_RADIUS + 24) {
      const pushA = dTown > 1 ? Math.atan2(unit.y, unit.x) : 0;
      unit.x = Math.cos(pushA) * (WORLD_TOWN_SAFE_RADIUS + 28);
      unit.y = Math.sin(pushA) * (WORLD_TOWN_SAFE_RADIUS + 28);
    }
  }

  return attacks;
}

export function extractDeadRespawnsRecord(
  zoneMap: Map<string, ServerMonsterUnit>,
  nowGameSec: number
): Record<string, number> {
  const record: Record<string, number> = {};
  for (const unit of zoneMap.values()) {
    if (!unit.alive && unit.respawnAtGameTimeSec > nowGameSec) {
      record[unit.id] = unit.respawnAtGameTimeSec;
    }
  }
  return record;
}

export function toSharedMonsterState(unit: ServerMonsterUnit): SharedMonsterState {
  return {
    id: unit.id,
    name: unit.name,
    archetype: unit.archetype,
    isBoss: unit.isBoss,
    isStructure: unit.isStructure,
    isQuestMonster: unit.isQuestMonster,
    x: Math.round(unit.x),
    y: Math.round(unit.y),
    campX: Math.round(unit.campX),
    campY: Math.round(unit.campY),
    anchorX: Math.round(unit.anchorX),
    anchorY: Math.round(unit.anchorY),
    radius: unit.radius,
    hp: Math.max(0, Math.round(unit.hp)),
    maxHp: Math.max(1, Math.round(unit.maxHp)),
    attackDamage: Math.round(unit.attackDamage),
    moveSpeed: Math.round(unit.moveSpeed),
    attackRange: Math.round(unit.attackRange),
    expReward: Math.round(unit.expReward),
    zenReward: Math.round(unit.zenReward),
    color: unit.color,
    respawnDurationSec: unit.respawnDurationSec,
    aiState: unit.aiState,
    telegraphX: Math.round(unit.telegraphX),
    telegraphY: Math.round(unit.telegraphY),
    facingAngle: Math.round(unit.facingAngle * 100) / 100,
    walkDistance: Math.round(unit.walkDistance),
    chillTimer: Math.round(unit.chillTimer * 10) / 10,
    orbitDirection: unit.orbitDirection,
  };
}

// ============================================================================
// DEDICATED BLOOD CASTLE EVENT MONSTERS (5s Individual Respawn) & 3-MIN LIMIT
// ============================================================================

export const BLOOD_CASTLE_RESPAWN_DURATION_SEC: number = BLOOD_CASTLE_CONFIG.respawnDurationSec;
export const BLOOD_CASTLE_TIME_LIMIT_SEC: number = BLOOD_CASTLE_CONFIG.timeLimitSec;
export const BLOOD_CASTLE_UNIT_COUNT: number = BLOOD_CASTLE_CONFIG.bridgeUnitCount;
export const BLOOD_CASTLE_BRIDGE_HALF_WIDTH: number = BLOOD_CASTLE_CONFIG.bridgeHalfWidth;
export const BLOOD_CASTLE_GATE_Y: number = BLOOD_CASTLE_CONFIG.gateY;
export const BLOOD_CASTLE_STATUE_Y: number = BLOOD_CASTLE_CONFIG.statueY;
export const BLOOD_CASTLE_HERO_START_Y: number = BLOOD_CASTLE_CONFIG.heroStartY;

export function pickBloodCastleBridgeRespawnPoint(
  anchorX: number,
  anchorY: number,
  randA = Math.random(),
  randB = Math.random()
): { x: number; y: number } {
  const angle = randA * Math.PI * 2;
  const jitter =
    BLOOD_CASTLE_CONFIG.respawnJitterMinPx + randB * BLOOD_CASTLE_CONFIG.respawnJitterSpanPx;
  const x = Math.max(
    -BLOOD_CASTLE_BRIDGE_HALF_WIDTH + 44,
    Math.min(BLOOD_CASTLE_BRIDGE_HALF_WIDTH - 44, anchorX + Math.cos(angle) * jitter)
  );
  const y = Math.max(
    BLOOD_CASTLE_GATE_Y + 95,
    Math.min(BLOOD_CASTLE_HERO_START_Y - 220, anchorY + Math.sin(angle) * jitter)
  );
  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Builds the dedicated Blood Castle Bridge monster roster (36 separate units)
 * distributed along the entire bridge, each with its own fixed `bc_unit_*` slot
 * and a 5-second individual respawn duration.
 */
export function buildBloodCastleBridgeUnits(
  territoryId: TerritoryId,
  playerLevel: number
): ServerMonsterUnit[] {
  const territoryIdx = Math.max(
    0,
    TERRITORIES.findIndex((t) => t.id === territoryId)
  );
  const territory = TERRITORIES[territoryIdx] ?? TERRITORIES[0];
  const mult = Math.max(1, territory.enemyLevelMultiplier * BLOOD_CASTLE_CONFIG.enemyMultiplierFactor);
  const xpMult =
    Math.pow(territory.enemyLevelMultiplier, BLOOD_CASTLE_CONFIG.expTerritoryPower) *
    (1 + (Math.max(1, playerLevel) - 1) * BLOOD_CASTLE_CONFIG.expPerPlayerLevelBonus) *
    SERVER_CONFIG.rates.expMultiplier;
  const zenMult =
    Math.pow(territory.enemyLevelMultiplier, BLOOD_CASTLE_CONFIG.zenTerritoryPower) *
    SERVER_CONFIG.rates.zenMultiplier;

  const units: ServerMonsterUnit[] = [];
  const bridgeMinY = BLOOD_CASTLE_GATE_Y + 130; // -1190
  const bridgeMaxY = BLOOD_CASTLE_HERO_START_Y - 270; // +1650
  const bridgeSpanY = bridgeMaxY - bridgeMinY;
  const usableHalfW = BLOOD_CASTLE_BRIDGE_HALF_WIDTH - 56;

  for (let i = 0; i < BLOOD_CASTLE_UNIT_COUNT; i++) {
    const slotId = `bc_unit_${i}`;
    const hRole = deterministicUnitHash(`${slotId}:role`);
    const hX = deterministicUnitHash(`${slotId}:x`);
    const hY = deterministicUnitHash(`${slotId}:y`);
    const hOrbit = deterministicUnitHash(`${slotId}:orbit`);

    // Evenly stratify along the bridge so every segment has action, with organic lateral spread
    const laneFrac = (i + 0.5) / BLOOD_CASTLE_UNIT_COUNT;
    const rawY = bridgeMinY + laneFrac * bridgeSpanY + (hY - 0.5) * 90;
    const laneCol = ((i % 3) - 1) * (usableHalfW * 0.62) + (hX - 0.5) * 110;

    const anchorX = Math.round(Math.max(-usableHalfW, Math.min(usableHalfW, laneCol)));
    const anchorY = Math.round(Math.max(bridgeMinY, Math.min(bridgeMaxY, rawY)));

    let archetype: EnemyArchetype = 'swarmer_skeleton';
    let name = 'Проклятый Страж Моста';
    let hp = Math.round(135 * mult);
    let dmg = Math.round(24 * mult);
    let spd = 128;
    let rng = 56;
    let radius = 20;
    let color = '#fecdd3';

    if (hRole < 0.4) {
      archetype = 'swarmer_skeleton';
      name = 'Рыцарь Черепа Blood Castle';
      color = '#fecdd3';
    } else if (hRole < 0.7) {
      archetype = 'kiter_lich';
      name = 'Кровавый Колдун Замка';
      hp = Math.round(120 * mult);
      dmg = Math.round(28 * mult);
      spd = 114;
      rng = 210;
      radius = 21;
      color = '#e879f9';
    } else if (hRole < 0.9) {
      archetype = 'charger_bull';
      name = 'Палач Моста Крови';
      hp = Math.round(190 * mult);
      dmg = Math.round(34 * mult);
      spd = 136;
      rng = 185;
      radius = 24;
      color = '#fb7185';
    } else {
      archetype = 'orbiter_gorgon';
      name = 'Падший Страж Архангела';
      hp = Math.round(175 * mult);
      dmg = Math.round(32 * mult);
      spd = 122;
      rng = 165;
      radius = 23;
      color = '#f43f5e';
    }

    units.push({
      id: slotId,
      territoryId,
      campIdx: 0,
      unitIdx: i,
      name,
      archetype,
      isBoss: false,
      isStructure: false,
      isQuestMonster: false,
      isVipRanged: false,
      campX: anchorX,
      campY: anchorY,
      anchorX,
      anchorY,
      x: anchorX,
      y: anchorY,
      radius,
      hp,
      maxHp: hp,
      attackDamage: dmg,
      moveSpeed: spd,
      attackRange: rng,
      expReward: Math.round(BLOOD_CASTLE_CONFIG.expBase * xpMult),
      zenReward: Math.round(BLOOD_CASTLE_CONFIG.zenBase * zenMult),
      color,
      respawnDurationSec: BLOOD_CASTLE_RESPAWN_DURATION_SEC,
      alive: true,
      respawnAtGameTimeSec: 0,
      aiState: 'move',
      stateTimer: 0.5,
      telegraphX: anchorX,
      telegraphY: anchorY,
      facingAngle: 0,
      walkDistance: 0,
      chillTimer: 0,
      orbitDirection: hOrbit >= 0.5 ? 1 : -1,
    });
  }

  return units;
}

/**
 * Formats remaining countdown seconds as MM:SS (e.g., 180 -> "03:00", 65 -> "01:05").
 */
export function formatCountdownMMSS(totalSec: number): string {
  const clamped = Math.max(0, Math.ceil(totalSec));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Pure step function for Blood Castle's 3-minute time limit.
 */
export function advanceBloodCastleTimer(
  currentRemainingSec: number,
  dtSec: number,
  isCompleted: boolean
): {
  nextRemainingSec: number;
  timedOut: boolean;
  crossedOneMinuteMark: boolean;
  crossedThirtySecMark: boolean;
} {
  if (isCompleted) {
    return {
      nextRemainingSec: Math.max(0, currentRemainingSec),
      timedOut: false,
      crossedOneMinuteMark: false,
      crossedThirtySecMark: false,
    };
  }
  const safeDt = Math.max(0, dtSec);
  const nextRemainingSec = Math.max(0, currentRemainingSec - safeDt);
  return {
    nextRemainingSec,
    timedOut: currentRemainingSec > 0 && nextRemainingSec <= 0,
    crossedOneMinuteMark: currentRemainingSec > 60 && nextRemainingSec <= 60,
    crossedThirtySecMark: currentRemainingSec > 30 && nextRemainingSec <= 30,
  };
}

