import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
// Node 22 built-in synchronous SQLite driver (zero external native compilation needed)
import { DatabaseSync } from 'node:sqlite';
import { CHARACTER_SCALING } from '../src/config/characterScaling.ts';
import { SERVER_CONFIG } from '../src/config/server.ts';
import {
  clampPositiveInt,
  sanitizeClassId,
  sanitizeClassTier,
  sanitizeEquipmentItem,
  sanitizePlayerNickname,
  sanitizeTerritoryId,
} from '../src/game/party.ts';
import { calculateExpToNextLevel, createInitialPlayerState } from '../src/game/rules.ts';
import type {
  EquipmentItem,
  ItemSlot,
  PlayerProgressState,
  PlayerTradeSession,
  TerritoryId,
} from '../src/game/types.ts';

export interface CharacterPublicSummary {
  id: string;
  nickname: string;
  classId: PlayerProgressState['classId'];
  classTier: PlayerProgressState['classTier'];
  level: number;
  resets: number;
  territoryId: TerritoryId;
  totalKills: number;
  bossesDefeated: number;
  bloodCastleClears: number;
  equippedCount: number;
  inventoryCount: number;
  updatedAt: number;
}

export interface PersistedCharacterRecord {
  id: string;
  nickname: string;
  player: PlayerProgressState;
  createdAt: number;
  updatedAt: number;
}

export interface PersistedZoneMonsterData {
  deadRespawns: Record<string, number>;
  damagedHp: Record<string, number>;
}

export interface TradeLogEntry {
  id: number;
  tradeId: string;
  roomCode: string;
  territoryId: string;
  initiatorNickname: string;
  targetNickname: string;
  summary: Record<string, unknown>;
  completedAt: number;
}

const EQUIP_SLOTS: ItemSlot[] = ['weapon', 'armor', 'helm', 'wings', 'ring', 'pendant'];

function hashOwnerToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function verifyOwnerTokenHash(token: string, expectedHash: string): boolean {
  if (!token || !expectedHash) return false;
  const candidateHash = hashOwnerToken(token);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

export function sanitizeCharacterId(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

/**
 * Validates and clamps an incoming PlayerProgressState payload before saving to SQLite.
 */
export function sanitizePlayerProgressForDb(raw: unknown): PlayerProgressState {
  if (!raw || typeof raw !== 'object') {
    return createInitialPlayerState('dark_knight');
  }
  const obj = raw as Record<string, unknown>;
  const classId = sanitizeClassId(obj.classId);
  const base = createInitialPlayerState(classId);

  const level = Math.max(1, clampPositiveInt(obj.level, base.level, 400));
  const resets = clampPositiveInt(obj.resets, base.resets, 999);
  const classTier = sanitizeClassTier(obj.classTier ?? base.classTier);
  const expToNext = calculateExpToNextLevel(level);
  const exp = Math.min(expToNext * 2, clampPositiveInt(obj.exp, base.exp, 2_000_000_000));
  const statPoints = clampPositiveInt(obj.statPoints, base.statPoints, 1_000_000);

  const rawAttrs = (obj.attributes && typeof obj.attributes === 'object'
    ? obj.attributes
    : {}) as Record<string, unknown>;
  const attributes = {
    str: Math.max(1, clampPositiveInt(rawAttrs.str, base.attributes.str, 500_000)),
    agi: Math.max(1, clampPositiveInt(rawAttrs.agi, base.attributes.agi, 500_000)),
    vit: Math.max(1, clampPositiveInt(rawAttrs.vit, base.attributes.vit, 500_000)),
    ene: Math.max(1, clampPositiveInt(rawAttrs.ene, base.attributes.ene, 500_000)),
  };

  const rawJewels = (obj.jewels && typeof obj.jewels === 'object'
    ? obj.jewels
    : {}) as Record<string, unknown>;
  const jewels = {
    bless: clampPositiveInt(rawJewels.bless, base.jewels.bless, 1_000_000),
    soul: clampPositiveInt(rawJewels.soul, base.jewels.soul, 1_000_000),
    life: clampPositiveInt(rawJewels.life, base.jewels.life, 1_000_000),
    chaos: clampPositiveInt(rawJewels.chaos, base.jewels.chaos, 1_000_000),
  };

  const hpPotions = clampPositiveInt(obj.hpPotions ?? obj.potions, base.hpPotions, 9999);
  const mpPotions = clampPositiveInt(obj.mpPotions, base.mpPotions, 9999);

  const learnedSkills: string[] = [];
  if (Array.isArray(obj.learnedSkills)) {
    const seen = new Set<string>();
    for (let i = 0; i < Math.min(obj.learnedSkills.length, 24); i++) {
      const s = obj.learnedSkills[i];
      if (typeof s === 'string') {
        const cleaned = s.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
        if (cleaned && !seen.has(cleaned)) {
          seen.add(cleaned);
          learnedSkills.push(cleaned);
        }
      }
    }
  }

  const rawEquipped = (obj.equipped && typeof obj.equipped === 'object'
    ? obj.equipped
    : {}) as Record<string, unknown>;
  const equipped: PlayerProgressState['equipped'] = {
    weapon: null,
    armor: null,
    helm: null,
    wings: null,
    ring: null,
    pendant: null,
  };
  for (const slot of EQUIP_SLOTS) {
    const item = sanitizeEquipmentItem(rawEquipped[slot]);
    if (item) {
      equipped[slot] = { ...item, slot };
    }
  }

  const inventory: EquipmentItem[] = [];
  if (Array.isArray(obj.inventory)) {
    const seenIds = new Set<string>();
    const cap = CHARACTER_SCALING.maxTradeInventoryOverflow;
    for (let i = 0; i < Math.min(obj.inventory.length, cap); i++) {
      const item = sanitizeEquipmentItem(obj.inventory[i]);
      if (item && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        inventory.push(item);
      }
    }
  }

  return {
    classId,
    classTier,
    resets,
    level,
    exp,
    expToNext,
    statPoints,
    attributes,
    zen: clampPositiveInt(obj.zen, base.zen, 2_000_000_000),
    jewels,
    potions: hpPotions,
    hpPotions,
    mpPotions,
    hasFirstProfQuestItem: Boolean(obj.hasFirstProfQuestItem),
    bloodScrolls: clampPositiveInt(obj.bloodScrolls, 0, 99_999),
    bloodFangs: clampPositiveInt(obj.bloodFangs, 0, 99_999),
    bloodCastleTickets: clampPositiveInt(obj.bloodCastleTickets, 0, 99_999),
    inBloodCastle: Boolean(obj.inBloodCastle),
    bloodCastleClears: clampPositiveInt(obj.bloodCastleClears, 0, 999_999),
    learnedSkills,
    equipped,
    inventory,
    territoryId: sanitizeTerritoryId(obj.territoryId ?? base.territoryId),
    killsInTerritory: clampPositiveInt(obj.killsInTerritory, 0, 10_000_000),
    totalKills: clampPositiveInt(obj.totalKills, 0, 100_000_000),
    bossesDefeated: clampPositiveInt(obj.bossesDefeated, 0, 10_000_000),
    highestReachedTerritoryIdx: Math.max(
      1,
      clampPositiveInt(obj.highestReachedTerritoryIdx, 1, 24)
    ),
  };
}

interface CharacterDbRow {
  id: string;
  nickname: string;
  class_id: string;
  class_tier: number;
  level: number;
  resets: number;
  exp: number;
  exp_to_next: number;
  stat_points: number;
  str: number;
  agi: number;
  vit: number;
  ene: number;
  zen: number;
  jewel_bless: number;
  jewel_soul: number;
  jewel_life: number;
  jewel_chaos: number;
  hp_potions: number;
  mp_potions: number;
  has_first_prof_quest_item: number;
  blood_scrolls: number;
  blood_fangs: number;
  blood_castle_tickets: number;
  in_blood_castle: number;
  blood_castle_clears: number;
  territory_id: string;
  kills_in_territory: number;
  total_kills: number;
  bosses_defeated: number;
  highest_reached_territory_idx: number;
  learned_skills_json: string;
  owner_token_hash: string;
  created_at: number;
  updated_at: number;
}

interface CharacterItemDbRow {
  id: string;
  character_id: string;
  container: 'equipped' | 'inventory';
  slot: string;
  name: string;
  rarity: string;
  level: number;
  life_option: number;
  base_attack: number;
  base_defense: number;
  crit_chance_bonus: number;
  move_speed_bonus: number;
  set_name: string | null;
  class_restriction: string | null;
  excellent_option: string | null;
  value_zen: number;
  sort_order: number;
}

export class GameDatabase {
  private readonly db: DatabaseSync;
  public readonly dbPath: string;

  constructor(customDbPath?: string) {
    const rawPath = customDbPath || process.env.DB_PATH || SERVER_CONFIG.defaultDbPath;
    if (rawPath === ':memory:') {
      this.dbPath = ':memory:';
    } else {
      const resolved = path.resolve(process.cwd(), rawPath);
      const dir = path.dirname(resolved);
      fs.mkdirSync(dir, { recursive: true });
      this.dbPath = resolved;
    }

    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        class_id TEXT NOT NULL,
        class_tier INTEGER NOT NULL DEFAULT 1,
        level INTEGER NOT NULL DEFAULT 1,
        resets INTEGER NOT NULL DEFAULT 0,
        exp INTEGER NOT NULL DEFAULT 0,
        exp_to_next INTEGER NOT NULL DEFAULT 146,
        stat_points INTEGER NOT NULL DEFAULT 15,
        str INTEGER NOT NULL,
        agi INTEGER NOT NULL,
        vit INTEGER NOT NULL,
        ene INTEGER NOT NULL,
        zen INTEGER NOT NULL DEFAULT 600,
        jewel_bless INTEGER NOT NULL DEFAULT 2,
        jewel_soul INTEGER NOT NULL DEFAULT 1,
        jewel_life INTEGER NOT NULL DEFAULT 1,
        jewel_chaos INTEGER NOT NULL DEFAULT 0,
        hp_potions INTEGER NOT NULL DEFAULT 3,
        mp_potions INTEGER NOT NULL DEFAULT 3,
        has_first_prof_quest_item INTEGER NOT NULL DEFAULT 0,
        blood_scrolls INTEGER NOT NULL DEFAULT 0,
        blood_fangs INTEGER NOT NULL DEFAULT 0,
        blood_castle_tickets INTEGER NOT NULL DEFAULT 0,
        in_blood_castle INTEGER NOT NULL DEFAULT 0,
        blood_castle_clears INTEGER NOT NULL DEFAULT 0,
        territory_id TEXT NOT NULL DEFAULT 'lorencia',
        kills_in_territory INTEGER NOT NULL DEFAULT 0,
        total_kills INTEGER NOT NULL DEFAULT 0,
        bosses_defeated INTEGER NOT NULL DEFAULT 0,
        highest_reached_territory_idx INTEGER NOT NULL DEFAULT 1,
        learned_skills_json TEXT NOT NULL DEFAULT '[]',
        owner_token_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_characters_nickname ON characters (nickname);
      CREATE INDEX IF NOT EXISTS idx_characters_ranking ON characters (resets DESC, level DESC, total_kills DESC);

      CREATE TABLE IF NOT EXISTS character_items (
        row_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        container TEXT NOT NULL CHECK (container IN ('equipped', 'inventory')),
        slot TEXT NOT NULL,
        name TEXT NOT NULL,
        rarity TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 0,
        life_option INTEGER NOT NULL DEFAULT 0,
        base_attack INTEGER NOT NULL DEFAULT 0,
        base_defense INTEGER NOT NULL DEFAULT 0,
        crit_chance_bonus INTEGER NOT NULL DEFAULT 0,
        move_speed_bonus INTEGER NOT NULL DEFAULT 0,
        set_name TEXT,
        class_restriction TEXT,
        excellent_option TEXT,
        value_zen INTEGER NOT NULL DEFAULT 100,
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_character_items_char ON character_items (character_id, container, sort_order);

      CREATE TABLE IF NOT EXISTS world_monster_state (
        room_code TEXT NOT NULL,
        territory_id TEXT NOT NULL,
        slot_id TEXT NOT NULL,
        hp INTEGER NOT NULL,
        alive INTEGER NOT NULL DEFAULT 1,
        respawn_at_game_time_sec REAL NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (room_code, territory_id, slot_id)
      );

      CREATE INDEX IF NOT EXISTS idx_world_monsters_zone ON world_monster_state (room_code, territory_id);

      CREATE TABLE IF NOT EXISTS trade_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_id TEXT NOT NULL,
        room_code TEXT NOT NULL,
        territory_id TEXT NOT NULL,
        initiator_nickname TEXT NOT NULL,
        target_nickname TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        completed_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_trade_logs_time ON trade_logs (completed_at DESC);
    `);
  }

  public close(): void {
    this.db.close();
  }

  private runInTransaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  private replaceCharacterItemsTx(characterId: string, player: PlayerProgressState): void {
    const deleteStmt = this.db.prepare('DELETE FROM character_items WHERE character_id = ?');
    deleteStmt.run(characterId);

    const insertStmt = this.db.prepare(`
      INSERT INTO character_items (
        id, character_id, container, slot, name, rarity, level, life_option,
        base_attack, base_defense, crit_chance_bonus, move_speed_bonus,
        set_name, class_restriction, excellent_option, value_zen, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let eqOrder = 0;
    for (const slot of EQUIP_SLOTS) {
      const item = player.equipped[slot];
      if (!item) continue;
      insertStmt.run(
        item.id,
        characterId,
        'equipped',
        slot,
        item.name,
        item.rarity,
        item.level,
        item.lifeOption ?? 0,
        item.baseAttack,
        item.baseDefense,
        item.critChanceBonus,
        item.moveSpeedBonus,
        item.setName ?? null,
        item.classRestriction ?? null,
        item.excellentOption ?? null,
        item.valueZen,
        eqOrder++
      );
    }

    player.inventory.forEach((item, idx) => {
      insertStmt.run(
        item.id,
        characterId,
        'inventory',
        item.slot,
        item.name,
        item.rarity,
        item.level,
        item.lifeOption ?? 0,
        item.baseAttack,
        item.baseDefense,
        item.critChanceBonus,
        item.moveSpeedBonus,
        item.setName ?? null,
        item.classRestriction ?? null,
        item.excellentOption ?? null,
        item.valueZen,
        idx
      );
    });
  }

  private rowToItem(row: CharacterItemDbRow): EquipmentItem {
    return {
      id: row.id,
      name: row.name,
      slot: row.slot as ItemSlot,
      rarity: row.rarity as EquipmentItem['rarity'],
      level: row.level,
      lifeOption: row.life_option,
      baseAttack: row.base_attack,
      baseDefense: row.base_defense,
      critChanceBonus: row.crit_chance_bonus,
      moveSpeedBonus: row.move_speed_bonus,
      setName: row.set_name ?? undefined,
      classRestriction: (row.class_restriction as EquipmentItem['classRestriction']) ?? undefined,
      excellentOption: row.excellent_option ?? undefined,
      valueZen: row.value_zen,
    };
  }

  private hydrateCharacter(row: CharacterDbRow): PersistedCharacterRecord {
    const itemRows = this.db
      .prepare(
        'SELECT * FROM character_items WHERE character_id = ? ORDER BY container ASC, sort_order ASC'
      )
      .all(row.id) as unknown as CharacterItemDbRow[];

    const equipped: PlayerProgressState['equipped'] = {
      weapon: null,
      armor: null,
      helm: null,
      wings: null,
      ring: null,
      pendant: null,
    };
    const inventory: EquipmentItem[] = [];

    for (const itemRow of itemRows) {
      const item = this.rowToItem(itemRow);
      if (itemRow.container === 'equipped' && EQUIP_SLOTS.includes(item.slot)) {
        equipped[item.slot] = item;
      } else {
        inventory.push(item);
      }
    }

    let learnedSkills: string[] = [];
    try {
      const parsed = JSON.parse(row.learned_skills_json);
      if (Array.isArray(parsed)) {
        learnedSkills = parsed.filter((s): s is string => typeof s === 'string');
      }
    } catch {
      learnedSkills = [];
    }

    const player: PlayerProgressState = {
      classId: sanitizeClassId(row.class_id),
      classTier: sanitizeClassTier(row.class_tier),
      resets: row.resets,
      level: row.level,
      exp: row.exp,
      expToNext: row.exp_to_next,
      statPoints: row.stat_points,
      attributes: {
        str: row.str,
        agi: row.agi,
        vit: row.vit,
        ene: row.ene,
      },
      zen: row.zen,
      jewels: {
        bless: row.jewel_bless,
        soul: row.jewel_soul,
        life: row.jewel_life,
        chaos: row.jewel_chaos,
      },
      potions: row.hp_potions,
      hpPotions: row.hp_potions,
      mpPotions: row.mp_potions,
      hasFirstProfQuestItem: Boolean(row.has_first_prof_quest_item),
      bloodScrolls: row.blood_scrolls,
      bloodFangs: row.blood_fangs,
      bloodCastleTickets: row.blood_castle_tickets,
      inBloodCastle: Boolean(row.in_blood_castle),
      bloodCastleClears: row.blood_castle_clears,
      learnedSkills,
      equipped,
      inventory,
      territoryId: sanitizeTerritoryId(row.territory_id),
      killsInTerritory: row.kills_in_territory,
      totalKills: row.total_kills,
      bossesDefeated: row.bosses_defeated,
      highestReachedTerritoryIdx: row.highest_reached_territory_idx,
    };

    return {
      id: row.id,
      nickname: row.nickname,
      player,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Creates a new character + its equipped/inventory items in SQLite.
   * Returns an opaque `ownerToken` once (only its SHA-256 hash is stored in DB).
   */
  public createCharacter(params: {
    nickname: unknown;
    player: unknown;
  }): { record: PersistedCharacterRecord; ownerToken: string } {
    const id = `char_${crypto.randomBytes(8).toString('hex')}`;
    const ownerToken = crypto.randomBytes(32).toString('hex');
    const ownerTokenHash = hashOwnerToken(ownerToken);
    const nickname = sanitizePlayerNickname(params.nickname, 'Герой-MU');
    const player = sanitizePlayerProgressForDb(params.player);
    const now = Date.now();

    this.runInTransaction(() => {
      this.db
        .prepare(`
          INSERT INTO characters (
            id, nickname, class_id, class_tier, level, resets, exp, exp_to_next, stat_points,
            str, agi, vit, ene, zen,
            jewel_bless, jewel_soul, jewel_life, jewel_chaos,
            hp_potions, mp_potions, has_first_prof_quest_item,
            blood_scrolls, blood_fangs, blood_castle_tickets, in_blood_castle, blood_castle_clears,
            territory_id, kills_in_territory, total_kills, bosses_defeated, highest_reached_territory_idx,
            learned_skills_json, owner_token_hash, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?
          )
        `)
        .run(
          id,
          nickname,
          player.classId,
          player.classTier,
          player.level,
          player.resets,
          player.exp,
          player.expToNext,
          player.statPoints,
          player.attributes.str,
          player.attributes.agi,
          player.attributes.vit,
          player.attributes.ene,
          player.zen,
          player.jewels.bless,
          player.jewels.soul,
          player.jewels.life,
          player.jewels.chaos,
          player.hpPotions,
          player.mpPotions,
          player.hasFirstProfQuestItem ? 1 : 0,
          player.bloodScrolls,
          player.bloodFangs,
          player.bloodCastleTickets,
          player.inBloodCastle ? 1 : 0,
          player.bloodCastleClears,
          player.territoryId,
          player.killsInTerritory,
          player.totalKills,
          player.bossesDefeated,
          player.highestReachedTerritoryIdx,
          JSON.stringify(player.learnedSkills),
          ownerTokenHash,
          now,
          now
        );

      this.replaceCharacterItemsTx(id, player);
    });

    return {
      record: {
        id,
        nickname,
        player,
        createdAt: now,
        updatedAt: now,
      },
      ownerToken,
    };
  }

  /**
   * Loads a full character (stats + equipped + inventory) ONLY if `ownerToken` matches.
   */
  public getCharacterForOwner(
    characterId: string,
    ownerToken: string
  ): { status: 'ok'; record: PersistedCharacterRecord } | { status: 'not_found' | 'forbidden' } {
    const cleanId = sanitizeCharacterId(characterId);
    if (!cleanId) return { status: 'not_found' };

    const row = this.db
      .prepare('SELECT * FROM characters WHERE id = ?')
      .get(cleanId) as unknown as CharacterDbRow | undefined;
    if (!row) return { status: 'not_found' };

    if (!verifyOwnerTokenHash(ownerToken, row.owner_token_hash)) {
      return { status: 'forbidden' };
    }

    return { status: 'ok', record: this.hydrateCharacter(row) };
  }

  /**
   * Atomically updates a character + all of its equipped & inventory items in SQLite.
   * Requires matching `ownerToken` to prevent cross-player overwrites.
   */
  public updateCharacterForOwner(params: {
    characterId: string;
    ownerToken: string;
    nickname?: unknown;
    player: unknown;
  }): { status: 'ok'; record: PersistedCharacterRecord } | { status: 'not_found' | 'forbidden' } {
    const cleanId = sanitizeCharacterId(params.characterId);
    if (!cleanId) return { status: 'not_found' };

    const existing = this.db
      .prepare('SELECT id, nickname, owner_token_hash, created_at FROM characters WHERE id = ?')
      .get(cleanId) as unknown as
      | { id: string; nickname: string; owner_token_hash: string; created_at: number }
      | undefined;

    if (!existing) return { status: 'not_found' };
    if (!verifyOwnerTokenHash(params.ownerToken, existing.owner_token_hash)) {
      return { status: 'forbidden' };
    }

    const nickname =
      params.nickname !== undefined
        ? sanitizePlayerNickname(params.nickname, existing.nickname)
        : existing.nickname;
    const player = sanitizePlayerProgressForDb(params.player);
    const now = Date.now();

    this.runInTransaction(() => {
      this.db
        .prepare(`
          UPDATE characters SET
            nickname = ?, class_id = ?, class_tier = ?, level = ?, resets = ?,
            exp = ?, exp_to_next = ?, stat_points = ?,
            str = ?, agi = ?, vit = ?, ene = ?, zen = ?,
            jewel_bless = ?, jewel_soul = ?, jewel_life = ?, jewel_chaos = ?,
            hp_potions = ?, mp_potions = ?, has_first_prof_quest_item = ?,
            blood_scrolls = ?, blood_fangs = ?, blood_castle_tickets = ?,
            in_blood_castle = ?, blood_castle_clears = ?,
            territory_id = ?, kills_in_territory = ?, total_kills = ?,
            bosses_defeated = ?, highest_reached_territory_idx = ?,
            learned_skills_json = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          nickname,
          player.classId,
          player.classTier,
          player.level,
          player.resets,
          player.exp,
          player.expToNext,
          player.statPoints,
          player.attributes.str,
          player.attributes.agi,
          player.attributes.vit,
          player.attributes.ene,
          player.zen,
          player.jewels.bless,
          player.jewels.soul,
          player.jewels.life,
          player.jewels.chaos,
          player.hpPotions,
          player.mpPotions,
          player.hasFirstProfQuestItem ? 1 : 0,
          player.bloodScrolls,
          player.bloodFangs,
          player.bloodCastleTickets,
          player.inBloodCastle ? 1 : 0,
          player.bloodCastleClears,
          player.territoryId,
          player.killsInTerritory,
          player.totalKills,
          player.bossesDefeated,
          player.highestReachedTerritoryIdx,
          JSON.stringify(player.learnedSkills),
          now,
          cleanId
        );

      this.replaceCharacterItemsTx(cleanId, player);
    });

    return {
      status: 'ok',
      record: {
        id: cleanId,
        nickname,
        player,
        createdAt: existing.created_at,
        updatedAt: now,
      },
    };
  }

  /**
   * Lists public character leaderboard / summaries (no owner tokens or private fields).
   */
  public listCharacterSummaries(limit = 50): CharacterPublicSummary[] {
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const rows = this.db
      .prepare(`
        SELECT
          c.id, c.nickname, c.class_id, c.class_tier, c.level, c.resets,
          c.territory_id, c.total_kills, c.bosses_defeated, c.blood_castle_clears, c.updated_at,
          COALESCE(SUM(CASE WHEN ci.container = 'equipped' THEN 1 ELSE 0 END), 0) AS equipped_count,
          COALESCE(SUM(CASE WHEN ci.container = 'inventory' THEN 1 ELSE 0 END), 0) AS inventory_count
        FROM characters c
        LEFT JOIN character_items ci ON ci.character_id = c.id
        GROUP BY c.id
        ORDER BY c.resets DESC, c.level DESC, c.total_kills DESC, c.updated_at DESC
        LIMIT ?
      `)
      .all(safeLimit) as unknown as Array<{
      id: string;
      nickname: string;
      class_id: string;
      class_tier: number;
      level: number;
      resets: number;
      territory_id: string;
      total_kills: number;
      bosses_defeated: number;
      blood_castle_clears: number;
      updated_at: number;
      equipped_count: number;
      inventory_count: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      nickname: r.nickname,
      classId: sanitizeClassId(r.class_id),
      classTier: sanitizeClassTier(r.class_tier),
      level: r.level,
      resets: r.resets,
      territoryId: sanitizeTerritoryId(r.territory_id),
      totalKills: r.total_kills,
      bossesDefeated: r.bosses_defeated,
      bloodCastleClears: r.blood_castle_clears,
      equippedCount: Number(r.equipped_count) || 0,
      inventoryCount: Number(r.inventory_count) || 0,
      updatedAt: r.updated_at,
    }));
  }

  public getPublicCharacterSummaryById(characterId: string): CharacterPublicSummary | null {
    const cleanId = sanitizeCharacterId(characterId);
    if (!cleanId) return null;
    const row = this.db
      .prepare(`
        SELECT
          c.id, c.nickname, c.class_id, c.class_tier, c.level, c.resets,
          c.territory_id, c.total_kills, c.bosses_defeated, c.blood_castle_clears, c.updated_at,
          COALESCE(SUM(CASE WHEN ci.container = 'equipped' THEN 1 ELSE 0 END), 0) AS equipped_count,
          COALESCE(SUM(CASE WHEN ci.container = 'inventory' THEN 1 ELSE 0 END), 0) AS inventory_count
        FROM characters c
        LEFT JOIN character_items ci ON ci.character_id = c.id
        WHERE c.id = ?
        GROUP BY c.id
      `)
      .get(cleanId) as unknown as
      | {
          id: string;
          nickname: string;
          class_id: string;
          class_tier: number;
          level: number;
          resets: number;
          territory_id: string;
          total_kills: number;
          bosses_defeated: number;
          blood_castle_clears: number;
          updated_at: number;
          equipped_count: number;
          inventory_count: number;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      nickname: row.nickname,
      classId: sanitizeClassId(row.class_id),
      classTier: sanitizeClassTier(row.class_tier),
      level: row.level,
      resets: row.resets,
      territoryId: sanitizeTerritoryId(row.territory_id),
      totalKills: row.total_kills,
      bossesDefeated: row.bosses_defeated,
      bloodCastleClears: row.blood_castle_clears,
      equippedCount: Number(row.equipped_count) || 0,
      inventoryCount: Number(row.inventory_count) || 0,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Loads all still-relevant world monster states (pending respawns & damaged HP) from SQLite.
   */
  public loadAllWorldMonsterStates(nowGameSec: number): Map<string, PersistedZoneMonsterData> {
    const result = new Map<string, PersistedZoneMonsterData>();
    const rows = this.db
      .prepare(`
        SELECT room_code, territory_id, slot_id, hp, alive, respawn_at_game_time_sec
        FROM world_monster_state
      `)
      .all() as unknown as Array<{
      room_code: string;
      territory_id: string;
      slot_id: string;
      hp: number;
      alive: number;
      respawn_at_game_time_sec: number;
    }>;

    for (const r of rows) {
      const pKey = `${r.room_code}::${r.territory_id}`;
      let entry = result.get(pKey);
      if (!entry) {
        entry = { deadRespawns: {}, damagedHp: {} };
        result.set(pKey, entry);
      }
      if (!r.alive && r.respawn_at_game_time_sec > nowGameSec) {
        entry.deadRespawns[r.slot_id] = r.respawn_at_game_time_sec;
      } else if (r.alive && r.hp > 0) {
        entry.damagedHp[r.slot_id] = Math.round(r.hp);
      }
    }

    // Prune empty entries
    for (const [key, entry] of result.entries()) {
      if (
        Object.keys(entry.deadRespawns).length === 0 &&
        Object.keys(entry.damagedHp).length === 0
      ) {
        result.delete(key);
      }
    }

    return result;
  }

  /**
   * Atomically replaces persisted world_monster_state rows for a given (roomCode, territoryId).
   */
  public saveZoneMonsterState(
    roomCode: string,
    territoryId: TerritoryId,
    data: PersistedZoneMonsterData,
    nowGameSec: number
  ): void {
    const now = Date.now();
    this.runInTransaction(() => {
      this.db
        .prepare('DELETE FROM world_monster_state WHERE room_code = ? AND territory_id = ?')
        .run(roomCode, territoryId);

      const insertStmt = this.db.prepare(`
        INSERT INTO world_monster_state (
          room_code, territory_id, slot_id, hp, alive, respawn_at_game_time_sec, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const [slotId, respawnAt] of Object.entries(data.deadRespawns)) {
        if (respawnAt > nowGameSec) {
          insertStmt.run(roomCode, territoryId, slotId, 0, 0, respawnAt, now);
        }
      }

      for (const [slotId, hp] of Object.entries(data.damagedHp)) {
        if (hp > 0 && !data.deadRespawns[slotId]) {
          insertStmt.run(roomCode, territoryId, slotId, Math.round(hp), 1, 0, now);
        }
      }
    });
  }

  /**
   * Records a completed player-to-player trade in SQLite for server history/audit.
   */
  public logCompletedTrade(roomCode: string, session: PlayerTradeSession): void {
    const initOffer = session.offers[session.initiatorId];
    const targetOffer = session.offers[session.targetId];
    const summary = {
      initiatorOffer: initOffer
        ? {
            zen: initOffer.zen,
            jewels: initOffer.jewels,
            itemNames: initOffer.items.map((i) => `${i.name} +${i.level}`),
          }
        : null,
      targetOffer: targetOffer
        ? {
            zen: targetOffer.zen,
            jewels: targetOffer.jewels,
            itemNames: targetOffer.items.map((i) => `${i.name} +${i.level}`),
          }
        : null,
    };

    this.db
      .prepare(`
        INSERT INTO trade_logs (
          trade_id, room_code, territory_id, initiator_nickname, target_nickname, summary_json, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        session.tradeId,
        roomCode,
        session.inBloodCastle ? 'blood_castle' : session.territoryId,
        session.initiatorNickname,
        session.targetNickname,
        JSON.stringify(summary),
        Date.now()
      );
  }

  public listRecentTrades(limit = 20): TradeLogEntry[] {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = this.db
      .prepare('SELECT * FROM trade_logs ORDER BY completed_at DESC LIMIT ?')
      .all(safeLimit) as unknown as Array<{
      id: number;
      trade_id: string;
      room_code: string;
      territory_id: string;
      initiator_nickname: string;
      target_nickname: string;
      summary_json: string;
      completed_at: number;
    }>;

    return rows.map((r) => {
      let summary: Record<string, unknown> = {};
      try {
        summary = JSON.parse(r.summary_json) as Record<string, unknown>;
      } catch {
        summary = {};
      }
      return {
        id: r.id,
        tradeId: r.trade_id,
        roomCode: r.room_code,
        territoryId: r.territory_id,
        initiatorNickname: r.initiator_nickname,
        targetNickname: r.target_nickname,
        summary,
        completedAt: r.completed_at,
      };
    });
  }

  public getStats(): {
    charactersCount: number;
    itemsCount: number;
    persistedMonstersCount: number;
    tradesCount: number;
  } {
    const chars = this.db.prepare('SELECT COUNT(*) AS cnt FROM characters').get() as {
      cnt: number;
    };
    const items = this.db.prepare('SELECT COUNT(*) AS cnt FROM character_items').get() as {
      cnt: number;
    };
    const monsters = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM world_monster_state')
      .get() as { cnt: number };
    const trades = this.db.prepare('SELECT COUNT(*) AS cnt FROM trade_logs').get() as {
      cnt: number;
    };
    return {
      charactersCount: Number(chars?.cnt) || 0,
      itemsCount: Number(items?.cnt) || 0,
      persistedMonstersCount: Number(monsters?.cnt) || 0,
      tradesCount: Number(trades?.cnt) || 0,
    };
  }
}
