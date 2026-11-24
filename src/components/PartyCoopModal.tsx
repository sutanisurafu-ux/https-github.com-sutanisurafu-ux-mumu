import React, { useState } from 'react';
import {
  MAX_WORLD_PLAYERS,
  PARTY_EXP_RANGE_METERS,
  calculatePartyCoopExpBonus,
  getEligiblePartyExpRecipients,
  worldDistanceToMeters,
} from '../game/party';
import { TERRITORIES, getClassDisplayTitle } from '../game/rules';
import {
  ActivePartyState,
  PartyChatMessage,
  PartyInvitePayload,
  PartyLootMode,
  PartyMemberState,
  PlayerProgressState,
} from '../game/types';

interface PartyCoopModalProps {
  player: PlayerProgressState;
  selfId: string;
  nickname: string;
  roomCode: string;
  wsConnected: boolean;
  partyMembers: PartyMemberState[];
  activeParty: ActivePartyState | null;
  pendingPartyInvite: PartyInvitePayload | null;
  chatMessages: PartyChatMessage[];
  errorMessage: string | null;
  onUpdateIdentity: (newNickname: string, newRoomCode: string) => void;
  onInviteToParty: (targetId: string) => void;
  onRespondPartyInvite: (inviteId: string, accept: boolean) => void;
  onSetPartyLootMode: (lootMode: PartyLootMode) => void;
  onLeaveParty: () => void;
  onKickPartyMember: (targetId: string) => void;
  onRequestTradeWithAlly: (ally: PartyMemberState) => void;
  onSendChat: (text: string) => void;
  onTeleportToAlly: (ally: PartyMemberState) => void;
  onClose: () => void;
}

