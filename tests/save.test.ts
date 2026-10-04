import { describe, expect, it } from 'vitest';
import { clearSave, encodeEnvelope, exportSave, importSave, loadSave, SAVE_KEYS, writeSave, type StorageLike } from '../src/game/save/save';
import { dispatch } from '../src/game/sim/actions';
import { settle } from '../src/game/sim/advance';
import { makeContext } from '../src/game/sim/core';
import { SAVE_VERSION } from '../src/game/sim/state';
import { freshState, T0 } from './helpers';

function memStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

describe('saves', () => {
  it('round-trips a game in progress, including a live expedition', () => {
    const st = memStorage();
    const s = freshState(1);
    dispatch(s, makeContext(T0));
    settle(s, T0 + 20_000);
    writeSave(st, s, T0 + 20_000);
    const loaded = loadSave(st, T0 + 20_000).state!;
    expect(loaded.expedition?.routeId).toBe('wildroot_trail');
    expect(loaded.inventory).toEqual(s.inventory);
    // Continuing either copy produces the same result.
    settle(s, T0 + 300_000);
    settle(loaded, T0 + 300_000);
    expect(loaded.reports[0].loot).toEqual(s.reports[0].loot);
  });

  it('alternates slots and falls back to the backup if the newest is damaged', () => {
    const st = memStorage();
    const s = freshState(2);
    s.marks = 111;
    writeSave(st, s, T0);
    s.marks = 222;
    writeSave(st, s, T0 + 5000);
    // Corrupt the newest slot as if the write was cut off.
    const newest = SAVE_KEYS[s.saveSeq % 2];
    st.setItem(newest, st.getItem(newest)!.slice(0, 200));
    const res = loadSave(st, T0 + 6000);
    expect(res.state?.marks).toBe(111);
    expect(res.notes.join(' ')).toMatch(/backup/);
  });

  it('rejects tampered data via checksum', () => {
    const st = memStorage();
    const s = freshState(3);
    writeSave(st, s, T0);
    const k = SAVE_KEYS[s.saveSeq % 2];
    st.setItem(k, st.getItem(k)!.replace('"marks\\":30', '"marks\\":99999'));
    const res = loadSave(st, T0);
    expect(res.state).toBeNull();
  });

  it('migrates a version 1 save and fills in missing fields', () => {
    const st = memStorage();
    const legacy = {
      version: 1,
      worldSeed: 9,
      lastTick: T0,
      marks: 75,
      inventory: { wildroot: 12, not_an_item: 4 },
      skills: { foraging: { xp: 500 }, mining: { xp: 50 } },
      party: ['brannoc', 'tamsin'],
      workOrders: [{ kind: 'action', actionId: 'gather_wildroot', hands: 1, elapsed: 0, cycleMs: 5000, done: 3, target: null, status: 'running', seed: 1, produced: {} }, null],
    };
    const env = encodeEnvelope(legacy as never, 1, T0);
    st.setItem(SAVE_KEYS[1], env);
    const res = loadSave(st, T0);
    const s = res.state!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.marks).toBe(75);
    expect(s.inventory.wildroot).toBe(12);
    expect(s.inventory.not_an_item).toBeUndefined();
    expect(s.skills.foraging).toBe(500);
    expect(s.party.members).toEqual(['brannoc', 'tamsin']);
    expect(s.orders[0]?.actionId).toBe('gather_wildroot');
    expect(s.tutorial).toBeDefined();
    expect(s.codex.lore.length).toBeGreaterThan(0);
  });

  it('recalls a damaged expedition record and returns its supplies', () => {
    const st = memStorage();
    const s = freshState(8);
    dispatch(s, makeContext(T0));
    const packed = s.expedition!.supplies.trail_ration;
    const rations = s.inventory.trail_ration ?? 0;
    (s.expedition as unknown as { stats: unknown }).stats = 'garbage';
    writeSave(st, s, T0);
    const loaded = loadSave(st, T0).state!;
    expect(loaded.expedition).toBeNull();
    expect(loaded.inventory.trail_ration).toBe(rations + packed);
    expect(loaded.feed[0].text).toMatch(/damaged/);
  });

  it('refuses saves from a newer version without crashing', () => {
    const st = memStorage();
    const s = freshState(4);
    (s as { version: number }).version = SAVE_VERSION + 5;
    writeSave(st, s, T0);
    const res = loadSave(st, T0);
    expect(res.state).toBeNull();
    expect(res.notes.length).toBeGreaterThan(0);
  });

  it('export and import round-trip', () => {
    const s = freshState(5);
    s.marks = 321;
    const text = exportSave(s, T0);
    const r = importSave(text, T0);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.marks).toBe(321);
    expect(importSave('not a save', T0).ok).toBe(false);
  });

  it('clearSave removes both slots', () => {
    const st = memStorage();
    const s = freshState(6);
    writeSave(st, s, T0);
    writeSave(st, s, T0);
    clearSave(st);
    expect(st.map.size).toBe(0);
  });
});
