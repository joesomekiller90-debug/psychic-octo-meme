// The bridge between the simulation and the UI: owns the game state, runs the
// live loop, persists saves, guards against two open tabs, and turns
// simulation events into toasts and return summaries.
import { useEffect, useState } from 'preact/hooks';
import { ENEMIES } from '../game/data/enemies';
import { HEROES } from '../game/data/heroes';
import { SKILLS } from '../game/data/skills';
import { ROUTES } from '../game/data/world';
import { settle, type SettleResult } from '../game/sim/advance';
import type { ActionResult } from '../game/sim/actions';
import { makeContext, type SimContext, type SimEvent } from '../game/sim/core';
import { refreshContracts } from '../game/sim/contracts';
import { createInitialState, type GameState } from '../game/sim/state';
import { buildSummary, mergeSummary, snapshot } from '../game/sim/summary';
import { refreshTutorial } from '../game/sim/tutorial';
import { clearSave, exportSave, importSave, loadSave, writeSave, type StorageLike } from '../game/save/save';
import type { SkillId } from '../game/types';

export type Screen = 'overview' | 'expeditions' | 'party' | 'skills' | 'workshop' | 'camp' | 'journal';

export type Modal =
  | { kind: 'welcome' }
  | { kind: 'summary' }
  | { kind: 'report'; id: number }
  | { kind: 'settings' }
  | { kind: 'equip'; hero: string; slot: 'weapon' | 'armor' | 'trinket' }
  | { kind: 'confirm'; title: string; body: string; confirm: string; danger?: boolean; onConfirm: () => void };

export interface Toast {
  id: number;
  tone: 'good' | 'bad' | 'info' | 'level';
  title: string;
  body?: string;
  icon?: string;
  action?: { label: string; run: () => void };
}

export interface UiState {
  screen: Screen;
  region: string;
  routeId: string | null;
  hero: string;
  skill: SkillId;
  workshopTab: string;
  journalTab: string;
  modal: Modal | null;
  modalStack: Modal[];
}

const SUMMARY_THRESHOLD_MS = 60_000;
const SAVE_INTERVAL_MS = 5000;
const TICK_MS = 250;

function makeStorage(): { storage: StorageLike; persistent: boolean } {
  try {
    const k = '__kr_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return { storage: window.localStorage, persistent: true };
  } catch {
    const mem = new Map<string, string>();
    return {
      storage: {
        getItem: (k) => mem.get(k) ?? null,
        setItem: (k, v) => void mem.set(k, v),
        removeItem: (k) => void mem.delete(k),
      },
      persistent: false,
    };
  }
}

export class GameStore {
  state: GameState;
  ui: UiState;
  toasts: Toast[] = [];
  version = 0;
  dormant = false;
  persistent = true;
  saveError: string | null = null;
  loadNotes: string[] = [];
  private storage: StorageLike;
  private listeners = new Set<() => void>();
  private timer: number | undefined;
  private lastSave = 0;
  private dirty = false;
  private toastId = 1;
  private channel: BroadcastChannel | null = null;
  private tabId = Math.random().toString(36).slice(2);
  /** While the tab is hidden, progress is gathered into one summary for the return. */
  private hidden: { at: number; snap: ReturnType<typeof snapshot>; events: SimEvent[]; capped: number; clockBack: boolean } | null = null;

  constructor() {
    const { storage, persistent } = makeStorage();
    this.storage = storage;
    this.persistent = persistent;
    this.state = createInitialState(Date.now());
    this.ui = {
      screen: 'overview',
      region: 'hollowmere',
      routeId: null,
      hero: 'brannoc',
      skill: 'foraging',
      workshopTab: 'all',
      journalTab: 'contracts',
      modal: null,
      modalStack: [],
    };
  }

  // --- lifecycle ---------------------------------------------------------------