export const PartyCoopModal: React.FC<PartyCoopModalProps> = ({
  player: _player,
  selfId,
  nickname,
  roomCode,
  wsConnected,
  partyMembers,
  activeParty,
  pendingPartyInvite,
  chatMessages,
  errorMessage,
  onUpdateIdentity,
  onInviteToParty,
  onRespondPartyInvite,
  onSetPartyLootMode,
  onLeaveParty,
  onKickPartyMember,
  onRequestTradeWithAlly,
  onSendChat,
  onTeleportToAlly,
  onClose,
}) => {
  void _player;
  const [activeTab, setActiveTab] = useState<'party' | 'vps_guide'>('party');
  const [nickInput, setNickInput] = useState<string>(nickname);
  const [roomInput, setRoomInput] = useState<string>(roomCode);
  const [chatInput, setChatInput] = useState<string>('');
  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);

  const selfMember = partyMembers.find((m) => m.id === selfId) ?? null;
  const formedPartyMembers = activeParty
    ? partyMembers.filter((m) => activeParty.memberIds.includes(m.id))
    : [];
  const isLeader = activeParty !== null && activeParty.leaderId === selfId;
  const canInviteMore =
    activeParty === null || (isLeader && activeParty.memberIds.length < 5);

  const expInfo = getEligiblePartyExpRecipients(
    activeParty,
    partyMembers,
    selfId,
    PARTY_EXP_RANGE_METERS
  );
  const coopBonus = calculatePartyCoopExpBonus(100, expInfo.nearbyAlliesCount);

  const onlineOthers = partyMembers.filter((m) => m.id !== selfId);

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?party=${encodeURIComponent(roomCode)}`
      : `http://<IP_ВАШЕГО_VPS>:3000/?party=${roomCode}`;

  const handleCopyInvite = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl).catch(() => {});
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2500);
    }
  };

  const handleApplyIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateIdentity(nickInput, roomInput);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  const getDistanceMeters = (member: PartyMemberState): number | null => {
    if (!selfMember) return null;
    if (
      member.territoryId !== selfMember.territoryId ||
      Boolean(member.inBloodCastle) !== Boolean(selfMember.inBloodCastle)
    ) {
      return null;
    }
    return Math.round(worldDistanceToMeters(member.x - selfMember.x, member.y - selfMember.y));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Группа, Онлайн Игроки и Деплой на VPS"
      data-testid="party-coop-modal"
    >
      <div className="gothic-panel flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-emerald-500/40">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/25 bg-[#12191c] px-5 py-3.5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono-num text-[11px] font-bold ${
                  wsConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                {wsConnected ? 'Сервер Онлайн' : 'Подключение...'}
              </span>
              <h2 className="font-display text-base font-bold text-[#fdf8ed] sm:text-xl">
                🤝 Мир #{roomCode} ({partyMembers.length}/{MAX_WORLD_PLAYERS} онлайн) ·{' '}
                {activeParty ? `Группа ${formedPartyMembers.length}/5` : 'Соло'}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-[#bfb5a4]">
              Группы создаются <strong className="text-amber-300">вручную</strong> (без авто-пати).
              Опыт пати делится только в радиусе{' '}
              <strong className="text-emerald-300">{PARTY_EXP_RANGE_METERS}м</strong> от убийцы
              (сейчас рядом: {expInfo.nearbyAlliesCount}, бонус +{coopBonus.bonusPct}%). Лут на
              земле общий на весь сервер.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно пати"
            className="gothic-button min-h-[42px] rounded-xl px-4 py-2 text-xs font-semibold text-amber-200 cursor-pointer"
          >
            Закрыть [O / Esc]
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 bg-[#14111d] px-5 py-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('party')}
              className={`min-h-[38px] rounded-xl px-4 py-1.5 text-xs font-bold cursor-pointer ${
                activeTab === 'party'
                  ? 'bg-emerald-500 text-[#09080c] shadow-[0_0_14px_rgba(16,185,129,0.45)]'
                  : 'gothic-button text-[#dfd7c8]'
              }`}
            >
              🤝 Группа ({activeParty ? `${formedPartyMembers.length}/5` : 'Соло'}) · Онлайн (
              {partyMembers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vps_guide')}
              className={`min-h-[38px] rounded-xl px-4 py-1.5 text-xs font-bold cursor-pointer ${
                activeTab === 'vps_guide'
                  ? 'bg-amber-500 text-[#09080c] shadow-[0_0_14px_rgba(245,158,11,0.45)]'
                  : 'gothic-button text-amber-200'
              }`}
            >
              🚀 Деплой на свой VPS (Docker / PM2 / Nginx)
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyInvite}
            className="min-h-[36px] rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-3 py-1 font-mono-num text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
          >
            {copiedInvite
              ? '✅ Ссылка на канал скопирована!'
              : `🔗 Скопировать ссылку канала #${roomCode}`}
          </button>
        </div>

        {errorMessage && (
          <div className="border-b border-rose-500/40 bg-rose-950/60 px-5 py-2 text-xs font-bold text-rose-200">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Incoming Party Invite inside Modal */}
        {pendingPartyInvite && (
          <div
            data-testid="modal-party-invite-banner"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/50 bg-amber-950/45 px-5 py-2.5 text-xs"
          >
            <div className="text-amber-100">
              🤝 <strong className="text-amber-300">{pendingPartyInvite.fromNickname}</strong> (Ур.
              {pendingPartyInvite.fromLevel}) приглашает вас в группу! Режим добычи:{' '}
              <strong className="text-emerald-300">
                {pendingPartyInvite.lootMode === 'random' ? '🎲 Случайно' : '✋ Нашедшему'}
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRespondPartyInvite(pendingPartyInvite.inviteId, true)}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-[#09080c] hover:bg-emerald-400 cursor-pointer"
              >
                ✓ Принять
              </button>
              <button
                type="button"
                onClick={() => onRespondPartyInvite(pendingPartyInvite.inviteId, false)}
                className="rounded-lg border border-rose-400/60 bg-rose-950/70 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-900 cursor-pointer"
              >
                ✕ Отклонить
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: MY PARTY + ONLINE SERVER PLAYERS + REAL-TIME CHAT */}
        {activeTab === 'party' ? (
          <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-12">
            {/* Left Column: My Party + Online Players + Channel Settings */}
            <div className="flex flex-col gap-3.5 lg:col-span-7">
              {/* SECTION A: MY FORMED PARTY */}
              <div className="flex flex-col rounded-xl border border-emerald-500/35 bg-[#121a1e] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-xs font-bold text-emerald-300">
                    {activeParty
                      ? `🛡️ Моя Группа (${formedPartyMembers.length}/5)`
                      : '🛡️ Моя Группа (Вы играете соло)'}
                  </span>
                  {activeParty && (
                    <button
                      type="button"
                      data-testid="party-leave-btn"
                      onClick={onLeaveParty}
                      className="rounded-lg border border-rose-400/50 bg-rose-950/60 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-900 cursor-pointer"
                    >
                      🚪 Выйти из пати
                    </button>
                  )}
                </div>

                {activeParty ? (
                  <>
                    {/* Party Loot Mode Settings */}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-[#191422] px-3 py-2">
                      <div className="text-[11px]">
                        <span className="font-bold text-amber-300">⚙️ Настройка добычи:</span>{' '}
                        <span className="text-[#cfc6b8]">
                          {isLeader
                            ? 'Вы лидер — выберите правило лута'
                            : 'Меняет лидер группы'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid="party-loot-mode-finder"
                          disabled={!isLeader}
                          onClick={() => onSetPartyLootMode('finder')}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                            activeParty.lootMode === 'finder'
                              ? 'bg-emerald-500 text-[#09080c] shadow-[0_0_10px_rgba(16,185,129,0.45)]'
                              : 'border border-white/15 bg-[#0e0c14] text-[#cfc6b8] hover:border-amber-400/60'
                          } ${isLeader ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
                        >
                          ✋ Нашедшему
                        </button>
                        <button
                          type="button"
                          data-testid="party-loot-mode-random"
                          disabled={!isLeader}
                          onClick={() => onSetPartyLootMode('random')}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                            activeParty.lootMode === 'random'
                              ? 'bg-amber-400 text-[#09080c] shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                              : 'border border-white/15 bg-[#0e0c14] text-[#cfc6b8] hover:border-amber-400/60'
                          } ${isLeader ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
                        >
                          🎲 Случайно
                        </button>
                      </div>
                    </div>

                    {/* Formed Party Roster */}
                    <div className="mt-2.5 flex flex-col gap-2">
                      {formedPartyMembers.map((member) => {
                        const isSelf = member.id === selfId;
                        const isMemberLeader = member.id === activeParty.leaderId;
                        const memberTerritory =
                          TERRITORIES.find((t) => t.id === member.territoryId) ?? TERRITORIES[0];
                        const hpPct = Math.max(
                          0,
                          Math.min(100, Math.round((member.hp / Math.max(1, member.maxHp)) * 100))
                        );
                        const mpPct = Math.max(
                          0,
                          Math.min(100, Math.round((member.mp / Math.max(1, member.maxMp)) * 100))
                        );
                        const classTitle = getClassDisplayTitle(member.classId, member.classTier);
                        const distM = isSelf ? 0 : getDistanceMeters(member);
                        const inExpRange = distM !== null && distM <= PARTY_EXP_RANGE_METERS;

                        return (
                          <div
                            key={member.id}
                            className={`flex flex-col justify-between gap-2 rounded-xl border p-2.5 sm:flex-row sm:items-center ${
                              isSelf
                                ? 'border-amber-400/50 bg-[#1e192a]'
                                : 'border-emerald-500/35 bg-[#152024]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-display text-xs font-extrabold text-white">
                                  {isMemberLeader ? '👑 ' : isSelf ? '⭐ ' : '🤝 '}
                                  {member.nickname}
                                  {isSelf ? ' (Вы)' : ''}
                                </span>
                                <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-amber-300">
                                  Ур.{member.level}
                                  {member.resets > 0 ? ` · R${member.resets}` : ''}
                                </span>
                                <span className="text-[10px] text-[#c8beae]">{classTitle}</span>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono-num text-[10px] text-[#afa595]">
                                <span className="text-sky-300 font-semibold">
                                  📍{' '}
                                  {member.inBloodCastle
                                    ? '🩸 Blood Castle'
                                    : memberTerritory.name}
                                </span>
                                {!isSelf && (
                                  <span
                                    className={
                                      inExpRange
                                        ? 'text-emerald-300 font-bold'
                                        : 'text-rose-300 font-semibold'
                                    }
                                  >
                                    {distM !== null
                                      ? inExpRange
                                        ? `✓ ${distM}м (опыт делится)`
                                        : `✕ ${distM}м (> ${PARTY_EXP_RANGE_METERS}м, без опыта)`
                                      : '✕ Другая карта'}
                                  </span>
                                )}
                              </div>

                              <div className="mt-1.5 grid grid-cols-2 gap-2">
                                <div className="relative h-2.5 overflow-hidden rounded bg-[#1a0d12] border border-rose-500/30">
                                  <div
                                    style={{ width: `${hpPct}%` }}
                                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                                  />
                                  <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[8px] font-bold text-white">
                                    ОЗ {member.hp}/{member.maxHp}
                                  </span>
                                </div>
                                <div className="relative h-2.5 overflow-hidden rounded bg-[#0d1424] border border-sky-500/30">
                                  <div
                                    style={{ width: `${mpPct}%` }}
                                    className="h-full bg-gradient-to-r from-blue-600 to-sky-400"
                                  />
                                  <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[8px] font-bold text-white">
                                    МН {member.mp}/{member.maxMp}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {!isSelf && (
                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onTeleportToAlly(member)}
                                  className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-bold text-[#09080c] hover:bg-emerald-400 cursor-pointer"
                                >
                                  ⚡ ТП
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRequestTradeWithAlly(member)}
                                  className="rounded-lg border border-amber-400/50 bg-amber-500/15 px-2 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                                >
                                  ⚖️ Обмен
                                </button>
                                {isLeader && (
                                  <button
                                    type="button"
                                    onClick={() => onKickPartyMember(member.id)}
                                    className="rounded-lg border border-rose-400/50 bg-rose-950/70 px-2 py-1.5 text-[11px] font-bold text-rose-200 hover:bg-rose-800 cursor-pointer"
                                    title={`Исключить ${member.nickname} из группы`}
                                  >
                                    ✕ Кик
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="mt-2 rounded-xl border border-dashed border-emerald-500/35 bg-[#0e1417] p-3 text-xs text-[#bfb5a4]">
                    Вы сейчас не состоите в группе. Выберите игрока в списке{' '}
                    <strong className="text-amber-300">«Игроки на сервере онлайн»</strong> ниже и
                    нажмите <strong className="text-emerald-300">«🤝 В пати»</strong> — после
                    принятия приглашения откроются настройки добычи (Нашедшему / Случайно) и общий
                    опыт в радиусе {PARTY_EXP_RANGE_METERS}м!
                  </div>
                )}
              </div>

              {/* SECTION B: ONLINE PLAYERS ON SERVER CHANNEL */}
              <div className="flex flex-col rounded-xl border border-amber-500/25 bg-[#16121f] p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-bold text-amber-300">
                    🌍 Игроки на сервере онлайн ({onlineOthers.length})
                  </span>
                  <span className="font-mono-num text-[10px] text-[#afa595]">
                    Канал #{roomCode}
                  </span>
                </div>

                <div className="mt-2 flex flex-col gap-1.5">
                  {onlineOthers.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-[#0e0c14] p-2.5 text-[11px] text-[#9e9484]">
                      На канале #{roomCode} пока нет других игроков. Отправьте ссылку канала другу
                      (или откройте вторую вкладку браузера для теста).
                    </div>
                  ) : (
                    onlineOthers.map((member) => {
                      const inSameParty =
                        activeParty !== null && activeParty.memberIds.includes(member.id);
                      const inOtherParty = Boolean(member.partyId) && !inSameParty;
                      const distM = getDistanceMeters(member);
                      const memberTerritory =
                        TERRITORIES.find((t) => t.id === member.territoryId) ?? TERRITORIES[0];

                      return (
                        <div
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#100d17] px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-display text-xs font-bold text-white truncate">
                                {member.nickname}
                              </span>
                              <span className="rounded bg-black/45 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-amber-300">
                                Ур.{member.level}
                              </span>
                              {inSameParty && (
                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                                  В вашей пати
                                </span>
                              )}
                              {inOtherParty && (
                                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-[#bfb5a4]">
                                  В группе
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 font-mono-num text-[10px] text-[#9e9484]">
                              📍 {member.inBloodCastle ? 'Blood Castle' : memberTerritory.name}
                              {distM !== null ? ` · ${distM}м от вас` : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!inSameParty && !inOtherParty && canInviteMore && (
                              <button
                                type="button"
                                data-testid="invite-player-btn"
                                onClick={() => onInviteToParty(member.id)}
                                className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-extrabold text-[#09080c] hover:bg-emerald-400 cursor-pointer"
                              >
                                🤝 В пати
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onRequestTradeWithAlly(member)}
                              className="rounded-lg border border-amber-400/50 bg-amber-500/15 px-2 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                            >
                              ⚖️ Обмен
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Compact Channel & Nickname Form */}
              <form
                onSubmit={handleApplyIdentity}
                className="rounded-xl border border-amber-500/20 bg-[#14101c] p-3"
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-mono-num text-[#bfb5a4]">
                      Никнейм
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      value={nickInput}
                      onChange={(e) => setNickInput(e.target.value)}
                      placeholder="Ваш ник..."
                      className="mt-0.5 w-full rounded-lg border border-amber-500/35 bg-[#0d0a13] px-2.5 py-1.5 text-xs font-bold text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-mono-num text-[#bfb5a4]">
                      Канал сервера
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                      placeholder="MU-1"
                      className="mt-0.5 w-full rounded-lg border border-emerald-500/40 bg-[#0d0a13] px-2.5 py-1.5 font-mono-num text-xs font-bold text-emerald-300 uppercase focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end sm:col-span-3">
                    <button
                      type="submit"
                      className="min-h-[34px] w-full rounded-xl bg-emerald-500 px-3 py-1.5 font-display text-xs font-bold text-[#09080c] hover:bg-emerald-400 cursor-pointer"
                    >
                      Сменить
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Right Column: Live Channel & Party Chat */}
            <div className="flex flex-col rounded-xl border border-amber-500/25 bg-[#15111e] p-3.5 lg:col-span-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-display text-xs font-bold text-amber-300">
                  💬 Чат Канала #{roomCode}
                </span>
                <span className="text-[10px] text-[#9e9484]">
                  Сообщения видны над головой героя
                </span>
              </div>

              <div className="my-2.5 flex h-[250px] flex-1 flex-col gap-1.5 overflow-y-auto rounded-lg bg-[#0c0a12] p-2.5 font-mono-num text-xs">
                {chatMessages.length === 0 ? (
                  <div className="m-auto text-center text-[11px] text-[#7c7365]">
                    Напишите сообщение игрокам — оно появится в чате и над головой персонажа на
                    карте!
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="leading-relaxed">
                      <span
                        className={`font-bold ${
                          msg.isSystem || msg.senderId === 'system'
                            ? 'text-amber-300'
                            : msg.senderId === selfId
                              ? 'text-sky-300'
                              : 'text-emerald-300'
                        }`}
                      >
                        [{msg.nickname}]:
                      </span>{' '}
                      <span className="text-[#ece5d8]">{msg.text}</span>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleChatSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={140}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Написать в чат..."
                  className="flex-1 rounded-xl border border-amber-500/35 bg-[#0c0a12] px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[38px] rounded-xl bg-amber-500 px-3.5 py-2 font-display text-xs font-bold text-[#09080c] hover:bg-amber-400 cursor-pointer"
                >
                  Отправить
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* TAB 2: VPS DEPLOYMENT GUIDE */
          <div className="flex-1 overflow-y-auto p-5 text-xs text-[#dfd7c8]">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/30 bg-[#13191d] p-4">
                <h3 className="font-display text-sm font-bold text-emerald-300">
                  Вариант 1: Быстрый деплой на VPS через Docker Compose (Рекомендуется)
                </h3>
                <p className="mt-1 text-[11px] text-[#bfb5a4]">
                  В корень проекта уже добавлены готовые <code>Dockerfile</code>,{' '}
                  <code>docker-compose.yml</code> и скрипт <code>deploy-vps.sh</code>.
                </p>
                <pre className="mt-2.5 overflow-x-auto rounded-lg bg-black/70 p-3 font-mono-num text-[11px] text-emerald-200">
{`# 1. Склонируйте или загрузите проект на ваш VPS:
git clone <ваш-репозиторий> mu-legends && cd mu-legends

# 2. Запустите сборку и сервер в фоне (порт 3000):
docker compose up -d --build

# Или одной командой через скрипт:
bash deploy-vps.sh`}
                </pre>
                <p className="mt-2 text-[11px] text-amber-200">
                  После запуска откройте{' '}
                  <code>http://&lt;IP_ВАШЕГО_VPS&gt;:3000/?party=MU-1</code> и скиньте ссылку другу!
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-[#171320] p-4">
                <h3 className="font-display text-sm font-bold text-amber-300">
                  Вариант 2: Запуск на VPS без Docker (Node.js 22+ и PM2)
                </h3>
                <p className="mt-1 text-[11px] text-[#bfb5a4]">
                  Сервер <code>server.ts</code> одновременно раздаёт собранный фронтенд{' '}
                  <code>dist/</code> и обрабатывает WebSocket <code>/ws</code> для коопа на одном
                  порту <code>3000</code>.
                </p>
                <pre className="mt-2.5 overflow-x-auto rounded-lg bg-black/70 p-3 font-mono-num text-[11px] text-amber-200">
{`# 1. Установите зависимости и соберите фронтенд:
npm install
npm run build

# 2. Запустите продакшн-сервер через PM2:
npm install -g pm2
NODE_ENV=production PORT=3000 pm2 start "npm start" --name mu-online
pm2 save && pm2 startup`}
                </pre>
              </div>

              <div className="rounded-xl border border-sky-500/30 bg-[#121722] p-4 md:col-span-2">
                <h3 className="font-display text-sm font-bold text-sky-300">
                  Конфиг Nginx для домена и HTTPS (с поддержкой WebSocket /ws)
                </h3>
                <p className="mt-1 text-[11px] text-[#bfb5a4]">
                  Если вы проксируете игру через Nginx на свой домен, обязательно добавьте заголовки{' '}
                  <code>Upgrade</code> и <code>Connection &quot;upgrade&quot;</code> для локации{' '}
                  <code>/ws</code>:
                </p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/70 p-3 font-mono-num text-[11px] text-sky-200">
{`server {
    listen 80;
    server_name mu.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
