import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ServerOnlinePlayerEntry } from '../game/party';

interface ServerOnlineWidgetProps {
  variant?: 'hud' | 'lobby';
  syncTrigger?: number;
}

export const ServerOnlineWidget: React.FC<ServerOnlineWidgetProps> = ({
  variant = 'hud',
  syncTrigger = 0,
}) => {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [players, setPlayers] = useState<ServerOnlinePlayerEntry[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchOnline = useCallback(async () => {
    try {
      const res = await fetch('/api/server/online', {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        count?: number;
        players?: ServerOnlinePlayerEntry[];
      };
      if (data.ok) {
        setCount(typeof data.count === 'number' ? data.count : 0);
        setPlayers(Array.isArray(data.players) ? data.players : []);
      }
    } catch {
      // Non-fatal transient fetch failure
    }
  }, []);

  useEffect(() => {
    void fetchOnline();
    const timer = window.setInterval(() => {
      void fetchOnline();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fetchOnline, syncTrigger]);

  useEffect(() => {
    if (!open) return;
    void fetchOnline();

    const handleClickOutside = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, fetchOnline]);

  const isLobby = variant === 'lobby';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="server-online-toggle"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Онлайн на сервере: ${count}`}
        onClick={() => setOpen((prev) => !prev)}
        className={
          isLobby
            ? 'flex min-h-[38px] items-center gap-2 rounded-xl border border-emerald-500/40 bg-[#111917]/90 px-3 py-1.5 font-mono-num text-xs font-bold text-emerald-200 shadow-md transition-colors hover:border-emerald-400/70 hover:bg-[#15221e] cursor-pointer'
            : 'flex items-center gap-1.5 bg-[#0b090c]/88 backdrop-blur-sm border border-emerald-500/45 px-2 py-0.5 font-mono text-[10px] sm:text-[11px] font-bold text-emerald-200 shadow transition-colors hover:border-emerald-400/80 hover:bg-[#101a17]/95 cursor-pointer'
        }
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            count > 0
              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.85)]'
              : 'bg-stone-500'
          }`}
          aria-hidden="true"
        />
        <span>Онлайн: {count}</span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-emerald-300/80" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-emerald-300/80" />
        )}
      </button>

      {open && (
        <div
          data-testid="server-online-list"
          role="listbox"
          aria-label="Персонажи онлайн"
          className={`absolute right-0 z-50 mt-1.5 w-56 overflow-hidden border border-[#7c6542]/70 bg-[#0d0b12]/96 shadow-[0_14px_36px_rgba(0,0,0,0.92)] backdrop-blur-md ${
            isLobby ? 'rounded-xl' : 'rounded-lg'
          }`}
        >
          {players.length === 0 ? (
            <div className="px-3 py-2.5 text-center text-xs text-stone-400">
              Сейчас никого нет в сети
            </div>
          ) : (
            <ul className="max-h-56 divide-y divide-white/5 overflow-y-auto py-1">
              {players.map((entry, idx) => (
                <li
                  key={`${entry.nickname}_${idx}`}
                  role="option"
                  aria-selected={false}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
                >
                  <span className="truncate font-semibold text-[#f3efe6]">{entry.nickname}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
                      aria-hidden="true"
                    />
                    Онлайн
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
