import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { GameDatabase, MAX_CHARACTERS_PER_ACCOUNT } from './server/db.ts';
import {
  BLOOD_CASTLE_CONFIG,
  SERVER_CONFIG,
  getPublicServerConfigSnapshot,
} from './src/config/index.ts';
import {
  DEFAULT_PARTY_ROOM,
  INDIVIDUAL_MONSTER_RESPAWN_SEC,
  MAX_PARTY_SIZE,
  MAX_WORLD_PLAYERS,
  PARTY_EXP_RANGE_METERS,
  WS_CLOSE_SESSION_REPLACED,
  clampCoord,
  clampPositiveInt,
  electZoneHostId,
  findDuplicateSessionClientIds,
  getEligiblePartyExpRecipients,
  getPartyZoneKey,
  getWorldGameTimeSec,
  isGroundLootExpired,
  resolvePartyLootRecipient,
  sanitizeBloodCastleStage,
  sanitizeClassId,
  sanitizeClassTier,
  sanitizeClientSessionKey,
  sanitizeDeadMonsterRespawns,
  sanitizeEnemyId,
  sanitizeGroundLootDrop,
  sanitizeHitEnemyIds,
  sanitizePartyChatText,
  sanitizePartyCode,
  sanitizePartyLootMode,
  sanitizePlayerNickname,
  sanitizeSharedMonsterList,
  sanitizeSkillPattern,
  sanitizeTerritoryId,
  sanitizeTradeSideOffer,
} from './src/game/party.ts';
import { generateMonsterGroundDrops } from './src/game/rules.ts';
import {
  ServerMonsterUnit,
  ServerSimPlayerTarget,
  applyServerMonsterDamage,
  createInitialZoneMonsterMap,
  createTerritoryBossUnit,
  evaluateGoldenBoss15MinSpawn,
  extractDeadRespawnsRecord,
  getGoldenBossSlotIndex,
  reviveDueServerMonsters,
  stepServerZoneMonsters,
  toSharedMonsterState,
} from './src/game/worldMonsters.ts';
import type {
  ActivePartyState,
  LootDrop,
  PartyAttackEvent,
  PartyChatMessage,
  PartyInvitePayload,
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
  accountId: string | null;
  characterId: string | null;
  clientSessionKey: string | null;
  replacedByNewSession: boolean;
  isAlive: boolean;
  msgCountWindow: number;
  windowResetAt: number;
}

