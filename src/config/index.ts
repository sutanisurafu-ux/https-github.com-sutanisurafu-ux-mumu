/**
 * ============================================================================
 * ЦЕНТРАЛЬНАЯ ТОЧКА КОНФИГУРАЦИИ СЕРВЕРА И ИГРЫ (/src/config)
 * ============================================================================
 * Редактируйте нужный файл в папке src/config/:
 *   - server.ts           — порт, путь к SQLite БД, тики, глобальные рейты (x1/x2/...)
 *   - respawns.ts         — респауны всех типов мобов, боссов, разброс спотов и Blood Castle
 *   - dropRates.ts        — шансы дропа вещей, камней (Bless/Soul/Life/Chaos), крафт и заточка
 *   - characterScaling.ts — кривая опыта, статы от уровня/атрибутов, профессии и Grand Reset
 */

export { SERVER_CONFIG, type ServerConfig } from './server';
export {
  WORLD_BOUNDS_CONFIG,
  MONSTER_RESPAWN_CONFIG,
  BLOOD_CASTLE_CONFIG,
  type MonsterRespawnConfig,
  type BloodCastleConfig,
} from './respawns';
export { DROP_RATES, type DropRatesConfig } from './dropRates';
export { CHARACTER_SCALING, type CharacterScalingConfig } from './characterScaling';

import { CHARACTER_SCALING } from './characterScaling';
import { DROP_RATES } from './dropRates';
import { BLOOD_CASTLE_CONFIG, MONSTER_RESPAWN_CONFIG, WORLD_BOUNDS_CONFIG } from './respawns';
import { SERVER_CONFIG } from './server';

/**
 * Возвращает публичный read-only снимок игровых констант (для GET /api/config).
 * Не включает внутренние системные пути ФС.
 */
export function getPublicServerConfigSnapshot() {
  return {
    rates: SERVER_CONFIG.rates,
    maxPartySize: SERVER_CONFIG.maxPartySize,
    groundLootTtlMs: SERVER_CONFIG.groundLootTtlMs,
    worldRespawnTickMs: SERVER_CONFIG.worldRespawnTickMs,
    worldBounds: WORLD_BOUNDS_CONFIG,
    respawns: MONSTER_RESPAWN_CONFIG,
    bloodCastle: BLOOD_CASTLE_CONFIG,
    dropRates: DROP_RATES,
    characterScaling: CHARACTER_SCALING,
  };
}
