import React, { useEffect, useRef, useState } from 'react';
import { computeExpBarProgress } from '../game/rules';
import { ClassTier, PlayerProgressState, SkillDefinition } from '../game/types';
import { HudDomRefs } from './HudOverlay';
import {
  CrystalGlobe,
  DragonHeadOrnament,
  MuUtilityIcon,
  PotionBottleIcon,
  SkillSvgIcon,
} from './MuIcons';

interface MobileControlsProps {
  player: PlayerProgressState;
  hudRefs: HudDomRefs;
  skills: SkillDefinition[];
  classTier: ClassTier;
  playerLevel: number;
  learnedSkills: string[];
  hasWeapon: boolean;
  cooldowns: Record<string, number>;
  hpPotions: number;
  mpPotions: number;
  autoHunt: boolean;
  nearbyLootCount: number;
  comboStage: number;
  isNearShop: boolean;
  partyMemberCount: number;
  onJoystickMove: (dx: number, dy: number) => void;
  onPrimaryAttack: () => void;
  onUseSkill: (skillIndex: number) => void;
  onUseHpPotion: () => void;
  onUseMpPotion: () => void;
  onApproachShop: () => void;
  onPickupLoot: () => void;
  onToggleAutoHunt: () => void;
  onDash: () => void;
  onOpenStats: () => void;
  onOpenInventory: () => void;
  onOpenChaosMachine: () => void;
  onOpenTerritory: () => void;
  onOpenPartyModal: () => void;
}

/**
 * Classic MU Online Season 1 Full-Width Gothic Bottom Action Bar
 * - Left Dragon Head + Live Coords (147 139)
 * - Faceted Ruby Red HP Crystal Globe (vertical liquid fill) + numeric HP
 * - Center Ornate Dark-Iron Console:
 *     - Top 10-Segment Golden EXP Bar + Level Medallion (flashes golden on Level Up!)
 *     - Quick Potion/Loot Slots (Q, E, F)
 *     - Active Skill Slots (Space + 1..4) with handcrafted MU Skill SVG icons
 *     - Embossed Metallic Utility Buttons (C, V, K, T, O, B)
 * - Faceted Sapphire Blue MP Crystal Globe + Purple Vertical AG/Dash Vial
 * - Right Mirrored Dragon Head + Crossed Swords Auto-Hunt (]) Toggle
 * - Touch Virtual Joystick floating cleanly above bottom-left on mobile/tablet
 */
