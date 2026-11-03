"use client";

import { useEffect, useState } from "react";

/**
 * A stable, periodically refreshed timestamp for "upcoming" calculations.
 * `Date.now()` must not be called during render (React purity); module-level
 * evaluation gives a correct first paint and an effect keeps it fresh without
 * making each render produce a different value.
 */
const INITIAL_NOW = Date.now();

export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(INITIAL_NOW);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
