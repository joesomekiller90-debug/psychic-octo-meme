// Contracts from the camp and reconnected settlements.
import { CONTRACT_LIST, CONTRACTS } from '../data/camp';
import { HEROES } from '../data/heroes';
import type { ContractDef } from '../types';
import { addItem, count, pushFeed, type SimContext } from './core';
import { checkReq, levelOf, upgradeLevel } from './rules';
import type { GameState } from './state';

export function contractCounter(state: GameState, def: ContractDef): number {
  const g = def.goal;
  switch (g.type) {
    case 'route':
      return state.stats.routeClears[g.route] ?? 0;
    case 'defeat':
      return state.stats.kills[g.enemy] ?? 0;
    case 'craft':
      return state.stats.crafted[g.item] ?? 0;
    default:
      return 0;
  }
}

export interface ContractProgress {
  have: number;
  need: number;
  ready: boolean;
}

export function contractProgress(state: GameState, def: ContractDef): ContractProgress {
  const g = def.goal;
  const c = state.contracts[def.id];
  const base = c?.base ?? 0;
  let have = 0;
  let need = 1;
  switch (g.type) {
    case 'route':
      have = contractCounter(state, def) - base;
      need = g.count;
      break;
    case 'defeat':
      have = contractCounter(state, def) - base;
      need = g.count;
      break;
    case 'craft':
      have = contractCounter(state, def) - base;
      need = g.count;
      break;
    case 'deliver':
      have = count(state, g.item);
      need = g.qty;
      break;
    case 'skill':
      have = levelOf(state, g.skill);
      need = g.level;
      break;
    case 'upgrade':
      have = upgradeLevel(state, g.upgrade);
      need = g.level;
      break;
  }
  have = Math.max(0, have);
  return { have: Math.min(have, need), need, ready: have >= need };
}

/** Activate newly available contracts. Returns ids that just became ready to claim. */
export function refreshContracts(state: GameState, ctx: SimContext | null): string[] {
  const ready: string[] = [];
  for (const def of CONTRACT_LIST) {
    let c = state.contracts[def.id];
    if (!c) {
      if (!def.requires.every((r) => checkReq(state, r))) continue;
      c = state.contracts[def.id] = { status: 'active', base: contractCounter(state, def) };
    }
    if (c.status !== 'active') continue;
    const p = contractProgress(state, def);
    const flagged = c.notified;
    if (p.ready && !flagged) {
      c.notified = true;
      ready.push(def.id);
      if (ctx) {
        ctx.events.push({ type: 'contract-ready', id: def.id, title: def.title });
        pushFeed(state, ctx, 'contract', `Contract ready to claim: ${def.title}.`);
      }
    } else if (!p.ready && flagged && def.goal.type === 'deliver') {
      c.notified = false;
    }
  }
  return ready;
}

export function activeContracts(state: GameState): ContractDef[] {
  return CONTRACT_LIST.filter((d) => state.contracts[d.id]?.status === 'active');
}

export function readyContracts(state: GameState): ContractDef[] {
  return activeContracts(state).filter((d) => contractProgress(state, d).ready);
}

export function claimContract(state: GameState, ctx: SimContext, id: string): { ok: boolean; msg: string } {
  const def = CONTRACTS[id];
  const c = state.contracts[id];
  if (!def || !c || c.status !== 'active') return { ok: false, msg: 'That contract is not open.' };
  const p = contractProgress(state, def);
  if (!p.ready) return { ok: false, msg: `Not finished yet (${p.have}/${p.need}).` };
  if (def.goal.type === 'deliver') {
    const left = count(state, def.goal.item) - def.goal.qty;
    if (left > 0) state.inventory[def.goal.item] = left;
    else delete state.inventory[def.goal.item];
  }
  const r = def.reward;
  if (r.marks) {
    state.marks += r.marks;
    state.stats.marksEarned += r.marks;
  }
  if (r.standing) state.standing += r.standing;
  for (const it of r.items ?? []) addItem(state, ctx, it.item, it.qty);
  for (const rec of r.recipes ?? []) if (!state.recipes.includes(rec)) state.recipes.push(rec);
  for (const f of r.flags ?? []) state.flags[f] = true;
  let extra = '';
  if (r.recruit) {
    const h = state.heroes[r.recruit];
    h.recruited = true;
    extra = ` ${HEROES[r.recruit].name} joins the Compact!`;
  }
  c.status = 'done';
  pushFeed(state, ctx, 'contract', `Contract complete: ${def.title}.${extra}`);
  refreshContracts(state, ctx);
  return { ok: true, msg: `${def.title} complete.${extra}` };
}
