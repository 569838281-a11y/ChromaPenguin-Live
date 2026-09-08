import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isSupabaseConfigured, supabase } from "@/config/supabase";
import {
  ENERGY_STORAGE_KEY,
  GEN_COST,
  MAX_ENERGY,
  applyRegen,
  clampEnergy,
  formatSeconds,
} from "./energyConfig.js";

const EnergyContext = createContext(null);

function readLocal() {
  try {
    const raw = localStorage.getItem(ENERGY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLocal(energy, lastTickAt) {
  try {
    localStorage.setItem(
      ENERGY_STORAGE_KEY,
      JSON.stringify({ energy: clampEnergy(energy), lastTickAt, savedAt: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

async function pushEnergyToCloud(energy) {
  if (!isSupabaseConfigured) return;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    await supabase
      .from("profiles")
      .update({ energy: clampEnergy(energy) })
      .eq("id", session.user.id);
  } catch (err) {
    console.warn("[energy] sync failed", err);
  }
}

export function EnergyProvider({ children, userEnergy = null, userId = null }) {
  const [energy, setEnergy] = useState(MAX_ENERGY);
  const [lastTickAt, setLastTickAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const energyRef = useRef(energy);
  const tickRef = useRef(lastTickAt);
  const syncedUserRef = useRef(null);

  useEffect(() => {
    energyRef.current = energy;
  }, [energy]);
  useEffect(() => {
    tickRef.current = lastTickAt;
  }, [lastTickAt]);

  useEffect(() => {
    const local = readLocal();
    if (local && typeof local.energy === "number") {
      const r = applyRegen(local.energy, local.lastTickAt, Date.now());
      setEnergy(r.energy);
      setLastTickAt(r.lastTickAt);
      energyRef.current = r.energy;
      tickRef.current = r.lastTickAt;
      writeLocal(r.energy, r.lastTickAt);
    }
  }, []);

  useEffect(() => {
    if (userEnergy == null || !userId) return;
    if (syncedUserRef.current === userId) return;
    syncedUserRef.current = userId;

    const local = readLocal();
    const base = clampEnergy(userEnergy > MAX_ENERGY ? MAX_ENERGY : userEnergy);
    const tick = local?.lastTickAt || Date.now();
    const r = applyRegen(base, tick, Date.now());
    setEnergy(r.energy);
    setLastTickAt(r.lastTickAt);
    energyRef.current = r.energy;
    tickRef.current = r.lastTickAt;
    writeLocal(r.energy, r.lastTickAt);
    if (r.energy !== clampEnergy(Math.min(userEnergy, MAX_ENERGY))) {
      pushEnergyToCloud(r.energy);
    }
  }, [userEnergy, userId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const r = applyRegen(energyRef.current, tickRef.current, t);
      if (r.energy !== energyRef.current || r.lastTickAt !== tickRef.current) {
        const gained = r.energy > energyRef.current;
        energyRef.current = r.energy;
        tickRef.current = r.lastTickAt;
        setEnergy(r.energy);
        setLastTickAt(r.lastTickAt);
        writeLocal(r.energy, r.lastTickAt);
        if (gained) pushEnergyToCloud(r.energy);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const snapshot = useMemo(
    () => applyRegen(energy, lastTickAt, now),
    [energy, lastTickAt, now],
  );

  const persist = useCallback((nextEnergy, nextTick) => {
    energyRef.current = nextEnergy;
    tickRef.current = nextTick;
    setEnergy(nextEnergy);
    setLastTickAt(nextTick);
    writeLocal(nextEnergy, nextTick);
    pushEnergyToCloud(nextEnergy);
  }, []);

  const trySpend = useCallback(
    (cost = GEN_COST) => {
      const r = applyRegen(energyRef.current, tickRef.current, Date.now());
      if (r.energy < cost) {
        return {
          ok: false,
          energy: r.energy,
          need: cost,
          message: `体力不足！当前 ${r.energy}/${MAX_ENERGY}，生图需要 ${cost} 格。请等待恢复后再试～`,
        };
      }
      const next = r.energy - cost;
      const nextTick = next >= MAX_ENERGY ? Date.now() : r.lastTickAt;
      persist(next, nextTick);
      return { ok: true, energy: next };
    },
    [persist],
  );

  const canSpend = useCallback(
    (cost = GEN_COST) => applyRegen(energyRef.current, tickRef.current, Date.now()).energy >= cost,
    [],
  );

  const refund = useCallback(
    (amount = GEN_COST) => {
      const r = applyRegen(energyRef.current, tickRef.current, Date.now());
      const next = clampEnergy(r.energy + amount);
      persist(next, r.lastTickAt);
      return next;
    },
    [persist],
  );

  const value = useMemo(
    () => ({
      energy: snapshot.energy,
      maxEnergy: MAX_ENERGY,
      genCost: GEN_COST,
      msUntilNext: snapshot.msUntilNext,
      progress: snapshot.progress,
      secondsUntilNext: snapshot.energy >= MAX_ENERGY ? 0 : formatSeconds(snapshot.msUntilNext),
      isFull: snapshot.energy >= MAX_ENERGY,
      trySpend,
      canSpend,
      refund,
    }),
    [snapshot, trySpend, canSpend, refund],
  );

  return <EnergyContext.Provider value={value}>{children}</EnergyContext.Provider>;
}

export function useEnergy() {
  const ctx = useContext(EnergyContext);
  if (!ctx) throw new Error("useEnergy must be used within EnergyProvider");
  return ctx;
}
