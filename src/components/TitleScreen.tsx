import React, { useEffect, useMemo, useState } from 'react';
import {
  CLASSES,
  TERRITORIES,
  calculateDerivedStats,
  createInitialPlayerState,
  getClassDisplayTitle,
} from '../game/rules';
import { AccountCharacterRecord, CharacterClassId } from '../game/types';
import { HeroModelPreview } from './HeroModelPreview';

interface TitleScreenProps {
  characters: AccountCharacterRecord[];
  maxSlots: number;
  loadingCharacters: boolean;
  selectedClass: CharacterClassId;
  onSelectClass: (classId: CharacterClassId) => void;
  onEnterCharacter: (record: AccountCharacterRecord) => void;
  onCreateCharacter: (
    nickname: string,
    classId: CharacterClassId
  ) => Promise<{ ok: boolean; character?: AccountCharacterRecord; error?: string }>;
  onDeleteCharacter: (characterId: string) => Promise<void>;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  characters,
  maxSlots,
  loadingCharacters,
  selectedClass,
  onSelectClass,
  onEnterCharacter,
  onCreateCharacter,
  onDeleteCharacter,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [mode, setMode] = useState<'lobby' | 'create'>('lobby');
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string>('');
  const [nameStatus, setNameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    reason?: string;
  }>({ checking: false, available: null });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sync mode & selected character when account characters load or change
  useEffect(() => {
    if (loadingCharacters) return;
    if (characters.length === 0) {
      setMode('create');
      setSelectedCharId(null);
      return;
    }
    if (!selectedCharId || !characters.some((c) => c.id === selectedCharId)) {
      setSelectedCharId(characters[0].id);
    }
  }, [characters, loadingCharacters, selectedCharId]);

  // Live server-wide unique character name availability check
  useEffect(() => {
    if (mode !== 'create') return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameStatus({ checking: false, available: null });
      return;
    }
    if (trimmed.length < 3) {
      setNameStatus({
        checking: false,
        available: false,
        reason: 'Имя должно содержать от 3 до 18 символов.',
      });
      return;
    }

    let cancelled = false;
    setNameStatus({ checking: true, available: null });
    const timer = setTimeout(() => {
      void fetch(`/api/characters/check-name?name=${encodeURIComponent(trimmed)}`, {
        credentials: 'include',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then(
          (
            data: { ok?: boolean; available?: boolean; reason?: string } | null
          ) => {
            if (cancelled) return;
            if (!data || !data.ok) {
              setNameStatus({ checking: false, available: null });
              return;
            }
            setNameStatus({
              checking: false,
              available: Boolean(data.available),
              reason: data.reason,
            });
          }
        )
        .catch(() => {
          if (!cancelled) {
            setNameStatus({ checking: false, available: null });
          }
        });
    }, 240);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nameInput, mode]);

  const currentClass = CLASSES[selectedClass];
  const previewPlayer = useMemo(() => createInitialPlayerState(selectedClass), [selectedClass]);
  const selectedCharacter =
    characters.find((c) => c.id === selectedCharId) ?? characters[0] ?? null;

  const canCreateMore = characters.length < maxSlots;

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    const trimmed = nameInput.trim();
    if (trimmed.length < 3) {
      setCreateError('Введите уникальное имя героя (от 3 до 18 символов).');
      return;
    }
    setCreating(true);
    setCreateError(null);
    const res = await onCreateCharacter(trimmed, selectedClass);
    setCreating(false);
    if (!res.ok) {
      setCreateError(res.error ?? 'Не удалось создать персонажа.');
      return;
    }
    setNameInput('');
    setNameStatus({ checking: false, available: null });
    if (res.character) {
      setSelectedCharId(res.character.id);
    }
    setMode('lobby');
  };

