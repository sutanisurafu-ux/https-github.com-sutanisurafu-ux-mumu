import React from 'react';
import {
  ArmorChestMotif,
  ArmorHelmMotif,
  InventoryItemIconDescriptor,
  resolveInventoryItemIconDescriptor,
  WeaponVisualArchetype,
  WingIconArchetype,
} from '../game/models';
import {
  CharacterClassId,
  EquipmentItem,
  ItemRarity,
  ItemSlot,
} from '../game/types';

export interface EquipmentItemIconProps {
  slot: ItemSlot;
  item?: EquipmentItem | null;
  rarity?: ItemRarity;
  fallbackClassId?: CharacterClassId;
  className?: string;
}

function renderWeaponArchetypeSvg(
  archetype: WeaponVisualArchetype,
  desc: InventoryItemIconDescriptor
): React.ReactNode {
  const { primaryColor: p, secondaryColor: s, trimColor: guard, gemColor: gem } = desc;

  switch (archetype) {
    /* ================= DARK KNIGHT WEAPONS (13) ================= */
    case 'dk_short_sword':
      return (
        <>
          <polygon points="24,5 27,8 14,21 10,21 10,17" fill={s} stroke={p} strokeWidth="1.7" />
          <line x1="12" y1="19" x2="25" y2="6" stroke={p} strokeWidth="1.3" />
          <path d="M8,15 L17,24 M6,26 L11,21" stroke={guard} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="6" cy="26" r="1.8" fill={gem} />
        </>
      );
    case 'dk_chaos_blade':
      return (
        <>
          <path
            d="M27,3 L29,9 L23,13 L25,15 L15,22 L9,22 L9,16 L16,8 L18,10 Z"
            fill={s}
            stroke={p}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <line x1="12" y1="19" x2="26" y2="5" stroke={gem} strokeWidth="1.5" />
          <path d="M6,14 L11,19 L18,26 M5,27 L10,22" stroke={guard} strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="11" cy="20" r="1.8" fill={gem} />
        </>
      );
    case 'dk_noria_emerald_blade':
      return (
        <>
          <path
            d="M27,4 C29,11 23,19 13,22 L9,21 C14,15 19,8 27,4 Z"
            fill={s}
            stroke={p}
            strokeWidth="1.8"
          />
          <path d="M13,18 C18,14 22,10 26,5" fill="none" stroke={gem} strokeWidth="1.3" />
          <path d="M7,16 C11,17 15,21 16,25 M5,27 L10,22" fill="none" stroke={guard} strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="11" cy="21" r="2" fill={gem} />
        </>
      );
    case 'dk_frost_runeblade':
      return (
        <>
          <polygon points="26,3 29,6 14,22 9,22 9,17" fill={s} stroke={p} strokeWidth="1.8" />
          <path
            d="M14,17 L16,15 M17,14 L19,12 M20,11 L22,9"
            stroke={gem}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <polygon points="7,14 13,18 18,25 14,20" fill={guard} stroke={p} strokeWidth="1.1" />
          <line x1="5" y1="27" x2="10" y2="22" stroke={guard} strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case 'dk_devias_ice_blade':
      return (
        <>
          <polygon
            points="28,3 27,10 22,13 23,16 14,22 9,22 9,17 15,10 18,11"
            fill={s}
            stroke={p}
            strokeWidth="1.7"
          />
          <polygon points="18,9 24,5 21,12" fill="#ffffff" fillOpacity="0.55" />
          <path d="M6,15 L12,19 L17,26 M5,27 L10,22" stroke={guard} strokeWidth="2.2" strokeLinecap="round" />
          <polygon points="11,18 14,21 11,24 8,21" fill={gem} />
        </>
      );
    case 'dk_destruction_greatsword':
      return (
        <>
          {/* Split twin-pronged Blade of Destruction */}
          <path
            d="M26,2 L21,11 L29,6 L16,22 L9,22 L9,15 Z"
            fill={s}
            stroke={p}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <line x1="12" y1="19" x2="22" y2="9" stroke={gem} strokeWidth="1.6" />
          <path d="M6,13 L12,19 L19,26 M5,27 L10,22" stroke={guard} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="11.5" cy="20.5" r="2.2" fill={gem} stroke="#ffffff" strokeWidth="0.8" />
        </>
      );
    case 'dk_atlans_trident':
      return (
        <>
          <line x1="5" y1="27" x2="22" y2="10" stroke={guard} strokeWidth="2.4" strokeLinecap="round" />
          {/* Center & twin side barbed prongs */}
          <path
            d="M15,9 L18,4 L20,9 M23,17 L28,14 L23,12 M18,14 L28,4"
            fill="none"
            stroke={p}
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="19" cy="13" r="2.2" fill={gem} stroke={guard} strokeWidth="1" />
        </>
      );
    case 'dk_balrog_scythe':
      return (
        <>
          <line x1="6" y1="27" x2="23" y2="6" stroke={guard} strokeWidth="2.4" strokeLinecap="round" />
          <path
            d="M19,5 C29,6 31,16 23,23 C24,15 21,11 16,9 Z"
            fill={s}
            stroke={p}
            strokeWidth="1.8"
          />
          <circle cx="20" cy="8" r="2" fill={gem} />
        </>
      );
    case 'dk_tarkan_zaikan_broadblade':
      return (
        <>
          {/* Massive cleaver-greatsword with dorsal teeth */}
          <polygon
            points="27,3 30,8 20,21 9,22 9,14 15,10 17,12 20,7 22,9"
            fill={s}
            stroke={p}
            strokeWidth="1.8"
          />
          <line x1="12" y1="19" x2="26" y2="6" stroke={gem} strokeWidth="1.6" />
          <path d="M6,14 L18,26 M5,27 L10,22" stroke={guard} strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
    case 'dk_phoenix_flameblade':
      return (
        <>
          {/* Wavy flamberge blade + phoenix wing guard */}
          <path
            d="M28,3 C24,8 27,11 21,15 C18,17 17,21 13,22 L9,22 L9,17 C12,13 16,12 19,8 C22,5 25,4 28,3 Z"
            fill={s}
            stroke={p}
            strokeWidth="1.8"
          />
          <path
            d="M5,13 C9,14 11,17 12,20 C15,21 18,23 19,27 M5,27 L10,22"
            fill="none"
            stroke={guard}
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <circle cx="11.5" cy="20.5" r="2.1" fill={gem} />
        </>
      );
    case 'dk_kalima_abyss_sword':
      return (
        <>
          <polygon points="28,3 29,8 15,22 9,22 9,15 23,4" fill={s} stroke={p} strokeWidth="1.8" />
          <polygon points="18,10 23,9 22,14 17,15" fill={gem} stroke="#ffffff" strokeWidth="0.9" />
          <path d="M6,14 L18,26 M5,27 L10,22" stroke={guard} strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    case 'dk_loren_royal_greatsword':
      return (
        <>
          <polygon points="28,2 30,6 14,22 9,22 9,16 25,2" fill={s} stroke={p} strokeWidth="1.9" />
          <line x1="12" y1="19" x2="27" y2="4" stroke={guard} strokeWidth="1.5" />
          {/* Royal eagle wing crossguard */}
          <path d="M4,13 L11,19 L19,27 M3,16 L11,19 L16,29 M5,27 L10,22" stroke={guard} strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="11" cy="20" r="2.2" fill={gem} stroke="#ffffff" strokeWidth="1" />
        </>
      );
    case 'dk_archangel_flameblade':
      return (
        <>
          {/* Halo ring behind divine hilt */}
          <circle cx="14" cy="18" r="7.5" fill="none" stroke={guard} strokeWidth="1.2" strokeOpacity="0.7" />
          <polygon points="29,2 30,7 15,22 9,22 9,15 24,2" fill={s} stroke={p} strokeWidth="1.9" />
          <line x1="12" y1="19" x2="28" y2="3" stroke="#ffffff" strokeWidth="1.4" />
          <path d="M4,12 C9,14 11,18 12,20 C14,21 18,23 20,28 M5,27 L10,22" fill="none" stroke={guard} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="11.5" cy="20.5" r="2.4" fill={gem} stroke="#ffffff" strokeWidth="1" />
        </>
      );

    /* ================= DARK WIZARD WEAPONS (13) ================= */
    case 'dw_apprentice_staff':
      return (
        <>
          <line x1="6" y1="26" x2="21" y2="11" stroke={guard} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M18,7 C23,3 28,8 24,13" fill="none" stroke={p} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="22.5" cy="9.5" r="2.8" fill={gem} />
        </>
      );
    case 'dw_legendary_soul_staff':
      return (
        <>
          <line x1="6" y1="26" x2="21" y2="11" stroke={s} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M16,8 C20,2 29,4 27,13 C25,16 20,16 18,13" fill="none" stroke={guard} strokeWidth="2" />
          <circle cx="22.5" cy="9.5" r="3.4" fill={gem} stroke="#ffffff" strokeWidth="1.1" />
        </>
      );
    case 'dw_noria_ancient_staff':
      return (
        <>
          <path d="M6,26 C11,21 15,18 21,11" fill="none" stroke={guard} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M16,10 C17,4 25,3 27,8 C28,13 23,17 19,14" fill={s} stroke={p} strokeWidth="1.6" />
          <circle cx="22.5" cy="9.5" r="2.8" fill={gem} />
        </>
      );
    case 'dw_elbeland_illusion_wand':
      return (
        <>
          <line x1="7" y1="25" x2="20" y2="12" stroke={s} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="23" cy="9" r="5.5" fill="none" stroke={p} strokeWidth="1.4" />
          <polygon points="23,4 27,9 23,14 19,9" fill={gem} stroke="#ffffff" strokeWidth="1" />
        </>
      );
    case 'dw_frost_crystal_staff':
      return (
        <>
          <line x1="6" y1="26" x2="20" y2="12" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
          {/* 6-point snowflake crystal head */}
          <path
            d="M23,3 L23,15 M17,9 L29,9 M19,5 L27,13 M27,5 L19,13"
            stroke={p}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="23" cy="9" r="2.6" fill={gem} stroke="#ffffff" strokeWidth="0.9" />
        </>
      );
    case 'dw_dragon_soul_staff':
      return (
        <>
          <line x1="6" y1="26" x2="20" y2="12" stroke={s} strokeWidth="2.6" strokeLinecap="round" />
          {/* Dragon claw/jaw gripping soul orb */}
          <path
            d="M15,11 L19,4 L23,7 L28,4 L26,11 L29,14 L21,15 Z"
            fill={p}
            stroke={guard}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="22.5" cy="9.5" r="3" fill={gem} stroke="#ffffff" strokeWidth="1" />
        </>
      );
    case 'dw_atlans_water_staff':
      return (
        <>
          <line x1="6" y1="26" x2="21" y2="11" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
          <path
            d="M16,9 C18,3 27,3 28,9 C29,14 23,17 20,13"
            fill={p}
            fillOpacity="0.45"
            stroke={guard}
            strokeWidth="1.8"
          />
          <circle cx="23" cy="9" r="3" fill={gem} stroke="#ffffff" strokeWidth="1" />
        </>
      );
    case 'dw_balrog_chaos_staff':
      return (
        <>
          <line x1="6" y1="26" x2="20" y2="12" stroke={s} strokeWidth="2.6" strokeLinecap="round" />
          {/* Horned Balrog flame cradle */}
          <path
            d="M15,13 C13,6 19,2 22,6 C26,2 30,8 25,14 Z"
            fill={p}
            stroke={guard}
            strokeWidth="1.5"
          />
          <circle cx="22.5" cy="9.5" r="3.1" fill={gem} stroke="#fde047" strokeWidth="1.1" />
        </>
      );
    case 'dw_tarkan_sand_rod':
      return (
        <>
          <line x1="6" y1="26" x2="20" y2="12" stroke={s} strokeWidth="2.6" strokeLinecap="round" />
          {/* Desert Ankh + Scarab wings */}
          <path d="M14,9 L28,9 M18,13 L24,13" stroke={guard} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="23" cy="7.5" r="3.5" fill={s} stroke={p} strokeWidth="2" />
          <circle cx="23" cy="7.5" r="1.8" fill={gem} />
        </>
      );
    case 'dw_icarus_heavens_staff':
      return (
        <>
          <line x1="6" y1="26" x2="20" y2="12" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
          {/* Angel wings flanking sky orb */}
          <path
            d="M19,11 C13,8 13,3 19,5 M23,13 C26,18 30,17 28,11"
            fill={p}
            stroke={guard}
            strokeWidth="1.6"
          />
          <circle cx="23" cy="9" r="3.4" fill={gem} stroke="#ffffff" strokeWidth="1.2" />
        </>
      );
    case 'dw_kalima_oracle_wand':
      return (
        <>
          <line x1="6" y1="26" x2="19" y2="13" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="23,3 29,9 23,15 17,9" fill={s} stroke={guard} strokeWidth="1.7" />
          <circle cx="23" cy="9" r="2.7" fill={gem} stroke="#ffffff" strokeWidth="1" />
        </>
      );
    case 'dw_kanturu_imperial_scepter':
      return (
        <>
          <line x1="6" y1="26" x2="19" y2="13" stroke={s} strokeWidth="2.7" strokeLinecap="round" />
          <circle cx="23" cy="9" r="5.5" fill="none" stroke={guard} strokeWidth="1.8" strokeDasharray="3 1.5" />
          <polygon points="23,4 28,9 23,14 18,9" fill={p} stroke={guard} strokeWidth="1.3" />
          <circle cx="23" cy="9" r="2.4" fill={gem} />
        </>
      );
    case 'dw_archangel_kundun_staff':
      return (
        <>
          <line x1="5" y1="27" x2="20" y2="12" stroke={guard} strokeWidth="2.8" strokeLinecap="round" />
          {/* Grand seraph wings + crown halo */}
          <circle cx="23" cy="9" r="6.2" fill="none" stroke={guard} strokeWidth="1.3" />
          <path
            d="M13,8 L19,4 L22,7 L27,2 L25,9 L29,12 L22,15 Z"
            fill={p}
            stroke={guard}
            strokeWidth="1.5"
          />
          <circle cx="23" cy="9" r="3.3" fill={gem} stroke="#ffffff" strokeWidth="1.2" />
        </>
      );

    /* ================= FAIRY ELF WEAPONS (13) ================= */
    case 'elf_short_recurve_bow':
      return (
        <>
          <path d="M9,6 C20,7 24,11 26,23" fill="none" stroke={p} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="9" y1="6" x2="26" y2="23" stroke="#e2e8f0" strokeWidth="1.1" />
          <line x1="11" y1="21" x2="24" y2="8" stroke={gem} strokeWidth="1.9" strokeLinecap="round" />
        </>
      );
    case 'elf_silver_wing_bow':
      return (
        <>
          <path d="M8,5 C21,6 26,11 27,24" fill="none" stroke={p} strokeWidth="2.7" strokeLinecap="round" />
          <path d="M12,8 C19,9 23,13 24,20" fill="none" stroke={guard} strokeWidth="1.5" />
          <line x1="8" y1="5" x2="27" y2="24" stroke="#e2e8f0" strokeWidth="1.1" />
          <line x1="11" y1="21" x2="25" y2="7" stroke={gem} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'elf_noria_queen_bow':
      return (
        <>
          <path d="M8,5 C21,6 25,11 27,24" fill="none" stroke={p} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="15" cy="8" r="2" fill={guard} />
          <circle cx="24" cy="17" r="2" fill={guard} />
          <line x1="8" y1="5" x2="27" y2="24" stroke="#dcfce7" strokeWidth="1.1" />
          <line x1="11" y1="21" x2="25" y2="7" stroke={gem} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'elf_elbeland_wind_bow':
      return (
        <>
          <path d="M7,6 C18,3 29,14 26,25" fill="none" stroke={p} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M11,10 C18,9 23,14 22,21" fill="none" stroke={gem} strokeWidth="1.4" strokeDasharray="3 2" />
          <line x1="7" y1="6" x2="26" y2="25" stroke="#e2e8f0" strokeWidth="1.1" />
          <line x1="11" y1="21" x2="25" y2="7" stroke={guard} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'elf_crystal_coral_bow':
      return (
        <>
          <polyline
            points="8,5 17,7 22,10 25,15 27,24"
            fill="none"
            stroke={p}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <polygon points="19,6 25,7 22,12" fill={gem} />
          <line x1="8" y1="5" x2="27" y2="24" stroke="#e0f2fe" strokeWidth="1.1" />
          <line x1="11" y1="21" x2="25" y2="7" stroke={gem} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'elf_holy_crossbow':
      return (
        <>
          <line x1="6" y1="26" x2="24" y2="8" stroke={guard} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M9,8 C17,6 26,15 24,23" fill="none" stroke={p} strokeWidth="2.7" strokeLinecap="round" />
          <line x1="9" y1="8" x2="24" y2="23" stroke="#e2e8f0" strokeWidth="1.2" />
          <circle cx="18" cy="14" r="2.2" fill={gem} />
        </>
      );
    case 'elf_atlans_coral_bow':
      return (
        <>
          <path d="M8,5 C22,6 26,10 27,24" fill="none" stroke={p} strokeWidth="2.7" strokeLinecap="round" />
          <circle cx="20" cy="12" r="2.4" fill={gem} stroke={guard} strokeWidth="1" />
          <line x1="8" y1="5" x2="27" y2="24" stroke="#fde047" strokeWidth="1.1" />
          <line x1="11" y1="21" x2="25" y2="7" stroke={gem} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'elf_tower_chaos_bow':
      return (
        <>
          <path
            d="M7,5 L16,6 L22,10 L26,16 L27,25"
            fill="none"
            stroke={p}
            strokeWidth="2.7"
            strokeLinejoin="round"
          />
          <polygon points="15,4 20,4 17,9" fill={guard} />
          <polygon points="28,15 28,20 23,17" fill={guard} />
          <line x1="7" y1="5" x2="27" y2="25" stroke="#fca5a5" strokeWidth="1.1" />
          <line x1="11" y1="21" x2="26" y2="6" stroke={gem} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    case 'elf_tarkan_golden_sand_bow':
      return (
        <>
          <path d="M8,5 C22,6 26,10 27,24" fill="none" stroke={p} strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="19" cy="13" r="3.5" fill={s} stroke={guard} strokeWidth="1.5" />
          <line x1="8" y1="5" x2="27" y2="24" stroke="#fef08a" strokeWidth="1.1" />
          <line x1="11" y1="21" x2="25" y2="7" stroke={gem} strokeWidth="2.1" strokeLinecap="round" />
        </>
      );
    case 'elf_winged_icarus_bow':
      return (
        <>
          {/* Grand double-feathered Icarus wing bow */}
          <path d="M7,4 C21,5 27,11 28,25" fill="none" stroke={p} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M11,8 C20,9 23,12 24,21" fill="none" stroke={s} strokeWidth="1.8" />
          <line x1="7" y1="4" x2="28" y2="25" stroke="#ffffff" strokeWidth="1.2" />
          <line x1="11" y1="21" x2="26" y2="6" stroke={gem} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    case 'elf_kanturu_nightmare_crossbow':
      return (
        <>
          <line x1="5" y1="27" x2="25" y2="7" stroke={s} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M8,7 C17,5 27,15 25,24" fill="none" stroke={p} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M12,10 C18,9 23,14 22,20" fill="none" stroke={guard} strokeWidth="1.6" />
          <circle cx="18" cy="14" r="2.4" fill={gem} stroke="#ffffff" strokeWidth="0.9" />
        </>
      );
    case 'elf_raklion_frost_bow':
      return (
        <>
          <path d="M7,4 L18,6 L26,14 L28,25" fill="none" stroke={p} strokeWidth="2.8" />
          <line x1="7" y1="4" x2="28" y2="25" stroke="#e0f2fe" strokeWidth="1.1" />
          {/* Triple frost arrows */}
          <line x1="11" y1="21" x2="26" y2="6" stroke={gem} strokeWidth="2" strokeLinecap="round" />
          <line x1="10" y1="18" x2="23" y2="5" stroke={guard} strokeWidth="1.3" strokeLinecap="round" />
          <line x1="14" y1="22" x2="27" y2="9" stroke={guard} strokeWidth="1.3" strokeLinecap="round" />
        </>
      );
    case 'elf_archangel_crossbow':
    default:
      return (
        <>
          <circle cx="17" cy="15" r="7" fill="none" stroke={guard} strokeWidth="1.2" strokeOpacity="0.7" />
          <line x1="5" y1="27" x2="26" y2="6" stroke={guard} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M7,7 C17,4 28,15 25,25" fill="none" stroke={p} strokeWidth="2.9" strokeLinecap="round" />
          <line x1="7" y1="7" x2="25" y2="25" stroke="#ffffff" strokeWidth="1.2" />
          <circle cx="18" cy="14" r="2.6" fill={gem} stroke="#ffffff" strokeWidth="1" />
        </>
      );
  }
}

function renderArmorMotifEmblem(
  motif: ArmorChestMotif,
  desc: InventoryItemIconDescriptor
): React.ReactNode {
  const { accentColor: accent, trimColor: trim, gemColor: gem } = desc;

  switch (motif) {
    case 'leather_wraps':
    case 'dw_linen_tunic':
    case 'elf_lorencia_tunic':
      return (
        <>
          <path d="M11,11 L21,19 M21,11 L11,19" stroke={trim} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="16" cy="15" r="1.8" fill={gem} />
        </>
      );
    case 'noria_vine_crest':
    case 'dw_noria_sage_stole':
    case 'elf_noria_guardian':
      return (
        <>
          <path d="M12,18 C13,12 19,12 20,18 M16,10 L16,23" fill="none" stroke={accent} strokeWidth="1.6" />
          <polygon points="16,10 19,14 16,18 13,14" fill={gem} />
        </>
      );
    case 'elbeland_Templar_cross':
    case 'dw_elbeland_mist_weave':
    case 'elf_elbeland_moon':
      return (
        <>
          <path d="M16,9 L16,23 M11,15 L21,15" stroke={trim} strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="15" r="2.2" fill={gem} />
        </>
      );
    case 'devias_frost_facets':
    case 'dw_devias_blizzard_fur':
    case 'elf_devias_snow_silk':
    case 'ferea_eternal_ice':
    case 'elf_nixie_crystal':
      return (
        <>
          <polygon points="16,8 21,15 16,23 11,15" fill={accent} fillOpacity="0.45" stroke={trim} strokeWidth="1.4" />
          <circle cx="16" cy="15" r="2.1" fill={gem} stroke="#ffffff" strokeWidth="0.8" />
        </>
      );
    case 'black_dragon_ribs':
    case 'tower_balrog_spikes':
      return (
        <>
          <path d="M11,11 L16,14 L21,11 M11,16 L16,19 L21,16 M12,21 L16,23 L20,21" fill="none" stroke={trim} strokeWidth="1.5" />
          <circle cx="16" cy="14" r="2.1" fill={gem} />
        </>
      );
    case 'dark_phoenix_wings':
    case 'icarus_sky_drake':
    case 'dw_icarus_starlight':
    case 'elf_icarus_feather':
    case 'elf_tower_valkyrie':
    case 'elf_sylphid_divine':
      return (
        <>
          <path d="M10,12 L16,17 L22,12 M11,17 L16,21 L21,17" fill="none" stroke={trim} strokeWidth="1.7" strokeLinecap="round" />
          <polygon points="16,9 19,14 16,19 13,14" fill={gem} />
        </>
      );
    case 'atlans_sea_scales':
    case 'dw_atlans_abyss_coral':
    case 'elf_atlans_siren_shell':
      return (
        <>
          <path d="M11,13 Q16,18 21,13 M11,18 Q16,23 21,18" fill="none" stroke={accent} strokeWidth="1.6" />
          <circle cx="16" cy="13" r="2.2" fill={gem} />
        </>
      );
    case 'tarkan_titan_plates':
    case 'dw_tarkan_storm_sigil':
    case 'elf_tarkan_oasis_gold':
    case 'dw_anubis_hieroglyph':
      return (
        <>
          <polygon points="11,10 21,10 18,16 14,16" fill={trim} fillOpacity="0.65" />
          <circle cx="16" cy="18" r="2.4" fill={gem} stroke={trim} strokeWidth="1" />
        </>
      );
    case 'kanturu_emp_circuit':
    case 'dw_kanturu_relic_matrix':
    case 'elf_crywolf_altar':
      return (
        <>
          <rect x="12.5" y="11.5" width="7" height="7" rx="1" fill="none" stroke={accent} strokeWidth="1.6" />
          <circle cx="16" cy="15" r="2.2" fill={gem} />
        </>
      );
    case 'dw_acheron_pentagram':
    case 'dw_tower_eclipse_sun':
    case 'elf_red_spirit_blossom':
      return (
        <>
          <circle cx="16" cy="15.5" r="4.5" fill="none" stroke={trim} strokeWidth="1.4" />
          <circle cx="16" cy="15.5" r="2.2" fill={gem} />
        </>
      );
    case 'great_titan_aegis':
    case 'dw_kundun_eternity':
    case 'dw_legendary_archmage':
    default:
      return (
        <>
          <polygon points="16,8 21,13 19,22 13,22 11,13" fill={accent} fillOpacity="0.4" stroke={trim} strokeWidth="1.5" />
          <circle cx="16" cy="15" r="2.5" fill={gem} stroke="#ffffff" strokeWidth="1" />
        </>
      );
  }
}

function renderHelmMotifSvg(
  motif: ArmorHelmMotif,
  desc: InventoryItemIconDescriptor
): React.ReactNode {
  const {
    primaryColor: p,
    secondaryColor: s,
    trimColor: trim,
    gemColor: gem,
    hasAncientPurpleGlow: isAnc,
    hasExcellentGreenGlow: isExe,
  } = desc;
  const strokeHighlight = isAnc ? '#c084fc' : isExe ? '#34d399' : trim;

  switch (motif) {
    /* Horned Helms (Black Dragon, Balrog, Kanturu, Crywolf) */
    case 'black_dragon_horns':
    case 'balrog_bull_horns':
    case 'kanturu_titan_visor':
    case 'dw_kanturu_nightmare_helm':
    case 'elf_crywolf_wolf_crown':
      return (
        <>
          {/* Sweeping Demon / Dragon Horns */}
          <path
            d="M8,14 C4,9 4,5 8,4 C7,8 9,10 11,12 M24,14 C28,9 28,5 24,4 C25,8 23,10 21,12"
            fill={trim}
            stroke={strokeHighlight}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M8,14 C8,9 24,9 24,14 L24,25 L19,23 L16,27 L13,23 L8,25 Z"
            fill={p}
            stroke={strokeHighlight}
            strokeWidth="1.8"
          />
          <path d="M11,18 L15,20 M21,18 L17,20" stroke={gem} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16" cy="14" r="2.1" fill={gem} />
        </>
      );

    /* Winged Helms & Valkyrie / Phoenix / Icarus / Sylphid Crowns */
    case 'phoenix_flame_crest':
    case 'icarus_sky_crown':
    case 'elf_valkyrie_winged_helm':
    case 'elf_icarus_cloud_crown':
    case 'elf_sylphid_seraph_crown':
    case 'elf_noria_wing_diadem':
      return (
        <>
          {/* Left & Right Feathered Wing Crests */}
          <path
            d="M8,17 L3,8 L7,10 L6,5 L11,13 M24,17 L29,8 L25,10 L26,5 L21,13"
            fill={trim}
            stroke={strokeHighlight}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M9,14 C9,9 23,9 23,14 L23,24 L18,22 L16,26 L14,22 L9,24 Z"
            fill={p}
            stroke={strokeHighlight}
            strokeWidth="1.8"
          />
          <polygon points="16,7 19,13 16,17 13,13" fill={gem} stroke="#ffffff" strokeWidth="0.8" />
        </>
      );

    /* Royal Spired Crowns & High Mitres (Elbeland, Ferea, Great Titan, Anubis, Legendary, Eclipse, Acheron, Kundun, Siren) */
    case 'elbeland_crown':
    case 'ferea_ice_crown':
    case 'great_titan_halo':
    case 'dw_anubis_jackal_crown':
    case 'dw_legendary_halo_crown':
    case 'dw_tower_eclipse_crown':
    case 'dw_acheron_spire_crown':
    case 'dw_kundun_eternal_mitre':
    case 'elf_atlans_coral_crown':
      return (
        <>
          <path
            d="M5,20 L7,8 L12,14 L16,4 L20,14 L25,8 L27,20 Z"
            fill={p}
            stroke={strokeHighlight}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <rect x="6" y="20" width="20" height="4.5" rx="1.5" fill={s} stroke={strokeHighlight} strokeWidth="1.5" />
          <circle cx="16" cy="14.5" r="2.4" fill={gem} stroke="#ffffff" strokeWidth="0.9" />
          <circle cx="10" cy="16" r="1.4" fill={trim} />
          <circle cx="22" cy="16" r="1.4" fill={trim} />
        </>
      );

    /* Delicate Circlets, Tiaras & Headbands (DW Apprentice, Noria, Devias, Tarkan, Elf Circlets) */
    case 'dw_apprentice_band':
    case 'dw_noria_leaf_circlet':
    case 'dw_elbeland_crescent_diadem':
    case 'dw_devias_frost_crown':
    case 'dw_atlans_pearl_tiara':
    case 'dw_tarkan_oracle_veil':
    case 'dw_icarus_star_diadem':
    case 'elf_grove_circlet':
    case 'elf_elbeland_moon_tiara':
    case 'elf_devias_ice_wreath':
    case 'elf_red_spirit_tiara':
    case 'elf_tarkan_sun_tiara':
    case 'elf_nixie_crystal_diadem':
      return (
        <>
          <path
            d="M5,18 C5,11 27,11 27,18 C24,22 8,22 5,18 Z"
            fill={p}
            stroke={strokeHighlight}
            strokeWidth="1.8"
          />
          <polygon points="16,7 20,14 16,20 12,14" fill={gem} stroke={trim} strokeWidth="1.2" />
          <circle cx="9.5" cy="16" r="1.6" fill={trim} />
          <circle cx="22.5" cy="16" r="1.6" fill={trim} />
        </>
      );

    /* Classic Visored Knight Helms (Lorencia Cap, Noria Warden, Devias Ice Visor, Atlans Fin, Tarkan Mask) */
    case 'cap':
    case 'noria_warden_crest':
    case 'devias_ice_visor':
    case 'atlans_fin_helm':
    case 'tarkan_sand_mask':
    default:
      return (
        <>
          <path d="M16,4 L16,10" stroke={trim} strokeWidth="2.4" strokeLinecap="round" />
          <path
            d="M8,15 C8,9 24,9 24,15 L24,26 L19,23 L16,27 L13,23 L8,26 Z"
            fill={p}
            stroke={strokeHighlight}
            strokeWidth="1.9"
          />
          <path d="M10,17 L22,17 M16,14 L16,23" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16" cy="13" r="2" fill={gem} />
        </>
      );
  }
}

function renderWingArchetypeSvg(
  archetype: WingIconArchetype,
  desc: InventoryItemIconDescriptor
): React.ReactNode {
  const { primaryColor: p, secondaryColor: s, accentColor: accent, trimColor: trim, gemColor: gem } = desc;

  switch (archetype) {
    case 'wings_satan_ii':
      return (
        <>
          {/* Demonic Bat-Membrane Wings of Satan II */}
          <path
            d="M15,19 L11,6 L3,5 L2,14 L7,13 L9,19 L13,18 Z M17,19 L21,6 L29,5 L30,14 L25,13 L23,19 L19,18 Z"
            fill={p}
            stroke={accent}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="16" r="2.2" fill={gem} />
        </>
      );
    case 'wings_heaven_ii':
      return (
        <>
          {/* Feathered Angelic Wings of Heaven II */}
          <path
            d="M15,20 C11,6 3,5 2,13 C4,19 9,23 15,23 Z M17,20 C21,6 29,5 30,13 C28,19 23,23 17,23 Z"
            fill={p}
            stroke={accent}
            strokeWidth="1.7"
          />
          <path d="M13,16 C9,11 5,11 4,16 M19,16 C23,11 27,11 28,16" fill="none" stroke={trim} strokeWidth="1.3" />
          <circle cx="16" cy="15" r="2.2" fill={gem} />
        </>
      );
    case 'wings_elf_ii':
      return (
        <>
          {/* Gossamer Butterfly / Fairy Wings of Elf II */}
          <path
            d="M15,17 C12,4 2,5 3,13 C4,17 9,18 14,18 C8,20 5,26 10,27 C13,27 15,23 15,19 Z M17,17 C20,4 30,5 29,13 C28,17 23,18 18,18 C24,20 27,26 22,27 C19,27 17,23 17,19 Z"
            fill={p}
            stroke={accent}
            strokeWidth="1.6"
          />
          <circle cx="16" cy="16" r="2.2" fill={gem} />
        </>
      );
    case 'wings_storm_iii':
      return (
        <>
          {/* Tier 3 Twin-Pinion Dragon Wings of Storm III */}
          <path
            d="M15,16 L10,3 L2,6 L5,14 L2,21 L10,25 L15,21 Z M17,16 L22,3 L30,6 L27,14 L30,21 L22,25 L17,21 Z"
            fill={p}
            stroke={trim}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M13,13 L5,9 M19,13 L27,9 M13,18 L6,20 M19,18 L26,20" stroke={gem} strokeWidth="1.4" />
          <polygon points="16,9 19,15 16,21 13,15" fill={gem} stroke="#ffffff" strokeWidth="0.9" />
        </>
      );
    case 'wings_eternal_iii':
      return (
        <>
          {/* Tier 3 Six-Winged Seraphim Wings of Eternal III */}
          <circle cx="16" cy="15" r="10" fill="none" stroke={trim} strokeWidth="1.1" strokeOpacity="0.65" />
          <path
            d="M15,18 C11,4 2,4 2,12 C3,19 8,25 15,24 Z M17,18 C21,4 30,4 30,12 C29,19 24,25 17,24 Z"
            fill={p}
            stroke={trim}
            strokeWidth="1.7"
          />
          <path d="M14,14 L4,10 M18,14 L28,10 M14,19 L5,21 M18,19 L27,21" stroke={accent} strokeWidth="1.4" />
          <polygon points="16,8 20,15 16,22 12,15" fill={gem} stroke="#ffffff" strokeWidth="1" />
        </>
      );
    case 'wings_illusion_iii':
    default:
      return (
        <>
          {/* Tier 3 Prism Sylphid Wings of Illusion III */}
          <path
            d="M15,16 C11,2 1,4 2,12 C3,17 9,18 13,19 C6,21 4,27 11,28 C14,28 15,23 15,19 Z M17,16 C21,2 31,4 30,12 C29,17 23,18 19,19 C26,21 28,27 21,28 C18,28 17,23 17,19 Z"
            fill={p}
            stroke={trim}
            strokeWidth="1.7"
          />
          <circle cx="9" cy="11" r="1.7" fill={accent} />
          <circle cx="23" cy="11" r="1.7" fill={accent} />
          <polygon points="16,9 19,15 16,21 13,15" fill={gem} stroke="#ffffff" strokeWidth="0.9" />
        </>
      );
  }
}

export const EquipmentItemIcon: React.FC<EquipmentItemIconProps> = ({
  slot,
  item,
  rarity,
  fallbackClassId = 'dark_knight',
  className = 'h-7 w-7',
}) => {
  // Empty paperdoll slot silhouette when no item is equipped
  if (!item) {
    const emptyStroke =
      rarity === 'ancient'
        ? '#c084fc'
        : rarity === 'excellent'
          ? '#34d399'
          : rarity === 'magic'
            ? '#38bdf8'
            : '#6e665a';
    return (
      <svg
        viewBox="0 0 32 32"
        className={`${className} opacity-55`}
        data-icon-id={`empty_${slot}`}
        aria-hidden="true"
      >
        {slot === 'weapon' && (
          <path
            d="M25,4 L28,7 L13,22 L9,22 L9,18 Z M7,16 L16,25 M5,27 L10,22"
            fill="none"
            stroke={emptyStroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
        {slot === 'armor' && (
          <path
            d="M10,5 L16,8 L22,5 L28,9 L25,15 L22,14 L22,27 L10,27 L10,14 L7,15 L4,9 Z"
            fill="none"
            stroke={emptyStroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        )}
        {slot === 'helm' && (
          <path
            d="M9,15 C9,10 23,10 23,15 L23,25 L18,23 L16,26 L14,23 L9,25 Z"
            fill="none"
            stroke={emptyStroke}
            strokeWidth="1.8"
          />
        )}
        {slot === 'wings' && (
          <path
            d="M15,19 C11,6 3,4 2,12 C3,18 8,23 15,23 Z M17,19 C21,6 29,4 30,12 C29,18 24,23 17,23 Z"
            fill="none"
            stroke={emptyStroke}
            strokeWidth="1.7"
          />
        )}
        {slot === 'ring' && (
          <circle cx="16" cy="17" r="7.5" fill="none" stroke={emptyStroke} strokeWidth="2.2" />
        )}
        {slot === 'pendant' && (
          <>
            <path d="M10,6 C10,14 22,14 22,6" fill="none" stroke={emptyStroke} strokeWidth="1.6" />
            <polygon points="16,12 22,19 16,27 10,19" fill="none" stroke={emptyStroke} strokeWidth="1.8" />
          </>
        )}
      </svg>
    );
  }

  const desc = resolveInventoryItemIconDescriptor(item, fallbackClassId);
  const {
    iconId,
    primaryColor,
    secondaryColor,
    trimColor,
    gemColor,
    hasExcellentGreenGlow,
    hasAncientPurpleGlow,
    upgradeEffect,
  } = desc;

  const glowFilter = hasAncientPurpleGlow
    ? 'drop-shadow(0 0 6px rgba(192, 132, 252, 0.88))'
    : hasExcellentGreenGlow
      ? 'drop-shadow(0 0 6px rgba(52, 211, 153, 0.88))'
      : upgradeEffect.hasBrightPrimaryGlow
        ? `drop-shadow(0 0 5px ${upgradeEffect.primaryGlowColor})`
        : undefined;

  const strokeHighlight = hasAncientPurpleGlow
    ? '#c084fc'
    : hasExcellentGreenGlow
      ? '#34d399'
      : trimColor;

  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      style={glowFilter ? { filter: glowFilter } : undefined}
      data-icon-id={iconId}
      aria-hidden="true"
    >
      {/* WEAPON ICON */}
      {slot === 'weapon' &&
        renderWeaponArchetypeSvg(iconId as WeaponVisualArchetype, desc)}

      {/* ARMOR ICON */}
      {slot === 'armor' && (
        <>
          <path
            d={
              desc.classId === 'dark_wizard'
                ? 'M10,5 L16,8 L22,5 L28,10 L25,16 L22,14 L24,27 L8,27 L10,14 L7,16 L4,10 Z'
                : desc.classId === 'fairy_elf'
                  ? 'M10,5 L16,8 L22,5 L27,9 L24,14 L21,13 L23,27 L9,27 L11,13 L8,14 L5,9 Z'
                  : 'M9,5 L16,8 L23,5 L29,9 L26,15 L22,14 L22,27 L10,27 L10,14 L6,15 L3,9 Z'
            }
            fill={primaryColor}
            fillOpacity="0.82"
            stroke={strokeHighlight}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Inner armor plating / robe lapel shadow */}
          <path
            d="M11,8 L16,12 L21,8 L20,25 L12,25 Z"
            fill={secondaryColor}
            fillOpacity="0.65"
          />
          {renderArmorMotifEmblem(iconId as ArmorChestMotif, desc)}
        </>
      )}

      {/* HELM ICON */}
      {slot === 'helm' &&
        renderHelmMotifSvg(iconId as ArmorHelmMotif, desc)}

      {/* WINGS ICON */}
      {slot === 'wings' &&
        renderWingArchetypeSvg(iconId as WingIconArchetype, desc)}

      {/* RING ICON */}
      {slot === 'ring' && (
        <>
          <circle
            cx="16"
            cy="18.5"
            r="7.8"
            fill={secondaryColor}
            fillOpacity="0.45"
            stroke={primaryColor}
            strokeWidth="2.8"
          />
          <circle
            cx="16"
            cy="18.5"
            r="5.2"
            fill="none"
            stroke={strokeHighlight}
            strokeWidth="1.1"
          />
          <polygon
            points="16,4 21,9 16,13 11,9"
            fill={gemColor}
            stroke="#ffffff"
            strokeWidth="1"
          />
        </>
      )}

      {/* PENDANT ICON */}
      {slot === 'pendant' && (
        <>
          <path
            d="M9,5 C9,14 23,14 23,5"
            fill="none"
            stroke={trimColor}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <polygon
            points="16,10 23,18 16,28 9,18"
            fill={primaryColor}
            stroke={strokeHighlight}
            strokeWidth="1.9"
          />
          <circle cx="16" cy="18.5" r="2.6" fill={gemColor} stroke="#ffffff" strokeWidth="0.9" />
        </>
      )}

      {/* +10..+15 Subtle White Sheen Overlay */}
      {upgradeEffect.hasSubtleWhiteSheen && (
        <ellipse
          cx="15"
          cy="13"
          rx="7"
          ry="4.5"
          transform="rotate(-28 15 13)"
          fill="#ffffff"
          fillOpacity={upgradeEffect.whiteSheenAlpha}
        />
      )}
    </svg>
  );
};

export type SpecialInventoryIconKind =
  | 'bless'
  | 'soul'
  | 'life'
  | 'chaos'
  | 'potion_hp'
  | 'potion_large_hp'
  | 'potion_mp'
  | 'quest'
  | 'blood_scroll'
  | 'blood_fang'
  | 'blood_castle_ticket'
  | 'skill_book';

export const SpecialInventoryIcon: React.FC<{
  kind: SpecialInventoryIconKind;
  classId?: CharacterClassId;
  accentColor?: string;
  className?: string;
}> = ({ kind, classId = 'dark_knight', accentColor = '#f59e0b', className = 'h-7 w-7' }) => {
  switch (kind) {
    case 'bless':
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="jewel_bless" aria-hidden="true">
          {/* Royal Amethyst Octagon Jewel of Bless */}
          <polygon
            points="11,4 21,4 28,11 28,21 21,28 11,28 4,21 4,11"
            fill="#9333ea"
            stroke="#fde047"
            strokeWidth="1.9"
          />
          <polygon
            points="12,8 20,8 24,12 24,20 20,24 12,24 8,20 8,12"
            fill="#c084fc"
          />
          <polygon points="13,10 19,10 16,16" fill="#ffffff" fillOpacity="0.65" />
        </svg>
      );

    case 'soul':
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="jewel_soul" aria-hidden="true">
          {/* Radiant Sapphire Teardrop Jewel of Soul */}
          <path
            d="M16,3 C22,10 27,15 27,21 C27,26.5 22,29 16,29 C10,29 5,26.5 5,21 C5,15 10,10 16,3 Z"
            fill="#0284c7"
            stroke="#e0f2fe"
            strokeWidth="1.8"
          />
          <polygon points="16,8 22,19 16,25 10,19" fill="#38bdf8" />
          <circle cx="14" cy="15" r="2.2" fill="#ffffff" fillOpacity="0.8" />
        </svg>
      );

    case 'life':
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="jewel_life" aria-hidden="true">
          {/* Topaz Sunburst Heart Gem of Life */}
          <polygon
            points="16,3 20,9 28,9 23,16 27,23 19,23 16,29 13,23 5,23 9,16 4,9 12,9"
            fill="#d97706"
            stroke="#fef08a"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="16" r="5.5" fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />
          <path d="M16,12.5 L16,19.5 M12.5,16 L19.5,16" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'chaos':
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="jewel_chaos" aria-hidden="true">
          {/* Jagged Emerald-Gold Chaos Prism */}
          <polygon
            points="16,2 25,8 28,18 21,28 11,28 4,18 7,8"
            fill="#059669"
            stroke="#fde047"
            strokeWidth="1.8"
          />
          <polygon points="16,5 23,15 16,26 9,15" fill="#34d399" />
          <polygon points="16,8 20,15 16,22 12,15" fill="#fef08a" fillOpacity="0.8" />
        </svg>
      );

    case 'potion_hp':
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="potion_hp" aria-hidden="true">
          <rect x="13" y="3" width="6" height="3.5" rx="1" fill="#a87c4f" />
          <path
            d="M12,6.5 L20,6.5 L19,11 L25,18.5 C26.5,23 23,28 16,28 C9,28 5.5,23 7,18.5 L13,11 Z"
            fill="#e11d48"
            stroke="#fecdd3"
            strokeWidth="1.8"
          />
          <rect x="8.5" y="19.5" width="15" height="2" rx="1" fill="#fde047" />
          <circle cx="13" cy="16" r="1.6" fill="#ffffff" fillOpacity="0.7" />
        </svg>
      );

    case 'potion_large_hp':
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="potion_large_hp" aria-hidden="true">
          <rect x="11.5" y="2.5" width="9" height="4" rx="1.2" fill="#f59e0b" />
          <path
            d="M10.5,6.5 L21.5,6.5 L22.5,10.5 L27,18.5 C28,24 23.5,28.5 16,28.5 C8.5,28.5 4,24 5,18.5 L9.5,10.5 Z"
            fill="#dc2626"
            stroke="#fde047"
            strokeWidth="2"
          />
          <path d="M16,14.5 L16,22.5 M12,18.5 L20,18.5" stroke="#fef08a" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'potion_mp':
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="potion_mp" aria-hidden="true">
          <rect x="13" y="3" width="6" height="3.5" rx="1" fill="#a87c4f" />
          <path
            d="M12,6.5 L20,6.5 L19,11 L25,18.5 C26.5,23 23,28 16,28 C9,28 5.5,23 7,18.5 L13,11 Z"
            fill="#0284c7"
            stroke="#bae6fd"
            strokeWidth="1.8"
          />
          <rect x="8.5" y="19.5" width="15" height="2" rx="1" fill="#fde047" />
          <circle cx="13" cy="16" r="1.6" fill="#ffffff" fillOpacity="0.75" />
        </svg>
      );

    case 'quest':
      if (classId === 'dark_wizard') {
        // Soul Shard of the Prophet
        return (
          <svg viewBox="0 0 32 32" className={className} data-icon-id="quest_relic_dw" aria-hidden="true">
            <polygon
              points="16,2 25,11 21,29 11,29 7,11"
              fill="#38bdf8"
              stroke="#fde047"
              strokeWidth="1.9"
            />
            <polygon points="16,5 21,13 16,26 11,13" fill="#e0f2fe" fillOpacity="0.7" />
          </svg>
        );
      }
      if (classId === 'fairy_elf') {
        // Tear of the Elf Goddess
        return (
          <svg viewBox="0 0 32 32" className={className} data-icon-id="quest_relic_elf" aria-hidden="true">
            <path
              d="M16,3 C22,11 26,16 26,21 C26,26 21.5,29 16,29 C10.5,29 6,26 6,21 C6,16 10,11 16,3 Z"
              fill="#10b981"
              stroke="#fde047"
              strokeWidth="1.9"
            />
            <circle cx="16" cy="20" r="4" fill="#a7f3d0" />
          </svg>
        );
      }
      // Emperor Scroll / Broken Sword Relic (Dark Knight)
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="quest_relic_dk" aria-hidden="true">
          <rect x="7" y="5" width="18" height="22" rx="3" fill="#b45309" stroke="#fde047" strokeWidth="1.9" />
          <line x1="11" y1="11" x2="21" y2="11" stroke="#fef08a" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="11" y1="16" x2="21" y2="16" stroke="#fef08a" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16" cy="22" r="2.6" fill="#ef4444" stroke="#fde047" strokeWidth="1" />
        </svg>
      );

    case 'blood_scroll':
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="blood_scroll" aria-hidden="true">
          <path
            d="M8,6 L24,6 L22,26 L6,26 Z"
            fill="#7f1d1d"
            stroke="#f87171"
            strokeWidth="1.8"
          />
          <rect x="6" y="4" width="20" height="3.5" rx="1.5" fill="#d4a853" />
          <rect x="4" y="24.5" width="20" height="3.5" rx="1.5" fill="#d4a853" />
          <circle cx="15" cy="16" r="3.5" fill="#ef4444" stroke="#fde047" strokeWidth="1.2" />
        </svg>
      );

    case 'blood_fang':
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="blood_fang" aria-hidden="true">
          <path
            d="M9,5 L19,7 C23,15 21,24 11,28 C14,21 13,13 9,5 Z"
            fill="#fef3c7"
            stroke="#ef4444"
            strokeWidth="1.8"
          />
          <path d="M8,5 L20,7 L18,11 L8,9 Z" fill="#d97706" stroke="#fde047" strokeWidth="1.2" />
        </svg>
      );

    case 'blood_castle_ticket':
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="blood_castle_ticket" aria-hidden="true">
          {/* Invisibility Cloak / Blood Castle Pass */}
          <path
            d="M10,5 L16,8 L22,5 L27,13 L25,27 L7,27 L5,13 Z"
            fill="#881337"
            stroke="#fde047"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="11" r="2.6" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
          <path d="M12,17 L16,23 L20,17" fill="none" stroke="#fde047" strokeWidth="1.6" />
        </svg>
      );

    case 'skill_book':
    default:
      return (
        <svg viewBox="0 0 32 32" className={className} data-icon-id="skill_book" aria-hidden="true">
          <rect
            x="6"
            y="4"
            width="20"
            height="24"
            rx="2.5"
            fill="#1e1b4b"
            stroke={accentColor}
            strokeWidth="2"
          />
          <line x1="10" y1="4" x2="10" y2="28" stroke="#fde047" strokeWidth="1.6" />
          <polygon
            points="18,10 22,16 18,22 14,16"
            fill={accentColor}
            stroke="#ffffff"
            strokeWidth="1"
          />
        </svg>
      );
  }
};
