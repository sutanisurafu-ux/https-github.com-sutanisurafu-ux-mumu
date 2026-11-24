import React, { useState } from 'react';
import { canEnterTerritory, getTerritoryMapLayout, TERRITORIES } from '../game/rules';
import { PlayerProgressState, TerritoryId } from '../game/types';

interface TerritoryModalProps {
  player: PlayerProgressState;
  onClose: () => void;
  onSelectTerritory: (id: TerritoryId) => void;
  onEnterBloodCastle: () => string;
  onExitBloodCastle: () => void;
}

function getTerritoryLootTierLabel(idx: number): { label: string; colorClass: string } {
  if (idx <= 2) {
    return { label: 'Вещи: Слабые Common (+0..+1)', colorClass: 'text-[#a39a8c]' };
  }
  if (idx <= 6) {
    return { label: 'Вещи: Common / Magic (+1..+3)', colorClass: 'text-sky-300' };
  }
  if (idx <= 12) {
    return { label: 'Вещи: Magic / Excellent (+2..+5)', colorClass: 'text-emerald-300' };
  }
  if (idx <= 18) {
    return { label: 'Вещи: Excellent / Ancient (+3..+6)', colorClass: 'text-amber-300' };
  }
  return { label: 'Вещи: Высшие Ancient (+4..+7)', colorClass: 'text-amber-400 font-bold' };
}