interface PartyRoom {
  code: string;
  members: Map<string, PartyMemberState>;
  connections: Map<string, ClientConnection>;
  parties: Map<string, ActivePartyState>;
  memberToPartyId: Map<string, string>;
  pendingInvites: Map<string, PartyInvitePayload & { targetId: string }>;
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
      parties: new Map(),
      memberToPartyId: new Map(),
      pendingInvites: new Map(),
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

function persistClientRuntimeVitals(client: ClientConnection, room: PartyRoom): void {
  if (!client.accountId || !client.characterId) return;
  const member = room.members.get(client.id);
  if (!member) return;
  try {
    gameDb.updateCharacterRuntimeVitals({
      characterId: client.characterId,
      accountId: client.accountId,
      territoryId: member.territoryId,
      inBloodCastle: member.inBloodCastle,
      posX: member.x,
      posY: member.y,
      currentHp: member.hp,
      currentMp: member.mp,
    });
  } catch (err) {
    console.error('[MU DB] Failed persisting runtime character vitals:', err);
  }
}

function getPartyForMember(room: PartyRoom, memberId: string): ActivePartyState | null {
  const partyId = room.memberToPartyId.get(memberId);
  if (!partyId) return null;
  return room.parties.get(partyId) ?? null;
}

function sendPartySystemNotice(
  room: PartyRoom,
  memberIds: Iterable<string>,
  text: string,
  nowMs = Date.now()
): void {
  const sysMsg: PartyChatMessage = {
    id: `sys_pty_${nowMs}_${crypto.randomBytes(3).toString('hex')}`,
    senderId: 'system',
    nickname: 'Группа',
    classId: 'dark_knight',
    text,
    timestamp: nowMs,
    isSystem: true,
  };
  for (const id of memberIds) {
    const conn = room.connections.get(id);
    if (conn) {
      sendJson(conn.ws, {
        type: 'party:chat_message',
        message: sysMsg,
      });
    }
  }
}

function syncPartyGroupUpdate(
  room: PartyRoom,
  affectedMemberIds: Iterable<string>,
  party: ActivePartyState | null
): void {
  for (const id of affectedMemberIds) {
    const m = room.members.get(id);
    if (m) {
      m.partyId = party && party.memberIds.includes(id) ? party.partyId : null;
      broadcastToRoom(room, { type: 'party:member_updated', member: m }, id);
    }
    const conn = room.connections.get(id);
    if (conn) {
      sendJson(conn.ws, {
        type: 'party:group_updated',
        party: party && party.memberIds.includes(id) ? party : null,
      });
    }
  }
}

function removeMemberFromFormedParty(
  room: PartyRoom,
  memberId: string,
  noticeText?: string,
  nowMs = Date.now()
): void {
  // Clean up pending invites involving this player
  for (const [invId, inv] of room.pendingInvites.entries()) {
    if (inv.fromId === memberId || inv.targetId === memberId || inv.expiresAt <= nowMs) {
      room.pendingInvites.delete(invId);
    }
  }

  const partyId = room.memberToPartyId.get(memberId);
  if (!partyId) return;
  room.memberToPartyId.delete(memberId);

  const party = room.parties.get(partyId);
  if (!party) return;

  const previousMembers = [...party.memberIds];
  party.memberIds = party.memberIds.filter((id) => id !== memberId);

  const removedMember = room.members.get(memberId);
  if (removedMember) {
    removedMember.partyId = null;
  }

  if (party.memberIds.length < 2) {
    // Disband party when fewer than 2 players remain
    room.parties.delete(partyId);
    for (const remId of party.memberIds) {
      room.memberToPartyId.delete(remId);
    }
    if (noticeText) {
      sendPartySystemNotice(room, previousMembers, `${noticeText} Группа расформирована.`, nowMs);
    }
    syncPartyGroupUpdate(room, previousMembers, null);
    return;
  }

  if (party.leaderId === memberId) {
    party.leaderId = party.memberIds[0];
  }

  if (noticeText) {
    sendPartySystemNotice(room, party.memberIds, noticeText, nowMs);
  }
  syncPartyGroupUpdate(room, [memberId], null);
  syncPartyGroupUpdate(room, party.memberIds, party);
}

function removeClientFromCurrentRoom(client: ClientConnection): void {
  if (!client.roomCode) return;
  const prevRoomCode = client.roomCode;
  client.roomCode = '';
  const room = rooms.get(prevRoomCode);
  if (!room) return;

  persistClientRuntimeVitals(client, room);

  const departingMember = room.members.get(client.id);
  removeMemberFromFormedParty(
    room,
    client.id,
    `${departingMember?.nickname ?? 'Игрок'} вышел из группы.`
  );
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

/**
 * Authoritatively guarantees at most ONE active live player instance per account,
 * character, or browser session across all server rooms. Any superseded older tab/socket
 * is cleanly persisted, removed from its room/party/trade, notified via
 * `party:session_replaced`, and closed with WS_CLOSE_SESSION_REPLACED (4001).
 */
function evictDuplicateSessions(incoming: ClientConnection): number {
  const allConnections = new Map<string, ClientConnection>();
  for (const room of rooms.values()) {
    for (const [connId, conn] of room.connections.entries()) {
      allConnections.set(connId, conn);
    }
  }

  const duplicateIds = findDuplicateSessionClientIds(allConnections.values(), {
    id: incoming.id,
    accountId: incoming.accountId,
    characterId: incoming.characterId,
    clientSessionKey: incoming.clientSessionKey,
  });

  for (const dupId of duplicateIds) {
    const dupConn = allConnections.get(dupId);
    if (!dupConn) continue;
    dupConn.replacedByNewSession = true;
    removeClientFromCurrentRoom(dupConn);
    sendJson(dupConn.ws, {
      type: 'party:session_replaced',
      reason: 'Ваш персонаж или аккаунт уже открыт в другой вкладке или окне.',
    });
    if (dupConn.ws.readyState === WebSocket.OPEN || dupConn.ws.readyState === WebSocket.CONNECTING) {
      dupConn.ws.close(WS_CLOSE_SESSION_REPLACED, 'session_replaced');
    }
  }

  return duplicateIds.length;
}

const SESSION_COOKIE_NAME = 'mu_session';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function isRequestHttps(req: express.Request): boolean {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim().toLowerCase() === 'https') {
    return true;
  }
  return Boolean(req.secure);
}

function setSessionCookie(req: express.Request, res: express.Response, sessionToken: string): void {
  const maxAgeSec = 60 * 60 * 24 * 365; // 1 year persistent session
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAgeSec}`,
  ];
  if (isRequestHttps(req)) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function resolveExistingAccountId(req: http.IncomingMessage): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return null;
  return gameDb.getAccountIdBySessionToken(rawToken);
}

function resolveOrCreateAccount(req: express.Request, res: express.Response): string {
  const existing = resolveExistingAccountId(req);
  if (existing) return existing;
  const created = gameDb.createAccount();
  setSessionCookie(req, res, created.sessionToken);
  return created.accountId;
}

function verifyMutationOriginOrHeader(req: express.Request): boolean {
  const xrw = req.headers['x-requested-with'];
  if (typeof xrw === 'string' && xrw.toLowerCase() === 'xmlhttprequest') {
    return true;
  }
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] ?? req.headers.host ?? '').toString().split(',')[0].trim().toLowerCase();
  if (typeof origin === 'string' && host) {
    try {
      const parsed = new URL(origin);
      if (parsed.host.toLowerCase() === host) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
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

  // Account session bootstrap & list of saved characters (0..3 slots)
  app.get('/api/account/me', (req, res) => {
    const accountId = resolveOrCreateAccount(req, res);
    res.json({
      ok: true,
      accountId,
      maxSlots: MAX_CHARACTERS_PER_ACCOUNT,
      characters: gameDb.listAccountCharacters(accountId),
    });
  });

  // Live check whether a character name is unique across the entire server
  app.get('/api/characters/check-name', (req, res) => {
    const rawName = typeof req.query.name === 'string' ? req.query.name : '';
    const check = gameDb.isNicknameAvailable(rawName);
    res.json({
      ok: true,
      ...check,
    });
  });

  // Create a new character in the player's account (max 3 slots, server-wide unique name)
  app.post('/api/account/characters', (req, res) => {
    if (!verifyMutationOriginOrHeader(req)) {
      res.status(403).json({ ok: false, error: 'Недопустимый источник запроса.' });
      return;
    }
    const accountId = resolveOrCreateAccount(req, res);
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    const result = gameDb.createCharacterForAccount({
      accountId,
      nickname: body.nickname,
      classId: body.classId,
    });
    if (result.status !== 'ok') {
      const httpCode = result.status === 'name_taken' || result.status === 'limit_reached' ? 409 : 400;
      res.status(httpCode).json({
        ok: false,
        code: result.status,
        error: result.error,
      });
      return;
    }
    res.status(201).json({
      ok: true,
      character: result.record,
    });
  });

  // Fetch full saved character state (including server coordinates & HP/MP) owned by current account
  app.get('/api/account/characters/:id', (req, res) => {
    const accountId = resolveExistingAccountId(req);
    if (!accountId) {
      res.status(401).json({ ok: false, error: 'Сессия аккаунта не найдена.' });
      return;
    }
    const result = gameDb.getCharacterForAccount(req.params.id, accountId);
    if (result.status !== 'ok') {
      if (result.status === 'not_found') {
        res.status(404).json({ ok: false, error: 'Персонаж не найден.' });
        return;
      }
      res.status(403).json({ ok: false, error: 'Нет доступа к этому персонажу.' });
      return;
    }
    res.json({ ok: true, character: result.record });
  });

  // Save full character progress, items, HP/MP & world coordinates for current account
  app.put('/api/account/characters/:id', (req, res) => {
    if (!verifyMutationOriginOrHeader(req)) {
      res.status(403).json({ ok: false, error: 'Недопустимый источник запроса.' });
      return;
    }
    const accountId = resolveExistingAccountId(req);
    if (!accountId) {
      res.status(401).json({ ok: false, error: 'Сессия аккаунта не найдена.' });
      return;
    }
    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const result = gameDb.updateCharacterForAccount({
        characterId: req.params.id,
        accountId,
        player: body.player,
        posX: typeof body.posX === 'number' ? body.posX : undefined,
        posY: typeof body.posY === 'number' ? body.posY : undefined,
        currentHp: typeof body.currentHp === 'number' ? body.currentHp : undefined,
        currentMp: typeof body.currentMp === 'number' ? body.currentMp : undefined,
      });
      if (result.status !== 'ok') {
        if (result.status === 'not_found') {
          res.status(404).json({ ok: false, error: 'Персонаж не найден.' });
          return;
        }
        res.status(403).json({ ok: false, error: 'Нет прав на сохранение этого персонажа.' });
        return;
      }
      res.json({
        ok: true,
        characterId: result.record.id,
        updatedAt: result.record.updatedAt,
      });
    } catch {
      res.status(400).json({ ok: false, error: 'Ошибка сохранения прогресса персонажа.' });
    }
  });

  // Delete a character owned by the current account to free one of the 3 slots
  app.delete('/api/account/characters/:id', (req, res) => {
    if (!verifyMutationOriginOrHeader(req)) {
      res.status(403).json({ ok: false, error: 'Недопустимый источник запроса.' });
      return;
    }
    const accountId = resolveExistingAccountId(req);
    if (!accountId) {
      res.status(401).json({ ok: false, error: 'Сессия аккаунта не найдена.' });
      return;
    }
    const result = gameDb.deleteCharacterForAccount(req.params.id, accountId);
    if (result !== 'ok') {
      if (result === 'not_found') {
        res.status(404).json({ ok: false, error: 'Персонаж не найден.' });
        return;
      }
      res.status(403).json({ ok: false, error: 'Нет прав на удаление этого персонажа.' });
      return;
    }
    res.json({ ok: true });
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
        maxMembers: MAX_WORLD_PLAYERS,
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

  wss.on('connection', (ws, req) => {
    const clientId = `hero_${crypto.randomBytes(6).toString('hex')}`;
    const accountId = resolveExistingAccountId(req);
    const client: ClientConnection = {
      id: clientId,
      ws,
      roomCode: '',
      accountId,
      characterId: null,
      clientSessionKey: null,
      replacedByNewSession: false,
      isAlive: true,
      msgCountWindow: 0,
      windowResetAt: Date.now() + 1000,
    };

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (rawBuffer) => {
      if (client.replacedByNewSession) return;
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

      if (msg.type === 'party:leave_world') {
        removeClientFromCurrentRoom(client);
        client.characterId = null;
        sendJson(ws, { type: 'party:left_world' });
        return;
      }

      if (msg.type === 'party:join') {
        const requestedCode = sanitizePartyCode(msg.roomCode);
        let nickname = sanitizePlayerNickname(msg.nickname, `Рыцарь-${clientId.slice(-3).toUpperCase()}`);
        const incomingSessionKey = sanitizeClientSessionKey(msg.clientSessionKey);
        if (incomingSessionKey) {
          client.clientSessionKey = incomingSessionKey;
        }

        // Bind authenticated account character to this live WebSocket connection so HP & coords persist on server
        if (typeof msg.characterId === 'string' && client.accountId) {
          const ownedChar = gameDb.getCharacterForAccount(msg.characterId, client.accountId);
          if (ownedChar.status === 'ok') {
            client.characterId = ownedChar.record.id;
            nickname = ownedChar.record.nickname;
          }
        }

        // Enforce strictly one live server instance per account / character / browser session
        evictDuplicateSessions(client);

        let targetCode = requestedCode;
        const candidateRoom = getOrCreateRoom(targetCode);
        if (
          candidateRoom.members.size >= MAX_WORLD_PLAYERS &&
          !candidateRoom.members.has(clientId)
        ) {
          if (requestedCode === DEFAULT_PARTY_ROOM) {
            let suffix = 2;
            while (
              getOrCreateRoom(`MU-${suffix}`).members.size >= MAX_WORLD_PLAYERS &&
              suffix < 50
            ) {
              suffix += 1;
            }
            targetCode = `MU-${suffix}`;
          } else {
            sendJson(ws, {
              type: 'party:error',
              message: `Канал #${requestedCode} переполнен (${MAX_WORLD_PLAYERS}/${MAX_WORLD_PLAYERS} игроков). Выберите другой канал!`,
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
        const existingParty = getPartyForMember(room, clientId);
        const memberState: PartyMemberState = {
          id: clientId,
          nickname,
          roomCode: targetCode,
          partyId: existingParty ? existingParty.partyId : null,
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
          party: existingParty,
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
        if (!client.characterId && typeof msg.nickname === 'string') {
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
          const killerParty = getPartyForMember(room, clientId);
          const expInfo = getEligiblePartyExpRecipients(
            killerParty,
            room.members,
            clientId,
            PARTY_EXP_RANGE_METERS
          );
          const dropX = Math.round(result.unit.x);
          const dropY = Math.round(result.unit.y);
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
            x: dropX,
            y: dropY,
            anchorX: Math.round(result.unit.anchorX),
            anchorY: Math.round(result.unit.anchorY),
            respawnAtGameTimeSec: result.respawnAtGameTimeSec,
            respawnDurationSec: result.unit.respawnDurationSec,
            killerX: member.x,
            killerY: member.y,
            expRecipientIds: expInfo.recipientIds,
            partyBonusAlliesCount: expInfo.nearbyAlliesCount,
            timestamp: now,
          };

          broadcastToSameZone(room, territoryId, false, {
            type: 'party:monster_killed',
            event: killedEvent,
          });

          // Server-authoritative shared ground loot for ALL players in this territory
          const spawnedDrops = generateMonsterGroundDrops({
            classId: member.classId,
            territoryId,
            inBloodCastle: false,
            dropX,
            dropY,
            isBoss: result.unit.isBoss,
            zenReward: result.unit.zenReward,
            isQuestMonster: result.unit.isQuestMonster,
            allowQuestItem: result.unit.isQuestMonster,
            nowMs: now,
          });
          if (spawnedDrops.length > 0) {
            const zoneKey = getPartyZoneKey(territoryId, false);
            const activeLoot = getZoneActiveGroundLoot(room, zoneKey, now);
            for (const drop of spawnedDrops) {
              activeLoot.push(drop);
            }
            if (activeLoot.length > SERVER_CONFIG.maxGroundLootPerZone) {
              activeLoot.splice(0, activeLoot.length - SERVER_CONFIG.maxGroundLootPerZone);
            }
            room.zoneGroundLoot.set(zoneKey, activeLoot);

            broadcastToSameZone(room, territoryId, false, {
              type: 'party:ground_loot_spawned',
              territoryId,
              inBloodCastle: false,
              drops: spawnedDrops,
            });
          }
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
          // Regular world territories are 100% server-authoritative (simulated directly on the server tick),
          // so client tabs minimizing or pausing NEVER freeze monsters for other players!
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

        const killerParty = getPartyForMember(room, clientId);
        const expInfo = getEligiblePartyExpRecipients(
          killerParty,
          room.members,
          clientId,
          PARTY_EXP_RANGE_METERS
        );
        const dropX = clampCoord(msg.x ?? member.x);
        const dropY = clampCoord(msg.y ?? member.y);
        const zenShare = clampPositiveInt(msg.zenShare, 15, 5_000_000);
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
          zenShare,
          x: dropX,
          y: dropY,
          killerX: member.x,
          killerY: member.y,
          expRecipientIds: expInfo.recipientIds,
          partyBonusAlliesCount: expInfo.nearbyAlliesCount,
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

        if (member.inBloodCastle) {
          const bcDrops = generateMonsterGroundDrops({
            classId: member.classId,
            territoryId: member.territoryId,
            inBloodCastle: true,
            dropX,
            dropY,
            isBoss: Boolean(msg.isBoss),
            zenReward: zenShare,
            nowMs: now,
          });
          if (bcDrops.length > 0) {
            const zoneKey = getPartyZoneKey(member.territoryId, true);
            const activeLoot = getZoneActiveGroundLoot(room, zoneKey, now);
            for (const d of bcDrops) activeLoot.push(d);
            if (activeLoot.length > SERVER_CONFIG.maxGroundLootPerZone) {
              activeLoot.splice(0, activeLoot.length - SERVER_CONFIG.maxGroundLootPerZone);
            }
            room.zoneGroundLoot.set(zoneKey, activeLoot);
            broadcastToSameZone(room, member.territoryId, true, {
              type: 'party:ground_loot_spawned',
              territoryId: member.territoryId,
              inBloodCastle: true,
              drops: bcDrops,
            });
          }
        }
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
        const dropIndex = list.findIndex((d) => d.id === dropId);
        if (dropIndex < 0) {
          // Already picked up by someone else or expired
          return;
        }
        const [claimedDrop] = list.splice(dropIndex, 1);
        room.zoneGroundLoot.set(zoneKey, list);

        const pickerParty = getPartyForMember(room, clientId);
        const lootMode = pickerParty ? pickerParty.lootMode : 'finder';
        const recipientId = resolvePartyLootRecipient(
          pickerParty,
          room.members,
          clientId,
          claimedDrop.x,
          claimedDrop.y,
          member.territoryId,
          member.inBloodCastle
        );
        const recipientMember = room.members.get(recipientId) ?? member;
        const recipientConn = room.connections.get(recipientMember.id) ?? client;

        broadcastToSameZone(room, member.territoryId, member.inBloodCastle, {
          type: 'party:ground_item_picked',
          territoryId: member.territoryId,
          inBloodCastle: member.inBloodCastle,
          dropId,
          pickerId: clientId,
          pickerNickname: member.nickname,
          recipientId: recipientMember.id,
          recipientNickname: recipientMember.nickname,
          dropLabel: claimedDrop.label,
          lootMode,
        });

        sendJson(recipientConn.ws, {
          type: 'party:loot_awarded',
          drop: claimedDrop,
          pickerId: clientId,
          pickerNickname: member.nickname,
          recipientId: recipientMember.id,
          recipientNickname: recipientMember.nickname,
          lootMode,
        });
        return;
      }