  const handleDeleteSlotClick = async (charId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId !== charId) {
      setConfirmDeleteId(charId);
      return;
    }
    setConfirmDeleteId(null);
    await onDeleteCharacter(charId);
  };

  const getTerritoryLabel = (territoryId: string, inBloodCastle: boolean): string => {
    if (inBloodCastle) return 'Blood Castle';
    return TERRITORIES.find((t) => t.id === territoryId)?.name ?? territoryId;
  };

  const emptySlotCount = Math.max(0, maxSlots - characters.length);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-between overflow-y-auto bg-[#07060a] text-[#f3efe6]"
      role="region"
      aria-label="Меню аккаунта и выбор персонажа"
    >
      {/* Background Key Art with Resilient CSS Fallback & Left Negative-Space Scrim */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {!imgFailed ? (
          <img
            src="/src/assets/images/title_bg_1795377174887.jpg"
            alt="Тёмная готическая цитадель континента MU"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover object-right opacity-85"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_72%_42%,#2a1e17_0%,#110d16_52%,#060508_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#07060a] via-[#07060a]/88 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07060a] via-transparent to-[#07060a]/60" />
      </div>

      {/* Main Content anchored in Left/Center Negative Space */}
      <div className="mu-title-container-compact relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 py-5 sm:px-10 lg:px-14">
        <div className="max-w-3xl">
          {/* Custom Inline SVG Title Crest Lockup */}
          <div className="mu-title-crest-compact mb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <svg
                viewBox="0 0 84 84"
                className="h-14 w-14 shrink-0 drop-shadow-[0_4px_16px_rgba(212,168,83,0.45)] sm:h-16 sm:w-16"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="muGold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fde68a" />
                    <stop offset="50%" stopColor="#d4a853" />
                    <stop offset="100%" stopColor="#85581A" />
                  </linearGradient>
                </defs>
                <path
                  d="M42 4 L54 18 L78 10 L66 34 L76 48 L56 54 L42 80 L28 54 L8 48 L18 34 L6 10 L30 18 Z"
                  fill="#14111a"
                  stroke="url(#muGold)"
                  strokeWidth="2.5"
                />
                <path
                  d="M24 30 L33 54 L42 36 L51 54 L60 30"
                  fill="none"
                  stroke="url(#muGold)"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="42" cy="21" r="4" fill="#f59e0b" />
              </svg>

              <div>
                <p className="mu-title-subtitle-compact text-[11px] font-medium tracking-widest text-amber-300/80">
                  СЕРВЕРНЫЕ ПЕРСОНАЖИ · ПРОГРЕСС СОХРАНЯЕТСЯ В БАЗЕ ДАННЫХ
                </p>
                <h1
                  className="font-display text-2xl font-extrabold tracking-tight text-[#fdf8ed] sm:text-4xl"
                  style={{ textWrap: 'balance' }}
                >
                  MU: КОНТИНЕНТ ЛЕГЕНД
                </h1>
              </div>
            </div>

            <div
              data-testid="character-slot-counter"
              className="shrink-0 rounded-xl border border-amber-500/35 bg-[#151120]/90 px-3 py-1.5 text-right font-mono-num"
            >
              <div className="text-[10px] uppercase tracking-wider text-[#b5ab9b]">
                Слоты героев
              </div>
              <div className="text-sm font-extrabold text-amber-300">
                {characters.length} / {maxSlots}
              </div>
            </div>
          </div>

          {loadingCharacters ? (
            <div className="gothic-panel rounded-2xl p-6 text-center text-sm text-amber-200">
              Загрузка сохранённых персонажей с сервера...
            </div>
          ) : mode === 'lobby' && characters.length > 0 ? (
            /* 3-SLOT CHARACTER SELECTION LOBBY */
            <div data-testid="character-lobby-view">
              <p className="mu-title-subtitle-compact mb-3 text-xs leading-relaxed text-[#cfc6b8] sm:text-sm">
                Выберите созданного героя, чтобы продолжить с сохранённой точки, ОЗ и экипировкой, или создайте нового персонажа (до {maxSlots} героев на аккаунт).
              </p>

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {characters.map((char, index) => {
                  const isSelected = selectedCharacter?.id === char.id;
                  const cls = CLASSES[char.player.classId];
                  const derived = calculateDerivedStats(char.player);
                  const displayHp =
                    char.currentHp > 0 ? Math.min(derived.maxHp, char.currentHp) : derived.maxHp;
                  const terrName = getTerritoryLabel(
                    char.player.territoryId,
                    char.player.inBloodCastle
                  );

                  return (
                    <div
                      key={char.id}
                      role="button"
                      tabIndex={0}
                      data-testid={`character-slot-card-${index}`}
                      data-character-name={char.nickname}
                      onClick={() => {
                        setSelectedCharId(char.id);
                        setConfirmDeleteId(null);
                      }}
                      onDoubleClick={() => onEnterCharacter(char)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedCharId(char.id);
                        }
                      }}
                      className={`relative flex flex-col justify-between rounded-xl p-3 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#211a2e] ring-2 ring-amber-400 shadow-[0_0_25px_rgba(212,168,83,0.3)]'
                          : 'border border-amber-500/25 bg-[#13101a]/92 hover:border-amber-400/60 hover:bg-[#191522]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <div className="truncate font-display text-base font-extrabold text-[#fdf8ed]">
                            {char.nickname}
                          </div>
                          <div className="truncate text-[11px] font-semibold text-amber-300">
                            {getClassDisplayTitle(char.player.classId, char.player.classTier)}
                          </div>
                        </div>
                        <span
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cls.accentColor }}
                          aria-hidden="true"
                        />
                      </div>

                      <div className="my-2 flex justify-center">
                        <HeroModelPreview
                          player={char.player}
                          width={104}
                          height={104}
                          scale={1.18}
                        />
                      </div>

                      <div className="flex flex-col gap-1 border-t border-white/10 pt-2 font-mono-num text-[11px]">
                        <div className="flex items-center justify-between text-[#f3efe6]">
                          <span>
                            Ур. <strong className="text-amber-300">{char.player.level}</strong>
                            {char.player.resets > 0 ? ` · ${char.player.resets} Res` : ''}
                          </span>
                          <span className="text-amber-200">{char.player.zen} Zen</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 text-[10px] text-[#cfc6b8]">
                          <span className="min-w-0 truncate">📍 {terrName}</span>
                          <span className="shrink-0 whitespace-nowrap text-rose-300">
                            ❤ {displayHp}/{derived.maxHp}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-1.5 border-t border-white/10 pt-2">
                        <span className="font-mono-num text-[9.5px] text-[#9c9283]">
                          X:{Math.round(char.posX)} Y:{Math.round(char.posY)}
                        </span>
                        <button
                          type="button"
                          data-testid={`delete-character-${index}`}
                          onClick={(e) => void handleDeleteSlotClick(char.id, e)}
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
                            confirmDeleteId === char.id
                              ? 'bg-rose-600 text-white'
                              : 'border border-rose-500/35 bg-rose-950/35 text-rose-200 hover:bg-rose-600/40'
                          }`}
                        >
                          {confirmDeleteId === char.id ? 'Точно удалить?' : 'Удалить'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {Array.from({ length: emptySlotCount }).map((_, idx) => (
                  <button
                    key={`empty_slot_${idx}`}
                    type="button"
                    data-testid={`create-slot-button-${characters.length + idx}`}
                    onClick={() => {
                      setCreateError(null);
                      setNameInput('');
                      setNameStatus({ checking: false, available: null });
                      setMode('create');
                    }}
                    className="flex min-h-[210px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-500/30 bg-[#120f1a]/80 p-4 text-center transition-colors hover:border-amber-400/75 hover:bg-[#191426] cursor-pointer"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/45 bg-amber-500/15 font-display text-2xl font-bold text-amber-300">
                      +
                    </span>
                    <span className="font-display text-sm font-bold text-[#fdf8ed]">
                      Создать персонажа
                    </span>
                    <span className="text-[11px] text-[#a99f90]">
                      Свободный слот {characters.length + idx + 1} из {maxSlots}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-start="true"
                  data-testid="enter-world-button"
                  disabled={!selectedCharacter}
                  onClick={() => {
                    if (selectedCharacter) {
                      onEnterCharacter(selectedCharacter);
                    }
                  }}
                  className="mu-title-cta-compact min-h-[50px] rounded-xl bg-amber-500 px-8 py-3 font-display text-base font-bold tracking-wide text-[#09080c] shadow-[0_8px_24px_rgba(245,158,11,0.38)] transition-transform hover:bg-amber-400 active:scale-95 disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Войти в мир {selectedCharacter ? `· ${selectedCharacter.nickname}` : ''}
                </button>

                {canCreateMore && (
                  <button
                    type="button"
                    data-testid="open-create-character-button"
                    onClick={() => {
                      setCreateError(null);
                      setNameInput('');
                      setNameStatus({ checking: false, available: null });
                      setMode('create');
                    }}
                    className="gothic-button min-h-[48px] rounded-xl px-4 py-2.5 text-xs font-bold text-amber-200 cursor-pointer"
                  >
                    + Новый персонаж ({characters.length}/{maxSlots})
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* CHARACTER CREATION VIEW (0 characters on first visit, or clicking empty slot) */
            <form onSubmit={(e) => void handleSubmitCreate(e)} data-testid="character-create-view">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs leading-relaxed text-[#cfc6b8] sm:text-sm">
                  {characters.length === 0
                    ? 'У вас пока нет персонажей. Выберите уникальное на весь сервер имя и класс, чтобы создать первого героя (всего можно создать до 3 персонажей).'
                    : `Создание персонажа (Слот ${characters.length + 1} из ${maxSlots}). Имя должно быть уникальным для всего сервера.`}
                </p>
                {characters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCreateError(null);
                      setMode('lobby');
                    }}
                    className="gothic-button rounded-xl px-3 py-1.5 text-xs font-bold text-amber-200 cursor-pointer"
                  >
                    ← К моим героям ({characters.length}/{maxSlots})
                  </button>
                )}
              </div>

              {/* Unique Server-Wide Name Input */}
              <div className="mb-4 rounded-xl border border-amber-500/35 bg-[#14101f]/95 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label
                    htmlFor="create-char-name"
                    className="shrink-0 text-xs font-bold text-amber-300"
                  >
                    Уникальное имя героя:
                  </label>
                  <div className="relative flex-1">
                    <input
                      id="create-char-name"
                      type="text"
                      value={nameInput}
                      maxLength={18}
                      autoComplete="off"
                      placeholder="Например: DarkLord77 или Артас"
                      data-testid="create-character-name-input"
                      onChange={(e) => {
                        setNameInput(e.target.value);
                        setCreateError(null);
                      }}
                      className="w-full rounded-lg border border-amber-500/40 bg-[#0b0912] px-3 py-2 text-sm font-semibold text-[#fdf8ed] placeholder-[#756b5e] focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div className="min-w-[175px] text-xs font-semibold">
                    {nameStatus.checking ? (
                      <span className="text-amber-200">Проверка имени...</span>
                    ) : nameStatus.available === true ? (
                      <span
                        data-testid="name-status-available"
                        className="text-emerald-300"
                      >
                        ✓ Имя свободно
                      </span>
                    ) : nameStatus.available === false ? (
                      <span
                        data-testid="name-status-taken"
                        className="text-rose-400"
                      >
                        ✕ {nameStatus.reason ?? 'Имя занято'}
                      </span>
                    ) : (
                      <span className="text-[#9c9283]">3–18 символов (RU/EN, 0-9, _ -)</span>
                    )}
                  </div>
                </div>
                {createError && (
                  <p
                    data-testid="create-character-error"
                    className="mt-2 rounded-lg border border-rose-500/40 bg-rose-950/40 px-2.5 py-1.5 text-xs font-semibold text-rose-300"
                  >
                    ⚠ {createError}
                  </p>
                )}
              </div>

              {/* 3-Class Selection Cards */}
              <div
                className="mu-title-cards-compact mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Выбор класса персонажа"
              >
                {(Object.keys(CLASSES) as CharacterClassId[]).map((id) => {
                  const cls = CLASSES[id];
                  const isSelected = selectedClass === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectClass(id)}
                      aria-pressed={isSelected}
                      data-testid={`select-class-${id}`}
                      className={`mu-title-card-compact group flex min-h-[120px] flex-col justify-between rounded-xl p-3.5 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#211a2b] ring-2 ring-amber-400 shadow-[0_0_25px_rgba(212,168,83,0.28)]'
                          : 'bg-[#13101a]/90 border border-amber-500/25 hover:border-amber-400/60 hover:bg-[#191522]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm sm:text-base font-bold text-[#fdf8ed] truncate">
                            {cls.name}
                          </span>
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: cls.accentColor }}
                            aria-hidden="true"
                          />
                        </div>
                        <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-amber-300/90 truncate">
                          1→3 Проф: {cls.tierTitles[2].split(' ')[0]} · {cls.tierTitles[3].split(' ')[0]}
                        </p>
                        <p className="mu-title-card-lore-compact mt-1 text-xs leading-snug text-[#bfb6a8]">
                          {cls.loreShort}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-1.5 text-[10px] sm:text-[11px] text-[#d6cec2] font-mono-num">
                        <span>СИЛ {cls.baseAttributes.str}</span>
                        <span aria-hidden="true">·</span>
                        <span>ЛОВ {cls.baseAttributes.agi}</span>
                        <span aria-hidden="true">·</span>
                        <span>ЭНР {cls.baseAttributes.ene}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Class 2.5D Model, Skill Books & Progression Preview */}
              <div className="mu-title-preview-compact gothic-panel mb-4 flex flex-col gap-3 rounded-xl p-3.5 sm:flex-row sm:items-center">
                <div className="flex shrink-0 flex-col items-center">
                  <HeroModelPreview player={previewPlayer} width={104} height={104} scale={1.18} />
                  <span className="mt-1 text-[10px] font-semibold text-amber-300/90">
                    {nameInput.trim() || currentClass.name} (1 Ур.)
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[11px] sm:text-xs font-semibold text-amber-300">
                      📚 Книги Навыков ({getClassDisplayTitle(selectedClass, 1)}):
                    </span>
                    <span className="mu-top-hide-short text-xs text-emerald-300">
                      Прогресс, вещи, ОЗ и координаты сохраняются на сервере
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {currentClass.skills.map((sk) => (
                      <div
                        key={sk.id}
                        className="rounded-lg bg-[#16121e] px-2 py-1.5 border border-amber-500/20"
                      >
                        <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-[#f7f2e8]">
                          <span className="truncate">{sk.name}</span>
                          <span className="font-mono-num text-amber-300">[{sk.keyBinding}]</span>
                        </div>
                        <p className="mt-0.5 text-[9.5px] sm:text-[10px] font-mono-num text-amber-200/90 truncate">
                          Ур.{sk.requiredLevel} · {sk.bookPriceZen} Zen
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Create Submit CTA */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  data-testid="create-character-submit"
                  disabled={
                    creating ||
                    nameInput.trim().length < 3 ||
                    nameStatus.available === false
                  }
                  className="mu-title-cta-compact min-h-[50px] rounded-xl bg-amber-500 px-8 py-3 font-display text-base font-bold tracking-wide text-[#09080c] shadow-[0_8px_24px_rgba(245,158,11,0.38)] transition-transform hover:bg-amber-400 active:scale-95 disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {creating ? 'Создание...' : 'Создать персонажа'}
                </button>
                <span className="text-[11px] sm:text-xs text-[#bfb6a6]">
                  После создания герой появится в вашем меню (до {maxSlots} персонажей)
                </span>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Bottom Safe-Margin Single Flat Borderless Control Hint Line */}
      <div className="mu-title-footer-compact relative z-10 px-5 pb-3 pt-1 text-center sm:px-10 sm:text-left">
        <p className="text-xs text-[#9c9283]">
          WASD / Клик Движение · Пробел Атака · 1–4 Навыки · V Инвентарь (Ctrl+ЛКМ в Лавке — продать) · C Статы · K Хаос · P Меню
        </p>
      </div>
    </div>
  );
};
