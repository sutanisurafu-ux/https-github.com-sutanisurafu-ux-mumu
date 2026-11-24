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

export const MAX_CHARACTERS_PER_ACCOUNT = 3;

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
  accountId: string | null;
  nickname: string;
  player: PlayerProgressState;
  posX: number;
  posY: number;
  currentHp: number;
  currentMp: number;
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

/**
 * Validates a player-chosen unique character name (3..18 characters, Latin/Cyrillic/digits/_/-).
 */
export function validateUniqueCharacterName(raw: unknown): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  if (typeof raw !== 'string') {
    return { valid: false, normalized: '', error: 'Введите имя персонажа.' };
  }
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 3) {
    return { valid: false, normalized: trimmed, error: 'Имя должно содержать минимум 3 символа.' };
  }
  if (trimmed.length > 18) {
    return { valid: false, normalized: trimmed.slice(0, 18), error: 'Имя не должно превышать 18 символов.' };
  }
  if (!/^[a-zA-Zа-яА-ЯёЁ0-9_-]+(?: [a-zA-Zа-яА-ЯёЁ0-9_-]+)*$/.test(trimmed)) {
    return {
      valid: false,
      normalized: trimmed,
      error: 'Разрешены только буквы (RU/EN), цифры, дефис и подчёркивание.',
    };
  }
  return { valid: true, normalized: trimmed };
}