      // MANUAL PARTY FORMATION & LOOT SETTINGS PROTOCOL
      if (msg.type === 'party:invite') {
        const targetId = sanitizeEnemyId(msg.targetId);
        if (!targetId || targetId === clientId) return;
        const targetMember = room.members.get(targetId);
        const targetConn = room.connections.get(targetId);
        if (!targetMember || !targetConn) {
          sendJson(ws, { type: 'party:error', message: 'Игрок не найден в сети.' });
          return;
        }
        if (room.memberToPartyId.has(targetId)) {
          sendJson(ws, {
            type: 'party:error',
            message: `${targetMember.nickname} уже состоит в группе.`,
          });
          return;
        }

        const existingParty = getPartyForMember(room, clientId);
        if (existingParty) {
          if (existingParty.leaderId !== clientId) {
            sendJson(ws, {
              type: 'party:error',
              message: 'Приглашать новых участников может только лидер группы.',
            });
            return;
          }
          if (existingParty.memberIds.length >= MAX_PARTY_SIZE) {
            sendJson(ws, {
              type: 'party:error',
              message: `Группа заполнена (${MAX_PARTY_SIZE}/${MAX_PARTY_SIZE}).`,
            });
            return;
          }
        }

        // Remove expired invites or duplicate invite between same pair
        for (const [invId, inv] of room.pendingInvites.entries()) {
          if (inv.expiresAt <= now || (inv.fromId === clientId && inv.targetId === targetId)) {
            room.pendingInvites.delete(invId);
          }
        }

        const inviteId = `inv_${crypto.randomBytes(5).toString('hex')}`;
        const invitePayload: PartyInvitePayload = {
          inviteId,
          fromId: clientId,
          fromNickname: member.nickname,
          fromClassId: member.classId,
          fromLevel: member.level,
          partyId: existingParty?.partyId ?? null,
          lootMode: existingParty?.lootMode ?? 'finder',
          expiresAt: now + 30_000,
        };
        room.pendingInvites.set(inviteId, { ...invitePayload, targetId });

        sendJson(targetConn.ws, {
          type: 'party:invite_received',
          invite: invitePayload,
        });
        sendPartySystemNotice(
          room,
          [clientId],
          `Приглашение в группу отправлено игроку ${targetMember.nickname}.`,
          now
        );
        return;
      }

