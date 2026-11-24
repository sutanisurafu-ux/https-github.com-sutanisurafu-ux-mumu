import React, { useEffect, useMemo, useRef } from 'react';
import { drawHeroModel } from '../game/models';
import { calculateDerivedStats } from '../game/rules';
import { PlayerProgressState } from '../game/types';

interface HeroModelPreviewProps {
  player: PlayerProgressState;
  width?: number;
  height?: number;
  scale?: number;
}

export const HeroModelPreview: React.FC<HeroModelPreviewProps> = React.memo(({
  player,
  width = 150,
  height = 150,
  scale = 1.35,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeSetPieceCount = useMemo(
    () => calculateDerivedStats(player).activeSetPieceCount,
    [player]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const hasWings = player.equipped.wings !== null;

    const renderFrame = (nowMs: number) => {
      ctx.clearRect(0, 0, width, height);

      // Background pedestal spotlight
      const grad = ctx.createRadialGradient(
        width / 2,
        height * 0.58,
        8,
        width / 2,
        height * 0.58,
        width * 0.48
      );
      grad.addColorStop(0, hasWings ? 'rgba(56, 189, 248, 0.24)' : 'rgba(212, 168, 83, 0.24)');
      grad.addColorStop(1, 'rgba(14, 12, 18, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2, height * (hasWings ? 0.8 : 0.77));
      drawHeroModel(ctx, {
        classId: player.classId,
        classTier: player.classTier,
        facingAngle: 0.18,
        walkDistance: 0,
        isMoving: false,
        attackPhase: 'idle',
        attackTimer: 0,
        hitFlash: false,
        weapon: player.equipped.weapon,
        armor: player.equipped.armor,
        helm: player.equipped.helm,
        wings: player.equipped.wings,
        activeSetPieceCount,
        now: nowMs,
        scale,
      });
      ctx.restore();
    };

    if (!hasWings) {
      renderFrame(1200);
      return;
    }

    renderFrame(performance.now());
    const intervalId = window.setInterval(() => {
      renderFrame(performance.now());
    }, 80);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    player.classId,
    player.classTier,
    player.equipped.weapon,
    player.equipped.armor,
    player.equipped.helm,
    player.equipped.wings,
    activeSetPieceCount,
    width,
    height,
    scale,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      aria-label="3D-модель героя с текущей экипировкой"
      className="rounded-xl border border-amber-500/30 bg-[#110e18]"
    />
  );
});
