// Save handling.
//
// * Two alternating slots (A/B). Each write goes to the slot not holding the
//   newest save, so an interrupted or corrupted write never destroys the last
//   good save. Load picks the newest slot whose checksum verifies.
// * Every save carries a schema version; older versions are migrated, then
//   normalised against a fresh state so missing or malformed fields get safe
//   defaults rather than crashing the game.
import { ACTIONS } from '../data/actions';
import { CONTRACTS, DOCTRINES, LORE, UPGRADES } from '../data/camp';
import { ENEMIES } from '../data/enemies';
import { HEROES, MAX_HERO_LEVEL, MAX_PARTY } from '../data/heroes';
import { ITEMS } from '../data/items';
import { SKILL_ORDER } from '../data/skills';
import { DISCOVERIES, ROUTES } from '../data/world';
import { createInitialState, SAVE_VERSION, type GameState } from '../sim/state';

export const SAVE_KEYS = ['kindled-roads:slot-a', 'kindled-roads:slot-b'] as const;
const APP = 'kindled-roads';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface Envelope {
  app: string;
  seq: number;
  savedAt: number;
  version: number;
  checksum: string;
  data: string;
}

export function checksum(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function encodeEnvelope(state: GameState, seq: number, now: number): string {
  const data = JSON.stringify(state);
  const env: Envelope = { app: APP, seq, savedAt: now, version: state.version, checksum: checksum(data), data };
  return JSON.stringify(env);
}

type Decoded = { ok: true; seq: number; raw: unknown; savedAt: number } | { ok: false; error: string };

export function decodeEnvelope(text: string | null): Decoded {
  if (!text) return { ok: false, error: 'empty' };
  try {
    const env = JSON.parse(text) as Envelope;
    if (!env || env.app !== APP || typeof env.data !== 'string') return { ok: false, error: 'not a Kindled Roads save' };
    if (checksum(env.data) !== env.checksum) return { ok: false, error: 'checksum mismatch (the save was damaged or cut off)' };
    return { ok: true, seq: Number(env.seq) || 0, raw: JSON.parse(env.data), savedAt: Number(env.savedAt) || 0 };
  } catch {
    return { ok: false, error: 'unreadable data' };
  }
}

export function writeSave(storage: StorageLike, state: GameState, now: number): { ok: boolean; error?: string } {
  const seq = state.saveSeq + 1;
  try {
    state.saveSeq = seq;
    const text = encodeEnvelope(state, seq, now);
    storage.setItem(SAVE_KEYS[seq % 2], text);
    return { ok: true };
  } catch (e) {
    state.saveSeq = seq - 1;
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface LoadResult {
  state: GameState | null;
  notes: string[];
}

export function loadSave(storage: StorageLike, now: number): LoadResult {
  const notes: string[] = [];
  const slots = SAVE_KEYS.map((k) => {
    let text: string | null = null;
    try {
      text = storage.getItem(k);
    } catch {
      text = null;
    }
    return { key: k, text, dec: decodeEnvelope(text) };
  });
  const valid = slots
    .filter((s): s is typeof s & { dec: Extract<Decoded, { ok: true }> } => s.dec.ok)
    .sort((a, b) => b.dec.seq - a.dec.seq);
  const damaged = slots.filter((s) => s.text && !s.dec.ok);
  if (valid.length === 0) {
    if (damaged.length) notes.push('Your save could not be read and no backup was available. A new guild ledger has been started.');
    return { state: null, notes };
  }
  const newestDamaged = damaged.some((d) => {
    try {
      const env = JSON.parse(d.text!) as Envelope;
      return (Number(env.seq) || 0) > valid[0].dec.seq;
    } catch {
      return true;
    }
  });
  if (newestDamaged) notes.push('The most recent save was damaged (perhaps the game closed mid-save). Restored from the backup slot a few seconds earlier.');
  for (const v of valid) {
    try {
      const migrated = migrate(v.dec.raw);
      const state = normalize(migrated, now);
      state.saveSeq = Math.max(state.saveSeq, v.dec.seq);
      return { state, notes };
    } catch (e) {
      notes.push(`A save slot could not be loaded (${e instanceof Error ? e.message : 'unknown error'}).`);
    }
  }
  return { state: null, notes };
}

export function clearSave(storage: StorageLike): void {
  for (const k of SAVE_KEYS) {
    try {
      storage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Migrations

type Raw = Record<string, unknown>;

/**
 * Version history:
 *  v1 — prototype ledger: skills stored as { xp } objects, work orders under
 *       `workOrders`, party stored as a plain array of hero ids.
 *  v2 — current format.
 */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  1: (raw) => {
    const out: Raw = { ...raw };
    const skills = raw.skills as Record<string, unknown> | undefined;
    if (skills) {
      out.skills = Object.fromEntries(
        Object.entries(skills).map(([k, v]) => [k, typeof v === 'object' && v !== null ? Number((v as { xp?: number }).xp) || 0 : Number(v) || 0]),
      );
    }
    if (raw.workOrders && !raw.orders) out.orders = raw.workOrders;
    delete out.workOrders;
    if (Array.isArray(raw.party)) out.party = { members: raw.party, rows: {} };
    out.version = 2;
    return out;
  },
};

export function migrate(raw: unknown): Raw {
  if (!raw || typeof raw !== 'object') throw new Error('save data is not an object');
  let r = raw as Raw;
  let v = Number(r.version) || 1;
  if (v > SAVE_VERSION) throw new Error(`save is from a newer version (${v})`);
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`no migration from version ${v}`);
    r = m(r);
    v = Number(r.version) || v + 1;
  }
  return r;
}

// ---------------------------------------------------------------------------
// Normalisation

const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : d;
  return Math.min(max, Math.max(min, n));
};
const intRecord = (v: unknown, valid: (k: string) => boolean): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    if (!valid(k)) continue;
    const x = Math.floor(num(n, 0, 0));
    if (x > 0) out[k] = x;
  }
  return out;
};

