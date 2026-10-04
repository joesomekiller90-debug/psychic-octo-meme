// "While you were away" summaries, built by diffing state around a settle.
import { HEROES } from '../data/heroes';
import { SKILL_ORDER } from '../data/skills';
import type { SkillId } from '../types';
import type { SettleResult } from './advance';
import { readyContracts } from './contracts';
import { formatDuration } from './format';
import { freeHands, heroStats, levelOf } from './rules';
import type { GameState, ReturnSummary } from './state';
import { orderName } from './workorders';

export interface Snapshot {
  inventory: Record<string, number>;
  marks: number;
  standing: number;
  skills: Record<SkillId, number>;
  levels: Partial<Record<SkillId, number>>;
  heroLevels: Record<string, number>;
}

export function snapshot(state: GameState): Snapshot {
  const levels: Partial<Record<SkillId, number>> = {};
  for (const s of SKILL_ORDER) levels[s] = levelOf(state, s);
  return {
    inventory: { ...state.inventory },
    marks: state.marks,
    standing: state.standing,
    skills: { ...state.skills },
    levels,
    heroLevels: Object.fromEntries(Object.values(state.heroes).map((h) => [h.id, h.level])),
  };
}

export function attentionItems(state: GameState): string[] {
  const out: string[] = [];
  state.orders.forEach((o) => {
    if (o?.status === 'blocked') out.push(`${orderName(o)} is paused: ${o.blocked}`);
  });
  const idle = state.orders.filter((o) => !o).length;
  if (idle > 0 && freeHands(state) > 0) out.push(`${idle === 2 ? 'Both work-order slots are' : 'A work-order slot is'} idle and ${freeHands(state)} hand${freeHands(state) === 1 ? ' is' : 's are'} free.`);
  if (!state.expedition) {
    const hurt = state.party.members.filter((m) => state.heroes[m].hp / heroStats(state, m).vigor < 0.6);
    if (hurt.length) out.push(`${hurt.map((m) => HEROES[m].name.split(' ')[0]).join(' and ')} still recovering in the infirmary.`);
    else out.push('The party is rested and ready for a new expedition.');
  }
  for (const c of readyContracts(state)) out.push(`Contract ready to claim: ${c.title}.`);
  return out;
}

export function buildSummary(state: GameState, before: Snapshot, res: SettleResult): ReturnSummary {
  const items: Record<string, number> = {};
  const keys = new Set([...Object.keys(before.inventory), ...Object.keys(state.inventory)]);
  for (const k of keys) {
    const d = (state.inventory[k] ?? 0) - (before.inventory[k] ?? 0);
    if (d !== 0) items[k] = d;
  }
  const skillXp: Partial<Record<SkillId, number>> = {};
  const skillLevels: Partial<Record<SkillId, [number, number]>> = {};
  for (const s of SKILL_ORDER) {
    const d = (state.skills[s] ?? 0) - (before.skills[s] ?? 0);
    if (d > 0) skillXp[s] = d;
    const l = levelOf(state, s);
    if (l > (before.levels[s] ?? 1)) skillLevels[s] = [before.levels[s] ?? 1, l];
  }
  const heroLevels: Record<string, [number, number]> = {};
  for (const h of Object.values(state.heroes)) {
    if (h.level > (before.heroLevels[h.id] ?? 1)) heroLevels[h.id] = [before.heroLevels[h.id] ?? 1, h.level];
  }
  const reports: number[] = [];
  const orderCounts: Record<string, number> = {};
  const builds: string[] = [];
  const discoveries: string[] = [];
  const attention: string[] = [];
  for (const e of res.events) {
    if (e.type === 'expedition-return') reports.push(e.reportId);
    else if (e.type === 'order-cycle') orderCounts[e.name] = (orderCounts[e.name] ?? 0) + 1;
    else if (e.type === 'build-done') builds.push(`${e.name} level ${e.level}`);
    else if (e.type === 'discovery') discoveries.push(e.name);
    else if (e.type === 'repeat-halted') attention.push(`Standing orders stopped: ${e.reason}`);
  }
  for (const id of reports) {
    const r = state.reports.find((x) => x.id === id);
    if (r && r.outcome !== 'success') attention.push(`An expedition ${r.outcome === 'defeat' ? 'was defeated' : 'turned back early'}. Check its report.`);
  }
  if (res.cappedMs > 0) attention.push(`You were away longer than the offline limit; ${formatDuration(res.cappedMs)} was not counted. A Signal Beacon raises the limit.`);
  if (res.clockBack) attention.push('Your device clock moved backwards since the last save. No time was gained or lost.');
  attention.push(...attentionItems(state));
  return {
    from: res.from,
    to: res.to,
    elapsed: res.elapsed,
    cappedMs: res.cappedMs,
    clockBack: res.clockBack,
    items,
    marks: state.marks - before.marks,
    standing: state.standing - before.standing,
    skillXp,
    skillLevels,
    heroLevels,
    reports,
    orders: Object.entries(orderCounts).map(([name, cycles]) => ({ name, cycles })),
    builds,
    discoveries,
    attention,
  };
}

/** Combine an unread summary with a newer one (e.g. two refreshes before reading). */
export function mergeSummary(a: ReturnSummary, b: ReturnSummary): ReturnSummary {
  const items = { ...a.items };
  for (const [k, v] of Object.entries(b.items)) items[k] = (items[k] ?? 0) + v;
  for (const k of Object.keys(items)) if (items[k] === 0) delete items[k];
  const skillXp = { ...a.skillXp };
  for (const [k, v] of Object.entries(b.skillXp) as [SkillId, number][]) skillXp[k] = (skillXp[k] ?? 0) + v;
  const skillLevels = { ...a.skillLevels };
  for (const [k, v] of Object.entries(b.skillLevels) as [SkillId, [number, number]][]) {
    skillLevels[k] = [a.skillLevels[k]?.[0] ?? v[0], v[1]];
  }
  const heroLevels = { ...a.heroLevels };
  for (const [k, v] of Object.entries(b.heroLevels)) heroLevels[k] = [a.heroLevels[k]?.[0] ?? v[0], v[1]];
  const orders = [...a.orders];
  for (const o of b.orders) {
    const ex = orders.find((x) => x.name === o.name);
    if (ex) ex.cycles += o.cycles;
    else orders.push({ ...o });
  }
  return {
    from: a.from,
    to: b.to,
    elapsed: a.elapsed + b.elapsed,
    cappedMs: a.cappedMs + b.cappedMs,
    clockBack: a.clockBack || b.clockBack,
    items,
    marks: a.marks + b.marks,
    standing: a.standing + b.standing,
    skillXp,
    skillLevels,
    heroLevels,
    reports: [...a.reports, ...b.reports],
    orders,
    builds: [...a.builds, ...b.builds],
    discoveries: [...a.discoveries, ...b.discoveries],
    attention: b.attention,
  };
}