  start(): void {
    const now = Date.now();
    const loaded = loadSave(this.storage, now);
    this.loadNotes = loaded.notes;
    if (loaded.state) this.state = loaded.state;
    const isNew = !loaded.state;
    // Settle offline progress exactly once, then save immediately so a refresh
    // cannot replay it.
    const before = snapshot(this.state);
    const res = settle(this.state, now);
    refreshContracts(this.state, null);
    refreshTutorial(this.state);
    if (!isNew) this.recordSummary(before, res);
    this.ui.routeId = this.state.plan.routeId;
    this.ui.region = ROUTES[this.state.plan.routeId]?.region ?? 'hollowmere';
    if (!this.state.tutorial.welcomed) this.ui.modal = { kind: 'welcome' };
    else if (this.state.pendingSummary) this.ui.modal = { kind: 'summary' };
    for (const n of this.loadNotes) this.toast({ tone: 'bad', title: 'Save notice', body: n });
    if (!this.persistent) this.toast({ tone: 'bad', title: 'Saving is unavailable', body: 'This browser is blocking storage, so progress will be lost when the tab closes.' });
    this.save(true);
    this.setupTabGuard();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.tick();
        this.hidden = { at: Date.now(), snap: snapshot(this.state), events: [], capped: 0, clockBack: false };
        this.save(true);
      } else {
        this.tick();
        this.endHidden();
      }
    });
    window.addEventListener('pagehide', () => this.save(true));
    this.emit();
  }

  private setupTabGuard(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.channel = new BroadcastChannel('kindled-roads');
    } catch {
      // Some sandboxed frames refuse BroadcastChannel; the game still runs.
      return;
    }
    this.channel.onmessage = (ev) => {
      const msg = ev.data as { type: string; id: string };
      if (msg?.type === 'claim' && msg.id !== this.tabId && !this.dormant) {
        // Another tab took over. Stop simulating and saving here so the two
        // tabs can never overwrite each other's progress.
        this.dormant = true;
        if (this.timer) window.clearInterval(this.timer);
        this.emit();
      }
    };
    this.channel.postMessage({ type: 'claim', id: this.tabId });
  }

  tick(): void {
    if (this.dormant) return;
    const now = Date.now();
    const before = snapshot(this.state);
    const res = settle(this.state, now);
    if (this.hidden) {
      // Background tab: keep simulating and saving, but hold events for the
      // single summary shown when the player comes back.
      this.hidden.events.push(...res.events);
      this.hidden.capped += res.cappedMs;
      this.hidden.clockBack ||= res.clockBack;
      if (res.events.length || now - this.lastSave > SAVE_INTERVAL_MS) this.save(true);
      return;
    }
    if (res.elapsed >= SUMMARY_THRESHOLD_MS || res.cappedMs > 0 || res.clockBack) {
      this.recordSummary(before, res);
      if (!this.ui.modal) this.ui.modal = { kind: 'summary' };
    } else {
      this.handleEvents(res.events);
    }
    if (res.events.length) this.dirty = true;
    if (this.dirty || now - this.lastSave > SAVE_INTERVAL_MS) this.save(now - this.lastSave > SAVE_INTERVAL_MS);
    this.emit();
  }

  private endHidden(): void {
    const h = this.hidden;
    this.hidden = null;
    if (!h) return;
    const now = Date.now();
    const away = now - h.at;
    if (away >= SUMMARY_THRESHOLD_MS || h.capped > 0 || h.clockBack) {
      this.recordSummary(h.snap, { from: h.at, to: now, elapsed: Math.max(0, away - h.capped), cappedMs: h.capped, clockBack: h.clockBack, events: h.events });
      if (!this.ui.modal) this.ui.modal = { kind: 'summary' };
    } else {
      this.handleEvents(h.events);
    }
    this.emit();
  }

  private recordSummary(before: ReturnType<typeof snapshot>, res: SettleResult): void {
    if (res.elapsed < SUMMARY_THRESHOLD_MS && !res.cappedMs && !res.clockBack) return;
    const sum = buildSummary(this.state, before, res);
    this.state.pendingSummary = this.state.pendingSummary ? mergeSummary(this.state.pendingSummary, sum) : sum;
  }

  save(force = false): void {
    if (this.dormant) return;
    const now = Date.now();
    if (!force && !this.dirty && now - this.lastSave < SAVE_INTERVAL_MS) return;
    const r = writeSave(this.storage, this.state, now);
    this.lastSave = now;
    this.dirty = false;
    const prevErr = this.saveError;
    this.saveError = r.ok ? null : r.error ?? 'unknown error';
    if (this.saveError && !prevErr) this.toast({ tone: 'bad', title: 'Could not save', body: this.saveError });
  }

  // --- subscriptions -------------------------------------------------------------

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  // --- commands ------------------------------------------------------------------

  /** Run a player command against the live state, then save and re-render. */
  act(fn: (s: GameState, ctx: SimContext) => ActionResult | void, opts: { quiet?: boolean } = {}): ActionResult {
    if (this.dormant) return { ok: false, msg: 'This tab is inactive.' };
    // Bring time up to date first so the command applies to the present.
    const pre = settle(this.state, Date.now());
    this.handleEvents(pre.events);
    const ctx = makeContext(Date.now());
    const r = fn(this.state, ctx) ?? { ok: true, msg: '' };
    refreshContracts(this.state, ctx);
    refreshTutorial(this.state);
    this.handleEvents(ctx.events);
    if (!opts.quiet && r.msg) this.toast({ tone: r.ok ? 'info' : 'bad', title: r.ok ? r.msg : 'Not possible', body: r.ok ? undefined : r.msg });
    this.dirty = true;
    this.save(true);
    this.emit();
    return r;
  }

  setUi(patch: Partial<UiState>): void {
    Object.assign(this.ui, patch);
    this.emit();
  }

  go(screen: Screen, patch: Partial<UiState> = {}): void {
    this.setUi({ screen, ...patch });
    if (typeof window !== 'undefined') {
      const main = document.getElementById('main');
      main?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  }

  openModal(m: Modal): void {
    if (this.ui.modal) this.ui.modalStack.push(this.ui.modal);
    this.ui.modal = m;
    this.emit();
  }

  closeModal(): void {
    const m = this.ui.modal;
    if (m?.kind === 'summary') this.state.pendingSummary = null;
    if (m?.kind === 'welcome') {
      this.state.tutorial.welcomed = true;
    }
    this.ui.modal = this.ui.modalStack.pop() ?? null;
    if (!this.ui.modal && this.state.pendingSummary && m?.kind !== 'summary') this.ui.modal = { kind: 'summary' };
    this.dirty = true;
    this.save(true);
    this.emit();
  }

  toast(t: Omit<Toast, 'id'>): void {
    const id = this.toastId++;
    this.toasts = [...this.toasts.slice(-3), { ...t, id }];
    window.setTimeout(() => this.dismissToast(id), t.action ? 8000 : 5000);
    this.emit();
  }

  dismissToast(id: number): void {
    const n = this.toasts.length;
    this.toasts = this.toasts.filter((t) => t.id !== id);
    if (this.toasts.length !== n) this.emit();
  }

  private handleEvents(events: SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'expedition-return': {
          const r = ROUTES[e.routeId];
          const good = e.outcome === 'success';
          this.toast({
            tone: good ? 'good' : 'bad',
            icon: 'compass',
            title: good ? `The party is back from ${r.name}` : `${r.name}: the party ${e.outcome === 'defeat' ? 'was defeated' : 'turned back'}`,
            body: 'Their journey report is ready.',
            action: { label: 'Read report', run: () => this.openModal({ kind: 'report', id: e.reportId }) },
          });
          break;
        }
        case 'expedition-depart':
          if (e.run > 1) this.toast({ tone: 'info', icon: 'repeat', title: `Standing orders: run ${e.run} of ${ROUTES[e.routeId].name} departs` });
          break;
        case 'skill-level':
          this.toast({ tone: 'level', icon: e.skill, title: `${SKILLS[e.skill].name} level ${e.level}` });
          break;
        case 'hero-level':
          this.toast({ tone: 'level', icon: 'star', title: `${HEROES[e.hero].name} reached level ${e.level}` });
          break;
        case 'order-done':
          this.toast({ tone: 'info', icon: 'check', title: `${e.name} finished`, body: `${e.count} completed.` });
          break;
        case 'order-blocked':
          this.toast({ tone: 'bad', icon: 'alert', title: `${e.name} paused`, body: e.reason });
          break;
        case 'build-done':
          this.toast({ tone: 'good', icon: 'camp', title: `${e.name} is now level ${e.level}` });
          break;
        case 'discovery':
          this.toast({ tone: 'good', icon: 'sparkle', title: `Discovered: ${e.name}` });
          break;
        case 'contract-ready':
          this.toast({ tone: 'good', icon: 'scroll', title: 'Contract ready to claim', body: e.title, action: { label: 'Open', run: () => this.go('journal', { journalTab: 'contracts' }) } });
          break;
        case 'first-clear':
          this.toast({ tone: 'good', icon: 'beacon', title: 'A waystone burns again', body: e.text });
          break;
        case 'repeat-halted':
          this.toast({ tone: 'bad', icon: 'alert', title: 'Standing orders stopped', body: e.reason });
          break;
        case 'sold':
          break;
        default:
          break;
      }
    }
  }

  // --- save management -------------------------------------------------------------

  exportText(): string {
    return exportSave(this.state, Date.now());
  }

  importText(text: string): ActionResult {
    const r = importSave(text, Date.now());
    if (!r.ok) return { ok: false, msg: r.error };
    this.state = r.state;
    const before = snapshot(this.state);
    const res = settle(this.state, Date.now());
    this.recordSummary(before, res);
    this.ui.modal = null;
    this.ui.modalStack = [];
    this.save(true);
    this.emit();
    return { ok: true, msg: 'Save imported.' };
  }

  reset(): void {
    clearSave(this.storage);
    this.state = createInitialState(Date.now());
    this.ui.modal = { kind: 'welcome' };
    this.ui.modalStack = [];
    this.ui.screen = 'overview';
    this.ui.routeId = this.state.plan.routeId;
    this.ui.region = 'hollowmere';
    refreshContracts(this.state, null);
    this.save(true);
    this.emit();
  }

  claimTab(): void {
    window.location.reload();
  }
}

export const store = new GameStore();

/** Re-render the calling component whenever the store changes. */
export function useStore(): GameStore {
  const [, setV] = useState(0);
  useEffect(() => store.subscribe(() => setV((v) => v + 1)), []);
  return store;
}

export function enemyName(id: string): string {
  return ENEMIES[id]?.name ?? id;
}
