import { useEffect } from 'react';

export function useUnlockFx(nodeIds: string[]) {
  useEffect(() => {
    if (!nodeIds.length || typeof window === 'undefined') {
      return;
    }

    const liveRegion = document.getElementById('live-region');
    if (liveRegion) {
      const message =
        nodeIds.length === 1
          ? `새 스킬이 열렸습니다: ${nodeIds[0]}`
          : `새 스킬이 열렸습니다: ${nodeIds.join(', ')}`;
      liveRegion.textContent = message;
    }

    const cleanup: Array<() => void> = [];
    nodeIds.forEach((id) => {
      const element = document.getElementById(`skill-${id}`);
      if (!element) {
        return;
      }
      element.classList.add('skill-card--unlock-ping', 'skill-card--scale-in');
      const timer = window.setTimeout(() => {
        element.classList.remove('skill-card--unlock-ping', 'skill-card--scale-in');
      }, 1400);
      cleanup.push(() => window.clearTimeout(timer));
    });

    return () => {
      cleanup.forEach((fn) => fn());
    };
  }, [nodeIds]);
}
