import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';

interface SessionReplacedModalProps {
  reason: string;
  onContinueHere: () => void;
  onReturnToLobby: () => void;
}

export function SessionReplacedModal({
  reason,
  onContinueHere,
  onReturnToLobby,
}: SessionReplacedModalProps) {
  return (
    <div
      data-testid="session-replaced-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-replaced-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-amber-500/40 bg-gradient-to-b from-[#1a1420] to-[#100c14] p-6 shadow-2xl shadow-black/80">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/15 text-amber-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2
              id="session-replaced-title"
              className="font-serif text-lg font-bold tracking-wide text-amber-200"
            >
              Сессия перенесена в другую вкладку
            </h2>
            <p className="text-xs text-stone-400">
              Защита от дублирования персонажа на сервере
            </p>
          </div>
        </div>

        <p className="mb-3 rounded-lg border border-stone-700/70 bg-black/40 px-3.5 py-2.5 text-sm leading-relaxed text-stone-200">
          {reason}
        </p>
        <p className="mb-5 text-xs leading-relaxed text-stone-400">
          На сервере может быть активен только один экземпляр игрока. Эта вкладка отключена,
          чтобы избежать конфликтов и потери прогресса.
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onContinueHere}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-amber-400/60 bg-gradient-to-b from-amber-600 to-amber-700 px-4 py-2.5 text-sm font-bold text-amber-50 shadow-md transition hover:from-amber-500 hover:to-amber-600 active:scale-[0.99]"
          >
            <RefreshCw className="h-4 w-4" />
            Продолжить здесь
          </button>
          <button
            type="button"
            onClick={onReturnToLobby}
            className="flex items-center justify-center gap-2 rounded-lg border border-stone-600/70 bg-stone-800/80 px-4 py-2.5 text-sm font-semibold text-stone-200 transition hover:border-stone-500 hover:bg-stone-700/80"
          >
            <LogOut className="h-4 w-4" />
            В меню
          </button>
        </div>
      </div>
    </div>
  );
}
