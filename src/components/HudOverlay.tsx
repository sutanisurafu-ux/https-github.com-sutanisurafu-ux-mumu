import React, { useEffect, useState } from 'react';
import {
  Map as MapIcon,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  MessageSquare,
  Send,
  Users,
  Handshake,
  Compass,
  Clock,
  Shield,
  Maximize2,
} from 'lucide-react';
import { TERRITORIES, getClassDisplayTitle } from '../game/rules';
import {
  PARTY_EXP_RANGE_METERS,
  getWorldGameTimeSec,
  worldDistanceToMeters,
} from '../game/party';
import { getNextGoldenBossSpawnSec } from '../game/worldMonsters';
import { requestMobileLandscapeFullscreen } from '../utils/mobileOrientation';
import {
  ActivePartyState,
  BloodCastleStage,
  PartyChatMessage,
  PartyInvitePayload,
  PartyMemberState,
  PlayerProgressState,
} from '../game/types';
import { ServerOnlineWidget } from './ServerOnlineWidget';

function formatWorldClock(): string {
  const sec = Math.floor(getWorldGameTimeSec());
  const hh = String(Math.floor((sec / 3600) % 24)).padStart(2, '0');
  const mm = String(Math.floor((sec / 60) % 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatGoldenBossCountdown(): string {
  const nowSec = getWorldGameTimeSec();
  const nextSec = getNextGoldenBossSpawnSec(nowSec);
  const rem = Math.max(0, Math.ceil(nextSec - nowSec));
  const mm = String(Math.floor(rem / 60)).padStart(2, '0');
  const ss = String(rem % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export interface BloodCastleHudInfo {
  active: boolean;
  stage: BloodCastleStage;
  kills: number;
  targetKills: number;
  hasArchangelWeapon: boolean;
  timeRemainingSec?: number;
  timeLimitSec?: number;
}

export interface HudDomRefs {
  hpBarRef: React.RefObject<HTMLDivElement | null>;
  hpGhostBarRef: React.RefObject<HTMLDivElement | null>;
  hpTextRef: React.RefObject<HTMLSpanElement | null>;
  mpBarRef: React.RefObject<HTMLDivElement | null>;
  mpTextRef: React.RefObject<HTMLSpanElement | null>;
  agBarRef?: React.RefObject<HTMLDivElement | null>;
  agTextRef?: React.RefObject<HTMLSpanElement | null>;
  coordsTextRef?: React.RefObject<HTMLSpanElement | null>;
  minimapCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  lowHpVignetteRef: React.RefObject<HTMLDivElement | null>;
}

interface HudOverlayProps {
  player: PlayerProgressState;
  hudRefs: HudDomRefs;
  muted: boolean;
  bossActiveName: string | null;
  bossHpPct: number;
  bloodCastleInfo: BloodCastleHudInfo | null;
  partySelfId: string | null;
  partyRoomCode: string | null;
  partyConnected: boolean;
  partyMembers: PartyMemberState[];
  activeParty: ActivePartyState | null;
  pendingPartyInvite: PartyInvitePayload | null;
  zoneChatMessages: PartyChatMessage[];
  chatInputRef: React.RefObject<HTMLInputElement | null>;
  chatOpen: boolean;
  onSetChatOpen: (open: boolean) => void;
  onSendZoneChat: (text: string) => void;
  onRespondPartyInvite: (inviteId: string, accept: boolean) => void;
  onInviteToParty: (targetId: string) => void;
  onRequestTradeWithAlly: (ally: PartyMemberState) => void;
  onOpenPartyModal: () => void;
  onTeleportToAlly: (ally: PartyMemberState) => void;
  onExitBloodCastle: () => void;
  onOpenStats: () => void;
  onOpenInventory: () => void;
  onOpenChaosMachine: () => void;
  onOpenTerritory: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  player,
  hudRefs,
  muted,
  bossActiveName,
  bossHpPct,
  bloodCastleInfo,
  partySelfId,
  partyConnected,
  partyMembers,
  activeParty,
  pendingPartyInvite,
  zoneChatMessages,
  chatInputRef,
  chatOpen,
  onSetChatOpen,
  onSendZoneChat,
  onRespondPartyInvite,
  onRequestTradeWithAlly,
  onOpenPartyModal,
  onTeleportToAlly,
  onExitBloodCastle,
  onOpenTerritory,
  onToggleMute,
  onTogglePause,
  onRestart,
}) => {
  const [chatDraft, setChatDraft] = useState('');
  const [worldClock, setWorldClock] = useState(() => formatWorldClock());
  const [goldenBossCountdown, setGoldenBossCountdown] = useState(() => formatGoldenBossCountdown());
  const territory = TERRITORIES.find((t) => t.id === player.territoryId) ?? TERRITORIES[0];
  const classTitle = getClassDisplayTitle(player.classId, player.classTier);

  useEffect(() => {
    const id = window.setInterval(() => {
      setWorldClock(formatWorldClock());
      setGoldenBossCountdown(formatGoldenBossCountdown());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const visibleChatMessages = zoneChatMessages.slice(-6);
  const bcRemainingSec = bloodCastleInfo?.active
    ? Math.max(0, Math.ceil(bloodCastleInfo.timeRemainingSec ?? 180))
    : 0;
  const bcMin = Math.floor(bcRemainingSec / 60);
  const bcSec = bcRemainingSec % 60;
  const bcTimerFormatted = `${bcMin}:${String(bcSec).padStart(2, '0')}`;
  const bcLowTime = bloodCastleInfo?.active ? bcRemainingSec <= 30 : false;
  const bcObjectiveLabel = !bloodCastleInfo?.active
    ? ''
    : bloodCastleInfo.stage === 'kill_100'
      ? `Очистите Мост Крови: ${bloodCastleInfo.kills}/${bloodCastleInfo.targetKills}`
      : bloodCastleInfo.stage === 'break_gates'
        ? 'Сломайте Ворота Крепости!'
        : bloodCastleInfo.stage === 'destroy_statue'
          ? 'Разрушьте Кристальную Статую и заберите Меч!'
          : bloodCastleInfo.stage === 'return_weapon'
            ? 'Верните Меч Архангелу у входа!'
            : 'Квест Blood Castle завершён!';

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatDraft.trim();
    if (trimmed) {
      onSendZoneChat(trimmed);
      setChatDraft('');
    }
    onSetChatOpen(false);
    chatInputRef.current?.blur();
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between">
      {/* Low HP Crimson Vignette Pulse */}
      <div
        ref={hudRefs.lowHpVignetteRef}
        className="pointer-events-none fixed inset-0 opacity-0 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(circle, transparent 58%, rgba(190, 18, 60, 0.42) 100%)',
        }}
      />

      {/* TOP PERIMETER: Classic MU Uncluttered Top-Left Chat + Center Boss/BC + Top-Right Minimap */}
      <div className="mu-top-hud-compact flex items-start justify-between gap-2 p-2.5 sm:p-3">
        {/* TOP-LEFT: Classic MU Floating Zone Chat + Compact Hero & Party Strip */}
        <div className="mu-top-left-compact pointer-events-auto flex flex-col gap-1 min-w-0 max-w-[240px] sm:max-w-[390px]">
          {/* Slim Classic MU Character Summary Strip */}
          <div className="mu-top-strip-compact flex flex-wrap items-center gap-x-2 gap-y-0.5 bg-[#0b090c]/80 backdrop-blur-sm border border-[#6e5a3e]/50 px-2.5 py-1 text-[11px] shadow-md">
            <span className="font-serif font-bold text-[#f3d48c] tracking-wide truncate max-w-[92px] sm:max-w-[140px]">
              {classTitle}
            </span>
            <span className="font-mono font-bold text-amber-300 shrink-0">
              Lv.{player.level}
              {player.resets > 0 ? ` · R${player.resets}` : ''}
            </span>
            <span className="font-mono text-amber-200/90 shrink-0">
              {player.zen.toLocaleString()} Zen
            </span>
            <span className="mu-top-hide-short hidden sm:inline font-mono text-[10px] text-slate-300/85">
              B:{player.jewels.bless} S:{player.jewels.soul} L:{player.jewels.life} C:{player.jewels.chaos}
            </span>
          </div>

          {/* Classic MU Online Translucent Upper-Left Chat Feed */}
          <div className="flex flex-col gap-1">
            {visibleChatMessages.length > 0 && (
              <div
                data-testid="zone-chat-log"
                className="mu-chat-compact flex flex-col gap-0.5 bg-black/52 border-l-2 border-[#a8874e]/75 px-2 py-1 text-[11px] leading-snug shadow"
              >
                {visibleChatMessages.map((msg) => (
                  <div key={msg.id} className="break-words drop-shadow-[0_1px_1px_rgba(0,0,0,0.95)]">
                    <span
                      className={`font-bold ${
                        msg.isSystem || msg.senderId === 'system'
                          ? 'text-amber-300'
                          : msg.senderId === partySelfId
                            ? 'text-sky-300'
                            : 'text-emerald-300'
                      }`}
                    >
                      [{msg.nickname}]:{' '}
                    </span>
                    <span className="text-slate-100/95">{msg.text}</span>
                  </div>
                ))}
              </div>
            )}

            {chatOpen ? (
              <form
                onSubmit={handleChatSubmit}
                className="flex items-center gap-1.5 bg-[#0c0a0e]/94 border border-[#c8a258]/70 px-2 py-1 shadow-xl"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                      onSetChatOpen(false);
                      chatInputRef.current?.blur();
                    }
                  }}
                  maxLength={140}
                  placeholder="Чат зоны (Enter — отправить, Esc — закрыть)..."
                  className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none min-w-[180px]"
                  aria-label="Сообщение в чат зоны"
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 bg-amber-600/80 hover:bg-amber-500 text-[10px] font-bold text-white flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onSetChatOpen(true);
                  setTimeout(() => chatInputRef.current?.focus(), 0);
                }}
                className="self-start px-2 py-0.5 bg-black/55 hover:bg-black/75 border border-[#6e5a3e]/45 text-[10px] font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                aria-label="Открыть чат зоны"
              >
                <MessageSquare className="w-3 h-3 text-amber-300" />
                <span>Чат [Enter]</span>
              </button>
            )}
          </div>

          {/* Incoming Manual Party Invite Banner */}
          {pendingPartyInvite && (
            <div
              data-testid="party-invite-banner"
              className="bg-[#181224]/95 backdrop-blur-sm border border-amber-400/80 px-2.5 py-2 text-[11px] shadow-[0_0_20px_rgba(251,191,36,0.3)] max-w-[290px]"
            >
              <div className="font-bold text-amber-200 leading-snug">
                🤝 Приглашение в группу от{' '}
                <span className="text-white">{pendingPartyInvite.fromNickname}</span> (Ур.
                {pendingPartyInvite.fromLevel})
              </div>
              <div className="mt-0.5 text-[10px] text-[#cfc6b8]">
                Добыча:{' '}
                <strong className="text-emerald-300">
                  {pendingPartyInvite.lootMode === 'random' ? '🎲 Случайно' : '✋ Нашедшему'}
                </strong>{' '}
                · Опыт в радиусе {PARTY_EXP_RANGE_METERS}м
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="party-invite-accept"
                  onClick={() => onRespondPartyInvite(pendingPartyInvite.inviteId, true)}
                  className="flex-1 rounded bg-emerald-500 hover:bg-emerald-400 px-2 py-1 text-[10px] font-extrabold text-[#09080c] cursor-pointer"
                >
                  ✓ Принять
                </button>
                <button
                  type="button"
                  data-testid="party-invite-decline"
                  onClick={() => onRespondPartyInvite(pendingPartyInvite.inviteId, false)}
                  className="flex-1 rounded border border-rose-400/60 bg-rose-950/80 hover:bg-rose-800/80 px-2 py-1 text-[10px] font-bold text-rose-200 cursor-pointer"
                >
                  ✕ Отклонить
                </button>
              </div>
            </div>
          )}

          {/* Compact Formed Party Strip (ONLY shown when player manually joined a party!) */}
          {activeParty && (() => {
            const formedPartyMembers = partyMembers.filter((m) =>
              activeParty.memberIds.includes(m.id)
            );
            if (formedPartyMembers.length === 0) return null;
            const selfMember = formedPartyMembers.find((m) => m.id === partySelfId);

            return (
              <div
                data-testid="party-strip"
                className="mu-party-compact bg-[#081316]/88 backdrop-blur-sm border border-teal-500/45 px-2 py-1.5 text-[10px] shadow-md max-w-[275px]"
              >
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <button
                    type="button"
                    onClick={onOpenPartyModal}
                    className="flex items-center gap-1 font-bold text-teal-300 hover:text-teal-200 cursor-pointer truncate"
                  >
                    <Users className="w-3 h-3 shrink-0" />
                    <span className="truncate">Группа ({formedPartyMembers.length}/5)</span>
                  </button>
                  <span
                    data-testid="hud-party-loot-mode"
                    className="rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-200 shrink-0"
                    title="Режим распределения добычи в группе"
                  >
                    {activeParty.lootMode === 'random' ? '🎲 Случайно' : '✋ Нашедшему'}
                  </span>
                </div>
                <div className="space-y-1">
                  {formedPartyMembers.slice(0, 5).map((member) => {
                    const isSelf = member.id === partySelfId;
                    const isLeader = member.id === activeParty.leaderId;
                    const memberHpPct = Math.max(
                      0,
                      Math.min(100, (member.hp / Math.max(1, member.maxHp)) * 100)
                    );
                    const sameZone =
                      selfMember !== undefined &&
                      member.territoryId === selfMember.territoryId &&
                      Boolean(member.inBloodCastle) === Boolean(selfMember.inBloodCastle);
                    const distMeters =
                      !isSelf && sameZone && selfMember
                        ? Math.round(
                            worldDistanceToMeters(
                              member.x - selfMember.x,
                              member.y - selfMember.y
                            )
                          )
                        : null;
                    const inExpRange =
                      distMeters !== null && distMeters <= PARTY_EXP_RANGE_METERS;
                    const memberZone = member.inBloodCastle
                      ? 'Blood Castle'
                      : TERRITORIES.find((t) => t.id === member.territoryId)?.name ??
                        member.territoryId;
                    return (
                      <div key={member.id} className="flex items-center gap-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <span className="truncate font-semibold text-slate-100">
                              {isLeader ? '👑 ' : isSelf ? '★ ' : ''}
                              {member.nickname}
                            </span>
                            <span className="font-mono text-[9px] shrink-0">
                              <span className="text-teal-200/85">Ур.{member.level}</span>
                              {distMeters !== null ? (
                                <span
                                  className={
                                    inExpRange
                                      ? ' text-emerald-300 font-bold'
                                      : ' text-slate-400'
                                  }
                                  title={
                                    inExpRange
                                      ? `В радиусе опыта (<= ${PARTY_EXP_RANGE_METERS}м)`
                                      : `Далеко для опыта (> ${PARTY_EXP_RANGE_METERS}м)`
                                  }
                                >
                                  {' '}
                                  · {distMeters}м
                                </span>
                              ) : (
                                !isSelf && (
                                  <span className="mu-top-hide-short text-slate-400">
                                    {' '}
                                    · {memberZone}
                                  </span>
                                )
                              )}
                            </span>
                          </div>
                          <div className="h-1 bg-slate-900 overflow-hidden mt-0.5">
                            <div
                              className="h-full bg-emerald-400"
                              style={{ width: `${memberHpPct}%` }}
                            />
                          </div>
                        </div>
                        {!isSelf && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onRequestTradeWithAlly(member)}
                              className="px-1 py-0.5 bg-amber-950/90 hover:bg-amber-800/80 border border-amber-500/50 text-amber-200 cursor-pointer"
                              title={`Предложить обмен ${member.nickname}`}
                            >
                              <Handshake className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onTeleportToAlly(member)}
                              className="px-1 py-0.5 bg-teal-950/90 hover:bg-teal-800/80 border border-teal-500/50 text-teal-200 cursor-pointer"
                              title={`Телепорт к ${member.nickname}`}
                            >
                              <Compass className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!partyConnected && (
                  <div className="mt-1 text-[9px] font-mono text-amber-300">
                    Переподключение...
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* TOP-CENTER: Boss HP Bar or Blood Castle 3-Minute Event Tracker */}
        <div className="mu-top-center-compact flex flex-col items-center gap-1 min-w-0 flex-1 max-w-[340px]">
          {bloodCastleInfo?.active && (
            <div className="mu-boss-card-compact pointer-events-auto w-full bg-[#1a0a12]/92 backdrop-blur-md border border-rose-500/70 px-3 py-1.5 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-serif font-bold text-rose-200 uppercase tracking-wider truncate">
                  Blood Castle
                </span>
                <span
                  data-testid="blood-castle-timer"
                  className={`font-mono font-bold px-1.5 py-0.5 border shrink-0 ${
                    bcLowTime
                      ? 'bg-rose-600/40 border-rose-400 text-rose-100 animate-pulse'
                      : 'bg-black/60 border-rose-500/50 text-amber-200'
                  }`}
                >
                  ⏳ {bcTimerFormatted}
                </span>
                <button
                  type="button"
                  onClick={onExitBloodCastle}
                  className="px-1.5 py-0.5 bg-rose-950 hover:bg-rose-800 border border-rose-400/50 text-[10px] font-bold text-rose-200 cursor-pointer shrink-0"
                >
                  Выход
                </button>
              </div>
              <div className="mt-1 text-[10px] text-amber-100/95 font-medium truncate">
                {bcObjectiveLabel}
              </div>
              {bloodCastleInfo.stage === 'kill_100' && (
                <div className="mt-1 h-1.5 bg-black/70 overflow-hidden border border-rose-900/80">
                  <div
                    className="h-full bg-gradient-to-r from-rose-600 to-amber-400 transition-all duration-200"
                    style={{
                      width: `${Math.min(
                        100,
                        (bloodCastleInfo.kills / Math.max(1, bloodCastleInfo.targetKills)) * 100
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {bossActiveName && !bloodCastleInfo?.active && (
            <div className="mu-boss-card-compact w-full bg-[#1a1306]/92 border border-amber-400/80 px-3 py-1.5 shadow-[0_0_22px_rgba(250,204,21,0.3)]">
              <div className="flex items-center justify-between gap-1 text-[11px] font-serif font-bold text-yellow-200 mb-1">
                <span className="flex items-center gap-1 min-w-0 truncate">
                  <Shield className="w-3 h-3 text-yellow-400 shrink-0" />
                  <span className="truncate">{bossActiveName}</span>
                </span>
                <span className="font-mono text-amber-300 shrink-0">{Math.round(bossHpPct * 100)}%</span>
              </div>
              <div className="h-1.5 sm:h-2 bg-black/75 border border-amber-700/80 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-100 transition-all duration-150"
                  style={{ width: `${Math.max(0, Math.min(100, bossHpPct * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* TOP-RIGHT: Classic MU Territory Header, World Server Clock, Minimap & System Controls */}
        <div className="pointer-events-auto flex flex-col items-end gap-1 shrink-0">
          <div className="mu-top-strip-compact flex items-center gap-1 bg-[#0b090c]/85 backdrop-blur-sm border border-[#6e5a3e]/55 px-2 py-1 shadow-md">
            <button
              type="button"
              onClick={onOpenTerritory}
              className="flex items-center gap-1 text-left pr-1.5 border-r border-white/15 hover:text-amber-300 transition-colors cursor-pointer"
              title="Карта 24 континентов [T]"
            >
              <MapIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="mu-territory-name-compact font-serif font-bold text-[11px] text-[#f3d48c] max-w-[90px] sm:max-w-[115px] truncate">
                {player.inBloodCastle ? 'Blood Castle' : territory.name}
              </span>
            </button>
            <div
              data-testid="world-game-time-clock"
              className="flex items-center gap-1 px-1 text-[10px] sm:text-[11px] font-mono font-bold text-amber-200"
              title="Серверное игровое время респауна"
            >
              <Clock className="w-3 h-3 text-amber-400" />
              <span>{worldClock}</span>
            </div>
            <button
              type="button"
              onClick={() => void requestMobileLandscapeFullscreen()}
              className="p-1 text-slate-300 hover:text-amber-300 cursor-pointer lg:hidden"
              aria-label="Полный экран (альбомный режим)"
              title="Полный экран и альбомная ориентация"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="p-1 text-slate-300 hover:text-amber-300 cursor-pointer"
              aria-label={muted ? 'Включить звук' : 'Выключить звук'}
              title="Звук [M]"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={onTogglePause}
              className="p-1 text-slate-300 hover:text-amber-300 cursor-pointer"
              aria-label="Пауза"
              title="Пауза [P]"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="p-1 text-slate-300 hover:text-amber-300 cursor-pointer"
              aria-label="Вернуться в безопасный город"
              title="В город [R]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Server Online Counter with Expandable Character Nicknames List */}
          <ServerOnlineWidget variant="hud" syncTrigger={partyMembers.length} />

          {/* Compact Corner Minimap */}
          <div className="mu-minimap-compact hidden sm:block bg-[#0b090c]/88 border border-[#6e5a3e]/65 p-1 shadow-lg">
            <canvas
              ref={hudRefs.minimapCanvasRef}
              width={96}
              height={96}
              className="block w-[96px] h-[96px]"
            />
          </div>

          {/* 15-Minute Server-Time Golden Boss Invasion Status */}
          {!player.inBloodCastle && (
            <div
              data-testid="golden-boss-status"
              className={`mu-boss-pill-compact bg-[#0b090c]/88 backdrop-blur-sm border px-2 py-0.5 text-[10px] font-mono shadow ${
                bossActiveName
                  ? 'border-yellow-400/80 text-yellow-200'
                  : 'border-[#6e5a3e]/55 text-amber-200/85'
              }`}
              title="Золотой Босс появляется раз в 15 минут по времени сервера вне зон обычных монстров и бродит по карте"
            >
              {bossActiveName ? (
                <span className="font-bold text-yellow-300">👑 Золотой Босс на карте!</span>
              ) : (
                <span>👑 Золотой Босс: {goldenBossCountdown}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
