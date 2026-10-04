// Camp work orders: gathering, crafting and construction.
import { ACTIONS } from '../data/actions';
import { UPGRADES } from '../data/camp';
import { ITEMS } from '../data/items';
import { addItem, count, grantSkillXp, hasItems, missingItems, pushFeed, type SimContext } from './core';
import { randAt } from './rng';
import { actionCycleMs, extraOutputChance, stackCap } from './rules';
import type { GameState, WorkOrder } from './state';

export const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V'];

export function orderName(o: WorkOrder): string {
  if (o.kind === 'build') {
    const u = UPGRADES[o.upgradeId!];
    return `Build ${u.name} ${ROMAN[o.level ?? 1] ?? ''}`.trim();
  }
  return ACTIONS[o.actionId!]?.name ?? 'Work';
}

/** Try to begin the next cycle of an order. Returns true if it is running. */
export function tryStartCycle(state: GameState, ctx: SimContext | null, o: WorkOrder): boolean {
  if (o.kind === 'build') {
    o.status = 'running';
    o.blocked = undefined;
    return true;
  }
  const def = ACTIONS[o.actionId!];
  const cap = stackCap(state);
  for (const out of def.outputs) {
    if (out.chance !== undefined && out.chance < 1) continue;
    if (count(state, out.item) + out.qty > cap) {
      return block(state, ctx, o, `Storage full: ${ITEMS[out.item].name} (${cap}). Build the Storehouse or use some up.`);
    }
  }
  if (!hasItems(state, def.inputs)) {
    const miss = missingItems(state, def.inputs)
      .map((m) => `${m.qty} ${ITEMS[m.item].name}`)
      .join(', ');
    return block(state, ctx, o, `Waiting for materials: need ${miss} more.`);
  }
  for (const q of def.inputs ?? []) {
    const left = count(state, q.item) - q.qty;
    if (left > 0) state.inventory[q.item] = left;
    else delete state.inventory[q.item];
  }
  o.cycleMs = actionCycleMs(state, def, o.hands);
  o.elapsed = 0;
  o.status = 'running';
  o.blocked = undefined;
  return true;
}

function block(state: GameState, ctx: SimContext | null, o: WorkOrder, reason: string): false {
  const wasBlocked = o.status === 'blocked' && o.blocked === reason;
  o.status = 'blocked';
  o.blocked = reason;
  o.elapsed = 0;
  if (!wasBlocked && ctx) {
    const name = orderName(o);
    ctx.events.push({ type: 'order-blocked', name, reason });
    pushFeed(state, ctx, 'warn', `${name} paused. ${reason}`);
  }
  return false;
}

/** Finish one cycle. Returns true if the order is finished and its slot freed. */
export function completeCycle(state: GameState, ctx: SimContext, slot: number): boolean {
  const o = state.orders[slot]!;
  if (o.kind === 'build') {
    const id = o.upgradeId!;
    const lvl = (state.upgrades[id] ?? 0) + 1;
    state.upgrades[id] = lvl;
    state.orders[slot] = null;
    const name = UPGRADES[id].name;
    ctx.events.push({ type: 'build-done', upgrade: id, name, level: lvl });
    pushFeed(state, ctx, 'build', `${name} upgraded to level ${lvl}: ${UPGRADES[id].levels[lvl - 1].effect}.`);
    return true;
  }
  const def = ACTIONS[o.actionId!];
  const extra = randAt(o.seed, o.done, 99) < extraOutputChance(state, def) ? 2 : 1;
  def.outputs.forEach((out, idx) => {
    if (out.chance !== undefined && out.chance < 1 && randAt(o.seed, o.done, idx) >= out.chance) return;
    const qty = out.qty * (out.chance === undefined || out.chance >= 1 ? extra : 1);
    const stored = addItem(state, ctx, out.item, qty);
    o.produced[out.item] = (o.produced[out.item] ?? 0) + stored;
    if (def.kind === 'craft') state.stats.crafted[out.item] = (state.stats.crafted[out.item] ?? 0) + qty;
    else state.stats.gathered[out.item] = (state.stats.gathered[out.item] ?? 0) + qty;
  });
  if (def.kind === 'craft') state.stats.totalCrafted += 1;
  grantSkillXp(state, ctx, def.skill, def.xp);
  o.done += 1;
  ctx.events.push({ type: 'order-cycle', actionId: def.id, name: def.name });
  if (o.target !== null && o.done >= o.target) {
    state.orders[slot] = null;
    ctx.events.push({ type: 'order-done', name: def.name, count: o.done });
    pushFeed(state, ctx, 'order', `${def.name} finished: ${o.done} done.`);
    return true;
  }
  tryStartCycle(state, ctx, o);
  return false;
}

/** Refund whatever the order has consumed but not yet turned into output. */
export function refundOrder(state: GameState, o: WorkOrder): void {
  if (o.kind === 'build') {
    const u = UPGRADES[o.upgradeId!];
    const lvl = u.levels[(state.upgrades[u.id] ?? 0)];
    if (!lvl) return;
    state.marks += lvl.marks;
    for (const it of lvl.items) addItem(state, null, it.item, it.qty);
    return;
  }
  if (o.status !== 'running') return;
  const def = ACTIONS[o.actionId!];
  for (const it of def.inputs ?? []) addItem(state, null, it.item, it.qty);
}