      if (msg.type === 'party:invite_respond') {
        const inviteId = sanitizeEnemyId(msg.inviteId);
        const accept = Boolean(msg.accept);
        const invite = room.pendingInvites.get(inviteId);
        if (!invite || invite.targetId !== clientId) return;
        room.pendingInvites.delete(inviteId);

        const inviterMember = room.members.get(invite.fromId);
        const inviterConn = room.connections.get(invite.fromId);
        if (invite.expiresAt <= now || !inviterMember || !inviterConn) {
          sendJson(ws, {
            type: 'party:error',
            message: 'Приглашение в группу устарело или игрок вышел из сети.',
          });
          return;
        }

        if (!accept) {
          sendPartySystemNotice(
            room,
            [invite.fromId],
            `${member.nickname} отклонил приглашение в группу.`,
            now
          );
          return;
        }

        if (room.memberToPartyId.has(clientId)) {
          sendJson(ws, {
            type: 'party:error',
            message: 'Вы уже состоите в группе. Сначала выйдите из текущей группы.',
          });
          return;
        }

        let party = getPartyForMember(room, invite.fromId);
        if (party) {
          if (party.memberIds.length >= MAX_PARTY_SIZE) {
            sendJson(ws, {
              type: 'party:error',
              message: `Группа игрока ${inviterMember.nickname} уже заполнена.`,
            });
            return;
          }
          if (!party.memberIds.includes(clientId)) {
            party.memberIds.push(clientId);
          }
        } else {
          const partyId = `pty_${crypto.randomBytes(5).toString('hex')}`;
          party = {
            partyId,
            leaderId: invite.fromId,
            lootMode: 'finder',
            memberIds: [invite.fromId, clientId],
          };
          room.parties.set(partyId, party);
          room.memberToPartyId.set(invite.fromId, partyId);
        }
        room.memberToPartyId.set(clientId, party.partyId);

        syncPartyGroupUpdate(room, party.memberIds, party);
        sendPartySystemNotice(
          room,
          party.memberIds,
          `🤝 ${member.nickname} вступил в группу! Опыт делится на дистанции до ${PARTY_EXP_RANGE_METERS} м.`,
          now
        );
        return;
      }

