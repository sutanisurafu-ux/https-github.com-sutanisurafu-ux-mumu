import React, { useEffect, useState } from 'react';
import { Maximize2, RotateCw } from 'lucide-react';
import {
  detectTouchDevice,
  isMobilePortraitViewport,
  requestMobileLandscapeFullscreen,
} from '../utils/mobileOrientation';

/**
 * Displays a crisp Gothic rotate-to-landscape guard on touch phones held in portrait mode,
 * with a 1-tap button that enters Fullscreen and locks ScreenOrientation to landscape.
 * Never shown on desktop or once the phone is in landscape.
 */
export const MobileOrientationGuard: React.FC = () => {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const evaluate = () => {
      const touch = detectTouchDevice();
      const portrait = isMobilePortraitViewport(window.innerWidth, window.innerHeight, touch);
      setIsPortraitMobile(portrait);
      if (!portrait) {
        setDismissed(false);
      }
    };

    evaluate();
    window.addEventListener('resize', evaluate);
    window.addEventListener('orientationchange', evaluate);
    return () => {
      window.removeEventListener('resize', evaluate);
      window.removeEventListener('orientationchange', evaluate);
    };
  }, []);

  if (!isPortraitMobile || dismissed) return null;

  const handleLockLandscape = async () => {
    const res = await requestMobileLandscapeFullscreen();
    if (res.orientationLocked) {
      setDismissed(true);
    }
  };

  return (
    <div
      data-testid="mobile-landscape-guard"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#07060a]/96 px-6 text-center backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Поверните телефон горизонтально"
    >
      <div className="gothic-panel max-w-sm w-full rounded-xl p-6 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.28)]">
          <RotateCw className="w-8 h-8 animate-spin" style={{ animationDuration: '4s' }} />
        </div>

        <div className="space-y-1.5">
          <h2 className="font-display text-lg font-bold text-[#fde68a]">
            Поверните телефон в альбомный режим
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            MU: Континент Легенд адаптирован под горизонтальный экран, чтобы вся панель навыков,
            сферы HP/MP и поле боя полностью помещались без обрезки.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLockLandscape}
          className="w-full py-3 px-4 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 text-[#0c0907] font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_18px_rgba(245,158,11,0.4)] active:scale-95 transition-transform cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
          <span>Перевернуть в альбомку (Полный экран)</span>
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-4 cursor-pointer"
        >
          Продолжить вертикально
        </button>
      </div>
    </div>
  );
};
