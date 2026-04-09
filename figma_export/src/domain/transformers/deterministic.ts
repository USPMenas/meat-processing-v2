export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function deterministicNoise(seed: string | number, amplitude: number): number {
  if (amplitude === 0) {
    return 0;
  }

  const normalizedSeed = String(seed);
  let hash = 0;

  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hash = (hash << 5) - hash + normalizedSeed.charCodeAt(index);
    hash |= 0;
  }

  const normalized = (Math.abs(hash) % 10_000) / 10_000;
  return (normalized * 2 - 1) * amplitude;
}