      if (msg.type === 'party:set_loot_mode') {
        const party = getPartyForMember(room, clientId);
        if (!party) {
          sendJson(ws, { type: 'party:error', message: 'Вы не состоите в группе.' });
          return;
        }
        if (party.leaderId !== clientId) {
          sendJson(ws, {
            type: 'party:error',
            message: 'Менять настройку добычи может только лидер группы.',
          });
          return;
        }
        const nextMode = sanitizePartyLootMode(msg.lootMode);
        if (party.lootMode === nextMode) return;
        party.lootMode = nextMode;
        syncPartyGroupUpdate(room, party.memberIds, party);
        const modeLabel = nextMode === 'random' ? '🎲 Случайно (участнику рядом)' : '✋ Нашедшему';
        sendPartySystemNotice(
          room,
          party.memberIds,
          `Лидер ${member.nickname} установил режим добычи: ${modeLabel}.`,
          now
        );
        return;
      }

      if (msg.type === 'party:leave') {
        removeMemberFromFormedParty(room, clientId, `${member.nickname} покинул группу.`, now);
        return;
      }

      if (msg.type === 'party:kick') {
        const targetId = sanitizeEnemyId(msg.targetId);
        if (!targetId || targetId === clientId) return;
        const party = getPartyForMember(room, clientId);
        if (!party || party.leaderId !== clientId) {
          sendJson(ws, {
            type: 'party:error',
            message: 'Исключать участников может только лидер группы.',
          });
          return;
        }
        if (!party.memberIds.includes(targetId)) return;
        const targetNick = room.members.get(targetId)?.nickname ?? 'Игрок';
        removeMemberFromFormedParty(
          room,
          targetId,
          `${targetNick} исключён из группы лидером ${member.nickname}.`,
          now
        );
        sendPartySystemNotice(room, [targetId], `Вас исключили из группы.`, now);
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

  // Continuous 10Hz Server-Authoritative World Monster AI & Movement Loop
  // Monsters live, patrol, roam (Golden Bosses), aggro, and attack relative to the SERVER,
  // completely independent of any player minimizing or backgrounding their browser tab!
  let lastWorldSimMs = Date.now();
  const worldSimInterval = setInterval(() => {
    const nowMs = Date.now();
    const dtSec = Math.min(0.25, Math.max(0.016, (nowMs - lastWorldSimMs) / 1000));
    lastWorldSimMs = nowMs;
    const nowGameSec = getWorldGameTimeSec(nowMs);

    for (const room of rooms.values()) {
      const territoriesToStep = new Set<TerritoryId>(room.zoneWorldMonsters.keys());
      const playersByTerritory = new Map<TerritoryId, ServerSimPlayerTarget[]>();

      for (const m of room.members.values()) {
        if (m.inBloodCastle) continue;
        territoriesToStep.add(m.territoryId);
        let list = playersByTerritory.get(m.territoryId);
        if (!list) {
          list = [];
          playersByTerritory.set(m.territoryId, list);
        }
        list.push({ id: m.id, x: m.x, y: m.y, hp: m.hp });
      }

      for (const territoryId of territoriesToStep) {
        const zoneMap = getOrInitZoneWorldMonsters(room, territoryId, nowGameSec, nowMs);
        const playersInZone = playersByTerritory.get(territoryId) ?? [];
        const attacks = stepServerZoneMonsters(
          zoneMap,
          territoryId,
          playersInZone,
          dtSec,
          nowMs
        );

        if (playersInZone.length === 0) continue;

        for (const attackEvent of attacks) {
          broadcastToSameZone(room, territoryId, false, {
            type: 'party:monster_attack',
            event: attackEvent,
          });
        }

        const monsters: SharedMonsterState[] = [];
        for (const unit of zoneMap.values()) {
          if (unit.alive && unit.hp > 0) {
            monsters.push(toSharedMonsterState(unit));
          }
        }
        const deadRespawns = extractDeadRespawnsRecord(zoneMap, nowGameSec);
        const zoneKey = getPartyZoneKey(territoryId, false);
        const snapshot: PartyZoneMonsterSnapshot = {
          hostId: 'server',
          territoryId,
          inBloodCastle: false,
          bossSpawnedForTerritory: Boolean(zoneMap.get(`boss_${territoryId}`)?.alive),
          bcStage: 'kill_100',
          bcBridgeKills: 0,
          monsters,
          deadMonsterRespawns: deadRespawns,
          timestamp: nowMs,
        };
        room.zoneSnapshots.set(zoneKey, snapshot);

        broadcastToSameZone(room, territoryId, false, {
          type: 'party:zone_monsters',
          snapshot,
        });
      }
    }
  }, 100);

  // Continuous 2Hz Server-Time Individual Monster Respawn Ticker (checks all initialized & active territories)
  const respawnInterval = setInterval(() => {
    const nowMs = Date.now();
    const nowGameSec = getWorldGameTimeSec(nowMs);
    for (const room of rooms.values()) {
      const territoriesToCheck = new Set<TerritoryId>(room.zoneWorldMonsters.keys());
      for (const m of room.members.values()) {
        if (!m.inBloodCastle) {
          territoriesToCheck.add(m.territoryId);
        }
      }
      for (const territoryId of territoriesToCheck) {
        reviveAndBroadcastDueZoneMonsters(room, territoryId, nowMs, nowGameSec);
      }
    }
  }, SERVER_CONFIG.worldRespawnTickMs);

  // Periodic WebSocket heartbeat, stale member cleanup, ground loot expiration & live character vitals checkpoint
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      for (const zoneKey of room.zoneGroundLoot.keys()) {
        getZoneActiveGroundLoot(room, zoneKey, now);
      }
      for (const conn of room.connections.values()) {
        persistClientRuntimeVitals(conn, room);
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
    clearInterval(worldSimInterval);
    clearInterval(respawnInterval);
    clearInterval(heartbeatInterval);
    for (const room of rooms.values()) {
      for (const conn of room.connections.values()) {
        persistClientRuntimeVitals(conn, room);
      }
    }
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
    clearInterval(worldSimInterval);
    clearInterval(respawnInterval);
    clearInterval(heartbeatInterval);
    try {
      for (const room of rooms.values()) {
        for (const conn of room.connections.values()) {
          persistClientRuntimeVitals(conn, room);
        }
      }
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
