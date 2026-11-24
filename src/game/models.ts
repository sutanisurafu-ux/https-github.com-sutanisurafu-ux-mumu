import { CharacterClassId, ClassTier, EnemyEntity, EquipmentItem } from './types';

export interface HeroModelRenderOptions {
  classId: CharacterClassId;
  classTier: ClassTier;
  facingAngle: number;
  walkDistance: number;
  isMoving?: boolean;
  attackPhase: 'idle' | 'windup' | 'active' | 'recovery';
  attackTimer: number;
  hitFlash: boolean;
  weapon: EquipmentItem | null;
  armor: EquipmentItem | null;
  helm: EquipmentItem | null;
  wings: EquipmentItem | null;
  activeSetPieceCount: number;
  now: number;
  scale?: number;
}

export interface HeroFlightKinematics {
  isFlying: boolean;
  isMoving: boolean;
  legsRunning: boolean;
  stride: number;
  bodyBob: number;
  glideTiltRad: number;
  wingFlap: number;
  shadowScale: number;
  shadowAlpha: number;
  legTrailAngle: number;
  legFloatSway: number;
}

/**
 * Pure kinematic calculation for hero ground-run vs winged levitation/flight.
 * When wings are equipped, the hero floats smoothly above the ground with zero running leg cycle,
 * tilts aerodynamically into movement, and softens their ground shadow.
 */
export function getHeroFlightKinematics(params: {
  hasWings: boolean;
  isMoving: boolean;
  walkDistance: number;
  now: number;
  facingAngle: number;
}): HeroFlightKinematics {
  const { hasWings, isMoving, walkDistance, now, facingAngle } = params;
  const facingRight = Math.cos(facingAngle) >= -0.15;
  const dirX = facingRight ? 1 : -1;

  if (hasWings) {
    const hoverFreq = isMoving ? 0.0068 : 0.0044;
    const hoverAmp = isMoving ? 2.6 : 3.6;
    const hoverWave = Math.sin(now * hoverFreq);
    const bodyBob = -15 + hoverWave * hoverAmp;
    const flapFreq = isMoving ? 0.0115 : 0.0068;
    const flapAmp = isMoving ? 10.5 : 7.2;
    const wingFlap = Math.sin(now * flapFreq) * flapAmp;
    const glideTiltRad = dirX * (isMoving ? 0.13 : 0.03);
    const shadowScale = 0.72 + hoverWave * 0.045;
    const legTrailAngle = -dirX * (isMoving ? 0.34 : 0.11);
    const legFloatSway = Math.sin(now * 0.0052) * 1.6;

    return {
      isFlying: true,
      isMoving,
      legsRunning: false,
      stride: 0,
      bodyBob,
      glideTiltRad,
      wingFlap,
      shadowScale,
      shadowAlpha: 0.34,
      legTrailAngle,
      legFloatSway,
    };
  }

  const stride = isMoving ? Math.sin(walkDistance * 0.11) : 0;
  const idleBreath = Math.sin(now * 0.004) * 1.4;
  const bodyBob = (isMoving ? Math.abs(stride) * -2.8 : idleBreath) - 4;

  return {
    isFlying: false,
    isMoving,
    legsRunning: isMoving,
    stride,
    bodyBob,
    glideTiltRad: 0,
    wingFlap: 0,
    shadowScale: 1,
    shadowAlpha: 0.55,
    legTrailAngle: 0,
    legFloatSway: 0,
  };
}

export interface WingVisualMetrics {
  wingLevel: number;
  tier: 2 | 3;
  scaleMultiplier: number;
  baseSpan: number;
  effectiveSpan: number;
  featherLayers: number;
  hasLightningAura: boolean;
}

/**
 * Computes visual scaling and ornament parameters for equipped wings.
 * Wings grow larger by +2.4% per upgrade level (+0..+15), up to +36% larger at +15.
 */
export function getWingVisualMetrics(
  wings: EquipmentItem | null,
  classId: CharacterClassId
): WingVisualMetrics {
  if (!wings) {
    return {
      wingLevel: 0,
      tier: 2,
      scaleMultiplier: 1,
      baseSpan: 0,
      effectiveSpan: 0,
      featherLayers: 0,
      hasLightningAura: false,
    };
  }
  const wingLevel = Math.max(0, Math.min(15, Math.floor(wings.level ?? 0)));
  const isTier3 = wings.rarity === 'ancient' || /III|Шторма|Вечности|Иллюзии/i.test(wings.name);
  const tier: 2 | 3 = isTier3 ? 3 : 2;
  const scaleMultiplier = Number((1 + wingLevel * 0.024).toFixed(4));
  const baseSpan = isTier3
    ? classId === 'dark_knight'
      ? 58
      : classId === 'dark_wizard'
        ? 56
        : 55
    : classId === 'dark_knight'
      ? 46
      : classId === 'dark_wizard'
        ? 45
        : 44;
  const effectiveSpan = Number((baseSpan * scaleMultiplier).toFixed(2));
  return {
    wingLevel,
    tier,
    scaleMultiplier,
    baseSpan,
    effectiveSpan,
    featherLayers: isTier3 ? 5 : 4,
    hasLightningAura: isTier3 || wingLevel >= 7,
  };
}

export type ArmorSetVisualTier = 1 | 2 | 3 | 4 | 5;

export type ArmorChestMotif =
  | 'leather_wraps'
  | 'black_dragon_ribs'
  | 'noria_vine_crest'
  | 'elbeland_Templar_cross'
  | 'devias_frost_facets'
  | 'dark_phoenix_wings'
  | 'atlans_sea_scales'
  | 'tower_balrog_spikes'
  | 'tarkan_titan_plates'
  | 'icarus_sky_drake'
  | 'kanturu_emp_circuit'
  | 'ferea_eternal_ice'
  | 'great_titan_aegis'
  | 'dw_linen_tunic'
  | 'dw_anubis_hieroglyph'
  | 'dw_noria_sage_stole'
  | 'dw_elbeland_mist_weave'
  | 'dw_devias_blizzard_fur'
  | 'dw_legendary_archmage'
  | 'dw_atlans_abyss_coral'
  | 'dw_tower_eclipse_sun'
  | 'dw_tarkan_storm_sigil'
  | 'dw_icarus_starlight'
  | 'dw_kanturu_relic_matrix'
  | 'dw_acheron_pentagram'
  | 'dw_kundun_eternity'
  | 'elf_lorencia_tunic'
  | 'elf_noria_guardian'
  | 'elf_elbeland_moon'
  | 'elf_devias_snow_silk'
  | 'elf_red_spirit_blossom'
  | 'elf_atlans_siren_shell'
  | 'elf_tower_valkyrie'
  | 'elf_tarkan_oasis_gold'
  | 'elf_icarus_feather'
  | 'elf_crywolf_altar'
  | 'elf_nixie_crystal'
  | 'elf_sylphid_divine';

export type ArmorHelmMotif =
  | 'cap'
  | 'black_dragon_horns'
  | 'noria_warden_crest'
  | 'elbeland_crown'
  | 'devias_ice_visor'
  | 'phoenix_flame_crest'
  | 'atlans_fin_helm'
  | 'balrog_bull_horns'
  | 'tarkan_sand_mask'
  | 'icarus_sky_crown'
  | 'kanturu_titan_visor'
  | 'ferea_ice_crown'
  | 'great_titan_halo'
  | 'dw_apprentice_band'
  | 'dw_anubis_jackal_crown'
  | 'dw_noria_leaf_circlet'
  | 'dw_elbeland_crescent_diadem'
  | 'dw_devias_frost_crown'
  | 'dw_legendary_halo_crown'
  | 'dw_atlans_pearl_tiara'
  | 'dw_tower_eclipse_crown'
  | 'dw_tarkan_oracle_veil'
  | 'dw_icarus_star_diadem'
  | 'dw_kanturu_nightmare_helm'
  | 'dw_acheron_spire_crown'
  | 'dw_kundun_eternal_mitre'
  | 'elf_grove_circlet'
  | 'elf_noria_wing_diadem'
  | 'elf_elbeland_moon_tiara'
  | 'elf_devias_ice_wreath'
  | 'elf_red_spirit_tiara'
  | 'elf_atlans_coral_crown'
  | 'elf_valkyrie_winged_helm'
  | 'elf_tarkan_sun_tiara'
  | 'elf_icarus_cloud_crown'
  | 'elf_crywolf_wolf_crown'
  | 'elf_nixie_crystal_diadem'
  | 'elf_sylphid_seraph_crown';

export interface ItemUpgradeColorEffect {
  level: number;
  basePrimaryColor: string;
  baseSecondaryColor: string;
  tintedPrimaryColor: string;
  tintedSecondaryColor: string;
  isBlueDarkened: boolean;
  blueDarkenFactor: number;
  hasBrightPrimaryGlow: boolean;
  primaryGlowColor: string;
  primaryGlowIntensity: number;
  hasSubtleWhiteSheen: boolean;
  whiteSheenAlpha: number;
}

function parseHexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return { r, g, b };
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) {
    return { r: 200, g: 200, b: 200 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function blendHexColors(hexA: string, hexB: string, ratioB: number): string {
  const t = Math.max(0, Math.min(1, ratioB));
  const a = parseHexToRgb(hexA);
  const b = parseHexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/**
 * Computes the visual color tint, primary-color radiance, and pearlescent white sheen for
 * an equipment item based on its upgrade level (+0..+15):
 * - +1 to +6: Slightly darkens & shifts toward deep cobalt/midnight blue (`isBlueDarkened`).
 * - +6 to +9 (and +6..+15): Radiates brightly with the item's own base primary color (`hasBrightPrimaryGlow`).
 * - +10 to +15: Adds a subtle pearlescent white sheen (`hasSubtleWhiteSheen`).
 */
export function resolveItemUpgradeColorEffect(
  levelInput: number | undefined | null,
  basePrimaryColor: string,
  baseSecondaryColor: string
): ItemUpgradeColorEffect {
  const level = Math.max(0, Math.min(15, Math.floor(levelInput ?? 0)));
  const isBlueDarkened = level >= 1 && level <= 6;
  const blueDarkenFactor = isBlueDarkened
    ? level === 6
      ? 0.16
      : Number((0.16 + (level - 1) * 0.045).toFixed(2))
    : 0;

  let tintedPrimaryColor = basePrimaryColor;
  let tintedSecondaryColor = baseSecondaryColor;

  if (level >= 1 && level <= 5) {
    tintedPrimaryColor = blendHexColors(basePrimaryColor, '#162a66', blueDarkenFactor);
    tintedSecondaryColor = blendHexColors(baseSecondaryColor, '#0b1536', blueDarkenFactor);
  } else if (level === 6) {
    tintedPrimaryColor = blendHexColors(basePrimaryColor, '#1d3a8a', blueDarkenFactor);
    tintedSecondaryColor = blendHexColors(baseSecondaryColor, '#0f1f4d', blueDarkenFactor);
  } else if (level >= 7) {
    const brightenRatio = Math.min(0.24, 0.12 + (level - 7) * 0.015);
    tintedPrimaryColor = blendHexColors(basePrimaryColor, '#ffffff', brightenRatio);
  }

  const hasBrightPrimaryGlow = level >= 6;
  const primaryGlowIntensity = hasBrightPrimaryGlow
    ? Number(Math.min(1, 0.62 + (level - 6) * 0.125).toFixed(2))
    : 0;

  const hasSubtleWhiteSheen = level >= 10;
  const whiteSheenAlpha = hasSubtleWhiteSheen
    ? Number((0.16 + Math.min(5, level - 10) * 0.03).toFixed(2))
    : 0;

  return {
    level,
    basePrimaryColor,
    baseSecondaryColor,
    tintedPrimaryColor,
    tintedSecondaryColor,
    isBlueDarkened,
    blueDarkenFactor,
    hasBrightPrimaryGlow,
    primaryGlowColor: basePrimaryColor,
    primaryGlowIntensity,
    hasSubtleWhiteSheen,
    whiteSheenAlpha,
  };
}

export interface ArmorSetVisualStyle {
  tier: ArmorSetVisualTier;
  styleId: string;
  helmStyleId: string;
  chestMotif: ArmorChestMotif;
  helmMotif: ArmorHelmMotif;
  basePrimaryColor: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  trimColor: string;
  gemColor: string;
  capeColor: string;
  capeInnerColor: string;
  baseHelmPrimaryColor: string;
  helmPrimaryColor: string;
  helmSecondaryColor: string;
  helmTrimColor: string;
  helmGemColor: string;
  hasShoulderSpikes: boolean;
  hasWingedPauldrons: boolean;
  hasGlowingCore: boolean;
  upgradeGlowIntensity: number;
  hasArmorExcellentGlow: boolean;
  hasHelmExcellentGlow: boolean;
  hasExcellentGreenGlow: boolean;
  excellentGlowColor: string;
  hasArmorAncientGlow: boolean;
  hasHelmAncientGlow: boolean;
  hasAncientPurpleGlow: boolean;
  ancientGlowColor: string;
  armorUpgradeEffect: ItemUpgradeColorEffect;
  helmUpgradeEffect: ItemUpgradeColorEffect;
}

interface ArmorCatalogVisualPreset {
  styleId: string;
  helmStyleId: string;
  tier: ArmorSetVisualTier;
  chestMotif: ArmorChestMotif;
  helmMotif: ArmorHelmMotif;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  trimColor: string;
  gemColor: string;
  capeColor: string;
  capeInnerColor: string;
  hasShoulderSpikes: boolean;
  hasWingedPauldrons: boolean;
  hasGlowingCore: boolean;
}

const DK_ARMOR_PRESETS: Array<{ match: RegExp; preset: ArmorCatalogVisualPreset }> = [
  {
    match: /Кожаный/i,
    preset: {
      styleId: 'dk_lorencia_leather',
      helmStyleId: 'dk_helm_lorencia_leather',
      tier: 1,
      chestMotif: 'leather_wraps',
      helmMotif: 'cap',
      primaryColor: '#7c3f23',
      secondaryColor: '#3b1d11',
      accentColor: '#b45309',
      trimColor: '#d97706',
      gemColor: '#f59e0b',
      capeColor: '#572219',
      capeInnerColor: '#29100c',
      hasShoulderSpikes: false,
      hasWingedPauldrons: false,
      hasGlowingCore: false,
    },
  },
  {
    match: /Стража Нории/i,
    preset: {
      styleId: 'dk_noria_guardian',
      helmStyleId: 'dk_helm_noria_guardian',
      tier: 1,
      chestMotif: 'noria_vine_crest',
      helmMotif: 'noria_warden_crest',
      primaryColor: '#3f6212',
      secondaryColor: '#1a2e05',
      accentColor: '#84cc16',
      trimColor: '#eab308',
      gemColor: '#4ade80',
      capeColor: '#365314',
      capeInnerColor: '#14532d',
      hasShoulderSpikes: false,
      hasWingedPauldrons: false,
      hasGlowingCore: false,
    },
  },
  {
    match: /Эльбеланда/i,
    preset: {
      styleId: 'dk_elbeland_knight',
      helmStyleId: 'dk_helm_elbeland_crown',
      tier: 2,
      chestMotif: 'elbeland_Templar_cross',
      helmMotif: 'elbeland_crown',
      primaryColor: '#64748b',
      secondaryColor: '#1e293b',
      accentColor: '#a855f7',
      trimColor: '#e2e8f0',
      gemColor: '#c084fc',
      capeColor: '#4c1d95',
      capeInnerColor: '#1e1b4b',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: false,
    },
  },
  {
    match: /Девиаса/i,
    preset: {
      styleId: 'dk_devias_northern_plate',
      helmStyleId: 'dk_helm_devias_ice',
      tier: 2,
      chestMotif: 'devias_frost_facets',
      helmMotif: 'devias_ice_visor',
      primaryColor: '#0284c7',
      secondaryColor: '#0c4a6e',
      accentColor: '#7dd3fc',
      trimColor: '#e0f2fe',
      gemColor: '#38bdf8',
      capeColor: '#075985',
      capeInnerColor: '#082f49',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Чёрного Дракона/i,
    preset: {
      styleId: 'dk_black_dragon',
      helmStyleId: 'dk_helm_black_dragon',
      tier: 3,
      chestMotif: 'black_dragon_ribs',
      helmMotif: 'black_dragon_horns',
      primaryColor: '#991b1b',
      secondaryColor: '#1f090d',
      accentColor: '#ef4444',
      trimColor: '#d4a853',
      gemColor: '#fbbf24',
      capeColor: '#7f1d1d',
      capeInnerColor: '#310a0b',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Чёрного Феникса/i,
    preset: {
      styleId: 'dk_black_phoenix',
      helmStyleId: 'dk_helm_black_phoenix',
      tier: 3,
      chestMotif: 'dark_phoenix_wings',
      helmMotif: 'phoenix_flame_crest',
      primaryColor: '#c2410c',
      secondaryColor: '#271206',
      accentColor: '#fb923c',
      trimColor: '#fde047',
      gemColor: '#f97316',
      capeColor: '#9a3412',
      capeInnerColor: '#431407',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Атланса/i,
    preset: {
      styleId: 'dk_atlans_scale',
      helmStyleId: 'dk_helm_atlans_depths',
      tier: 3,
      chestMotif: 'atlans_sea_scales',
      helmMotif: 'atlans_fin_helm',
      primaryColor: '#0d9488',
      secondaryColor: '#134e4a',
      accentColor: '#2dd4bf',
      trimColor: '#fde047',
      gemColor: '#5eead4',
      capeColor: '#0f766e',
      capeInnerColor: '#042f2e',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Повелителя Башни|Рогатый Шлем Балрога/i,
    preset: {
      styleId: 'dk_tower_overlord_balrog',
      helmStyleId: 'dk_helm_balrog_horned',
      tier: 3,
      chestMotif: 'tower_balrog_spikes',
      helmMotif: 'balrog_bull_horns',
      primaryColor: '#4c0519',
      secondaryColor: '#18181b',
      accentColor: '#f43f5e',
      trimColor: '#fbbf24',
      gemColor: '#e11d48',
      capeColor: '#881337',
      capeInnerColor: '#09090b',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Пустынного Титана|Песчаной Бури/i,
    preset: {
      styleId: 'dk_tarkan_desert_titan',
      helmStyleId: 'dk_helm_tarkan_sandstorm',
      tier: 4,
      chestMotif: 'tarkan_titan_plates',
      helmMotif: 'tarkan_sand_mask',
      primaryColor: '#b45309',
      secondaryColor: '#451a03',
      accentColor: '#fbbf24',
      trimColor: '#fef08a',
      gemColor: '#f59e0b',
      capeColor: '#92400e',
      capeInnerColor: '#271206',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Небесного Дракона|Небесного Феникса/i,
    preset: {
      styleId: 'dk_icarus_sky_dragon',
      helmStyleId: 'dk_helm_icarus_sky_phoenix',
      tier: 4,
      chestMotif: 'icarus_sky_drake',
      helmMotif: 'icarus_sky_crown',
      primaryColor: '#dc2626',
      secondaryColor: '#1e3a8a',
      accentColor: '#38bdf8',
      trimColor: '#fde047',
      gemColor: '#7dd3fc',
      capeColor: '#991b1b',
      capeInnerColor: '#172554',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Кантуру/i,
    preset: {
      styleId: 'dk_kanturu_emperor',
      helmStyleId: 'dk_helm_kanturu_titan',
      tier: 4,
      chestMotif: 'kanturu_emp_circuit',
      helmMotif: 'kanturu_titan_visor',
      primaryColor: '#312e81',
      secondaryColor: '#090d16',
      accentColor: '#22d3ee',
      trimColor: '#fbbf24',
      gemColor: '#06b6d4',
      capeColor: '#1e1b4b',
      capeInnerColor: '#0f172a',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Вечного Льда|Фереи/i,
    preset: {
      styleId: 'dk_ferea_eternal_ice',
      helmStyleId: 'dk_helm_ferea_crown',
      tier: 5,
      chestMotif: 'ferea_eternal_ice',
      helmMotif: 'ferea_ice_crown',
      primaryColor: '#0ea5e9',
      secondaryColor: '#1e1b4b',
      accentColor: '#e0f2fe',
      trimColor: '#fef08a',
      gemColor: '#38bdf8',
      capeColor: '#0369a1',
      capeInnerColor: '#0c4a6e',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Великого Титана|Титана/i,
    preset: {
      styleId: 'dk_dark_phoenix_titan',
      helmStyleId: 'dk_helm_great_titan',
      tier: 5,
      chestMotif: 'great_titan_aegis',
      helmMotif: 'great_titan_halo',
      primaryColor: '#b91c1c',
      secondaryColor: '#1e1b4b',
      accentColor: '#f97316',
      trimColor: '#fef08a',
      gemColor: '#fde047',
      capeColor: '#7c2d12',
      capeInnerColor: '#31102f',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
];

const DW_ARMOR_PRESETS: Array<{ match: RegExp; preset: ArmorCatalogVisualPreset }> = [
  {
    match: /Холщовая|Повязка Ученика/i,
    preset: {
      styleId: 'dw_lorencia_apprentice',
      helmStyleId: 'dw_helm_lorencia_band',
      tier: 1,
      chestMotif: 'dw_linen_tunic',
      helmMotif: 'dw_apprentice_band',
      primaryColor: '#475569',
      secondaryColor: '#1e293b',
      accentColor: '#93c5fd',
      trimColor: '#cba36b',
      gemColor: '#60a5fa',
      capeColor: '#334155',
      capeInnerColor: '#0f172a',
      hasShoulderSpikes: false,
      hasWingedPauldrons: false,
      hasGlowingCore: false,
    },
  },
  {
    match: /Анубиса/i,
    preset: {
      styleId: 'dw_anubis_sacred',
      helmStyleId: 'dw_helm_anubis_crown',
      tier: 2,
      chestMotif: 'dw_anubis_hieroglyph',
      helmMotif: 'dw_anubis_jackal_crown',
      primaryColor: '#1e3a8a',
      secondaryColor: '#0f172a',
      accentColor: '#fbbf24',
      trimColor: '#fde047',
      gemColor: '#38bdf8',
      capeColor: '#172554',
      capeInnerColor: '#451a03',
      hasShoulderSpikes: false,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Мудреца Нории|Венец Нории/i,
    preset: {
      styleId: 'dw_noria_sage',
      helmStyleId: 'dw_helm_noria_circlet',
      tier: 1,
      chestMotif: 'dw_noria_sage_stole',
      helmMotif: 'dw_noria_leaf_circlet',
      primaryColor: '#0f766e',
      secondaryColor: '#042f2e',
      accentColor: '#5eead4',
      trimColor: '#d4a853',
      gemColor: '#34d399',
      capeColor: '#115e59',
      capeInnerColor: '#022c22',
      hasShoulderSpikes: false,
      hasWingedPauldrons: false,
      hasGlowingCore: false,
    },
  },
  {
    match: /Туманов Эльбеланда|Диадема Эльбеланда/i,
    preset: {
      styleId: 'dw_elbeland_mist',
      helmStyleId: 'dw_helm_elbeland_diadem',
      tier: 2,
      chestMotif: 'dw_elbeland_mist_weave',
      helmMotif: 'dw_elbeland_crescent_diadem',
      primaryColor: '#6d28d9',
      secondaryColor: '#2e1065',
      accentColor: '#d8b4fe',
      trimColor: '#e2e8f0',
      gemColor: '#c084fc',
      capeColor: '#4c1d95',
      capeInnerColor: '#1e1b4b',
      hasShoulderSpikes: false,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Вьюги Девиаса|Стужи Девиаса/i,
    preset: {
      styleId: 'dw_devias_blizzard',
      helmStyleId: 'dw_helm_devias_frost',
      tier: 2,
      chestMotif: 'dw_devias_blizzard_fur',
      helmMotif: 'dw_devias_frost_crown',
      primaryColor: '#0284c7',
      secondaryColor: '#0c4a6e',
      accentColor: '#e0f2fe',
      trimColor: '#bae6fd',
      gemColor: '#38bdf8',
      capeColor: '#075985',
      capeInnerColor: '#082f49',
      hasShoulderSpikes: false,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Легендарного Духа/i,
    preset: {
      styleId: 'dw_legendary_archmage',
      helmStyleId: 'dw_helm_legendary_spirit',
      tier: 3,
      chestMotif: 'dw_legendary_archmage',
      helmMotif: 'dw_legendary_halo_crown',
      primaryColor: '#1d4ed8',
      secondaryColor: '#172554',
      accentColor: '#fbbf24',
      trimColor: '#fde047',
      gemColor: '#38bdf8',
      capeColor: '#1e3a8a',
      capeInnerColor: '#0f172a',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Бездны Атланса|Тиара Атланса/i,
    preset: {
      styleId: 'dw_atlans_abyss',
      helmStyleId: 'dw_helm_atlans_tiara',
      tier: 3,
      chestMotif: 'dw_atlans_abyss_coral',
      helmMotif: 'dw_atlans_pearl_tiara',
      primaryColor: '#0891b2',
      secondaryColor: '#164e63',
      accentColor: '#67e8f9',
      trimColor: '#fde047',
      gemColor: '#22d3ee',
      capeColor: '#0e7490',
      capeInnerColor: '#083344',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Затмения/i,
    preset: {
      styleId: 'dw_tower_eclipse',
      helmStyleId: 'dw_helm_tower_eclipse',
      tier: 3,
      chestMotif: 'dw_tower_eclipse_sun',
      helmMotif: 'dw_tower_eclipse_crown',
      primaryColor: '#7f1d1d',
      secondaryColor: '#18181b',
      accentColor: '#fb923c',
      trimColor: '#fbbf24',
      gemColor: '#f43f5e',
      capeColor: '#450a0a',
      capeInnerColor: '#09090b',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Бури Таркана|Оракула Таркана/i,
    preset: {
      styleId: 'dw_tarkan_storm',
      helmStyleId: 'dw_helm_tarkan_oracle',
      tier: 4,
      chestMotif: 'dw_tarkan_storm_sigil',
      helmMotif: 'dw_tarkan_oracle_veil',
      primaryColor: '#92400e',
      secondaryColor: '#271206',
      accentColor: '#fde047',
      trimColor: '#fbbf24',
      gemColor: '#38bdf8',
      capeColor: '#78350f',
      capeInnerColor: '#1c1917',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Звёздного Икаруса|Диадема Икаруса/i,
    preset: {
      styleId: 'dw_icarus_starlight',
      helmStyleId: 'dw_helm_icarus_diadem',
      tier: 4,
      chestMotif: 'dw_icarus_starlight',
      helmMotif: 'dw_icarus_star_diadem',
      primaryColor: '#2563eb',
      secondaryColor: '#1e1b4b',
      accentColor: '#7dd3fc',
      trimColor: '#f8fafc',
      gemColor: '#a855f7',
      capeColor: '#312e81',
      capeInnerColor: '#090d16',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Реликвий Кантуру|Кошмара Кантуру/i,
    preset: {
      styleId: 'dw_kanturu_relic',
      helmStyleId: 'dw_helm_kanturu_nightmare',
      tier: 4,
      chestMotif: 'dw_kanturu_relic_matrix',
      helmMotif: 'dw_kanturu_nightmare_helm',
      primaryColor: '#3b0764',
      secondaryColor: '#090d16',
      accentColor: '#2dd4bf',
      trimColor: '#e879f9',
      gemColor: '#22d3ee',
      capeColor: '#2e1065',
      capeInnerColor: '#042f2e',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Пентаграмм Ахерона|Корона Ахерона/i,
    preset: {
      styleId: 'dw_acheron_pentagram',
      helmStyleId: 'dw_helm_acheron_crown',
      tier: 5,
      chestMotif: 'dw_acheron_pentagram',
      helmMotif: 'dw_acheron_spire_crown',
      primaryColor: '#be185d',
      secondaryColor: '#1e1b4b',
      accentColor: '#f472b6',
      trimColor: '#fef08a',
      gemColor: '#38bdf8',
      capeColor: '#831843',
      capeInnerColor: '#172554',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Вечности|Кундуна/i,
    preset: {
      styleId: 'dw_kundun_eternal',
      helmStyleId: 'dw_helm_kundun_eternity',
      tier: 5,
      chestMotif: 'dw_kundun_eternity',
      helmMotif: 'dw_kundun_eternal_mitre',
      primaryColor: '#581c87',
      secondaryColor: '#0f172a',
      accentColor: '#38bdf8',
      trimColor: '#fef08a',
      gemColor: '#e879f9',
      capeColor: '#3b0764',
      capeInnerColor: '#172554',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
];

const ELF_ARMOR_PRESETS: Array<{ match: RegExp; preset: ArmorCatalogVisualPreset }> = [
  {
    match: /Лёгкая Туника Лоренсии|Обруч Рощи Лоренсии/i,
    preset: {
      styleId: 'elf_lorencia_grove',
      helmStyleId: 'elf_helm_lorencia_circlet',
      tier: 1,
      chestMotif: 'elf_lorencia_tunic',
      helmMotif: 'elf_grove_circlet',
      primaryColor: '#4d7c0f',
      secondaryColor: '#1a2e05',
      accentColor: '#a3e635',
      trimColor: '#d97706',
      gemColor: '#84cc16',
      capeColor: '#3f6212',
      capeInnerColor: '#14532d',
      hasShoulderSpikes: false,
      hasWingedPauldrons: false,
      hasGlowingCore: false,
    },
  },
  {
    match: /Стража Нории/i,
    preset: {
      styleId: 'elf_noria_guardian',
      helmStyleId: 'elf_helm_noria_diadem',
      tier: 1,
      chestMotif: 'elf_noria_guardian',
      helmMotif: 'elf_noria_wing_diadem',
      primaryColor: '#15803d',
      secondaryColor: '#14532d',
      accentColor: '#86efac',
      trimColor: '#d4a853',
      gemColor: '#4ade80',
      capeColor: '#065f46',
      capeInnerColor: '#022c22',
      hasShoulderSpikes: false,
      hasWingedPauldrons: false,
      hasGlowingCore: false,
    },
  },
  {
    match: /Луны Эльбеланда|Тиара Эльбеланда/i,
    preset: {
      styleId: 'elf_elbeland_moon',
      helmStyleId: 'elf_helm_elbeland_tiara',
      tier: 2,
      chestMotif: 'elf_elbeland_moon',
      helmMotif: 'elf_elbeland_moon_tiara',
      primaryColor: '#6366f1',
      secondaryColor: '#1e1b4b',
      accentColor: '#c7d2fe',
      trimColor: '#e2e8f0',
      gemColor: '#a5b4fc',
      capeColor: '#4338ca',
      capeInnerColor: '#1e1b4b',
      hasShoulderSpikes: false,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Снегов Девиаса|Льдов Девиаса/i,
    preset: {
      styleId: 'elf_devias_snow',
      helmStyleId: 'elf_helm_devias_ice',
      tier: 2,
      chestMotif: 'elf_devias_snow_silk',
      helmMotif: 'elf_devias_ice_wreath',
      primaryColor: '#0d9488',
      secondaryColor: '#134e4a',
      accentColor: '#99f6e4',
      trimColor: '#e2e8f0',
      gemColor: '#2dd4bf',
      capeColor: '#115e59',
      capeInnerColor: '#042f2e',
      hasShoulderSpikes: false,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Красного Духа/i,
    preset: {
      styleId: 'elf_red_spirit_guardian',
      helmStyleId: 'elf_helm_red_spirit',
      tier: 3,
      chestMotif: 'elf_red_spirit_blossom',
      helmMotif: 'elf_red_spirit_tiara',
      primaryColor: '#be123c',
      secondaryColor: '#4c0519',
      accentColor: '#34d399',
      trimColor: '#fde047',
      gemColor: '#fb7185',
      capeColor: '#881337',
      capeInnerColor: '#064e3b',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Сирены Атланса/i,
    preset: {
      styleId: 'elf_atlans_siren',
      helmStyleId: 'elf_helm_atlans_siren',
      tier: 3,
      chestMotif: 'elf_atlans_siren_shell',
      helmMotif: 'elf_atlans_coral_crown',
      primaryColor: '#0284c7',
      secondaryColor: '#0c4a6e',
      accentColor: '#f472b6',
      trimColor: '#fde047',
      gemColor: '#38bdf8',
      capeColor: '#0369a1',
      capeInnerColor: '#164e63',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Валькирии/i,
    preset: {
      styleId: 'elf_tower_valkyrie',
      helmStyleId: 'elf_helm_valkyrie_diadem',
      tier: 3,
      chestMotif: 'elf_tower_valkyrie',
      helmMotif: 'elf_valkyrie_winged_helm',
      primaryColor: '#d97706',
      secondaryColor: '#451a03',
      accentColor: '#fef08a',
      trimColor: '#fde047',
      gemColor: '#38bdf8',
      capeColor: '#991b1b',
      capeInnerColor: '#450a0a',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Оазиса Таркана|Песков Таркана/i,
    preset: {
      styleId: 'elf_tarkan_oasis',
      helmStyleId: 'elf_helm_tarkan_sands',
      tier: 4,
      chestMotif: 'elf_tarkan_oasis_gold',
      helmMotif: 'elf_tarkan_sun_tiara',
      primaryColor: '#059669',
      secondaryColor: '#451a03',
      accentColor: '#fbbf24',
      trimColor: '#fef08a',
      gemColor: '#34d399',
      capeColor: '#047857',
      capeInnerColor: '#78350f',
      hasShoulderSpikes: true,
      hasWingedPauldrons: false,
      hasGlowingCore: true,
    },
  },
  {
    match: /Крылатый Доспех Икаруса|Облаков Икаруса/i,
    preset: {
      styleId: 'elf_icarus_winged',
      helmStyleId: 'elf_helm_icarus_clouds',
      tier: 4,
      chestMotif: 'elf_icarus_feather',
      helmMotif: 'elf_icarus_cloud_crown',
      primaryColor: '#0ea5e9',
      secondaryColor: '#0c4a6e',
      accentColor: '#fef08a',
      trimColor: '#ffffff',
      gemColor: '#38bdf8',
      capeColor: '#0284c7',
      capeInnerColor: '#1e1b4b',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Крайвульфа|Алтаря Волка/i,
    preset: {
      styleId: 'elf_crywolf_warden',
      helmStyleId: 'elf_helm_crywolf_altar',
      tier: 4,
      chestMotif: 'elf_crywolf_altar',
      helmMotif: 'elf_crywolf_wolf_crown',
      primaryColor: '#334155',
      secondaryColor: '#0f172a',
      accentColor: '#f43f5e',
      trimColor: '#e2e8f0',
      gemColor: '#fb7185',
      capeColor: '#881337',
      capeInnerColor: '#1e293b',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Хрустальной Никси|Озера Никси/i,
    preset: {
      styleId: 'elf_nixie_crystal',
      helmStyleId: 'elf_helm_nixie_lake',
      tier: 5,
      chestMotif: 'elf_nixie_crystal',
      helmMotif: 'elf_nixie_crystal_diadem',
      primaryColor: '#06b6d4',
      secondaryColor: '#164e63',
      accentColor: '#e0f2fe',
      trimColor: '#a5f3fc',
      gemColor: '#67e8f9',
      capeColor: '#0891b2',
      capeInnerColor: '#1e1b4b',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
  {
    match: /Сильфиды/i,
    preset: {
      styleId: 'elf_sylphid_iris',
      helmStyleId: 'elf_helm_sylphid_crown',
      tier: 5,
      chestMotif: 'elf_sylphid_divine',
      helmMotif: 'elf_sylphid_seraph_crown',
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      accentColor: '#38bdf8',
      trimColor: '#fef08a',
      gemColor: '#fde047',
      capeColor: '#065f46',
      capeInnerColor: '#312e81',
      hasShoulderSpikes: true,
      hasWingedPauldrons: true,
      hasGlowingCore: true,
    },
  },
];

function findCatalogArmorPreset(
  classId: CharacterClassId,
  itemName: string,
  def: number
): ArmorCatalogVisualPreset {
  const table =
    classId === 'dark_knight'
      ? DK_ARMOR_PRESETS
      : classId === 'dark_wizard'
        ? DW_ARMOR_PRESETS
        : ELF_ARMOR_PRESETS;
  const cleaned = itemName.replace(/^(Exc\.|Anc\.)\s+/i, '').trim();
  for (const entry of table) {
    if (entry.match.test(cleaned)) {
      return entry.preset;
    }
  }
  // Fallback by defense tier if an unknown custom name is passed
  if (def >= 115) return table[table.length - 1].preset;
  if (def >= 72) return table[Math.min(table.length - 1, 9)].preset;
  if (def >= 36) return table[Math.min(table.length - 1, 5)].preset;
  if (def >= 20) return table[Math.min(table.length - 1, 3)].preset;
  return table[0].preset;
}

/**
 * Resolves the equipped armor & helm into unique per-name visual styles so every single named
 * armor and helm across all 3 classes has a distinct appearance, palette, and motif, while also
 * flagging Excellent (`Exe`) items for their signature soft emerald-green luminescence.
 */
export function resolveArmorSetVisualStyle(
  classId: CharacterClassId,
  armor: EquipmentItem | null,
  helm: EquipmentItem | null
): ArmorSetVisualStyle {
  const refItem = armor ?? helm;
  const maxLevel = Math.max(armor?.level ?? 0, helm?.level ?? 0);
  const rarity = armor?.rarity ?? helm?.rarity ?? 'normal';

  const armorPreset = findCatalogArmorPreset(
    classId,
    armor?.name ?? helm?.name ?? '',
    armor?.baseDefense ?? helm?.baseDefense ?? 0
  );
  const helmPreset = findCatalogArmorPreset(
    classId,
    helm?.name ?? armor?.name ?? '',
    helm?.baseDefense ?? armor?.baseDefense ?? 0
  );

  const tier: ArmorSetVisualTier =
    rarity === 'ancient'
      ? 5
      : (Math.max(armorPreset.tier, helmPreset.tier) as ArmorSetVisualTier);

  const upgradeGlowIntensity = refItem
    ? Math.min(
        1,
        Math.max(0, (maxLevel - 2) / 13) +
          (rarity === 'ancient' ? 0.35 : rarity === 'excellent' ? 0.25 : 0)
      )
    : 0;

  const hasArmorExcellentGlow = armor?.rarity === 'excellent';
  const hasHelmExcellentGlow = helm?.rarity === 'excellent';
  const hasExcellentGreenGlow = hasArmorExcellentGlow || hasHelmExcellentGlow;

  const hasArmorAncientGlow = armor?.rarity === 'ancient';
  const hasHelmAncientGlow = helm?.rarity === 'ancient';
  const hasAncientPurpleGlow = hasArmorAncientGlow || hasHelmAncientGlow;

  const armorUpgradeEffect = resolveItemUpgradeColorEffect(
    armor?.level ?? 0,
    armorPreset.primaryColor,
    armorPreset.secondaryColor
  );
  const helmUpgradeEffect = resolveItemUpgradeColorEffect(
    helm?.level ?? 0,
    helmPreset.primaryColor,
    helmPreset.secondaryColor
  );

  return {
    tier,
    styleId: armorPreset.styleId,
    helmStyleId: helmPreset.helmStyleId,
    chestMotif: armorPreset.chestMotif,
    helmMotif: helmPreset.helmMotif,
    basePrimaryColor: armorPreset.primaryColor,
    primaryColor: armorUpgradeEffect.tintedPrimaryColor,
    secondaryColor: armorUpgradeEffect.tintedSecondaryColor,
    accentColor: armorPreset.accentColor,
    trimColor: armorPreset.trimColor,
    gemColor: armorPreset.gemColor,
    capeColor: armorPreset.capeColor,
    capeInnerColor: armorPreset.capeInnerColor,
    baseHelmPrimaryColor: helmPreset.primaryColor,
    helmPrimaryColor: helmUpgradeEffect.tintedPrimaryColor,
    helmSecondaryColor: helmUpgradeEffect.tintedSecondaryColor,
    helmTrimColor: helmPreset.trimColor,
    helmGemColor: helmPreset.gemColor,
    hasShoulderSpikes: armorPreset.hasShoulderSpikes,
    hasWingedPauldrons: armorPreset.hasWingedPauldrons,
    hasGlowingCore: armorPreset.hasGlowingCore,
    upgradeGlowIntensity: tier === 5 ? Math.max(0.55, upgradeGlowIntensity) : upgradeGlowIntensity,
    hasArmorExcellentGlow,
    hasHelmExcellentGlow,
    hasExcellentGreenGlow,
    excellentGlowColor: '#34d399',
    hasArmorAncientGlow,
    hasHelmAncientGlow,
    hasAncientPurpleGlow,
    ancientGlowColor: '#c084fc',
    armorUpgradeEffect,
    helmUpgradeEffect,
  };
}

export type WeaponVisualArchetype =
  | 'unarmed'
  | 'dk_short_sword'
  | 'dk_chaos_blade'
  | 'dk_noria_emerald_blade'
  | 'dk_frost_runeblade'
  | 'dk_devias_ice_blade'
  | 'dk_destruction_greatsword'
  | 'dk_atlans_trident'
  | 'dk_balrog_scythe'
  | 'dk_tarkan_zaikan_broadblade'
  | 'dk_phoenix_flameblade'
  | 'dk_kalima_abyss_sword'
  | 'dk_loren_royal_greatsword'
  | 'dk_archangel_flameblade'
  | 'dw_apprentice_staff'
  | 'dw_legendary_soul_staff'
  | 'dw_noria_ancient_staff'
  | 'dw_elbeland_illusion_wand'
  | 'dw_frost_crystal_staff'
  | 'dw_dragon_soul_staff'
  | 'dw_atlans_water_staff'
  | 'dw_balrog_chaos_staff'
  | 'dw_tarkan_sand_rod'
  | 'dw_icarus_heavens_staff'
  | 'dw_kalima_oracle_wand'
  | 'dw_kanturu_imperial_scepter'
  | 'dw_archangel_kundun_staff'
  | 'elf_short_recurve_bow'
  | 'elf_silver_wing_bow'
  | 'elf_noria_queen_bow'
  | 'elf_elbeland_wind_bow'
  | 'elf_crystal_coral_bow'
  | 'elf_holy_crossbow'
  | 'elf_atlans_coral_bow'
  | 'elf_tower_chaos_bow'
  | 'elf_tarkan_golden_sand_bow'
  | 'elf_winged_icarus_bow'
  | 'elf_kanturu_nightmare_crossbow'
  | 'elf_raklion_frost_bow'
  | 'elf_archangel_crossbow';

export interface WeaponVisualStyle {
  archetype: WeaponVisualArchetype;
  weaponId: WeaponVisualArchetype;
  baseBladePrimary: string;
  bladePrimary: string;
  bladeSecondary: string;
  guardColor: string;
  gemColor: string;
  shaftColor: string;
  auraColor: string;
  lengthScale: number;
  hasExcellentGreenGlow: boolean;
  excellentGlowColor: string;
  hasAncientPurpleGlow: boolean;
  ancientGlowColor: string;
  upgradeEffect: ItemUpgradeColorEffect;
}

interface WeaponCatalogPreset {
  archetype: WeaponVisualArchetype;
  bladePrimary: string;
  bladeSecondary: string;
  guardColor: string;
  gemColor: string;
  shaftColor: string;
  auraColor: string;
  lengthScale: number;
}

const DK_WEAPON_PRESETS: Array<{ match: RegExp; preset: WeaponCatalogPreset }> = [
  {
    match: /Короткий Меч Лоренсии/i,
    preset: {
      archetype: 'dk_short_sword',
      bladePrimary: '#e2e8f0',
      bladeSecondary: '#64748b',
      guardColor: '#b45309',
      gemColor: '#f59e0b',
      shaftColor: '#78350f',
      auraColor: 'rgba(251, 191, 36, 0.28)',
      lengthScale: 0.92,
    },
  },
  {
    match: /Клинок Хаоса/i,
    preset: {
      archetype: 'dk_chaos_blade',
      bladePrimary: '#cbd5e1',
      bladeSecondary: '#475569',
      guardColor: '#d97706',
      gemColor: '#ef4444',
      shaftColor: '#451a03',
      auraColor: 'rgba(239, 68, 68, 0.35)',
      lengthScale: 0.98,
    },
  },
  {
    match: /Изумрудной Нории/i,
    preset: {
      archetype: 'dk_noria_emerald_blade',
      bladePrimary: '#bbf7d0',
      bladeSecondary: '#15803d',
      guardColor: '#eab308',
      gemColor: '#22c55e',
      shaftColor: '#14532d',
      auraColor: 'rgba(34, 197, 94, 0.42)',
      lengthScale: 1.0,
    },
  },
  {
    match: /Рунный Меч Эльбеланда/i,
    preset: {
      archetype: 'dk_frost_runeblade',
      bladePrimary: '#e9d5ff',
      bladeSecondary: '#7e22ce',
      guardColor: '#cbd5e1',
      gemColor: '#c084fc',
      shaftColor: '#3b0764',
      auraColor: 'rgba(192, 132, 252, 0.45)',
      lengthScale: 1.03,
    },
  },
  {
    match: /Ледяной Клинок Девиаса/i,
    preset: {
      archetype: 'dk_devias_ice_blade',
      bladePrimary: '#e0f2fe',
      bladeSecondary: '#0284c7',
      guardColor: '#bae6fd',
      gemColor: '#38bdf8',
      shaftColor: '#0c4a6e',
      auraColor: 'rgba(56, 189, 248, 0.48)',
      lengthScale: 1.05,
    },
  },
  {
    match: /Клинок Разрушения/i,
    preset: {
      archetype: 'dk_destruction_greatsword',
      bladePrimary: '#f8fafc',
      bladeSecondary: '#dc2626',
      guardColor: '#f59e0b',
      gemColor: '#ef4444',
      shaftColor: '#450a0a',
      auraColor: 'rgba(248, 113, 113, 0.52)',
      lengthScale: 1.1,
    },
  },
  {
    match: /Трезубец Атланса/i,
    preset: {
      archetype: 'dk_atlans_trident',
      bladePrimary: '#38bdf8',
      bladeSecondary: '#0284c7',
      guardColor: '#fde047',
      gemColor: '#7dd3fc',
      shaftColor: '#d97706',
      auraColor: 'rgba(56, 189, 248, 0.55)',
      lengthScale: 1.15,
    },
  },
  {
    match: /Коса Балрога/i,
    preset: {
      archetype: 'dk_balrog_scythe',
      bladePrimary: '#ef4444',
      bladeSecondary: '#450a0a',
      guardColor: '#fbbf24',
      gemColor: '#f97316',
      shaftColor: '#27272a',
      auraColor: 'rgba(239, 68, 68, 0.55)',
      lengthScale: 1.18,
    },
  },
  {
    match: /Заикана Таркана/i,
    preset: {
      archetype: 'dk_tarkan_zaikan_broadblade',
      bladePrimary: '#fde047',
      bladeSecondary: '#b45309',
      guardColor: '#f59e0b',
      gemColor: '#fb923c',
      shaftColor: '#451a03',
      auraColor: 'rgba(245, 158, 11, 0.58)',
      lengthScale: 1.13,
    },
  },
  {
    match: /Огненного Феникса/i,
    preset: {
      archetype: 'dk_phoenix_flameblade',
      bladePrimary: '#fed7aa',
      bladeSecondary: '#ea580c',
      guardColor: '#fde047',
      gemColor: '#f97316',
      shaftColor: '#7c2d12',
      auraColor: 'rgba(249, 115, 22, 0.65)',
      lengthScale: 1.14,
    },
  },
  {
    match: /Бездны Калимы/i,
    preset: {
      archetype: 'dk_kalima_abyss_sword',
      bladePrimary: '#c084fc',
      bladeSecondary: '#312e81',
      guardColor: '#22d3ee',
      gemColor: '#e879f9',
      shaftColor: '#1e1b4b',
      auraColor: 'rgba(168, 85, 247, 0.65)',
      lengthScale: 1.15,
    },
  },
  {
    match: /Королевский Меч Лорена/i,
    preset: {
      archetype: 'dk_loren_royal_greatsword',
      bladePrimary: '#ffffff',
      bladeSecondary: '#eab308',
      guardColor: '#fde047',
      gemColor: '#ef4444',
      shaftColor: '#713f12',
      auraColor: 'rgba(250, 204, 21, 0.68)',
      lengthScale: 1.16,
    },
  },
  {
    match: /Божественный Меч Архангела|Архангела/i,
    preset: {
      archetype: 'dk_archangel_flameblade',
      bladePrimary: '#fef08a',
      bladeSecondary: '#f97316',
      guardColor: '#fde047',
      gemColor: '#38bdf8',
      shaftColor: '#92400e',
      auraColor: 'rgba(251, 191, 36, 0.75)',
      lengthScale: 1.18,
    },
  },
];

const DW_WEAPON_PRESETS: Array<{ match: RegExp; preset: WeaponCatalogPreset }> = [
  {
    match: /Ученический Посох Лоренсии/i,
    preset: {
      archetype: 'dw_apprentice_staff',
      bladePrimary: '#b45309',
      bladeSecondary: '#78350f',
      guardColor: '#d97706',
      gemColor: '#60a5fa',
      shaftColor: '#78350f',
      auraColor: 'rgba(96, 165, 250, 0.3)',
      lengthScale: 0.94,
    },
  },
  {
    match: /Легендарной Души/i,
    preset: {
      archetype: 'dw_legendary_soul_staff',
      bladePrimary: '#93c5fd',
      bladeSecondary: '#1d4ed8',
      guardColor: '#fbbf24',
      gemColor: '#38bdf8',
      shaftColor: '#1e3a8a',
      auraColor: 'rgba(56, 189, 248, 0.38)',
      lengthScale: 0.98,
    },
  },
  {
    match: /Древней Нории/i,
    preset: {
      archetype: 'dw_noria_ancient_staff',
      bladePrimary: '#86efac',
      bladeSecondary: '#15803d',
      guardColor: '#d97706',
      gemColor: '#34d399',
      shaftColor: '#3f6212',
      auraColor: 'rgba(52, 211, 153, 0.4)',
      lengthScale: 1.0,
    },
  },
  {
    match: /Иллюзий Эльбеланда/i,
    preset: {
      archetype: 'dw_elbeland_illusion_wand',
      bladePrimary: '#d8b4fe',
      bladeSecondary: '#6d28d9',
      guardColor: '#e2e8f0',
      gemColor: '#c084fc',
      shaftColor: '#4c1d95',
      auraColor: 'rgba(192, 132, 252, 0.45)',
      lengthScale: 1.01,
    },
  },
  {
    match: /Ледяной Посох Девиаса/i,
    preset: {
      archetype: 'dw_frost_crystal_staff',
      bladePrimary: '#bae6fd',
      bladeSecondary: '#0284c7',
      guardColor: '#e0f2fe',
      gemColor: '#7dd3fc',
      shaftColor: '#075985',
      auraColor: 'rgba(56, 189, 248, 0.46)',
      lengthScale: 1.03,
    },
  },
  {
    match: /Души Дракона/i,
    preset: {
      archetype: 'dw_dragon_soul_staff',
      bladePrimary: '#cbd5e1',
      bladeSecondary: '#1e3a8a',
      guardColor: '#fbbf24',
      gemColor: '#38bdf8',
      shaftColor: '#334155',
      auraColor: 'rgba(56, 189, 248, 0.5)',
      lengthScale: 1.06,
    },
  },
  {
    match: /Вод Атланса/i,
    preset: {
      archetype: 'dw_atlans_water_staff',
      bladePrimary: '#5eead4',
      bladeSecondary: '#0f766e',
      guardColor: '#fde047',
      gemColor: '#2dd4bf',
      shaftColor: '#115e59',
      auraColor: 'rgba(45, 212, 191, 0.52)',
      lengthScale: 1.08,
    },
  },
  {
    match: /Пламени Балрога/i,
    preset: {
      archetype: 'dw_balrog_chaos_staff',
      bladePrimary: '#f97316',
      bladeSecondary: '#7c2d12',
      guardColor: '#fde047',
      gemColor: '#fb7185',
      shaftColor: '#450a0a',
      auraColor: 'rgba(249, 115, 22, 0.55)',
      lengthScale: 1.1,
    },
  },
  {
    match: /Песков Таркана/i,
    preset: {
      archetype: 'dw_tarkan_sand_rod',
      bladePrimary: '#fbbf24',
      bladeSecondary: '#92400e',
      guardColor: '#fef08a',
      gemColor: '#f59e0b',
      shaftColor: '#451a03',
      auraColor: 'rgba(245, 158, 11, 0.55)',
      lengthScale: 1.09,
    },
  },
  {
    match: /Небес Икаруса/i,
    preset: {
      archetype: 'dw_icarus_heavens_staff',
      bladePrimary: '#e0f2fe',
      bladeSecondary: '#2563eb',
      guardColor: '#fef08a',
      gemColor: '#38bdf8',
      shaftColor: '#1d4ed8',
      auraColor: 'rgba(56, 189, 248, 0.62)',
      lengthScale: 1.12,
    },
  },
  {
    match: /Оракула Калимы/i,
    preset: {
      archetype: 'dw_kalima_oracle_wand',
      bladePrimary: '#22d3ee',
      bladeSecondary: '#312e81',
      guardColor: '#e879f9',
      gemColor: '#06b6d4',
      shaftColor: '#1e1b4b',
      auraColor: 'rgba(34, 211, 238, 0.62)',
      lengthScale: 1.13,
    },
  },
  {
    match: /Скипетр Империи Кантуру/i,
    preset: {
      archetype: 'dw_kanturu_imperial_scepter',
      bladePrimary: '#fde047',
      bladeSecondary: '#581c87',
      guardColor: '#fbbf24',
      gemColor: '#e879f9',
      shaftColor: '#3b0764',
      auraColor: 'rgba(232, 121, 249, 0.66)',
      lengthScale: 1.14,
    },
  },
  {
    match: /Посох Архангела Кундуна|Архангела|Кундуна/i,
    preset: {
      archetype: 'dw_archangel_kundun_staff',
      bladePrimary: '#fef08a',
      bladeSecondary: '#a855f7',
      guardColor: '#fde047',
      gemColor: '#38bdf8',
      shaftColor: '#fde047',
      auraColor: 'rgba(192, 132, 252, 0.75)',
      lengthScale: 1.17,
    },
  },
];

const ELF_WEAPON_PRESETS: Array<{ match: RegExp; preset: WeaponCatalogPreset }> = [
  {
    match: /Короткий Лук Лоренсии/i,
    preset: {
      archetype: 'elf_short_recurve_bow',
      bladePrimary: '#d97706',
      bladeSecondary: '#78350f',
      guardColor: '#fbbf24',
      gemColor: '#4ade80',
      shaftColor: '#78350f',
      auraColor: 'rgba(74, 222, 128, 0.28)',
      lengthScale: 0.92,
    },
  },
  {
    match: /Серебряного Крыла/i,
    preset: {
      archetype: 'elf_silver_wing_bow',
      bladePrimary: '#e2e8f0',
      bladeSecondary: '#64748b',
      guardColor: '#38bdf8',
      gemColor: '#7dd3fc',
      shaftColor: '#475569',
      auraColor: 'rgba(125, 211, 252, 0.38)',
      lengthScale: 0.97,
    },
  },
  {
    match: /Королевы Нории/i,
    preset: {
      archetype: 'elf_noria_queen_bow',
      bladePrimary: '#4ade80',
      bladeSecondary: '#15803d',
      guardColor: '#fde047',
      gemColor: '#86efac',
      shaftColor: '#14532d',
      auraColor: 'rgba(74, 222, 128, 0.42)',
      lengthScale: 1.0,
    },
  },
  {
    match: /Ветров Эльбеланда/i,
    preset: {
      archetype: 'elf_elbeland_wind_bow',
      bladePrimary: '#c4b5fd',
      bladeSecondary: '#5b21b6',
      guardColor: '#e2e8f0',
      gemColor: '#a78bfa',
      shaftColor: '#3b0764',
      auraColor: 'rgba(167, 139, 250, 0.45)',
      lengthScale: 1.02,
    },
  },
  {
    match: /Хрустальный Лук Девиаса/i,
    preset: {
      archetype: 'elf_crystal_coral_bow',
      bladePrimary: '#67e8f9',
      bladeSecondary: '#0284c7',
      guardColor: '#e0f2fe',
      gemColor: '#38bdf8',
      shaftColor: '#075985',
      auraColor: 'rgba(56, 189, 248, 0.48)',
      lengthScale: 1.05,
    },
  },
  {
    match: /Арбалет Святого Духа/i,
    preset: {
      archetype: 'elf_holy_crossbow',
      bladePrimary: '#e2e8f0',
      bladeSecondary: '#0f766e',
      guardColor: '#fbbf24',
      gemColor: '#34d399',
      shaftColor: '#78350f',
      auraColor: 'rgba(45, 212, 191, 0.52)',
      lengthScale: 1.08,
    },
  },
  {
    match: /Коралловый Лук Атланса/i,
    preset: {
      archetype: 'elf_atlans_coral_bow',
      bladePrimary: '#f472b6',
      bladeSecondary: '#0d9488',
      guardColor: '#fde047',
      gemColor: '#2dd4bf',
      shaftColor: '#0f766e',
      auraColor: 'rgba(244, 114, 182, 0.5)',
      lengthScale: 1.07,
    },
  },
  {
    match: /Лук Хаоса Башни/i,
    preset: {
      archetype: 'elf_tower_chaos_bow',
      bladePrimary: '#ef4444',
      bladeSecondary: '#450a0a',
      guardColor: '#fbbf24',
      gemColor: '#f97316',
      shaftColor: '#27272a',
      auraColor: 'rgba(239, 68, 68, 0.54)',
      lengthScale: 1.09,
    },
  },
  {
    match: /Золотых Песков/i,
    preset: {
      archetype: 'elf_tarkan_golden_sand_bow',
      bladePrimary: '#fde047',
      bladeSecondary: '#b45309',
      guardColor: '#fef08a',
      gemColor: '#34d399',
      shaftColor: '#78350f',
      auraColor: 'rgba(250, 204, 21, 0.56)',
      lengthScale: 1.11,
    },
  },
  {
    match: /Крылатый Лук Икаруса/i,
    preset: {
      archetype: 'elf_winged_icarus_bow',
      bladePrimary: '#fef08a',
      bladeSecondary: '#38bdf8',
      guardColor: '#f59e0b',
      gemColor: '#34d399',
      shaftColor: '#0284c7',
      auraColor: 'rgba(56, 189, 248, 0.6)',
      lengthScale: 1.14,
    },
  },
  {
    match: /Арбалет Кошмара Кантуру/i,
    preset: {
      archetype: 'elf_kanturu_nightmare_crossbow',
      bladePrimary: '#c084fc',
      bladeSecondary: '#1e1b4b',
      guardColor: '#22d3ee',
      gemColor: '#e879f9',
      shaftColor: '#312e81',
      auraColor: 'rgba(192, 132, 252, 0.62)',
      lengthScale: 1.12,
    },
  },
  {
    match: /Ледяного Раклиона/i,
    preset: {
      archetype: 'elf_raklion_frost_bow',
      bladePrimary: '#e0f2fe',
      bladeSecondary: '#0369a1',
      guardColor: '#bae6fd',
      gemColor: '#38bdf8',
      shaftColor: '#0c4a6e',
      auraColor: 'rgba(125, 211, 252, 0.66)',
      lengthScale: 1.15,
    },
  },
  {
    match: /Божественный Арбалет Архангела|Архангела/i,
    preset: {
      archetype: 'elf_archangel_crossbow',
      bladePrimary: '#fef08a',
      bladeSecondary: '#10b981',
      guardColor: '#fde047',
      gemColor: '#38bdf8',
      shaftColor: '#fde047',
      auraColor: 'rgba(52, 211, 153, 0.75)',
      lengthScale: 1.16,
    },
  },
];

/**
 * Classifies the equipped weapon into a unique visual weapon archetype so every single one of
 * the 39 named weapons across all 3 classes has a distinct visual silhouette, palette, and
 * Excellent (`Exe`) emerald-green glow flag.
 */
export function resolveWeaponVisualStyle(
  classId: CharacterClassId,
  weapon: EquipmentItem | null
): WeaponVisualStyle {
  if (!weapon) {
    const unarmedUpgrade = resolveItemUpgradeColorEffect(0, '#d4a853', '#78350f');
    return {
      archetype: 'unarmed',
      weaponId: 'unarmed',
      baseBladePrimary: '#d4a853',
      bladePrimary: '#d4a853',
      bladeSecondary: '#78350f',
      guardColor: '#92400e',
      gemColor: '#fbbf24',
      shaftColor: '#78350f',
      auraColor: 'rgba(251, 191, 36, 0)',
      lengthScale: 1,
      hasExcellentGreenGlow: false,
      excellentGlowColor: '#34d399',
      hasAncientPurpleGlow: false,
      ancientGlowColor: '#c084fc',
      upgradeEffect: unarmedUpgrade,
    };
  }

  const cleanedName = weapon.name.replace(/^(Exc\.|Anc\.)\s+/i, '').trim();
  const atk = weapon.baseAttack ?? 15;
  const hasExcellentGreenGlow = weapon.rarity === 'excellent';
  const hasAncientPurpleGlow = weapon.rarity === 'ancient';

  const table =
    classId === 'dark_knight'
      ? DK_WEAPON_PRESETS
      : classId === 'dark_wizard'
        ? DW_WEAPON_PRESETS
        : ELF_WEAPON_PRESETS;

  let chosen: WeaponCatalogPreset | null = null;
  for (const entry of table) {
    if (entry.match.test(cleanedName)) {
      chosen = entry.preset;
      break;
    }
  }

  if (!chosen) {
    if (weapon.rarity === 'ancient' || atk >= 145) {
      chosen = table[table.length - 1].preset;
    } else if (atk >= 95) {
      chosen = table[Math.min(table.length - 1, 9)].preset;
    } else if (atk >= 52) {
      chosen = table[Math.min(table.length - 1, 5)].preset;
    } else if (atk >= 28 || weapon.rarity === 'magic') {
      chosen = table[Math.min(table.length - 1, 3)].preset;
    } else {
      chosen = table[0].preset;
    }
  }

  const upgradeEffect = resolveItemUpgradeColorEffect(
    weapon.level ?? 0,
    chosen.bladePrimary,
    chosen.bladeSecondary
  );

  return {
    archetype: chosen.archetype,
    weaponId: chosen.archetype,
    baseBladePrimary: chosen.bladePrimary,
    bladePrimary: upgradeEffect.tintedPrimaryColor,
    bladeSecondary: upgradeEffect.tintedSecondaryColor,
    guardColor: chosen.guardColor,
    gemColor: chosen.gemColor,
    shaftColor: chosen.shaftColor,
    auraColor: hasExcellentGreenGlow
      ? 'rgba(52, 211, 153, 0.72)'
      : hasAncientPurpleGlow
        ? 'rgba(192, 132, 252, 0.75)'
        : upgradeEffect.hasBrightPrimaryGlow
          ? chosen.bladePrimary
          : chosen.auraColor,
    lengthScale: chosen.lengthScale,
    hasExcellentGreenGlow,
    excellentGlowColor: '#34d399',
    hasAncientPurpleGlow,
    ancientGlowColor: '#c084fc',
    upgradeEffect,
  };
}

/**
 * Renders intricate, multi-layered Chaos Wings (Tier 2 & Tier 3) with dynamic level-based size scaling (+0..+15),
 * individual feather/membrane anatomy, shoulder hinges, glowing venation, and orbiting aura particles.
 */
function drawDetailedHeroWings(
  ctx: CanvasRenderingContext2D,
  classId: CharacterClassId,
  wings: EquipmentItem,
  wingFlap: number,
  now: number
): void {
  const metrics = getWingVisualMetrics(wings, classId);
  const { wingLevel, tier, scaleMultiplier, effectiveSpan } = metrics;
  const isTier3 = tier === 3;
  const flap = wingFlap;
  const secondaryFlap = Math.sin(now * 0.009 - 0.65) * (Math.abs(wingFlap) * 0.65 + 2.2);
  const shimmer = 0.72 + Math.sin(now * 0.007) * 0.28;

  ctx.save();
  // Wings pivot from the upper shoulder blades and scale up smoothly with upgrade level (+0..+15)
  ctx.translate(0, -21);
  ctx.scale(scaleMultiplier, scaleMultiplier);

  // Subtle dorsal aura halo behind the shoulder blades for Tier 3 or +7..+15 wings
  if (isTier3 || wingLevel >= 5) {
    const haloRadius = (isTier3 ? 25 : 19) + wingLevel * 0.45;
    const haloColor =
      classId === 'dark_knight'
        ? `rgba(239, 68, 68, ${(0.18 + shimmer * 0.12).toFixed(2)})`
        : classId === 'dark_wizard'
          ? `rgba(56, 189, 248, ${(0.2 + shimmer * 0.12).toFixed(2)})`
          : `rgba(52, 211, 153, ${(0.2 + shimmer * 0.12).toFixed(2)})`;
    const haloGrad = ctx.createRadialGradient(0, -4, 3, 0, -4, haloRadius);
    haloGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    haloGrad.addColorStop(0.55, haloColor);
    haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(0, -4, haloRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  const span = metrics.baseSpan;

  if (classId === 'dark_knight') {
    // =========================================================================
    // DARK KNIGHT: WINGS OF SATAN II / WINGS OF STORM III
    // Armored wyvern/demon wings with claw apex, costal bone struts, molten veins & storm pinions
    // =========================================================================
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.scale(side, 1);

      // Tier 3 Upper Storm Blade-Pinion (secondary upper wing crest)
      if (isTier3) {
        const upperGrad = ctx.createLinearGradient(4, -8, span * 0.92, -38 - flap);
        upperGrad.addColorStop(0, '#7f1d1d');
        upperGrad.addColorStop(0.5, '#ef4444');
        upperGrad.addColorStop(1, '#fef08a');
        ctx.fillStyle = upperGrad;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(5, -4);
        ctx.bezierCurveTo(16, -34 - flap * 1.1, 36, -46 - flap * 0.95, span * 0.9, -35 - flap * 0.8);
        ctx.quadraticCurveTo(span * 0.64, -18 - flap * 0.4, 7, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Main Demonic Dragon Membrane with 4 scalloped bat-wing bays
      const memGrad = ctx.createLinearGradient(4, -22, span, 16);
      memGrad.addColorStop(0, '#2a0609');
      memGrad.addColorStop(0.38, '#991b1b');
      memGrad.addColorStop(0.75, isTier3 ? '#dc2626' : '#7f1d1d');
      memGrad.addColorStop(1, isTier3 ? '#fbbf24' : '#450a0a');

      const tipX = span;
      const tipY = -20 - flap * 0.72;
      const midRibX = span * 0.84;
      const midRibY = 3 - flap * 0.32;
      const lowRibX = span * 0.58;
      const lowRibY = 17 - secondaryFlap * 0.25;
      const innerRibX = 20;
      const innerRibY = 15;

      ctx.fillStyle = memGrad;
      ctx.strokeStyle = isTier3 ? '#fde047' : '#f87171';
      ctx.lineWidth = 1.6;

      ctx.beginPath();
      ctx.moveTo(4, 2);
      // Leading armored wing-arm up to thumb-claw apex and out to wingtip
      ctx.quadraticCurveTo(18, -28 - flap * 1.05, 27, -29 - flap * 0.95);
      ctx.quadraticCurveTo(42, -31 - flap * 0.85, tipX, tipY);
      // Scalloped bat membrane arches between rib tips
      ctx.quadraticCurveTo(span * 0.84, -9 - flap * 0.45, midRibX, midRibY);
      ctx.quadraticCurveTo(span * 0.65, 5 - flap * 0.2, lowRibX, lowRibY);
      ctx.quadraticCurveTo(32, 9, innerRibX, innerRibY);
      ctx.quadraticCurveTo(11, 7, 4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing molten magma veins branching across the wing membrane
      ctx.strokeStyle = isTier3
        ? `rgba(254, 240, 138, ${(0.55 + shimmer * 0.35).toFixed(2)})`
        : `rgba(251, 113, 133, ${(0.42 + shimmer * 0.25).toFixed(2)})`;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      // Rib 1 to tip
      ctx.moveTo(27, -28 - flap * 0.95);
      ctx.quadraticCurveTo(38, -16 - flap * 0.6, midRibX, midRibY);
      // Rib 2
      ctx.moveTo(23, -22 - flap * 0.8);
      ctx.quadraticCurveTo(31, -4 - flap * 0.35, lowRibX, lowRibY);
      // Rib 3
      ctx.moveTo(15, -12 - flap * 0.45);
      ctx.quadraticCurveTo(18, 2, innerRibX, innerRibY);
      ctx.stroke();

      // Heavy Armored Leading Edge & Golden Thumb-Talon Claw
      ctx.strokeStyle = isTier3 ? '#fef08a' : '#d4a853';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(4, 2);
      ctx.quadraticCurveTo(17, -27 - flap * 1.05, 27, -29 - flap * 0.95);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Apex Dragon Claw Talon
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(25, -28 - flap * 0.95);
      ctx.lineTo(29, -37 - flap * 1.05);
      ctx.lineTo(31, -27 - flap * 0.9);
      ctx.closePath();
      ctx.fill();

      // Shoulder Hinge Medallion
      ctx.fillStyle = isTier3 ? '#fbbf24' : '#991b1b';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(6, 2, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  } else if (classId === 'dark_wizard') {
    // =========================================================================
    // DARK WIZARD: WINGS OF HEAVEN II / WINGS OF ETERNAL III
    // Layered Celestial Archangel & 4-Winged Seraphim plumage with individual sculpted feathers
    // =========================================================================
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.scale(side, 1);

      // Tier 3 Lower Seraphim Astral Tail-Wing (4-winged Archangel silhouette)
      if (isTier3) {
        const seraphGrad = ctx.createLinearGradient(4, 2, span * 0.78, 24);
        seraphGrad.addColorStop(0, '#e0f2fe');
        seraphGrad.addColorStop(0.45, '#818cf8');
        seraphGrad.addColorStop(1, '#c084fc');
        ctx.fillStyle = seraphGrad;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.2;
        for (let s = 0; s < 3; s++) {
          const sx = span * (0.68 - s * 0.12);
          const sy = 14 + s * 5 - secondaryFlap * 0.25;
          ctx.beginPath();
          ctx.moveTo(5, 4 + s * 1.5);
          ctx.quadraticCurveTo(20, 6 + s * 3, sx, sy);
          ctx.quadraticCurveTo(sx * 0.6, sy + 5, 5, 8 + s * 1.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }

      // Layer 1: Primary Outer Flight Pinions (7 long radiating archangel feathers)
      const primaryCount = isTier3 ? 7 : 6;
      for (let i = 0; i < primaryCount; i++) {
        const t = i / (primaryCount - 1);
        const featherLen = span * (1.04 - t * 0.34);
        const angleUp = -28 - flap * (0.95 - t * 0.45) + t * 34;
        const rootY = -2 + t * 8;

        const featherGrad = ctx.createLinearGradient(5, rootY, featherLen, angleUp);
        featherGrad.addColorStop(0, '#ffffff');
        featherGrad.addColorStop(0.45, '#7dd3fc');
        featherGrad.addColorStop(0.82, isTier3 ? '#6366f1' : '#0284c7');
        featherGrad.addColorStop(1, isTier3 ? '#fde047' : '#e0f2fe');

        ctx.fillStyle = featherGrad;
        ctx.strokeStyle = isTier3 ? '#fef08a' : '#bae6fd';
        ctx.lineWidth = 1.25;

        ctx.beginPath();
        ctx.moveTo(5, rootY);
        ctx.quadraticCurveTo(
          featherLen * 0.52,
          angleUp - 9,
          featherLen,
          angleUp
        );
        ctx.quadraticCurveTo(
          featherLen * 0.58,
          angleUp + 7,
          5,
          rootY + 4.2
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Golden feather rachis (central quill shaft)
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.65)';
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(7, rootY + 1.8);
        ctx.quadraticCurveTo(featherLen * 0.52, angleUp - 1.5, featherLen * 0.92, angleUp);
        ctx.stroke();
      }

      // Layer 2: Secondary Mid-Coverts (4 lush overlapping inner plumes)
      for (let c = 0; c < 4; c++) {
        const ct = c / 3;
        const covLen = span * (0.62 - ct * 0.16);
        const covY = -18 - flap * 0.55 + ct * 19;
        ctx.fillStyle = c === 0 ? '#fef9c3' : '#e0f2fe';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(4, -2 + ct * 5);
        ctx.quadraticCurveTo(covLen * 0.5, covY - 6, covLen, covY);
        ctx.quadraticCurveTo(covLen * 0.52, covY + 5, 4, 2 + ct * 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Golden Archangel Shoulder Hinge & Sapphire Cabochon
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(3, -6);
      ctx.quadraticCurveTo(14, -18 - flap * 0.5, 22, -14 - flap * 0.4);
      ctx.quadraticCurveTo(12, -5, 4, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isTier3 ? '#c084fc' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(8, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  } else {
    // =========================================================================
    // FAIRY ELF: WINGS OF ELF II / WINGS OF ILLUSION III
    // Iridescent Gossamer Butterfly/Sylphid Wings with stained-glass golden venation & swallowtails
    // =========================================================================
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.scale(side, 1);

      // Tier 3 Outer Prismatic Crown Petal
      if (isTier3) {
        const crownGrad = ctx.createLinearGradient(4, -6, span * 0.95, -36 - flap);
        crownGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
        crownGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.78)');
        crownGrad.addColorStop(1, 'rgba(244, 114, 182, 0.72)');
        ctx.fillStyle = crownGrad;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(4, -3);
        ctx.bezierCurveTo(14, -42 - flap * 1.15, span * 0.78, -44 - flap, span * 0.96, -24 - flap * 0.75);
        ctx.quadraticCurveTo(span * 0.58, -12, 4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Upper Forewing Lobe (Monarch / Sylphid arch)
      const upperGrad = ctx.createRadialGradient(12, -10, 2, 26, -14, span);
      upperGrad.addColorStop(0, 'rgba(254, 249, 195, 0.96)');
      upperGrad.addColorStop(0.42, 'rgba(52, 211, 153, 0.88)');
      upperGrad.addColorStop(0.78, isTier3 ? 'rgba(45, 212, 191, 0.82)' : 'rgba(16, 185, 129, 0.75)');
      upperGrad.addColorStop(1, isTier3 ? 'rgba(253, 224, 71, 0.9)' : 'rgba(5, 150, 105, 0.6)');

      ctx.fillStyle = upperGrad;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.7;

      ctx.beginPath();
      ctx.moveTo(4, 1);
      ctx.bezierCurveTo(
        16,
        -38 - flap * 1.05,
        span * 1.05,
        -34 - flap * 0.9,
        span,
        -8 - flap * 0.45
      );
      ctx.bezierCurveTo(span * 0.92, 3 - flap * 0.2, 26, 4, 4, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lower Hindwing Lobe with Graceful Swallowtail Streamer
      const lowerGrad = ctx.createLinearGradient(4, 2, span * 0.72, 26);
      lowerGrad.addColorStop(0, 'rgba(254, 240, 138, 0.92)');
      lowerGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.82)');
      lowerGrad.addColorStop(1, isTier3 ? 'rgba(56, 189, 248, 0.85)' : 'rgba(4, 120, 87, 0.65)');

      ctx.fillStyle = lowerGrad;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(4, 3);
      ctx.bezierCurveTo(
        26,
        3,
        span * 0.78,
        10 - secondaryFlap * 0.3,
        span * 0.64,
        21 - secondaryFlap * 0.35
      );
      // Swallowtail ribbon tip
      ctx.lineTo(span * 0.56, 30 - secondaryFlap * 0.45);
      ctx.quadraticCurveTo(span * 0.44, 22 - secondaryFlap * 0.3, 18, 20);
      ctx.quadraticCurveTo(8, 13, 4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Stained-Glass Golden Cell Venation inside Upper & Lower Wings
      ctx.strokeStyle = 'rgba(254, 249, 195, 0.75)';
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.moveTo(6, 1);
      ctx.quadraticCurveTo(24, -18 - flap * 0.6, span * 0.88, -16 - flap * 0.65);
      ctx.moveTo(18, -11 - flap * 0.45);
      ctx.quadraticCurveTo(32, -22 - flap * 0.7, span * 0.74, -25 - flap * 0.8);
      ctx.moveTo(22, -10 - flap * 0.4);
      ctx.quadraticCurveTo(34, -4 - flap * 0.25, span * 0.82, -3 - flap * 0.25);
      ctx.moveTo(6, 4);
      ctx.quadraticCurveTo(22, 11, span * 0.54, 19 - secondaryFlap * 0.3);
      ctx.stroke();

      // Luminous Pearl Eye-Spots near Wing Margins
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.arc(span * 0.78, -15 - flap * 0.6, 2.4, 0, Math.PI * 2);
      ctx.arc(span * 0.72, -6 - flap * 0.35, 1.8, 0, Math.PI * 2);
      ctx.arc(span * 0.48, 16 - secondaryFlap * 0.25, 2.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  // Upgrade-Level Orbiting Wing Sparkles / Lightning Motes (+5 to +15)
  if (wingLevel >= 3 || isTier3) {
    const moteCount = Math.min(6, 2 + Math.floor(wingLevel / 3) + (isTier3 ? 2 : 0));
    for (let m = 0; m < moteCount; m++) {
      const phase = now * 0.0045 + m * ((Math.PI * 2) / moteCount);
      const mx = Math.cos(phase) * (effectiveSpan * 0.72);
      const my = -10 + Math.sin(phase * 1.4) * 15;
      ctx.fillStyle = m % 2 === 0 ? '#fef08a' : '#ffffff';
      ctx.beginPath();
      ctx.arc(mx, my, isTier3 ? 2.3 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Renders a richly detailed 2.5D isometric upright MU Online hero figure (~68px tall)
 * with multi-segment limbs (cuisses, poleyns, greaves, sabatons, vambraces, gauntlets),
 * 5 distinct armor/helm set tiers per class, 16 distinct weapon archetypes, and
 * level-scaled multi-pinion Chaos Wings (+0..+15).
 */
export function drawHeroModel(
  ctx: CanvasRenderingContext2D,
  opts: HeroModelRenderOptions
): void {
  const {
    classId,
    classTier,
    facingAngle,
    walkDistance,
    isMoving: explicitIsMoving,
    attackPhase,
    hitFlash,
    weapon,
    armor,
    helm,
    wings,
    activeSetPieceCount,
    now,
    scale = 1,
  } = opts;

  ctx.save();
  ctx.scale(scale, scale);

  const isMoving = explicitIsMoving !== undefined ? explicitIsMoving : walkDistance > 0;
  const kinematics = getHeroFlightKinematics({
    hasWings: wings !== null,
    isMoving,
    walkDistance,
    now,
    facingAngle,
  });
  const {
    isFlying,
    stride,
    bodyBob,
    glideTiltRad,
    wingFlap,
    shadowScale,
    shadowAlpha,
    legTrailAngle,
    legFloatSway,
  } = kinematics;
  const facingRight = Math.cos(facingAngle) >= -0.15;
  const dirX = facingRight ? 1 : -1;

  const hasArmor = armor !== null;
  const hasHelm = helm !== null;
  const hasWeapon = weapon !== null;
  const weaponLvl = weapon?.level ?? 0;
  const armorLvl = armor?.level ?? 0;
  const helmLvl = helm?.level ?? 0;
  const maxEquipLevel = Math.max(weaponLvl, armorLvl, helmLvl, wings?.level ?? 0);
  const isExcelGlow = maxEquipLevel >= 3 || activeSetPieceCount >= 2;

  const setStyle = resolveArmorSetVisualStyle(classId, armor, helm);
  const weaponStyle = resolveWeaponVisualStyle(classId, weapon);
  const hasWingsExcellentGlow = wings?.rarity === 'excellent';
  const hasWingsAncientGlow = wings?.rarity === 'ancient';
  const hasAnyExcellentEquip =
    setStyle.hasArmorExcellentGlow ||
    setStyle.hasHelmExcellentGlow ||
    weaponStyle.hasExcellentGreenGlow ||
    hasWingsExcellentGlow;
  const hasAnyAncientEquip =
    setStyle.hasArmorAncientGlow ||
    setStyle.hasHelmAncientGlow ||
    weaponStyle.hasAncientPurpleGlow ||
    hasWingsAncientGlow;
  const exePulse = 0.72 + Math.sin(now * 0.006) * 0.28;

  // ===========================================================================
  // 1. ISOMETRIC GROUND SHADOW, FLIGHT UPDRAFT RING & SACRED SET/UPGRADE SEAL
  // ===========================================================================
  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha.toFixed(2)})`;
  ctx.beginPath();
  ctx.ellipse(0, 14, 22 * shadowScale, 10 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft Emerald-Green Excellent (Exe) or Purple Ancient Luminescence Halo under & around Hero
  if (hasAnyExcellentEquip || hasAnyAncientEquip) {
    ctx.save();
    const isPurpleAura = hasAnyAncientEquip && !hasAnyExcellentEquip;
    const exeBodyGrad = ctx.createRadialGradient(0, -14 + bodyBob, 4, 0, -14 + bodyBob, 34);
    if (isPurpleAura) {
      exeBodyGrad.addColorStop(0, `rgba(192, 132, 252, ${(0.24 * exePulse).toFixed(2)})`);
      exeBodyGrad.addColorStop(0.55, `rgba(168, 85, 247, ${(0.13 * exePulse).toFixed(2)})`);
      exeBodyGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
    } else {
      exeBodyGrad.addColorStop(0, `rgba(52, 211, 153, ${(0.22 * exePulse).toFixed(2)})`);
      exeBodyGrad.addColorStop(0.55, `rgba(16, 185, 129, ${(0.12 * exePulse).toFixed(2)})`);
      exeBodyGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    }
    ctx.fillStyle = exeBodyGrad;
    ctx.beginPath();
    ctx.arc(0, -14 + bodyBob, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isPurpleAura
      ? `rgba(192, 132, 252, ${(0.48 + exePulse * 0.22).toFixed(2)})`
      : `rgba(52, 211, 153, ${(0.46 + exePulse * 0.22).toFixed(2)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 14, 25, 11.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (isFlying) {
    const windPulse = 0.88 + Math.sin(now * 0.008) * 0.14;
    const windColor =
      classId === 'dark_knight'
        ? 'rgba(248, 113, 113, 0.38)'
        : classId === 'dark_wizard'
          ? 'rgba(56, 189, 248, 0.44)'
          : 'rgba(52, 211, 153, 0.44)';
    ctx.strokeStyle = windColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 14, 24 * windPulse, 10.5 * windPulse, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isExcelGlow || wings) {
    const auraColor = hasAnyAncientEquip
      ? 'rgba(192, 132, 252, 0.76)'
      : activeSetPieceCount >= 3 || hasAnyExcellentEquip
        ? 'rgba(52, 211, 153, 0.72)'
        : maxEquipLevel >= 6
          ? setStyle.armorUpgradeEffect.hasBrightPrimaryGlow
            ? setStyle.armorUpgradeEffect.primaryGlowColor
            : weaponStyle.upgradeEffect.primaryGlowColor
          : 'rgba(251, 191, 36, 0.58)';
    ctx.strokeStyle = auraColor;
    ctx.lineWidth = maxEquipLevel >= 9 ? 2.3 : 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 14, 28, 13, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner rotating runic diamond / hexagram
    const runeA = now * 0.003;
    ctx.strokeStyle = hasAnyAncientEquip
      ? 'rgba(216, 180, 254, 0.62)'
      : activeSetPieceCount >= 3 || hasAnyExcellentEquip
        ? 'rgba(110, 231, 183, 0.58)'
        : 'rgba(253, 224, 71, 0.5)';
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    const pts = activeSetPieceCount >= 3 ? 6 : 4;
    for (let i = 0; i < pts; i++) {
      const a = runeA + (i * Math.PI * 2) / pts;
      const rx = Math.cos(a) * 23;
      const ry = 14 + Math.sin(a) * 10;
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.stroke();

    // Orbiting +7/+9/+13/+15 star motes
    const starCount = maxEquipLevel >= 11 ? 3 : maxEquipLevel >= 7 ? 2 : 1;
    for (let s = 0; s < starCount; s++) {
      const sa = runeA * 1.6 + (s * Math.PI * 2) / starCount;
      ctx.fillStyle = hasAnyAncientEquip
        ? s % 2 === 0
          ? '#d8b4fe'
          : '#c084fc'
        : hasAnyExcellentEquip
          ? s % 2 === 0
            ? '#6ee7b7'
            : '#fef08a'
          : s % 2 === 0
            ? '#fef08a'
            : setStyle.gemColor;
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * 26, 14 + Math.sin(sa) * 11, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ===========================================================================
  // 2. BACK LAYER: CAPE, QUIVER & MULTI-LAYERED LEVEL-SCALED CHAOS WINGS
  // ===========================================================================
  ctx.save();
  ctx.translate(0, bodyBob);
  if (glideTiltRad !== 0) {
    ctx.rotate(glideTiltRad);
  }

  if (wings) {
    if (hasWingsExcellentGlow || hasWingsAncientGlow) {
      ctx.save();
      ctx.shadowColor = hasWingsAncientGlow
        ? 'rgba(192, 132, 252, 0.88)'
        : 'rgba(52, 211, 153, 0.85)';
      ctx.shadowBlur = 9;
      drawDetailedHeroWings(ctx, classId, wings, wingFlap, now);
      ctx.restore();
    } else {
      drawDetailedHeroWings(ctx, classId, wings, wingFlap, now);
    }
  } else if (hasArmor) {
    // Tiered Royal Battle Cape with inner lining & golden hem border
    const capeSway = Math.sin(now * 0.005 + walkDistance * 0.05) * 3.5;
    const capeLen = setStyle.tier >= 4 ? 10 : 7;
    const capeGrad = ctx.createLinearGradient(0, -23, capeSway, capeLen);
    capeGrad.addColorStop(0, setStyle.capeColor);
    capeGrad.addColorStop(1, setStyle.capeInnerColor);

    ctx.fillStyle = capeGrad;
    ctx.strokeStyle = setStyle.trimColor;
    ctx.lineWidth = setStyle.tier >= 3 ? 1.7 : 1.2;
    ctx.beginPath();
    ctx.moveTo(-9.5, -22);
    ctx.lineTo(9.5, -22);
    ctx.quadraticCurveTo(14 + capeSway * 0.7, -6, 14.5 + capeSway, capeLen);
    ctx.lineTo(0 + capeSway * 1.1, capeLen + (setStyle.tier >= 4 ? 3 : 1));
    ctx.lineTo(-14.5 + capeSway, capeLen);
    ctx.quadraticCurveTo(-14 + capeSway * 0.7, -6, -9.5, -22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Fairy Elf Back Quiver with Golden-Fletched Arrows when a Bow/Crossbow is equipped
  if (classId === 'fairy_elf' && hasWeapon) {
    ctx.save();
    ctx.translate(-dirX * 8, -22);
    ctx.rotate(-dirX * 0.28);
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = setStyle.trimColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-2.8, -6, 5.6, 15, 2);
    ctx.fill();
    ctx.stroke();
    // Fletched arrow tips peeking out of quiver
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.3;
    for (let a = -1.5; a <= 1.5; a += 1.5) {
      ctx.beginPath();
      ctx.moveTo(a, -6);
      ctx.lineTo(a * 1.3, -12);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();

  // ===========================================================================
  // 3. MULTI-SEGMENT LEGS: THIGH CUISSES, KNEE POLEYNS, GREAVES & SABATONS
  // ===========================================================================
  const trimColor = hasArmor ? setStyle.trimColor : classTier >= 2 ? '#fde047' : '#85582a';
  const skinBase = hitFlash ? '#ffffff' : '#eab676';
  const skinShade = hitFlash ? '#ffffff' : '#c68b59';

  const drawSingleArticulatedLeg = (
    offsetX: number,
    offsetY: number,
    rotRad: number
  ) => {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    if (rotRad !== 0) ctx.rotate(rotRad);

    // Upper Thigh / Cuisse
    ctx.fillStyle = hasArmor ? setStyle.secondaryColor : skinShade;
    ctx.strokeStyle = hasArmor ? trimColor : '#85582a';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(-3.4, -1, 6.8, 6.8, 2.2);
    ctx.fill();
    ctx.stroke();

    // Lower Greave / Shin Guard
    ctx.fillStyle = hasArmor ? setStyle.primaryColor : skinBase;
    ctx.beginPath();
    ctx.roundRect(-3.1, 4.5, 6.2, 6.8, 2);
    ctx.fill();
    ctx.stroke();

    // Sculpted Knee Poleyn (Armored Knee Cap)
    if (hasArmor) {
      ctx.fillStyle = setStyle.tier >= 3 ? setStyle.trimColor : setStyle.accentColor;
      ctx.beginPath();
      ctx.moveTo(-2.8, 4.2);
      ctx.lineTo(0, 2.4);
      ctx.lineTo(2.8, 4.2);
      ctx.lineTo(0, 6.2);
      ctx.closePath();
      ctx.fill();
    }

    // Sabaton / Armored Boot Foot
    ctx.fillStyle = hasArmor ? setStyle.secondaryColor : '#44372b';
    ctx.strokeStyle = hasArmor ? trimColor : '#292524';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(-3.4, 9.8, 7.2, 3.8, 1.8);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  ctx.save();
  if (isFlying) {
    ctx.translate(0, bodyBob);
    ctx.rotate(glideTiltRad);
    drawSingleArticulatedLeg(-5.5, 1.5, legTrailAngle + 0.08);
    drawSingleArticulatedLeg(5.5, 0.8 + legFloatSway * 0.35, legTrailAngle * 0.65 - 0.05);
  } else {
    const leftLegY = stride * 4.5;
    const rightLegY = -stride * 4.5;
    drawSingleArticulatedLeg(-5.8, -2 + leftLegY * 0.5, stride * 0.08);
    drawSingleArticulatedLeg(5.8, -2 + rightLegY * 0.5, -stride * 0.08);
  }
  ctx.restore();

  // ===========================================================================
  // 4. TORSO CUIRASS / ARCHMAGE ROBES / VALKYRIE PLATE, WAIST FAULDS & ARMS
  // ===========================================================================
  ctx.save();
  ctx.translate(0, bodyBob);
  if (glideTiltRad !== 0) {
    ctx.rotate(glideTiltRad);
  }

  // Luminescence on Equipped Armor: Excellent (Emerald), Ancient (Purple), or +6..+15 Bright Primary Color Glow
  if (hasArmor) {
    if (setStyle.hasArmorAncientGlow) {
      ctx.shadowColor = 'rgba(192, 132, 252, 0.88)';
      ctx.shadowBlur = 9;
    } else if (setStyle.hasArmorExcellentGlow) {
      ctx.shadowColor = 'rgba(52, 211, 153, 0.85)';
      ctx.shadowBlur = 9;
    } else if (setStyle.armorUpgradeEffect.hasBrightPrimaryGlow) {
      ctx.shadowColor = setStyle.armorUpgradeEffect.primaryGlowColor;
      ctx.shadowBlur = 6 + setStyle.armorUpgradeEffect.primaryGlowIntensity * 5;
    }
  }

  const primaryArmor = hitFlash ? '#ffffff' : hasArmor ? setStyle.primaryColor : skinBase;
  const secondaryArmor = hitFlash ? '#ffffff' : hasArmor ? setStyle.secondaryColor : skinShade;

  const torsoGrad = ctx.createLinearGradient(-12, -26, 12, 2);
  torsoGrad.addColorStop(0, primaryArmor);
  torsoGrad.addColorStop(0.55, hasArmor ? setStyle.primaryColor : skinBase);
  torsoGrad.addColorStop(1, secondaryArmor);

  const armorOutlineHighlight = setStyle.hasArmorAncientGlow
    ? '#d8b4fe'
    : setStyle.hasArmorExcellentGlow
      ? '#6ee7b7'
      : trimColor;

  ctx.fillStyle = torsoGrad;
  ctx.strokeStyle = hasArmor ? armorOutlineHighlight : '#85582a';
  ctx.lineWidth = hasArmor ? 1.9 : 1.4;

  if (hasArmor && classId === 'dark_wizard') {
    // Soul Master / Archmage Flowing Robe with Segmented Battle Skirt & Arcane Stoles
    ctx.beginPath();
    ctx.moveTo(-11.5, -25);
    ctx.lineTo(11.5, -25);
    ctx.lineTo(10, -7);
    ctx.lineTo(13.8, 5.5);
    ctx.lineTo(-13.8, 5.5);
    ctx.lineTo(-10, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Side pleated robe hem lines
    ctx.strokeStyle = setStyle.accentColor;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-7, -6);
    ctx.lineTo(-9.5, 5);
    ctx.moveTo(7, -6);
    ctx.lineTo(9.5, 5);
    ctx.stroke();

    // Central embroidered runic tabard & chest soul-crystal
    ctx.fillStyle = setStyle.secondaryColor;
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-3.6, -23);
    ctx.lineTo(3.6, -23);
    ctx.lineTo(4.4, 5);
    ctx.lineTo(0, 7.2);
    ctx.lineTo(-4.4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Per-Set Distinct Chest Emblem for Dark Wizard Robes
    ctx.strokeStyle = setStyle.accentColor;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    if (setStyle.chestMotif === 'dw_anubis_hieroglyph') {
      // Golden Ankh / Pyramid chevron
      ctx.moveTo(-6, -18);
      ctx.lineTo(0, -22);
      ctx.lineTo(6, -18);
      ctx.moveTo(0, -18);
      ctx.lineTo(0, -8);
    } else if (setStyle.chestMotif === 'dw_acheron_pentagram') {
      // Pentagram star ring
      ctx.arc(0, -15, 4.6, 0, Math.PI * 2);
    } else if (
      setStyle.chestMotif === 'dw_tower_eclipse_sun' ||
      setStyle.chestMotif === 'dw_tarkan_storm_sigil'
    ) {
      // Solar eclipse rays
      ctx.moveTo(-7, -15);
      ctx.lineTo(7, -15);
      ctx.moveTo(0, -21);
      ctx.lineTo(0, -9);
    } else if (setStyle.chestMotif === 'dw_kanturu_relic_matrix') {
      // Cybernetic Kanturu hex circuit lines
      ctx.moveTo(-6, -19);
      ctx.lineTo(-3, -13);
      ctx.lineTo(3, -13);
      ctx.lineTo(6, -19);
    }
    ctx.stroke();

    // Glowing Soul Core Gem on Sternum
    if (setStyle.hasGlowingCore) {
      ctx.fillStyle = setStyle.gemColor;
      ctx.beginPath();
      ctx.moveTo(0, -20.5);
      ctx.lineTo(3.2, -16.5);
      ctx.lineTo(0, -12.5);
      ctx.lineTo(-3.2, -16.5);
      ctx.closePath();
      ctx.fill();
    }

    // Tier 3-5 High Levitating Archmage Collar behind head
    if (setStyle.tier >= 3) {
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -28, 12.5, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    }
  } else {
    // Sculpted Plate Cuirass (Dark Knight / Fairy Elf) or Anatomical Bare Torso
    ctx.beginPath();
    ctx.moveTo(-12, -25.5);
    ctx.lineTo(12, -25.5);
    ctx.lineTo(10.5, -11);
    ctx.lineTo(8.8, -2);
    ctx.lineTo(-8.8, -2);
    ctx.lineTo(-10.5, -11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (hasArmor) {
      // Set-Tiered Hip Tassets / Plated Faulds
      ctx.fillStyle = setStyle.secondaryColor;
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 1.4;
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.moveTo(side * 3.5, -2.5);
        ctx.lineTo(side * 10.5, -2.5);
        ctx.lineTo(side * 11.8, 3.8);
        ctx.lineTo(side * 4.2, 4.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      // Distinct Per-Set Chestplate Motif Lines (so every named armor has a distinct chest pattern)
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 1.55;
      ctx.beginPath();
      switch (setStyle.chestMotif) {
        case 'leather_wraps':
        case 'elf_lorencia_tunic': {
          // Crossed leather bandolier straps
          ctx.moveTo(-8.5, -23);
          ctx.lineTo(7.5, -6);
          ctx.moveTo(8.5, -23);
          ctx.lineTo(-7.5, -6);
          break;
        }
        case 'elbeland_Templar_cross':
        case 'elf_crywolf_altar': {
          // Knight Templar / Crywolf vertical & horizontal cross crest
          ctx.moveTo(0, -24);
          ctx.lineTo(0, -5);
          ctx.moveTo(-7.5, -15.5);
          ctx.lineTo(7.5, -15.5);
          break;
        }
        case 'devias_frost_facets':
        case 'ferea_eternal_ice':
        case 'elf_devias_snow_silk':
        case 'elf_nixie_crystal': {
          // Crystalline diamond frost facets
          ctx.moveTo(0, -23.5);
          ctx.lineTo(6.5, -15);
          ctx.lineTo(0, -6.5);
          ctx.lineTo(-6.5, -15);
          ctx.closePath();
          break;
        }
        case 'atlans_sea_scales':
        case 'elf_atlans_siren_shell': {
          // Overlapping sea scale arches
          ctx.arc(-3.5, -18, 3.5, 0, Math.PI);
          ctx.arc(3.5, -18, 3.5, 0, Math.PI);
          ctx.moveTo(-3.5, -12);
          ctx.arc(0, -12, 4, 0, Math.PI);
          break;
        }
        case 'kanturu_emp_circuit': {
          // Hexagonal Kanturu energy core conduits
          ctx.moveTo(-8, -21);
          ctx.lineTo(-3, -15);
          ctx.lineTo(-3, -7);
          ctx.moveTo(8, -21);
          ctx.lineTo(3, -15);
          ctx.lineTo(3, -7);
          break;
        }
        default: {
          // Layered Dragon / Phoenix / Valkyrie Rib-Plates & Sternum Crest
          ctx.moveTo(-8, -20);
          ctx.lineTo(0, -14.5);
          ctx.lineTo(8, -20);
          if (setStyle.tier >= 2) {
            ctx.moveTo(-7, -14);
            ctx.lineTo(0, -9.5);
            ctx.lineTo(7, -14);
          }
          break;
        }
      }
      ctx.stroke();

      // Central Heart / Dragon Core Jewel on Chestplate
      if (setStyle.hasGlowingCore) {
        ctx.fillStyle = setStyle.gemColor;
        ctx.beginPath();
        ctx.moveTo(0, -21.5);
        ctx.lineTo(3.2, -17.5);
        ctx.lineTo(0, -13.5);
        ctx.lineTo(-3.2, -17.5);
        ctx.closePath();
        ctx.fill();
      }

      // Gilded Champion Waist Belt & Buckle
      ctx.fillStyle = setStyle.secondaryColor;
      ctx.fillRect(-9, -4.5, 18, 3.2);
      ctx.fillStyle = trimColor;
      ctx.beginPath();
      ctx.arc(0, -2.8, 3.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Detailed Anatomical Bare Torso (Pectorals, Abs & Leather Battle-Kilt)
      ctx.fillStyle = '#44372b';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-9.2, -6.5, 18.4, 5.8, 1.5);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(133, 88, 42, 0.72)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      // Pectorals
      ctx.moveTo(-7.5, -17);
      ctx.quadraticCurveTo(-3.5, -14.5, 0, -16);
      ctx.quadraticCurveTo(3.5, -14.5, 7.5, -17);
      // Linea alba & abdominal definition
      ctx.moveTo(0, -16);
      ctx.lineTo(0, -7);
      ctx.moveTo(-4, -12.5);
      ctx.lineTo(4, -12.5);
      ctx.moveTo(-3.5, -9.5);
      ctx.lineTo(3.5, -9.5);
      ctx.stroke();
    }
  }

  // Articulated Upper Arms, Vambraces & Gauntlets
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(side * 11.5, -18);
    ctx.rotate(side * 0.14);
    // Upper arm
    ctx.fillStyle = hasArmor ? setStyle.secondaryColor : skinBase;
    ctx.strokeStyle = hasArmor ? trimColor : '#85582a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-2.6, 0, 5.2, 8.5, 2);
    ctx.fill();
    ctx.stroke();
    // Forearm Vambrace / Bracer
    ctx.fillStyle = hasArmor ? setStyle.primaryColor : '#57412d';
    ctx.strokeStyle = hasArmor ? trimColor : '#78350f';
    ctx.beginPath();
    ctx.roundRect(-2.4, 6.2, 4.8, 5.8, 1.8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  // ===========================================================================
  // 5. LAYERED PAULDRONS (Tier 1..5 Shoulder Guards with Spikes, Wings & Gems)
  // ===========================================================================
  if (hasArmor) {
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.translate(side * 13.5, -21.5);

      // Base Pauldron Plate
      ctx.fillStyle = setStyle.primaryColor;
      ctx.strokeStyle = armorOutlineHighlight;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6.8, 5.2, side * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Tier 3+ Upper Layered Shoulder Plate
      if (setStyle.tier >= 3) {
        ctx.fillStyle = setStyle.secondaryColor;
        ctx.beginPath();
        ctx.ellipse(side * 1.2, -2.2, 5.2, 3.6, side * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Tier 4-5 Winged / Crowned Pauldron Fin
      if (setStyle.hasWingedPauldrons) {
        ctx.fillStyle = trimColor;
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.quadraticCurveTo(side * 8, -12, side * 11, -7);
        ctx.quadraticCurveTo(side * 7, -1, side * 2, 1);
        ctx.closePath();
        ctx.fill();
      } else if (setStyle.hasShoulderSpikes) {
        ctx.fillStyle = trimColor;
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(side * 6.5, -9.5);
        ctx.lineTo(side * 2.5, 0);
        ctx.closePath();
        ctx.fill();
      }

      // Shoulder Socket Gem
      ctx.fillStyle = setStyle.gemColor;
      ctx.beginPath();
      ctx.arc(0, -0.8, setStyle.tier >= 4 ? 2.4 : 1.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // Subtle Pearlescent White Sheen (+10 to +15) on Equipped Armor & Pauldrons
    if (setStyle.armorUpgradeEffect.hasSubtleWhiteSheen) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${setStyle.armorUpgradeEffect.whiteSheenAlpha})`;
      ctx.beginPath();
      ctx.ellipse(0, -16, 10.5, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Reset armor shadowBlur before drawing head/helm
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;

  // ===========================================================================
  // 6. HEAD, FACE & DISTINCT NAMED HELMET / CROWN / TIARA
  // ===========================================================================
  ctx.save();
  ctx.translate(0, -34.5);

  if (hasHelm) {
    if (setStyle.hasHelmAncientGlow) {
      ctx.shadowColor = 'rgba(192, 132, 252, 0.88)';
      ctx.shadowBlur = 8;
    } else if (setStyle.hasHelmExcellentGlow) {
      ctx.shadowColor = 'rgba(52, 211, 153, 0.85)';
      ctx.shadowBlur = 8;
    } else if (setStyle.helmUpgradeEffect.hasBrightPrimaryGlow) {
      ctx.shadowColor = setStyle.helmUpgradeEffect.primaryGlowColor;
      ctx.shadowBlur = 5 + setStyle.helmUpgradeEffect.primaryGlowIntensity * 4.5;
    }
  }

  const helmPrimary = hitFlash ? '#ffffff' : setStyle.helmPrimaryColor;
  const helmSecondary = hitFlash ? '#ffffff' : setStyle.helmSecondaryColor;
  const helmTrim = setStyle.hasHelmAncientGlow
    ? '#d8b4fe'
    : setStyle.hasHelmExcellentGlow
      ? '#6ee7b7'
      : setStyle.helmTrimColor;
  const helmGem = setStyle.helmGemColor;

  if (!hasHelm) {
    // Unhelmeted Hero Face, Jawline, Brow & Class Hairstyle
    if (classId === 'fairy_elf') {
      // Back Hair & Pointed Elven Ears
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(-dirX * 3.5, 3.5, 9.5, 11.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fde68a';
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-14.5, -3.2);
      ctx.lineTo(-8, 3.2);
      ctx.moveTo(8, 0);
      ctx.lineTo(14.5, -3.2);
      ctx.lineTo(8, 3.2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = hitFlash ? '#ffffff' : '#fde68a';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 8.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing Class Eyes + Pupils
    ctx.fillStyle =
      classId === 'dark_wizard' ? '#38bdf8' : classId === 'fairy_elf' ? '#10b981' : '#991b1b';
    ctx.fillRect(-4.2 + dirX, -1.2, 2.5, 2.4);
    ctx.fillRect(1.5 + dirX, -1.2, 2.5, 2.4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3.6 + dirX, -1.0, 1.0, 1.0);
    ctx.fillRect(2.1 + dirX, -1.0, 1.0, 1.0);

    // Sculpted Class Hair
    ctx.fillStyle =
      classId === 'dark_knight'
        ? '#1c1917'
        : classId === 'dark_wizard'
          ? '#e2e8f0'
          : '#facc15';
    ctx.beginPath();
    ctx.arc(0, -2.8, 9.0, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineTo(7, -1);
    ctx.lineTo(4, -5);
    ctx.lineTo(0, -2);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-7, -1);
    ctx.closePath();
    ctx.fill();
  } else if (classId === 'dark_knight') {
    // Distinct Dark Knight War-Helm per helmMotif (13 unique named helmets)
    const helmGrad = ctx.createLinearGradient(-9, -10, 9, 9);
    helmGrad.addColorStop(0, helmPrimary);
    helmGrad.addColorStop(1, helmSecondary);

    ctx.fillStyle = helmGrad;
    ctx.strokeStyle = helmTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    switch (setStyle.helmMotif) {
      case 'cap': {
        // Simple riveted leather band
        ctx.strokeStyle = helmTrim;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-9, -3);
        ctx.lineTo(9, -3);
        ctx.stroke();
        break;
      }
      case 'noria_warden_crest': {
        // Emerald forest warden leaf-horns
        ctx.fillStyle = '#84cc16';
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-13, -13);
        ctx.lineTo(-5, -8);
        ctx.moveTo(8, -4);
        ctx.lineTo(13, -13);
        ctx.lineTo(5, -8);
        ctx.fill();
        break;
      }
      case 'elbeland_crown': {
        // 3-spired Royal Knight Coronet
        ctx.fillStyle = helmTrim;
        ctx.beginPath();
        ctx.moveTo(-7, -7);
        ctx.lineTo(-5, -15);
        ctx.lineTo(-2, -9);
        ctx.lineTo(0, -17);
        ctx.lineTo(2, -9);
        ctx.lineTo(5, -15);
        ctx.lineTo(7, -7);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'devias_ice_visor':
      case 'ferea_ice_crown': {
        // Crystalline Frost Spires
        ctx.fillStyle = '#7dd3fc';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-7, -6);
        ctx.lineTo(-11, -18);
        ctx.lineTo(-3, -9);
        ctx.lineTo(0, -21);
        ctx.lineTo(3, -9);
        ctx.lineTo(11, -18);
        ctx.lineTo(7, -6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'atlans_fin_helm': {
        // Sea-lord flared gill fins
        ctx.fillStyle = '#2dd4bf';
        ctx.strokeStyle = helmTrim;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-8, -2);
        ctx.lineTo(-17, -11);
        ctx.lineTo(-14, -2);
        ctx.lineTo(-8, 3);
        ctx.moveTo(8, -2);
        ctx.lineTo(17, -11);
        ctx.lineTo(14, -2);
        ctx.lineTo(8, 3);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'balrog_bull_horns': {
        // Heavy curved outward Minotaur/Balrog demon horns
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-8, -2);
        ctx.quadraticCurveTo(-20, -2, -17, -16);
        ctx.moveTo(8, -2);
        ctx.quadraticCurveTo(20, -2, 17, -16);
        ctx.stroke();
        break;
      }
      case 'phoenix_flame_crest':
      case 'icarus_sky_crown':
      case 'great_titan_halo':
      default: {
        // Sweeping Dragon Horns + Central Phoenix/Titan Crest on higher sets
        ctx.strokeStyle = setStyle.tier >= 4 ? '#fef08a' : '#fde047';
        ctx.lineWidth = setStyle.tier >= 4 ? 3.1 : 2.5;
        ctx.beginPath();
        ctx.moveTo(-7, -4);
        ctx.quadraticCurveTo(-17, -10, -15, -18.5);
        ctx.moveTo(7, -4);
        ctx.quadraticCurveTo(17, -10, 15, -18.5);
        ctx.stroke();

        if (
          setStyle.helmMotif === 'phoenix_flame_crest' ||
          setStyle.helmMotif === 'icarus_sky_crown' ||
          setStyle.helmMotif === 'great_titan_halo' ||
          setStyle.tier >= 4
        ) {
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.moveTo(-4, -8);
          ctx.lineTo(0, -19);
          ctx.lineTo(4, -8);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
    }

    // Armored Faceplate & Glowing Visor Slit
    ctx.fillStyle = '#09080c';
    ctx.fillRect(-6.2, -2.2, 12.4, 4.6);
    ctx.fillStyle = helmGem;
    ctx.fillRect(-4.6 + dirX, -1.1, 3.2, 2.2);
    ctx.fillRect(1.4 + dirX, -1.1, 3.2, 2.2);

    // Forehead Gem
    ctx.fillStyle = helmGem;
    ctx.beginPath();
    ctx.arc(0, -5.5, 2.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (classId === 'dark_wizard') {
    // Distinct Dark Wizard Headgear per helmMotif (13 unique named crowns/hoods/diadems)
    ctx.fillStyle = helmPrimary;
    ctx.strokeStyle = helmTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shadowed Mystery Visage under Archmage Hood + Glowing Arcane Eyes
    ctx.fillStyle = '#09080c';
    ctx.beginPath();
    ctx.arc(dirX * 1, 1.2, 6.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = helmGem;
    ctx.fillRect(-4.2 + dirX, -0.6, 2.9, 2.2);
    ctx.fillRect(1.5 + dirX, -0.6, 2.9, 2.2);

    // Distinct Crown / Mitre / Jackal Ears / Crescent Diadem per named helm
    if (setStyle.helmMotif === 'dw_apprentice_band' || setStyle.helmMotif === 'dw_noria_leaf_circlet') {
      // Headband / Circlet with central cabochon
      ctx.strokeStyle = helmTrim;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-9, -4);
      ctx.lineTo(9, -4);
      ctx.stroke();
    } else if (setStyle.helmMotif === 'dw_anubis_jackal_crown') {
      // Twin tall Anubis jackal-ear golden spires
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(-7, -7);
      ctx.lineTo(-8, -19);
      ctx.lineTo(-2, -8);
      ctx.moveTo(7, -7);
      ctx.lineTo(8, -19);
      ctx.lineTo(2, -8);
      ctx.fill();
    } else if (setStyle.helmMotif === 'dw_elbeland_crescent_diadem') {
      // Upward Crescent Moon Diadem
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, -13, 5.2, 0.15 * Math.PI, 0.85 * Math.PI, true);
      ctx.stroke();
    } else {
      // Tall Archmage / Eclipse / Kundun Mitre Crest
      const crestH = setStyle.tier >= 4 ? -21 : setStyle.tier >= 3 ? -18 : -14.5;
      ctx.fillStyle = helmTrim;
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-6.5, -6.8);
      ctx.lineTo(0, crestH);
      ctx.lineTo(6.5, -6.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (setStyle.tier >= 3) {
        // Side Winged Diadem Horns
        ctx.strokeStyle = helmTrim;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, -5);
        ctx.quadraticCurveTo(-14, -12, -11, -17);
        ctx.moveTo(7, -5);
        ctx.quadraticCurveTo(14, -12, 11, -17);
        ctx.stroke();
      }
    }

    ctx.fillStyle = helmGem;
    ctx.beginPath();
    ctx.arc(0, -9.8, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Fairy Elf: Flowing Hair, Pointed Ears & Distinct Named Tiara / Valkyrie Winged Crown
    ctx.fillStyle = setStyle.tier >= 5 ? '#e0f2fe' : '#facc15';
    ctx.beginPath();
    ctx.ellipse(-dirX * 4, 3.2, 9.4, 11.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pointed Elven Ears
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-14.5, -3.2);
    ctx.lineTo(-8, 3.2);
    ctx.moveTo(8, 0);
    ctx.lineTo(14.5, -3.2);
    ctx.lineTo(8, 3.2);
    ctx.fill();

    // Face
    ctx.fillStyle = hitFlash ? '#ffffff' : '#fef3c7';
    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 8.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Emerald / Sapphire Eyes
    ctx.fillStyle = helmGem;
    ctx.fillRect(-4.1 + dirX, -1, 2.5, 2.4);
    ctx.fillRect(1.5 + dirX, -1, 2.5, 2.4);

    // Distinct Elven Tiara / Diadem per helmMotif
    ctx.fillStyle = helmPrimary;
    ctx.strokeStyle = helmTrim;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-8.5, -5);
    ctx.lineTo(0, setStyle.tier >= 4 ? -16.5 : -13);
    ctx.lineTo(8.5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (
      setStyle.helmMotif === 'elf_valkyrie_winged_helm' ||
      setStyle.helmMotif === 'elf_icarus_cloud_crown' ||
      setStyle.helmMotif === 'elf_sylphid_seraph_crown' ||
      setStyle.tier >= 3
    ) {
      // Side Valkyrie Feather Wings on Diadem
      ctx.fillStyle = helmTrim;
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.quadraticCurveTo(-15, -13, -13, -17);
      ctx.quadraticCurveTo(-9, -12, -6, -7);
      ctx.moveTo(8, -6);
      ctx.quadraticCurveTo(15, -13, 13, -17);
      ctx.quadraticCurveTo(9, -12, 6, -7);
      ctx.fill();
    }

    ctx.fillStyle = helmGem;
    ctx.beginPath();
    ctx.arc(0, -8.5, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  if (hasHelm && setStyle.helmUpgradeEffect.hasSubtleWhiteSheen) {
    // Subtle Pearlescent White Sheen (+10 to +15) on Equipped Helmet
    ctx.fillStyle = `rgba(255, 255, 255, ${setStyle.helmUpgradeEffect.whiteSheenAlpha})`;
    ctx.beginPath();
    ctx.arc(-2, -4, 5.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ===========================================================================
  // 7. OFF-HAND SHIELD / ARCANE ORB & ALL 39 DISTINCT NAMED WEAPON SILHOUETTES
  // ===========================================================================
  const swingOffset =
    attackPhase === 'windup'
      ? -0.58
      : attackPhase === 'active'
        ? 0.78
        : 0;

  // Off-hand (left side)
  if (hasArmor && classId === 'dark_knight') {
    // Tiered Dark Knight Shield matching equipped armor set
    ctx.save();
    ctx.translate(-dirX * 14.5, -13.5);
    if (setStyle.hasArmorAncientGlow) {
      ctx.shadowColor = 'rgba(192, 132, 252, 0.88)';
      ctx.shadowBlur = 8;
    } else if (setStyle.hasArmorExcellentGlow) {
      ctx.shadowColor = 'rgba(52, 211, 153, 0.85)';
      ctx.shadowBlur = 8;
    } else if (setStyle.armorUpgradeEffect.hasBrightPrimaryGlow) {
      ctx.shadowColor = setStyle.armorUpgradeEffect.primaryGlowColor;
      ctx.shadowBlur = 6;
    }
    const shieldGrad = ctx.createLinearGradient(-7, -10, 7, 11);
    shieldGrad.addColorStop(0, setStyle.primaryColor);
    shieldGrad.addColorStop(1, setStyle.secondaryColor);
    ctx.fillStyle = shieldGrad;
    ctx.strokeStyle = armorOutlineHighlight;
    ctx.lineWidth = 2;

    if (setStyle.tier === 1) {
      // Round Buckler
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Sculpted Dragon Kite / Tower Shield
      const shW = setStyle.tier >= 4 ? 8.2 : 7;
      const shH = setStyle.tier >= 4 ? 12.5 : 11;
      ctx.beginPath();
      ctx.moveTo(-shW + 1, -9.5);
      ctx.lineTo(shW - 1, -9.5);
      ctx.lineTo(shW, 1.5);
      ctx.lineTo(0, shH);
      ctx.lineTo(-shW, 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Dragon Crest Emblem inside shield
      ctx.fillStyle = setStyle.gemColor;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(3, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-3, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (hasWeapon && classId === 'dark_wizard') {
    // Floating Soul Orb + Rotating Runic Ring on off-hand
    const orbX = -dirX * 16.5;
    const orbY = -16 + Math.sin(now * 0.008) * 3;
    ctx.save();
    ctx.translate(orbX, orbY);
    if (weaponStyle.hasAncientPurpleGlow) {
      ctx.shadowColor = 'rgba(192, 132, 252, 0.9)';
      ctx.shadowBlur = 8;
    } else if (weaponStyle.hasExcellentGreenGlow) {
      ctx.shadowColor = 'rgba(52, 211, 153, 0.9)';
      ctx.shadowBlur = 8;
    } else if (weaponStyle.upgradeEffect.hasBrightPrimaryGlow) {
      ctx.shadowColor = weaponStyle.upgradeEffect.primaryGlowColor;
      ctx.shadowBlur = 7;
    }
    ctx.strokeStyle = weaponStyle.hasAncientPurpleGlow
      ? '#d8b4fe'
      : weaponStyle.hasExcellentGreenGlow
        ? '#6ee7b7'
        : weaponStyle.guardColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 3.2, now * 0.004, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = weaponStyle.gemColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Main-hand Weapon Renderer
  ctx.save();
  ctx.translate(dirX * 12, -16);
  ctx.rotate(facingAngle + swingOffset);
  ctx.scale(weaponStyle.lengthScale, weaponStyle.lengthScale);

  // Soft Emerald-Green Excellent (Exe), Purple Ancient, or +6..+15 Bright Primary Color Luminescence on Equipped Weapon
  if (hasWeapon && (weaponStyle.hasExcellentGreenGlow || weaponStyle.hasAncientPurpleGlow)) {
    const isAncientWeapon = weaponStyle.hasAncientPurpleGlow;
    ctx.shadowColor = isAncientWeapon
      ? 'rgba(192, 132, 252, 0.92)'
      : 'rgba(52, 211, 153, 0.92)';
    ctx.shadowBlur = 10;
    ctx.save();
    ctx.strokeStyle = isAncientWeapon
      ? `rgba(192, 132, 252, ${(0.42 + exePulse * 0.2).toFixed(2)})`
      : `rgba(52, 211, 153, ${(0.38 + exePulse * 0.2).toFixed(2)})`;
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(37, 0);
    ctx.stroke();
    ctx.restore();
  } else if (hasWeapon && weaponStyle.upgradeEffect.hasBrightPrimaryGlow) {
    // +6 to +15: Bright glow in the weapon's own base primary color
    ctx.shadowColor = weaponStyle.upgradeEffect.primaryGlowColor;
    ctx.shadowBlur = 6 + weaponStyle.upgradeEffect.primaryGlowIntensity * 5;
    ctx.save();
    ctx.strokeStyle = weaponStyle.upgradeEffect.primaryGlowColor;
    ctx.globalAlpha = 0.35 + weaponStyle.upgradeEffect.primaryGlowIntensity * 0.25;
    ctx.lineWidth = weaponLvl >= 9 ? 6 : 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(36, 0);
    ctx.stroke();
    ctx.restore();
  } else if (hasWeapon && weaponLvl >= 3) {
    // +3 to +5: Subtle early upgrade aura
    ctx.save();
    ctx.strokeStyle = weaponStyle.auraColor;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(36, 0);
    ctx.stroke();
    ctx.restore();
  }

  switch (weaponStyle.archetype) {
    case 'unarmed': {
      ctx.fillStyle = '#d4a853';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(4, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'dk_short_sword':
    case 'dk_chaos_blade':
    case 'dk_noria_emerald_blade':
    case 'dk_frost_runeblade':
    case 'dk_devias_ice_blade': {
      const arch = weaponStyle.archetype;
      // Grip & Pommel
      ctx.strokeStyle = weaponStyle.shaftColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();

      // Distinct Crossguard per named sword
      ctx.strokeStyle = weaponStyle.guardColor;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      if (arch === 'dk_chaos_blade') {
        // Winged Chaos fangs guard
        ctx.moveTo(4, -8);
        ctx.lineTo(8, 0);
        ctx.lineTo(4, 8);
      } else if (arch === 'dk_noria_emerald_blade') {
        // Curved Elven leaf guard
        ctx.moveTo(8, -7.5);
        ctx.quadraticCurveTo(5, 0, 8, 7.5);
      } else {
        ctx.moveTo(6, -7);
        ctx.lineTo(8, 0);
        ctx.lineTo(6, 7);
      }
      ctx.stroke();

      // Distinct Blade Silhouette per named sword
      const bladeGrad = ctx.createLinearGradient(8, 0, 37, 0);
      bladeGrad.addColorStop(0, weaponStyle.bladePrimary);
      bladeGrad.addColorStop(1, weaponStyle.bladeSecondary);
      ctx.fillStyle = bladeGrad;
      ctx.strokeStyle = weaponStyle.hasExcellentGreenGlow ? '#6ee7b7' : weaponStyle.bladePrimary;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(8, -3.2);
      if (arch === 'dk_chaos_blade') {
        // Saw-toothed Chaos notch
        ctx.lineTo(19, -4.5);
        ctx.lineTo(22, -2.4);
        ctx.lineTo(31, -3.8);
        ctx.lineTo(37, 0);
        ctx.lineTo(29, 3.2);
      } else if (arch === 'dk_noria_emerald_blade') {
        // Leaf-shaped Noria blade swell
        ctx.quadraticCurveTo(23, -5.2, 36, 0);
        ctx.quadraticCurveTo(23, 5.2, 8, 3.2);
      } else if (arch === 'dk_frost_runeblade') {
        // Runic hexagonal flared blade
        ctx.lineTo(26, -4.2);
        ctx.lineTo(36, 0);
        ctx.lineTo(26, 4.2);
      } else if (arch === 'dk_devias_ice_blade') {
        // Jagged Devias ice-crystal serrations on both edges
        ctx.lineTo(17, -4.8);
        ctx.lineTo(20, -2.6);
        ctx.lineTo(29, -4.4);
        ctx.lineTo(38, 0);
        ctx.lineTo(29, 4.4);
        ctx.lineTo(20, 2.6);
        ctx.lineTo(17, 4.8);
      } else {
        // Straight Lorencia gladius short sword
        ctx.lineTo(29, -2.6);
        ctx.lineTo(35, 0);
        ctx.lineTo(29, 2.6);
      }
      ctx.lineTo(8, 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Central Fuller / Rune Line & Hilt Jewel
      ctx.strokeStyle = weaponStyle.gemColor;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(29, 0);
      ctx.stroke();
      ctx.fillStyle = weaponStyle.gemColor;
      ctx.beginPath();
      ctx.arc(7.5, 0, 2.0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'dk_destruction_greatsword':
    case 'dk_tarkan_zaikan_broadblade':
    case 'dk_phoenix_flameblade':
    case 'dk_kalima_abyss_sword':
    case 'dk_loren_royal_greatsword': {
      const arch = weaponStyle.archetype;
      ctx.strokeStyle = weaponStyle.shaftColor;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();

      // Distinct Heavy Crossguard
      ctx.fillStyle = weaponStyle.guardColor;
      ctx.beginPath();
      if (arch === 'dk_phoenix_flameblade') {
        // Swept flame-wing guard
        ctx.moveTo(5, 0);
        ctx.quadraticCurveTo(9, -12, 15, -8);
        ctx.lineTo(10, 0);
        ctx.lineTo(15, 8);
        ctx.quadraticCurveTo(9, 12, 5, 0);
      } else {
        ctx.moveTo(5, -10);
        ctx.lineTo(10, -2);
        ctx.lineTo(10, 2);
        ctx.lineTo(5, 10);
        ctx.lineTo(7, 0);
      }
      ctx.closePath();
      ctx.fill();

      // Distinct Heavy Greatsword Blade per named weapon
      const bGrad = ctx.createLinearGradient(8, -5, 42, 5);
      bGrad.addColorStop(0, weaponStyle.bladePrimary);
      bGrad.addColorStop(0.6, weaponStyle.bladeSecondary);
      bGrad.addColorStop(1, weaponStyle.guardColor);
      ctx.fillStyle = bGrad;
      ctx.strokeStyle = weaponStyle.hasExcellentGreenGlow ? '#6ee7b7' : weaponStyle.guardColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (arch === 'dk_tarkan_zaikan_broadblade') {
        // Massive cleaver-tipped Zaikan desert broadblade
        ctx.moveTo(8, -4.5);
        ctx.lineTo(36, -6.5);
        ctx.lineTo(42, -1.5);
        ctx.lineTo(38, 5.5);
        ctx.lineTo(8, 4.5);
      } else if (arch === 'dk_phoenix_flameblade') {
        // Flamberge wavy fire-tongue blade
        ctx.moveTo(8, -4.2);
        ctx.quadraticCurveTo(16, -6.8, 22, -3.2);
        ctx.quadraticCurveTo(29, -6.8, 35, -3.5);
        ctx.lineTo(43, 0);
        ctx.lineTo(35, 3.5);
        ctx.quadraticCurveTo(29, 6.8, 22, 3.2);
        ctx.quadraticCurveTo(16, 6.8, 8, 4.2);
      } else if (arch === 'dk_kalima_abyss_sword') {
        // Twin-pronged void fork greatsword
        ctx.moveTo(8, -4.8);
        ctx.lineTo(34, -5.2);
        ctx.lineTo(43, -2.4);
        ctx.lineTo(36, 0);
        ctx.lineTo(43, 2.4);
        ctx.lineTo(34, 5.2);
        ctx.lineTo(8, 4.8);
      } else if (arch === 'dk_loren_royal_greatsword') {
        // Broad Royal Loren claymore with diamond tip
        ctx.moveTo(8, -5.2);
        ctx.lineTo(35, -5.2);
        ctx.lineTo(43, 0);
        ctx.lineTo(35, 5.2);
        ctx.lineTo(8, 5.2);
      } else {
        // Split notched Blade of Destruction
        ctx.moveTo(8, -4.8);
        ctx.lineTo(24, -5.4);
        ctx.lineTo(26, -3.2);
        ctx.lineTo(35, -4.2);
        ctx.lineTo(42, 0);
        ctx.lineTo(35, 4.2);
        ctx.lineTo(26, 3.2);
        ctx.lineTo(24, 5.4);
        ctx.lineTo(8, 4.8);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Core Channel & Hilt Gem
      ctx.strokeStyle = weaponStyle.gemColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(34, 0);
      ctx.stroke();
      ctx.fillStyle = weaponStyle.gemColor;
      ctx.beginPath();
      ctx.arc(8, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'dk_atlans_trident': {
      // Long Sea-Emperor Polearm Shaft + 3-Pronged Golden/Azure Trident Head
      ctx.strokeStyle = weaponStyle.shaftColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(28, 0);
      ctx.stroke();

      ctx.fillStyle = weaponStyle.bladePrimary;
      ctx.strokeStyle = weaponStyle.hasExcellentGreenGlow ? '#6ee7b7' : '#fef08a';
      ctx.lineWidth = 1.5;
      // Central Spear Prong
      ctx.beginPath();
      ctx.moveTo(27, -2.5);
      ctx.lineTo(43, 0);
      ctx.lineTo(27, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Outer Curved Trident Prongs
      ctx.strokeStyle = weaponStyle.bladePrimary;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(25, 0);
      ctx.quadraticCurveTo(27, -9, 38, -7);
      ctx.moveTo(25, 0);
      ctx.quadraticCurveTo(27, 9, 38, 7);
      ctx.stroke();
      break;
    }

    case 'dk_balrog_scythe': {
      // Demonic Long-Shafted Balrog War-Scythe
      ctx.strokeStyle = weaponStyle.shaftColor;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(34, 0);
      ctx.stroke();

      // Sweeping Curved Crimson Crescent Scythe Blade
      const scGrad = ctx.createLinearGradient(26, -2, 34, 22);
      scGrad.addColorStop(0, '#fef08a');
      scGrad.addColorStop(0.5, weaponStyle.bladePrimary);
      scGrad.addColorStop(1, weaponStyle.bladeSecondary);
      ctx.fillStyle = scGrad;
      ctx.strokeStyle = weaponStyle.hasExcellentGreenGlow ? '#6ee7b7' : '#fde047';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(28, -3);
      ctx.quadraticCurveTo(42, 4, 34, 22);
      ctx.quadraticCurveTo(30, 10, 24, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'dk_archangel_flameblade': {
      // Divine Sword of Archangel: Winged Golden Crossguard, Sapphire Core & Twin Radiant Blade
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();

      // Angel-Wing Golden Crossguard
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.quadraticCurveTo(10, -12, 15, -9);
      ctx.quadraticCurveTo(11, -3, 9, 0);
      ctx.quadraticCurveTo(11, 3, 15, 9);
      ctx.quadraticCurveTo(10, 12, 6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Radiant Archangel Blade
      const aaGrad = ctx.createLinearGradient(9, 0, 43, 0);
      aaGrad.addColorStop(0, '#ffffff');
      aaGrad.addColorStop(0.45, '#fef08a');
      aaGrad.addColorStop(1, '#f97316');
      ctx.fillStyle = aaGrad;
      ctx.strokeStyle = weaponStyle.hasExcellentGreenGlow ? '#6ee7b7' : '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(9, -3.8);
      ctx.lineTo(35, -3);
      ctx.lineTo(43, 0);
      ctx.lineTo(35, 3);
      ctx.lineTo(9, 3.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sapphire Archangel Hilt Jewel
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(8.5, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'dw_apprentice_staff':
    case 'dw_legendary_soul_staff':
    case 'dw_noria_ancient_staff':
    case 'dw_elbeland_illusion_wand':
    case 'dw_frost_crystal_staff': {
      const arch = weaponStyle.archetype;
      ctx.strokeStyle = weaponStyle.shaftColor;
      ctx.lineWidth = 3.1;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(29, 0);
      ctx.stroke();

      // Distinct Staff Head Geometry per named early/mid Wizard Staff
      ctx.fillStyle = weaponStyle.gemColor;
      ctx.strokeStyle = weaponStyle.hasExcellentGreenGlow ? '#6ee7b7' : weaponStyle.guardColor;
      ctx.lineWidth = 1.4;
      if (arch === 'dw_frost_crystal_staff') {
        // Faceted Devias Ice Diamond
        ctx.beginPath();
        ctx.moveTo(27, 0);
        ctx.lineTo(33, -6.5);
        ctx.lineTo(41, 0);
        ctx.lineTo(33, 6.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (arch === 'dw_legendary_soul_staff') {
        // Golden Halo Ring cradling Sapphire Soul Sphere
        ctx.beginPath();
        ctx.arc(33, 0, 6.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(33, 0, 3.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (arch === 'dw_noria_ancient_staff') {
        // Twin curling wooden Noria branches holding an emerald seed
        ctx.beginPath();
        ctx.moveTo(27, 0);
        ctx.quadraticCurveTo(32, -8, 38, -4);
        ctx.moveTo(27, 0);
        ctx.quadraticCurveTo(32, 8, 38, 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(34, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (arch === 'dw_elbeland_illusion_wand') {
        // Crescent Moon Illusion Wand Head
        ctx.beginPath();
        ctx.arc(33, 0, 6, -Math.PI * 0.65, Math.PI * 0.65);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(35, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Simple Apprentice Wooden Knob & Blue Orb
        ctx.beginPath();
        ctx.arc(32, 0, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    case 'dw_dragon_soul_staff':
    case 'dw_atlans_water_staff':
    case 'dw_balrog_chaos_staff':
    case 'dw_tarkan_sand_rod':
    case 'dw_icarus_heavens_staff':
    case 'dw_kalima_oracle_wand':
    case 'dw_kanturu_imperial_scepter': {
      const arch = weaponStyle.archetype;
      ctx.strokeStyle = weaponStyle.shaftColor;
      ctx.lineWidth = 3.3;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(30, 0);
      ctx.stroke();

      // Distinct Mid/High-Tier Staff Head Crown
      ctx.strokeStyle = weaponStyle.hasExcellentGreenGlow ? '#6ee7b7' : weaponStyle.guardColor;
      ctx.lineWidth = 2.3;
      if (arch === 'dw_atlans_water_staff') {
        // Trident-crowned Sea Mage Staff
        ctx.beginPath();
        ctx.moveTo(28, -7);
        ctx.lineTo(37, -7);
        ctx.moveTo(28, 7);
        ctx.lineTo(37, 7);
        ctx.moveTo(28, -7);
        ctx.lineTo(28, 7);
        ctx.stroke();
      } else if (arch === 'dw_tarkan_sand_rod') {
        // Egyptian Sun-Disc & Cobra Wings
        ctx.beginPath();
        ctx.moveTo(28, -9);
        ctx.lineTo(35, 0);
        ctx.lineTo(28, 9);
        ctx.stroke();
      } else if (arch === 'dw_icarus_heavens_staff') {
        // Feathered Sky-Wing Halo
        ctx.beginPath();
        ctx.moveTo(27, 0);
        ctx.quadraticCurveTo(31, -11, 39, -8);
        ctx.moveTo(27, 0);
        ctx.quadraticCurveTo(31, 11, 39, 8);
        ctx.stroke();
      } else if (arch === 'dw_kalima_oracle_wand' || arch === 'dw_kanturu_imperial_scepter') {
        // Imperial Diamond Scepter Cage
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(34, -8.5);
        ctx.lineTo(42, 0);
        ctx.lineTo(34, 8.5);
        ctx.closePath();
        ctx.stroke();
      } else {
        // Twin Horned Dragon/Balrog Claws gripping the Soul/Flame Core
        ctx.beginPath();
        ctx.arc(33, 0, 7.5, -Math.PI * 0.78, Math.PI * 0.78);
        ctx.stroke();
      }

      ctx.fillStyle = weaponStyle.gemColor;
      ctx.beginPath();
      ctx.arc(34, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'dw_archangel_kundun_staff': {
      // Divine Staff of Archangel / Kundun with Spread Seraph Wings & Sun Core
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(32, 0);
      ctx.stroke();

      // Golden Seraph Wings on Staff Head
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = weaponStyle.hasExcellentGreenGlow ? '#6ee7b7' : '#d97706';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(28, 0);
      ctx.quadraticCurveTo(32, -13, 40, -10);
      ctx.quadraticCurveTo(35, -3, 33, 0);
      ctx.quadraticCurveTo(35, 3, 40, 10);
      ctx.quadraticCurveTo(32, 13, 28, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Levitating Astral Core
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(36, 0, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'elf_holy_crossbow':
    case 'elf_kanturu_nightmare_crossbow':
    case 'elf_archangel_crossbow': {
      const arch = weaponStyle.archetype;
      const isArchangel = arch === 'elf_archangel_crossbow';
      const isNightmare = arch === 'elf_kanturu_nightmare_crossbow';
      // Crossbow Tiller / Stock
      ctx.strokeStyle = weaponStyle.shaftColor;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(25, 0);
      ctx.stroke();

      // Twin Swept Crossbow Prod Arms
      ctx.strokeStyle = weaponStyle.bladePrimary;
      ctx.lineWidth = isArchangel ? 3.3 : 3;
      ctx.beginPath();
      if (isNightmare) {
        // Angular bat-wing Kanturu prod arms
        ctx.moveTo(21, 0);
        ctx.lineTo(24, -10);
        ctx.lineTo(13, -18);
        ctx.moveTo(21, 0);
        ctx.lineTo(24, 10);
        ctx.lineTo(13, 18);
      } else {
        ctx.moveTo(20, 0);
        ctx.quadraticCurveTo(22, -14, 13, -17);
        ctx.moveTo(20, 0);
        ctx.quadraticCurveTo(22, 14, 13, 17);
      }
      ctx.stroke();

      // Bowstring & Loaded Glowing Bolt
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(13, -16);
      ctx.lineTo(6, 0);
      ctx.lineTo(13, 16);
      ctx.stroke();

      ctx.strokeStyle = weaponStyle.gemColor;
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(35, 0);
      ctx.stroke();
      break;
    }

    case 'elf_short_recurve_bow':
    case 'elf_silver_wing_bow':
    case 'elf_noria_queen_bow':
    case 'elf_elbeland_wind_bow':
    case 'elf_crystal_coral_bow':
    case 'elf_atlans_coral_bow':
    case 'elf_tower_chaos_bow':
    case 'elf_tarkan_golden_sand_bow':
    case 'elf_winged_icarus_bow':
    case 'elf_raklion_frost_bow':
    default: {
      const arch = weaponStyle.archetype;
      const isWinged =
        arch === 'elf_winged_icarus_bow' ||
        arch === 'elf_silver_wing_bow' ||
        arch === 'elf_raklion_frost_bow';
      const bowRadius =
        arch === 'elf_short_recurve_bow'
          ? 14.5
          : isWinged
            ? 18
            : 16.5;

      // Sculpted Bow Limbs
      ctx.strokeStyle = weaponStyle.bladePrimary;
      ctx.lineWidth = isWinged ? 3.4 : 2.8;
      ctx.beginPath();
      ctx.arc(10, 0, bowRadius, -Math.PI * 0.56, Math.PI * 0.56);
      ctx.stroke();

      // Secondary Limb Trim / Wing / Spikes per named bow
      if (isWinged || arch === 'elf_tarkan_golden_sand_bow' || arch === 'elf_noria_queen_bow') {
        ctx.strokeStyle = weaponStyle.guardColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(13, 0, bowRadius - 2.5, -Math.PI * 0.48, Math.PI * 0.48);
        ctx.stroke();
      } else if (arch === 'elf_tower_chaos_bow' || arch === 'elf_atlans_coral_bow') {
        // Spiked outer limb tips
        ctx.fillStyle = weaponStyle.guardColor;
        ctx.beginPath();
        ctx.arc(12, -bowRadius + 1, 2.3, 0, Math.PI * 2);
        ctx.arc(12, bowRadius - 1, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bowstring
      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(12, -(bowRadius - 1));
      ctx.lineTo(4, 0);
      ctx.lineTo(12, bowRadius - 1);
      ctx.stroke();

      // Drawn Glowing Arrow
      ctx.strokeStyle = weaponStyle.gemColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(34, 0);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = weaponStyle.guardColor;
      ctx.beginPath();
      ctx.moveTo(36, 0);
      ctx.lineTo(30, -3);
      ctx.lineTo(30, 3);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  // Subtle Pearlescent White Sheen (+10 to +15) along Equipped Weapon
  if (hasWeapon && weaponStyle.upgradeEffect.hasSubtleWhiteSheen) {
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${weaponStyle.upgradeEffect.whiteSheenAlpha})`;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(10, -1.2);
    ctx.lineTo(34, -1.2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  // Floating Emerald-Green (Excellent) or Purple (Ancient) Sparkle Motes around Hero
  if (hasAnyExcellentEquip || hasAnyAncientEquip) {
    ctx.save();
    ctx.translate(0, bodyBob);
    const usePurpleMotes = hasAnyAncientEquip && !hasAnyExcellentEquip;
    for (let i = 0; i < 4; i++) {
      const phase = now * 0.0042 + i * 1.57;
      const ex = Math.cos(phase) * 16;
      const ey = -18 + Math.sin(phase * 1.3) * 14;
      ctx.fillStyle = usePurpleMotes
        ? i % 2 === 0
          ? '#c084fc'
          : '#e9d5ff'
        : i % 2 === 0
          ? '#34d399'
          : '#a7f3d0';
      ctx.beginPath();
      ctx.arc(ex, ey, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Subtle Pearlescent White Glint Motes when +10..+15 equipment is equipped
  if (
    setStyle.armorUpgradeEffect.hasSubtleWhiteSheen ||
    setStyle.helmUpgradeEffect.hasSubtleWhiteSheen ||
    weaponStyle.upgradeEffect.hasSubtleWhiteSheen
  ) {
    ctx.save();
    ctx.translate(0, bodyBob);
    const maxWhiteAlpha = Math.max(
      setStyle.armorUpgradeEffect.whiteSheenAlpha,
      setStyle.helmUpgradeEffect.whiteSheenAlpha,
      weaponStyle.upgradeEffect.whiteSheenAlpha
    );
    for (let w = 0; w < 3; w++) {
      const wPhase = now * 0.0036 + w * 2.09;
      const wx = Math.cos(wPhase) * 13;
      const wy = -21 + Math.sin(wPhase * 1.5) * 11;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.45, maxWhiteAlpha + 0.1).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(wx, wy, 1.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}


/**
 * Renders detailed 2.5D upright monster models for all 4 MU Online archetypes
 * (Skeleton Warrior, Lich Necromancer, Minotaur Bull Fighter, and Demon Bosses).
 */
export function drawEnemyModel(
  ctx: CanvasRenderingContext2D,
  e: EnemyEntity,
  now: number
): void {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.aiState === 'ko') {
    const koProgress = 1 - Math.max(0, e.koTimer / 0.35);
    ctx.globalAlpha = 1 - koProgress;
    ctx.rotate(koProgress * 1.35);
    ctx.scale(1 - koProgress * 0.28, 1 - koProgress * 0.28);
  }

  const stride = Math.sin(e.walkDistance * 0.1);
  const bob = e.aiState === 'ko' ? 0 : Math.abs(stride) * -2.5;
  const facingRight = Math.cos(e.facingAngle) >= 0;
  const dirX = facingRight ? 1 : -1;
  const isHit = e.hitFlashTimer > 0;
  const isChilled = e.chillTimer > 0;

  // Ground Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
  ctx.beginPath();
  ctx.ellipse(0, 12, e.radius * 0.95, e.radius * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  if (e.archetype === 'bc_gate') {
    // =========================================================================
    // BLOOD CASTLE GATE: MASSIVE GOTHIC IRON & STONE FORTRESS GATE ACROSS BRIDGE
    // =========================================================================
    ctx.save();
    // Gate stone pillars on left and right
    ctx.fillStyle = isHit ? '#ffffff' : '#272030';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.fillRect(-130, -85, 34, 100);
    ctx.strokeRect(-130, -85, 34, 100);
    ctx.fillRect(96, -85, 34, 100);
    ctx.strokeRect(96, -85, 34, 100);

    // Iron portcullis arch & bars
    ctx.fillStyle = isHit ? '#fecdd3' : 'rgba(30, 18, 28, 0.92)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-96, 12);
    ctx.lineTo(-96, -65);
    ctx.quadraticCurveTo(0, -105, 96, -65);
    ctx.lineTo(96, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vertical spiked iron bars
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    for (let bx = -75; bx <= 75; bx += 25) {
      ctx.beginPath();
      ctx.moveTo(bx, 12);
      ctx.lineTo(bx, -72);
      ctx.stroke();
    }

    // Glowing Crimson Seal in center of gate
    const pulse = 0.7 + Math.sin(now * 0.006) * 0.3;
    ctx.strokeStyle = `rgba(244, 63, 94, ${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -34, 22, 0, Math.PI * 2);
    ctx.stroke();

    // Overhead Label & HP Bar
    const hpPct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(9, 8, 12, 0.92)';
    ctx.fillRect(-75, -112, 150, 8);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(-75, -112, 150 * hpPct, 8);
    ctx.font = 'bold 12px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.fillText(e.name, 0, -118);
    ctx.restore();
    ctx.restore();
    return;
  }

  if (e.archetype === 'bc_statue') {
    // =========================================================================
    // BLOOD CASTLE CRYSTAL STATUE OF ARCHANGEL
    // =========================================================================
    ctx.save();
    // Runic Altar Base
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 10, 44, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Faceted Glowing Crystal Prism
    const floatY = Math.sin(now * 0.005) * 4;
    ctx.translate(0, floatY);
    const grad = ctx.createLinearGradient(-26, -85, 26, 5);
    grad.addColorStop(0, '#e0f2fe');
    grad.addColorStop(0.5, isHit ? '#ffffff' : '#38bdf8');
    grad.addColorStop(1, '#0284c7');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -96);
    ctx.lineTo(28, -58);
    ctx.lineTo(20, 4);
    ctx.lineTo(-20, 4);
    ctx.lineTo(-28, -58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Embedded Golden Archangel Sword silhouette inside crystal
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, -76);
    ctx.lineTo(0, -18);
    ctx.moveTo(-12, -56);
    ctx.lineTo(12, -56);
    ctx.stroke();

    // Overhead Label & HP Bar
    const hpPct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(9, 8, 12, 0.92)';
    ctx.fillRect(-70, -118, 140, 8);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-70, -118, 140 * hpPct, 8);
    ctx.font = 'bold 12px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(e.name, 0, -124);
    ctx.restore();
    ctx.restore();
    return;
  }

  if (e.isBoss) {
    // =========================================================================
    // GOLDEN BOSS MODEL: RADIANT GILDED INVASION LORD (SPAWNS EVERY 15 MIN)
    // =========================================================================
    // Golden Pulsing Runic Magic Circle & Shimmering Aura under feet
    const goldPulse = 0.65 + Math.sin(now * 0.005) * 0.28;
    const auraGrad = ctx.createRadialGradient(0, -18, 6, 0, -18, e.radius * 1.9);
    auraGrad.addColorStop(0, `rgba(254, 240, 138, ${0.34 * goldPulse})`);
    auraGrad.addColorStop(0.55, `rgba(250, 204, 21, ${0.18 * goldPulse})`);
    auraGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, -18, e.radius * 1.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(250, 204, 21, ${0.85 * goldPulse})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0, 12, e.radius * 1.32, e.radius * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating golden sparkles around Golden Boss
    for (let s = 0; s < 4; s += 1) {
      const ang = now * 0.003 + (s * Math.PI) / 2;
      const sx = Math.cos(ang) * (e.radius * 1.25);
      const sy = -24 + Math.sin(ang * 1.4) * 18;
      ctx.fillStyle = s % 2 === 0 ? '#fef9c3' : '#facc15';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(0, bob);

    // Flapping Radiant Golden Dragon Wings
    const wingFlap = Math.sin(now * 0.007) * 9;
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.scale(side, 1);
      const wingGrad = ctx.createLinearGradient(8, -56, 60, 4);
      wingGrad.addColorStop(0, isHit ? '#ffffff' : '#fef08a');
      wingGrad.addColorStop(0.45, isHit ? '#ffffff' : '#f59e0b');
      wingGrad.addColorStop(1, isHit ? '#ffffff' : '#92400e');
      ctx.fillStyle = wingGrad;
      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(8, -26);
      ctx.quadraticCurveTo(40, -64 - wingFlap, 64, -38 - wingFlap * 0.5);
      ctx.quadraticCurveTo(48, -10, 54, 6);
      ctx.quadraticCurveTo(28, -4, 10, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Gilded Armored Greaves
    ctx.fillStyle = isHit ? '#ffffff' : '#b45309';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-13, -4 + stride * 4, 9, 16, 3);
    ctx.roundRect(4, -4 - stride * 4, 9, 16, 3);
    ctx.fill();
    ctx.stroke();

    // Massive Solid-Gold Cuirass Torso
    const torsoGrad = ctx.createLinearGradient(-20, -36, 20, 0);
    torsoGrad.addColorStop(0, isHit ? '#ffffff' : isChilled ? '#7dd3fc' : '#fef08a');
    torsoGrad.addColorStop(0.5, isHit ? '#ffffff' : isChilled ? '#38bdf8' : '#f59e0b');
    torsoGrad.addColorStop(1, isHit ? '#ffffff' : isChilled ? '#0284c7' : '#a16207');
    ctx.fillStyle = torsoGrad;
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-20, -36);
    ctx.lineTo(20, -36);
    ctx.lineTo(14, 0);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Blazing Sun-Core Gem on Chest
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -20, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Spiked Golden Pauldrons
    [-1, 1].forEach((side) => {
      ctx.fillStyle = isHit ? '#ffffff' : '#d97706';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(side * 21, -32, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Golden Crowned Helm & Sweeping Gilded Horns
    const headGrad = ctx.createRadialGradient(-3, -52, 2, 0, -48, 13);
    headGrad.addColorStop(0, isHit ? '#ffffff' : '#fef9c3');
    headGrad.addColorStop(0.65, isHit ? '#ffffff' : '#f59e0b');
    headGrad.addColorStop(1, isHit ? '#ffffff' : '#b45309');
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -48, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Royal Golden Crown Spikes
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-8, -58);
    ctx.lineTo(-10, -68);
    ctx.lineTo(-4, -61);
    ctx.lineTo(0, -71);
    ctx.lineTo(4, -61);
    ctx.lineTo(10, -68);
    ctx.lineTo(8, -58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-9, -53);
    ctx.quadraticCurveTo(-24, -64, -20, -74);
    ctx.moveTo(9, -53);
    ctx.quadraticCurveTo(24, -64, 20, -74);
    ctx.stroke();

    // Blazing Radiant White-Gold Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, -50, 4.5, 3);
    ctx.fillRect(2, -50, 4.5, 3);

    // Radiant Golden Trident / Sovereign Halberd
    ctx.save();
    ctx.translate(dirX * 22, -26);
    ctx.rotate(e.aiState === 'windup' ? -0.45 : e.aiState === 'active' ? 0.65 : 0.15);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(0, -34);
    ctx.stroke();
    // Golden Trident prongs
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-9, -24);
    ctx.lineTo(-9, -37);
    ctx.moveTo(0, -34);
    ctx.lineTo(0, -46);
    ctx.moveTo(9, -24);
    ctx.lineTo(9, -37);
    ctx.moveTo(-9, -24);
    ctx.lineTo(9, -24);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  } else if (e.archetype === 'orbiter_gorgon') {
    // =========================================================================
    // ARCHETYPE 4: WINGED SENTINEL / ELEMENTAL GUARDIAN (UNIQUE NON-BOSS MODEL)
    // =========================================================================
    const hoverY = Math.sin(now * 0.006 + e.x * 0.05) * 4.5;
    const wingBeat = Math.sin(now * 0.011 + e.y * 0.05) * 5;
    const primaryCol = isHit ? '#ffffff' : isChilled ? '#38bdf8' : e.color;
    ctx.save();
    ctx.translate(0, hoverY);

    // Translucent Swept Elemental Wings
    ctx.fillStyle = primaryCol;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.moveTo(-6, -20);
    ctx.lineTo(-26, -34 + wingBeat);
    ctx.lineTo(-20, -10 + wingBeat * 0.5);
    ctx.closePath();
    ctx.moveTo(6, -20);
    ctx.lineTo(26, -34 + wingBeat);
    ctx.lineTo(20, -10 + wingBeat * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Armored Floating Carapace Body
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = primaryCol;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(12, -16);
    ctx.lineTo(0, 6);
    ctx.lineTo(-12, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Elemental Core
    ctx.fillStyle = primaryCol;
    ctx.beginPath();
    ctx.arc(0, -16, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Crowned Horned Helm
    ctx.fillStyle = primaryCol;
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -34, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-5, -40);
    ctx.lineTo(-11, -48);
    ctx.moveTo(5, -40);
    ctx.lineTo(11, -48);
    ctx.stroke();

    // Glowing Visor Eyes
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-4.5, -35, 3, 2.2);
    ctx.fillRect(1.5, -35, 3, 2.2);

    // Orbiting Runic Shards
    const shardA = now * 0.0065;
    for (let i = 0; i < 3; i++) {
      const a = shardA + (i * Math.PI * 2) / 3;
      const sx = Math.cos(a) * (e.radius + 5);
      const sy = -18 + Math.sin(a) * 8;
      ctx.fillStyle = primaryCol;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  } else if (e.archetype === 'charger_bull') {
    // =========================================================================
    // ARCHETYPE 3: HEAVY BRUISER / MINOTAUR / GOLEM (DYNAMIC BIOME PALETTE)
    // =========================================================================
    const bodyColor = isHit ? '#ffffff' : isChilled ? '#38bdf8' : e.color;
    ctx.save();
    ctx.translate(0, bob);

    // Heavy Armored Legs
    ctx.fillStyle = '#1c1917';
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-10, -2 + stride * 4, 7, 13, 3);
    ctx.roundRect(3, -2 - stride * 4, 7, 13, 3);
    ctx.fill();
    ctx.stroke();

    // Muscular Torso tinted by territory monster species color
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-15, -27);
    ctx.lineTo(15, -27);
    ctx.lineTo(10, 0);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crossed War Harness Chains
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(-11, -24);
    ctx.lineTo(9, -3);
    ctx.moveTo(11, -24);
    ctx.lineTo(-9, -3);
    ctx.stroke();

    // Spiked Pauldrons
    ctx.fillStyle = '#292524';
    ctx.strokeStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(-15, -23, 7, 0, Math.PI * 2);
    ctx.arc(15, -23, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Horned Beast Head
    ctx.fillStyle = isHit ? '#ffffff' : bodyColor;
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -34, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Curved Horns
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-8, -37);
    ctx.quadraticCurveTo(-19, -42, -16, -50);
    ctx.moveTo(8, -37);
    ctx.quadraticCurveTo(19, -42, 16, -50);
    ctx.stroke();

    // Glowing Eyes & Nose Ring
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-5, -37, 3, 2.5);
    ctx.fillRect(2, -37, 3, 2.5);

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -29, 3, 0, Math.PI * 2);
    ctx.stroke();

    // Double-Bladed Battle Greataxe
    ctx.save();
    ctx.translate(dirX * 16, -18);
    ctx.rotate(e.aiState === 'windup' ? -0.6 : e.aiState === 'active' ? 0.8 : 0.2);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, -24);
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-10, -24);
    ctx.quadraticCurveTo(0, -16, 10, -24);
    ctx.quadraticCurveTo(12, -12, 10, -8);
    ctx.quadraticCurveTo(0, -14, -10, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  } else if (e.archetype === 'kiter_lich') {
    // =========================================================================
    // ARCHETYPE 2: RANGED CASTER / SHAMAN / NECROMANCER (DYNAMIC SPECIES COLOR)
    // =========================================================================
    const floatY = Math.sin(now * 0.005 + e.x) * 4;
    const robeCol = isHit ? '#ffffff' : isChilled ? '#38bdf8' : e.color;
    ctx.save();
    ctx.translate(0, floatY);

    // Tattered Billowing Robes colored per territory caster species
    const robeGrad = ctx.createLinearGradient(0, -28, 0, 10);
    robeGrad.addColorStop(0, robeCol);
    robeGrad.addColorStop(1, '#181326');

    ctx.fillStyle = robeGrad;
    ctx.strokeStyle = robeCol;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-9, -25);
    ctx.lineTo(9, -25);
    ctx.lineTo(14, 8);
    ctx.lineTo(7, 4);
    ctx.lineTo(0, 10);
    ctx.lineTo(-7, 4);
    ctx.lineTo(-14, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Arcane Core
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, -14, 3.8, 0, Math.PI * 2);
    ctx.fill();

    // Pointed Hood & Shadow Face
    ctx.fillStyle = isHit ? '#ffffff' : '#1f1630';
    ctx.strokeStyle = robeCol;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-9, -26);
    ctx.lineTo(0, -44);
    ctx.lineTo(9, -26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#09080c';
    ctx.beginPath();
    ctx.arc(0, -31, 6, 0, Math.PI * 2);
    ctx.fill();

    // Luminous Eyes matched to species color
    ctx.fillStyle = robeCol;
    ctx.fillRect(-4, -32, 2.5, 2.5);
    ctx.fillRect(1.5, -32, 2.5, 2.5);

    // Runic Staff
    ctx.save();
    ctx.translate(dirX * 13, -14);
    ctx.strokeStyle = robeCol;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(0, -22);
    ctx.stroke();

    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(0, -24, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2 Orbiting Spectral Orbs tinted by species color
    const orbAngle = now * 0.0055;
    [0, Math.PI].forEach((offset) => {
      const ox = Math.cos(orbAngle + offset) * (e.radius + 7);
      const oy = -14 + Math.sin(orbAngle + offset) * 9;
      ctx.fillStyle = robeCol;
      ctx.beginPath();
      ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  } else {
    // =========================================================================
    // ARCHETYPE 1: VANGUARD / SKELETON / SCOUT WARRIOR (DYNAMIC SPECIES COLOR)
    // =========================================================================
    ctx.save();
    ctx.translate(0, bob);

    const boneColor = isHit ? '#ffffff' : isChilled ? '#7dd3fc' : e.color;

    // Articulated Legs
    ctx.strokeStyle = boneColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-5, -2);
    ctx.lineTo(-6, 10 + stride * 3.5);
    ctx.moveTo(5, -2);
    ctx.lineTo(6, 10 - stride * 3.5);
    ctx.stroke();

    // Spine & Armored Ribcage Bars
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, -24);
    ctx.stroke();

    ctx.lineWidth = 2.2;
    [-19, -14, -9].forEach((ry) => {
      ctx.beginPath();
      ctx.moveTo(-7, ry);
      ctx.lineTo(7, ry);
      ctx.stroke();
    });

    // Skull / Helmeted Head
    ctx.fillStyle = boneColor;
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, -31, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dark Eye Sockets & Glowing Pupils
    ctx.fillStyle = '#09080c';
    ctx.fillRect(-4.5, -33, 3.2, 3.2);
    ctx.fillRect(1.5, -33, 3.2, 3.2);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-3.5, -32, 1.5, 1.5);
    ctx.fillRect(2.5, -32, 1.5, 1.5);

    // Buckler Shield tinted with species trim
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = boneColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-dirX * 11, -14, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Curved Blade
    ctx.save();
    ctx.translate(dirX * 10, -15);
    ctx.rotate(e.aiState === 'windup' ? -0.5 : e.aiState === 'active' ? 0.75 : 0);
    ctx.strokeStyle = boneColor;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.quadraticCurveTo(dirX * 10, -8, dirX * 4, -20);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  // Overhead Enemy HP Bar (Gold for Golden Boss, Crimson for regular mobs)
  if (e.aiState !== 'ko') {
    const barW = e.isBoss ? 76 : 38;
    const barY = e.isBoss ? -76 : -48;
    const hpPct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(9, 8, 12, 0.88)';
    ctx.fillRect(-barW / 2, barY, barW, 5.5);
    ctx.fillStyle = e.isBoss ? '#facc15' : '#ef4444';
    ctx.fillRect(-barW / 2, barY, barW * hpPct, 5.5);
  }

  ctx.restore();
}

/**
 * Renders 2.5D upright Sanctuary NPC models (Chaos Goblin, Priestess Sevina, Blacksmith Hanzo, Portal Master Marlon).
 */
export function drawNpcModel(
  ctx: CanvasRenderingContext2D,
  npcType:
    | 'chaos_goblin'
    | 'priestess_sevina'
    | 'blacksmith_hanzo'
    | 'portal_guard'
    | 'wounded_archangel',
  x: number,
  y: number,
  label: string,
  now: number
): void {
  ctx.save();
  ctx.translate(x, y);

  const bob = Math.sin(now * 0.004) * 1.5;

  // Ground Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  if (npcType === 'wounded_archangel') {
    // Celestial Golden Aura Ring on floor
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.75)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 12, 32, 14, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, bob);

    // Folded / Wounded Celestial White-Gold Archangel Wings
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.scale(side, 1);
      ctx.fillStyle = 'rgba(240, 249, 255, 0.9)';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(6, -20);
      ctx.quadraticCurveTo(28, -44, 38, -22);
      ctx.quadraticCurveTo(28, -4, 16, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Golden Archangel Armor & Crimson Sash
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-11, -24, 22, 26, 4);
    ctx.fill();
    ctx.stroke();

    // Radiant Halo & Hooded Head
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -35, 13, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.arc(0, -33, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (npcType === 'chaos_goblin') {
    // Rotating Emerald Chaos Machine Contactor Ring
    const prismRot = now * 0.003;
    ctx.save();
    ctx.translate(0, -14);
    ctx.rotate(prismRot);
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-18, -18, 36, 36);
    ctx.restore();

    // Goblin Alchemist Body & Apron
    ctx.save();
    ctx.translate(0, bob);
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-9, -22, 18, 22, 4);
    ctx.fill();
    ctx.stroke();

    // Goblin Head, Pointed Ears & Goggles
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(-7, -30);
    ctx.lineTo(-16, -34);
    ctx.lineTo(-7, -26);
    ctx.moveTo(7, -30);
    ctx.lineTo(16, -34);
    ctx.lineTo(7, -26);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, -30, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Brass Goggles
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-5, -32, 4, 3);
    ctx.fillRect(1, -32, 4, 3);
    ctx.restore();
  } else if (npcType === 'priestess_sevina') {
    // Priestess Sevina: Cathedral Vestments, Golden Halo & Scroll Staff
    ctx.save();
    ctx.translate(0, bob);

    // Halo behind head
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -33, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Flowing White & Violet Vestments
    ctx.fillStyle = '#f3e8ff';
    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-9, -24);
    ctx.lineTo(9, -24);
    ctx.lineTo(13, 8);
    ctx.lineTo(-13, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#9333ea';
    ctx.fillRect(-3, -22, 6, 28);

    // Head & Golden Veil
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(0, -32, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Golden Staff
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(13, 8);
    ctx.lineTo(13, -36);
    ctx.stroke();
    ctx.restore();
  } else if (npcType === 'blacksmith_hanzo') {
    // Blacksmith Hanzo: Heavy Anvil Pedestal, Leather Forge Apron & Glowing Hammer
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.6;
    ctx.fillRect(-24, -4, 14, 10);
    ctx.strokeRect(-24, -4, 14, 10);

    ctx.save();
    ctx.translate(0, bob);
    ctx.fillStyle = '#7c2d12';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-11, -24, 22, 24, 4);
    ctx.fill();
    ctx.stroke();

    // Head & Iron Brow Band
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -32, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.fillRect(-8, -36, 16, 4);

    // Forge Hammer
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(12, 2);
    ctx.lineTo(12, -24);
    ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(7, -29, 10, 6);
    ctx.restore();
  } else {
    // Portal Guard Marlon: Golden Plate Armor & Teleportation Banner
    ctx.save();
    ctx.translate(0, bob);
    ctx.fillStyle = '#1e3a8a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-11, -25);
    ctx.lineTo(11, -25);
    ctx.lineTo(9, 6);
    ctx.lineTo(-9, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Helm & Plume
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, -33, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Portal Halberd Staff
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(14, -40);
    ctx.stroke();
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(14, -42, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Overhead NPC Title Plate
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(label).width + 12;
  ctx.fillStyle = 'rgba(9, 8, 12, 0.9)';
  ctx.fillRect(-tw / 2, -68, tw, 16);
  ctx.fillStyle =
    npcType === 'chaos_goblin'
      ? '#6ee7b7'
      : npcType === 'priestess_sevina'
        ? '#e9d5ff'
        : npcType === 'blacksmith_hanzo'
          ? '#fde047'
          : '#7dd3fc';
  ctx.fillText(label, 0, -56);

  ctx.restore();
}
