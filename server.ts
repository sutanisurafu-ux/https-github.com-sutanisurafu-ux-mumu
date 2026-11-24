import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { GameDatabase } from './server/db.ts';
import {
  BLOOD_CASTLE_CONFIG,
  SERVER_CONFIG,
  getPublicServerConfigSnapshot,
} from './src/config/index.ts';
import {
  DEFAULT_PARTY_ROOM,
  INDIVIDUAL_MONSTER_RESPAWN_SEC,
  MAX_PARTY_SIZE,
  clampCoord,
  clampPositiveInt,
  electZoneHostId,
  getPartyZoneKey,
  getWorldGameTimeSec,
  isGroundLootExpired,
  sanitizeBloodCastleStage,
  sanitizeClassId,
  sanitizeClassTier,
  sanitizeDeadMonsterRespawns,
  sanitizeEnemyId,
  sanitizeGroundLootDrop,
  sanitizeHitEnemyIds,
  sanitizePartyChatText,
  sanitizePartyCode,
  sanitizePlayerNickname,
  sanitizeSharedMonsterList,
  sanitizeSkillPattern,
  sanitizeTerritoryId,
  sanitizeTradeSideOffer,
} from './src/game/party.ts';
import {
  ServerMonsterUnit,
  applyServerMonsterDamage,
  createInitialZoneMonsterMap,
  createTerritoryBossUnit,
  evaluateGoldenBoss15MinSpawn,
  extractDeadRespawnsRecord,
  getGoldenBossSlotIndex,
  reviveDueServerMonsters,
  toSharedMonsterState,
} from './src/game/worldMonsters.ts';
import type {
  LootDrop,
  PartyAttackEvent,
  PartyChatMessage,
  PartyKillShareEvent,
  PartyMemberState,
  PartyZoneMonsterSnapshot,
  PlayerTradeSession,
  ServerMonsterHpEvent,
  ServerMonsterKilledEvent,
  ServerMonsterRespawnedEvent,
  SharedMonsterState,
  TerritoryId,
} from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gameDb = new GameDatabase();

interface ClientConnection {
  id: string;
  ws: WebSocket;
  roomCode: string;
  isAlive: boolean;
  msgCountWindow: number;
  windowResetAt: number;
}

interface PartyRoom {
  code: string;
  members: Map<string, PartyMemberState>;
  connections: Map<string, ClientConnection>;
  chatHistory: PartyChatMessage[];
  zoneSnapshots: Map<string, PartyZoneMonsterSnapshot>;
  zoneWorldMonsters: Map<TerritoryId, Map<string, ServerMonsterUnit>>;
  zoneBossLastSlot: Map<TerritoryId, number>;
  zoneDeadMonsterRespawns: Map<string, Record<string, number>>;
  zoneGroundLoot: Map<string, LootDrop[]>;
  activeTrades: Map<string, PlayerTradeSession>;
}

interface PersistedZoneWorldState {
  deadRespawns: Record<string, number>;
  damagedHp: Record<string, number>;
}

const rooms = new Map<string, PartyRoom>();
// Persisted in SQLite (world_monster_state) across empty rooms & server restarts so continuous
// Server Game Time keeps monster HP and individual per-unit respawn timers alive even offline.
const persistedWorldState = new Map<string, PersistedZoneWorldState>();
const dirtyWorldStateZones = new Set<string>();
const serverStartedAt = Date.now();
let persistWriteTimer: ReturnType<typeof setTimeout> | null = null;

function getPersistedZoneKey(roomCode: string, territoryId: TerritoryId): string {
  return `${roomCode}::${territoryId}`;
}

function loadPersistedWorldStateFromDb(): void {
  try {
    const nowGameSec = getWorldGameTimeSec(Date.now());
    const loaded = gameDb.loadAllWorldMonsterStates(nowGameSec);
    for (const [key, entry] of loaded.entries()) {
      persistedWorldState.set(key, entry);
    }
  } catch (err) {
    console.error('[MU DB] Failed to load persisted world monster state:', err);
  }
}

function flushDirtyWorldStatesToDb(): void {
  if (dirtyWorldStateZones.size === 0) return;
  const nowGameSec = getWorldGameTimeSec(Date.now());
  const keys = Array.from(dirtyWorldStateZones);
  dirtyWorldStateZones.clear();
  for (const key of keys) {
    const sepIdx = key.indexOf('::');
    if (sepIdx <= 0) continue;
    const roomCode = key.slice(0, sepIdx);
    const territoryId = sanitizeTerritoryId(key.slice(sepIdx + 2));
    const entry = persistedWorldState.get(key) ?? { deadRespawns: {}, damagedHp: {} };
    try {
      gameDb.saveZoneMonsterState(roomCode, territoryId, entry, nowGameSec);
    } catch (err) {
      console.error('[MU DB] Failed saving zone monster state:', err);
    }
  }
}

function scheduleWorldStateDbSave(pKey: string): void {
  dirtyWorldStateZones.add(pKey);
  if (persistWriteTimer) return;
  persistWriteTimer = setTimeout(() => {
    persistWriteTimer = null;
    flushDirtyWorldStatesToDb();
  }, SERVER_CONFIG.worldStatePersistDebounceMs);
}

function syncZoneStateToPersistence(
  room: PartyRoom,
  territoryId: TerritoryId,
  nowGameSec: number
): void {
  const zoneMap = room.zoneWorldMonsters.get(territoryId);
  if (!zoneMap) return;
  const deadRespawns = extractDeadRespawnsRecord(zoneMap, nowGameSec);
  const damagedHp: Record<string, number> = {};
  for (const unit of zoneMap.values()) {
    if (unit.alive && unit.hp > 0 && unit.hp < unit.maxHp) {
      damagedHp[unit.id] = Math.round(unit.hp);
    }
  }
  const pKey = getPersistedZoneKey(room.code, territoryId);
  if (Object.keys(deadRespawns).length === 0 && Object.keys(damagedHp).length === 0) {
    persistedWorldState.delete(pKey);
  } else {
    persistedWorldState.set(pKey, { deadRespawns, damagedHp });
  }
  room.zoneDeadMonsterRespawns.set(territoryId, deadRespawns);
  scheduleWorldStateDbSave(pKey);
}

function broadcastGoldenBossInvasionNotice(
  room: PartyRoom,
  territoryId: TerritoryId,
  boss: ServerMonsterUnit,
  nowMs: number
): void {
  const sysMsg: PartyChatMessage = {
    id: `sys_gboss_${territoryId}_${nowMs}`,
    senderId: 'system',
    nickname: 'Вторжение Золотого Босса',
    classId: 'dark_knight',
    territoryId,
    inBloodCastle: false,
    text: `👑 ${boss.name} появился в диких землях и бродит по карте! С него падают редкие вещи!`,
    timestamp: nowMs,
    isSystem: true,
  };
  room.chatHistory.push(sysMsg);
  if (room.chatHistory.length > 80) {
    room.chatHistory.splice(0, room.chatHistory.length - 80);
  }
  broadcastToSameZone(room, territoryId, false, {
    type: 'party:chat_message',
    message: sysMsg,
  });
}

