import React, { useEffect, useRef } from 'react';
import { CHARACTER_SCALING, DROP_RATES, SERVER_CONFIG } from '../config';
import { drawEnemyModel, drawHeroModel, drawNpcModel } from '../game/models';
import {
  GROUND_LOOT_TTL_MS,
  createEquipmentGroundDrop,
  electZoneHostId,
  getGroundLootRemainingSec,
  getSameZonePartyAllies,
  getWorldGameTimeSec,
  isGroundLootExpired,
  isSoundAudibleAt,
} from '../game/party';
import {
  CLASSES,
  TERRITORIES,
  calculateDerivedStats,
  calculateTerritoryMonsterDefense,
  generateEquipmentDrop,
  getFirstProfQuestItemName,
  getTerritoryMapLayout,
  rollBloodCastleMaterialDrop,
  rollJewelDropType,
} from '../game/rules';
import { soundEngine } from '../game/sound';
import {
  BloodCastleStage,
  EnemyArchetype,
  EnemyEntity,
  EquipmentItem,
  GamePhase,
  LootDrop,
  PartyAttackEvent,
  PartyKillShareEvent,
  PartyLootMode,
  PartyMemberState,
  PartyZoneMonsterSnapshot,
  PlayerProgressState,
  ServerMonsterHpEvent,
  ServerMonsterKilledEvent,
  ServerMonsterRespawnedEvent,
  SharedMonsterState,
  SkillDefinition,
  TerritoryId,
  TerritoryMapLayout,
} from '../game/types';
import {
  BLOOD_CASTLE_RESPAWN_DURATION_SEC,
  BLOOD_CASTLE_TIME_LIMIT_SEC,
  ServerMonsterAttackEvent,
  ServerMonsterUnit,
  advanceBloodCastleTimer,
  buildBloodCastleBridgeUnits,
  buildTerritoryUnitBlueprints,
  createTerritoryBossUnit,
  getGoldenBossSlotIndex,
  getNextGoldenBossSpawnSec,
  pickBloodCastleBridgeRespawnPoint,
  pickGoldenBossRoamWaypoint,
  pickSpreadRespawnPoint,
} from '../game/worldMonsters';
import { HudDomRefs } from './HudOverlay';

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface PooledFloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

interface ActiveSkillVfx {
  pattern: SkillDefinition['pattern'] | 'mu_combo_blast';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  radius: number;
  color: string;
  elapsed: number;
  duration: number;
}

export interface GameEngineActions {
  triggerPrimaryAttack: () => void;
  triggerSkill: (skillIndex: number) => void;
  triggerHpPotion: () => void;
  triggerLargeHpPotion: () => void;
  triggerMpPotion: () => void;
  triggerPickupNearbyLoot: () => void;
  triggerDash: () => void;
  walkToShopNpc: () => void;
  setJoystickVector: (dx: number, dy: number) => void;
  resetTerritoryArena: (fullHeal?: boolean) => void;
  notifyStatusMessage: (text: string, color?: string) => void;
  teleportToCoordinates: (x: number, y: number, label?: string) => void;
  applyRemotePartyAttack: (attack: PartyAttackEvent) => void;
  applySharedZoneMonsters: (snapshot: PartyZoneMonsterSnapshot) => void;
  applyRemoteSharedKill: (kill: PartyKillShareEvent) => void;
  applyServerZoneMonstersInit: (payload: {
    territoryId: TerritoryId;
    inBloodCastle: boolean;
    monsters: SharedMonsterState[];
    deadMonsterRespawns: Record<string, number>;
  }) => void;
  applyServerMonsterHp: (event: ServerMonsterHpEvent) => void;
  applyServerMonsterKilled: (event: ServerMonsterKilledEvent) => void;
  applyServerMonsterRespawned: (event: ServerMonsterRespawnedEvent) => void;
  applyServerMonsterAttack: (event: ServerMonsterAttackEvent) => void;
  dropEquipmentOnGround: (item: EquipmentItem) => LootDrop;
  syncServerGroundLoot: (drops: LootDrop[]) => void;
  addServerGroundLootBatch: (drops: LootDrop[]) => void;
  addRemoteGroundLoot: (drop: LootDrop) => void;
  removeRemoteGroundLoot: (
    dropId: string,
    pickerNickname?: string,
    recipientNickname?: string,
    lootMode?: PartyLootMode
  ) => void;
  setLocalChatBubble: (text: string) => void;
  applyServerHeroVitals: (vitals: { x: number; y: number; hp: number; mp: number }) => void;
  getHeroRuntimeVitals: () => {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
  };
}

interface GameCanvasProps {
  phase: GamePhase;
  player: PlayerProgressState;
  autoHunt: boolean;
  wsConnected: boolean;
  hudRefs: HudDomRefs;
  engineActionsRef: React.MutableRefObject<GameEngineActions | null>;
  partySelfId: string;
  localNickname: string;
  partyMembersRef: React.RefObject<PartyMemberState[]>;
  onServerDamageMonster?: (hit: {
    enemyId: string;
    damage: number;
    isCrit: boolean;
    isDouble: boolean;
    isHeavy: boolean;
    applyChill: boolean;
    x: number;
    y: number;
  }) => void;
  onServerSpawnBoss?: (campIdx: number) => void;
  onRequestZoneState?: () => void;
  onPartySyncHero?: (snapshot: {
    x: number;
    y: number;
    facingAngle: number;
    walkDistance: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
  }) => void;
  onPartySyncZoneMonsters?: (
    snapshot: Omit<PartyZoneMonsterSnapshot, 'hostId' | 'timestamp'>
  ) => void;
  onPartyBroadcastAttack?: (attack: {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    facingAngle: number;
    pattern: SkillDefinition['pattern'] | 'primary';
    skillColor: string;
    damage: number;
    aoeRadius: number;
    hitEnemyIds: string[];
  }) => void;
  onPartyBroadcastKill?: (kill: {
    enemyId: string;
    monsterName: string;
    isBoss: boolean;
    expReward: number;
    zenReward: number;
    x: number;
    y: number;
  }) => void;
  onPartyPickupGroundItem?: (dropId: string) => void;
  onEnemyKilled: (expGain: number, isBoss: boolean, territoryCompleted: boolean) => void;
  onLootCollected: (loot: LootDrop) => void;
  onConsumeHpPotion: () => boolean;
  onConsumeLargeHpPotion: () => boolean;
  onConsumeMpPotion: () => boolean;
  onPlayerDefeated: (bossHpRemaining: number) => void;
  onCompleteBloodCastleQuest: () => void;
  onBloodCastleTimeout?: () => void;
  onOpenNpcModal: (
    npc: 'chaos_goblin' | 'priestess_sevina' | 'blacksmith_hanzo' | 'portal_guard'
  ) => void;
  onHudSync: (info: {
    cooldowns: Record<string, number>;
    nearbyLootCount: number;
    bossActiveName: string | null;
    bossHpPct: number;
    comboStage: number;
    isNearShop: boolean;
    bloodCastleInfo: {
      active: boolean;
      stage: BloodCastleStage;
      kills: number;
      targetKills: number;
      hasArchangelWeapon: boolean;
      timeRemainingSec: number;
      timeLimitSec: number;
    } | null;
  }) => void;
}

const ARENA_HALF_SIZE = 5200;
const TOWN_SAFE_RADIUS = 560;
const SHOP_INTERACT_RADIUS = 240;
const MONSTER_AGGRO_RANGE = 460;
const AUTO_HUNT_RADIUS = 420;
const CAMP_SPAWN_RADIUS = 350;
const CAMP_RESPAWN_INTERVAL_SEC = 14;
const MAX_PARTICLES = 240;
const MAX_FLOATING_TEXTS = 45;
const MAX_CONCURRENT_ATTACKERS = 3;

// Blood Castle Bridge Geometry Constants
const BC_BRIDGE_HALF_WIDTH = 340;
const BC_SOUTH_END_Y = 2320;
const BC_NORTH_END_Y = -2250;
const BC_ARCHANGEL_X = 0;
const BC_ARCHANGEL_Y = 2120;
const BC_HERO_START_Y = 1920;
const BC_GATE_Y = -1320;
const BC_STATUE_Y = -1920;
const BC_TARGET_KILLS = 100;
const BC_BRIDGE_MAX_MONSTERS = 32;

