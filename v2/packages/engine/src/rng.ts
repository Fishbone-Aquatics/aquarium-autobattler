/** Small deterministic PRNG (mulberry32) so battles, shops and the AI are reproducible. */
export interface Rng {
  next(): number;
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
  readonly state: number;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    pick: (items) => items[int(items.length)],
    weighted: (items, weight) => {
      const total = items.reduce((sum, item) => sum + weight(item), 0);
      let roll = next() * total;
      for (const item of items) {
        roll -= weight(item);
        if (roll < 0) return item;
      }
      return items[items.length - 1];
    },
    get state() {
      return s;
    },
  };
}