function reviveAndBroadcastDueZoneMonsters(
  room: PartyRoom,
  territoryId: TerritoryId,
  nowMs = Date.now(),
  nowGameSec = getWorldGameTimeSec(nowMs)
): ServerMonsterUnit[] {
  const zoneMap = room.zoneWorldMonsters.get(territoryId);
  if (!zoneMap) return [];
  const revivedUnits = reviveDueServerMonsters(zoneMap, nowGameSec);

  // 15-minute Server-Time Golden Boss invasion scheduler (max 1 per territory; skip slot if still alive)
  const lastSlot = room.zoneBossLastSlot.get(territoryId) ?? getGoldenBossSlotIndex(nowGameSec) - 1;
  const bossEval = evaluateGoldenBoss15MinSpawn(zoneMap, territoryId, nowGameSec, lastSlot);
  if (bossEval.nextProcessedSlot !== lastSlot) {
    room.zoneBossLastSlot.set(territoryId, bossEval.nextProcessedSlot);
  }
  if (bossEval.spawnedBoss) {
    revivedUnits.push(bossEval.spawnedBoss);
  }

  if (revivedUnits.length === 0) return [];

  syncZoneStateToPersistence(room, territoryId, nowGameSec);
  for (const unit of revivedUnits) {
    const event: ServerMonsterRespawnedEvent = {
      territoryId,
      inBloodCastle: false,
      monster: toSharedMonsterState(unit),
      timestamp: nowMs,
    };
    broadcastToSameZone(room, territoryId, false, {
      type: 'party:monster_respawned',
      event,
    });
    if (unit.isBoss) {
      broadcastGoldenBossInvasionNotice(room, territoryId, unit, nowMs);
    }
  }
  return revivedUnits;
}

function getOrInitZoneWorldMonsters(
  room: PartyRoom,
  territoryId: TerritoryId,
  nowGameSec = getWorldGameTimeSec(Date.now()),
  nowMs = Date.now()
): Map<string, ServerMonsterUnit> {
  let zoneMap = room.zoneWorldMonsters.get(territoryId);
  if (!zoneMap) {
    const pKey = getPersistedZoneKey(room.code, territoryId);
    const saved = persistedWorldState.get(pKey);
    const savedDead = saved?.deadRespawns ?? room.zoneDeadMonsterRespawns.get(territoryId);
    zoneMap = createInitialZoneMonsterMap(territoryId, nowGameSec, savedDead);

    // Initialize 15-minute Golden Boss state for this territory
    const bossId = `boss_${territoryId}`;
    const currentSlot = getGoldenBossSlotIndex(nowGameSec);
    const savedBossRespawn = savedDead?.[bossId];
    if (typeof savedBossRespawn === 'number' && savedBossRespawn > nowGameSec) {
      // Golden Boss was already slain in this 15-minute slot — stay dead until next boundary
      const deadBoss = createTerritoryBossUnit(territoryId);
      deadBoss.alive = false;
      deadBoss.hp = 0;
      deadBoss.aiState = 'ko';
      deadBoss.respawnAtGameTimeSec = savedBossRespawn;
      zoneMap.set(deadBoss.id, deadBoss);
      room.zoneBossLastSlot.set(territoryId, currentSlot);
    } else {
      const bossEval = evaluateGoldenBoss15MinSpawn(
        zoneMap,
        territoryId,
        nowGameSec,
        currentSlot - 1
      );
      room.zoneBossLastSlot.set(territoryId, bossEval.nextProcessedSlot);
    }

    if (saved?.damagedHp) {
      for (const [slotId, savedHp] of Object.entries(saved.damagedHp)) {
        const unit = zoneMap.get(slotId);
        if (unit && unit.alive && savedHp > 0 && savedHp < unit.maxHp) {
          unit.hp = savedHp;
        }
      }
    }
    room.zoneWorldMonsters.set(territoryId, zoneMap);
    room.zoneDeadMonsterRespawns.set(
      territoryId,
      extractDeadRespawnsRecord(zoneMap, nowGameSec)
    );
  } else {
    reviveAndBroadcastDueZoneMonsters(room, territoryId, nowMs, nowGameSec);
  }
  return zoneMap;
}

function getLivingSharedMonstersForZone(
  room: PartyRoom,
  territoryId: TerritoryId,
  nowGameSec = getWorldGameTimeSec(Date.now())
): { monsters: SharedMonsterState[]; deadRespawns: Record<string, number> } {
  const zoneMap = getOrInitZoneWorldMonsters(room, territoryId, nowGameSec);
  const monsters: SharedMonsterState[] = [];
  for (const unit of zoneMap.values()) {
    if (unit.alive && unit.hp > 0) {
      monsters.push(toSharedMonsterState(unit));
    }
  }
  const deadRespawns = extractDeadRespawnsRecord(zoneMap, nowGameSec);
  room.zoneDeadMonsterRespawns.set(territoryId, deadRespawns);
  return { monsters, deadRespawns };
}

loadPersistedWorldStateFromDb();

function getOrCreateRoom(code: string): PartyRoom {
  let room = rooms.get(code);
  if (!room) {
    room = {
      code,
      members: new Map(),
      connections: new Map(),
      chatHistory: [],
      zoneSnapshots: new Map(),
      zoneWorldMonsters: new Map(),
      zoneBossLastSlot: new Map(),
      zoneDeadMonsterRespawns: new Map(),
      zoneGroundLoot: new Map(),
      activeTrades: new Map(),
    };
    rooms.set(code, room);
  }
  return room;
}

function getZoneActiveGroundLoot(room: PartyRoom, zoneKey: string, nowMs = Date.now()): LootDrop[] {
  const list = room.zoneGroundLoot.get(zoneKey);
  if (!list || list.length === 0) return [];
  const filtered = list.filter((d) => !isGroundLootExpired(d, nowMs));
  if (filtered.length !== list.length) {
    room.zoneGroundLoot.set(zoneKey, filtered);
  }
  return filtered;
}

function getZoneActiveDeadRespawns(
  room: PartyRoom,
  zoneKey: string,
  nowGameSec = getWorldGameTimeSec(Date.now())
): Record<string, number> {
  const map = room.zoneDeadMonsterRespawns.get(zoneKey);
  if (!map) return {};
  const cleaned: Record<string, number> = {};
  for (const [id, respawnSec] of Object.entries(map)) {
    if (respawnSec > nowGameSec) {
      cleaned[id] = respawnSec;
    }
  }
  room.zoneDeadMonsterRespawns.set(zoneKey, cleaned);
  return cleaned;
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(
  room: PartyRoom,
  payload: unknown,
  excludeId?: string
): void {
  const serialized = JSON.stringify(payload);
  for (const [memberId, conn] of room.connections.entries()) {
    if (excludeId && memberId === excludeId) continue;
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(serialized);
    }
  }
}

