// Small formatting helpers shared by the simulation text and the UI.

export function formatDuration(ms: number, opts: { short?: boolean } = {}): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return opts.short ? `${h}h ${m}m` : `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

export function formatNumber(n: number): string {
  if (Math.abs(n) >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString('en-US');
}

export function pct(f: number): string {
  return `${Math.round(f * 100)}%`;
}

export function plural(n: number, word: string, pluralWord?: string): string {
  return `${n} ${n === 1 ? word : pluralWord ?? `${word}s`}`;
}
