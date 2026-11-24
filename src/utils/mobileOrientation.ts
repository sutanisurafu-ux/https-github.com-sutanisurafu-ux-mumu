/**
 * Helpers for locking mobile devices into landscape orientation & fullscreen mode,
 * and detecting portrait phone viewports where we prompt the user to rotate.
 */

export function isMobilePortraitViewport(
  width: number,
  height: number,
  isTouchDevice: boolean
): boolean {
  if (!isTouchDevice) return false;
  return height > width && width < 768;
}

export function isCompactLandscapeViewport(width: number, height: number): boolean {
  return width > height && height <= 540;
}

export function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

/**
 * Best-effort request to enter Fullscreen + lock Screen Orientation to landscape.
 * Works natively on Android Chrome/Edge/Firefox & installed PWAs; safely no-ops on
 * iOS Safari / desktop browsers that restrict ScreenOrientation.lock().
 */
export async function requestMobileLandscapeFullscreen(): Promise<{
  fullscreenEntered: boolean;
  orientationLocked: boolean;
}> {
  let fullscreenEntered = false;
  let orientationLocked = false;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { fullscreenEntered, orientationLocked };
  }

  try {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const isAlreadyFs = Boolean(
      document.fullscreenElement ||
        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement
    );
    if (!isAlreadyFs) {
      if (typeof docEl.requestFullscreen === 'function') {
        await docEl.requestFullscreen();
        fullscreenEntered = true;
      } else if (typeof docEl.webkitRequestFullscreen === 'function') {
        await docEl.webkitRequestFullscreen();
        fullscreenEntered = true;
      }
    } else {
      fullscreenEntered = true;
    }
  } catch {
    // Fullscreen may be blocked by iframe policy or iOS Safari — continue to orientation lock attempt
  }

  try {
    const orientation = window.screen?.orientation as
      | (ScreenOrientation & { lock?: (orientation: string) => Promise<void> })
      | undefined;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape');
      orientationLocked = true;
    }
  } catch {
    // Orientation lock requires fullscreen on some mobile browsers or is unsupported on iOS Safari
  }

  return { fullscreenEntered, orientationLocked };
}