function broadcastToSameZone(
  room: PartyRoom,
  territoryId: string,
  inBloodCastle: boolean,
  payload: unknown,
  excludeId?: string
): void {
  const serialized = JSON.stringify(payload);
  for (const [memberId, conn] of room.connections.entries()) {
    if (excludeId && memberId === excludeId) continue;
    const peer = room.members.get(memberId);
    if (!peer) continue;
    const isSameZone = inBloodCastle
      ? peer.inBloodCastle
      : !peer.inBloodCastle && peer.territoryId === territoryId;
    if (!isSameZone) continue;
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(serialized);
    }
  }
}

function cancelTradesForMember(room: PartyRoom, memberId: string, reason: string): void {
  for (const [tradeId, trade] of room.activeTrades.entries()) {
    if (trade.initiatorId === memberId || trade.targetId === memberId) {
      room.activeTrades.delete(tradeId);
      const otherId = trade.initiatorId === memberId ? trade.targetId : trade.initiatorId;
      const otherConn = room.connections.get(otherId);
      if (otherConn) {
        sendJson(otherConn.ws, {
          type: 'party:trade_cancelled',
          tradeId,
          reason,
        });
      }
    }
  }
}

function cleanupBloodCastleSnapshotIfEmpty(room: PartyRoom): void {
  let anyInBc = false;
  for (const m of room.members.values()) {
    if (m.inBloodCastle) {
      anyInBc = true;
      break;
    }
  }
  if (!anyInBc) {
    room.zoneSnapshots.delete('blood_castle_event');
    room.zoneDeadMonsterRespawns.delete('blood_castle_event');
  }
}

function removeClientFromCurrentRoom(client: ClientConnection): void {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) return;

  const departingMember = room.members.get(client.id);
  cancelTradesForMember(
    room,
    client.id,
    `${departingMember?.nickname ?? 'Игрок'} вышел из игры.`
  );
  room.members.delete(client.id);
  room.connections.delete(client.id);
  cleanupBloodCastleSnapshotIfEmpty(room);

  if (departingMember) {
    broadcastToRoom(room, {
      type: 'party:member_left',
      memberId: client.id,
      nickname: departingMember.nickname,
    });
  }

  if (room.members.size === 0 && room.connections.size === 0) {
    const nowGameSec = getWorldGameTimeSec(Date.now());
    for (const territoryId of room.zoneWorldMonsters.keys()) {
      syncZoneStateToPersistence(room, territoryId, nowGameSec);
    }
    rooms.delete(room.code);
  }
}