export const TerritoryModal: React.FC<TerritoryModalProps> = ({
  player,
  onClose,
  onSelectTerritory,
  onEnterBloodCastle,
  onExitBloodCastle,
}) => {
  const [actFilter, setActFilter] = useState<'all' | 'act1' | 'act2' | 'act3'>('all');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const filteredTerritories = TERRITORIES.map((territory, idx) => ({ territory, idx })).filter(
    ({ idx }) => {
      if (actFilter === 'act1') return idx < 8;
      if (actFilter === 'act2') return idx >= 8 && idx < 16;
      if (actFilter === 'act3') return idx >= 16;
      return true;
    }
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Карта 24 городов и ивент-зоны Blood Castle"
    >
      <div
        data-testid="territory-modal-panel"
        className="gothic-panel flex h-[94dvh] max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl sm:h-auto sm:max-h-[92dvh]"
      >
        {/* Compact Sticky Top Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/25 px-3.5 py-2 sm:px-5 sm:py-3.5">
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-bold text-[#fdf8ed] sm:text-xl">
              Врата Телепорта MU · 24 Города и Blood Castle
            </h2>
            <p className="mu-top-hide-short text-xs text-[#bfb5a4]">
              Переход открывается по <span className="font-semibold text-amber-300">уровню (ваш Ур. {player.level})</span>. Каждые <span className="font-semibold text-yellow-300">15 мин</span> появляется бродячий <span className="font-semibold text-yellow-300">👑 Золотой Босс</span>!
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть карту городов"
            className="gothic-button min-h-[36px] min-w-[36px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-amber-200 cursor-pointer sm:min-h-[44px] sm:px-4 sm:py-2"
          >
            ✕ [Esc]
          </button>
        </div>

        {/* Single Unified Mobile-Friendly Scrollable Body (Blood Castle + Act Tabs + 24 Cities) */}
        <div
          data-testid="territory-scroll-body"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain touch-pan-y"
        >
          {/* FEATURED EVENT ZONE: BLOOD CASTLE (ЗАМОК КРОВИ) */}
          <div className="shrink-0 border-b border-rose-500/35 bg-gradient-to-r from-[#241018] via-[#1c101b] to-[#171221] px-3.5 py-2.5 sm:px-5 sm:py-3.5">
            <div className="flex flex-col justify-between gap-2.5 md:flex-row md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="rounded-md border border-rose-400/50 bg-rose-500/25 px-2 py-0.5 font-mono-num text-[10px] font-extrabold text-rose-300">
                    ИВЕНТ-ЗОНА
                  </span>
                  <h3 className="font-display text-xs font-bold text-rose-200 sm:text-base">
                    🩸 BLOOD CASTLE (ЗАМОК КРОВИ) · Пройдено: {player.bloodCastleClears}
                  </h3>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[#dfd6c9] sm:text-xs">
                  Мост над Кровавой Бездной (1 попытка — при смерти возврат в город):{' '}
                  <span className="font-semibold text-amber-300">
                    1) 100 мобов → 2) Ворота → 3) Статуя → 4) Оружие Архангела.
                  </span>{' '}
                  Награда:{' '}
                  <span className="font-bold text-emerald-300">
                    1–3 Jewel of Chaos (80% — 1, 18% — 2, 2% — 3) и Опыт
                  </span>!
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono-num text-[10px] text-[#bfb5a4] sm:text-[11px]">
                  <span>📜 Scroll: <strong className="text-amber-200">{player.bloodScrolls}</strong></span>
                  <span>·</span>
                  <span>🦷 Fang: <strong className="text-amber-200">{player.bloodFangs}</strong></span>
                  <span>·</span>
                  <span>💎 Chaos: <strong className="text-amber-200">{player.jewels.chaos}</strong></span>
                  <span>·</span>
                  <span>🎟️ Билетов: <strong className="text-emerald-300">{player.bloodCastleTickets}</strong></span>
                </div>
                {statusMsg && (
                  <p className="mt-1 text-xs font-bold text-amber-300">{statusMsg}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {player.inBloodCastle ? (
                  <button
                    type="button"
                    onClick={onExitBloodCastle}
                    className="min-h-[38px] rounded-xl bg-sky-500 px-3.5 py-1.5 font-display text-xs font-bold text-[#09080c] hover:bg-sky-400 cursor-pointer whitespace-nowrap sm:min-h-[42px] sm:px-4 sm:py-2"
                  >
                    Вернуться из Blood Castle в город
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const msg = onEnterBloodCastle();
                      setStatusMsg(msg);
                    }}
                    className={`min-h-[38px] rounded-xl px-3.5 py-1.5 font-display text-xs font-bold cursor-pointer whitespace-nowrap sm:min-h-[42px] sm:px-4 sm:py-2 ${
                      player.bloodCastleTickets > 0
                        ? 'bg-rose-600 text-white shadow-[0_4px_16px_rgba(225,29,72,0.5)] hover:bg-rose-500'
                        : 'border border-rose-500/35 bg-[#2a1d24] text-rose-200/80 hover:bg-[#35232c]'
                    }`}
                  >
                    🩸 Войти в Blood Castle ({player.bloodCastleTickets} бил.)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Act Filter Tabs (sticky inside scroll body on desktop, inline smooth scroll on mobile) */}
          <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 bg-[#15111f]/98 px-3.5 py-2 backdrop-blur-sm sm:px-5 sm:py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActFilter('all')}
                className={`min-h-[32px] rounded-xl px-2.5 py-1 text-[11px] font-bold cursor-pointer sm:min-h-[36px] sm:px-3 sm:text-xs ${
                  actFilter === 'all'
                    ? 'bg-amber-500 text-[#09080c]'
                    : 'gothic-button text-[#dfd7c8]'
                }`}
              >
                Все 24 города
              </button>
              <button
                type="button"
                onClick={() => setActFilter('act1')}
                className={`min-h-[32px] rounded-xl px-2.5 py-1 text-[11px] font-bold cursor-pointer sm:min-h-[36px] sm:px-3 sm:text-xs ${
                  actFilter === 'act1'
                    ? 'bg-amber-500 text-[#09080c]'
                    : 'gothic-button text-[#dfd7c8]'
                }`}
              >
                Акт I (1–8)
              </button>
              <button
                type="button"
                onClick={() => setActFilter('act2')}
                className={`min-h-[32px] rounded-xl px-2.5 py-1 text-[11px] font-bold cursor-pointer sm:min-h-[36px] sm:px-3 sm:text-xs ${
                  actFilter === 'act2'
                    ? 'bg-amber-500 text-[#09080c]'
                    : 'gothic-button text-[#dfd7c8]'
                }`}
              >
                Акт II (9–16)
              </button>
              <button
                type="button"
                onClick={() => setActFilter('act3')}
                className={`min-h-[32px] rounded-xl px-2.5 py-1 text-[11px] font-bold cursor-pointer sm:min-h-[36px] sm:px-3 sm:text-xs ${
                  actFilter === 'act3'
                    ? 'bg-amber-500 text-[#09080c]'
                    : 'gothic-button text-[#dfd7c8]'
                }`}
              >
                Акт III (17–24)
              </button>
            </div>
            <span className="font-mono-num text-[11px] text-amber-300 sm:text-xs">
              Открыто (Ур. {player.level}
              {player.resets > 0 ? `, −${player.resets * 5} ур. от ${player.resets} рес.` : ''}):{' '}
              {TERRITORIES.filter((t) => canEnterTerritory(player.level, t.id, player.resets).allowed).length} /{' '}
              {TERRITORIES.length}
            </span>
          </div>

          {/* 24 Cities Grid */}
          <div className="grid grid-cols-1 gap-2.5 p-3.5 pb-6 sm:grid-cols-2 sm:gap-3 sm:p-5 lg:grid-cols-3">
            {filteredTerritories.map(({ territory, idx }) => {
              const isCurrent = !player.inBloodCastle && player.territoryId === territory.id;
              const entryCheck = canEnterTerritory(player.level, territory.id, player.resets);
              const isLocked = !entryCheck.allowed;
              const effectiveReqLevel = entryCheck.requiredLevel;
              const dropsChaosFromMobs = territory.recommendedLevel >= 150;
              const lootTier = getTerritoryLootTierLabel(idx);
              const mapLayout = getTerritoryMapLayout(territory.id);
              const vipCamp = mapLayout.camps.find((c) => c.isVip);

              return (
                <div
                  key={territory.id}
                  data-testid={`territory-card-${territory.id}`}
                  className={`flex flex-col justify-between gap-2 rounded-xl border p-3 sm:gap-2.5 sm:p-3.5 ${
                    isCurrent
                      ? 'border-amber-400 bg-[#211a2d]'
                      : isLocked
                        ? 'border-white/10 bg-[#121017] opacity-65'
                        : 'border-amber-500/25 bg-[#16121f]'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: territory.accentColor }}
                          aria-hidden="true"
                        />
                        <span className="truncate font-display text-xs font-bold text-[#fdf8ed] sm:text-sm">
                          {territory.name}
                        </span>
                      </div>
                      <span className="font-mono-num text-[11px] text-amber-300">
                        Треб. Ур. {effectiveReqLevel}+
                        {entryCheck.levelReduction > 0 ? ` (−${entryCheck.levelReduction})` : ''} · ×
                        {territory.enemyLevelMultiplier.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#bfb6a6]">{territory.subtitle}</p>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 font-mono-num text-[10px]">
                      <span className="text-[#c9b88a]">
                        👑 <span className="font-bold text-yellow-300">Золотой {territory.bossName}</span> (раз в 15 мин)
                      </span>
                      <span className={dropsChaosFromMobs ? 'font-bold text-amber-300' : 'text-[#8c8273]'}>
                        {dropsChaosFromMobs ? '💎 Мобы: Chaos (150+)' : '💎 Редкий лут с Босса'}
                      </span>
                    </div>
                    <div className={`mt-1 font-mono-num text-[10px] ${lootTier.colorClass}`}>
                      {lootTier.label} · Scroll & Fang
                    </div>
                    <div className="mt-1.5 rounded-lg border border-amber-500/25 bg-[#120e1a] px-2 py-1 font-mono-num text-[10px] text-amber-200/95">
                      <div>
                        🗺️ Тропинки ({mapLayout.trails.length}) · Заборы ({mapLayout.fences.length}) · Речки ({mapLayout.rivers.length})
                      </div>
                      {vipCamp && (
                        <div className="mt-0.5 truncate font-semibold text-amber-300">
                          {vipCamp.title} (10 мобов: +2 дальних)
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-1.5">
                    <span
                      className={`font-mono-num text-[10px] ${
                        isLocked ? 'text-rose-300/90' : 'text-emerald-300/90'
                      }`}
                    >
                      {isLocked
                        ? `🔒 Требуется Ур. ${effectiveReqLevel} (сейчас ${player.level})`
                        : entryCheck.levelReduction > 0
                          ? `🛡️ Доступно (−${entryCheck.levelReduction} ур. от ресетов)`
                          : '🛡️ Доступно по уровню'}
                    </span>
                    <button
                      type="button"
                      disabled={isLocked || isCurrent}
                      onClick={() => onSelectTerritory(territory.id)}
                      className="min-h-[36px] shrink-0 rounded-xl bg-amber-500 px-3 py-1 font-display text-xs font-bold text-[#09080c] transition-transform hover:bg-amber-400 active:scale-95 disabled:pointer-events-none disabled:bg-[#221d2b] disabled:text-[#8c8273] cursor-pointer whitespace-nowrap sm:min-h-[38px]"
                    >
                      {isCurrent
                        ? 'Вы здесь'
                        : isLocked
                          ? `Нужен Ур. ${effectiveReqLevel}`
                          : 'Телепорт'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