export const GameCanvas: React.FC<GameCanvasProps> = ({
  phase,
  player,
  autoHunt,
  wsConnected,
  hudRefs,
  engineActionsRef,
  partySelfId,
  localNickname,
  partyMembersRef,
  onServerDamageMonster,
  onServerSpawnBoss,
  onRequestZoneState,
  onPartySyncHero,
  onPartySyncZoneMonsters,
  onPartyBroadcastAttack,
  onPartyBroadcastKill,
  onPartyPickupGroundItem,
  onEnemyKilled,
  onLootCollected,
  onConsumeHpPotion,
  onConsumeLargeHpPotion,
  onConsumeMpPotion,
  onPlayerDefeated,
  onCompleteBloodCastleQuest,
  onBloodCastleTimeout,
  onOpenNpcModal,
  onHudSync,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const playerRef = useRef(player);
  playerRef.current = player;

  const autoHuntRef = useRef(autoHunt);
  autoHuntRef.current = autoHunt;

  const wsConnectedRef = useRef(wsConnected);
  wsConnectedRef.current = wsConnected;

  const partySelfIdRef = useRef(partySelfId);
  partySelfIdRef.current = partySelfId;

  const localNicknameRef = useRef(localNickname);
  localNicknameRef.current = localNickname;

  const callbacksRef = useRef({
    onEnemyKilled,
    onLootCollected,
    onConsumeHpPotion,
    onConsumeLargeHpPotion,
    onConsumeMpPotion,
    onPlayerDefeated,
    onCompleteBloodCastleQuest,
    onBloodCastleTimeout,
    onOpenNpcModal,
    onHudSync,
    onServerDamageMonster,
    onServerSpawnBoss,
    onRequestZoneState,
    onPartySyncHero,
    onPartySyncZoneMonsters,
    onPartyBroadcastAttack,
    onPartyBroadcastKill,
    onPartyPickupGroundItem,
  });
  callbacksRef.current = {
    onEnemyKilled,
    onLootCollected,
    onConsumeHpPotion,
    onConsumeLargeHpPotion,
    onConsumeMpPotion,
    onPlayerDefeated,
    onCompleteBloodCastleQuest,
    onBloodCastleTimeout,
    onOpenNpcModal,
    onHudSync,
    onServerDamageMonster,
    onServerSpawnBoss,
    onRequestZoneState,
    onPartySyncHero,
    onPartySyncZoneMonsters,
    onPartyBroadcastAttack,
    onPartyBroadcastKill,
    onPartyPickupGroundItem,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let viewWidth = window.innerWidth;
    let viewHeight = window.innerHeight;
    let canvasRect = canvas.getBoundingClientRect();

    const updateCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewWidth = window.innerWidth;
      viewHeight = window.innerHeight;
      canvas.width = Math.floor(viewWidth * dpr);
      canvas.height = Math.floor(viewHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvasRect = canvas.getBoundingClientRect();
    };
    updateCanvasSize();

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    resizeObserver.observe(canvas);

    // Pre-allocated zero-GC particle ring buffer
    const particles: PooledParticle[] = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 3,
      color: '#f59e0b',
      alpha: 1,
      life: 0,
      maxLife: 0.5,
    }));
    let particleCursor = 0;

    const spawnParticles = (
      x: number,
      y: number,
      count: number,
      color: string,
      speedMin = 45,
      speedMax = 180,
      size = 3.5,
      life = 0.45
    ) => {
      for (let i = 0; i < count; i++) {
        const p = particles[particleCursor];
        particleCursor = (particleCursor + 1) % MAX_PARTICLES;
        const angle = Math.random() * Math.PI * 2;
        const spd = speedMin + Math.random() * (speedMax - speedMin);
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * spd;
        p.vy = Math.sin(angle) * spd;
        p.size = size * (0.75 + Math.random() * 0.5);
        p.color = color;
        p.alpha = 1;
        p.life = 0;
        p.maxLife = life * (0.8 + Math.random() * 0.4);
      }
    };

    // Pre-allocated floating combat text buffer
    const floatingTexts: PooledFloatingText[] = Array.from({ length: MAX_FLOATING_TEXTS }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -42,
      text: '',
      color: '#ffffff',
      scale: 1,
      life: 0,
      maxLife: 0.85,
    }));
    let textCursor = 0;

    const spawnFloatingText = (x: number, y: number, text: string, color: string, scale = 1) => {
      const ft = floatingTexts[textCursor];
      textCursor = (textCursor + 1) % MAX_FLOATING_TEXTS;
      ft.active = true;
      ft.x = x + (Math.random() * 20 - 10);
      ft.y = y - 18;
      ft.vy = -48;
      ft.text = text;
      ft.color = color;
      ft.scale = scale;
      ft.life = 0;
      ft.maxLife = 0.92;
    };

    // Static decorative world props (Gothic Pillars, Ruins, Crystals across the 10400x10400 continent)
    const worldColumns: { x: number; y: number }[] = [
      { x: -860, y: -820 },
      { x: 860, y: -820 },
      { x: -860, y: 820 },
      { x: 860, y: 820 },
      { x: -1550, y: -620 },
      { x: 1550, y: -620 },
      { x: -1550, y: 620 },
      { x: 1550, y: 620 },
      { x: -620, y: -1520 },
      { x: 620, y: -1520 },
      { x: -620, y: 1520 },
      { x: 620, y: 1520 },
      { x: -2450, y: -1650 },
      { x: 2450, y: -1650 },
      { x: -2450, y: 1650 },
      { x: 2450, y: 1650 },
    ];

    // 4 Interactive City Sanctuary NPCs in 4 City Quarters (Expanded 1120x1120px Capital)
    const npcChaosGoblin = { x: -230, y: -180, radius: 32, label: 'Гоблин Хаоса [K]' };
    const npcPriestessSevina = { x: 230, y: -180, radius: 32, label: 'Себина · Статы и Профа [C]' };
    const npcBlacksmithHanzo = { x: -135, y: 105, radius: 34, label: 'Ханзо · Лавка Вещей и Скилов [B]' };
    const npcPortalGuard = { x: 230, y: 180, radius: 32, label: 'Портал Городов [T]' };

    const initialStats = calculateDerivedStats(playerRef.current);
    const hero = {
      x: 0,
      y: 42,
      vx: 0,
      vy: 0,
      facingAngle: 0,
      walkDistance: 0,
      scaleX: 1,
      scaleY: 1,
      hp: initialStats.maxHp,
      ghostHp: initialStats.maxHp,
      mp: initialStats.maxMp,
      attackPhase: 'idle' as 'idle' | 'windup' | 'active' | 'recovery',
      attackTimer: 0,
      primaryCooldown: 0,
      dashCooldown: 0,
      hitFlashTimer: 0,
      moveTargetX: null as number | null,
      moveTargetY: null as number | null,
      defeatBeatTimer: 0,
      hpPotionCooldown: 0,
      mpPotionCooldown: 0,
      noPotionWarnCooldown: 0,
      // MU Combo 1 -> 2 -> 3 state
      comboStage: 0,
      comboWindowTimer: 0,
    };

    let cameraX = 0;
    let cameraY = 0;
    let cameraTrauma = 0;
    let hitstopTimer = 0;

    const skillCooldowns: Record<string, number> = {};
    const activeVfx: ActiveSkillVfx[] = [];
    interface LevelUpVfx {
      elapsed: number;
      duration: number;
      newLevel: number;
    }
    const levelUpEffects: LevelUpVfx[] = [];
    let lastObservedHeroLevel = playerRef.current.level;
    let lastObservedResets = playerRef.current.resets;
    let enemies: EnemyEntity[] = [];
    let lootDrops: LootDrop[] = [];
    // Brief auto-pickup grace period (ms) so items you just dropped on the ground aren't immediately re-vacuumed
    const localDropGraceUntil = new Map<string, number>();
    let lootExpireCheckAccumulator = 0;
    let wingTrailParticleTimer = 0;

    // O(1) derived stats cache: recomputes only when playerRef.current object changes instead of 60x/sec
    let cachedStatsPlayerRef: PlayerProgressState | null = null;
    let cachedDerivedStats = calculateDerivedStats(playerRef.current);
    const getCachedDerivedStats = (pState: PlayerProgressState) => {
      if (cachedStatsPlayerRef !== pState) {
        cachedStatsPlayerRef = pState;
        cachedDerivedStats = calculateDerivedStats(pState);
      }
      return cachedDerivedStats;
    };

    let enemySpawnSeq = 0;
    const sharedMonsterTargets = new Map<string, { x: number; y: number }>();
    let activeTerritoryId = playerRef.current.territoryId;
    let activeMapLayout: TerritoryMapLayout = getTerritoryMapLayout(activeTerritoryId);
    // Individual per-unit blueprints & server-time respawn markers (replaces pack respawn)
    let unitBlueprintsById = new Map<string, ServerMonsterUnit>();
    interface DeadUnitRespawnMarker {
      id: string;
      name: string;
      x: number;
      y: number;
      isBoss: boolean;
      respawnAtGameTimeSec: number;
    }
    const deadUnitRespawns = new Map<string, DeadUnitRespawnMarker>();
    let lastZoneResyncRequestMs = 0;
    const LOCAL_RESPAWN_STORAGE_KEY = 'mu_world_dead_respawns_v1';

    const readOfflineDeadRespawns = (territoryId: TerritoryId): Record<string, number> => {
      try {
        const raw = window.localStorage.getItem(LOCAL_RESPAWN_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, Record<string, number>>;
        const map = parsed?.[territoryId] ?? {};
        const nowGameSec = getWorldGameTimeSec();
        const cleaned: Record<string, number> = {};
        for (const [k, v] of Object.entries(map)) {
          if (Number.isFinite(v) && v > nowGameSec) cleaned[k] = v;
        }
        return cleaned;
      } catch {
        return {};
      }
    };

    const writeOfflineDeadRespawns = (territoryId: TerritoryId) => {
      try {
        const raw = window.localStorage.getItem(LOCAL_RESPAWN_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, number>>) : {};
        const nowGameSec = getWorldGameTimeSec();
        const activeRecord: Record<string, number> = {};
        for (const [id, marker] of deadUnitRespawns.entries()) {
          if (marker.respawnAtGameTimeSec > nowGameSec) {
            activeRecord[id] = marker.respawnAtGameTimeSec;
          }
        }
        parsed[territoryId] = activeRecord;
        window.localStorage.setItem(LOCAL_RESPAWN_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignore storage quota errors
      }
    };

    const blueprintToEnemyEntity = (
      unit: ServerMonsterUnit,
      useSpreadJitter = true
    ): EnemyEntity => {
      const pos = useSpreadJitter
        ? pickSpreadRespawnPoint(unit.anchorX, unit.anchorY, unit.isBoss)
        : { x: unit.x, y: unit.y };
      return {
        id: unit.id,
        slotId: unit.id,
        name: unit.name,
        archetype: unit.archetype,
        isBoss: unit.isBoss,
        isStructure: unit.isStructure,
        isQuestMonster: unit.isQuestMonster,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        campX: unit.campX,
        campY: unit.campY,
        anchorX: unit.anchorX,
        anchorY: unit.anchorY,
        respawnDurationSec: unit.respawnDurationSec,
        radius: unit.radius,
        hp: unit.hp,
        maxHp: unit.maxHp,
        attackDamage: unit.attackDamage,
        moveSpeed: unit.moveSpeed,
        attackRange: unit.attackRange,
        expReward: unit.expReward,
        zenReward: unit.zenReward,
        color: unit.color,
        aiState: 'move',
        stateTimer: 0.8 + Math.random() * 0.8,
        telegraphX: pos.x,
        telegraphY: pos.y,
        facingAngle: unit.facingAngle,
        walkDistance: unit.walkDistance,
        hitFlashTimer: 0,
        chillTimer: unit.chillTimer,
        koTimer: 0,
        orbitDirection: unit.orbitDirection,
      };
    };

    const sharedStateToEnemyEntity = (sm: SharedMonsterState): EnemyEntity => ({
      id: sm.id,
      slotId: sm.id,
      name: sm.name,
      archetype: sm.archetype,
      isBoss: sm.isBoss,
      isStructure: sm.isStructure,
      isQuestMonster: sm.isQuestMonster,
      x: sm.x,
      y: sm.y,
      vx: 0,
      vy: 0,
      campX: sm.campX,
      campY: sm.campY,
      anchorX: sm.anchorX ?? sm.campX ?? sm.x,
      anchorY: sm.anchorY ?? sm.campY ?? sm.y,
      respawnDurationSec: sm.respawnDurationSec,
      radius: sm.radius,
      hp: sm.hp,
      maxHp: sm.maxHp,
      attackDamage: sm.attackDamage,
      moveSpeed: sm.moveSpeed,
      attackRange: sm.attackRange,
      expReward: sm.expReward,
      zenReward: sm.zenReward,
      color: sm.color,
      aiState: sm.aiState,
      stateTimer: 0.6,
      telegraphX: sm.telegraphX,
      telegraphY: sm.telegraphY,
      facingAngle: sm.facingAngle,
      walkDistance: sm.walkDistance,
      hitFlashTimer: 0,
      chillTimer: sm.chillTimer,
      koTimer: 0,
      orbitDirection: sm.orbitDirection,
    });

    const syncDeadRespawnMarkersFromRecord = (record: Record<string, number>) => {
      deadUnitRespawns.clear();
      const nowGameSec = getWorldGameTimeSec();
      for (const [slotId, respawnAt] of Object.entries(record)) {
        if (!Number.isFinite(respawnAt) || respawnAt <= nowGameSec) continue;
        const bp = unitBlueprintsById.get(slotId);
        if (bp) {
          deadUnitRespawns.set(slotId, {
            id: slotId,
            name: bp.name,
            x: bp.anchorX,
            y: bp.anchorY,
            isBoss: bp.isBoss,
            respawnAtGameTimeSec: respawnAt,
          });
        } else if (slotId.startsWith('boss_')) {
          const bossBp = createTerritoryBossUnit(activeTerritoryId);
          deadUnitRespawns.set(slotId, {
            id: slotId,
            name: bossBp.name,
            x: bossBp.anchorX,
            y: bossBp.anchorY,
            isBoss: true,
            respawnAtGameTimeSec: respawnAt,
          });
        }
      }
    };

    let bossSpawnedForTerritory = false;
    const offlineBossLastSlotByTerritory = new Map<TerritoryId, number>();
    let activeInBloodCastle = playerRef.current.inBloodCastle;
    let bcStage: BloodCastleStage = 'kill_100';
    let bcBridgeKills = 0;
    let bcHasArchangelWeapon = false;
    let bcElapsedSec = 0;
    let bcTimeRemainingSec = BLOOD_CASTLE_TIME_LIMIT_SEC;
    let bcTimeoutTriggered = false;
    let bcReconcileTimer = 0.5;
    let bcBlueprintsById = new Map<string, ServerMonsterUnit>();
    const bcDeadRespawns = new Map<
      string,
      { id: string; name: string; x: number; y: number; respawnAtSec: number }
    >();

    const checkIsZoneHost = (): boolean => {
      const selfId = partySelfIdRef.current;
      if (!selfId) return true;
      const members = partyMembersRef.current ?? [];
      if (members.length <= 1) return true;
      const hostId = electZoneHostId(
        members,
        selfId,
        activeTerritoryId,
        activeInBloodCastle
      );
      return hostId === selfId;
    };

    const keysPressed = new Set<string>();
    let joystickDx = 0;
    let joystickDy = 0;
    let attackBufferTimer = 0;
    let bufferedSkillIdx: number | null = null;
    let pendingShopOpen = false;

    const getCameraZoom = (): number => {
      if (viewHeight <= 440) return 0.72;
      if (viewHeight <= 540) return 0.84;
      return 1.0;
    };

    const screenToWorld = (clientX: number, clientY: number) => {
      canvasRect = canvas.getBoundingClientRect();
      const localX = clientX - canvasRect.left;
      const localY = clientY - canvasRect.top;
      const zoom = getCameraZoom();
      return {
        wx: cameraX + (localX - viewWidth / 2) / zoom,
        wy: cameraY + (localY - viewHeight / 2) / zoom,
      };
    };

    const isAudibleAt = (sourceX: number, sourceY: number): boolean =>
      isSoundAudibleAt(hero.x, hero.y, sourceX, sourceY);

    const pendingServerPickupUntil = new Map<string, number>();

    const spawnTerritoryBossLocal = () => {
      const bossUnit = createTerritoryBossUnit(activeTerritoryId);
      const bossEntity = blueprintToEnemyEntity(bossUnit, false);
      const roamPt = pickGoldenBossRoamWaypoint(bossEntity.x, bossEntity.y);
      bossEntity.roamTargetX = roamPt.x;
      bossEntity.roamTargetY = roamPt.y;
      enemies = enemies.filter((e) => e.id !== bossEntity.id);
      enemies.push(bossEntity);
      bossSpawnedForTerritory = true;
      spawnParticles(bossEntity.x, bossEntity.y, 32, '#facc15', 45, 165, 3.8, 0.55);
      spawnFloatingText(
        bossEntity.x,
        bossEntity.y - 30,
        `👑 ВТОРЖЕНИЕ: ${bossEntity.name}!`,
        '#facc15',
        1.3
      );
      if (isAudibleAt(bossEntity.x, bossEntity.y)) {
        soundEngine.playGoldenBossInvasion();
      }
    };

    const bcBlueprintToEnemyEntity = (
      unit: ServerMonsterUnit,
      useJitter = true
    ): EnemyEntity => {
      const pos = useJitter
        ? pickBloodCastleBridgeRespawnPoint(unit.anchorX, unit.anchorY)
        : { x: unit.anchorX, y: unit.anchorY };
      return {
        id: unit.id,
        slotId: unit.id,
        name: unit.name,
        archetype: unit.archetype,
        isBoss: false,
        isStructure: false,
        isQuestMonster: false,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        campX: unit.anchorX,
        campY: unit.anchorY,
        anchorX: unit.anchorX,
        anchorY: unit.anchorY,
        respawnDurationSec: BLOOD_CASTLE_RESPAWN_DURATION_SEC,
        radius: unit.radius,
        hp: unit.maxHp,
        maxHp: unit.maxHp,
        attackDamage: unit.attackDamage,
        moveSpeed: unit.moveSpeed,
        attackRange: unit.attackRange,
        expReward: unit.expReward,
        zenReward: unit.zenReward,
        color: unit.color,
        aiState: 'move',
        stateTimer: 0.65 + Math.random() * 0.55,
        telegraphX: pos.x,
        telegraphY: pos.y,
        facingAngle: Math.PI / 2,
        walkDistance: 0,
        hitFlashTimer: 0,
        chillTimer: 0,
        koTimer: 0,
        orbitDirection: unit.orbitDirection,
      };
    };

    const resetTerritoryArena = (fullHeal = true) => {
      const derived = getCachedDerivedStats(playerRef.current);
      activeTerritoryId = playerRef.current.territoryId;
      activeMapLayout = getTerritoryMapLayout(activeTerritoryId);
      activeInBloodCastle = playerRef.current.inBloodCastle;

      hero.vx = 0;
      hero.vy = 0;
      hero.moveTargetX = null;
      hero.moveTargetY = null;
      hero.defeatBeatTimer = 0;
      hero.comboStage = 0;
      hero.comboWindowTimer = 0;
      if (fullHeal) {
        hero.hp = derived.maxHp;
        hero.ghostHp = derived.maxHp;
        hero.mp = derived.maxMp;
      }
      enemies = [];
      lootDrops = [];
      activeVfx.length = 0;
      bossSpawnedForTerritory = false;

      if (activeInBloodCastle) {
        hero.x = 0;
        hero.y = BC_HERO_START_Y;
        bcStage = 'kill_100';
        bcBridgeKills = 0;
        bcHasArchangelWeapon = false;
        bcElapsedSec = 0;
        bcTimeRemainingSec = BLOOD_CASTLE_TIME_LIMIT_SEC;
        bcTimeoutTriggered = false;
        bcReconcileTimer = 0.5;
        bcDeadRespawns.clear();
        deadUnitRespawns.clear();

        const pState = playerRef.current;
        const territoryIdx = Math.max(
          0,
          TERRITORIES.findIndex((t) => t.id === pState.territoryId)
        );
        const territory = TERRITORIES[territoryIdx] ?? TERRITORIES[0];
        const structMult = Math.max(1, territory.enemyLevelMultiplier);

        // Spawn Castle Gates at the northern end of the bridge (y = -1320)
        enemies.push({
          id: 'bc_gate_entity',
          name: 'ВОРОТА ЗАМКА КРОВИ (Castle Gates)',
          archetype: 'bc_gate',
          isBoss: true,
          isStructure: true,
          x: 0,
          y: BC_GATE_Y,
          vx: 0,
          vy: 0,
          campX: 0,
          campY: BC_GATE_Y,
          radius: 65,
          hp: Math.round(1450 * structMult),
          maxHp: Math.round(1450 * structMult),
          attackDamage: 0,
          moveSpeed: 0,
          attackRange: 0,
          expReward: Math.round(500 * Math.pow(structMult, 0.75)),
          zenReward: 2500,
          color: '#f43f5e',
          aiState: 'move',
          stateTimer: 1,
          telegraphX: 0,
          telegraphY: BC_GATE_Y,
          facingAngle: 0,
          walkDistance: 0,
          hitFlashTimer: 0,
          chillTimer: 0,
          koTimer: 0,
          orbitDirection: 1,
        });

        // Spawn Crystal Statue inside the northern sanctum behind the gates (y = -1920)
        enemies.push({
          id: 'bc_statue_entity',
          name: 'ХРУСТАЛЬНАЯ СТАТУЯ АРХАНГЕЛА (Crystal Statue)',
          archetype: 'bc_statue',
          isBoss: true,
          isStructure: true,
          x: 0,
          y: BC_STATUE_Y,
          vx: 0,
          vy: 0,
          campX: 0,
          campY: BC_STATUE_Y,
          radius: 52,
          hp: Math.round(1650 * structMult),
          maxHp: Math.round(1650 * structMult),
          attackDamage: 0,
          moveSpeed: 0,
          attackRange: 0,
          expReward: Math.round(650 * Math.pow(structMult, 0.75)),
          zenReward: 3500,
          color: '#38bdf8',
          aiState: 'move',
          stateTimer: 1,
          telegraphX: 0,
          telegraphY: BC_STATUE_Y,
          facingAngle: 0,
          walkDistance: 0,
          hitFlashTimer: 0,
          chillTimer: 0,
          koTimer: 0,
          orbitDirection: 1,
        });

        // Populate all 36 dedicated Blood Castle Bridge monsters (each with its own 5s individual respawn!)
        const bcUnits = buildBloodCastleBridgeUnits(activeTerritoryId, pState.level);
        bcBlueprintsById = new Map(bcUnits.map((u) => [u.id, u]));
        for (const unit of bcUnits) {
          enemies.push(bcBlueprintToEnemyEntity(unit, true));
        }
        return;
      }

      hero.x = 0;
      hero.y = 48;

      // Populate individual per-unit blueprints for this territory (slightly spread out around each spot).
      // Any unit whose personal Server Game Time respawn timer hasn't expired stays dead with a countdown!
      const blueprints = buildTerritoryUnitBlueprints(activeTerritoryId);
      unitBlueprintsById = new Map(blueprints.map((u) => [u.id, u]));
      const savedDead = readOfflineDeadRespawns(activeTerritoryId);
      syncDeadRespawnMarkersFromRecord(savedDead);
      const nowGameSec = getWorldGameTimeSec();
      for (const unit of blueprints) {
        const respawnAt = savedDead[unit.id];
        if (respawnAt && respawnAt > nowGameSec) {
          continue;
        }
        enemies.push(blueprintToEnemyEntity(unit, true));
      }

      // Offline 15-minute Golden Boss initialization: spawn 1 Golden Boss for the current 15-minute slot
      // unless already slain during this slot (server-connected clients receive the authoritative boss from server.ts)
      if (!wsConnectedRef.current) {
        const bossSlotId = `boss_${activeTerritoryId}`;
        const currentBossSlot = getGoldenBossSlotIndex(nowGameSec);
        const savedBossRespawn = savedDead[bossSlotId];
        offlineBossLastSlotByTerritory.set(activeTerritoryId, currentBossSlot);
        if (!savedBossRespawn || savedBossRespawn <= nowGameSec) {
          spawnTerritoryBossLocal();
        }
      }
    };

    resetTerritoryArena(true);

    const findNearestLivingEnemy = (maxRange = 500): EnemyEntity | null => {
      let best: EnemyEntity | null = null;
      let bestDist = maxRange;
      for (const e of enemies) {
        if (e.aiState === 'ko') continue;
        if (activeInBloodCastle) {
          if (e.archetype === 'bc_gate' && bcStage === 'kill_100') continue;
          if (e.archetype === 'bc_statue' && bcStage !== 'destroy_statue') continue;
        }
        const d = Math.hypot(e.x - hero.x, e.y - hero.y);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
      return best;
    };

    let localChatBubbleText = '';
    let localChatBubbleExpiresAt = 0;
    let partySyncAccumulator = 0;
    const interpPartyPos = new Map<string, { x: number; y: number; moving: boolean }>();

    const spawnLootForKilledMonster = (
      dropX: number,
      dropY: number,
      isBoss: boolean,
      zenReward: number,
      isQuestMonster = false
    ) => {
      const pState = playerRef.current;
      const territoryIdx = Math.max(
        0,
        TERRITORIES.findIndex((t) => t.id === pState.territoryId)
      );
      const territory = TERRITORIES[territoryIdx] ?? TERRITORIES[0];

      const dropRateMult = SERVER_CONFIG.rates.dropChanceMultiplier;
      const nowWall = Date.now();
      const expiresAtMs = nowWall + GROUND_LOOT_TTL_MS;
      if (activeInBloodCastle) {
        if (Math.random() < Math.min(1, DROP_RATES.zen.bloodCastleMonsterChance * dropRateMult)) {
          lootDrops.push({
            id: `loot_zen_${nowWall}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'zen',
            label: `${zenReward} Zen`,
            x: dropX + (Math.random() * 24 - 12),
            y: dropY + (Math.random() * 24 - 12),
            amount: zenReward,
            rarityColor: '#facc15',
            spawnTime: nowWall,
            expiresAtMs,
          });
        }
        return;
      }

      if (
        (isBoss && DROP_RATES.zen.bossGuaranteed) ||
        Math.random() < Math.min(1, DROP_RATES.zen.regularMonsterChance * dropRateMult)
      ) {
        lootDrops.push({
          id: `loot_zen_${nowWall}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'zen',
          label: `${zenReward} Zen`,
          x: dropX + (Math.random() * 28 - 14),
          y: dropY + (Math.random() * 28 - 14),
          amount: zenReward,
          rarityColor: '#facc15',
          spawnTime: nowWall,
          expiresAtMs,
        });
        if (isAudibleAt(dropX, dropY)) {
          soundEngine.playZenDrop();
        }
      }

      const jewelRoll = Math.random();
      const jType = rollJewelDropType(territory.recommendedLevel, isBoss, jewelRoll);
      if (jType) {
        const jLabel =
          jType === 'jewel_bless'
            ? 'Jewel of Bless'
            : jType === 'jewel_soul'
              ? 'Jewel of Soul'
              : jType === 'jewel_life'
                ? 'Jewel of Life'
                : 'Jewel of Chaos';
        lootDrops.push({
          id: `loot_jewel_${nowWall}_${Math.random().toString(36).slice(2, 6)}`,
          type: jType,
          label: jLabel,
          x: dropX + (Math.random() * 36 - 18),
          y: dropY + (Math.random() * 36 - 18),
          rarityColor: jType === 'jewel_life' ? '#34d399' : '#fbbf24',
          spawnTime: nowWall,
          expiresAtMs,
        });
        spawnFloatingText(dropX, dropY - 36, `✦ КАМЕНЬ: ${jLabel}!`, '#fbbf24', 1.2);
        if (isAudibleAt(dropX, dropY)) {
          soundEngine.playJewelDrop();
        }
      }

      const bcMat = rollBloodCastleMaterialDrop(isBoss, Math.random());
      if (bcMat) {
        const matLabel =
          bcMat === 'blood_scroll'
            ? '📜 Blood Scroll (Свиток Архангела)'
            : '🦴 Blood Fang (Клык Крови)';
        lootDrops.push({
          id: `loot_bc_${nowWall}_${Math.random().toString(36).slice(2, 6)}`,
          type: bcMat,
          label: matLabel,
          x: dropX + (Math.random() * 36 - 18),
          y: dropY + (Math.random() * 36 - 18),
          rarityColor: '#fb7185',
          spawnTime: nowWall,
          expiresAtMs,
        });
        spawnFloatingText(dropX, dropY - 44, `🩸 ${matLabel}!`, '#fb7185', 1.18);
        if (isAudibleAt(dropX, dropY)) {
          soundEngine.playJewelDrop();
        }
      }

      const equipChance = isBoss
        ? DROP_RATES.equipment.bossChance
        : Math.min(1, DROP_RATES.equipment.regularMonsterChance * dropRateMult);
      const equipDropCount = isBoss ? DROP_RATES.equipment.bossRareDropCount : 1;
      for (let dropIdx = 0; dropIdx < equipDropCount; dropIdx++) {
        if (!isBoss && Math.random() >= equipChance) continue;
        if (isBoss && dropIdx === 0 && Math.random() >= equipChance) continue;
        const eq = generateEquipmentDrop(pState.classId, territoryIdx, isBoss);
        const eqColor =
          eq.rarity === 'ancient'
            ? '#f59e0b'
            : eq.rarity === 'excellent'
              ? '#34d399'
              : eq.rarity === 'magic'
                ? '#38bdf8'
                : '#e7e5e4';
        const angle = dropIdx * 2.4 + Math.random() * 0.8;
        const spreadDist = isBoss ? 26 + dropIdx * 18 : 16;
        const lx = dropX + Math.cos(angle) * spreadDist;
        const ly = dropY + Math.sin(angle) * spreadDist;
        lootDrops.push({
          id: `loot_eq_${eq.id}_${dropIdx}`,
          type: 'equipment',
          label: `${eq.name} +${eq.level}`,
          x: lx,
          y: ly,
          equipment: eq,
          rarityColor: eqColor,
          spawnTime: nowWall,
          expiresAtMs,
        });
        spawnFloatingText(
          lx,
          ly - 48 - dropIdx * 16,
          `${isBoss ? '👑 РЕДКИЙ ТРОФЕЙ' : '✦ ТРОФЕЙ'}: ${eq.name} +${eq.level}!`,
          eqColor,
          isBoss ? 1.3 : 1.25
        );
        if (isAudibleAt(lx, ly)) {
          soundEngine.playEquipmentDrop(
            isBoss || eq.rarity === 'ancient' || eq.rarity === 'excellent'
          );
        }
      }

      const alreadyDroppedOnFloor = lootDrops.some((d) => d.type === 'quest_item');
      const questDropChance = isBoss
        ? DROP_RATES.firstProfessionQuestItem.bossChance
        : Math.min(1, DROP_RATES.firstProfessionQuestItem.questMonsterChance * dropRateMult);
      if (
        isQuestMonster &&
        pState.classTier === 1 &&
        !pState.hasFirstProfQuestItem &&
        !alreadyDroppedOnFloor &&
        Math.random() < questDropChance
      ) {
        const qName = getFirstProfQuestItemName(pState.classId);
        lootDrops.push({
          id: `loot_quest_${nowWall}`,
          type: 'quest_item',
          label: `★ КВЕСТ: ${qName}`,
          x: dropX,
          y: dropY - 12,
          rarityColor: '#f59e0b',
          spawnTime: nowWall,
          expiresAtMs,
        });
        spawnFloatingText(
          dropX,
          dropY - 60,
          `★ КВЕСТ-АЙТЕМ 1-Й ПРОФЫ: ${qName}!`,
          '#fde047',
          1.35
        );
        soundEngine.playLevelUp();
      }
    };

    const damageEnemy = (
      enemy: EnemyEntity,
      rawDamage: number,
      isHeavy: boolean,
      applyChill = false,
      fromRemoteAlly = false
    ) => {
      if (enemy.aiState === 'ko') return;

      // In Blood Castle, protect Castle Gates until 100 monsters are killed, and Statue until Gates are broken
      if (activeInBloodCastle) {
        if (enemy.archetype === 'bc_gate' && bcStage === 'kill_100') {
          spawnFloatingText(
            enemy.x,
            enemy.y - 60,
            `🛡️ Ворота запечатаны! Убейте 100 монстров на мосту (${bcBridgeKills}/${BC_TARGET_KILLS})`,
            '#fbbf24',
            1.1
          );
          return;
        }
        if (enemy.archetype === 'bc_statue' && bcStage !== 'destroy_statue') {
          spawnFloatingText(
            enemy.x,
            enemy.y - 60,
            '🛡️ Сначала сломайте Ворота Замка Крови!',
            '#38bdf8',
            1.1
          );
          return;
        }
      }

      const pState = playerRef.current;
      const territoryIdx = Math.max(
        0,
        TERRITORIES.findIndex((t) => t.id === pState.territoryId)
      );
      const territory = TERRITORIES[territoryIdx] ?? TERRITORIES[0];

      const derived = getCachedDerivedStats(pState);
      const monsterDefense = activeInBloodCastle
        ? Math.round(calculateTerritoryMonsterDefense(territory.enemyLevelMultiplier) * 0.45)
        : calculateTerritoryMonsterDefense(territory.enemyLevelMultiplier);
      const levelGap = activeInBloodCastle ? 0 : Math.max(0, territory.recommendedLevel - pState.level);
      const underLevelFactor = levelGap > 0 ? Math.max(0.42, 1 - levelGap * 0.015) : 1.0;
      const mitigatedRaw = Math.max(rawDamage * 0.16, rawDamage - monsterDefense) * underLevelFactor;

      const isDouble = Math.random() * 100 < derived.doubleDamageChance;
      const isCrit = Math.random() * 100 < derived.critChance;
      const mult = (isDouble ? 2.0 : 1.0) * (isCrit ? 1.65 : 1.0);
      const finalDamage = Math.max(1, Math.round(mitigatedRaw * mult));

      const isServerAuthoritativeZone = !activeInBloodCastle && wsConnectedRef.current;
      const isZoneHost = checkIsZoneHost();

      if (isServerAuthoritativeZone && !fromRemoteAlly) {
        // Optimistic client hit feedback; exact HP deduction and kill confirmation come from the Server!
        enemy.hp = Math.max(1, enemy.hp - finalDamage);
        enemy.hitFlashTimer = 0.065;
        if (applyChill && !enemy.isStructure) {
          enemy.chillTimer = 3.0;
        }
        if (!enemy.isStructure) {
          const angle = Math.atan2(enemy.y - hero.y, enemy.x - hero.x);
          const kb = enemy.isBoss ? 8 : isHeavy ? 26 : 14;
          const minX = -ARENA_HALF_SIZE + 40;
          const maxX = ARENA_HALF_SIZE - 40;
          enemy.x = Math.max(minX, Math.min(maxX, enemy.x + Math.cos(angle) * kb));
          enemy.y = Math.max(-ARENA_HALF_SIZE + 40, Math.min(ARENA_HALF_SIZE - 40, enemy.y + Math.sin(angle) * kb));
        }

        const label = isDouble
          ? `ДВОЙНОЙ ${finalDamage}!!`
          : isCrit
            ? `КРИТ ${finalDamage}!`
            : `${finalDamage}`;
        const col = isDouble ? '#34d399' : isCrit ? '#fbbf24' : '#ffffff';
        spawnFloatingText(
          enemy.x,
          enemy.y - enemy.radius,
          label,
          col,
          isDouble ? 1.32 : isCrit ? 1.2 : 1
        );
        if (isHeavy) {
          hitstopTimer = Math.max(hitstopTimer, 0.035);
          cameraTrauma = Math.min(1, cameraTrauma + 0.18);
        }
        spawnParticles(enemy.x, enemy.y, isHeavy ? 12 : 5, '#fbbf24', 40, 140, 3, 0.35);
        soundEngine.playHit(isHeavy, isDouble ? 'double' : isCrit ? 'crit' : 'normal');

        callbacksRef.current.onServerDamageMonster?.({
          enemyId: enemy.id,
          damage: finalDamage,
          isCrit,
          isDouble,
          isHeavy,
          applyChill,
          x: Math.round(enemy.x),
          y: Math.round(enemy.y),
        });
        return;
      }

      // Offline solo fallback or Blood Castle instance
      if (!isZoneHost) {
        enemy.hp = Math.max(1, enemy.hp - finalDamage);
      } else {
        enemy.hp = Math.max(0, enemy.hp - finalDamage);
      }
      enemy.hitFlashTimer = 0.065;
      if (applyChill && !enemy.isStructure) {
        enemy.chillTimer = 3.0;
      }

      if (!enemy.isStructure) {
        const angle = Math.atan2(enemy.y - hero.y, enemy.x - hero.x);
        const kb = enemy.isBoss ? 8 : isHeavy ? 26 : 14;
        const minX = activeInBloodCastle ? -BC_BRIDGE_HALF_WIDTH + 30 : -ARENA_HALF_SIZE + 40;
        const maxX = activeInBloodCastle ? BC_BRIDGE_HALF_WIDTH - 30 : ARENA_HALF_SIZE - 40;
        enemy.x = Math.max(minX, Math.min(maxX, enemy.x + Math.cos(angle) * kb));
        enemy.y = Math.max(-ARENA_HALF_SIZE + 40, Math.min(ARENA_HALF_SIZE - 40, enemy.y + Math.sin(angle) * kb));
      }

      const label = fromRemoteAlly
        ? `🤝 ${finalDamage}`
        : isDouble
          ? `ДВОЙНОЙ ${finalDamage}!!`
          : isCrit
            ? `КРИТ ${finalDamage}!`
            : `${finalDamage}`;
      const col = fromRemoteAlly
        ? '#6ee7b7'
        : isDouble
          ? '#34d399'
          : isCrit
            ? '#fbbf24'
            : '#ffffff';

      spawnFloatingText(
        enemy.x,
        enemy.y - enemy.radius,
        label,
        col,
        isDouble ? 1.32 : isCrit ? 1.2 : 1
      );

      if (enemy.hp <= 0) {
        enemy.aiState = 'ko';
        enemy.koTimer = 0.35;
        hitstopTimer = Math.max(hitstopTimer, enemy.isBoss ? 0.08 : 0.04);
        cameraTrauma = Math.min(1, cameraTrauma + (enemy.isBoss ? 0.65 : 0.25));
        spawnParticles(enemy.x, enemy.y, enemy.isBoss ? 28 : 16, enemy.color, 60, 220, 4, 0.55);
        if (isAudibleAt(enemy.x, enemy.y)) {
          soundEngine.playEnemyDeath(enemy.isBoss);
        }

        if (isZoneHost && !enemy.isStructure && activeInBloodCastle) {
          callbacksRef.current.onPartyBroadcastKill?.({
            enemyId: enemy.id,
            monsterName: enemy.name,
            isBoss: enemy.isBoss,
            expReward: enemy.expReward,
            zenReward: enemy.zenReward,
            x: Math.round(enemy.x),
            y: Math.round(enemy.y),
          });
        }

        if (activeInBloodCastle) {
          if (enemy.archetype === 'bc_gate') {
            bcStage = 'destroy_statue';
            spawnFloatingText(
              enemy.x,
              enemy.y - 55,
              '💥 ВОРОТА СЛОМАНЫ! ЭТАП 3/4: РАЗБЕЙТЕ ХРУСТАЛЬНУЮ СТАТУЮ!',
              '#fde047',
              1.35
            );
            soundEngine.playLevelUp();
          } else if (enemy.archetype === 'bc_statue') {
            bcStage = 'return_weapon';
            lootDrops.push({
              id: `loot_archangel_weapon_${Date.now()}`,
              type: 'archangel_weapon',
              label: '⚔️ Оружие Архангела (Divine Weapon)',
              x: enemy.x,
              y: enemy.y + 20,
              rarityColor: '#38bdf8',
              spawnTime: Date.now(),
            });
            spawnFloatingText(
              enemy.x,
              enemy.y - 60,
              '💎 СТАТУЯ РАЗБИТА! ПОДБЕРИТЕ ОРУЖИЕ АРХАНГЕЛА И НЕСИТЕ К АРХАНГЕЛУ В НАЧАЛО МОСТА!',
              '#38bdf8',
              1.35
            );
            soundEngine.playLevelUp();
          } else {
            bcBridgeKills += 1;
            // Register this individual Blood Castle monster for exact 5-second respawn!
            const bcBp = bcBlueprintsById.get(enemy.id);
            bcDeadRespawns.set(enemy.id, {
              id: enemy.id,
              name: enemy.name,
              x: bcBp ? bcBp.anchorX : (enemy.anchorX ?? enemy.x),
              y: bcBp ? bcBp.anchorY : (enemy.anchorY ?? enemy.y),
              respawnAtSec: bcElapsedSec + BLOOD_CASTLE_RESPAWN_DURATION_SEC,
            });
            if (bcStage === 'kill_100' && bcBridgeKills >= BC_TARGET_KILLS) {
              bcStage = 'break_gates';
              spawnFloatingText(
                hero.x,
                hero.y - 54,
                '🔥 100 МОНСТРОВ УБИТО! ЭТАП 2/4: СЛОМАЙТЕ ВОРОТА ЗАМКА НА СЕВЕРЕ МОСТА!',
                '#fde047',
                1.35
              );
              soundEngine.playLevelUp();
            }
          }

          if (!wsConnectedRef.current) {
            spawnLootForKilledMonster(enemy.x, enemy.y, false, enemy.zenReward, false);
          }
          callbacksRef.current.onEnemyKilled(enemy.expReward, false, false);
          return;
        }

        // Offline individual per-unit respawn stamp on continuous world game time
        const nowGameSec = getWorldGameTimeSec();
        const respawnSec = enemy.respawnDurationSec ?? 18;
        const respawnAt = enemy.isBoss
          ? getNextGoldenBossSpawnSec(nowGameSec)
          : Math.round((nowGameSec + respawnSec) * 100) / 100;
        deadUnitRespawns.set(enemy.id, {
          id: enemy.id,
          name: enemy.name,
          x: enemy.anchorX ?? enemy.campX ?? enemy.x,
          y: enemy.anchorY ?? enemy.campY ?? enemy.y,
          isBoss: enemy.isBoss,
          respawnAtGameTimeSec: respawnAt,
        });
        writeOfflineDeadRespawns(activeTerritoryId);

        if (enemy.isBoss) {
          bossSpawnedForTerritory = false;
        }

        spawnLootForKilledMonster(
          enemy.x,
          enemy.y,
          enemy.isBoss,
          enemy.zenReward,
          Boolean(enemy.isQuestMonster)
        );

        callbacksRef.current.onEnemyKilled(
          enemy.expReward,
          enemy.isBoss,
          enemy.isBoss && pState.territoryId === 'blood_castle'
        );
      } else {
        if (isHeavy) {
          hitstopTimer = Math.max(hitstopTimer, 0.035);
          cameraTrauma = Math.min(1, cameraTrauma + 0.18);
        }
        spawnParticles(enemy.x, enemy.y, isHeavy ? 12 : 5, '#fbbf24', 40, 140, 3, 0.35);
        soundEngine.playHit(isHeavy, isDouble ? 'double' : isCrit ? 'crit' : 'normal');
      }
    };

    const executePrimaryAttack = () => {
      if (hero.primaryCooldown > 0) {
        attackBufferTimer = 0.13;
        return;
      }
      const pState = playerRef.current;
      const derived = getCachedDerivedStats(pState);
      const hasWeapon = pState.equipped.weapon !== null;
      const isMelee = !hasWeapon || pState.classId === 'dark_knight';
      const reach = !hasWeapon ? 88 : isMelee ? 115 : 255;

      const nearest = findNearestLivingEnemy(isMelee ? 145 : 275);
      if (nearest) {
        hero.facingAngle = Math.atan2(nearest.y - hero.y, nearest.x - hero.x);
      }

      hero.primaryCooldown = !hasWeapon ? 0.36 : 0.4;
      hero.attackPhase = 'windup';
      hero.attackTimer = 0.25;
      hero.scaleX = 1.18;
      hero.scaleY = 0.84;

      const baseRoll =
        derived.minDamage + Math.random() * (derived.maxDamage - derived.minDamage);

      soundEngine.playAttack(
        !hasWeapon
          ? 'fist'
          : isMelee
            ? 'slash'
            : pState.classId === 'dark_wizard'
              ? 'magic'
              : 'arrow'
      );

      const vfxPattern: SkillDefinition['pattern'] = isMelee
        ? 'melee_arc'
        : pState.classId === 'dark_wizard'
          ? 'dark_beam'
          : 'triple_arrow';
      const vfxTargetX = nearest ? nearest.x : hero.x + Math.cos(hero.facingAngle) * reach;
      const vfxTargetY = nearest ? nearest.y : hero.y + Math.sin(hero.facingAngle) * reach;
      const vfxRadius = !hasWeapon ? 76 : isMelee ? 95 : 65;
      const vfxColor = !hasWeapon ? '#fbbf24' : CLASSES[pState.classId].accentColor;

      activeVfx.push({
        pattern: vfxPattern,
        x: hero.x,
        y: hero.y,
        targetX: vfxTargetX,
        targetY: vfxTargetY,
        angle: hero.facingAngle,
        radius: vfxRadius,
        color: vfxColor,
        elapsed: 0,
        duration: 0.24,
      });

      const hitEnemyIds: string[] = [];
      let hitCount = 0;
      for (const e of enemies) {
        if (e.aiState === 'ko') continue;
        const dist = Math.hypot(e.x - hero.x, e.y - hero.y);
        if (dist <= reach + e.radius) {
          const angleToEnemy = Math.atan2(e.y - hero.y, e.x - hero.x);
          const angleDiff = Math.abs(
            Math.atan2(Math.sin(angleToEnemy - hero.facingAngle), Math.cos(angleToEnemy - hero.facingAngle))
          );
          if (angleDiff <= (isMelee ? 1.25 : 0.65) || dist < 48) {
            hitEnemyIds.push(e.id);
            damageEnemy(e, baseRoll, false);
            hitCount++;
            if (!isMelee && hitCount >= 2) break;
          }
        }
      }

      callbacksRef.current.onPartyBroadcastAttack?.({
        x: Math.round(hero.x),
        y: Math.round(hero.y),
        targetX: Math.round(vfxTargetX),
        targetY: Math.round(vfxTargetY),
        facingAngle: hero.facingAngle,
        pattern: vfxPattern,
        skillColor: vfxColor,
        damage: Math.round(baseRoll),
        aoeRadius: vfxRadius,
        hitEnemyIds,
      });
    };

    const executeSkill = (skillIndex: number) => {
      const pState = playerRef.current;
      const cls = CLASSES[pState.classId];
      const skill = cls.skills[skillIndex];
      if (!skill) return;

      if (!pState.learnedSkills.includes(skill.id)) {
        spawnFloatingText(
          hero.x,
          hero.y - 28,
          `📚 Купите «${skill.bookName}» в Городе [I] (Ур.${skill.requiredLevel}, ${skill.bookPriceZen}z)!`,
          '#fbbf24',
          1.05
        );
        return;
      }

      if ((skill.requiredTier ?? 1) > pState.classTier) {
        spawnFloatingText(hero.x, hero.y - 28, 'Требуется 1-я Профессия (50 Ур.) [I]!', '#fbbf24', 1.05);
        return;
      }

      const cd = skillCooldowns[skill.id] ?? 0;
      if (cd > 0.05) {
        if (cd <= 0.14) bufferedSkillIdx = skillIndex;
        return;
      }

      if (hero.mp < skill.manaCost) {
        spawnFloatingText(hero.x, hero.y - 25, 'Недостаточно Маны!', '#38bdf8', 0.95);
        return;
      }

      hero.mp = Math.max(0, hero.mp - skill.manaCost);
      skillCooldowns[skill.id] = skill.cooldownSec;

      // Advance MU Combo 1 -> 2 -> 3 state machine
      let triggeredComboBlast = false;
      if (skillIndex === 0) {
        hero.comboStage = 1;
        hero.comboWindowTimer = 4.0;
      } else if (skillIndex === 1 && hero.comboStage === 1) {
        hero.comboStage = 2;
        hero.comboWindowTimer = 4.0;
      } else if (skillIndex === 2 && hero.comboStage === 2) {
        triggeredComboBlast = true;
        hero.comboStage = 0;
        hero.comboWindowTimer = 0;
      }

      const derived = getCachedDerivedStats(pState);
      const nearest = findNearestLivingEnemy(skill.range + 60);
      if (nearest) {
        hero.facingAngle = Math.atan2(nearest.y - hero.y, nearest.x - hero.x);
      }

      hero.scaleX = 0.84;
      hero.scaleY = 1.22;

      const isSelfCentered =
        skill.pattern === 'spin_aoe' ||
        skill.pattern === 'evil_spirits' ||
        skill.pattern === 'ground_slam' ||
        skill.pattern === 'combo_nova' ||
        skill.pattern === 'soul_supernova';

      const centerX = isSelfCentered
        ? hero.x
        : nearest
          ? nearest.x
          : hero.x + Math.cos(hero.facingAngle) * (skill.range * 0.65);

      const centerY = isSelfCentered
        ? hero.y
        : nearest
          ? nearest.y
          : hero.y + Math.sin(hero.facingAngle) * (skill.range * 0.65);

      activeVfx.push({
        pattern: skill.pattern,
        x: hero.x,
        y: hero.y,
        targetX: centerX,
        targetY: centerY,
        angle: hero.facingAngle,
        radius: skill.aoeRadius,
        color: skill.color,
        elapsed: 0,
        duration: 0.52,
      });

      if (triggeredComboBlast) {
        activeVfx.push({
          pattern: 'mu_combo_blast',
          x: hero.x,
          y: hero.y,
          targetX: hero.x,
          targetY: hero.y,
          angle: 0,
          radius: 230,
          color: '#38bdf8',
          elapsed: 0,
          duration: 0.65,
        });
        spawnFloatingText(hero.x, hero.y - 44, '⚡ MU COMBO BLAST (+55% УРОН)!', '#38bdf8', 1.38);
        soundEngine.playComboBlast();
      } else {
        soundEngine.playSkillCast(skill.pattern);
      }

      if (skill.pattern === 'guardian_buff') {
        const healAmt = Math.round(derived.maxHp * 0.25);
        hero.hp = Math.min(derived.maxHp, hero.hp + healAmt);
        spawnFloatingText(hero.x, hero.y - 30, `+${healAmt} ОЗ`, '#4ade80', 1.15);
      }

      const comboMult = triggeredComboBlast ? 1.55 : 1.0;
      const rawSkillDamage =
        (derived.minDamage + Math.random() * (derived.maxDamage - derived.minDamage)) *
        skill.damageMultiplier *
        comboMult;

      const hitAoe = triggeredComboBlast ? Math.max(skill.aoeRadius, 230) : skill.aoeRadius;
      const isIce = skill.pattern === 'ice_arrow';

      const hitEnemyIds: string[] = [];
      for (const e of enemies) {
        if (e.aiState === 'ko') continue;
        const d = Math.hypot(e.x - centerX, e.y - centerY);
        if (d <= hitAoe + e.radius) {
          hitEnemyIds.push(e.id);
          damageEnemy(e, rawSkillDamage, skillIndex >= 1 || triggeredComboBlast, isIce);
        }
      }

      callbacksRef.current.onPartyBroadcastAttack?.({
        x: Math.round(hero.x),
        y: Math.round(hero.y),
        targetX: Math.round(centerX),
        targetY: Math.round(centerY),
        facingAngle: hero.facingAngle,
        pattern: skill.pattern,
        skillColor: skill.color,
        damage: Math.round(rawSkillDamage),
        aoeRadius: hitAoe,
        hitEnemyIds,
      });
    };

    const executeHpPotion = (isAuto = false) => {
      if (hero.hpPotionCooldown > 0) return;
      const derived = getCachedDerivedStats(playerRef.current);
      if (hero.hp >= derived.maxHp) return;
      const consumed = callbacksRef.current.onConsumeHpPotion();
      if (consumed) {
        const potCfg = CHARACTER_SCALING.potions;
        hero.hpPotionCooldown = potCfg.hpCooldownSec;
        const healHp = potCfg.smallHpHeal;
        hero.hp = Math.min(derived.maxHp, hero.hp + healHp);
        spawnFloatingText(
          hero.x,
          hero.y - 28,
          `${isAuto ? 'АВТО 🧪 ' : '🧪 '}+${healHp} ОЗ`,
          '#fb7185',
          1.12
        );
        spawnParticles(hero.x, hero.y, 10, '#f43f5e', 30, 105, 3.2, 0.4);
        soundEngine.playPotion('hp');
      } else if (hero.noPotionWarnCooldown <= 0) {
        hero.noPotionWarnCooldown = 2.8;
        spawnFloatingText(
          hero.x,
          hero.y - 34,
          '⚠️ Нет Банок ОЗ! Купите в Лавке [B]',
          '#f43f5e',
          1.15
        );
      }
    };

    const executeLargeHpPotion = (isAuto = false) => {
      if (hero.hpPotionCooldown > 0) return;
      const derived = getCachedDerivedStats(playerRef.current);
      if (hero.hp >= derived.maxHp) return;
      const consumed = callbacksRef.current.onConsumeLargeHpPotion();
      if (consumed) {
        const potCfg = CHARACTER_SCALING.potions;
        hero.hpPotionCooldown = potCfg.hpCooldownSec;
        const healHp = potCfg.largeHpHeal;
        hero.hp = Math.min(derived.maxHp, hero.hp + healHp);
        spawnFloatingText(
          hero.x,
          hero.y - 30,
          `${isAuto ? 'АВТО 🍷 ' : '🍷 '}+${healHp} ОЗ (БОЛЬШ.)`,
          '#fda4af',
          1.22
        );
        spawnParticles(hero.x, hero.y, 16, '#fb7185', 36, 130, 3.8, 0.5);
        soundEngine.playPotion('hp');
      } else if (hero.noPotionWarnCooldown <= 0) {
        hero.noPotionWarnCooldown = 2.8;
        spawnFloatingText(
          hero.x,
          hero.y - 34,
          '⚠️ Нет Больших Банок ОЗ (+500)! Купите в Лавке [B]',
          '#fb7185',
          1.15
        );
      }
    };

    const executeMpPotion = (isAuto = false) => {
      if (hero.mpPotionCooldown > 0) return;
      const derived = getCachedDerivedStats(playerRef.current);
      if (hero.mp >= derived.maxMp) return;
      const consumed = callbacksRef.current.onConsumeMpPotion();
      if (consumed) {
        hero.mpPotionCooldown = CHARACTER_SCALING.potions.mpCooldownSec;
        const healMp = Math.round(derived.maxMp * 0.55);
        hero.mp = Math.min(derived.maxMp, hero.mp + healMp);
        spawnFloatingText(
          hero.x,
          hero.y - 28,
          `${isAuto ? 'АВТО 💧 ' : '💧 '}+${healMp} МН`,
          '#38bdf8',
          1.12
        );
        spawnParticles(hero.x, hero.y, 12, '#38bdf8', 30, 110, 3.5, 0.45);
        soundEngine.playPotion('mp');
      } else if (hero.noPotionWarnCooldown <= 0) {
        hero.noPotionWarnCooldown = 2.8;
        spawnFloatingText(
          hero.x,
          hero.y - 34,
          '⚠️ Нет Банок МН! Купите в Лавке [B]',
          '#38bdf8',
          1.15
        );
      }
    };

    const collectNearbyLoot = (magnetRadius = 180, isManual = false) => {
      const nowWall = Date.now();
      const remaining: LootDrop[] = [];
      for (const drop of lootDrops) {
        const graceUntil = localDropGraceUntil.get(drop.id) ?? 0;
        if (!isManual && nowWall < graceUntil) {
          remaining.push(drop);
          continue;
        }
        const d = Math.hypot(drop.x - hero.x, drop.y - hero.y);
        if (d <= magnetRadius) {
          localDropGraceUntil.delete(drop.id);
          if (drop.type === 'archangel_weapon') {
            bcHasArchangelWeapon = true;
            spawnFloatingText(
              hero.x,
              hero.y - 48,
              '⚔️ ВЫ ВЗЯЛИ ОРУЖИЕ АРХАНГЕЛА! ВЕРНИТЕСЬ В НАЧАЛО МОСТА К РАНЕНОМУ АРХАНГЕЛУ!',
              '#38bdf8',
              1.35
            );
            spawnParticles(drop.x, drop.y, 24, '#38bdf8', 50, 180, 4, 0.55);
            soundEngine.playLevelUp();
            continue;
          }

          if (wsConnectedRef.current && callbacksRef.current.onPartyPickupGroundItem) {
            // Online: request atomic server-side claim (prevents duplicates & applies party finder/random loot mode)
            const retryAfter = pendingServerPickupUntil.get(drop.id) ?? 0;
            if (nowWall >= retryAfter) {
              pendingServerPickupUntil.set(drop.id, nowWall + 600);
              callbacksRef.current.onPartyPickupGroundItem(drop.id);
            }
            remaining.push(drop);
            continue;
          }

          // Offline single-player fallback
          callbacksRef.current.onLootCollected(drop);
          spawnFloatingText(drop.x, drop.y - 12, `+${drop.label}`, drop.rarityColor, 1.05);
          spawnParticles(drop.x, drop.y, 8, drop.rarityColor, 30, 95, 3, 0.35);
          if (drop.type === 'zen') {
            soundEngine.playZenPickup();
          } else if (drop.type.startsWith('jewel_')) {
            soundEngine.playJewelDrop();
          } else {
            soundEngine.playLootPickup();
          }
        } else {
          remaining.push(drop);
        }
      }
      lootDrops = remaining;
    };

    const executeDash = () => {
      if (hero.dashCooldown > 0) return;
      hero.dashCooldown = 1.5;
      const dashDist = 140;
      const minX = activeInBloodCastle ? -BC_BRIDGE_HALF_WIDTH + 28 : -ARENA_HALF_SIZE + 40;
      const maxX = activeInBloodCastle ? BC_BRIDGE_HALF_WIDTH - 28 : ARENA_HALF_SIZE - 40;
      const minY = activeInBloodCastle
        ? bcStage === 'kill_100' || bcStage === 'break_gates'
          ? BC_GATE_Y + 58
          : BC_NORTH_END_Y + 40
        : -ARENA_HALF_SIZE + 40;
      const maxY = activeInBloodCastle ? BC_SOUTH_END_Y - 40 : ARENA_HALF_SIZE - 40;
      hero.x = Math.max(minX, Math.min(maxX, hero.x + Math.cos(hero.facingAngle) * dashDist));
      hero.y = Math.max(minY, Math.min(maxY, hero.y + Math.sin(hero.facingAngle) * dashDist));
      hero.moveTargetX = null;
      hero.moveTargetY = null;
      hero.scaleX = 0.82;
      hero.scaleY = 1.24;
      spawnParticles(hero.x, hero.y, 14, '#38bdf8', 50, 160, 3.5, 0.38);
      soundEngine.playDash();
    };

    const walkToShopNpc = () => {
      if (activeInBloodCastle) {
        spawnFloatingText(
          hero.x,
          hero.y - 34,
          '🩸 Вы в Blood Castle! Лавка Ханзо доступна в городе.',
          '#fbbf24',
          1.12
        );
        return;
      }
      const distToShop = Math.hypot(
        hero.x - npcBlacksmithHanzo.x,
        hero.y - npcBlacksmithHanzo.y
      );
      if (distToShop <= SHOP_INTERACT_RADIUS) {
        pendingShopOpen = false;
        callbacksRef.current.onOpenNpcModal('blacksmith_hanzo');
        return;
      }
      const inCity = Math.hypot(hero.x, hero.y) <= TOWN_SAFE_RADIUS + 180;
      if (!inCity) {
        spawnFloatingText(
          hero.x,
          hero.y - 34,
          '🔒 Вы далеко от города! Вернитесь в город к Лавке Ханзо.',
          '#fbbf24',
          1.12
        );
        return;
      }
      hero.moveTargetX = npcBlacksmithHanzo.x;
      hero.moveTargetY = npcBlacksmithHanzo.y + 28;
      pendingShopOpen = true;
      spawnFloatingText(
        hero.x,
        hero.y - 32,
        '🚶 Иду к Лавке Торговца Ханзо...',
        '#fde047',
        1.1
      );
    };

    engineActionsRef.current = {
      triggerPrimaryAttack: executePrimaryAttack,
      triggerSkill: executeSkill,
      triggerHpPotion: () => executeHpPotion(false),
      triggerLargeHpPotion: () => executeLargeHpPotion(false),
      triggerMpPotion: () => executeMpPotion(false),
      triggerPickupNearbyLoot: () => collectNearbyLoot(340, true),
      triggerDash: executeDash,
      walkToShopNpc,
      setJoystickVector: (dx, dy) => {
        joystickDx = dx;
        joystickDy = dy;
        if (Math.hypot(dx, dy) > 0.08) {
          hero.moveTargetX = null;
          hero.moveTargetY = null;
          pendingShopOpen = false;
        }
      },
      resetTerritoryArena,
      notifyStatusMessage: (text: string, color = '#fbbf24') => {
        spawnFloatingText(hero.x, hero.y - 34, text, color, 1.15);
      },
      teleportToCoordinates: (x: number, y: number, label?: string) => {
        hero.x = Math.max(-ARENA_HALF_SIZE + 60, Math.min(ARENA_HALF_SIZE - 60, x + 42));
        hero.y = Math.max(-ARENA_HALF_SIZE + 60, Math.min(ARENA_HALF_SIZE - 60, y + 32));
        hero.moveTargetX = null;
        hero.moveTargetY = null;
        pendingShopOpen = false;
        spawnParticles(hero.x, hero.y, 28, '#34d399', 60, 220, 4, 0.55);
        spawnFloatingText(
          hero.x,
          hero.y - 42,
          label ?? '⚡ ТЕЛЕПОРТ К СОЮЗНИКУ ПО ПАТИ!',
          '#34d399',
          1.25
        );
        soundEngine.playTeleport();
      },
      applyServerHeroVitals: (vitals: { x: number; y: number; hp: number; mp: number }) => {
        const derived = getCachedDerivedStats(playerRef.current);
        const clampedX = Math.max(
          -ARENA_HALF_SIZE + 60,
          Math.min(ARENA_HALF_SIZE - 60, Number.isFinite(vitals.x) ? vitals.x : 0)
        );
        const clampedY = Math.max(
          -ARENA_HALF_SIZE + 60,
          Math.min(ARENA_HALF_SIZE - 60, Number.isFinite(vitals.y) ? vitals.y : 220)
        );
        hero.moveTargetX = null;
        hero.moveTargetY = null;
        hero.vx = 0;
        hero.vy = 0;
        pendingShopOpen = false;

        if (Number.isFinite(vitals.hp) && vitals.hp > 0) {
          hero.x = clampedX;
          hero.y = clampedY;
          hero.hp = Math.max(1, Math.min(derived.maxHp, Math.round(vitals.hp)));
          hero.ghostHp = hero.hp;
        } else {
          // Safely respawn in city if last saved HP was 0 (or fresh character with sentinel 0)
          hero.x = clampedX;
          hero.y = clampedY;
          hero.hp = derived.maxHp;
          hero.ghostHp = derived.maxHp;
        }

        if (Number.isFinite(vitals.mp) && vitals.mp > 0) {
          hero.mp = Math.max(0, Math.min(derived.maxMp, Math.round(vitals.mp)));
        } else {
          hero.mp = derived.maxMp;
        }
      },
      getHeroRuntimeVitals: () => {
        const derived = getCachedDerivedStats(playerRef.current);
        return {
          x: Math.round(hero.x),
          y: Math.round(hero.y),
          hp: Math.max(0, Math.round(hero.hp)),
          maxHp: derived.maxHp,
          mp: Math.max(0, Math.round(hero.mp)),
          maxMp: derived.maxMp,
        };
      },
      applyRemotePartyAttack: (attack: PartyAttackEvent) => {
        const pState = playerRef.current;
        if (attack.inBloodCastle !== Boolean(pState.inBloodCastle)) return;
        if (!attack.inBloodCastle && attack.territoryId !== pState.territoryId) return;

        const vfxPattern: SkillDefinition['pattern'] =
          attack.pattern === 'primary' ? 'melee_arc' : attack.pattern;

        activeVfx.push({
          pattern: vfxPattern,
          x: attack.x,
          y: attack.y,
          targetX: attack.targetX,
          targetY: attack.targetY,
          angle: attack.facingAngle,
          radius: attack.aoeRadius,
          color: attack.skillColor,
          elapsed: 0,
          duration: 0.42,
        });

        // 125m proximity audio for remote player attacks & skills
        if (isAudibleAt(attack.x, attack.y)) {
          if (attack.pattern === 'primary') {
            soundEngine.playAttack(
              attack.classId === 'dark_knight'
                ? 'slash'
                : attack.classId === 'dark_wizard'
                  ? 'magic'
                  : 'arrow'
            );
          } else {
            soundEngine.playSkillCast(attack.pattern);
          }
        }

        // In regular territories with server-authoritative HP, HP deduction comes strictly from party:monster_hp / party:monster_killed
        if (!attack.inBloodCastle && wsConnectedRef.current) {
          return;
        }

        const explicitIdSet = new Set(attack.hitEnemyIds ?? []);
        for (const e of enemies) {
          if (e.aiState === 'ko') continue;
          const matchedById = explicitIdSet.has(e.id);
          const d = Math.hypot(e.x - attack.targetX, e.y - attack.targetY);
          if (matchedById || (explicitIdSet.size === 0 && d <= attack.aoeRadius + e.radius)) {
            damageEnemy(
              e,
              attack.damage,
              attack.aoeRadius >= 150,
              vfxPattern === 'ice_arrow',
              true
            );
          }
        }
      },
      applySharedZoneMonsters: (snapshot: PartyZoneMonsterSnapshot) => {
        const pState = playerRef.current;
        if (snapshot.inBloodCastle !== Boolean(pState.inBloodCastle)) return;
        if (!snapshot.inBloodCastle && snapshot.territoryId !== pState.territoryId) return;
        if (snapshot.hostId === partySelfIdRef.current) return;

        bossSpawnedForTerritory = snapshot.bossSpawnedForTerritory;
        if (snapshot.deadMonsterRespawns && !snapshot.inBloodCastle) {
          syncDeadRespawnMarkersFromRecord(snapshot.deadMonsterRespawns);
        }
        if (activeInBloodCastle) {
          const prevStage = bcStage;
          bcStage = snapshot.bcStage;
          bcBridgeKills = snapshot.bcBridgeKills;
          if (typeof snapshot.bcTimeRemainingSec === 'number') {
            bcTimeRemainingSec = Math.max(0, Math.min(BLOOD_CASTLE_TIME_LIMIT_SEC, snapshot.bcTimeRemainingSec));
          }
          if (
            prevStage !== 'return_weapon' &&
            bcStage === 'return_weapon' &&
            !bcHasArchangelWeapon &&
            !lootDrops.some((d) => d.type === 'archangel_weapon')
          ) {
            lootDrops.push({
              id: `loot_archangel_weapon_${Date.now()}`,
              type: 'archangel_weapon',
              label: '⚔️ Оружие Архангела (Divine Weapon)',
              x: 0,
              y: BC_STATUE_Y + 20,
              rarityColor: '#38bdf8',
              spawnTime: performance.now(),
            });
          }
        }

        const existingById = new Map<string, EnemyEntity>();
        for (const e of enemies) {
          existingById.set(e.id, e);
        }

        const nextEnemies: EnemyEntity[] = [];
        const incomingIds = new Set<string>();

        for (const sm of snapshot.monsters) {
          incomingIds.add(sm.id);
          sharedMonsterTargets.set(sm.id, { x: sm.x, y: sm.y });
          const existing = existingById.get(sm.id);
          if (existing) {
            if (Math.hypot(sm.x - existing.x, sm.y - existing.y) > 420 || existing.isStructure) {
              existing.x = sm.x;
              existing.y = sm.y;
            }
            existing.name = sm.name;
            existing.archetype = sm.archetype;
            existing.isBoss = sm.isBoss;
            existing.isStructure = sm.isStructure;
            existing.isQuestMonster = sm.isQuestMonster;
            existing.campX = sm.campX;
            existing.campY = sm.campY;
            existing.anchorX = sm.anchorX ?? existing.anchorX;
            existing.anchorY = sm.anchorY ?? existing.anchorY;
            existing.radius = sm.radius;
            existing.hp = sm.hp;
            existing.maxHp = sm.maxHp;
            existing.attackDamage = sm.attackDamage;
            existing.moveSpeed = sm.moveSpeed;
            existing.attackRange = sm.attackRange;
            existing.expReward = sm.expReward;
            existing.zenReward = sm.zenReward;
            existing.color = sm.color;
            existing.aiState = sm.aiState;
            existing.telegraphX = sm.telegraphX;
            existing.telegraphY = sm.telegraphY;
            existing.facingAngle = sm.facingAngle;
            existing.walkDistance = sm.walkDistance;
            existing.chillTimer = sm.chillTimer;
            existing.orbitDirection = sm.orbitDirection;
            nextEnemies.push(existing);
          } else {
            nextEnemies.push(sharedStateToEnemyEntity(sm));
          }
        }

        for (const e of enemies) {
          if (!incomingIds.has(e.id) && e.aiState === 'ko' && e.koTimer > 0) {
            nextEnemies.push(e);
          }
        }

        enemies = nextEnemies;
      },
      applyServerZoneMonstersInit: (payload) => {
        const pState = playerRef.current;
        if (payload.inBloodCastle !== Boolean(pState.inBloodCastle)) return;
        if (!payload.inBloodCastle && payload.territoryId !== pState.territoryId) return;
        if (payload.inBloodCastle) return;

        const blueprints = buildTerritoryUnitBlueprints(payload.territoryId);
        unitBlueprintsById = new Map(blueprints.map((u) => [u.id, u]));
        syncDeadRespawnMarkersFromRecord(payload.deadMonsterRespawns ?? {});
        writeOfflineDeadRespawns(payload.territoryId);

        const nextEnemies: EnemyEntity[] = [];
        let hasBoss = false;
        for (const sm of payload.monsters) {
          if (sm.isBoss) hasBoss = true;
          sharedMonsterTargets.set(sm.id, { x: sm.x, y: sm.y });
          nextEnemies.push(sharedStateToEnemyEntity(sm));
        }
        bossSpawnedForTerritory = hasBoss;
        enemies = nextEnemies;
      },
      applyServerMonsterHp: (event: ServerMonsterHpEvent) => {
        const pState = playerRef.current;
        if (event.inBloodCastle !== Boolean(pState.inBloodCastle)) return;
        if (!event.inBloodCastle && event.territoryId !== pState.territoryId) return;

        const target = enemies.find((e) => e.id === event.enemyId);
        if (!target || target.aiState === 'ko') return;

        target.hp = Math.max(0, Math.min(event.maxHp, event.hp));
        target.maxHp = event.maxHp;
        target.hitFlashTimer = 0.065;
        if (event.applyChill && !target.isStructure) {
          target.chillTimer = 3.0;
        }

        // Show remote ally's exact server-confirmed damage on the shared monster!
        if (event.attackerId !== partySelfIdRef.current) {
          const allyLabel = event.isDouble
            ? `🤝 ДВОЙНОЙ ${event.damage}!`
            : event.isCrit
              ? `🤝 КРИТ ${event.damage}`
              : `🤝 ${event.damage}`;
          spawnFloatingText(
            target.x,
            target.y - target.radius - 6,
            allyLabel,
            event.isDouble ? '#34d399' : event.isCrit ? '#fde047' : '#6ee7b7',
            event.isDouble ? 1.2 : 1.0
          );
          spawnParticles(target.x, target.y, 6, '#34d399', 35, 130, 3, 0.32);
        }
      },
      applyServerMonsterKilled: (event: ServerMonsterKilledEvent) => {
        const pState = playerRef.current;
        if (event.inBloodCastle !== Boolean(pState.inBloodCastle)) return;
        if (!event.inBloodCastle && event.territoryId !== pState.territoryId) return;

        const target = enemies.find((e) => e.id === event.enemyId);
        const dropX = target ? target.x : event.x;
        const dropY = target ? target.y : event.y;

        if (target && target.aiState !== 'ko') {
          target.hp = 0;
          target.aiState = 'ko';
          target.koTimer = 0.35;
          spawnParticles(
            dropX,
            dropY,
            event.isBoss ? 28 : 16,
            target.color,
            60,
            220,
            4,
            0.55
          );
          if (isAudibleAt(dropX, dropY)) {
            soundEngine.playEnemyDeath(event.isBoss);
          }
        } else {
          spawnParticles(dropX, dropY, event.isBoss ? 24 : 12, '#34d399', 50, 180, 3.8, 0.48);
          if (isAudibleAt(dropX, dropY)) {
            soundEngine.playEnemyDeath(event.isBoss);
          }
        }

        if (event.killerId === partySelfIdRef.current) {
          hitstopTimer = Math.max(hitstopTimer, event.isBoss ? 0.08 : 0.04);
          cameraTrauma = Math.min(1, cameraTrauma + (event.isBoss ? 0.65 : 0.25));
        }

        // Record this individual unit's exact Server Game Time respawn deadline!
        deadUnitRespawns.set(event.enemyId, {
          id: event.enemyId,
          name: event.monsterName,
          x: event.anchorX,
          y: event.anchorY,
          isBoss: event.isBoss,
          respawnAtGameTimeSec: event.respawnAtGameTimeSec,
        });
        writeOfflineDeadRespawns(activeTerritoryId);

        if (event.isBoss) {
          bossSpawnedForTerritory = false;
        }

        // When online, ground loot is generated authoritatively by server.ts (`party:ground_loot_spawned`)
        if (!wsConnectedRef.current) {
          spawnLootForKilledMonster(
            dropX,
            dropY,
            event.isBoss,
            event.zenReward,
            event.isQuestMonster
          );
        }
      },
      applyServerMonsterRespawned: (event: ServerMonsterRespawnedEvent) => {
        const pState = playerRef.current;
        if (event.inBloodCastle !== Boolean(pState.inBloodCastle)) return;
        if (!event.inBloodCastle && event.territoryId !== pState.territoryId) return;

        deadUnitRespawns.delete(event.monster.id);
        writeOfflineDeadRespawns(activeTerritoryId);

        const entity = sharedStateToEnemyEntity(event.monster);
        if (entity.isBoss) {
          const roamPt = pickGoldenBossRoamWaypoint(entity.x, entity.y);
          entity.roamTargetX = roamPt.x;
          entity.roamTargetY = roamPt.y;
        }
        sharedMonsterTargets.set(entity.id, { x: entity.x, y: entity.y });
        enemies = enemies.filter((e) => e.id !== entity.id);
        enemies.push(entity);

        spawnParticles(
          entity.x,
          entity.y,
          entity.isBoss ? 34 : 12,
          entity.isBoss ? '#facc15' : '#fbbf24',
          35,
          160,
          3.6,
          0.5
        );
        if (entity.isBoss) {
          bossSpawnedForTerritory = true;
          spawnFloatingText(
            entity.x,
            entity.y - 30,
            `👑 ВТОРЖЕНИЕ: ${entity.name}!`,
            '#facc15',
            1.3
          );
          if (isAudibleAt(entity.x, entity.y)) {
            soundEngine.playGoldenBossInvasion();
          }
        }
      },
      applyServerMonsterAttack: (event: ServerMonsterAttackEvent) => {
        const pState = playerRef.current;
        if (pState.inBloodCastle || event.territoryId !== pState.territoryId) return;
        if (hero.defeatBeatTimer > 0) return;
        const heroInSafe = Math.hypot(hero.x, hero.y) <= TOWN_SAFE_RADIUS;
        if (heroInSafe) return;

        const dist = Math.hypot(hero.x - event.hitCenterX, hero.y - event.hitCenterY);
        if (dist <= event.hitRadius) {
          const derived = getCachedDerivedStats(pState);
          const mitigated = Math.max(2, Math.round(event.attackDamage - derived.defense * 0.22));
          hero.hp = Math.max(0, hero.hp - mitigated);
          hero.hitFlashTimer = 0.08;
          cameraTrauma = Math.min(1, cameraTrauma + 0.28);
          spawnFloatingText(hero.x, hero.y - 24, `-${mitigated}`, '#f43f5e', 1.1);
          spawnParticles(hero.x, hero.y, 10, '#f43f5e', 40, 130, 3.5, 0.35);
          soundEngine.playPlayerHurt();
          if (hero.hp <= 0 && hero.defeatBeatTimer <= 0) {
            hero.defeatBeatTimer = 0.55;
          }
        }
      },
      applyRemoteSharedKill: (kill: PartyKillShareEvent) => {
        const pState = playerRef.current;
        if (kill.inBloodCastle !== Boolean(pState.inBloodCastle)) return;
        if (!kill.inBloodCastle && kill.territoryId !== pState.territoryId) return;

        let targetEnemy: EnemyEntity | undefined;
        if (kill.enemyId) {
          targetEnemy = enemies.find((e) => e.id === kill.enemyId);
        }
        if (!targetEnemy) {
          targetEnemy = enemies.find(
            (e) =>
              e.aiState !== 'ko' &&
              !e.isStructure &&
              Math.hypot(e.x - kill.x, e.y - kill.y) <= 220
          );
        }

        const dropX = targetEnemy ? targetEnemy.x : kill.x;
        const dropY = targetEnemy ? targetEnemy.y : kill.y;
        const isQuestMob = targetEnemy ? Boolean(targetEnemy.isQuestMonster) : kill.isBoss;

        if (targetEnemy && targetEnemy.aiState !== 'ko') {
          targetEnemy.hp = 0;
          targetEnemy.aiState = 'ko';
          targetEnemy.koTimer = 0.35;
          spawnParticles(
            dropX,
            dropY,
            kill.isBoss ? 28 : 16,
            targetEnemy.color,
            60,
            220,
            4,
            0.55
          );
          if (isAudibleAt(dropX, dropY)) {
            soundEngine.playEnemyDeath(kill.isBoss);
          }
        } else {
          spawnParticles(dropX, dropY, kill.isBoss ? 24 : 12, '#34d399', 50, 180, 3.8, 0.48);
          if (isAudibleAt(dropX, dropY)) {
            soundEngine.playEnemyDeath(kill.isBoss);
          }
        }

        if (!wsConnectedRef.current) {
          spawnLootForKilledMonster(
            dropX,
            dropY,
            kill.isBoss,
            Math.max(40, Math.round(kill.zenShare * 1.8)),
            isQuestMob
          );
        }
      },
      dropEquipmentOnGround: (item: EquipmentItem): LootDrop => {
        const nowWall = Date.now();
        const dropOffset = 52;
        const rawX = hero.x + Math.cos(hero.facingAngle) * dropOffset + (Math.random() * 18 - 9);
        const rawY = hero.y + Math.sin(hero.facingAngle) * dropOffset + (Math.random() * 18 - 9);
        const minX = activeInBloodCastle ? -BC_BRIDGE_HALF_WIDTH + 34 : -ARENA_HALF_SIZE + 50;
        const maxX = activeInBloodCastle ? BC_BRIDGE_HALF_WIDTH - 34 : ARENA_HALF_SIZE - 50;
        const minY = activeInBloodCastle ? BC_NORTH_END_Y + 50 : -ARENA_HALF_SIZE + 50;
        const maxY = activeInBloodCastle ? BC_SOUTH_END_Y - 50 : ARENA_HALF_SIZE - 50;
        const clampedX = Math.max(minX, Math.min(maxX, rawX));
        const clampedY = Math.max(minY, Math.min(maxY, rawY));

        const drop = createEquipmentGroundDrop(
          item,
          clampedX,
          clampedY,
          localNicknameRef.current,
          nowWall
        );
        lootDrops.push(drop);
        // Prevent immediate auto-pickup right after dropping so player can leave it for allies
        localDropGraceUntil.set(drop.id, nowWall + 2600);
        spawnParticles(clampedX, clampedY, 14, drop.rarityColor, 30, 120, 3.5, 0.48);
        spawnFloatingText(
          clampedX,
          clampedY - 26,
          `⬇️ Выброшено: ${drop.label}`,
          drop.rarityColor,
          1.12
        );
        return drop;
      },
      syncServerGroundLoot: (drops: LootDrop[]) => {
        const nowWall = Date.now();
        const nextDrops: LootDrop[] = [];
        const seenIds = new Set<string>();
        // Keep Archangel weapon if active in Blood Castle
        for (const existing of lootDrops) {
          if (existing.type === 'archangel_weapon') {
            nextDrops.push(existing);
            seenIds.add(existing.id);
          }
        }
        for (const d of drops) {
          if (!d || typeof d.id !== 'string' || seenIds.has(d.id)) continue;
          if (isGroundLootExpired(d, nowWall)) continue;
          nextDrops.push({
            ...d,
            spawnTime: d.spawnTime || nowWall,
            expiresAtMs: d.expiresAtMs || nowWall + GROUND_LOOT_TTL_MS,
          });
          seenIds.add(d.id);
        }
        lootDrops = nextDrops;
      },
      addServerGroundLootBatch: (drops: LootDrop[]) => {
        const nowWall = Date.now();
        const existingIds = new Set(lootDrops.map((d) => d.id));
        let playedZen = false;
        let playedJewel = false;
        let playedEquip = false;
        for (const d of drops) {
          if (!d || typeof d.id !== 'string' || existingIds.has(d.id)) continue;
          if (isGroundLootExpired(d, nowWall)) continue;
          lootDrops.push({
            ...d,
            spawnTime: d.spawnTime || nowWall,
            expiresAtMs: d.expiresAtMs || nowWall + GROUND_LOOT_TTL_MS,
          });
          existingIds.add(d.id);

          const audible = isAudibleAt(d.x, d.y);
          if (d.type === 'zen') {
            if (audible && !playedZen) {
              soundEngine.playZenDrop();
              playedZen = true;
            }
          } else if (d.type.startsWith('jewel_')) {
            spawnFloatingText(d.x, d.y - 36, `✦ КАМЕНЬ: ${d.label}!`, d.rarityColor, 1.2);
            if (audible && !playedJewel) {
              soundEngine.playJewelDrop();
              playedJewel = true;
            }
          } else if (d.type === 'blood_scroll' || d.type === 'blood_fang') {
            spawnFloatingText(d.x, d.y - 42, `🩸 ${d.label}!`, d.rarityColor, 1.18);
            if (audible && !playedJewel) {
              soundEngine.playJewelDrop();
              playedJewel = true;
            }
          } else if (d.type === 'equipment') {
            const isRare =
              d.equipment?.rarity === 'ancient' || d.equipment?.rarity === 'excellent';
            spawnFloatingText(d.x, d.y - 46, `✦ ТРОФЕЙ: ${d.label}!`, d.rarityColor, 1.22);
            if (audible && !playedEquip) {
              soundEngine.playEquipmentDrop(Boolean(isRare));
              playedEquip = true;
            }
          } else if (d.type === 'quest_item') {
            spawnFloatingText(d.x, d.y - 54, `${d.label}!`, '#f59e0b', 1.32);
            if (audible) {
              soundEngine.playLevelUp();
            }
          }
        }
      },
      addRemoteGroundLoot: (drop: LootDrop) => {
        if (!drop || typeof drop.id !== 'string') return;
        const nowWall = Date.now();
        if (isGroundLootExpired(drop, nowWall)) return;
        if (lootDrops.some((d) => d.id === drop.id)) return;
        lootDrops.push({
          ...drop,
          spawnTime: drop.spawnTime || nowWall,
          expiresAtMs: drop.expiresAtMs || nowWall + GROUND_LOOT_TTL_MS,
        });
        spawnParticles(drop.x, drop.y, 12, drop.rarityColor, 28, 110, 3.2, 0.45);
        spawnFloatingText(
          drop.x,
          drop.y - 26,
          `🎁 ${drop.droppedByNickname ? `${drop.droppedByNickname}: ` : ''}${drop.label}`,
          drop.rarityColor,
          1.12
        );
        if (isAudibleAt(drop.x, drop.y)) {
          soundEngine.playEquipmentDrop(false);
        }
      },
      removeRemoteGroundLoot: (
        dropId: string,
        pickerNickname?: string,
        recipientNickname?: string,
        lootMode?: PartyLootMode
      ) => {
        const target = lootDrops.find((d) => d.id === dropId);
        pendingServerPickupUntil.delete(dropId);
        if (!target) return;
        lootDrops = lootDrops.filter((d) => d.id !== dropId);
        localDropGraceUntil.delete(dropId);
        spawnParticles(target.x, target.y, 8, target.rarityColor, 26, 90, 3, 0.32);
        if (pickerNickname) {
          const text =
            lootMode === 'random' && recipientNickname && recipientNickname !== pickerNickname
              ? `🎲 ${target.label} → ${recipientNickname}`
              : `🤝 ${pickerNickname} поднял ${target.label}`;
          spawnFloatingText(target.x, target.y - 18, text, '#5eead4', 1.02);
          if (isAudibleAt(target.x, target.y)) {
            soundEngine.playLootPickup();
          }
        }
      },
      setLocalChatBubble: (text: string) => {
        localChatBubbleText = text;
        localChatBubbleExpiresAt = Date.now() + 6500;
      },
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'playing') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        keysPressed.clear();
        return;
      }
      const code = e.code;
      const wasHeld = keysPressed.has(code);
      keysPressed.add(code);

      if (!wasHeld) {
        if (code === 'Space') {
          e.preventDefault();
          executePrimaryAttack();
        } else if (code === 'Digit1') {
          executeSkill(0);
        } else if (code === 'Digit2') {
          executeSkill(1);
        } else if (code === 'Digit3') {
          executeSkill(2);
        } else if (code === 'Digit4') {
          executeSkill(3);
        } else if (code === 'KeyQ') {
          executeHpPotion(false);
        } else if (code === 'KeyZ') {
          executeLargeHpPotion(false);
        } else if (code === 'KeyE') {
          executeMpPotion(false);
        } else if (code === 'KeyF') {
          collectNearbyLoot(340, true);
        } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
          executeDash();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };

    const clearInputsOnBlur = () => {
      keysPressed.clear();
      joystickDx = 0;
      joystickDy = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearInputsOnBlur);

    const handleCanvasPointerDown = (e: PointerEvent) => {
      if (phaseRef.current !== 'playing') return;
      const { wx, wy } = screenToWorld(e.clientX, e.clientY);

      if (activeInBloodCastle) {
        if (Math.hypot(wx - BC_ARCHANGEL_X, wy - BC_ARCHANGEL_Y) <= 68) {
          hero.moveTargetX = BC_ARCHANGEL_X;
          hero.moveTargetY = BC_ARCHANGEL_Y - 35;
          if (bcStage !== 'return_weapon' || !bcHasArchangelWeapon) {
            spawnFloatingText(
              BC_ARCHANGEL_X,
              BC_ARCHANGEL_Y - 48,
              '👼 Раненый Архангел: «Убей 100 монстров, сломай Ворота, разбей Статую и верни моё Оружие!»',
              '#fde047',
              1.1
            );
          }
          return;
        }
      } else {
        // Check if user tapped on any of the 4 City Sanctuary NPCs
        if (Math.hypot(wx - npcChaosGoblin.x, wy - npcChaosGoblin.y) <= npcChaosGoblin.radius + 16) {
          callbacksRef.current.onOpenNpcModal('chaos_goblin');
          return;
        }
        if (Math.hypot(wx - npcPriestessSevina.x, wy - npcPriestessSevina.y) <= npcPriestessSevina.radius + 16) {
          callbacksRef.current.onOpenNpcModal('priestess_sevina');
          return;
        }
        if (Math.hypot(wx - npcBlacksmithHanzo.x, wy - npcBlacksmithHanzo.y) <= npcBlacksmithHanzo.radius + 28) {
          walkToShopNpc();
          return;
        }
        if (Math.hypot(wx - npcPortalGuard.x, wy - npcPortalGuard.y) <= npcPortalGuard.radius + 16) {
          callbacksRef.current.onOpenNpcModal('portal_guard');
          return;
        }
      }

      // Check if user tapped directly on a ground loot drop (click-to-pickup!)
      for (const drop of lootDrops) {
        if (Math.hypot(drop.x - wx, drop.y - wy) <= 32) {
          const distToHero = Math.hypot(drop.x - hero.x, drop.y - hero.y);
          if (distToHero <= 125) {
            localDropGraceUntil.delete(drop.id);
            collectNearbyLoot(140, true);
          } else {
            localDropGraceUntil.delete(drop.id);
            hero.moveTargetX = drop.x;
            hero.moveTargetY = drop.y;
          }
          return;
        }
      }

      // Check if user tapped directly on an enemy
      for (const enemy of enemies) {
        if (enemy.aiState === 'ko') continue;
        if (Math.hypot(enemy.x - wx, enemy.y - wy) <= enemy.radius + 24) {
          hero.facingAngle = Math.atan2(enemy.y - hero.y, enemy.x - hero.x);
          executePrimaryAttack();
          return;
        }
      }

      hero.moveTargetX = Math.max(-ARENA_HALF_SIZE + 40, Math.min(ARENA_HALF_SIZE - 40, wx));
      hero.moveTargetY = Math.max(-ARENA_HALF_SIZE + 40, Math.min(ARENA_HALF_SIZE - 40, wy));
    };

    canvas.addEventListener('pointerdown', handleCanvasPointerDown);

    // 60Hz Main Animation Loop with after-draw frame scheduling
    let lastTime = performance.now();
    let hudSyncAccumulator = 0;
    let lastHudSignature = '';
    let lastHpScale = '';
    let lastGhostScale = '';
    let lastHpText = '';
    let lastMpScale = '';
    let lastMpText = '';
    let lastAgScale = '';
    let lastAgText = '';
    let lastCoordsText = '';
    let lastVignetteOpacity = '';
    let animFrameId = 0;
    let disposed = false;

    const tick = (now: number) => {
      if (disposed) return;

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      if (
        playerRef.current.territoryId !== activeTerritoryId ||
        playerRef.current.inBloodCastle !== activeInBloodCastle
      ) {
        resetTerritoryArena(true);
      }

      const currentPhase = phaseRef.current;
      const pState = playerRef.current;
      const derived = getCachedDerivedStats(pState);
      const territory =
        TERRITORIES.find((t) => t.id === pState.territoryId) ?? TERRITORIES[0];

      if (hitstopTimer > 0) {
        hitstopTimer = Math.max(0, hitstopTimer - dt);
      }
      cameraTrauma = Math.max(0, cameraTrauma - dt * 1.9);

      const simDt = currentPhase === 'playing' ? (hitstopTimer > 0 ? 0 : dt) : 0;

      // Detect Hero Level-Up from any source (solo kill, server kill, party kill, quest) and trigger Classic MU Level-Up VFX!
      if (
        currentPhase === 'playing' &&
        pState.resets === lastObservedResets &&
        pState.level > lastObservedHeroLevel
      ) {
        const levelsUp = pState.level - lastObservedHeroLevel;
        const ptsPerLvl = pState.classTier === 3 ? 7 : pState.classTier === 2 ? 6 : 5;
        levelUpEffects.push({
          elapsed: 0,
          duration: 1.9,
          newLevel: pState.level,
        });
        // Classic MU Online: Full HP & MP restoration upon leveling up
        hero.hp = derived.maxHp;
        hero.ghostHp = derived.maxHp;
        hero.mp = derived.maxMp;
        cameraTrauma = Math.min(0.45, cameraTrauma + 0.22);

        // 36 Ascending Golden & Radiant White Sparkle Particles around the Hero
        for (let i = 0; i < 36; i++) {
          const p = particles[particleCursor];
          particleCursor = (particleCursor + 1) % MAX_PARTICLES;
          const angle = (i / 36) * Math.PI * 2 + Math.random() * 0.25;
          const dist = 10 + Math.random() * 44;
          p.active = true;
          p.x = hero.x + Math.cos(angle) * dist;
          p.y = hero.y + Math.sin(angle) * dist * 0.55;
          p.vx = Math.cos(angle) * 28;
          p.vy = -75 - Math.random() * 135;
          p.size = 2.4 + Math.random() * 3.2;
          p.color = i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? '#fde047' : '#f59e0b';
          p.alpha = 1;
          p.life = 0;
          p.maxLife = 0.75 + Math.random() * 0.75;
        }

        spawnFloatingText(
          hero.x,
          hero.y - 68,
          `★ LEVEL UP! Ур. ${pState.level} (+${levelsUp * ptsPerLvl} статов)`,
          '#fde047',
          1.38
        );
      }
      lastObservedHeroLevel = pState.level;
      lastObservedResets = pState.resets;

      if (currentPhase === 'playing') {
        hero.primaryCooldown = Math.max(0, hero.primaryCooldown - dt);
        hero.dashCooldown = Math.max(0, hero.dashCooldown - dt);
        hero.hitFlashTimer = Math.max(0, hero.hitFlashTimer - dt);
        hero.hpPotionCooldown = Math.max(0, hero.hpPotionCooldown - dt);
        hero.mpPotionCooldown = Math.max(0, hero.mpPotionCooldown - dt);
        hero.noPotionWarnCooldown = Math.max(0, hero.noPotionWarnCooldown - dt);
        if (hero.attackTimer > 0) {
          hero.attackTimer = Math.max(0, hero.attackTimer - dt);
          if (hero.attackTimer <= 0) {
            hero.attackPhase = 'idle';
          } else if (hero.attackTimer < 0.14) {
            hero.attackPhase = 'active';
          }
        }
        if (hero.comboWindowTimer > 0) {
          hero.comboWindowTimer = Math.max(0, hero.comboWindowTimer - dt);
          if (hero.comboWindowTimer <= 0) {
            hero.comboStage = 0;
          }
        }

        Object.keys(skillCooldowns).forEach((k) => {
          skillCooldowns[k] = Math.max(0, skillCooldowns[k] - dt);
        });

        if (attackBufferTimer > 0) {
          attackBufferTimer = Math.max(0, attackBufferTimer - dt);
          if (hero.primaryCooldown <= 0) {
            attackBufferTimer = 0;
            executePrimaryAttack();
          }
        }

        if (bufferedSkillIdx !== null) {
          const sk = CLASSES[pState.classId].skills[bufferedSkillIdx];
          if (sk && (skillCooldowns[sk.id] ?? 0) <= 0.02) {
            const idx = bufferedSkillIdx;
            bufferedSkillIdx = null;
            executeSkill(idx);
          }
        }

        const inSanctuary = activeInBloodCastle
          ? hero.y >= BC_HERO_START_Y - 70
          : Math.hypot(hero.x, hero.y) <= TOWN_SAFE_RADIUS;
        if (inSanctuary) {
          hero.hp = Math.min(derived.maxHp, hero.hp + dt * 16);
          hero.mp = Math.min(derived.maxMp, hero.mp + dt * 15);
        } else {
          hero.mp = Math.min(derived.maxMp, hero.mp + dt * (1.1 + pState.attributes.ene * 0.03));
        }

        // Auto-Potion consumption when Auto-Hunt []] is enabled at Level 5+
        if (autoHuntRef.current && pState.level >= 5 && !inSanctuary) {
          const missingHp = derived.maxHp - hero.hp;
          if (hero.hp <= derived.maxHp * 0.62) {
            if (missingHp >= 420 && (pState.largeHpPotions ?? 0) > 0) {
              executeLargeHpPotion(true);
            } else if (pState.hpPotions > 0) {
              executeHpPotion(true);
            } else if ((pState.largeHpPotions ?? 0) > 0) {
              executeLargeHpPotion(true);
            }
          }
          if (hero.mp <= derived.maxMp * 0.35) {
            executeMpPotion(true);
          }
        }

        hero.ghostHp += (hero.hp - hero.ghostHp) * Math.min(1, dt * 4.5);
        collectNearbyLoot(activeInBloodCastle ? 115 : 72, false);

        // Prune expired ground loot (60s TTL) periodically so unattended drops never accumulate
        lootExpireCheckAccumulator += dt;
        if (lootExpireCheckAccumulator >= 0.5 && lootDrops.length > 0) {
          lootExpireCheckAccumulator = 0;
          const nowWall = Date.now();
          let expiredAny = false;
          for (let i = 0; i < lootDrops.length; i++) {
            const d = lootDrops[i];
            if (d.type !== 'archangel_weapon' && isGroundLootExpired(d, nowWall)) {
              expiredAny = true;
              break;
            }
          }
          if (expiredAny) {
            lootDrops = lootDrops.filter((d) => {
              if (d.type === 'archangel_weapon') return true;
              if (isGroundLootExpired(d, nowWall)) {
                localDropGraceUntil.delete(d.id);
                return false;
              }
              return true;
            });
          }
        }

        // Blood Castle 3-Minute Countdown Limit (180s)
        if (activeInBloodCastle && !bcTimeoutTriggered) {
          const step = advanceBloodCastleTimer(bcTimeRemainingSec, dt, bcStage === 'completed');
          bcTimeRemainingSec = step.nextRemainingSec;
          if (step.crossedOneMinuteMark) {
            spawnFloatingText(
              hero.x,
              hero.y - 52,
              '⏳ BLOOD CASTLE: ОСТАЛАСЬ 1 МИНУТА!',
              '#fbbf24',
              1.3
            );
          } else if (step.crossedThirtySecMark) {
            spawnFloatingText(
              hero.x,
              hero.y - 52,
              '⚠️ BLOOD CASTLE: ОСТАЛОСЬ 30 СЕКУНД!',
              '#f43f5e',
              1.35
            );
            soundEngine.playHit(true);
          }
          if (step.timedOut) {
            bcTimeoutTriggered = true;
            spawnFloatingText(
              hero.x,
              hero.y - 58,
              '⏰ ВРЕМЯ BLOOD CASTLE (3:00) ИСТЕКЛО! ВОЗВРАТ В ГОРОД...',
              '#f43f5e',
              1.4
            );
            soundEngine.playHit(true);
            callbacksRef.current.onBloodCastleTimeout?.();
          }
        }

        // Stage 4 Blood Castle Completion Check: Returning the Archangel Weapon to the Wounded Archangel at start of bridge
        if (
          activeInBloodCastle &&
          bcStage === 'return_weapon' &&
          bcHasArchangelWeapon &&
          Math.hypot(hero.x - BC_ARCHANGEL_X, hero.y - BC_ARCHANGEL_Y) <= 185
        ) {
          bcStage = 'completed';
          bcHasArchangelWeapon = false;
          spawnParticles(BC_ARCHANGEL_X, BC_ARCHANGEL_Y, 42, '#fde047', 65, 250, 4.5, 0.8);
          spawnFloatingText(
            BC_ARCHANGEL_X,
            BC_ARCHANGEL_Y - 56,
            '🏆 КВЕСТ BLOOD CASTLE ВЫПОЛНЕН! +3 JEWEL OF CHAOS И ОПЫТ!',
            '#fde047',
            1.4
          );
          soundEngine.playLevelUp();
          callbacksRef.current.onCompleteBloodCastleQuest();
        }
      }

      if (simDt > 0 && hero.defeatBeatTimer <= 0) {
        let moveX = joystickDx;
        let moveY = joystickDy;

        if (keysPressed.has('KeyW') || keysPressed.has('ArrowUp')) moveY -= 1;
        if (keysPressed.has('KeyS') || keysPressed.has('ArrowDown')) moveY += 1;
        if (keysPressed.has('KeyA') || keysPressed.has('ArrowLeft')) moveX -= 1;
        if (keysPressed.has('KeyD') || keysPressed.has('ArrowRight')) moveX += 1;

        if (Math.hypot(moveX, moveY) > 0.05) {
          hero.moveTargetX = null;
          hero.moveTargetY = null;
        } else if (hero.moveTargetX !== null && hero.moveTargetY !== null) {
          const dx = hero.moveTargetX - hero.x;
          const dy = hero.moveTargetY - hero.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 10) {
            hero.moveTargetX = null;
            hero.moveTargetY = null;
          } else {
            moveX = dx / dist;
            moveY = dy / dist;
          }
        } else if (autoHuntRef.current && pState.level >= 5) {
          // If inside Blood Castle and carrying the Archangel Weapon in Stage 4, auto-run back to the Wounded Archangel!
          if (activeInBloodCastle && bcStage === 'return_weapon' && bcHasArchangelWeapon) {
            const dx = BC_ARCHANGEL_X - hero.x;
            const dy = BC_ARCHANGEL_Y - hero.y;
            const d = Math.max(1, Math.hypot(dx, dy));
            moveX = dx / d;
            moveY = dy / d;
          } else {
            const archWeaponDrop = activeInBloodCastle
              ? lootDrops.find((d) => d.type === 'archangel_weapon')
              : undefined;
            const nearDrop =
              archWeaponDrop ??
              lootDrops.find((d) => Math.hypot(d.x - hero.x, d.y - hero.y) <= 240);
            const searchRadius = activeInBloodCastle ? 4800 : AUTO_HUNT_RADIUS;
            const nearEnemy = findNearestLivingEnemy(searchRadius);

            if (nearDrop) {
              const dx = nearDrop.x - hero.x;
              const dy = nearDrop.y - hero.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              moveX = dx / d;
              moveY = dy / d;
            } else if (nearEnemy) {
              const dx = nearEnemy.x - hero.x;
              const dy = nearEnemy.y - hero.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              const hasWeapon = pState.equipped.weapon !== null;
              const isMeleeCombat = !hasWeapon || pState.classId === 'dark_knight';
              const desiredDist = isMeleeCombat ? 74 : 175;
              if (d > desiredDist) {
                moveX = dx / d;
                moveY = dy / d;
              }
              hero.facingAngle = Math.atan2(dy, dx);
              if (d <= desiredDist + 55) {
                const skills = CLASSES[pState.classId].skills;
                const nextComboIdx = hero.comboStage === 0 ? 0 : hero.comboStage === 1 ? 1 : 2;
                const comboSk = skills[nextComboIdx];
                if (
                  comboSk &&
                  pState.learnedSkills.includes(comboSk.id) &&
                  (comboSk.requiredTier ?? 1) <= pState.classTier &&
                  (skillCooldowns[comboSk.id] ?? 0) <= 0.05 &&
                  hero.mp >= comboSk.manaCost
                ) {
                  executeSkill(nextComboIdx);
                } else {
                  const readySkillIdx = skills.findIndex(
                    (s) =>
                      pState.learnedSkills.includes(s.id) &&
                      (s.requiredTier ?? 1) <= pState.classTier &&
                      (skillCooldowns[s.id] ?? 0) <= 0.05 &&
                      hero.mp >= s.manaCost
                  );
                  if (readySkillIdx !== -1) {
                    executeSkill(readySkillIdx);
                  } else if (hero.primaryCooldown <= 0) {
                    executePrimaryAttack();
                  }
                }
              }
            }
          }
        }

        const moveMag = Math.hypot(moveX, moveY);
        if (moveMag > 0.05) {
          const nx = moveX / Math.max(1, moveMag);
          const ny = moveY / Math.max(1, moveMag);
          hero.vx = nx * derived.moveSpeed;
          hero.vy = ny * derived.moveSpeed;
          const minX = activeInBloodCastle ? -BC_BRIDGE_HALF_WIDTH + 28 : -ARENA_HALF_SIZE + 40;
          const maxX = activeInBloodCastle ? BC_BRIDGE_HALF_WIDTH - 28 : ARENA_HALF_SIZE - 40;
          const minY = activeInBloodCastle
            ? bcStage === 'kill_100' || bcStage === 'break_gates'
              ? BC_GATE_Y + 58
              : BC_NORTH_END_Y + 40
            : -ARENA_HALF_SIZE + 40;
          const maxY = activeInBloodCastle ? BC_SOUTH_END_Y - 40 : ARENA_HALF_SIZE - 40;
          hero.x = Math.max(minX, Math.min(maxX, hero.x + hero.vx * simDt));
          hero.y = Math.max(minY, Math.min(maxY, hero.y + hero.vy * simDt));
          hero.facingAngle = Math.atan2(ny, nx);
          hero.walkDistance += Math.hypot(hero.vx, hero.vy) * simDt;

          // Emit subtle glowing feather/wind glide trail when hovering & flying with Wings equipped
          if (pState.equipped.wings !== null) {
            wingTrailParticleTimer -= simDt;
            if (wingTrailParticleTimer <= 0) {
              wingTrailParticleTimer = 0.085;
              const trailColor =
                pState.classId === 'dark_knight'
                  ? '#f87171'
                  : pState.classId === 'dark_wizard'
                    ? '#38bdf8'
                    : '#34d399';
              spawnParticles(
                hero.x - nx * 16 + (Math.random() * 14 - 7),
                hero.y - ny * 16 - 12 + (Math.random() * 10 - 5),
                1,
                trailColor,
                12,
                38,
                2.8,
                0.38
              );
            }
          }
        } else {
          hero.vx = 0;
          hero.vy = 0;
        }

        hero.scaleX += (1 - hero.scaleX) * Math.min(1, simDt * 14);
        hero.scaleY += (1 - hero.scaleY) * Math.min(1, simDt * 14);

        if (
          !activeInBloodCastle &&
          pendingShopOpen &&
          Math.hypot(hero.x - npcBlacksmithHanzo.x, hero.y - npcBlacksmithHanzo.y) <=
            SHOP_INTERACT_RADIUS - 15
        ) {
          pendingShopOpen = false;
          hero.moveTargetX = null;
          hero.moveTargetY = null;
          callbacksRef.current.onOpenNpcModal('blacksmith_hanzo');
        }

        const isZoneHost = checkIsZoneHost();
        const sameZoneAllies = getSameZonePartyAllies(
          partyMembersRef.current ?? [],
          partySelfIdRef.current,
          activeTerritoryId,
          activeInBloodCastle
        );

        if (isZoneHost) {
          if (activeInBloodCastle && bcStage !== 'completed') {
            bcElapsedSec += simDt;

            // Individual 5-second respawn for each dedicated Blood Castle bridge unit!
            if (bcDeadRespawns.size > 0) {
              for (const [slotId, marker] of bcDeadRespawns.entries()) {
                if (bcElapsedSec >= marker.respawnAtSec) {
                  bcDeadRespawns.delete(slotId);
                  const bp = bcBlueprintsById.get(slotId);
                  if (bp) {
                    const revived = bcBlueprintToEnemyEntity(bp, true);
                    enemies = enemies.filter((e) => e.id !== revived.id);
                    enemies.push(revived);
                    spawnParticles(revived.x, revived.y, 12, '#f43f5e', 35, 130, 3.2, 0.42);
                  }
                }
              }
            }

            // Safety reconciliation every 0.5s: guarantee every bc_unit_* slot is either alive or in 5s respawn queue
            bcReconcileTimer -= simDt;
            if (bcReconcileTimer <= 0) {
              bcReconcileTimer = 0.5;
              if (bcBlueprintsById.size === 0) {
                const bcUnits = buildBloodCastleBridgeUnits(activeTerritoryId, pState.level);
                bcBlueprintsById = new Map(bcUnits.map((u) => [u.id, u]));
              }
              const aliveIds = new Set(
                enemies.filter((e) => e.aiState !== 'ko' && !e.isStructure).map((e) => e.id)
              );
              for (const [slotId, bp] of bcBlueprintsById.entries()) {
                if (!aliveIds.has(slotId) && !bcDeadRespawns.has(slotId)) {
                  const respawned = bcBlueprintToEnemyEntity(bp, true);
                  enemies = enemies.filter((e) => e.id !== respawned.id);
                  enemies.push(respawned);
                }
              }
            }
          } else if (!activeInBloodCastle && !wsConnectedRef.current) {
            // Offline fallback: revive individual dead units strictly when continuous world time reaches their own respawnAtGameTimeSec
            const nowGameSec = getWorldGameTimeSec();
            if (deadUnitRespawns.size > 0) {
              let changed = false;
              for (const [slotId, marker] of deadUnitRespawns.entries()) {
                if (nowGameSec >= marker.respawnAtGameTimeSec) {
                  deadUnitRespawns.delete(slotId);
                  changed = true;
                  if (!marker.isBoss) {
                    const bp = unitBlueprintsById.get(slotId);
                    if (bp) {
                      const revived = blueprintToEnemyEntity(bp, true);
                      enemies = enemies.filter((e) => e.id !== revived.id);
                      enemies.push(revived);
                      spawnParticles(revived.x, revived.y, 10, '#fbbf24', 30, 120, 3, 0.4);
                    }
                  }
                }
              }
              if (changed) {
                writeOfflineDeadRespawns(activeTerritoryId);
              }
            }

            // Offline 15-minute Golden Boss invasion scheduler (max 1 per territory; skip slot if still alive)
            const currentBossSlot = getGoldenBossSlotIndex(nowGameSec);
            const lastBossSlot =
              offlineBossLastSlotByTerritory.get(activeTerritoryId) ?? currentBossSlot;
            if (currentBossSlot > lastBossSlot) {
              offlineBossLastSlotByTerritory.set(activeTerritoryId, currentBossSlot);
              const bossStillAlive = enemies.some((e) => e.isBoss && e.aiState !== 'ko');
              if (!bossStillAlive) {
                deadUnitRespawns.delete(`boss_${activeTerritoryId}`);
                writeOfflineDeadRespawns(activeTerritoryId);
                spawnTerritoryBossLocal();
              }
            }
          }
        }

        // Self-healing safeguard: if online and any regular unit respawn marker is overdue by >2.5s,
        // request an authoritative zone refresh from the server (throttled to every 3s).
        if (!activeInBloodCastle && wsConnectedRef.current && deadUnitRespawns.size > 0) {
          const nowGameSec = getWorldGameTimeSec();
          let hasOverdueUnit = false;
          for (const marker of deadUnitRespawns.values()) {
            if (!marker.isBoss && nowGameSec - marker.respawnAtGameTimeSec > 2.5) {
              hasOverdueUnit = true;
              break;
            }
          }
          if (hasOverdueUnit && Date.now() - lastZoneResyncRequestMs > 3000) {
            lastZoneResyncRequestMs = Date.now();
            callbacksRef.current.onRequestZoneState?.();
          }
        }

        const heroInSafeTown = activeInBloodCastle
          ? hero.y >= BC_HERO_START_Y - 70
          : Math.hypot(hero.x, hero.y) <= TOWN_SAFE_RADIUS;
        let activeAttackers = enemies.filter(
          (e) => e.aiState === 'windup' || e.aiState === 'active'
        ).length;

        for (const e of enemies) {
          if (e.hitFlashTimer > 0) {
            e.hitFlashTimer = Math.max(0, e.hitFlashTimer - simDt);
          }
          if (e.chillTimer > 0) {
            e.chillTimer = Math.max(0, e.chillTimer - simDt);
          }

          if (e.aiState === 'ko') {
            e.koTimer -= simDt;
            continue;
          }

          if (e.isStructure) {
            continue;
          }

          const isServerDrivenWorld = !activeInBloodCastle && wsConnectedRef.current;

          // Server-authoritative world monsters (or remote Blood Castle Zone Host): smoothly interpolate coordinates at 60Hz
          if (!isZoneHost || isServerDrivenWorld) {
            const targetPos = sharedMonsterTargets.get(e.id);
            if (targetPos) {
              const lerpFactor = Math.min(1, simDt * 14);
              const prevX = e.x;
              const prevY = e.y;
              e.x += (targetPos.x - e.x) * lerpFactor;
              e.y += (targetPos.y - e.y) * lerpFactor;
              const moved = Math.hypot(e.x - prevX, e.y - prevY);
              if (moved > 0.15) {
                e.walkDistance += moved;
              }
            }
            if (!isServerDrivenWorld) {
              if (e.aiState === 'active') {
                e.stateTimer -= simDt;
                if (e.stateTimer > 0.12) {
                  e.stateTimer = 0.05; // Trigger local hit check once per remote Blood Castle attack swing
                  const hitCenterX = e.archetype === 'swarmer_skeleton' ? e.x : e.telegraphX;
                  const hitCenterY = e.archetype === 'swarmer_skeleton' ? e.y : e.telegraphY;
                  const hitRadius = e.isBoss ? 105 : e.archetype === 'kiter_lich' ? 68 : 62;
                  if (
                    !heroInSafeTown &&
                    Math.hypot(hero.x - hitCenterX, hero.y - hitCenterY) <= hitRadius
                  ) {
                    const mitigated = Math.max(
                      2,
                      Math.round(e.attackDamage - derived.defense * 0.22)
                    );
                    hero.hp = Math.max(0, hero.hp - mitigated);
                    hero.hitFlashTimer = 0.08;
                    cameraTrauma = Math.min(1, cameraTrauma + 0.28);
                    spawnFloatingText(hero.x, hero.y - 24, `-${mitigated}`, '#f43f5e', 1.1);
                    spawnParticles(hero.x, hero.y, 10, '#f43f5e', 40, 130, 3.5, 0.35);
                    soundEngine.playPlayerHurt();
                    if (hero.hp <= 0 && hero.defeatBeatTimer <= 0) {
                      hero.defeatBeatTimer = 0.55;
                    }
                  }
                }
              } else {
                e.stateTimer = 0.18;
              }
            }
            continue;
          }

          const chillMult = e.chillTimer > 0 ? 0.52 : 1.0;
          const effSpeed = e.moveSpeed * chillMult;

          // Co-op Multi-Player Aggro: Target whichever party member in the zone (hero or ally) is closest outside the Safe Town!
          let targetX = hero.x;
          let targetY = hero.y;
          let bestTargetDist = heroInSafeTown ? Infinity : Math.hypot(hero.x - e.x, hero.y - e.y);

          for (const ally of sameZoneAllies) {
            const allyInSafe = activeInBloodCastle
              ? ally.y >= BC_HERO_START_Y - 70
              : Math.hypot(ally.x, ally.y) <= TOWN_SAFE_RADIUS;
            if (allyInSafe) continue;
            const allyDist = Math.hypot(ally.x - e.x, ally.y - e.y);
            if (allyDist < bestTargetDist) {
              bestTargetDist = allyDist;
              targetX = ally.x;
              targetY = ally.y;
            }
          }

          const dx = targetX - e.x;
          const dy = targetY - e.y;
          const dist = Math.max(1, Math.hypot(dx, dy));

          const isAggroed =
            bestTargetDist <= (activeInBloodCastle ? 520 : e.isBoss ? 620 : MONSTER_AGGRO_RANGE);
          if (!isAggroed) {
            if (e.aiState === 'windup' || e.aiState === 'active') {
              e.aiState = 'move';
              e.stateTimer = 1.0;
            }
            if (e.isBoss && !activeInBloodCastle) {
              // Golden Boss actively roams across the wilderness map from waypoint to waypoint
              if (e.roamTargetX === undefined || e.roamTargetY === undefined) {
                const nextWp = pickGoldenBossRoamWaypoint(e.x, e.y);
                e.roamTargetX = nextWp.x;
                e.roamTargetY = nextWp.y;
              }
              const rdx = e.roamTargetX - e.x;
              const rdy = e.roamTargetY - e.y;
              const rDist = Math.hypot(rdx, rdy);
              if (rDist < 75) {
                const nextWp = pickGoldenBossRoamWaypoint(e.x, e.y);
                e.roamTargetX = nextWp.x;
                e.roamTargetY = nextWp.y;
              } else {
                const rnx = rdx / rDist;
                const rny = rdy / rDist;
                const roamSpd = effSpeed * 0.62;
                e.x += rnx * roamSpd * simDt;
                e.y += rny * roamSpd * simDt;
                e.facingAngle = Math.atan2(rny, rnx);
                e.walkDistance += roamSpd * simDt;
                // Keep Golden Boss safely outside the Town Safe Zone while wandering
                const townD = Math.hypot(e.x, e.y);
                if (townD < TOWN_SAFE_RADIUS + 90) {
                  const pushA = townD > 1 ? Math.atan2(e.y, e.x) : 0;
                  e.x = Math.cos(pushA) * (TOWN_SAFE_RADIUS + 95);
                  e.y = Math.sin(pushA) * (TOWN_SAFE_RADIUS + 95);
                  const detour = pickGoldenBossRoamWaypoint(e.x, e.y);
                  e.roamTargetX = detour.x;
                  e.roamTargetY = detour.y;
                }
              }
              continue;
            }
            const homeX = e.campX ?? e.x;
            const homeY = e.campY ?? e.y;
            const toCampX = homeX - e.x;
            const toCampY = homeY - e.y;
            const distFromCamp = Math.hypot(toCampX, toCampY);

            if (distFromCamp > 280) {
              const rnx = toCampX / distFromCamp;
              const rny = toCampY / distFromCamp;
              e.x += rnx * effSpeed * 0.7 * simDt;
              e.y += rny * effSpeed * 0.7 * simDt;
              e.facingAngle = Math.atan2(rny, rnx);
              e.walkDistance += effSpeed * 0.7 * simDt;
            } else {
              const patrolA = now * 0.0008 * e.orbitDirection + (e.campX ?? 0);
              const px = Math.cos(patrolA);
              const py = Math.sin(patrolA);
              e.x += px * effSpeed * 0.35 * simDt;
              e.y += py * effSpeed * 0.35 * simDt;
              e.facingAngle = Math.atan2(py, px);
              e.walkDistance += effSpeed * 0.35 * simDt;
            }
            if (activeInBloodCastle) {
              e.x = Math.max(-BC_BRIDGE_HALF_WIDTH + 28, Math.min(BC_BRIDGE_HALF_WIDTH - 28, e.x));
              e.y = Math.max(BC_GATE_Y + 60, Math.min(BC_HERO_START_Y - 110, e.y));
            }
            continue;
          }

          e.facingAngle = Math.atan2(dy, dx);

          if (e.aiState === 'move') {
            if (e.archetype === 'swarmer_skeleton') {
              if (dist > e.attackRange) {
                e.x += (dx / dist) * effSpeed * simDt;
                e.y += (dy / dist) * effSpeed * simDt;
                e.walkDistance += effSpeed * simDt;
              } else if (activeAttackers < MAX_CONCURRENT_ATTACKERS) {
                e.aiState = 'windup';
                e.stateTimer = 0.42;
                e.telegraphX = targetX;
                e.telegraphY = targetY;
                activeAttackers++;
              }
            } else if (e.archetype === 'kiter_lich') {
              if (dist < 115) {
                e.x -= (dx / dist) * effSpeed * 0.9 * simDt;
                e.y -= (dy / dist) * effSpeed * 0.9 * simDt;
                e.walkDistance += effSpeed * simDt;
              } else if (dist > e.attackRange) {
                e.x += (dx / dist) * effSpeed * simDt;
                e.y += (dy / dist) * effSpeed * simDt;
                e.walkDistance += effSpeed * simDt;
              } else {
                const perpX = (-dy / dist) * e.orbitDirection;
                const perpY = (dx / dist) * e.orbitDirection;
                e.x += perpX * effSpeed * 0.65 * simDt;
                e.y += perpY * effSpeed * 0.65 * simDt;
                e.stateTimer -= simDt;
                if (e.stateTimer <= 0 && activeAttackers < MAX_CONCURRENT_ATTACKERS) {
                  e.aiState = 'windup';
                  e.stateTimer = 0.55;
                  e.telegraphX = targetX;
                  e.telegraphY = targetY;
                  activeAttackers++;
                }
              }
            } else if (e.archetype === 'charger_bull') {
              if (dist > e.attackRange) {
                e.x += (dx / dist) * effSpeed * simDt;
                e.y += (dy / dist) * effSpeed * simDt;
                e.walkDistance += effSpeed * simDt;
              } else if (activeAttackers < MAX_CONCURRENT_ATTACKERS) {
                e.aiState = 'windup';
                e.stateTimer = 0.52;
                e.telegraphX = e.x + (dx / dist) * 185;
                e.telegraphY = e.y + (dy / dist) * 185;
                activeAttackers++;
              }
            } else {
              const perpX = (-dy / dist) * e.orbitDirection;
              const perpY = (dx / dist) * e.orbitDirection;
              const pull = dist > 135 ? 0.65 : -0.25;
              e.x += ((dx / dist) * pull + perpX * 0.75) * effSpeed * simDt;
              e.y += ((dy / dist) * pull + perpY * 0.75) * effSpeed * simDt;
              e.walkDistance += effSpeed * simDt;
              e.stateTimer -= simDt;
              if (e.stateTimer <= 0 && activeAttackers < MAX_CONCURRENT_ATTACKERS) {
                e.aiState = 'windup';
                e.stateTimer = 0.65;
                e.telegraphX = targetX;
                e.telegraphY = targetY;
                activeAttackers++;
              }
            }
          } else if (e.aiState === 'windup') {
            e.stateTimer -= simDt;
            if (e.stateTimer <= 0) {
              e.aiState = 'active';
              e.stateTimer = 0.18;

              if (e.archetype === 'charger_bull') {
                e.x = e.telegraphX;
                e.y = e.telegraphY;
              }

              const hitCenterX = e.archetype === 'swarmer_skeleton' ? e.x : e.telegraphX;
              const hitCenterY = e.archetype === 'swarmer_skeleton' ? e.y : e.telegraphY;
              const hitRadius = e.isBoss ? 105 : e.archetype === 'kiter_lich' ? 68 : 62;

              if (
                !heroInSafeTown &&
                Math.hypot(hero.x - hitCenterX, hero.y - hitCenterY) <= hitRadius
              ) {
                const mitigated = Math.max(
                  2,
                  Math.round(e.attackDamage - derived.defense * 0.22)
                );
                hero.hp = Math.max(0, hero.hp - mitigated);
                hero.hitFlashTimer = 0.08;
                cameraTrauma = Math.min(1, cameraTrauma + 0.28);
                spawnFloatingText(hero.x, hero.y - 24, `-${mitigated}`, '#f43f5e', 1.1);
                spawnParticles(hero.x, hero.y, 10, '#f43f5e', 40, 130, 3.5, 0.35);
                soundEngine.playPlayerHurt();

                if (hero.hp <= 0 && hero.defeatBeatTimer <= 0) {
                  hero.defeatBeatTimer = 0.55;
                }
              }
            }
          } else if (e.aiState === 'active') {
            e.stateTimer -= simDt;
            if (e.stateTimer <= 0) {
              e.aiState = 'recover';
              e.stateTimer = e.isBoss ? 0.95 : 0.85;
            }
          } else if (e.aiState === 'recover') {
            e.stateTimer -= simDt;
            if (e.stateTimer <= 0) {
              e.aiState = 'move';
              e.stateTimer = 1.1 + Math.random() * 0.6;
            }
          }

          if (activeInBloodCastle) {
            e.x = Math.max(-BC_BRIDGE_HALF_WIDTH + 28, Math.min(BC_BRIDGE_HALF_WIDTH - 28, e.x));
            e.y = Math.max(BC_GATE_Y + 60, Math.min(BC_HERO_START_Y - 105, e.y));
          } else {
            // Physically repel monsters from crossing the Town Safe Zone ward boundary
            const finalDistFromTown = Math.hypot(e.x, e.y);
            const minMonsterDist = TOWN_SAFE_RADIUS + 26;
            if (finalDistFromTown < minMonsterDist) {
              const pushA = finalDistFromTown > 1 ? Math.atan2(e.y, e.x) : 0;
              e.x = Math.cos(pushA) * minMonsterDist;
              e.y = Math.sin(pushA) * minMonsterDist;
            }
          }
        }

        enemies = enemies.filter((e) => !(e.aiState === 'ko' && e.koTimer <= 0));
      }

      if (hero.defeatBeatTimer > 0) {
        hero.defeatBeatTimer -= dt;
        if (hero.defeatBeatTimer <= 0) {
          const activeBoss = enemies.find((e) => e.isBoss && e.aiState !== 'ko');
          callbacksRef.current.onPlayerDefeated(activeBoss ? activeBoss.hp : 0);
        }
      }

      if (currentPhase === 'title') {
        const t = now * 0.00025;
        cameraX = Math.cos(t) * 140;
        cameraY = Math.sin(t) * 90;
      } else {
        cameraX += (hero.x - cameraX) * Math.min(1, dt * 8.5);
        cameraY += (hero.y - cameraY) * Math.min(1, dt * 8.5);
      }

      const shakeMag = cameraTrauma * cameraTrauma * 14;
      const shakeX = (Math.random() * 2 - 1) * shakeMag;
      const shakeY = (Math.random() * 2 - 1) * shakeMag;

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha = 1 - p.life / p.maxLife;
      }

      for (let i = 0; i < MAX_FLOATING_TEXTS; i++) {
        const ft = floatingTexts[i];
        if (!ft.active) continue;
        ft.life += dt;
        if (ft.life >= ft.maxLife) {
          ft.active = false;
          continue;
        }
        ft.y += ft.vy * dt;
      }

      for (let i = activeVfx.length - 1; i >= 0; i--) {
        activeVfx[i].elapsed += dt;
        if (activeVfx[i].elapsed >= activeVfx[i].duration) {
          activeVfx.splice(i, 1);
        }
      }

      for (let i = levelUpEffects.length - 1; i >= 0; i--) {
        levelUpEffects[i].elapsed += dt;
        if (levelUpEffects[i].elapsed >= levelUpEffects[i].duration) {
          levelUpEffects.splice(i, 1);
        }
      }

      // Direct 60Hz DOM Ref Mutations for Classic MU Crystal Globes, Purple AG Tube & Live Coordinates
      const hpRatio = Math.max(0, Math.min(1, hero.hp / Math.max(1, derived.maxHp)));
      const ghostRatio = Math.max(0, Math.min(1, hero.ghostHp / Math.max(1, derived.maxHp)));
      const mpRatio = Math.max(0, Math.min(1, hero.mp / Math.max(1, derived.maxMp)));
      const agRatio = Math.max(0, Math.min(1, 1 - hero.dashCooldown / 1.5));

      const hpScaleStr = `scaleY(${hpRatio.toFixed(3)})`;
      if (hpScaleStr !== lastHpScale && hudRefs.hpBarRef.current) {
        lastHpScale = hpScaleStr;
        hudRefs.hpBarRef.current.style.transform = hpScaleStr;
      }
      const ghostScaleStr = `scaleY(${ghostRatio.toFixed(3)})`;
      if (ghostScaleStr !== lastGhostScale && hudRefs.hpGhostBarRef.current) {
        lastGhostScale = ghostScaleStr;
        hudRefs.hpGhostBarRef.current.style.transform = ghostScaleStr;
      }
      const hpTextStr = `${Math.round(hero.hp)}`;
      if (hpTextStr !== lastHpText && hudRefs.hpTextRef.current) {
        lastHpText = hpTextStr;
        hudRefs.hpTextRef.current.textContent = hpTextStr;
      }
      const mpScaleStr = `scaleY(${mpRatio.toFixed(3)})`;
      if (mpScaleStr !== lastMpScale && hudRefs.mpBarRef.current) {
        lastMpScale = mpScaleStr;
        hudRefs.mpBarRef.current.style.transform = mpScaleStr;
      }
      const mpTextStr = `${Math.round(hero.mp)}`;
      if (mpTextStr !== lastMpText && hudRefs.mpTextRef.current) {
        lastMpText = mpTextStr;
        hudRefs.mpTextRef.current.textContent = mpTextStr;
      }
      const agScaleStr = `scaleY(${agRatio.toFixed(3)})`;
      if (agScaleStr !== lastAgScale && hudRefs.agBarRef?.current) {
        lastAgScale = agScaleStr;
        hudRefs.agBarRef.current.style.transform = agScaleStr;
      }
      const agTextStr = `${Math.round(agRatio * 100)}`;
      if (agTextStr !== lastAgText && hudRefs.agTextRef?.current) {
        lastAgText = agTextStr;
        hudRefs.agTextRef.current.textContent = agTextStr;
      }
      const mapCoordX = Math.max(0, Math.min(255, Math.round(((hero.x + ARENA_HALF_SIZE) / (ARENA_HALF_SIZE * 2)) * 255)));
      const mapCoordY = Math.max(0, Math.min(255, Math.round(((hero.y + ARENA_HALF_SIZE) / (ARENA_HALF_SIZE * 2)) * 255)));
      const coordsTextStr = `${mapCoordX} ${mapCoordY}`;
      if (coordsTextStr !== lastCoordsText && hudRefs.coordsTextRef?.current) {
        lastCoordsText = coordsTextStr;
        hudRefs.coordsTextRef.current.textContent = coordsTextStr;
      }
      const vignetteOpacityStr = hpRatio < 0.3 ? '1' : '0';
      if (vignetteOpacityStr !== lastVignetteOpacity && hudRefs.lowHpVignetteRef.current) {
        lastVignetteOpacity = vignetteOpacityStr;
        hudRefs.lowHpVignetteRef.current.style.opacity = vignetteOpacityStr;
      }

      const mm = hudRefs.minimapCanvasRef.current;
      if (mm) {
        const mctx = mm.getContext('2d');
        if (mctx) {
          const mw = mm.width;
          const mh = mm.height;
          mctx.clearRect(0, 0, mw, mh);
          mctx.fillStyle = '#0c0a12';
          mctx.fillRect(0, 0, mw, mh);

          if (activeInBloodCastle) {
            const toBcX = (wx: number) => mw / 2 + (wx / 1000) * (mw * 0.45);
            const toBcY = (wy: number) =>
              ((wy - BC_NORTH_END_Y) / (BC_SOUTH_END_Y - BC_NORTH_END_Y)) * mh;

            mctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
            mctx.strokeStyle = '#f43f5e';
            mctx.lineWidth = 1.2;
            mctx.fillRect(mw / 2 - 9, 4, 18, mh - 8);
            mctx.strokeRect(mw / 2 - 9, 4, 18, mh - 8);

            for (const e of enemies) {
              if (e.aiState === 'ko') continue;
              mctx.fillStyle = e.isStructure ? '#fde047' : '#fb7185';
              mctx.beginPath();
              mctx.arc(toBcX(e.x), toBcY(e.y), e.isStructure ? 3.5 : 1.8, 0, Math.PI * 2);
              mctx.fill();
            }

            // Wounded Archangel dot at south of bridge
            mctx.fillStyle = '#38bdf8';
            mctx.beginPath();
            mctx.arc(toBcX(BC_ARCHANGEL_X), toBcY(BC_ARCHANGEL_Y), 3, 0, Math.PI * 2);
            mctx.fill();

            // Online Party Allies in Blood Castle
            const bcAllies = partyMembersRef.current ?? [];
            for (const ally of bcAllies) {
              if (ally.id === partySelfIdRef.current || !ally.inBloodCastle) continue;
              mctx.fillStyle = '#2dd4bf';
              mctx.strokeStyle = '#ffffff';
              mctx.lineWidth = 1;
              mctx.beginPath();
              mctx.arc(toBcX(ally.x), toBcY(ally.y), 3.2, 0, Math.PI * 2);
              mctx.fill();
              mctx.stroke();
            }

            // Hero dot
            mctx.fillStyle = '#34d399';
            mctx.beginPath();
            mctx.arc(toBcX(hero.x), toBcY(hero.y), 3, 0, Math.PI * 2);
            mctx.fill();
          } else {
            const toMmX = (wx: number) => ((wx + ARENA_HALF_SIZE) / (ARENA_HALF_SIZE * 2)) * mw;
            const toMmY = (wy: number) => ((wy + ARENA_HALF_SIZE) / (ARENA_HALF_SIZE * 2)) * mh;

            // Minimap Rivers
            for (const river of activeMapLayout.rivers) {
              if (river.points.length < 2) continue;
              mctx.strokeStyle = '#38bdf8';
              mctx.lineWidth = 1.8;
              mctx.beginPath();
              river.points.forEach((pt, idx) => {
                if (idx === 0) mctx.moveTo(toMmX(pt.x), toMmY(pt.y));
                else mctx.lineTo(toMmX(pt.x), toMmY(pt.y));
              });
              mctx.stroke();
            }

            // Minimap Trails
            for (const trail of activeMapLayout.trails) {
              if (trail.points.length < 2) continue;
              mctx.strokeStyle = 'rgba(212, 168, 83, 0.45)';
              mctx.lineWidth = 1.2;
              mctx.beginPath();
              trail.points.forEach((pt, idx) => {
                if (idx === 0) mctx.moveTo(toMmX(pt.x), toMmY(pt.y));
                else mctx.lineTo(toMmX(pt.x), toMmY(pt.y));
              });
              mctx.stroke();
            }

            const mmCityRadius = (TOWN_SAFE_RADIUS / (ARENA_HALF_SIZE * 2)) * mw;
            mctx.fillStyle = 'rgba(52, 211, 153, 0.14)';
            mctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
            mctx.lineWidth = 1.2;
            mctx.beginPath();
            mctx.arc(mw / 2, mh / 2, mmCityRadius, 0, Math.PI * 2);
            mctx.fill();
            mctx.stroke();

            for (const camp of activeMapLayout.camps) {
              mctx.fillStyle = camp.isVip ? 'rgba(250, 204, 21, 0.25)' : 'transparent';
              mctx.strokeStyle = camp.isVip ? '#fde047' : 'rgba(244, 63, 94, 0.45)';
              mctx.lineWidth = camp.isVip ? 1.8 : 1.2;
              mctx.beginPath();
              mctx.arc(toMmX(camp.x), toMmY(camp.y), camp.isVip ? 7.5 : 6.2, 0, Math.PI * 2);
              if (camp.isVip) mctx.fill();
              mctx.stroke();
            }

            for (const d of lootDrops) {
              mctx.fillStyle = '#facc15';
              mctx.fillRect(toMmX(d.x) - 1, toMmY(d.y) - 1, 2.5, 2.5);
            }

            for (const e of enemies) {
              if (e.aiState === 'ko') continue;
              if (e.isBoss) {
                // Radiant pulsing Golden Boss marker on Minimap
                const bx = toMmX(e.x);
                const by = toMmY(e.y);
                mctx.fillStyle = '#facc15';
                mctx.strokeStyle = '#ffffff';
                mctx.lineWidth = 1.3;
                mctx.beginPath();
                mctx.arc(bx, by, 4.2, 0, Math.PI * 2);
                mctx.fill();
                mctx.stroke();
              } else {
                mctx.fillStyle = '#fb923c';
                mctx.beginPath();
                mctx.arc(toMmX(e.x), toMmY(e.y), 2, 0, Math.PI * 2);
                mctx.fill();
              }
            }

            // Online Party Allies on Territory Minimap
            const mapAllies = partyMembersRef.current ?? [];
            for (const ally of mapAllies) {
              if (
                ally.id === partySelfIdRef.current ||
                ally.inBloodCastle ||
                ally.territoryId !== pState.territoryId
              ) {
                continue;
              }
              mctx.fillStyle = '#2dd4bf';
              mctx.strokeStyle = '#ffffff';
              mctx.lineWidth = 1.1;
              mctx.beginPath();
              mctx.arc(toMmX(ally.x), toMmY(ally.y), 3.4, 0, Math.PI * 2);
              mctx.fill();
              mctx.stroke();
            }

            mctx.fillStyle = '#34d399';
            mctx.beginPath();
            mctx.arc(toMmX(hero.x), toMmY(hero.y), 3, 0, Math.PI * 2);
            mctx.fill();
          }
        }
      }

      // Throttled Online Party Hero Position, Vitality & Shared Zone Monsters Sync (~11Hz)
      partySyncAccumulator += dt;
      if (partySyncAccumulator >= 0.09) {
        partySyncAccumulator = 0;
        callbacksRef.current.onPartySyncHero?.({
          x: Math.round(hero.x),
          y: Math.round(hero.y),
          facingAngle: Math.round(hero.facingAngle * 100) / 100,
          walkDistance: Math.round(hero.walkDistance),
          hp: Math.max(0, Math.round(hero.hp)),
          maxHp: derived.maxHp,
          mp: Math.max(0, Math.round(hero.mp)),
          maxMp: derived.maxMp,
        });

        // Regular territories are simulated directly on the server; only Blood Castle instances sync from host.
        if (activeInBloodCastle && checkIsZoneHost()) {
          const livingMonsters = enemies
            .filter((e) => e.aiState !== 'ko')
            .map((e) => ({
              id: e.id,
              name: e.name,
              archetype: e.archetype,
              isBoss: e.isBoss,
              isStructure: Boolean(e.isStructure),
              isQuestMonster: Boolean(e.isQuestMonster),
              x: Math.round(e.x),
              y: Math.round(e.y),
              campX: e.campX !== undefined ? Math.round(e.campX) : Math.round(e.x),
              campY: e.campY !== undefined ? Math.round(e.campY) : Math.round(e.y),
              radius: e.radius,
              hp: Math.max(0, Math.round(e.hp)),
              maxHp: Math.max(1, Math.round(e.maxHp)),
              attackDamage: Math.round(e.attackDamage),
              moveSpeed: Math.round(e.moveSpeed),
              attackRange: Math.round(e.attackRange),
              expReward: Math.round(e.expReward),
              zenReward: Math.round(e.zenReward),
              color: e.color,
              aiState: e.aiState,
              telegraphX: Math.round(e.telegraphX),
              telegraphY: Math.round(e.telegraphY),
              facingAngle: Math.round(e.facingAngle * 100) / 100,
              walkDistance: Math.round(e.walkDistance),
              chillTimer: Math.round(e.chillTimer * 10) / 10,
              orbitDirection: (e.orbitDirection === -1 ? -1 : 1) as 1 | -1,
            }));

          callbacksRef.current.onPartySyncZoneMonsters?.({
            territoryId: activeTerritoryId,
            inBloodCastle: activeInBloodCastle,
            bossSpawnedForTerritory,
            bcStage,
            bcBridgeKills,
            bcTimeRemainingSec: activeInBloodCastle ? Math.ceil(bcTimeRemainingSec) : undefined,
            monsters: livingMonsters,
          });
        }
      }

      // Throttled & Deduplicated React HUD Sync (~6Hz)
      hudSyncAccumulator += dt;
      if (hudSyncAccumulator >= 0.15) {
        hudSyncAccumulator = 0;
        const nearbyLootCount = lootDrops.filter(
          (d) => Math.hypot(d.x - hero.x, d.y - hero.y) <= 340
        ).length;
        const activeBoss = enemies.find((e) => e.isBoss && e.aiState !== 'ko');
        const bossActiveName = activeBoss ? activeBoss.name : null;
        const bossHpPct = activeBoss
          ? Math.round((activeBoss.hp / Math.max(1, activeBoss.maxHp)) * 100) / 100
          : 0;
        const isNearShop =
          !activeInBloodCastle &&
          Math.hypot(hero.x - npcBlacksmithHanzo.x, hero.y - npcBlacksmithHanzo.y) <=
            SHOP_INTERACT_RADIUS;
        const roundedCd: Record<string, number> = {};
        Object.keys(skillCooldowns).forEach((k) => {
          const val = Math.round(skillCooldowns[k] * 10) / 10;
          if (val > 0) roundedCd[k] = val;
        });
        const roundedBcRemain = Math.ceil(bcTimeRemainingSec);
        const bloodCastleInfo = activeInBloodCastle
          ? {
              active: true,
              stage: bcStage,
              kills: bcBridgeKills,
              targetKills: BC_TARGET_KILLS,
              hasArchangelWeapon: bcHasArchangelWeapon,
              timeRemainingSec: roundedBcRemain,
              timeLimitSec: BLOOD_CASTLE_TIME_LIMIT_SEC,
            }
          : null;
        const sig = `${nearbyLootCount}|${bossActiveName}|${bossHpPct}|${hero.comboStage}|${isNearShop}|${activeInBloodCastle}|${bcStage}|${bcBridgeKills}|${bcHasArchangelWeapon}|${roundedBcRemain}|${JSON.stringify(roundedCd)}`;
        if (sig !== lastHudSignature) {
          lastHudSignature = sig;
          callbacksRef.current.onHudSync({
            cooldowns: roundedCd,
            nearbyLootCount,
            bossActiveName,
            bossHpPct,
            comboStage: hero.comboStage,
            isNearShop,
            bloodCastleInfo,
          });
        }
      }

      // =======================================================================
      // DETAILED 2.5D ISOMETRIC CANVAS RENDERING
      // =======================================================================
      ctx.save();
      ctx.fillStyle = activeInBloodCastle ? '#0b0306' : territory.groundColor;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      const cameraZoom = getCameraZoom();
      ctx.translate(viewWidth / 2 + shakeX, viewHeight / 2 + shakeY);
      ctx.scale(cameraZoom, cameraZoom);
      ctx.translate(-cameraX, -cameraY);

      if (activeInBloodCastle) {
        // =====================================================================
        // BLOOD CASTLE BRIDGE OVER THE CRIMSON ABYSS RENDERING
        // =====================================================================
        // 1. Stone Bridge Deck (-340 to +340, y from -2250 to +2320)
        const bridgeW = BC_BRIDGE_HALF_WIDTH * 2;
        const bridgeH = BC_SOUTH_END_Y - BC_NORTH_END_Y;

        // Abyss Crimson Glow along Bridge Edges
        const leftAbyss = ctx.createLinearGradient(
          -BC_BRIDGE_HALF_WIDTH - 160,
          0,
          -BC_BRIDGE_HALF_WIDTH,
          0
        );
        leftAbyss.addColorStop(0, 'rgba(225, 29, 72, 0)');
        leftAbyss.addColorStop(1, 'rgba(225, 29, 72, 0.35)');
        ctx.fillStyle = leftAbyss;
        ctx.fillRect(-BC_BRIDGE_HALF_WIDTH - 160, BC_NORTH_END_Y, 160, bridgeH);

        const rightAbyss = ctx.createLinearGradient(
          BC_BRIDGE_HALF_WIDTH,
          0,
          BC_BRIDGE_HALF_WIDTH + 160,
          0
        );
        rightAbyss.addColorStop(0, 'rgba(225, 29, 72, 0.35)');
        rightAbyss.addColorStop(1, 'rgba(225, 29, 72, 0)');
        ctx.fillStyle = rightAbyss;
        ctx.fillRect(BC_BRIDGE_HALF_WIDTH, BC_NORTH_END_Y, 160, bridgeH);

        // Main Bridge Floor
        ctx.fillStyle = '#1b1118';
        ctx.fillRect(-BC_BRIDGE_HALF_WIDTH, BC_NORTH_END_Y, bridgeW, bridgeH);

        // Bridge Stone Slabs & Crimson Runner Carpet
        const slabStep = 85;
        ctx.fillStyle = '#251721';
        for (let gy = BC_NORTH_END_Y; gy < BC_SOUTH_END_Y; gy += slabStep) {
          for (let gx = -BC_BRIDGE_HALF_WIDTH; gx < BC_BRIDGE_HALF_WIDTH; gx += slabStep) {
            if (Math.abs(Math.floor((gx + gy) / slabStep) % 2) === 0) {
              ctx.fillRect(gx + 3, gy + 3, slabStep - 6, slabStep - 6);
            }
          }
        }

        // Central Blood-Red Runner Path along the Bridge
        ctx.fillStyle = 'rgba(159, 18, 57, 0.35)';
        ctx.fillRect(-75, BC_NORTH_END_Y + 60, 150, bridgeH - 120);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-75, BC_NORTH_END_Y + 60, 150, bridgeH - 120);

        // Left & Right Fortified Bridge Parapets & Torch Braziers
        ctx.fillStyle = '#2d1c28';
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3;
        ctx.fillRect(-BC_BRIDGE_HALF_WIDTH - 16, BC_NORTH_END_Y, 18, bridgeH);
        ctx.strokeRect(-BC_BRIDGE_HALF_WIDTH - 16, BC_NORTH_END_Y, 18, bridgeH);
        ctx.fillRect(BC_BRIDGE_HALF_WIDTH - 2, BC_NORTH_END_Y, 18, bridgeH);
        ctx.strokeRect(BC_BRIDGE_HALF_WIDTH - 2, BC_NORTH_END_Y, 18, bridgeH);

        for (let ty = BC_NORTH_END_Y + 120; ty <= BC_SOUTH_END_Y - 120; ty += 260) {
          [-BC_BRIDGE_HALF_WIDTH + 6, BC_BRIDGE_HALF_WIDTH - 6].forEach((tx) => {
            ctx.fillStyle = '#1f1624';
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(tx, ty, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(tx, ty, 4.5 + Math.sin(now * 0.012 + ty) * 1.4, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // Southern Archangel Entrance Platform Circle (y = 2050)
        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(BC_ARCHANGEL_X, BC_ARCHANGEL_Y, 135, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const archLabel =
          bcStage === 'return_weapon' && bcHasArchangelWeapon
            ? '⚔️ РАНЕНЫЙ АРХАНГЕЛ (ПОДОЙДИТЕ СЮДА, ЧТОБЫ ОТДАТЬ ОРУЖИЕ АРХАНГЕЛА!)'
            : bcStage === 'completed'
              ? '🏆 РАНЕНЫЙ АРХАНГЕЛ · КВЕСТ ЗАВЕРШЁН (+3 CHAOS И ОПЫТ ПОЛУЧЕНЫ)'
              : '👼 РАНЕНЫЙ АРХАНГЕЛ · ЖДЁТ ОРУЖИЕ АРХАНГЕЛА В НАЧАЛЕ МОСТА';
        drawNpcModel(
          ctx,
          'wounded_archangel',
          BC_ARCHANGEL_X,
          BC_ARCHANGEL_Y,
          archLabel,
          now
        );
      } else {
        // 1. Viewport-Culled Isometric Checkerboard Stone Tiles & Biome Details (60fps on 10400x10400 map)
        const tileStep = 90;
        const visStartX = Math.max(
          -ARENA_HALF_SIZE,
          Math.floor((cameraX - viewWidth / 2 - tileStep) / tileStep) * tileStep
        );
        const visEndX = Math.min(
          ARENA_HALF_SIZE,
          Math.ceil((cameraX + viewWidth / 2 + tileStep) / tileStep) * tileStep
        );
        const visStartY = Math.max(
          -ARENA_HALF_SIZE,
          Math.floor((cameraY - viewHeight / 2 - tileStep) / tileStep) * tileStep
        );
        const visEndY = Math.min(
          ARENA_HALF_SIZE,
          Math.ceil((cameraY + viewHeight / 2 + tileStep) / tileStep) * tileStep
        );

        ctx.fillStyle = territory.tileAccentColor;
        for (let gx = visStartX; gx < visEndX; gx += tileStep) {
          for (let gy = visStartY; gy < visEndY; gy += tileStep) {
            if (Math.abs(((gx + gy) / tileStep) % 2) === 0) {
              ctx.fillRect(gx + 3, gy + 3, tileStep - 6, tileStep - 6);
            }
          }
        }

        // Rich Biome-Specific Ground Surface Detailing across all 8 MU Continent Biomes
        const biome = activeMapLayout.biomeTheme;
        for (let gx = visStartX; gx < visEndX; gx += tileStep * 2) {
          for (let gy = visStartY; gy < visEndY; gy += tileStep * 2) {
            if (Math.hypot(gx, gy) < TOWN_SAFE_RADIUS + 85) continue;
            const hash = Math.abs(Math.sin(gx * 12.9898 + gy * 78.233));
            const hash2 = Math.abs(Math.cos(gx * 41.13 + gy * 19.77));
            if (hash <= 0.34) continue;
            const tx = gx + 22 + hash2 * 52;
            const ty = gy + 24 + hash * 48;

            if (biome === 'lorencia_pasture') {
              ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(tx, ty);
              ctx.lineTo(tx - 4, ty - 10);
              ctx.moveTo(tx, ty);
              ctx.lineTo(tx + 1, ty - 12);
              ctx.moveTo(tx, ty);
              ctx.lineTo(tx + 5, ty - 9);
              ctx.stroke();
              if (hash > 0.72) {
                ctx.fillStyle = hash2 > 0.5 ? 'rgba(253, 224, 71, 0.65)' : 'rgba(255, 255, 255, 0.55)';
                ctx.beginPath();
                ctx.arc(tx + 4, ty - 10, 2.1, 0, Math.PI * 2);
                ctx.fill();
              }
            } else if (biome === 'noria_forest') {
              // Emerald fern cluster & glowing fairy spore motes
              ctx.strokeStyle = 'rgba(52, 211, 153, 0.32)';
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.moveTo(tx, ty);
              ctx.quadraticCurveTo(tx - 8, ty - 8, tx - 12, ty - 4);
              ctx.moveTo(tx, ty);
              ctx.quadraticCurveTo(tx + 8, ty - 8, tx + 12, ty - 4);
              ctx.stroke();
              if (hash > 0.75) {
                const glowA = 0.35 + Math.sin(now * 0.004 + gx) * 0.25;
                ctx.fillStyle = `rgba(110, 231, 183, ${glowA})`;
                ctx.beginPath();
                ctx.arc(tx, ty - 12, 2.4, 0, Math.PI * 2);
                ctx.fill();
              }
            } else if (biome === 'devias_snow') {
              // Snowdrift arcs & crisp glacial ice cracks
              ctx.strokeStyle = 'rgba(186, 230, 253, 0.32)';
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.moveTo(tx - 10, ty);
              ctx.quadraticCurveTo(tx, ty - 6, tx + 12, ty + 1);
              ctx.stroke();
              if (hash > 0.72) {
                ctx.strokeStyle = 'rgba(125, 211, 252, 0.28)';
                ctx.beginPath();
                ctx.moveTo(tx - 6, ty - 4);
                ctx.lineTo(tx + 2, ty + 3);
                ctx.lineTo(tx + 9, ty - 2);
                ctx.stroke();
              }
            } else if (biome === 'tarkan_desert') {
              // Wind-rippled sand dune ridges & parched cracks
              ctx.strokeStyle = 'rgba(251, 191, 36, 0.24)';
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.moveTo(tx - 16, ty);
              ctx.quadraticCurveTo(tx - 4, ty - 5, tx + 14, ty + 2);
              ctx.stroke();
            } else if (biome === 'atlans_abyss') {
              // Shimmering underwater caustic light ripples & bubbles
              const shift = Math.sin(now * 0.003 + gx * 0.01) * 5;
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.ellipse(tx + shift, ty, 14, 6, 0.3, 0, Math.PI * 2);
              ctx.stroke();
            } else if (biome === 'vulcanus_lava') {
              // Pulsing volcanic magma fissures
              const heat = 0.28 + Math.sin(now * 0.005 + gx + gy) * 0.16;
              ctx.strokeStyle = `rgba(249, 115, 22, ${heat})`;
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.moveTo(tx - 11, ty - 3);
              ctx.lineTo(tx - 2, ty + 4);
              ctx.lineTo(tx + 10, ty - 2);
              ctx.stroke();
            } else if (biome === 'icarus_sky') {
              // Luminous celestial cloud wisps & star dust
              ctx.fillStyle = 'rgba(196, 181, 253, 0.12)';
              ctx.beginPath();
              ctx.ellipse(tx, ty, 18, 7, 0, 0, Math.PI * 2);
              ctx.fill();
              if (hash > 0.7) {
                ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
                ctx.fillRect(tx, ty - 2, 2.5, 2.5);
              }
            } else {
              // Marsh ruins: mossy cracked stones & creeping mist
              ctx.fillStyle = 'rgba(148, 163, 184, 0.1)';
              ctx.beginPath();
              ctx.ellipse(tx, ty, 16, 7, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        ctx.strokeStyle = territory.gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = visStartX; gx <= visEndX; gx += tileStep) {
          ctx.moveTo(gx, visStartY);
          ctx.lineTo(gx, visEndY);
        }
        for (let gy = visStartY; gy <= visEndY; gy += tileStep) {
          ctx.moveTo(visStartX, gy);
          ctx.lineTo(visEndX, gy);
        }
        ctx.stroke();

        // 1.4 RIVERS & STREAMS ("речками") WITH ANIMATED CURRENT & WOODEN BRIDGES
        for (const river of activeMapLayout.rivers) {
          if (river.points.length < 2) continue;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Muddy/Sandy Riverbank Border
          ctx.strokeStyle = 'rgba(120, 88, 52, 0.55)';
          ctx.lineWidth = river.width + 26;
          ctx.beginPath();
          river.points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();

          // Deep River Water Body
          ctx.strokeStyle = river.waterColor;
          ctx.lineWidth = river.width;
          ctx.beginPath();
          river.points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();

          // Animated Flowing Water Current Ripples
          ctx.strokeStyle = river.foamColor;
          ctx.lineWidth = river.width * 0.42;
          ctx.setLineDash([28, 36]);
          ctx.lineDashOffset = -(now * 0.045) % 64;
          ctx.beginPath();
          river.points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        // 1.6 WINDING TRAILS & COUNTRY PATHS ("с тропинками") CONNECTING GATES TO HUNTING SPOTS
        for (const trail of activeMapLayout.trails) {
          if (trail.points.length < 2) continue;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Outer dirt verge / curb
          ctx.strokeStyle =
            trail.style === 'dirt_trail'
              ? 'rgba(54, 41, 26, 0.72)'
              : trail.style === 'forest_path'
                ? 'rgba(26, 56, 38, 0.72)'
                : 'rgba(38, 34, 52, 0.72)';
          ctx.lineWidth = trail.width + 18;
          ctx.beginPath();
          trail.points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();

          // Main trodden trail surface
          ctx.strokeStyle =
            trail.style === 'dirt_trail'
              ? 'rgba(110, 84, 53, 0.78)'
              : trail.style === 'forest_path'
                ? 'rgba(52, 92, 64, 0.75)'
                : 'rgba(68, 60, 88, 0.78)';
          ctx.lineWidth = trail.width;
          ctx.beginPath();
          trail.points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();

          // Center cart wheel ruts / stepping stones
          ctx.strokeStyle =
            trail.style === 'dirt_trail'
              ? 'rgba(163, 130, 86, 0.42)'
              : 'rgba(212, 168, 83, 0.32)';
          ctx.lineWidth = trail.width * 0.45;
          ctx.setLineDash([16, 18]);
          ctx.beginPath();
          trail.points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        // 1.7 WOODEN BRIDGES OVER RIVERS ("мостики через речки")
        for (const river of activeMapLayout.rivers) {
          for (const br of river.bridges) {
            ctx.save();
            ctx.translate(br.x, br.y);
            ctx.rotate(br.angle);

            // Bridge shadow on water
            ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
            ctx.fillRect(-br.width / 2 + 6, -br.length / 2 + 8, br.width, br.length);

            // Main oak timber deck
            ctx.fillStyle = '#5c3a21';
            ctx.strokeStyle = '#d4a853';
            ctx.lineWidth = 2.2;
            ctx.fillRect(-br.width / 2, -br.length / 2, br.width, br.length);
            ctx.strokeRect(-br.width / 2, -br.length / 2, br.width, br.length);

            // Individual wooden planks across the bridge
            ctx.strokeStyle = '#3b2313';
            ctx.lineWidth = 2;
            for (let px = -br.width / 2 + 16; px < br.width / 2; px += 16) {
              ctx.beginPath();
              ctx.moveTo(px, -br.length / 2 + 3);
              ctx.lineTo(px, br.length / 2 - 3);
              ctx.stroke();
            }

            // Wooden bridge handrails & corner lantern posts
            ctx.fillStyle = '#3e2723';
            ctx.fillRect(-br.width / 2, -br.length / 2 - 6, br.width, 8);
            ctx.fillRect(-br.width / 2, br.length / 2 - 2, br.width, 8);
            [
              [-br.width / 2 + 6, -br.length / 2 - 2],
              [br.width / 2 - 6, -br.length / 2 - 2],
              [-br.width / 2 + 6, br.length / 2 + 2],
              [br.width / 2 - 6, br.length / 2 + 2],
            ].forEach(([lx, ly]) => {
              ctx.fillStyle = '#fbbf24';
              ctx.beginPath();
              ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
              ctx.fill();
            });

            ctx.restore();
          }
        }

        // 1.8 WOODEN PASTURE FENCES, IRON RAILINGS & LOW STONE WALLS ("заборами")
        for (const fence of activeMapLayout.fences) {
          ctx.save();
          const dx = fence.x2 - fence.x1;
          const dy = fence.y2 - fence.y1;
          const len = Math.max(1, Math.hypot(dx, dy));

          // Ground shadow under fence
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.42)';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(fence.x1 + 4, fence.y1 + 6);
          ctx.lineTo(fence.x2 + 4, fence.y2 + 6);
          ctx.stroke();

          if (fence.style === 'wood_fence') {
            // Double wooden horizontal rails
            ctx.strokeStyle = '#784727';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(fence.x1, fence.y1 - 4);
            ctx.lineTo(fence.x2, fence.y2 - 4);
            ctx.moveTo(fence.x1, fence.y1 + 2);
            ctx.lineTo(fence.x2, fence.y2 + 2);
            ctx.stroke();

            // Upright wooden fence posts every 46px
            const steps = Math.max(2, Math.floor(len / 46));
            for (let s = 0; s <= steps; s++) {
              const t = s / steps;
              const px = fence.x1 + dx * t;
              const py = fence.y1 + dy * t;
              ctx.fillStyle = '#523018';
              ctx.strokeStyle = '#a16207';
              ctx.lineWidth = 1.4;
              ctx.fillRect(px - 4, py - 14, 8, 18);
              ctx.strokeRect(px - 4, py - 14, 8, 18);
            }
          } else if (fence.style === 'iron_railing') {
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(fence.x1, fence.y1 - 5);
            ctx.lineTo(fence.x2, fence.y2 - 5);
            ctx.stroke();

            const steps = Math.max(2, Math.floor(len / 38));
            for (let s = 0; s <= steps; s++) {
              const t = s / steps;
              const px = fence.x1 + dx * t;
              const py = fence.y1 + dy * t;
              ctx.fillStyle = '#334155';
              ctx.strokeStyle = '#94a3b8';
              ctx.lineWidth = 1.2;
              ctx.fillRect(px - 3, py - 16, 6, 20);
              ctx.fillStyle = '#fbbf24';
              ctx.beginPath();
              ctx.arc(px, py - 17, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Low stone wall
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(fence.x1, fence.y1);
            ctx.lineTo(fence.x2, fence.y2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Fast viewport frustum culling bounds (world-space) scaled by cameraZoom
        const cullHalfW = (viewWidth * 0.58) / cameraZoom;
        const cullHalfH = (viewHeight * 0.58) / cameraZoom;
        const isInView = (wx: number, wy: number, margin = 120) =>
          Math.abs(wx - cameraX) <= cullHalfW + margin &&
          Math.abs(wy - cameraY) <= cullHalfH + margin;

        // 1.9 BIOME SCENERY PROPS: Trees, Lanterns, Ancient Ruins, Crystal Spires, Lava Vents, Boulders, Flower Patches, Carts & Wells
        for (const prop of activeMapLayout.props) {
          if (!isInView(prop.x, prop.y, 140)) continue;
          ctx.save();
          ctx.translate(prop.x, prop.y);

          if (prop.kind === 'oak_tree' || prop.kind === 'pine_tree') {
            // Ground shadow
            ctx.fillStyle = 'rgba(0,0,0,0.46)';
            ctx.beginPath();
            ctx.ellipse(7, 12, 28, 13, 0, 0, Math.PI * 2);
            ctx.fill();

            // Trunk with bark highlight
            ctx.fillStyle = '#4a2c18';
            ctx.fillRect(-5, -20, 10, 28);
            ctx.fillStyle = '#6b4226';
            ctx.fillRect(-2, -18, 3, 24);

            if (prop.kind === 'oak_tree') {
              ctx.fillStyle = '#14532d';
              ctx.strokeStyle = '#22c55e';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(0, -34, 25, 0, Math.PI * 2);
              ctx.arc(-15, -23, 17, 0, Math.PI * 2);
              ctx.arc(15, -23, 17, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              // Sunlit top canopy highlight
              ctx.fillStyle = 'rgba(74, 222, 128, 0.25)';
              ctx.beginPath();
              ctx.arc(-5, -40, 11, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Layered Pine Tree (snow-capped in Devias snow biome!)
              const snowy = activeMapLayout.biomeTheme === 'devias_snow';
              ctx.fillStyle = snowy ? '#164e63' : '#064e3b';
              ctx.strokeStyle = snowy ? '#bae6fd' : '#34d399';
              ctx.lineWidth = 1.4;
              for (let layer = 0; layer < 3; layer++) {
                const ly = -14 - layer * 13;
                const lw = 25 - layer * 5;
                ctx.beginPath();
                ctx.moveTo(-lw, ly);
                ctx.lineTo(0, ly - 21);
                ctx.lineTo(lw, ly);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                if (snowy) {
                  ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
                  ctx.beginPath();
                  ctx.moveTo(-lw * 0.45, ly - 10);
                  ctx.lineTo(0, ly - 21);
                  ctx.lineTo(lw * 0.45, ly - 10);
                  ctx.closePath();
                  ctx.fill();
                  ctx.fillStyle = '#164e63';
                }
              }
            }
          } else if (prop.kind === 'dead_tree') {
            ctx.fillStyle = 'rgba(0,0,0,0.42)';
            ctx.beginPath();
            ctx.ellipse(4, 10, 20, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#3f2e26';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 8);
            ctx.lineTo(-2, -16);
            ctx.lineTo(-16, -34);
            ctx.moveTo(-2, -16);
            ctx.lineTo(14, -32);
            ctx.moveTo(-8, -24);
            ctx.lineTo(-20, -26);
            ctx.moveTo(7, -25);
            ctx.lineTo(19, -22);
            ctx.stroke();
          } else if (prop.kind === 'crystal_spire') {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.beginPath();
            ctx.ellipse(4, 10, 22, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            const spireGrad = ctx.createLinearGradient(-12, -46, 12, 6);
            spireGrad.addColorStop(0, '#e0f2fe');
            spireGrad.addColorStop(0.5, territory.accentColor);
            spireGrad.addColorStop(1, '#1e293b');
            ctx.fillStyle = spireGrad;
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-11, 6);
            ctx.lineTo(-14, -22);
            ctx.lineTo(0, -48);
            ctx.lineTo(14, -20);
            ctx.lineTo(10, 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Secondary crystal shard
            ctx.beginPath();
            ctx.moveTo(10, 6);
            ctx.lineTo(19, -18);
            ctx.lineTo(22, 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (prop.kind === 'lava_vent') {
            ctx.fillStyle = '#1c1917';
            ctx.strokeStyle = '#7c2d12';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(0, 2, 24, 15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            const lavaPulse = 0.72 + Math.sin(now * 0.008 + prop.x) * 0.25;
            const ventGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
            ventGrad.addColorStop(0, `rgba(254, 240, 138, ${lavaPulse})`);
            ventGrad.addColorStop(0.55, `rgba(249, 115, 22, ${lavaPulse * 0.9})`);
            ventGrad.addColorStop(1, 'rgba(153, 27, 27, 0.2)');
            ctx.fillStyle = ventGrad;
            ctx.beginPath();
            ctx.ellipse(0, 1, 16, 9, 0, 0, Math.PI * 2);
            ctx.fill();
          } else if (prop.kind === 'ancient_ruin') {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.beginPath();
            ctx.ellipse(5, 10, 32, 13, 0, 0, Math.PI * 2);
            ctx.fill();
            // Weathered Stone Arch Pillars
            ctx.fillStyle = '#334155';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.6;
            ctx.fillRect(-24, -34, 11, 42);
            ctx.strokeRect(-24, -34, 11, 42);
            ctx.fillRect(13, -28, 11, 36);
            ctx.strokeRect(13, -28, 11, 36);
            // Cracked lintel beam
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.moveTo(-28, -34);
            ctx.lineTo(18, -30);
            ctx.lineTo(16, -21);
            ctx.lineTo(-28, -24);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Faint engraved rune
            ctx.fillStyle = territory.accentColor;
            ctx.globalAlpha = 0.75;
            ctx.beginPath();
            ctx.arc(-18, -14, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          } else if (prop.kind === 'boulder') {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.ellipse(4, 8, 22, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#475569';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-18, 6);
            ctx.lineTo(-14, -10);
            ctx.lineTo(2, -16);
            ctx.lineTo(17, -6);
            ctx.lineTo(15, 7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'rgba(226, 232, 240, 0.2)';
            ctx.beginPath();
            ctx.moveTo(-11, -8);
            ctx.lineTo(2, -14);
            ctx.lineTo(8, -5);
            ctx.closePath();
            ctx.fill();
          } else if (prop.kind === 'flower_patch') {
            ctx.fillStyle = 'rgba(22, 101, 52, 0.48)';
            ctx.beginPath();
            ctx.ellipse(0, 2, 18, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            const blossoms = [
              [-9, -2, '#fde047'],
              [-2, -6, '#f472b6'],
              [7, -1, '#fef9c3'],
              [2, 5, '#60a5fa'],
              [-7, 4, '#fde047'],
            ] as const;
            for (const [bx, by, col] of blossoms) {
              ctx.fillStyle = col;
              ctx.beginPath();
              ctx.arc(bx, by, 2.6, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (prop.kind === 'lantern_post') {
            // Warm radial ground illumination pool
            const flick = 0.85 + Math.sin(now * 0.01 + prop.x) * 0.15;
            const lampGlow = ctx.createRadialGradient(0, -18, 3, 0, -10, 62);
            lampGlow.addColorStop(0, `rgba(253, 224, 71, ${0.28 * flick})`);
            lampGlow.addColorStop(0.55, `rgba(245, 158, 11, ${0.12 * flick})`);
            lampGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
            ctx.fillStyle = lampGlow;
            ctx.beginPath();
            ctx.arc(0, -10, 62, 0, Math.PI * 2);
            ctx.fill();
            // Wrought-iron post & lantern housing
            ctx.fillStyle = '#27272a';
            ctx.fillRect(-2.5, -30, 5, 34);
            ctx.strokeStyle = '#d4a853';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(0, -28);
            ctx.lineTo(10, -28);
            ctx.stroke();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(10, -22, 4.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (prop.kind === 'signpost') {
            ctx.fillStyle = '#4a2c18';
            ctx.fillRect(-3, -26, 6, 30);
            ctx.fillStyle = '#784727';
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1.4;
            ctx.fillRect(-16, -24, 32, 11);
            ctx.strokeRect(-16, -24, 32, 11);
            if (prop.label) {
              ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
              ctx.textAlign = 'center';
              ctx.fillStyle = '#fde68a';
              ctx.fillText(prop.label, 0, -30);
            }
          } else if (prop.kind === 'cart') {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.beginPath();
            ctx.ellipse(0, 8, 26, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#5c3a21';
            ctx.strokeStyle = '#d4a853';
            ctx.lineWidth = 1.6;
            ctx.fillRect(-20, -12, 40, 20);
            ctx.strokeRect(-20, -12, 40, 20);
            // Wheels
            ctx.fillStyle = '#29180c';
            ctx.fillRect(-16, -16, 8, 4);
            ctx.fillRect(8, -16, 8, 4);
            ctx.fillRect(-16, 8, 8, 4);
            ctx.fillRect(8, 8, 8, 4);
          } else if (prop.kind === 'campfire') {
            const fireGlow = ctx.createRadialGradient(0, -2, 3, 0, -2, 44);
            fireGlow.addColorStop(0, 'rgba(249, 115, 22, 0.34)');
            fireGlow.addColorStop(1, 'rgba(249, 115, 22, 0)');
            ctx.fillStyle = fireGlow;
            ctx.beginPath();
            ctx.arc(0, -2, 44, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#3f3f46';
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();
            const fR = 7 + Math.sin(now * 0.015 + prop.x) * 2.2;
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(0, -2, fR, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(0, -2, fR * 0.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (prop.kind === 'well') {
            ctx.fillStyle = 'rgba(0,0,0,0.42)';
            ctx.beginPath();
            ctx.ellipse(3, 8, 22, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#475569';
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 17, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#0ea5e9';
            ctx.beginPath();
            ctx.arc(0, 0, 11, 0, Math.PI * 2);
            ctx.fill();
            // Wooden roof beam
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-16, -2);
            ctx.lineTo(-16, -22);
            ctx.lineTo(16, -22);
            ctx.lineTo(16, -2);
            ctx.stroke();
          } else if (prop.kind === 'barrel_cluster') {
            ctx.fillStyle = '#523018';
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(-6, 0, 9, 0, Math.PI * 2);
            ctx.arc(8, 2, 8, 0, Math.PI * 2);
            ctx.arc(1, -9, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          ctx.restore();
        }

        // Decorative Ancient Stone Columns & Runic Obelisks around Hunting Grounds
        for (const col of worldColumns) {
          if (!isInView(col.x, col.y, 120)) continue;
          ctx.fillStyle = 'rgba(0,0,0,0.48)';
          ctx.beginPath();
          ctx.ellipse(col.x + 6, col.y + 12, 26, 14, 0, 0, Math.PI * 2);
          ctx.fill();

          // Base plinth
          ctx.fillStyle = '#25212e';
          ctx.strokeStyle = 'rgba(212, 168, 83, 0.55)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(col.x, col.y, 21, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Upright 2.5D Obelisk Pillar
          ctx.fillStyle = '#1b1824';
          ctx.strokeStyle = territory.accentColor;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(col.x - 10, col.y);
          ctx.lineTo(col.x - 7, col.y - 38);
          ctx.lineTo(col.x, col.y - 48);
          ctx.lineTo(col.x + 7, col.y - 38);
          ctx.lineTo(col.x + 10, col.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Glowing Rune Crystal on Obelisk
          ctx.fillStyle = territory.accentColor;
          ctx.beginPath();
          ctx.arc(col.x, col.y - 24, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. GRAND MULTI-DISTRICT FORTIFIED CITY SAFE ZONE at (0, 0) (Radius = 560px, Diameter = 1120px!)
        const heroInsideSafeTown = Math.hypot(hero.x, hero.y) <= TOWN_SAFE_RADIUS;

        // Render Distant Wilderness Hunting Spot Runic Circles ("Споты Охоты") including the Golden VIP Spot (+2 Ranged Monsters)!
        const nowWorldSec = getWorldGameTimeSec();
        for (let c = 0; c < activeMapLayout.camps.length; c++) {
          const camp = activeMapLayout.camps[c];
          const expectedTotal = camp.baseMonsterCount + (camp.isVip ? camp.vipExtraRangedCount : 0);
          const aliveCount = enemies.filter((e) => {
            if (e.aiState === 'ko' || e.isBoss) return false;
            const bp = unitBlueprintsById.get(e.id);
            if (bp) return bp.campIdx === c;
            return (
              e.campX !== undefined &&
              e.campY !== undefined &&
              Math.round(e.campX) === Math.round(camp.x) &&
              Math.round(e.campY) === Math.round(camp.y)
            );
          }).length;

          let nearestRespawnSec: number | null = null;
          deadUnitRespawns.forEach((marker, unitId) => {
            if (marker.isBoss) return;
            const bp = unitBlueprintsById.get(unitId);
            if (!bp || bp.campIdx !== c) return;
            const diff = marker.respawnAtGameTimeSec - nowWorldSec;
            if (diff <= 0) return;
            const remain = Math.ceil(diff);
            if (nearestRespawnSec === null || remain < nearestRespawnSec) {
              nearestRespawnSec = remain;
            }
          });

          ctx.save();
          ctx.translate(camp.x, camp.y);
          if (camp.isVip) {
            ctx.fillStyle = aliveCount > 0 ? 'rgba(250, 204, 21, 0.11)' : 'rgba(56, 189, 248, 0.06)';
            ctx.strokeStyle = aliveCount > 0 ? 'rgba(250, 204, 21, 0.72)' : 'rgba(56, 189, 248, 0.4)';
            ctx.lineWidth = 3.2;
          } else {
            ctx.fillStyle = aliveCount > 0 ? 'rgba(244, 63, 94, 0.07)' : 'rgba(56, 189, 248, 0.05)';
            ctx.strokeStyle = aliveCount > 0 ? 'rgba(244, 63, 94, 0.38)' : 'rgba(56, 189, 248, 0.32)';
            ctx.lineWidth = 2.4;
          }
          ctx.beginPath();
          ctx.arc(0, 0, CAMP_SPAWN_RADIUS, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          if (camp.isVip) {
            // Inner golden VIP star ring
            ctx.strokeStyle = 'rgba(253, 224, 71, 0.38)';
            ctx.lineWidth = 1.6;
            ctx.setLineDash([12, 10]);
            ctx.beginPath();
            ctx.arc(0, 0, CAMP_SPAWN_RADIUS - 28, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = camp.isVip ? '#fde047' : aliveCount > 0 ? '#fda4af' : '#7dd3fc';
          ctx.fillText(
            aliveCount > 0
              ? `${camp.isVip ? '' : '⚔️ '}${camp.title} (${aliveCount}/${expectedTotal}${
                  nearestRespawnSec !== null ? ` · ⏳ ${nearestRespawnSec}с` : ''
                })`
              : nearestRespawnSec !== null
                ? `⏳ ${camp.title} · Ближайший респавн через ${nearestRespawnSec}с`
                : `⏳ ${camp.title} · Возрождение юнитов...`,
            0,
            -(CAMP_SPAWN_RADIUS + 14)
          );
          ctx.restore();
        }

        // Paved Grand City Courtyard Floor
        const plazaGrad = ctx.createRadialGradient(0, 0, 40, 0, 0, TOWN_SAFE_RADIUS);
        plazaGrad.addColorStop(0, 'rgba(48, 40, 68, 0.92)');
        plazaGrad.addColorStop(0.7, 'rgba(29, 24, 42, 0.88)');
        plazaGrad.addColorStop(1, 'rgba(20, 17, 30, 0.78)');
        ctx.fillStyle = plazaGrad;
        ctx.beginPath();
        ctx.arc(0, 0, TOWN_SAFE_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Grand Cross-Avenues connecting the 4 City Gates to the Central Fountain Plaza
        ctx.fillStyle = 'rgba(62, 52, 84, 0.55)';
        ctx.fillRect(-44, -TOWN_SAFE_RADIUS, 88, TOWN_SAFE_RADIUS * 2);
        ctx.fillRect(-TOWN_SAFE_RADIUS, -44, TOWN_SAFE_RADIUS * 2, 88);

        // Gold Trim Borders along the City Cross-Avenues
        ctx.strokeStyle = 'rgba(212, 168, 83, 0.32)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-44, -TOWN_SAFE_RADIUS + 12, 88, TOWN_SAFE_RADIUS * 2 - 24);
        ctx.strokeRect(-TOWN_SAFE_RADIUS + 12, -44, TOWN_SAFE_RADIUS * 2 - 24, 88);

        // Radial Mosaic Rings inside the Expanded City
        ctx.strokeStyle = 'rgba(212, 168, 83, 0.22)';
        ctx.lineWidth = 1.5;
        [115, 265, 390].forEach((ringR) => {
          ctx.beginPath();
          ctx.arc(0, 0, ringR, 0, Math.PI * 2);
          ctx.stroke();
        });

        // 4 Architectural City Quarter Pavilions (Housing the 4 City NPCs)
        const quarters = [
          {
            x: npcChaosGoblin.x,
            y: npcChaosGoblin.y,
            title: 'АЛХИМИЯ И МАШИНА ХАОСА',
            roofColor: '#064e3b',
            borderColor: '#34d399',
          },
          {
            x: npcPriestessSevina.x,
            y: npcPriestessSevina.y,
            title: 'СОБОР ЖРИЦЫ СЕБИНЫ',
            roofColor: '#3b0764',
            borderColor: '#c084fc',
          },
          {
            x: npcBlacksmithHanzo.x,
            y: npcBlacksmithHanzo.y,
            title: 'КУЗНИЦА ХАНЗО И ЛАВКА БАНОК',
            roofColor: '#451a03',
            borderColor: '#fbbf24',
          },
          {
            x: npcPortalGuard.x,
            y: npcPortalGuard.y,
            title: 'ГИЛЬДИЯ ТЕЛЕПОРТОВ (24 ГОРОДА)',
            roofColor: '#1e3a8a',
            borderColor: '#38bdf8',
          },
        ];

        for (const q of quarters) {
          ctx.save();
          ctx.translate(q.x, q.y);

          ctx.fillStyle = 'rgba(18, 15, 26, 0.9)';
          ctx.strokeStyle = q.borderColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-68, -54, 136, 92, 12);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = q.roofColor;
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.roundRect(-56, -42, 112, 68, 8);
          ctx.fill();
          ctx.globalAlpha = 1;

          [
            [-60, -46],
            [60, -46],
            [-60, 30],
            [60, 30],
          ].forEach(([cx, cy]) => {
            ctx.fillStyle = '#2d263b';
            ctx.strokeStyle = '#d4a853';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });

          ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = q.borderColor;
          ctx.fillText(q.title, 0, 52);

          ctx.restore();
        }

        const heroNearShopNow =
          Math.hypot(hero.x - npcBlacksmithHanzo.x, hero.y - npcBlacksmithHanzo.y) <=
          SHOP_INTERACT_RADIUS;
        ctx.save();
        ctx.translate(npcBlacksmithHanzo.x, npcBlacksmithHanzo.y);
        ctx.fillStyle = heroNearShopNow
          ? 'rgba(251, 191, 36, 0.08)'
          : 'rgba(251, 191, 36, 0.03)';
        ctx.strokeStyle = heroNearShopNow
          ? 'rgba(251, 191, 36, 0.55)'
          : 'rgba(251, 191, 36, 0.25)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, SHOP_INTERACT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 4 Segmented Fortified Castle Walls around City Perimeter
        const wallAngles = [
          [0.14, Math.PI / 2 - 0.14],
          [Math.PI / 2 + 0.14, Math.PI - 0.14],
          [Math.PI + 0.14, (3 * Math.PI) / 2 - 0.14],
          [(3 * Math.PI) / 2 + 0.14, Math.PI * 2 - 0.14],
        ];
        for (const [startA, endA] of wallAngles) {
          ctx.strokeStyle = '#2d2738';
          ctx.lineWidth = 16;
          ctx.beginPath();
          ctx.arc(0, 0, TOWN_SAFE_RADIUS, startA, endA);
          ctx.stroke();

          ctx.strokeStyle = heroInsideSafeTown
            ? 'rgba(52, 211, 153, 0.85)'
            : 'rgba(212, 168, 83, 0.68)';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.arc(0, 0, TOWN_SAFE_RADIUS, startA, endA);
          ctx.stroke();
        }

        const gateAngles = [
          { a: 0, label: 'ВОСТОЧНЫЕ ВРАТА →' },
          { a: Math.PI / 2, label: 'ЮЖНЫЕ ВРАТА ↓' },
          { a: Math.PI, label: '← ЗАПАДНЫЕ ВРАТА' },
          { a: (3 * Math.PI) / 2, label: '↑ СЕВЕРНЫЕ ВРАТА' },
        ];
        for (const gate of gateAngles) {
          [-0.14, 0.14].forEach((offset) => {
            const pa = gate.a + offset;
            const px = Math.cos(pa) * TOWN_SAFE_RADIUS;
            const py = Math.sin(pa) * TOWN_SAFE_RADIUS;

            ctx.fillStyle = '#1f1a29';
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(px, py, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = heroInsideSafeTown ? '#34d399' : '#38bdf8';
            ctx.beginPath();
            ctx.arc(px, py, 4.5, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // Central Grand Water Fountain Basin & Dragon Spire at (0, -10)
        const fy = -10;
        ctx.fillStyle = '#1e1b26';
        ctx.strokeStyle = '#d4a853';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, fy, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
        ctx.beginPath();
        ctx.arc(0, fy, 38, 0, Math.PI * 2);
        ctx.fill();

        const waterRipple = 10 + ((now * 0.018) % 26);
        const waterRipple2 = 10 + ((now * 0.018 + 13) % 26);
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, fy, waterRipple, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
        ctx.beginPath();
        ctx.arc(0, fy, waterRipple2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#d4a853';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, fy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Engraved City Safe-Zone Banner above Central Fountain
        ctx.save();
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        const safeLabel = heroInsideSafeTown
          ? `🛡️ ${territory.name.toUpperCase()} · БЕЗОПАСНЫЙ ГОРОД (Монстры за стенами в спотах охоты)`
          : `🛡️ ВРАТА ГОРОДА: ${territory.name.toUpperCase()} (Войдите за стены для исцеления)`;
        const safeLabelW = ctx.measureText(safeLabel).width + 22;
        ctx.fillStyle = 'rgba(9, 8, 14, 0.9)';
        ctx.strokeStyle = heroInsideSafeTown ? '#34d399' : '#d4a853';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-safeLabelW / 2, -92, safeLabelW, 22, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = heroInsideSafeTown ? '#6ee7b7' : '#fde68a';
        ctx.fillText(safeLabel, 0, -77);
        ctx.restore();

        // 4. Render All 4 Interactive City 2.5D NPCs
        drawNpcModel(ctx, 'chaos_goblin', npcChaosGoblin.x, npcChaosGoblin.y, npcChaosGoblin.label, now);
        drawNpcModel(
          ctx,
          'priestess_sevina',
          npcPriestessSevina.x,
          npcPriestessSevina.y,
          npcPriestessSevina.label,
          now
        );
        drawNpcModel(
          ctx,
          'blacksmith_hanzo',
          npcBlacksmithHanzo.x,
          npcBlacksmithHanzo.y,
          npcBlacksmithHanzo.label,
          now
        );
        drawNpcModel(
          ctx,
          'portal_guard',
          npcPortalGuard.x,
          npcPortalGuard.y,
          npcPortalGuard.label,
          now
        );

        // 8 Perimeter Gothic Torch Braziers around the Expanded City Walls
        for (let b = 0; b < 8; b++) {
          const ba = (b * Math.PI) / 4 + Math.PI / 8;
          const bx = Math.cos(ba) * (TOWN_SAFE_RADIUS - 18);
          const by = Math.sin(ba) * (TOWN_SAFE_RADIUS - 18);

          const glowGrad = ctx.createRadialGradient(bx, by, 2, bx, by, 48);
          glowGrad.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
          glowGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(bx, by, 48, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#272030';
          ctx.strokeStyle = '#d4a853';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(bx, by, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          const flicker = 4.2 + Math.sin(now * 0.012 + b) * 1.5;
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(bx, by, flicker, 0, Math.PI * 2);
          ctx.fill();
        }

        // Arena Outer Border
        ctx.strokeStyle = territory.accentColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(
          -ARENA_HALF_SIZE,
          -ARENA_HALF_SIZE,
          ARENA_HALF_SIZE * 2,
          ARENA_HALF_SIZE * 2
        );
      }

      // Tap-to-Move Destination Marker
      if (hero.moveTargetX !== null && hero.moveTargetY !== null) {
        const pulse = 10 + Math.sin(now * 0.01) * 3;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hero.moveTargetX, hero.moveTargetY, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Subtle Per-Unit Individual Server-Time Respawn Rune Markers
      if (!activeInBloodCastle && deadUnitRespawns.size > 0) {
        const nowGameSec = getWorldGameTimeSec();
        ctx.save();
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        for (const marker of deadUnitRespawns.values()) {
          const remainSec = Math.ceil(marker.respawnAtGameTimeSec - nowGameSec);
          if (remainSec <= 0) continue;
          if (
            Math.abs(marker.x - cameraX) > viewWidth * 0.65 ||
            Math.abs(marker.y - cameraY) > viewHeight * 0.65
          ) {
            continue;
          }
          const pulse = 13 + Math.sin(now * 0.005 + marker.x) * 2.5;
          ctx.strokeStyle = marker.isBoss
            ? 'rgba(244, 63, 94, 0.45)'
            : 'rgba(212, 168, 83, 0.32)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(marker.x, marker.y, pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = marker.isBoss
            ? 'rgba(253, 164, 175, 0.85)'
            : 'rgba(253, 230, 138, 0.78)';
          ctx.fillText(
            marker.isBoss ? `👑⏳ ${remainSec}с` : `⏳ ${remainSec}с`,
            marker.x,
            marker.y + 3
          );
        }
        ctx.restore();
      } else if (activeInBloodCastle && bcDeadRespawns.size > 0) {
        ctx.save();
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        for (const marker of bcDeadRespawns.values()) {
          const remainSec = Math.ceil(marker.respawnAtSec - bcElapsedSec);
          if (remainSec <= 0) continue;
          if (
            Math.abs(marker.x - cameraX) > viewWidth * 0.65 ||
            Math.abs(marker.y - cameraY) > viewHeight * 0.65
          ) {
            continue;
          }
          const pulse = 12 + Math.sin(now * 0.008 + marker.y) * 2.2;
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(marker.x, marker.y, pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(253, 164, 175, 0.92)';
          ctx.fillText(`🩸⏳ ${remainSec}с`, marker.x, marker.y + 3);
        }
        ctx.restore();
      }

      // 5. Loot Drops with Classic MU Golden/Emerald Vertical Light Beams (Frustum Culled!)
      const renderWallClockNow = Date.now();
      const renderCullW = viewWidth * 0.56;
      const renderCullH = viewHeight * 0.56;
      for (const drop of lootDrops) {
        if (
          Math.abs(drop.x - cameraX) > renderCullW + 150 ||
          Math.abs(drop.y - cameraY) > renderCullH + 150
        ) {
          continue;
        }
        if (drop.type !== 'zen') {
          const grad = ctx.createLinearGradient(drop.x, drop.y, drop.x, drop.y - 74);
          grad.addColorStop(0, drop.rarityColor);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(drop.x - 6, drop.y - 74, 12, 74);
        }

        ctx.fillStyle = drop.rarityColor;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.type === 'zen' ? 5 : 7.5, 0, Math.PI * 2);
        ctx.fill();

        const remainSec =
          drop.type === 'archangel_weapon'
            ? null
            : getGroundLootRemainingSec(drop, renderWallClockNow);
        const showTimer =
          remainSec !== null && (Boolean(drop.droppedByNickname) || remainSec <= 20);
        const displayLabel = showTimer
          ? drop.droppedByNickname
            ? `${drop.label} · ${remainSec}с`
            : `${drop.label} (${remainSec}с)`
          : drop.label;

        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(9, 8, 12, 0.88)';
        const textW = ctx.measureText(displayLabel).width + 10;
        ctx.fillRect(drop.x - textW / 2, drop.y - 24, textW, 15);
        ctx.fillStyle = drop.rarityColor;
        ctx.fillText(displayLabel, drop.x, drop.y - 13);
      }

      // 6. Enemy Windup Attack Telegraphs (Frustum Culled)
      for (const e of enemies) {
        if (e.aiState !== 'windup') continue;
        if (
          Math.abs(e.x - cameraX) > renderCullW + 220 ||
          Math.abs(e.y - cameraY) > renderCullH + 220
        ) {
          continue;
        }
        if (e.archetype === 'charger_bull') {
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
          ctx.lineWidth = 16;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.telegraphX, e.telegraphY);
          ctx.stroke();
        } else {
          const r = e.isBoss ? 105 : 65;
          ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(e.telegraphX, e.telegraphY, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // 7. Rich Skill Visual Effects & MU Combo Blast (Frustum Culled)
      for (const vfx of activeVfx) {
        if (
          Math.abs(vfx.x - cameraX) > renderCullW + vfx.radius + 140 ||
          Math.abs(vfx.y - cameraY) > renderCullH + vfx.radius + 140
        ) {
          continue;
        }
        const progress = vfx.elapsed / vfx.duration;
        const alpha = 1 - progress;
        ctx.save();
        ctx.globalAlpha = alpha;

        if (vfx.pattern === 'mu_combo_blast') {
          // Iconic Cyan-Gold Lightning Combo Ring + 8 Radial Lightning Bolts
          const r = vfx.radius * (0.3 + progress * 0.85);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 10 * (1 - progress * 0.5);
          ctx.beginPath();
          ctx.arc(vfx.x, vfx.y, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 4;
          for (let b = 0; b < 8; b++) {
            const ba = (b * Math.PI) / 4 + progress * 1.5;
            ctx.beginPath();
            ctx.moveTo(vfx.x + Math.cos(ba) * 24, vfx.y + Math.sin(ba) * 24);
            ctx.lineTo(vfx.x + Math.cos(ba) * r, vfx.y + Math.sin(ba) * r);
            ctx.stroke();
          }
        } else if (vfx.pattern === 'spin_aoe' || vfx.pattern === 'combo_nova') {
          // Twisting Slash / Sword Blast: Rotating Crescent Blades
          const r = vfx.radius * (0.55 + progress * 0.5);
          ctx.strokeStyle = vfx.color;
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(vfx.x, vfx.y, r, 0, Math.PI * 2);
          ctx.stroke();

          const bladeCount = vfx.pattern === 'combo_nova' ? 8 : 4;
          for (let b = 0; b < bladeCount; b++) {
            const ba = progress * Math.PI * 5 + (b * Math.PI * 2) / bladeCount;
            const bx = vfx.x + Math.cos(ba) * r * 0.85;
            const by = vfx.y + Math.sin(ba) * r * 0.85;
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(vfx.x, vfx.y);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        } else if (vfx.pattern === 'evil_spirits' || vfx.pattern === 'soul_supernova') {
          // Evil Spirits: 8 Swirling Shadow Dragons with Trails
          const spiritCount = vfx.pattern === 'soul_supernova' ? 10 : 6;
          for (let s = 0; s < spiritCount; s++) {
            const a = progress * Math.PI * 4.5 + (s * Math.PI * 2) / spiritCount;
            const r = vfx.radius * (0.3 + 0.7 * progress);
            const sx = vfx.x + Math.cos(a) * r;
            const sy = vfx.y + Math.sin(a) * r;
            ctx.fillStyle = vfx.color;
            ctx.beginPath();
            ctx.arc(sx, sy, 13, 0, Math.PI * 2);
            ctx.fill();
            // Tail
            const tailA = a - 0.35;
            ctx.strokeStyle = '#e9d5ff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(vfx.x + Math.cos(tailA) * (r * 0.78), vfx.y + Math.sin(tailA) * (r * 0.78));
            ctx.stroke();
          }
        } else if (vfx.pattern === 'dark_beam') {
          ctx.strokeStyle = vfx.color;
          ctx.lineWidth = 15 * (1 - progress * 0.5);
          ctx.beginPath();
          ctx.moveTo(vfx.x, vfx.y);
          ctx.lineTo(vfx.targetX, vfx.targetY);
          ctx.stroke();
        } else if (vfx.pattern === 'triple_arrow' || vfx.pattern === 'infinity_arrow_storm') {
          const offsets =
            vfx.pattern === 'infinity_arrow_storm'
              ? [-0.52, -0.35, -0.18, 0, 0.18, 0.35, 0.52]
              : [-0.28, -0.14, 0, 0.14, 0.28];
          ctx.strokeStyle = vfx.color;
          ctx.lineWidth = 3.5;
          offsets.forEach((offset) => {
            const a = vfx.angle + offset;
            const d = 210 * progress;
            ctx.beginPath();
            ctx.moveTo(vfx.x + Math.cos(a) * (d * 0.35), vfx.y + Math.sin(a) * (d * 0.35));
            ctx.lineTo(vfx.x + Math.cos(a) * d, vfx.y + Math.sin(a) * d);
            ctx.stroke();
          });
        } else {
          ctx.fillStyle = vfx.color;
          ctx.beginPath();
          ctx.arc(vfx.targetX, vfx.targetY, vfx.radius * (0.4 + progress * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 8. Detailed 2.5D Isometric Enemies (Frustum Culled for High FPS across huge 10400px maps)
      for (const e of enemies) {
        if (
          Math.abs(e.x - cameraX) > renderCullW + e.radius + 140 ||
          Math.abs(e.y - cameraY) > renderCullH + e.radius + 140
        ) {
          continue;
        }
        drawEnemyModel(ctx, e, now);
        // Highlight Quest Monsters that drop the 1st Profession Quest Item (Lvl 50 quest)
        if (
          e.isQuestMonster &&
          e.aiState !== 'ko' &&
          pState.classTier === 1 &&
          !pState.hasFirstProfQuestItem
        ) {
          ctx.save();
          ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          const qBadge = '★ КВЕСТ 1-Й ПРОФЫ';
          const qw = ctx.measureText(qBadge).width + 10;
          ctx.fillStyle = 'rgba(245, 158, 11, 0.92)';
          ctx.fillRect(e.x - qw / 2, e.y - e.radius - 38, qw, 13);
          ctx.fillStyle = '#09080c';
          ctx.fillText(qBadge, e.x, e.y - e.radius - 28);
          ctx.restore();
        }
      }

      // 8.8 Online Co-op Party Allies in the Same Territory / Blood Castle
      const currentPartyMembers = partyMembersRef.current ?? [];
      const wallClockNow = renderWallClockNow;
      for (const ally of currentPartyMembers) {
        if (ally.id === partySelfIdRef.current) continue;
        if (ally.inBloodCastle !== activeInBloodCastle) continue;
        if (!activeInBloodCastle && ally.territoryId !== pState.territoryId) continue;

        let pos = interpPartyPos.get(ally.id);
        if (!pos || Math.hypot(ally.x - pos.x, ally.y - pos.y) > 900) {
          pos = { x: ally.x, y: ally.y, moving: false };
          interpPartyPos.set(ally.id, pos);
        } else {
          const lerpAmt = Math.min(1, dt * 14);
          const stepX = (ally.x - pos.x) * lerpAmt;
          const stepY = (ally.y - pos.y) * lerpAmt;
          pos.x += stepX;
          pos.y += stepY;
          pos.moving = Math.hypot(ally.x - pos.x, ally.y - pos.y) > 3.5;
        }

        // Emerald Co-op Party Aura Ring under ally feet
        ctx.save();
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.72)';
        ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 8, 26, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const allyClsDef = CLASSES[ally.classId] ?? CLASSES.dark_knight;
        const isAttacking = wallClockNow - ally.activeSkillTimestamp < 360;
        ctx.translate(pos.x, pos.y);
        drawHeroModel(ctx, {
          classId: ally.classId,
          classTier: ally.classTier,
          facingAngle: ally.facingAngle,
          walkDistance: ally.walkDistance,
          isMoving: pos.moving,
          attackPhase: isAttacking ? 'active' : 'idle',
          attackTimer: isAttacking ? 0.15 : 0,
          hitFlash: false,
          weapon: ally.hasWeapon ? allyClsDef.startingWeapon : null,
          armor: ally.level >= 8 ? allyClsDef.startingArmor : null,
          helm: ally.level >= 15 ? allyClsDef.startingHelm : null,
          wings: ally.hasWings
            ? {
                id: 'ally_wings',
                name: 'Chaos Wings',
                slot: 'wings',
                rarity: ally.classTier >= 3 ? 'ancient' : 'excellent',
                level: 7,
                lifeOption: 8,
                baseAttack: 30,
                baseDefense: 25,
                critChanceBonus: 5,
                moveSpeedBonus: 15,
                valueZen: 1000,
              }
            : null,
          activeSetPieceCount: ally.classTier >= 2 ? 3 : 0,
          now,
        });
        ctx.restore();

        // Ally Overhead Nameplate & Live HP Bar (elevated when ally is flying with wings)
        const allyFlightLift = ally.hasWings ? 12 : 0;
        ctx.save();
        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        const allyTag = `🤝 ${ally.nickname} · Ур.${ally.level}${ally.resets > 0 ? ` [R:${ally.resets}]` : ''}`;
        const tagW = Math.max(76, ctx.measureText(allyTag).width + 14);
        ctx.fillStyle = 'rgba(8, 18, 22, 0.9)';
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.75)';
        ctx.lineWidth = 1.3;
        ctx.fillRect(pos.x - tagW / 2, pos.y - 64 - allyFlightLift, tagW, 24);
        ctx.strokeRect(pos.x - tagW / 2, pos.y - 64 - allyFlightLift, tagW, 24);
        ctx.fillStyle = '#5eead4';
        ctx.fillText(allyTag, pos.x, pos.y - 50 - allyFlightLift);

        // Mini HP bar inside nameplate
        const hpRatioAlly = Math.max(0, Math.min(1, ally.hp / Math.max(1, ally.maxHp)));
        ctx.fillStyle = '#1f1218';
        ctx.fillRect(pos.x - tagW / 2 + 5, pos.y - 45 - allyFlightLift, tagW - 10, 3.5);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(
          pos.x - tagW / 2 + 5,
          pos.y - 45 - allyFlightLift,
          (tagW - 10) * hpRatioAlly,
          3.5
        );

        // Ally Chat Bubble if active
        if (
          ally.chatBubbleText &&
          ally.chatBubbleExpiresAt &&
          wallClockNow < ally.chatBubbleExpiresAt
        ) {
          ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
          const bubbleText = `💬 ${ally.chatBubbleText}`;
          const bw = ctx.measureText(bubbleText).width + 16;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.5;
          ctx.fillRect(pos.x - bw / 2, pos.y - 88 - allyFlightLift, bw, 20);
          ctx.strokeRect(pos.x - bw / 2, pos.y - 88 - allyFlightLift, bw, 20);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(bubbleText, pos.x, pos.y - 74 - allyFlightLift);
        }
        ctx.restore();

        // Off-screen / Distant Party Ally Compass Pointer
        const distToAlly = Math.hypot(pos.x - hero.x, pos.y - hero.y);
        if (distToAlly > 380) {
          const dirAngle = Math.atan2(pos.y - hero.y, pos.x - hero.x);
          const indDist = 112;
          const ix = hero.x + Math.cos(dirAngle) * indDist;
          const iy = hero.y + Math.sin(dirAngle) * indDist;

          ctx.save();
          ctx.translate(ix, iy);
          ctx.rotate(dirAngle);
          ctx.fillStyle = '#2dd4bf';
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(-7, -6);
          ctx.lineTo(-4, 0);
          ctx.lineTo(-7, 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          const allyDistLabel = `🤝 ${ally.nickname}: ${Math.round(distToAlly / 10)}м`;
          const alW = ctx.measureText(allyDistLabel).width + 10;
          ctx.fillStyle = 'rgba(8, 18, 22, 0.9)';
          ctx.fillRect(ix - alW / 2, iy + 10, alW, 14);
          ctx.fillStyle = '#5eead4';
          ctx.fillText(allyDistLabel, ix, iy + 20);
          ctx.restore();
        }
      }

      // 9. Detailed 2.5D Isometric Hero Model with Armor, Pauldrons, Helm, Shield, Weapon & Chaos Wings
      const heroIsMovingNow = Math.hypot(hero.vx, hero.vy) > 1.5;
      ctx.save();
      ctx.translate(hero.x, hero.y);
      ctx.scale(hero.scaleX, hero.scaleY);
      drawHeroModel(ctx, {
        classId: pState.classId,
        classTier: pState.classTier,
        facingAngle: hero.facingAngle,
        walkDistance: hero.walkDistance,
        isMoving: heroIsMovingNow,
        attackPhase: hero.attackPhase,
        attackTimer: hero.attackTimer,
        hitFlash: hero.hitFlashTimer > 0,
        weapon: pState.equipped.weapon,
        armor: pState.equipped.armor,
        helm: pState.equipped.helm,
        wings: pState.equipped.wings,
        activeSetPieceCount: derived.activeSetPieceCount,
        now,
      });
      ctx.restore();

      // 9.5 Classic MU Online Golden Pillar of Light & Runic Shockwave Level-Up Visual Effect
      if (levelUpEffects.length > 0) {
        for (const lu of levelUpEffects) {
          const t = Math.min(1, lu.elapsed / lu.duration);
          const fadeIn = Math.min(1, t / 0.14);
          const fadeOut = t > 0.62 ? Math.max(0, 1 - (t - 0.62) / 0.38) : 1;
          const intensity = fadeIn * fadeOut;

          ctx.save();
          ctx.translate(hero.x, hero.y);

          // 1. Expanding Double Runic Ground Shockwave Rings
          const shockRadius = 24 + t * 128;
          ctx.globalAlpha = (1 - t) * 0.9;
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 4 * (1 - t * 0.6);
          ctx.beginPath();
          ctx.ellipse(0, 8, shockRadius, shockRadius * 0.48, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#fef9c3';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, 8, shockRadius * 0.68, shockRadius * 0.32, 0, 0, Math.PI * 2);
          ctx.stroke();

          // 2. Rotating Golden Magic Sigil Circle beneath the Hero
          ctx.globalAlpha = intensity * 0.85;
          const sigilR = 46;
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.ellipse(0, 8, sigilR, sigilR * 0.46, 0, 0, Math.PI * 2);
          ctx.stroke();

          // 8-point runic star on the ground
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1.4;
          for (let s = 0; s < 8; s++) {
            const a1 = t * 4.2 + (s * Math.PI) / 4;
            const a2 = a1 + (Math.PI * 3) / 4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a1) * sigilR, 8 + Math.sin(a1) * sigilR * 0.46);
            ctx.lineTo(Math.cos(a2) * sigilR, 8 + Math.sin(a2) * sigilR * 0.46);
            ctx.stroke();
          }

          // 3. Tall Radiant Golden Pillar of Light Descending from the Sky
          const pillarH = 380;
          const outerW = 48 * (0.85 + Math.sin(t * Math.PI) * 0.3);
          const innerW = 19 * (0.8 + Math.sin(t * Math.PI) * 0.35);

          const outerGrad = ctx.createLinearGradient(0, 12, 0, -pillarH);
          outerGrad.addColorStop(0, 'rgba(250, 204, 21, 0.72)');
          outerGrad.addColorStop(0.35, 'rgba(253, 224, 71, 0.45)');
          outerGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
          ctx.globalAlpha = intensity * 0.92;
          ctx.fillStyle = outerGrad;
          ctx.fillRect(-outerW / 2, -pillarH, outerW, pillarH + 10);

          const coreGrad = ctx.createLinearGradient(0, 12, 0, -pillarH * 0.9);
          coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          coreGrad.addColorStop(0.45, 'rgba(254, 249, 195, 0.68)');
          coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = coreGrad;
          ctx.fillRect(-innerW / 2, -pillarH * 0.9, innerW, pillarH * 0.9 + 8);

          // 4. Rising Twin Golden Helix Ribbons Spiraling Upward Around Hero
          ctx.globalAlpha = intensity * 0.95;
          for (let strand = 0; strand < 2; strand++) {
            ctx.strokeStyle = strand === 0 ? '#fde047' : '#ffffff';
            ctx.lineWidth = strand === 0 ? 3 : 2;
            ctx.beginPath();
            for (let step = 0; step <= 22; step++) {
              const frac = step / 22;
              const angle = frac * Math.PI * 4.5 - t * 11 + strand * Math.PI;
              const rx = Math.cos(angle) * (30 * (1 - frac * 0.35));
              const ry = 6 - frac * 175 - t * 35;
              if (step === 0) ctx.moveTo(rx, ry);
              else ctx.lineTo(rx, ry);
            }
            ctx.stroke();
          }

          // 5. Glowing Golden "LEVEL UP!" Emblem Floating Above Hero
          ctx.globalAlpha = intensity;
          const liftY = -88 - t * 24;
          ctx.font = '900 15px "Cinzel", serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(42, 22, 4, 0.95)';
          const banner = `✦ LEVEL UP! Lv.${lu.newLevel} ✦`;
          ctx.strokeText(banner, 0, liftY);
          ctx.fillStyle = '#fef08a';
          ctx.fillText(banner, 0, liftY);

          ctx.restore();
        }
      }

      // Local Hero Chat Bubble if active (elevated when flying with wings)
      if (localChatBubbleText && wallClockNow < localChatBubbleExpiresAt) {
        const heroFlightLift = pState.equipped.wings !== null ? 12 : 0;
        ctx.save();
        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        const bubbleText = `💬 ${localChatBubbleText}`;
        const bw = ctx.measureText(bubbleText).width + 16;
        ctx.fillStyle = 'rgba(24, 18, 36, 0.95)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.fillRect(hero.x - bw / 2, hero.y - 78 - heroFlightLift, bw, 20);
        ctx.strokeRect(hero.x - bw / 2, hero.y - 78 - heroFlightLift, bw, 20);
        ctx.fillStyle = '#fde68a';
        ctx.fillText(bubbleText, hero.x, hero.y - 64 - heroFlightLift);
        ctx.restore();
      }

      // 9.4 Local Auto-Hunt Range Ring (Shows that Auto-Hunt only works inside a 380px spot radius)
      if (autoHuntRef.current) {
        const localEnemy = findNearestLivingEnemy(AUTO_HUNT_RADIUS);
        ctx.save();
        ctx.strokeStyle = localEnemy ? 'rgba(52, 211, 153, 0.45)' : 'rgba(251, 191, 36, 0.38)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(hero.x, hero.y, AUTO_HUNT_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (!localEnemy) {
          ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          const hint = '🎯 Радиус Авто-Охоты (380м): врагов рядом нет — добегите до спота сами!';
          const hw = ctx.measureText(hint).width + 16;
          ctx.fillStyle = 'rgba(9, 8, 12, 0.88)';
          ctx.fillRect(hero.x - hw / 2, hero.y + 34, hw, 18);
          ctx.fillStyle = '#fde047';
          ctx.fillText(hint, hero.x, hero.y + 47);
        }
        ctx.restore();
      }

      // 9.5 Hunting Compass Pointer toward Nearest Distant Monster Spot ("монстры сильнее, их нужно искать")
      const nearestTrackerTarget = findNearestLivingEnemy(12000);
      if (nearestTrackerTarget) {
        const distToTarget = Math.hypot(
          nearestTrackerTarget.x - hero.x,
          nearestTrackerTarget.y - hero.y
        );
        if (distToTarget > 330) {
          const dirAngle = Math.atan2(
            nearestTrackerTarget.y - hero.y,
            nearestTrackerTarget.x - hero.x
          );
          const indicatorDist = 82;
          const ix = hero.x + Math.cos(dirAngle) * indicatorDist;
          const iy = hero.y + Math.sin(dirAngle) * indicatorDist;

          ctx.save();
          ctx.translate(ix, iy);
          ctx.rotate(dirAngle);
          ctx.fillStyle = nearestTrackerTarget.isBoss ? '#facc15' : '#fbbf24';
          ctx.strokeStyle = '#09080c';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(-7, -6);
          ctx.lineTo(-4, 0);
          ctx.lineTo(-7, 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          const meterText = `${nearestTrackerTarget.isBoss ? '👑 ЗОЛОТОЙ БОСС' : 'Спот врагов'}: ${Math.round(distToTarget / 10)}м`;
          const mw = ctx.measureText(meterText).width + 10;
          ctx.fillStyle = 'rgba(9, 8, 12, 0.85)';
          ctx.fillRect(ix - mw / 2, iy + 10, mw, 14);
          ctx.fillStyle = nearestTrackerTarget.isBoss ? '#fef08a' : '#fde68a';
          ctx.fillText(meterText, ix, iy + 20);
          ctx.restore();
        }
      }

      // 10. Render Pooled Particles & Floating Combat Numbers
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (!p.active) continue;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (let i = 0; i < MAX_FLOATING_TEXTS; i++) {
        const ft = floatingTexts[i];
        if (!ft.active) continue;
        const alpha = 1 - ft.life / ft.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `800 ${Math.round(14 * ft.scale)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#07060a';
        ctx.lineWidth = 3.5;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      ctx.restore();

      if (!disposed) {
        setTimeout(
          () => {
            if (!disposed) {
              animFrameId = requestAnimationFrame(tick);
            }
          },
          currentPhase === 'playing' ? 16 : 120
        );
      }
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearInputsOnBlur);
      canvas.removeEventListener('pointerdown', handleCanvasPointerDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="mu-game-canvas"
      className="fixed inset-0 z-0 h-full w-full cursor-crosshair touch-none"
    />
  );
};