export const MobileControls: React.FC<MobileControlsProps> = ({
  player,
  hudRefs,
  skills,
  classTier,
  playerLevel,
  learnedSkills,
  hasWeapon,
  cooldowns,
  hpPotions,
  mpPotions,
  autoHunt,
  nearbyLootCount,
  comboStage,
  isNearShop,
  partyMemberCount,
  onJoystickMove,
  onPrimaryAttack,
  onUseSkill,
  onUseHpPotion,
  onUseMpPotion,
  onApproachShop,
  onPickupLoot,
  onToggleAutoHunt,
  onDash,
  onOpenStats,
  onOpenInventory,
  onOpenChaosMachine,
  onOpenTerritory,
  onOpenPartyModal,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [levelFlash, setLevelFlash] = useState(false);
  const prevLevelRef = useRef(player.level);

  useEffect(() => {
    if (player.level > prevLevelRef.current) {
      setLevelFlash(true);
      const timer = window.setTimeout(() => setLevelFlash(false), 1500);
      prevLevelRef.current = player.level;
      return () => window.clearTimeout(timer);
    }
    prevLevelRef.current = player.level;
  }, [player.level]);

  const updateJoystickFromPoint = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const maxRadius = Math.max(24, rect.width * 0.39);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobOffset({ x: dx, y: dy });
    onJoystickMove(dx / maxRadius, dy / maxRadius);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    activePointerId.current = e.pointerId;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    updateJoystickFromPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoystickFromPoint(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onJoystickMove(0, 0);
  };

  const { totalPct: expPct, segmentDigit: expSegmentIdx } = computeExpBarProgress(
    player.exp,
    player.expToNext
  );
  const autoHuntUnlocked = playerLevel >= 5;

  return (
    <>
      {/* Touch / Mobile Floating Virtual Joystick (hidden on wide desktop so desktop matches classic MU clean viewport) */}
      <div className="mu-joystick-wrap-compact pointer-events-none fixed bottom-[106px] left-4 z-30 lg:hidden select-none touch-none">
        <div
          ref={padRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="mu-joystick-pad-compact pointer-events-auto relative w-24 h-24 rounded-full bg-[#0d0a12]/65 border border-[#a8874e]/45 backdrop-blur-sm flex items-center justify-center shadow-lg"
          aria-label="Виртуальный джойстик движения"
        >
          <div className="mu-joystick-ring-compact w-11 h-11 rounded-full border border-white/10" />
          <div
            className="mu-joystick-knob-compact absolute w-10 h-10 rounded-full bg-gradient-to-br from-[#e2be72] to-[#8a6526] border border-[#fef3c7]/60 shadow-[0_0_12px_rgba(212,168,83,0.55)]"
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          />
        </div>
      </div>

      {/* CLASSIC MU ONLINE BOTTOM GOTHIC ACTION DOCK */}
      <div
        data-testid="mu-classic-hud-bar"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center select-none"
      >
        <div className="pointer-events-auto relative w-full max-w-[1160px] bg-gradient-to-b from-[#231d19] via-[#13100f] to-[#080707] border-t-2 border-x border-[#7d6644] shadow-[0_-8px_32px_rgba(0,0,0,0.92)]">
          {/* Ornate Gothic Top Rim Accent Line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#2c231b] via-[#c7a461]/70 to-[#2c231b]" />

          {/* Main Dock Content Row */}
          <div className="mu-dock-row-compact relative flex items-end justify-between gap-1 sm:gap-2 px-1.5 sm:px-2.5 pt-1 pb-1.5">
            {/* ===== FAR LEFT WING: Dragon Head Ornament + Recessed Coordinates Box ===== */}
            <div className="mu-dock-wing-compact hidden lg:flex flex-col items-start justify-end w-[96px] lg:w-[112px] shrink-0 relative">
              <DragonHeadOrnament
                side="left"
                className="w-[104px] lg:w-[118px] h-[54px] -mt-7 -ml-2 pointer-events-none drop-shadow-[0_3px_6px_rgba(0,0,0,0.95)]"
              />
              <div
                className="w-full bg-[#090809] border border-[#5c4c36] shadow-[inset_0_2px_6px_rgba(0,0,0,0.95)] px-2 py-0.5 text-center"
                title="Координаты героя на карте"
              >
                <span
                  ref={hudRefs.coordsTextRef}
                  data-testid="hero-coords-display"
                  className="font-mono text-[11px] font-bold tracking-widest text-[#d9ccb2]"
                >
                  128 128
                </span>
              </div>
            </div>

            {/* ===== LEFT CRYSTAL ORB: Ruby Red HP Globe + Numeric HP ===== */}
            <div className="mu-orb-wrap-compact flex items-end gap-1 sm:gap-1.5 shrink-0 -mt-5 sm:-mt-6">
              <div className="flex flex-col items-center">
                <CrystalGlobe
                  variant="hp"
                  barRef={hudRefs.hpBarRef}
                  ghostBarRef={hudRefs.hpGhostBarRef}
                  sizeClassName="mu-orb-compact w-[48px] h-[48px] sm:w-[66px] sm:h-[66px]"
                  label="Сфера здоровья (HP)"
                />
                <span
                  ref={hudRefs.hpTextRef}
                  data-testid="hud-hp-value"
                  className="mu-orb-label-compact mt-0.5 font-mono text-[11px] sm:text-xs font-extrabold text-[#f5ecd6] drop-shadow-[0_1px_2px_rgba(0,0,0,1)] leading-none"
                >
                  —
                </span>
              </div>
            </div>

            {/* ===== CENTER GOTHIC IRON CONSOLE: 10-Segment EXP Bar + Potions + Skills + Utility Icons ===== */}
            <div className="mu-center-console-compact flex-1 min-w-0 flex flex-col gap-1.5 px-1 sm:px-2">
              {/* TOP STRIP: Classic MU 10-Segment Golden EXP Bar (0..100%) + Tens Digit (0..9) */}
              <div
                className={`flex items-center gap-1.5 transition-all duration-300 ${
                  levelFlash ? 'drop-shadow-[0_0_12px_rgba(250,204,21,0.95)]' : ''
                }`}
                title={`Опыт до Ур. ${player.level + 1}: ${player.exp.toLocaleString()} / ${player.expToNext.toLocaleString()} (${expPct.toFixed(1)}% · цифра ${expSegmentIdx} = ${expSegmentIdx * 10}%)`}
              >
                <div className="mu-exp-bar-compact relative flex-1 h-[10px] bg-[#0a0809] border border-[#6e593a] shadow-[inset_0_1px_4px_rgba(0,0,0,0.95)] overflow-hidden">
                  {/* Golden EXP Fill (0..100% progress to next level) */}
                  <div
                    data-testid="exp-bar-fill"
                    className={`h-full transition-all duration-200 ${
                      levelFlash
                        ? 'bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-300'
                        : 'bg-gradient-to-r from-[#8f641b] via-[#e6b94c] to-[#fef08a]'
                    }`}
                    style={{ width: `${expPct}%` }}
                  />
                  {/* Classic 10-Segment Metallic Dividers (10% each) */}
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-10">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="border-r border-black/75 last:border-r-0"
                      />
                    ))}
                  </div>
                </div>

                {/* Classic MU EXP Tens-Digit Medallion: 0=0%, 1=10%, 3=30%, ..., 9=90% */}
                <div
                  data-testid="exp-segment-digit"
                  className={`mu-exp-digit-compact shrink-0 min-w-[24px] h-[18px] px-1 rounded-full border flex items-center justify-center font-mono text-[10px] font-extrabold transition-colors ${
                    levelFlash
                      ? 'bg-amber-300 border-yellow-100 text-black scale-110'
                      : 'bg-[#1a1410] border-[#a8874e] text-[#fde68a]'
                  }`}
                  title={`Прогресс опыта: ${expPct.toFixed(1)}% (цифра ${expSegmentIdx} означает ${expSegmentIdx * 10}% опыта до следующего уровня)`}
                >
                  {expSegmentIdx}
                </div>
              </div>

              {/* BOTTOM ROW: Quick Potions (Q/E/F) + Skills (Space/1-4) + Classic Embossed Utility Buttons (C/V/K/T/O/B) */}
              <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
                {/* QUICK CONSUMABLES & LOOT (Q, E, F) */}
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={onUseHpPotion}
                    className="mu-slot-compact relative w-9 h-9 sm:w-11 sm:h-11 bg-[#0b090c] hover:bg-[#191316] active:scale-95 border-2 border-[#6e5a3e] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] flex items-center justify-center cursor-pointer transition-colors"
                    title="Выпить Красное Зелье HP [Q]"
                    aria-label="Зелье здоровья Q"
                  >
                    <PotionBottleIcon variant="hp" className="mu-slot-icon-compact w-6 h-6 sm:w-8 sm:h-8" />
                    <span className="absolute top-0 right-0.5 font-mono text-[9px] sm:text-[10px] font-extrabold text-[#fef08a] drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
                      {hpPotions}
                    </span>
                    <span className="absolute bottom-0 left-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-[#d4c4a1]">
                      Q
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onUseMpPotion}
                    className="mu-slot-compact relative w-9 h-9 sm:w-11 sm:h-11 bg-[#0b090c] hover:bg-[#141422] active:scale-95 border-2 border-[#6e5a3e] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] flex items-center justify-center cursor-pointer transition-colors"
                    title="Выпить Синее Зелье MP [E]"
                    aria-label="Зелье маны E"
                  >
                    <PotionBottleIcon variant="mp" className="mu-slot-icon-compact w-6 h-6 sm:w-8 sm:h-8" />
                    <span className="absolute top-0 right-0.5 font-mono text-[9px] sm:text-[10px] font-extrabold text-[#fef08a] drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
                      {mpPotions}
                    </span>
                    <span className="absolute bottom-0 left-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-[#d4c4a1]">
                      E
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onPickupLoot}
                    className={`mu-slot-compact relative w-9 h-9 sm:w-11 sm:h-11 bg-[#0b090c] active:scale-95 border-2 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)] flex items-center justify-center cursor-pointer transition-colors ${
                      nearbyLootCount > 0
                        ? 'border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                        : 'border-[#5a4a35] text-slate-400 hover:text-amber-200'
                    }`}
                    title="Подобрать ближайший лут [F]"
                    aria-label="Подобрать лут F"
                  >
                    <MuUtilityIcon kind="loot" className="mu-util-icon-compact w-4 h-4 sm:w-5 sm:h-5" />
                    {nearbyLootCount > 0 && (
                      <span className="absolute top-0 right-0.5 font-mono text-[9px] sm:text-[10px] font-extrabold text-amber-300">
                        {nearbyLootCount}
                      </span>
                    )}
                    <span className="absolute bottom-0 left-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-[#d4c4a1]">
                      F
                    </span>
                  </button>
                </div>

                {/* CENTER SKILL SLOTS: Primary Attack + 4 Class Skills with Custom MU SVG Icons */}
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 px-0.5 sm:px-1 py-0.5 bg-[#080709]/85 border border-[#4a3c2b]">
                  {/* Primary Attack Slot */}
                  <button
                    type="button"
                    onClick={onPrimaryAttack}
                    className="mu-slot-compact relative w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-b from-[#231b16] to-[#0c0908] hover:brightness-125 active:scale-95 border-2 border-[#a8874e] shadow-[inset_0_1px_5px_rgba(0,0,0,0.9)] flex items-center justify-center cursor-pointer"
                    title={hasWeapon ? 'Обычная атака [Space]' : 'Удар кулаком [Space]'}
                    aria-label="Обычная атака"
                  >
                    <SkillSvgIcon
                      skillId="primary_attack"
                      classId={player.classId}
                      hasWeapon={hasWeapon}
                      className="mu-slot-icon-compact w-6 h-6 sm:w-8 sm:h-8"
                    />
                    <span className="absolute bottom-0 left-0.5 font-mono text-[7px] sm:text-[8px] font-bold text-[#e2c68a]">
                      SPC
                    </span>
                  </button>

                  {skills.map((skill, idx) => {
                    const isLearned = learnedSkills.includes(skill.id);
                    const tierLocked = classTier < (skill.requiredTier ?? 1);
                    const levelLocked = playerLevel < skill.requiredLevel;
                    const locked = !isLearned || tierLocked || levelLocked;
                    const cd = cooldowns[skill.id] ?? 0;
                    const cdRatio =
                      skill.cooldownSec > 0 ? Math.min(1, cd / skill.cooldownSec) : 0;
                    const isComboNext =
                      !locked &&
                      ((comboStage === 1 && idx === 1) || (comboStage === 2 && idx === 2));

                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => onUseSkill(idx)}
                        className={`mu-slot-compact relative w-9 h-9 sm:w-11 sm:h-11 active:scale-95 border-2 overflow-hidden flex items-center justify-center cursor-pointer transition-all ${
                          locked
                            ? 'bg-[#09080a] border-[#3d342c] opacity-55'
                            : isComboNext
                              ? 'bg-[#2a1d0b] border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.75)]'
                              : cd > 0
                                ? 'bg-[#120f14] border-[#574939]'
                                : 'bg-gradient-to-b from-[#1e1922] to-[#0a080d] border-[#8c7248] hover:border-[#e0bd72]'
                        }`}
                        title={`${skill.name} [${skill.keyBinding}] · ${skill.manaCost} MP — ${skill.roleClue}`}
                        aria-label={`Навык ${skill.name}`}
                      >
                        <SkillSvgIcon
                          skillId={skill.id}
                          classId={player.classId}
                          className={`mu-slot-icon-compact w-6 h-6 sm:w-8 sm:h-8 ${locked ? 'grayscale opacity-50' : ''}`}
                        />

                        {/* Cooldown vertical dark sweep */}
                        {cd > 0 && !locked && (
                          <div
                            className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/72"
                            style={{ height: `${cdRatio * 100}%` }}
                          />
                        )}

                        {/* Cooldown seconds or Lock indicator */}
                        {cd > 0 && !locked && (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] sm:text-xs font-extrabold text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                            {cd.toFixed(1)}
                          </span>
                        )}

                        {locked && (
                          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/80 text-[7px] sm:text-[8px] font-bold text-amber-300/90 text-center leading-tight py-[1px]">
                            {tierLocked
                              ? 'Проф.'
                              : levelLocked
                                ? `Ур.${skill.requiredLevel}`
                                : 'Книга'}
                          </span>
                        )}

                        {/* Keybind number bottom-left (classic MU style) */}
                        <span className="pointer-events-none absolute bottom-0 left-0.5 font-mono text-[8px] sm:text-[9px] font-extrabold text-[#fef3c7] drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
                          {skill.keyBinding}
                        </span>

                        {/* Mana cost top-right */}
                        {!locked && (
                          <span className="pointer-events-none absolute top-0 right-0.5 font-mono text-[7px] sm:text-[8px] font-bold text-sky-300 drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
                            {skill.manaCost}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* CLASSIC MU EMBOSSED METALLIC UTILITY BUTTONS (C, V, K, T, O, B + Mobile AUTO) */}
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={onOpenStats}
                    className={`mu-util-compact relative w-8 h-8 sm:w-10 sm:h-10 border-2 active:scale-95 flex items-center justify-center cursor-pointer transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.75)] ${
                      player.statPoints > 0
                        ? 'bg-gradient-to-b from-[#6b5228] to-[#2e2210] border-amber-300 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                        : 'bg-gradient-to-b from-[#463d34] to-[#1e1a17] border-[#8b7656] hover:brightness-125 text-[#dfd0b2]'
                    }`}
                    title="Персонаж и Статы [C]"
                    aria-label="Персонаж и характеристики"
                  >
                    <MuUtilityIcon kind="stats" className="mu-util-icon-compact w-4 h-4 sm:w-5 sm:h-5" />
                    {player.statPoints > 0 && (
                      <span className="absolute -top-1 -right-1 px-1 min-w-[14px] h-[14px] rounded-full bg-amber-400 text-[#0c0907] font-mono text-[8px] font-black flex items-center justify-center">
                        +{player.statPoints}
                      </span>
                    )}
                    <span className="absolute bottom-0 left-0.5 font-mono text-[7px] sm:text-[8px] font-bold opacity-85">
                      C
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenInventory}
                    className="mu-util-compact relative w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-b from-[#463d34] to-[#1e1a17] hover:brightness-125 active:scale-95 border-2 border-[#8b7656] text-[#dfd0b2] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.75)] flex items-center justify-center cursor-pointer"
                    title="Инвентарь и Экипировка [V]"
                    aria-label="Инвентарь"
                  >
                    <MuUtilityIcon kind="inventory" className="mu-util-icon-compact w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="absolute bottom-0 left-0.5 font-mono text-[7px] sm:text-[8px] font-bold opacity-85">
                      V
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenChaosMachine}
                    className="mu-util-compact relative w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-b from-[#463d34] to-[#1e1a17] hover:brightness-125 active:scale-95 border-2 border-[#8b7656] text-[#f3c677] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.75)] flex items-center justify-center cursor-pointer"
                    title="Кузница Хаоса и Blood Castle [K]"
                    aria-label="Кузница Хаоса"
                  >
                    <MuUtilityIcon kind="chaos" className="mu-util-icon-compact w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="absolute bottom-0 left-0.5 font-mono text-[7px] sm:text-[8px] font-bold opacity-85">
                      K
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenTerritory}
                    className="mu-util-compact relative w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-b from-[#463d34] to-[#1e1a17] hover:brightness-125 active:scale-95 border-2 border-[#8b7656] text-[#dfd0b2] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.75)] flex items-center justify-center cursor-pointer"
                    title="Карта 24 Континентов [T]"
                    aria-label="Карта континентов"
                  >
                    <MuUtilityIcon kind="map" className="mu-util-icon-compact w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="absolute bottom-0 left-0.5 font-mono text-[7px] sm:text-[8px] font-bold opacity-85">
                      T
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenPartyModal}
                    className={`mu-util-compact relative w-8 h-8 sm:w-10 sm:h-10 active:scale-95 border-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.75)] flex items-center justify-center cursor-pointer ${
                      partyMemberCount > 1
                        ? 'bg-gradient-to-b from-[#1f4d4b] to-[#0f2626] border-teal-400 text-teal-200'
                        : 'bg-gradient-to-b from-[#463d34] to-[#1e1a17] hover:brightness-125 border-[#8b7656] text-[#dfd0b2]'
                    }`}
                    title="Онлайн Группа / Пати [O]"
                    aria-label="Онлайн группа"
                  >
                    <MuUtilityIcon kind="party" className="mu-util-icon-compact w-4 h-4 sm:w-5 sm:h-5" />
                    {partyMemberCount > 0 && (
                      <span className="absolute top-0 right-0.5 font-mono text-[7px] sm:text-[8px] font-extrabold text-teal-200">
                        {partyMemberCount}
                      </span>
                    )}
                    <span className="absolute bottom-0 left-0.5 font-mono text-[7px] sm:text-[8px] font-bold opacity-85">
                      O
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onApproachShop}
                    className={`mu-util-compact relative w-8 h-8 sm:w-10 sm:h-10 active:scale-95 border-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.75)] flex items-center justify-center cursor-pointer ${
                      isNearShop
                        ? 'bg-gradient-to-b from-[#1e5237] to-[#0d281a] border-emerald-400 text-emerald-200'
                        : 'bg-gradient-to-b from-[#463d34] to-[#1e1a17] hover:brightness-125 border-[#8b7656] text-[#dfd0b2]'
                    }`}
                    title="Магазин Кузнеца Ханзо [B]"
                    aria-label="Магазин Ханзо"
                  >
                    <MuUtilityIcon kind="shop" className="mu-util-icon-compact w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="absolute bottom-0 left-0.5 font-mono text-[7px] sm:text-[8px] font-bold opacity-85">
                      B
                    </span>
                  </button>

                  {/* Compact Mobile/Tablet Auto-Hunt Toggle (shown when side Dragon Wing is hidden) */}
                  <button
                    type="button"
                    onClick={onToggleAutoHunt}
                    className={`mu-util-compact mu-dock-mobile-auto lg:hidden relative w-8 h-8 sm:w-10 sm:h-10 active:scale-95 border-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.75)] flex items-center justify-center cursor-pointer ${
                      autoHunt
                        ? 'bg-gradient-to-b from-[#7a5216] to-[#362208] border-amber-300 text-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                        : autoHuntUnlocked
                          ? 'bg-gradient-to-b from-[#463d34] to-[#1e1a17] border-[#8b7656] text-[#dfd0b2]'
                          : 'bg-[#1a1617] border-[#42372c] text-slate-500'
                    }`}
                    title={
                      autoHuntUnlocked
                        ? 'Переключить Авто-бой'
                        : 'Авто-бой открывается на 5 уровне'
                    }
                    aria-label="Авто-бой"
                  >
                    <MuUtilityIcon kind="swords" className="mu-util-icon-compact w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* ===== RIGHT CRYSTAL ORB: Sapphire Blue MP Globe + Purple Vertical AG/Dash Tube ===== */}
            <div className="mu-orb-wrap-compact flex items-end gap-1 sm:gap-2 shrink-0 -mt-5 sm:-mt-6">
              <div className="flex flex-col items-center">
                <CrystalGlobe
                  variant="mp"
                  barRef={hudRefs.mpBarRef}
                  sizeClassName="mu-orb-compact w-[48px] h-[48px] sm:w-[66px] sm:h-[66px]"
                  label="Сфера маны (MP)"
                />
                <span
                  ref={hudRefs.mpTextRef}
                  data-testid="hud-mp-value"
                  className="mu-orb-label-compact mt-0.5 font-mono text-[11px] sm:text-xs font-extrabold text-[#cfe8ff] drop-shadow-[0_1px_2px_rgba(0,0,0,1)] leading-none"
                >
                  —
                </span>
              </div>

              {/* Classic MU Vertical Purple AG / Stamina Dash Vial */}
              <button
                type="button"
                onClick={onDash}
                className="flex flex-col items-center cursor-pointer group"
                title="AG / Рывок [Shift]"
                aria-label="Рывок AG Shift"
              >
                <div className="mu-ag-vial-compact relative w-[14px] sm:w-[17px] h-[48px] sm:h-[64px] bg-[#100a14] border-2 border-[#7b6545] shadow-[inset_0_0_8px_rgba(0,0,0,0.95)] overflow-hidden p-[1px]">
                  <div
                    ref={hudRefs.agBarRef}
                    className="w-full h-full origin-bottom bg-gradient-to-t from-[#581c87] via-[#9333ea] to-[#e879f9] group-hover:brightness-125"
                    style={{ transform: 'scaleY(1)' }}
                  />
                  {/* Glass highlight stripe */}
                  <div className="pointer-events-none absolute inset-y-0 left-[2px] w-[2px] bg-white/30" />
                </div>
                <span
                  ref={hudRefs.agTextRef}
                  className="mu-ag-label-compact mt-0.5 font-mono text-[10px] font-extrabold text-fuchsia-300 drop-shadow-[0_1px_2px_rgba(0,0,0,1)] leading-none"
                >
                  100
                </span>
              </button>
            </div>

            {/* ===== FAR RIGHT WING: Mirrored Dragon Head + Crossed Swords Auto-Hunt Button ===== */}
            <div className="mu-dock-wing-compact hidden lg:flex flex-col items-end justify-end w-[96px] lg:w-[112px] shrink-0 relative">
              <DragonHeadOrnament
                side="right"
                className="w-[104px] lg:w-[118px] h-[54px] -mt-7 -mr-2 pointer-events-none drop-shadow-[0_3px_6px_rgba(0,0,0,0.95)]"
              />
              <button
                type="button"
                onClick={onToggleAutoHunt}
                className={`w-full h-[24px] border flex items-center justify-center gap-1.5 text-[10px] font-bold cursor-pointer transition-all shadow-[inset_0_1px_4px_rgba(0,0,0,0.85)] ${
                  autoHunt
                    ? 'bg-amber-600/35 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.45)]'
                    : autoHuntUnlocked
                      ? 'bg-[#171312] hover:bg-[#27201d] border-[#6e5a3e] text-[#dfd0b2]'
                      : 'bg-[#100e0f] border-[#42372c] text-slate-500'
                }`}
                title={
                  autoHuntUnlocked
                    ? 'Переключить Авто-бой [ ] ]'
                    : 'Авто-бой открывается на 5 уровне'
                }
                aria-label="Авто-бой"
              >
                <MuUtilityIcon kind="swords" className="w-3.5 h-3.5" />
                <span className="font-mono">
                  {autoHunt ? 'AUTO' : autoHuntUnlocked ? 'AUTO ]' : 'Ур.5'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