function extractBearerToken(req: express.Request): string {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string') return '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

async function startServer() {
  const app = express();
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  const port =
    process.env.NODE_ENV === 'production' && envPort && envPort !== nginxPort
      ? envPort
      : Number(process.env.DEFAULT_APP_PORT) || SERVER_CONFIG.defaultPort;

  app.disable('x-powered-by');
  app.use(express.json({ limit: SERVER_CONFIG.restJsonBodyLimit }));

  // Read-only server gameplay configuration snapshot (from src/config/*)
  app.get('/api/config', (_req, res) => {
    res.json({
      ok: true,
      config: getPublicServerConfigSnapshot(),
    });
  });

  // Database health & aggregate counts (no sensitive paths or tokens)
  app.get('/api/db/status', (_req, res) => {
    res.json({
      ok: true,
      engine: 'sqlite',
      stats: gameDb.getStats(),
    });
  });

  // Public character summaries / leaderboard
  app.get('/api/characters', (req, res) => {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.floor(rawLimit))) : 50;
    res.json({
      ok: true,
      characters: gameDb.listCharacterSummaries(limit),
    });
  });

  // Create a persistent character profile + items in SQLite; returns per-character ownerToken once
  app.post('/api/characters', (req, res) => {
    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const { record, ownerToken } = gameDb.createCharacter({
        nickname: body.nickname,
        player: body.player,
      });
      res.status(201).json({
        ok: true,
        characterId: record.id,
        ownerToken,
        nickname: record.nickname,
        player: record.player,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    } catch {
      res.status(400).json({ ok: false, error: 'Не удалось создать профиль персонажа.' });
    }
  });

  // Read character: full private state (with equipped/inventory items) if Bearer token matches,
  // or public summary if no Authorization header is sent.
  app.get('/api/characters/:id', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      const result = gameDb.getCharacterForOwner(req.params.id, token);
      if (result.status !== 'ok') {
        if (result.status === 'not_found') {
          res.status(404).json({ ok: false, error: 'Персонаж не найден.' });
          return;
        }
        res.status(403).json({ ok: false, error: 'Недостаточно прав для чтения этого персонажа.' });
        return;
      }
      res.json({ ok: true, character: result.record });
      return;
    }

    const summary = gameDb.getPublicCharacterSummaryById(req.params.id);
    if (!summary) {
      res.status(404).json({ ok: false, error: 'Персонаж не найден.' });
      return;
    }
    res.json({ ok: true, summary });
  });

  // Save/update character stats, jewels, skills, equipped gear & inventory atomically in SQLite
  app.put('/api/characters/:id', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Требуется токен владельца персонажа.' });
      return;
    }
    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const result = gameDb.updateCharacterForOwner({
        characterId: req.params.id,
        ownerToken: token,
        nickname: body.nickname,
        player: body.player,
      });
      if (result.status !== 'ok') {
        if (result.status === 'not_found') {
          res.status(404).json({ ok: false, error: 'Персонаж не найден.' });
          return;
        }
        res.status(403).json({ ok: false, error: 'Нет прав на изменение этого персонажа.' });
        return;
      }
      res.json({
        ok: true,
        characterId: result.record.id,
        nickname: result.record.nickname,
        updatedAt: result.record.updatedAt,
      });
    } catch {
      res.status(400).json({ ok: false, error: 'Ошибка сохранения данных персонажа.' });
    }
  });

  // Recent completed trades audit list
  app.get('/api/trades', (req, res) => {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 20;
    res.json({
      ok: true,
      trades: gameDb.listRecentTrades(limit),
    });
  });

  // REST status endpoint for healthcheck & active party rooms summary
  app.get('/api/party/status', (_req, res) => {
    const activeRooms: {
      code: string;
      memberCount: number;
      maxMembers: number;
      members: { nickname: string; classId: string; level: number; territoryId: string }[];
    }[] = [];
    let totalOnline = 0;

    for (const room of rooms.values()) {
      if (room.members.size === 0) continue;
      totalOnline += room.members.size;
      activeRooms.push({
        code: room.code,
        memberCount: room.members.size,
        maxMembers: MAX_PARTY_SIZE,
        members: Array.from(room.members.values()).map((m) => ({
          nickname: m.nickname,
          classId: m.classId,
          level: m.level,
          territoryId: m.inBloodCastle ? 'blood_castle' : m.territoryId,
        })),
      });
    }

    const nowMs = Date.now();
    res.json({
      ok: true,
      serverNowMs: nowMs,
      uptimeSec: Math.round((nowMs - serverStartedAt) / 1000),
      worldGameTimeSec: Math.round(getWorldGameTimeSec(nowMs)),
      totalOnline,
      activeRooms,
      dbStats: gameDb.getStats(),
    });
  });

  const server = http.createServer(app);

  // Attach WebSocket server on /ws alongside HTTP on the same port
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: SERVER_CONFIG.wsMaxPayloadBytes,
  });

  wss.on('connection', (ws) => {
    const clientId = `hero_${crypto.randomBytes(6).toString('hex')}`;
    const client: ClientConnection = {
      id: clientId,
      ws,
      roomCode: '',
      isAlive: true,
      msgCountWindow: 0,
      windowResetAt: Date.now() + 1000,
    };

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (rawBuffer) => {
      const now = Date.now();
      if (now > client.windowResetAt) {
        client.msgCountWindow = 0;
        client.windowResetAt = now + 1000;
      }
      client.msgCountWindow += 1;
      if (client.msgCountWindow > SERVER_CONFIG.wsMaxPacketsPerSec) {
        return;
      }

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawBuffer.toString('utf8')) as Record<string, unknown>;
      } catch {
        return;
      }

      if (!msg || typeof msg.type !== 'string') return;

      if (msg.type === 'party:join') {
        const requestedCode = sanitizePartyCode(msg.roomCode);
        const nickname = sanitizePlayerNickname(msg.nickname, `Рыцарь-${clientId.slice(-3).toUpperCase()}`);

        let targetCode = requestedCode;
        const candidateRoom = getOrCreateRoom(targetCode);
        if (
          candidateRoom.members.size >= MAX_PARTY_SIZE &&
          !candidateRoom.members.has(clientId)
        ) {
          if (requestedCode === DEFAULT_PARTY_ROOM) {
            let suffix = 2;
            while (
              getOrCreateRoom(`MU-${suffix}`).members.size >= MAX_PARTY_SIZE &&
              suffix < 50
            ) {
              suffix += 1;
            }
            targetCode = `MU-${suffix}`;
          } else {
            sendJson(ws, {
              type: 'party:error',
              message: `Пати #${requestedCode} уже заполнена (${MAX_PARTY_SIZE}/${MAX_PARTY_SIZE} игроков). Выберите другой код пати!`,
            });
            return;
          }
        }

        if (client.roomCode && client.roomCode !== targetCode) {
          removeClientFromCurrentRoom(client);
        }

        client.roomCode = targetCode;
        const room = getOrCreateRoom(targetCode);
        room.connections.set(clientId, client);

        const existing = room.members.get(clientId);
        const memberState: PartyMemberState = {
          id: clientId,
          nickname,
          roomCode: targetCode,
          classId: sanitizeClassId(msg.classId ?? existing?.classId),
          classTier: sanitizeClassTier(msg.classTier ?? existing?.classTier),
          level: clampPositiveInt(msg.level, existing?.level ?? 1, 400),
          resets: clampPositiveInt(msg.resets, existing?.resets ?? 0, 999),
          hp: clampPositiveInt(msg.hp, existing?.hp ?? 350, 100_000_000),
          maxHp: Math.max(1, clampPositiveInt(msg.maxHp, existing?.maxHp ?? 350, 100_000_000)),
          mp: clampPositiveInt(msg.mp, existing?.mp ?? 120, 100_000_000),
          maxMp: Math.max(1, clampPositiveInt(msg.maxMp, existing?.maxMp ?? 120, 100_000_000)),
          territoryId: sanitizeTerritoryId(msg.territoryId ?? existing?.territoryId),
          inBloodCastle: Boolean(msg.inBloodCastle ?? existing?.inBloodCastle),
          x: clampCoord(msg.x ?? existing?.x ?? 0),
          y: clampCoord(msg.y ?? existing?.y ?? 240),
          facingAngle: Number.isFinite(Number(msg.facingAngle))
            ? Number(msg.facingAngle)
            : 0,
          walkDistance: clampPositiveInt(msg.walkDistance, 0, 1_000_000),
          hasWeapon: Boolean(msg.hasWeapon ?? existing?.hasWeapon),
          hasWings: Boolean(msg.hasWings ?? existing?.hasWings),
          activeSkillPattern: null,
          activeSkillColor: '#fbbf24',
          activeSkillTimestamp: 0,
          lastUpdatedAt: now,
        };

        const isNewJoin = !room.members.has(clientId);
        room.members.set(clientId, memberState);

        const joinZoneKey = getPartyZoneKey(memberState.territoryId, memberState.inBloodCastle);
        const nowGameSec = getWorldGameTimeSec(now);
        const zoneChatHistory = room.chatHistory.filter((c) =>
          memberState.inBloodCastle
            ? Boolean(c.inBloodCastle)
            : !c.inBloodCastle && (c.territoryId ?? 'lorencia') === memberState.territoryId
        );

        const initialZoneData = !memberState.inBloodCastle
          ? getLivingSharedMonstersForZone(room, memberState.territoryId, nowGameSec)
          : {
              monsters: room.zoneSnapshots.get(joinZoneKey)?.monsters ?? [],
              deadRespawns: getZoneActiveDeadRespawns(room, joinZoneKey, nowGameSec),
            };

        sendJson(ws, {
          type: 'party:init',
          selfId: clientId,
          roomCode: targetCode,
          serverNowMs: now,
          worldGameTimeSec: nowGameSec,
          territoryId: memberState.territoryId,
          inBloodCastle: memberState.inBloodCastle,
          members: Array.from(room.members.values()),
          chatHistory: zoneChatHistory,
          groundLoot: getZoneActiveGroundLoot(room, joinZoneKey, now),
          zoneMonsters: initialZoneData.monsters,
          deadMonsterRespawns: initialZoneData.deadRespawns,
        });

        if (memberState.inBloodCastle) {
          const existingZoneSnap = room.zoneSnapshots.get(joinZoneKey);
          const joinHostId = electZoneHostId(
            room.members.values(),
            clientId,
            memberState.territoryId,
            memberState.inBloodCastle
          );
          if (
            existingZoneSnap &&
            joinHostId !== clientId &&
            room.members.has(existingZoneSnap.hostId)
          ) {
            sendJson(ws, {
              type: 'party:zone_monsters',
              snapshot: {
                ...existingZoneSnap,
                deadMonsterRespawns: getZoneActiveDeadRespawns(room, joinZoneKey, nowGameSec),
              },
            });
          }
        }

        broadcastToRoom(
          room,
          {
            type: isNewJoin ? 'party:member_joined' : 'party:member_updated',
            member: memberState,
          },
          clientId
        );
        return;
      }

      if (!client.roomCode) return;
      const room = rooms.get(client.roomCode);
      if (!room) return;
      const member = room.members.get(clientId);
      if (!member) return;

      if (msg.type === 'party:sync') {
        const prevZoneKey = getPartyZoneKey(member.territoryId, member.inBloodCastle);
        if (typeof msg.nickname === 'string') {
          member.nickname = sanitizePlayerNickname(msg.nickname, member.nickname);
        }
        member.classId = sanitizeClassId(msg.classId ?? member.classId);
        member.classTier = sanitizeClassTier(msg.classTier ?? member.classTier);
        member.level = clampPositiveInt(msg.level, member.level, 400);
        member.resets = clampPositiveInt(msg.resets, member.resets, 999);
        member.hp = clampPositiveInt(msg.hp, member.hp, 100_000_000);
        member.maxHp = Math.max(1, clampPositiveInt(msg.maxHp, member.maxHp, 100_000_000));
        member.mp = clampPositiveInt(msg.mp, member.mp, 100_000_000);
        member.maxMp = Math.max(1, clampPositiveInt(msg.maxMp, member.maxMp, 100_000_000));
        member.territoryId = sanitizeTerritoryId(msg.territoryId ?? member.territoryId);
        member.inBloodCastle = Boolean(msg.inBloodCastle);
        member.x = clampCoord(msg.x);
        member.y = clampCoord(msg.y);
        if (Number.isFinite(Number(msg.facingAngle))) {
          member.facingAngle = Number(msg.facingAngle);
        }
        if (Number.isFinite(Number(msg.walkDistance))) {
          member.walkDistance = Number(msg.walkDistance);
        }
        member.hasWeapon = Boolean(msg.hasWeapon);
        member.hasWings = Boolean(msg.hasWings);
        member.lastUpdatedAt = now;

        const nextZoneKey = getPartyZoneKey(member.territoryId, member.inBloodCastle);
        if (nextZoneKey !== prevZoneKey) {
          if (prevZoneKey === 'blood_castle_event') {
            cleanupBloodCastleSnapshotIfEmpty(room);
          }
          cancelTradesForMember(room, clientId, `${member.nickname} перешёл в другую локацию.`);

          const nowGameSec = getWorldGameTimeSec(now);
          const nextZoneData = !member.inBloodCastle
            ? getLivingSharedMonstersForZone(room, member.territoryId, nowGameSec)
            : {
                monsters: room.zoneSnapshots.get(nextZoneKey)?.monsters ?? [],
                deadRespawns: getZoneActiveDeadRespawns(room, nextZoneKey, nowGameSec),
              };

          sendJson(ws, {
            type: 'party:zone_state',
            serverNowMs: now,
            worldGameTimeSec: nowGameSec,
            territoryId: member.territoryId,
            inBloodCastle: member.inBloodCastle,
            groundLoot: getZoneActiveGroundLoot(room, nextZoneKey, now),
            zoneMonsters: nextZoneData.monsters,
            deadMonsterRespawns: nextZoneData.deadRespawns,
          });

          if (member.inBloodCastle) {
            const snap = room.zoneSnapshots.get(nextZoneKey);
            const zoneHostId = electZoneHostId(
              room.members.values(),
              clientId,
              member.territoryId,
              member.inBloodCastle
            );
            if (snap && zoneHostId !== clientId && room.members.has(snap.hostId)) {
              sendJson(ws, {
                type: 'party:zone_monsters',
                snapshot: {
                  ...snap,
                  deadMonsterRespawns: getZoneActiveDeadRespawns(room, nextZoneKey, nowGameSec),
                },
              });
            }
          }
        }

        broadcastToRoom(
          room,
          {
            type: 'party:member_updated',
            member,
          },
          clientId
        );
        return;
      }

      if (msg.type === 'party:request_zone_state') {
        const nowGameSec = getWorldGameTimeSec(now);
        const zoneKey = getPartyZoneKey(member.territoryId, member.inBloodCastle);
        const zoneData = !member.inBloodCastle
          ? getLivingSharedMonstersForZone(room, member.territoryId, nowGameSec)
          : {
              monsters: room.zoneSnapshots.get(zoneKey)?.monsters ?? [],
              deadRespawns: getZoneActiveDeadRespawns(room, zoneKey, nowGameSec),
            };
        sendJson(ws, {
          type: 'party:zone_state',
          serverNowMs: now,
          worldGameTimeSec: nowGameSec,
          territoryId: member.territoryId,
          inBloodCastle: member.inBloodCastle,
          groundLoot: getZoneActiveGroundLoot(room, zoneKey, now),
          zoneMonsters: zoneData.monsters,
          deadMonsterRespawns: zoneData.deadRespawns,
        });
        return;
      }

      if (msg.type === 'party:damage_monster') {
        const enemyId = sanitizeEnemyId(msg.enemyId);
        if (!enemyId || member.inBloodCastle) return;
        const damage = clampPositiveInt(msg.damage, 1, 50_000_000);
        const nowGameSec = getWorldGameTimeSec(now);
        const territoryId = member.territoryId;
        const zoneMap = getOrInitZoneWorldMonsters(room, territoryId, nowGameSec);

        // Update optional monster coordinates if provided for accurate loot drop position
        const existingUnit = zoneMap.get(enemyId);
        if (existingUnit && existingUnit.alive) {
          if (Number.isFinite(Number(msg.x))) existingUnit.x = clampCoord(msg.x);
          if (Number.isFinite(Number(msg.y))) existingUnit.y = clampCoord(msg.y);
        }

        const result = applyServerMonsterDamage(
          zoneMap,
          enemyId,
          damage,
          nowGameSec,
          Boolean(msg.applyChill)
        );
        if (!result.found || result.alreadyDead || !result.unit) return;

        syncZoneStateToPersistence(room, territoryId, nowGameSec);

        if (result.killed) {
          const killedEvent: ServerMonsterKilledEvent = {
            territoryId,
            inBloodCastle: false,
            enemyId: result.unit.id,
            monsterName: result.unit.name,
            isBoss: result.unit.isBoss,
            isQuestMonster: result.unit.isQuestMonster,
            killerId: clientId,
            killerNickname: member.nickname,
            expReward: result.unit.expReward,
            zenReward: result.unit.zenReward,
            x: Math.round(result.unit.x),
            y: Math.round(result.unit.y),
            anchorX: Math.round(result.unit.anchorX),
            anchorY: Math.round(result.unit.anchorY),
            respawnAtGameTimeSec: result.respawnAtGameTimeSec,
            respawnDurationSec: result.unit.respawnDurationSec,
            timestamp: now,
          };

          broadcastToSameZone(room, territoryId, false, {
            type: 'party:monster_killed',
            event: killedEvent,
          });
        } else {
          const hpEvent: ServerMonsterHpEvent = {
            territoryId,
            inBloodCastle: false,
            enemyId: result.unit.id,
            hp: result.unit.hp,
            maxHp: result.unit.maxHp,
            damage: result.appliedDamage,
            attackerId: clientId,
            attackerNickname: member.nickname,
            isCrit: Boolean(msg.isCrit),
            isDouble: Boolean(msg.isDouble),
            applyChill: Boolean(msg.applyChill),
            timestamp: now,
          };

          broadcastToSameZone(room, territoryId, false, {
            type: 'party:monster_hp',
            event: hpEvent,
          });
        }
        return;
      }

      if (msg.type === 'party:spawn_boss') {
        if (member.inBloodCastle) return;
        // Golden Bosses strictly follow the 15-minute Server-Time schedule (max 1 per territory).
        // Checking via reviveAndBroadcastDueZoneMonsters prevents manual or duplicate spawns.
        const territoryId = member.territoryId;
        const nowGameSec = getWorldGameTimeSec(now);
        getOrInitZoneWorldMonsters(room, territoryId, nowGameSec, now);
        reviveAndBroadcastDueZoneMonsters(room, territoryId, now, nowGameSec);
        return;
      }

      if (msg.type === 'party:monsters_sync') {
        const territoryId = sanitizeTerritoryId(msg.territoryId ?? member.territoryId);
        const inBloodCastle = Boolean(msg.inBloodCastle ?? member.inBloodCastle);
        const electedHostId = electZoneHostId(
          room.members.values(),
          clientId,
          territoryId,
          inBloodCastle
        );
        if (electedHostId !== clientId) {
          return;
        }

        const zoneKey = getPartyZoneKey(territoryId, inBloodCastle);
        const nowGameSec = getWorldGameTimeSec(now);

        if (!inBloodCastle) {
          // For regular territories, the server is authoritative for HP, alive state, and individual respawn timers.
          // The elected Zone Host only streams AI movement/positions for living monsters!
          const zoneMap = getOrInitZoneWorldMonsters(room, territoryId, nowGameSec);
          const incomingMoves = sanitizeSharedMonsterList(msg.monsters);
          for (const sm of incomingMoves) {
            const unit = zoneMap.get(sm.id);
            if (!unit || !unit.alive) continue;
            unit.x = sm.x;
            unit.y = sm.y;
            unit.aiState = sm.aiState === 'ko' ? 'move' : sm.aiState;
            unit.telegraphX = sm.telegraphX;
            unit.telegraphY = sm.telegraphY;
            unit.facingAngle = sm.facingAngle;
            unit.walkDistance = sm.walkDistance;
            unit.chillTimer = sm.chillTimer;
            unit.orbitDirection = sm.orbitDirection;
          }

          const { monsters, deadRespawns } = getLivingSharedMonstersForZone(
            room,
            territoryId,
            nowGameSec
          );
          const snapshot: PartyZoneMonsterSnapshot = {
            hostId: clientId,
            territoryId,
            inBloodCastle: false,
            bossSpawnedForTerritory: Boolean(zoneMap.get(`boss_${territoryId}`)?.alive),
            bcStage: 'kill_100',
            bcBridgeKills: 0,
            monsters,
            deadMonsterRespawns: deadRespawns,
            timestamp: now,
          };

          room.zoneSnapshots.set(zoneKey, snapshot);

          broadcastToSameZone(
            room,
            territoryId,
            false,
            {
              type: 'party:zone_monsters',
              snapshot,
            },
            clientId
          );
          return;
        }

        const incomingDead = sanitizeDeadMonsterRespawns(msg.deadMonsterRespawns);
        const currentDead = getZoneActiveDeadRespawns(room, zoneKey, nowGameSec);
        const mergedDead = { ...currentDead, ...incomingDead };
        room.zoneDeadMonsterRespawns.set(zoneKey, mergedDead);

        const monsters = sanitizeSharedMonsterList(msg.monsters);
        const bcTimeRemainingSec = Number.isFinite(Number(msg.bcTimeRemainingSec))
          ? Math.max(
              0,
              Math.min(BLOOD_CASTLE_CONFIG.timeLimitSec, Math.round(Number(msg.bcTimeRemainingSec)))
            )
          : undefined;
        const snapshot: PartyZoneMonsterSnapshot = {
          hostId: clientId,
          territoryId,
          inBloodCastle: true,
          bossSpawnedForTerritory: Boolean(msg.bossSpawnedForTerritory),
          bcStage: sanitizeBloodCastleStage(msg.bcStage),
          bcBridgeKills: clampPositiveInt(msg.bcBridgeKills, 0, 10_000),
          bcTimeRemainingSec,
          monsters,
          deadMonsterRespawns: mergedDead,
          timestamp: now,
        };

        room.zoneSnapshots.set(zoneKey, snapshot);

        broadcastToSameZone(
          room,
          territoryId,
          true,
          {
            type: 'party:zone_monsters',
            snapshot,
          },
          clientId
        );
        return;
      }

      if (msg.type === 'party:attack') {
        const pattern = sanitizeSkillPattern(msg.pattern) ?? 'primary';
        const skillColor =
          typeof msg.skillColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(msg.skillColor)
            ? msg.skillColor
            : '#fbbf24';

        member.activeSkillPattern = pattern;
        member.activeSkillColor = skillColor;
        member.activeSkillTimestamp = now;
        member.x = clampCoord(msg.x ?? member.x);
        member.y = clampCoord(msg.y ?? member.y);
        if (Number.isFinite(Number(msg.facingAngle))) {
          member.facingAngle = Number(msg.facingAngle);
        }

        const attackEvent: PartyAttackEvent = {
          attackerId: clientId,
          nickname: member.nickname,
          classId: member.classId,
          territoryId: member.territoryId,
          inBloodCastle: member.inBloodCastle,
          x: member.x,
          y: member.y,
          targetX: clampCoord(msg.targetX ?? member.x),
          targetY: clampCoord(msg.targetY ?? member.y),
          facingAngle: member.facingAngle,
          pattern,
          skillColor,
          damage: clampPositiveInt(msg.damage, 45, 50_000_000),
          aoeRadius: clampPositiveInt(msg.aoeRadius, 160, 650),
          hitEnemyIds: sanitizeHitEnemyIds(msg.hitEnemyIds),
          timestamp: now,
        };

        broadcastToRoom(
          room,
          {
            type: 'party:remote_attack',
            attack: attackEvent,
          },
          clientId
        );
        return;
      }

      if (msg.type === 'party:kill') {
        const monsterName =
          typeof msg.monsterName === 'string'
            ? msg.monsterName.replace(/[\u0000-\u001F<>]/g, '').slice(0, 48)
            : 'Монстр';
        const enemyId = sanitizeEnemyId(msg.enemyId);
        const nowGameSec = getWorldGameTimeSec(now);
        const respawnAtGameTimeSec =
          Number.isFinite(Number(msg.respawnAtGameTimeSec)) && Number(msg.respawnAtGameTimeSec) > nowGameSec
            ? Math.round(Number(msg.respawnAtGameTimeSec) * 100) / 100
            : Math.round((nowGameSec + INDIVIDUAL_MONSTER_RESPAWN_SEC) * 100) / 100;

        const killEvent: PartyKillShareEvent = {
          killerId: clientId,
          killerNickname: member.nickname,
          territoryId: member.territoryId,
          inBloodCastle: member.inBloodCastle,
          enemyId: enemyId || undefined,
          respawnAtGameTimeSec,
          monsterName,
          isBoss: Boolean(msg.isBoss),
          expShare: clampPositiveInt(msg.expShare, 20, 50_000_000),
          zenShare: clampPositiveInt(msg.zenShare, 15, 5_000_000),
          x: clampCoord(msg.x ?? member.x),
          y: clampCoord(msg.y ?? member.y),
          timestamp: now,
        };

        if (enemyId) {
          const zoneKey = getPartyZoneKey(member.territoryId, member.inBloodCastle);
          const deadMap = getZoneActiveDeadRespawns(room, zoneKey, nowGameSec);
          deadMap[enemyId] = respawnAtGameTimeSec;
          room.zoneDeadMonsterRespawns.set(zoneKey, deadMap);

          const snap = room.zoneSnapshots.get(zoneKey);
          if (snap) {
            snap.monsters = snap.monsters.filter((m) => m.id !== enemyId);
            snap.deadMonsterRespawns = deadMap;
          }
        }

        broadcastToRoom(
          room,
          {
            type: 'party:shared_kill',
            kill: killEvent,
          },
          clientId
        );
        return;
      }

      if (msg.type === 'party:chat') {
        const text = sanitizePartyChatText(msg.text);
        if (!text) return;

        const chatMessage: PartyChatMessage = {
          id: `msg_${crypto.randomBytes(5).toString('hex')}`,
          senderId: clientId,
          nickname: member.nickname,
          classId: member.classId,
          territoryId: member.territoryId,
          inBloodCastle: member.inBloodCastle,
          text,
          timestamp: now,
        };

        room.chatHistory.push(chatMessage);
        if (room.chatHistory.length > SERVER_CONFIG.maxChatHistoryPerRoom) {
          room.chatHistory.shift();
        }

        member.chatBubbleText = text;
        member.chatBubbleExpiresAt = now + 6500;

        // Broadcast chat message to everyone who is currently in the same location/territory
        sendJson(ws, {
          type: 'party:chat_message',
          message: chatMessage,
        });
        broadcastToSameZone(
          room,
          member.territoryId,
          member.inBloodCastle,
          {
            type: 'party:chat_message',
            message: chatMessage,
          },
          clientId
        );
        return;
      }

      if (msg.type === 'party:drop_item') {
        const sanitizedDrop = sanitizeGroundLootDrop(msg.drop, now);
        if (!sanitizedDrop) return;
        sanitizedDrop.droppedByNickname = member.nickname;

        const zoneKey = getPartyZoneKey(member.territoryId, member.inBloodCastle);
        const list = getZoneActiveGroundLoot(room, zoneKey, now);
        if (!list.some((d) => d.id === sanitizedDrop.id)) {
          list.push(sanitizedDrop);
          if (list.length > SERVER_CONFIG.maxGroundLootPerZone) {
            list.shift();
          }
          room.zoneGroundLoot.set(zoneKey, list);
        }

        broadcastToSameZone(
          room,
          member.territoryId,
          member.inBloodCastle,
          {
            type: 'party:ground_item_dropped',
            territoryId: member.territoryId,
            inBloodCastle: member.inBloodCastle,
            drop: sanitizedDrop,
          }
        );
        return;
      }

      if (msg.type === 'party:pickup_item') {
        const dropId = sanitizeEnemyId(msg.dropId);
        if (!dropId) return;
        const zoneKey = getPartyZoneKey(member.territoryId, member.inBloodCastle);
        const list = getZoneActiveGroundLoot(room, zoneKey, now);
        if (list.some((d) => d.id === dropId)) {
          room.zoneGroundLoot.set(
            zoneKey,
            list.filter((d) => d.id !== dropId)
          );
        }

        broadcastToSameZone(
          room,
          member.territoryId,
          member.inBloodCastle,
          {
            type: 'party:ground_item_picked',
            territoryId: member.territoryId,
            inBloodCastle: member.inBloodCastle,
            dropId,
            pickerId: clientId,
            pickerNickname: member.nickname,
          },
          clientId
        );
        return;
      }

      // PLAYER-TO-PLAYER REAL-TIME TRADE PROTOCOL
      if (msg.type === 'party:trade_request') {
        const targetId = sanitizeEnemyId(msg.targetId);
        if (!targetId || targetId === clientId) return;
        const targetMember = room.members.get(targetId);
        const targetConn = room.connections.get(targetId);
        if (!targetMember || !targetConn) {
          sendJson(ws, {
            type: 'party:error',
            message: 'Игрок для обмена не найден.',
          });
          return;
        }
        const sameZone = member.inBloodCastle
          ? targetMember.inBloodCastle
          : !targetMember.inBloodCastle && targetMember.territoryId === member.territoryId;
        if (!sameZone) {
          sendJson(ws, {
            type: 'party:error',
            message: `Трейд возможен только на одной локации! ${targetMember.nickname} находится в другой локации.`,
          });
          return;
        }

        // Cancel any previous open trades for either player
        cancelTradesForMember(room, clientId, 'Открыт новый обмен.');
        cancelTradesForMember(room, targetId, 'Открыт новый обмен.');

        const tradeId = `trd_${crypto.randomBytes(5).toString('hex')}`;
        const session: PlayerTradeSession = {
          tradeId,
          initiatorId: clientId,
          initiatorNickname: member.nickname,
          targetId,
          targetNickname: targetMember.nickname,
          territoryId: member.territoryId,
          inBloodCastle: member.inBloodCastle,
          status: 'pending',
          offers: {
            [clientId]: {
              zen: 0,
              items: [],
              jewels: { bless: 0, soul: 0, life: 0, chaos: 0 },
              locked: false,
            },
            [targetId]: {
              zen: 0,
              items: [],
              jewels: { bless: 0, soul: 0, life: 0, chaos: 0 },
              locked: false,
            },
          },
        };
        room.activeTrades.set(tradeId, session);

        sendJson(ws, {
          type: 'party:trade_updated',
          session,
        });
        sendJson(targetConn.ws, {
          type: 'party:trade_updated',
          session,
        });
        return;
      }

      if (msg.type === 'party:trade_respond') {
        const tradeId = sanitizeEnemyId(msg.tradeId);
        const accept = Boolean(msg.accept);
        const session = room.activeTrades.get(tradeId);
        if (!session) return;
        if (session.targetId !== clientId && session.initiatorId !== clientId) return;

        const initConn = room.connections.get(session.initiatorId);
        const targConn = room.connections.get(session.targetId);

        if (!accept) {
          room.activeTrades.delete(tradeId);
          if (initConn) {
            sendJson(initConn.ws, {
              type: 'party:trade_cancelled',
              tradeId,
              reason: `${member.nickname} отклонил трейд.`,
            });
          }
          if (targConn) {
            sendJson(targConn.ws, {
              type: 'party:trade_cancelled',
              tradeId,
              reason: 'Трейд отменён.',
            });
          }
          return;
        }

        session.status = 'active';
        if (initConn) {
          sendJson(initConn.ws, {
            type: 'party:trade_updated',
            session,
          });
        }
        if (targConn) {
          sendJson(targConn.ws, {
            type: 'party:trade_updated',
            session,
          });
        }
        return;
      }

      if (msg.type === 'party:trade_update_offer') {
        const tradeId = sanitizeEnemyId(msg.tradeId);
        const session = room.activeTrades.get(tradeId);
        if (!session || session.status !== 'active') return;
        if (session.initiatorId !== clientId && session.targetId !== clientId) return;

        const nextOffer = sanitizeTradeSideOffer(msg.offer);
        const prevOffer = session.offers[clientId];
        const partnerId =
          session.initiatorId === clientId ? session.targetId : session.initiatorId;

        // If the player changed their items/zen/jewels after partner locked, unlock partner to prevent bait-and-switch
        const contentChanged =
          !prevOffer ||
          prevOffer.zen !== nextOffer.zen ||
          JSON.stringify(prevOffer.jewels) !== JSON.stringify(nextOffer.jewels) ||
          JSON.stringify(prevOffer.items.map((i) => i.id)) !==
            JSON.stringify(nextOffer.items.map((i) => i.id));

        session.offers[clientId] = nextOffer;
        if (contentChanged && session.offers[partnerId]) {
          session.offers[partnerId].locked = false;
        }

        const initConn = room.connections.get(session.initiatorId);
        const targConn = room.connections.get(session.targetId);

        if (
          session.offers[session.initiatorId]?.locked &&
          session.offers[session.targetId]?.locked
        ) {
          session.status = 'completed';
          room.activeTrades.delete(tradeId);
          try {
            gameDb.logCompletedTrade(room.code, session);
          } catch (err) {
            console.error('[MU DB] Failed to log completed trade:', err);
          }
          if (initConn) {
            sendJson(initConn.ws, {
              type: 'party:trade_completed',
              session,
            });
          }
          if (targConn) {
            sendJson(targConn.ws, {
              type: 'party:trade_completed',
              session,
            });
          }
          return;
        }

        if (initConn) {
          sendJson(initConn.ws, {
            type: 'party:trade_updated',
            session,
          });
        }
        if (targConn) {
          sendJson(targConn.ws, {
            type: 'party:trade_updated',
            session,
          });
        }
        return;
      }

      if (msg.type === 'party:trade_cancel') {
        const tradeId = sanitizeEnemyId(msg.tradeId);
        const session = room.activeTrades.get(tradeId);
        if (!session) return;
        if (session.initiatorId !== clientId && session.targetId !== clientId) return;
        room.activeTrades.delete(tradeId);

        const initConn = room.connections.get(session.initiatorId);
        const targConn = room.connections.get(session.targetId);
        if (initConn) {
          sendJson(initConn.ws, {
            type: 'party:trade_cancelled',
            tradeId,
            reason: `${member.nickname} отменил обмен.`,
          });
        }
        if (targConn) {
          sendJson(targConn.ws, {
            type: 'party:trade_cancelled',
            tradeId,
            reason: `${member.nickname} отменил обмен.`,
          });
        }
      }
    });

    ws.on('close', () => {
      removeClientFromCurrentRoom(client);
    });

    ws.on('error', () => {
      removeClientFromCurrentRoom(client);
    });
  });

  // Continuous 2Hz Server-Time Individual Monster Respawn Ticker (checks all active territories)
  const respawnInterval = setInterval(() => {
    const nowMs = Date.now();
    const nowGameSec = getWorldGameTimeSec(nowMs);
    for (const room of rooms.values()) {
      if (room.members.size === 0) continue;
      const activeTerritories = new Set<TerritoryId>();
      for (const m of room.members.values()) {
        if (!m.inBloodCastle) {
          activeTerritories.add(m.territoryId);
        }
      }
      for (const territoryId of activeTerritories) {
        reviveAndBroadcastDueZoneMonsters(room, territoryId, nowMs, nowGameSec);
      }
    }
  }, SERVER_CONFIG.worldRespawnTickMs);

  // Periodic WebSocket heartbeat, stale member cleanup & ground loot expiration
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      for (const zoneKey of room.zoneGroundLoot.keys()) {
        getZoneActiveGroundLoot(room, zoneKey, now);
      }
      for (const conn of room.connections.values()) {
        if (!conn.isAlive) {
          conn.ws.terminate();
          removeClientFromCurrentRoom(conn);
          continue;
        }
        conn.isAlive = false;
        conn.ws.ping();
      }
    }
  }, SERVER_CONFIG.wsHeartbeatIntervalMs);

  wss.on('close', () => {
    clearInterval(respawnInterval);
    clearInterval(heartbeatInterval);
    flushDirtyWorldStatesToDb();
  });


  // Serve Vite in dev or built static files in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.resolve(distDir, 'index.html');
      if (!indexFile.startsWith(distDir + path.sep)) {
        res.status(403).end();
        return;
      }
      res.sendFile(indexFile);
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`[MU Party Server] Running on http://0.0.0.0:${port} (WebSocket: /ws)`);
  });

  let shuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[MU Party Server] Received ${signal}, flushing SQLite & shutting down...`);
    clearInterval(respawnInterval);
    clearInterval(heartbeatInterval);
    try {
      flushDirtyWorldStatesToDb();
      gameDb.close();
    } catch (err) {
      console.error('[MU Party Server] Error during DB shutdown:', err);
    }
    wss.close(() => {
      server.close(() => {
        process.exit(0);
      });
    });
    setTimeout(() => process.exit(0), 2500).unref();
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('Failed to start MU Party Server:', err);
  process.exit(1);
});
