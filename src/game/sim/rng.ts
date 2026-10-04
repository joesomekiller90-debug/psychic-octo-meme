// Deterministic random numbers. All randomness in the simulation flows from
// seeds stored in the save, so re-simulating the same span always produces the
// same result (no duplicated or re-rolled rewards after a refresh).

/** 32-bit integer hash of any number of integers (xmur3/murmur-style mix). */
export function hash32(...parts: number[]): number {
  let h = 0x9e3779b9 ^ parts.length;
  for (const p of parts) {
    let k = Math.imul((p | 0) ^ ((p / 4294967296) | 0), 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash a string to a 32-bit integer (for ids). */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A float in [0,1) derived purely from the given integers. */
export function randAt(...parts: number[]): number {
  return hash32(...parts) / 4294967296;
}

/** Small fast PRNG (mulberry32) for sequences such as a single fight. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  weighted<T extends { weight: number }>(arr: readonly T[]): T {
    const total = arr.reduce((s, a) => s + a.weight, 0);
    let r = this.next() * total;
    for (const a of arr) {
      r -= a.weight;
      if (r < 0) return a;
    }
    return arr[arr.length - 1];
  }
  /** Round a fractional amount up or down with probability equal to the fraction. */
  roundStochastic(x: number): number {
    const f = Math.floor(x);
    return f + (this.next() < x - f ? 1 : 0);
  }
}
