/** Stamina / energy bar config */
export const MAX_ENERGY = 10;
/** Milliseconds to recover 1 point */
export const REGEN_MS = 45_000;
/** Cost per generation (生图 / 变身启动) */
export const GEN_COST = 1;

export const ENERGY_STORAGE_KEY = "chroma-penguin-energy-v1";

export function clampEnergy(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return MAX_ENERGY;
  return Math.max(0, Math.min(MAX_ENERGY, Math.floor(v)));
}

/** Apply offline regen since lastTickAt */
export function applyRegen(energy, lastTickAt, now = Date.now()) {
  let e = clampEnergy(energy);
  let t = typeof lastTickAt === "number" && lastTickAt > 0 ? lastTickAt : now;
  if (e >= MAX_ENERGY) {
    return { energy: MAX_ENERGY, lastTickAt: now, msUntilNext: 0, progress: 1 };
  }
  let elapsed = Math.max(0, now - t);
  const gained = Math.floor(elapsed / REGEN_MS);
  if (gained > 0) {
    e = clampEnergy(e + gained);
    t += gained * REGEN_MS;
    elapsed = Math.max(0, now - t);
  }
  if (e >= MAX_ENERGY) {
    return { energy: MAX_ENERGY, lastTickAt: now, msUntilNext: 0, progress: 1 };
  }
  const msUntilNext = Math.max(0, REGEN_MS - elapsed);
  const progress = 1 - msUntilNext / REGEN_MS;
  return { energy: e, lastTickAt: t, msUntilNext, progress };
}

export function formatSeconds(ms) {
  return Math.max(1, Math.ceil(ms / 1000));
}