export function normalize(raw: Raw, now: number): GameState {
  const base = createInitialState(now, num(raw.worldSeed, 1) >>> 0);
  const s = base;
  s.version = SAVE_VERSION;
  s.createdAt = num(raw.createdAt, now);
  s.lastTick = num(raw.lastTick, now);
  s.nextId = Math.floor(num(raw.nextId, 1, 1));
  s.saveSeq = Math.floor(num(raw.saveSeq, 0, 0));
  s.marks = Math.floor(num(raw.marks, base.marks, 0));
  s.standing = Math.floor(num(raw.standing, 0, 0));
  if (isObj(raw.inventory)) s.inventory = intRecord(raw.inventory, (k) => !!ITEMS[k]);

  if (isObj(raw.skills)) {
    for (const sk of SKILL_ORDER) s.skills[sk] = Math.floor(num(raw.skills[sk], 0, 0));
  }
  if (isObj(raw.heroes)) {
    for (const id of Object.keys(HEROES)) {
      const h = raw.heroes[id];
      if (!isObj(h)) continue;
      const hero = s.heroes[id];
      hero.recruited = typeof h.recruited === 'boolean' ? h.recruited : hero.recruited;
      hero.level = Math.floor(num(h.level, 1, 1, MAX_HERO_LEVEL));
      hero.xp = Math.floor(num(h.xp, 0, 0));
      hero.hp = num(h.hp, hero.hp, 1);
      if (isObj(h.gear)) {
        for (const slot of ['weapon', 'armor', 'trinket'] as const) {
          const g = h.gear[slot];
          hero.gear[slot] = typeof g === 'string' && ITEMS[g]?.equip?.slot === slot ? g : g === null ? null : hero.gear[slot];
        }
      }
    }
  }
  if (isObj(raw.party)) {
    const members = Array.isArray(raw.party.members) ? raw.party.members : [];
    s.party.members = members.filter((m): m is string => typeof m === 'string' && !!s.heroes[m]?.recruited).slice(0, MAX_PARTY);
    if (isObj(raw.party.rows)) {
      for (const [k, v] of Object.entries(raw.party.rows)) if (HEROES[k] && (v === 'front' || v === 'back')) s.party.rows[k] = v;
    }
  }
  if (isObj(raw.tactics)) {
    const t = raw.tactics;
    if (t.focus === 'weakest' || t.focus === 'strongest' || t.focus === 'threats') s.tactics.focus = t.focus;
    s.tactics.tonicAt = num(t.tonicAt, s.tactics.tonicAt, 0, 1);
    if (t.flasks === 'always' || t.flasks === 'finale' || t.flasks === 'never') s.tactics.flasks = t.flasks;
    s.tactics.retreatAt = num(t.retreatAt, s.tactics.retreatAt, 0, 0.9);
  }
  if (isObj(raw.plan)) {
    const p = raw.plan;
    if (typeof p.routeId === 'string' && ROUTES[p.routeId]) s.plan.routeId = p.routeId;
    s.plan.supplies = intRecord(p.supplies, (k) => !!ITEMS[k]?.supply);
    s.plan.porters = Math.floor(num(p.porters, 0, 0, 6));
    if (p.risk === 'careful' || p.risk === 'standard' || p.risk === 'bold') s.plan.risk = p.risk;
    s.plan.repeat = Math.floor(num(p.repeat, 0, -1, 99));
  }
  if (isObj(raw.upgrades)) {
    for (const [k, v] of Object.entries(raw.upgrades)) {
      if (UPGRADES[k]) s.upgrades[k] = Math.floor(num(v, 0, 0, UPGRADES[k].levels.length));
    }
  }
  if (Array.isArray(raw.recipes)) {
    for (const r of raw.recipes) if (typeof r === 'string' && ACTIONS[r] && !s.recipes.includes(r)) s.recipes.push(r);
  }
  if (isObj(raw.flags)) for (const [k, v] of Object.entries(raw.flags)) if (v === true) s.flags[k] = true;
  if (isObj(raw.codex)) {
    const c = raw.codex;
    if (isObj(c.enemies)) {
      for (const [k, v] of Object.entries(c.enemies)) {
        if (ENEMIES[k] && isObj(v)) s.codex.enemies[k] = { seen: Math.floor(num(v.seen, 0, 0)), defeated: Math.floor(num(v.defeated, 0, 0)) };
      }
    }
    if (isObj(c.items)) for (const k of Object.keys(c.items)) if (ITEMS[k]) s.codex.items[k] = true;
    if (isObj(c.discoveries)) s.codex.discoveries = intRecord(c.discoveries, (k) => !!DISCOVERIES[k]);
    if (Array.isArray(c.lore)) for (const l of c.lore) if (typeof l === 'string' && LORE[l] && !s.codex.lore.includes(l)) s.codex.lore.push(l);
  }
  if (isObj(raw.contracts)) {
    for (const [k, v] of Object.entries(raw.contracts)) {
      if (!CONTRACTS[k] || !isObj(v)) continue;
      s.contracts[k] = { status: v.status === 'done' ? 'done' : 'active', base: Math.floor(num(v.base, 0, 0)), notified: v.notified === true };
    }
  }
  if (Array.isArray(raw.doctrines)) s.doctrines = raw.doctrines.filter((d): d is string => typeof d === 'string' && DOCTRINES.some((x) => x.id === d));
  if (isObj(raw.stats)) {
    const st = raw.stats;
    s.stats.kills = intRecord(st.kills, (k) => !!ENEMIES[k]);
    s.stats.crafted = intRecord(st.crafted, (k) => !!ITEMS[k]);
    s.stats.gathered = intRecord(st.gathered, (k) => !!ITEMS[k]);
    s.stats.routeRuns = intRecord(st.routeRuns, (k) => !!ROUTES[k]);
    s.stats.routeClears = intRecord(st.routeClears, (k) => !!ROUTES[k]);
    s.stats.expeditions = Math.floor(num(st.expeditions, 0, 0));
    s.stats.ordersStarted = Math.floor(num(st.ordersStarted, 0, 0));
    s.stats.totalCrafted = Math.floor(num(st.totalCrafted, 0, 0));
    s.stats.marksEarned = Math.floor(num(st.marksEarned, 0, 0));
  }
  if (Array.isArray(raw.reports)) {
    s.reports = raw.reports
      .filter((r): r is Raw => isObj(r) && typeof r.routeId === 'string' && !!ROUTES[r.routeId as string] && Array.isArray(r.log))
      .slice(0, 15)
      .map((r) => ({
        ...r,
        id: Math.floor(num(r.id, 0)),
        outcome: r.outcome === 'success' || r.outcome === 'defeat' ? r.outcome : 'retreat',
        members: Array.isArray(r.members) ? r.members.filter((m) => typeof m === 'string' && HEROES[m]) : [],
        log: (r.log as unknown[]).filter((l) => isObj(l) && typeof l.text === 'string'),
        loot: intRecord(r.loot, (k) => !!ITEMS[k]),
        lost: intRecord(r.lost, (k) => !!ITEMS[k]),
        leftBehind: intRecord(r.leftBehind, (k) => !!ITEMS[k]),
        used: intRecord(r.used, (k) => !!ITEMS[k]),
        kills: intRecord(r.kills, (k) => !!ENEMIES[k]),
        skillXp: isObj(r.skillXp) ? r.skillXp : {},
        hpAfter: isObj(r.hpAfter) ? r.hpAfter : {},
        levelUps: Array.isArray(r.levelUps) ? r.levelUps.filter((x) => typeof x === 'string') : [],
        discoveries: Array.isArray(r.discoveries) ? r.discoveries.filter((x) => typeof x === 'string' && DISCOVERIES[x]) : [],
        marks: Math.floor(num(r.marks, 0)),
        heroXp: Math.floor(num(r.heroXp, 0)),
        sold: Math.floor(num(r.sold, 0)),
        duration: num(r.duration, 0, 0),
        run: Math.floor(num(r.run, 1, 1)),
        drift: typeof r.drift === 'string' ? r.drift : 'clear',
        risk: r.risk === 'careful' || r.risk === 'bold' ? r.risk : 'standard',
        unread: r.unread === true,
      })) as unknown as GameState['reports'];
  }
  if (Array.isArray(raw.feed)) s.feed = raw.feed.filter((f) => isObj(f) && typeof f.text === 'string').slice(0, 40) as unknown as GameState['feed'];
  if (isObj(raw.tutorial)) {
    s.tutorial.step = Math.floor(num(raw.tutorial.step, 0, 0));
    s.tutorial.hidden = raw.tutorial.hidden === true;
    s.tutorial.welcomed = raw.tutorial.welcomed === true;
  }
  if (isObj(raw.settings)) {
    const rm = raw.settings.reducedMotion;
    if (rm === 'system' || rm === 'on' || rm === 'off') s.settings.reducedMotion = rm;
    if (typeof raw.settings.confirmDeliver === 'boolean') s.settings.confirmDeliver = raw.settings.confirmDeliver;
  }
  const ps = raw.pendingSummary;
  if (
    isObj(ps) &&
    typeof ps.elapsed === 'number' &&
    isObj(ps.items) &&
    isObj(ps.skillXp) &&
    isObj(ps.skillLevels) &&
    isObj(ps.heroLevels) &&
    ['reports', 'orders', 'builds', 'discoveries', 'attention'].every((k) => Array.isArray(ps[k]))
  ) {
    s.pendingSummary = ps as unknown as GameState['pendingSummary'];
  }

  // Orders
  const orders = Array.isArray(raw.orders) ? raw.orders : [];
  s.orders = [0, 1].map((i) => {
    const o = orders[i];
    if (!isObj(o)) return null;
    const kind = o.kind === 'build' ? 'build' : 'action';
    if (kind === 'action' && !(typeof o.actionId === 'string' && ACTIONS[o.actionId])) return null;
    if (kind === 'build' && !(typeof o.upgradeId === 'string' && UPGRADES[o.upgradeId])) return null;
    return {
      id: Math.floor(num(o.id, 0)),
      kind,
      actionId: typeof o.actionId === 'string' ? o.actionId : undefined,
      upgradeId: typeof o.upgradeId === 'string' ? o.upgradeId : undefined,
      level: o.level === undefined ? undefined : Math.floor(num(o.level, 1, 1)),
      hands: Math.floor(num(o.hands, 1, 1, 2)),
      elapsed: Math.floor(num(o.elapsed, 0, 0)),
      cycleMs: Math.floor(num(o.cycleMs, 1000, 500)),
      done: Math.floor(num(o.done, 0, 0)),
      target: o.target === null ? null : Math.floor(num(o.target, 1, 1)),
      status: o.status === 'blocked' ? 'blocked' : 'running',
      blocked: typeof o.blocked === 'string' ? o.blocked : undefined,
      seed: Math.floor(num(o.seed, 0)) >>> 0,
      produced: intRecord(o.produced, (k) => !!ITEMS[k]),
    };
  });

  // Expedition: keep if structurally sound, otherwise recall it safely.
  s.expedition = null;
  const e = raw.expedition;
  if (isObj(e)) {
    const okShape =
      typeof e.routeId === 'string' && ROUTES[e.routeId] &&
      Array.isArray(e.legs) && e.legs.every((x) => typeof x === 'number') &&
      Array.isArray(e.members) && e.members.every((m) => typeof m === 'string' && HEROES[m]) &&
      isObj(e.stats) && isObj(e.mods) && isObj(e.hp) && isObj(e.supplies) && isObj(e.plan) && Array.isArray(e.log) &&
      e.members.every((m) => isObj((e.stats as Raw)[m as string]) && typeof (e.hp as Raw)[m as string] === 'number') &&
      ['travel', 'return', 'rest'].includes(e.phase as string);
    if (okShape) {
      s.expedition = e as unknown as GameState['expedition'];
    } else if (isObj(e.supplies)) {
      for (const [k, n] of Object.entries(intRecord(e.supplies, (k) => !!ITEMS[k]))) s.inventory[k] = (s.inventory[k] ?? 0) + n;
      s.feed.unshift({ t: now, kind: 'warn', text: 'An expedition record was damaged; the party was recalled and its supplies returned.' });
    }
  }
  // Heroes whose gear changed shape may exceed their max health; clamp on next tick.
  return s;
}

// ---------------------------------------------------------------------------
// Import / export

export function exportSave(state: GameState, now: number): string {
  const text = encodeEnvelope(state, state.saveSeq, now);
  return btoa(unescape(encodeURIComponent(text)));
}

export function importSave(text: string, now: number): { ok: true; state: GameState } | { ok: false; error: string } {
  let decoded: string;
  try {
    decoded = decodeURIComponent(escape(atob(text.trim())));
  } catch {
    return { ok: false, error: 'That does not look like an exported save.' };
  }
  const dec = decodeEnvelope(decoded);
  if (!dec.ok) return { ok: false, error: `Could not import: ${dec.error}.` };
  try {
    const state = normalize(migrate(dec.raw), now);
    return { ok: true, state };
  } catch (e) {
    return { ok: false, error: `Could not import: ${e instanceof Error ? e.message : 'unknown error'}.` };
  }
}
