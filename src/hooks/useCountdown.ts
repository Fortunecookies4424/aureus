import { useState, useEffect } from 'react';

export interface Countdown {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isComplete: boolean;
}

function computeNextMidnightUTC(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return next.getTime();
}

export function useCountdownToNextDay(): Countdown {
  const [target] = useState(() => computeNextMidnightUTC());
  const [countdown, setCountdown] = useState<Countdown>(() => calc(target));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(calc(target));
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  return countdown;
}

function calc(targetMs: number): Countdown {
  const diff = targetMs - Date.now();
  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isComplete: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds, totalSeconds, isComplete: false };
}