function clampServerCoord(raw: unknown, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-2400, Math.min(2400, Math.round(n * 10) / 10));
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
  account_id: string | null;
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
  pos_x: number;
  pos_y: number;
  current_hp: number;
  current_mp: number;
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
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        session_token_hash TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        account_id TEXT,
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
        pos_x REAL NOT NULL DEFAULT 0,
        pos_y REAL NOT NULL DEFAULT 220,
        current_hp INTEGER NOT NULL DEFAULT 0,
        current_mp INTEGER NOT NULL DEFAULT 0,
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

    // Safe forward migrations for existing VPS SQLite databases
    const colRows = this.db
      .prepare('PRAGMA table_info(characters)')
      .all() as unknown as Array<{ name: string }>;
    const cols = new Set(colRows.map((c) => c.name));
    if (!cols.has('account_id')) {
      this.db.exec('ALTER TABLE characters ADD COLUMN account_id TEXT;');
    }
    if (!cols.has('pos_x')) {
      this.db.exec('ALTER TABLE characters ADD COLUMN pos_x REAL NOT NULL DEFAULT 0;');
    }
    if (!cols.has('pos_y')) {
      this.db.exec('ALTER TABLE characters ADD COLUMN pos_y REAL NOT NULL DEFAULT 220;');
    }
    if (!cols.has('current_hp')) {
      this.db.exec('ALTER TABLE characters ADD COLUMN current_hp INTEGER NOT NULL DEFAULT 0;');
    }
    if (!cols.has('current_mp')) {
      this.db.exec('ALTER TABLE characters ADD COLUMN current_mp INTEGER NOT NULL DEFAULT 0;');
    }
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_characters_account ON characters (account_id);');

    // Deduplicate any legacy duplicate nicknames before enforcing server-wide case-insensitive uniqueness
    const dupRows = this.db
      .prepare(`
        SELECT id, nickname, LOWER(TRIM(nickname)) AS norm
        FROM characters
        ORDER BY updated_at DESC, created_at ASC
      `)
      .all() as unknown as Array<{ id: string; nickname: string; norm: string }>;
    const seenNorm = new Set<string>();
    for (const row of dupRows) {
      if (seenNorm.has(row.norm)) {
        const suffix = row.id.slice(-4);
        const renamed = `${row.nickname.slice(0, 13)}_${suffix}`;
        this.db.prepare('UPDATE characters SET nickname = ? WHERE id = ?').run(renamed, row.id);
        seenNorm.add(renamed.toLowerCase().trim());
      } else {
        seenNorm.add(row.norm);
      }
    }

    this.db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_unique_nickname ON characters (LOWER(TRIM(nickname)));'
    );
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
      accountId: row.account_id ?? null,
      nickname: row.nickname,
      player,
      posX: Number.isFinite(Number(row.pos_x)) ? Number(row.pos_x) : 0,
      posY: Number.isFinite(Number(row.pos_y)) ? Number(row.pos_y) : 220,
      currentHp: Math.max(0, Math.round(Number(row.current_hp) || 0)),
      currentMp: Math.max(0, Math.round(Number(row.current_mp) || 0)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Creates a persistent browser account backed by a hashed HttpOnly session token.
   */
  public createAccount(): { accountId: string; sessionToken: string } {
    const accountId = `acc_${crypto.randomBytes(8).toString('hex')}`;
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = hashOwnerToken(sessionToken);
    const now = Date.now();
    this.db
      .prepare(
        'INSERT INTO accounts (id, session_token_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'
      )
      .run(accountId, sessionTokenHash, now, now);
    return { accountId, sessionToken };
  }

  /**
   * Resolves an account ID from an HttpOnly session token using constant-time verification.
   */
  public getAccountIdBySessionToken(token: string): string | null {
    if (!token || token.length < 32) return null;
    const candidateHash = hashOwnerToken(token);
    const row = this.db
      .prepare('SELECT id, session_token_hash FROM accounts WHERE session_token_hash = ?')
      .get(candidateHash) as unknown as { id: string; session_token_hash: string } | undefined;
    if (!row) return null;
    if (!verifyOwnerTokenHash(token, row.session_token_hash)) return null;
    return row.id;
  }

  /**
   * Checks whether a character name is valid and globally unique across the entire server.
   */
  public isNicknameAvailable(rawName: unknown): {
    valid: boolean;
    available: boolean;
    normalized: string;
    error?: string;
  } {
    const check = validateUniqueCharacterName(rawName);
    if (!check.valid) {
      return {
        valid: false,
        available: false,
        normalized: check.normalized,
        error: check.error,
      };
    }
    const existing = this.db
      .prepare('SELECT id FROM characters WHERE LOWER(TRIM(nickname)) = LOWER(TRIM(?)) LIMIT 1')
      .get(check.normalized) as unknown as { id: string } | undefined;
    if (existing) {
      return {
        valid: true,
        available: false,
        normalized: check.normalized,
        error: `Имя «${check.normalized}» уже занято на сервере!`,
      };
    }
    return { valid: true, available: true, normalized: check.normalized };
  }

  /**
   * Lists all characters owned by an account (up to 3 slots), with full gear & vitals.
   */
  public listAccountCharacters(accountId: string): PersistedCharacterRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM characters WHERE account_id = ? ORDER BY created_at ASC LIMIT ?')
      .all(accountId, MAX_CHARACTERS_PER_ACCOUNT) as unknown as CharacterDbRow[];
    return rows.map((row) => this.hydrateCharacter(row));
  }

  /**
   * Creates a new character for an account (max 3 per account, globally unique name across server).
   */
  public createCharacterForAccount(params: {
    accountId: string;
    nickname: unknown;
    classId: unknown;
  }):
    | { status: 'ok'; record: PersistedCharacterRecord; ownerToken: string }
    | { status: 'limit_reached' | 'name_taken' | 'invalid_name'; error: string } {
    const nameCheck = this.isNicknameAvailable(params.nickname);
    if (!nameCheck.valid) {
      return {
        status: 'invalid_name',
        error: nameCheck.error ?? 'Некорректное имя персонажа.',
      };
    }
    if (!nameCheck.available) {
      return {
        status: 'name_taken',
        error: nameCheck.error ?? `Имя «${nameCheck.normalized}» уже занято на сервере!`,
      };
    }

    const countRow = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM characters WHERE account_id = ?')
      .get(params.accountId) as unknown as { cnt: number };
    if ((Number(countRow?.cnt) || 0) >= MAX_CHARACTERS_PER_ACCOUNT) {
      return {
        status: 'limit_reached',
        error: `Достигнут лимит: максимум ${MAX_CHARACTERS_PER_ACCOUNT} персонажа на аккаунт.`,
      };
    }

    const classId = sanitizeClassId(params.classId);
    const initialPlayer = createInitialPlayerState(classId);
    const id = `char_${crypto.randomBytes(8).toString('hex')}`;
    const ownerToken = crypto.randomBytes(32).toString('hex');
    const ownerTokenHash = hashOwnerToken(ownerToken);
    const now = Date.now();
    const startX = 0;
    const startY = 220;

    try {
      this.runInTransaction(() => {
        this.db
          .prepare(`
            INSERT INTO characters (
              id, account_id, nickname, class_id, class_tier, level, resets, exp, exp_to_next, stat_points,
              str, agi, vit, ene, zen,
              jewel_bless, jewel_soul, jewel_life, jewel_chaos,
              hp_potions, mp_potions, has_first_prof_quest_item,
              blood_scrolls, blood_fangs, blood_castle_tickets, in_blood_castle, blood_castle_clears,
              territory_id, pos_x, pos_y, current_hp, current_mp,
              kills_in_territory, total_kills, bosses_defeated, highest_reached_territory_idx,
              learned_skills_json, owner_token_hash, created_at, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?
            )
          `)
          .run(
            id,
            params.accountId,
            nameCheck.normalized,
            initialPlayer.classId,
            initialPlayer.classTier,
            initialPlayer.level,
            initialPlayer.resets,
            initialPlayer.exp,
            initialPlayer.expToNext,
            initialPlayer.statPoints,
            initialPlayer.attributes.str,
            initialPlayer.attributes.agi,
            initialPlayer.attributes.vit,
            initialPlayer.attributes.ene,
            initialPlayer.zen,
            initialPlayer.jewels.bless,
            initialPlayer.jewels.soul,
            initialPlayer.jewels.life,
            initialPlayer.jewels.chaos,
            initialPlayer.hpPotions,
            initialPlayer.mpPotions,
            0,
            0,
            0,
            0,
            0,
            0,
            initialPlayer.territoryId,
            startX,
            startY,
            0,
            0,
            0,
            0,
            0,
            initialPlayer.highestReachedTerritoryIdx,
            JSON.stringify(initialPlayer.learnedSkills),
            ownerTokenHash,
            now,
            now
          );

        this.replaceCharacterItemsTx(id, initialPlayer);
      });
    } catch {
      return {
        status: 'name_taken',
        error: `Имя «${nameCheck.normalized}» уже занято на сервере!`,
      };
    }

    return {
      status: 'ok',
      record: {
        id,
        accountId: params.accountId,
        nickname: nameCheck.normalized,
        player: initialPlayer,
        posX: startX,
        posY: startY,
        currentHp: 0,
        currentMp: 0,
        createdAt: now,
        updatedAt: now,
      },
      ownerToken,
    };
  }

  public getCharacterForAccount(
    characterId: string,
    accountId: string
  ): { status: 'ok'; record: PersistedCharacterRecord } | { status: 'not_found' | 'forbidden' } {
    const cleanId = sanitizeCharacterId(characterId);
    if (!cleanId) return { status: 'not_found' };
    const row = this.db
      .prepare('SELECT * FROM characters WHERE id = ?')
      .get(cleanId) as unknown as CharacterDbRow | undefined;
    if (!row) return { status: 'not_found' };
    if (row.account_id !== accountId) return { status: 'forbidden' };
    return { status: 'ok', record: this.hydrateCharacter(row) };
  }

  public updateCharacterForAccount(params: {
    characterId: string;
    accountId: string;
    player: unknown;
    posX?: number;
    posY?: number;
    currentHp?: number;
    currentMp?: number;
  }): { status: 'ok'; record: PersistedCharacterRecord } | { status: 'not_found' | 'forbidden' } {
    const cleanId = sanitizeCharacterId(params.characterId);
    if (!cleanId) return { status: 'not_found' };

    const existing = this.db
      .prepare(
        'SELECT id, account_id, nickname, pos_x, pos_y, current_hp, current_mp, created_at FROM characters WHERE id = ?'
      )
      .get(cleanId) as unknown as
      | {
          id: string;
          account_id: string | null;
          nickname: string;
          pos_x: number;
          pos_y: number;
          current_hp: number;
          current_mp: number;
          created_at: number;
        }
      | undefined;

    if (!existing) return { status: 'not_found' };
    if (existing.account_id !== params.accountId) return { status: 'forbidden' };

    const player = sanitizePlayerProgressForDb(params.player);
    const posX =
      params.posX !== undefined ? clampServerCoord(params.posX, existing.pos_x) : existing.pos_x;
    const posY =
      params.posY !== undefined ? clampServerCoord(params.posY, existing.pos_y) : existing.pos_y;
    const currentHp =
      params.currentHp !== undefined
        ? clampPositiveInt(params.currentHp, existing.current_hp, 100_000_000)
        : existing.current_hp;
    const currentMp =
      params.currentMp !== undefined
        ? clampPositiveInt(params.currentMp, existing.current_mp, 100_000_000)
        : existing.current_mp;
    const now = Date.now();

    this.runInTransaction(() => {
      this.db
        .prepare(`
          UPDATE characters SET
            class_id = ?, class_tier = ?, level = ?, resets = ?,
            exp = ?, exp_to_next = ?, stat_points = ?,
            str = ?, agi = ?, vit = ?, ene = ?, zen = ?,
            jewel_bless = ?, jewel_soul = ?, jewel_life = ?, jewel_chaos = ?,
            hp_potions = ?, mp_potions = ?, has_first_prof_quest_item = ?,
            blood_scrolls = ?, blood_fangs = ?, blood_castle_tickets = ?,
            in_blood_castle = ?, blood_castle_clears = ?,
            territory_id = ?, pos_x = ?, pos_y = ?, current_hp = ?, current_mp = ?,
            kills_in_territory = ?, total_kills = ?,
            bosses_defeated = ?, highest_reached_territory_idx = ?,
            learned_skills_json = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
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
          posX,
          posY,
          currentHp,
          currentMp,
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
        accountId: params.accountId,
        nickname: existing.nickname,
        player,
        posX,
        posY,
        currentHp,
        currentMp,
        createdAt: existing.created_at,
        updatedAt: now,
      },
    };
  }

  /**
   * Lightweight server-side vitals & coordinates checkpoint (called on WS periodic flush & disconnect)
   * so HP, MP, location, and territory persist seamlessly even if the browser closes abruptly.
   */
  public updateCharacterRuntimeVitals(params: {
    characterId: string;
    accountId: string;
    territoryId: TerritoryId;
    inBloodCastle: boolean;
    posX: number;
    posY: number;
    currentHp: number;
    currentMp: number;
  }): boolean {
    const cleanId = sanitizeCharacterId(params.characterId);
    if (!cleanId) return false;
    const now = Date.now();
    const res = this.db
      .prepare(`
        UPDATE characters
        SET territory_id = ?, in_blood_castle = ?, pos_x = ?, pos_y = ?, current_hp = ?, current_mp = ?, updated_at = ?
        WHERE id = ? AND account_id = ?
      `)
      .run(
        sanitizeTerritoryId(params.territoryId),
        params.inBloodCastle ? 1 : 0,
        clampServerCoord(params.posX, 0),
        clampServerCoord(params.posY, 220),
        clampPositiveInt(params.currentHp, 0, 100_000_000),
        clampPositiveInt(params.currentMp, 0, 100_000_000),
        now,
        cleanId,
        params.accountId
      );
    return Number(res.changes) > 0;
  }

  public deleteCharacterForAccount(
    characterId: string,
    accountId: string
  ): 'ok' | 'not_found' | 'forbidden' {
    const cleanId = sanitizeCharacterId(characterId);
    if (!cleanId) return 'not_found';
    const row = this.db
      .prepare('SELECT id, account_id FROM characters WHERE id = ?')
      .get(cleanId) as unknown as { id: string; account_id: string | null } | undefined;
    if (!row) return 'not_found';
    if (row.account_id !== accountId) return 'forbidden';
    this.db.prepare('DELETE FROM characters WHERE id = ? AND account_id = ?').run(cleanId, accountId);
    return 'ok';
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
    let nickname = sanitizePlayerNickname(params.nickname, 'Герой-MU');
    const nameTaken = this.db
      .prepare('SELECT id FROM characters WHERE LOWER(TRIM(nickname)) = LOWER(TRIM(?)) LIMIT 1')
      .get(nickname);
    if (nameTaken) {
      nickname = `${nickname.slice(0, 13)}_${id.slice(-4)}`;
    }
    const player = sanitizePlayerProgressForDb(params.player);
    const now = Date.now();

    this.runInTransaction(() => {
      this.db
        .prepare(`
          INSERT INTO characters (
            id, account_id, nickname, class_id, class_tier, level, resets, exp, exp_to_next, stat_points,
            str, agi, vit, ene, zen,
            jewel_bless, jewel_soul, jewel_life, jewel_chaos,
            hp_potions, mp_potions, has_first_prof_quest_item,
            blood_scrolls, blood_fangs, blood_castle_tickets, in_blood_castle, blood_castle_clears,
            territory_id, pos_x, pos_y, current_hp, current_mp,
            kills_in_territory, total_kills, bosses_defeated, highest_reached_territory_idx,
            learned_skills_json, owner_token_hash, created_at, updated_at
          ) VALUES (
            ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, 0, 220, 0, 0,
            ?, ?, ?, ?,
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
        accountId: null,
        nickname,
        player,
        posX: 0,
        posY: 220,
        currentHp: 0,
        currentMp: 0,
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
        accountId: null,
        nickname,
        player,
        posX: 0,
        posY: 220,
        currentHp: 0,
        currentMp: 0,
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
