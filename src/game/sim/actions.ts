// Player commands. Each validates, mutates state, and returns a message for
// feedback. The UI never mutates state directly.
import { ACTIONS } from '../data/actions';
import { DOCTRINES, RANKS, REPLEDGE_COST, UPGRADES } from '../data/camp';
import { HEROES, MAX_PARTY } from '../data/heroes';
import { ITEMS } from '../data/items';
import { ROUTES } from '../data/world';
import type { EquipSlot, Row } from '../types';
import { claimContract as claim, refreshContracts } from './contracts';
import { addItem, count, hasItems, missingItems, pushFeed, removeItems, type SimContext } from './core';
import { checkPlan, dispatchExpedition, returnDuration } from './expedition';
import { hash32 } from './rng';
import {
  actionAvailability,
  actionCycleMs,
  buildCycleMs,
  checkReq,
  describeReq,
  freeHands,
  heroOnExpedition,
  heroStats,
  rankOf,
  routeUnlocked,
  unmetReqs,
  upgradeLevel,
} from './rules';
import type { GameState, PlanDraft, Tactics, WorkOrder } from './state';
import { refreshTutorial } from './tutorial';
import { orderName, refundOrder, tryStartCycle } from './workorders';

export interface ActionResult {
  ok: boolean;
  msg: string;
}

const ok = (msg: string): ActionResult => ({ ok: true, msg });
const fail = (msg: string): ActionResult => ({ ok: false, msg });

function after(state: GameState, ctx: SimContext | null) {
  refreshContracts(state, ctx);
  refreshTutorial(state);
}

// ---------------------------------------------------------------------------
// Expeditions

export function updatePlan(state: GameState, patch: Partial<PlanDraft>): ActionResult {
  state.plan = { ...state.plan, ...patch, supplies: { ...(patch.supplies ?? state.plan.supplies) } };
  if (patch.routeId && ROUTES[patch.routeId]) {
    const r = ROUTES[patch.routeId];
    const min = r.minPorters ?? 0;
    if (state.plan.porters < min) state.plan.porters = min;
  }
  return ok('');
}

export function setSupply(state: GameState, item: string, qty: number): ActionResult {
  const n = Math.max(0, Math.min(Math.floor(qty), count(state, item)));
  state.plan.supplies = { ...state.plan.supplies, [item]: n };
  if (n === 0) delete state.plan.supplies[item];
  return ok('');
}

/** Pack the recommended supplies for the selected route. */
export function autoPack(state: GameState): ActionResult {
  const r = ROUTES[state.plan.routeId];
  if (!r) return fail('Choose a route first.');
  const supplies: Record<string, number> = {};
  const want = (id: string, n: number) => {
    const have = count(state, id);
    if (have > 0 && n > 0) supplies[id] = Math.min(have, n);
  };
  want('trail_ration', r.legs);
  want('mending_tonic', Math.ceil(r.danger * 1.2));
  if (r.danger >= 3) want('greater_tonic', r.danger - 2);
  const hazards = r.hazards;
  const needAntidote = r.encounters.some((e) => e.enemies.includes('bramble_wisp')) || hazards.some((h) => h === 'spore_cloud' || h === 'brine_fever');
  if (needAntidote) want('antidote', 2);
  if (hazards.some((h) => h === 'rockslide' || h === 'sheer_cliff' || h === 'sinking_mire')) want('climbing_kit', Math.min(2, r.danger - 1));
  if (r.finale) want('fire_flask', 1);
  if (r.region === 'causeway') want('steadying_draught', 2);
  if (r.region === 'cinderscar' || r.region === 'causeway') want('warding_salve', 1);
  state.plan.supplies = supplies;
  return ok('Packed the recommended supplies you have in stock.');
}

export function dispatch(state: GameState, ctx: SimContext): ActionResult {
  const check = checkPlan(state, state.plan);
  if (!check.ok) return fail(check.errors[0]);
  dispatchExpedition(state, ctx, state.plan);
  const route = ROUTES[state.plan.routeId];
  pushFeed(state, ctx, 'expedition', `The party set out on ${route.name}.`);
  after(state, ctx);
  return ok(`The party sets out on ${route.name}.`);
}

export function recall(state: GameState, ctx: SimContext): ActionResult {
  const e = state.expedition;
  if (!e) return fail('No expedition is out.');
  if (e.phase === 'rest') {
    state.expedition = null;
    pushFeed(state, ctx, 'info', 'Standing orders cancelled. The party stands down.');
    return ok('Standing orders cancelled. The party is back under your command.');
  }
  if (e.phase === 'return') return fail('The party is already heading home.');
  e.outcome = 'retreat';
  e.recalled = true;
  e.phase = 'return';
  e.returnMs = Math.max(3000, Math.min(returnDuration(e), e.elapsed));
  e.elapsed = 0;
  e.log.push({ leg: e.leg, kind: 'retreat', text: 'A signal rocket from Lanternhold: you have recalled the party. They turn for home with what they carry.' });
  return ok('Recall signal sent. The party is heading home.');
}

export function setStandingOrders(state: GameState, repeat: number): ActionResult {
  state.plan.repeat = repeat;
  if (state.expedition) state.expedition.repeatLeft = repeat;
  return ok(repeat === 0 ? 'The party will come home after this run.' : 'Standing orders updated.');
}

// ---------------------------------------------------------------------------
// Party

export function toggleMember(state: GameState, heroId: string): ActionResult {
  if (state.expedition) return fail('The party cannot change while an expedition or standing orders are active.');
  const h = state.heroes[heroId];
  if (!h?.recruited) return fail('That wayfarer has not joined yet.');
  const m = state.party.members;
  if (m.includes(heroId)) {
    state.party.members = m.filter((x) => x !== heroId);
    return ok(`${HEROES[heroId].name} stays in camp.`);
  }
  if (m.length >= MAX_PARTY) return fail(`The party is full (${MAX_PARTY}). Remove someone first.`);
  state.party.members = [...m, heroId];
  return ok(`${HEROES[heroId].name} joins the party.`);
}

export function setRow(state: GameState, heroId: string, row: Row): ActionResult {
  if (state.expedition && state.expedition.members.includes(heroId)) return fail('Formation is locked while the party is out.');
  state.party.rows = { ...state.party.rows, [heroId]: row };
  return ok(`${HEROES[heroId].name} moves to the ${row} row.`);
}

export function setTactics(state: GameState, patch: Partial<Tactics>): ActionResult {
  state.tactics = { ...state.tactics, ...patch };
  return ok('Tactics updated.');
}

export function equip(state: GameState, heroId: string, slot: EquipSlot, itemId: string | null): ActionResult {
  const hero = state.heroes[heroId];
  if (!hero?.recruited) return fail('That wayfarer has not joined yet.');
  if (heroOnExpedition(state, heroId)) return fail(`${HEROES[heroId].name} is out with the party. Gear is locked until they are back and standing orders end.`);
  const current = hero.gear[slot];
  if (itemId) {
    const def = ITEMS[itemId];
    if (!def?.equip || def.equip.slot !== slot) return fail('That item does not fit this slot.');
    if (count(state, itemId) < 1) return fail(`You have no spare ${def.name}.`);
    removeItems(state, [{ item: itemId, qty: 1 }]);
  }
  if (current) addItem(state, null, current, 1);
  hero.gear = { ...hero.gear, [slot]: itemId };
  const max = heroStats(state, heroId).vigor;
  if (hero.hp > max) hero.hp = max;
  return ok(itemId ? `${HEROES[heroId].name} equips ${ITEMS[itemId].name}.` : `${HEROES[heroId].name} unequips ${ITEMS[current!]?.name ?? 'item'}.`);
}

// ---------------------------------------------------------------------------
// Work orders

function freeSlot(state: GameState, slot?: number): number {
  if (slot !== undefined) return state.orders[slot] ? -1 : slot;
  return state.orders.findIndex((o) => !o);
}

export function startOrder(
  state: GameState,
  ctx: SimContext,
  actionId: string,
  hands: number,
  target: number | null,
  slot?: number,
): ActionResult {
  const def = ACTIONS[actionId];
  if (!def) return fail('Unknown activity.');
  const av = actionAvailability(state, def);
  if (!av.ok) return fail(`Locked: ${av.reasons.join('; ')}.`);
  const s = freeSlot(state, slot);
  if (s < 0) return fail('Both work-order slots are busy. Cancel or wait for one to finish.');
  if (hands < 1 || hands > 2) return fail('A crew is one or two hands.');
  if (freeHands(state) < hands) return fail(`Not enough free hands (${freeHands(state)} free, ${hands} needed). Hands are shared with expedition porters.`);
  if (def.inputs && !hasItems(state, def.inputs)) {
    const miss = missingItems(state, def.inputs).map((m) => `${m.qty} ${ITEMS[m.item].name}`).join(', ');
    return fail(`Missing materials: ${miss}.`);
  }
  const o: WorkOrder = {
    id: state.nextId++,
    kind: 'action',
    actionId,
    hands,
    elapsed: 0,
    cycleMs: 1000,
    done: 0,
    target,
    status: 'running',
    seed: hash32(state.worldSeed, state.nextId, 0x0d3),
    produced: {},
  };
  state.orders[s] = o;
  tryStartCycle(state, null, o);
  state.stats.ordersStarted += 1;
  pushFeed(state, ctx, 'order', `Started work order: ${def.name}${target ? ` ×${target}` : ''}.`);
  after(state, ctx);
  return ok(`${def.name} started${o.status === 'blocked' ? ` but paused: ${o.blocked}` : ''}.`);
}

export function startBuild(state: GameState, ctx: SimContext, upgradeId: string, hands: number, slot?: number): ActionResult {
  const u = UPGRADES[upgradeId];
  if (!u) return fail('Unknown upgrade.');
  if (state.orders.some((o) => o?.kind === 'build' && o.upgradeId === upgradeId)) return fail(`${u.name} is already being built.`);
  const lvl = upgradeLevel(state, upgradeId);
  const next = u.levels[lvl];
  if (!next) return fail(`${u.name} is fully upgraded.`);
  const unmet = unmetReqs(state, next.requires);
  if (unmet.length) return fail(`Requires ${unmet.map(describeReq).join('; ')}.`);
  if (state.marks < next.marks) return fail(`Needs ${next.marks} marks (you have ${state.marks}).`);
  if (!hasItems(state, next.items)) {
    const miss = missingItems(state, next.items).map((m) => `${m.qty} ${ITEMS[m.item].name}`).join(', ');
    return fail(`Missing materials: ${miss}.`);
  }
  const s = freeSlot(state, slot);
  if (s < 0) return fail('Both work-order slots are busy. Construction needs a free slot.');
  if (freeHands(state) < hands) return fail(`Not enough free hands (${freeHands(state)} free).`);
  state.marks -= next.marks;
  removeItems(state, next.items);
  state.orders[s] = {
    id: state.nextId++,
    kind: 'build',
    upgradeId,
    level: lvl + 1,
    hands,
    elapsed: 0,
    cycleMs: buildCycleMs(state, next.seconds, hands),
    done: 0,
    target: 1,
    status: 'running',
    seed: 0,
    produced: {},
  };
  state.stats.ordersStarted += 1;
  pushFeed(state, ctx, 'build', `Construction started: ${u.name} level ${lvl + 1}.`);
  after(state, ctx);
  return ok(`Construction of ${u.name} level ${lvl + 1} has begun.`);
}

export function cancelOrder(state: GameState, ctx: SimContext, slot: number): ActionResult {
  const o = state.orders[slot];
  if (!o) return fail('That slot is already empty.');
  refundOrder(state, o);
  state.orders[slot] = null;
  const name = orderName(o);
  pushFeed(state, ctx, 'info', `Cancelled: ${name}. Unused materials returned.`);
  after(state, ctx);
  return ok(`${name} cancelled. Materials for the unfinished cycle were returned.`);
}

export function setOrderHands(state: GameState, slot: number, hands: number): ActionResult {
  const o = state.orders[slot];
  if (!o) return fail('No order in that slot.');
  if (o.kind === 'build') return fail('Construction crews are fixed once work begins.');
  if (hands < 1 || hands > 2) return fail('A crew is one or two hands.');
  if (hands > o.hands && freeHands(state) < hands - o.hands) return fail('No free hands to add to this crew.');
  const def = ACTIONS[o.actionId!];
  const frac = o.cycleMs > 0 ? o.elapsed / o.cycleMs : 0;
  o.hands = hands;
  if (o.status === 'running') {
    // Keep progress proportional when crew size changes.
    o.cycleMs = actionCycleMs(state, def, hands);
    o.elapsed = Math.floor(frac * o.cycleMs);
  }
  return ok(`Crew set to ${hands} hand${hands > 1 ? 's' : ''}.`);
}

// ---------------------------------------------------------------------------
// Contracts, charter, quartermaster

export function claimContract(state: GameState, ctx: SimContext, id: string): ActionResult {
  const r = claim(state, ctx, id);
  refreshTutorial(state);
  return r;
}

export function pledgeDoctrine(state: GameState, id: string): ActionResult {
  const d = DOCTRINES.find((x) => x.id === id);
  if (!d) return fail('Unknown doctrine.');
  const rankNeeded = RANKS.find((r) => r.doctrineTier === d.tier)!;
  if (rankOf(state.standing) < rankNeeded.rank) return fail(`Reach the rank of ${rankNeeded.name} (${rankNeeded.standing} standing) first.`);
  const existing = state.doctrines.find((x) => DOCTRINES.find((dd) => dd.id === x)?.tier === d.tier);
  if (existing === id) return fail('Already pledged.');
  if (existing) {
    if (state.marks < REPLEDGE_COST) return fail(`Re-pledging costs ${REPLEDGE_COST} marks.`);
    state.marks -= REPLEDGE_COST;
    state.doctrines = state.doctrines.filter((x) => x !== existing);
  }
  state.doctrines.push(id);
  return ok(`The Compact pledges itself to the ${d.name}.`);
}

export const SHOP: { item: string; qty: number; price: number }[] = [
  { item: 'trail_ration', qty: 5, price: 20 },
  { item: 'mending_tonic', qty: 2, price: 22 },
  { item: 'road_scrap', qty: 5, price: 12 },
];

export function buy(state: GameState, ctx: SimContext, idx: number): ActionResult {
  const offer = SHOP[idx];
  if (!offer) return fail('Nothing for sale there.');
  if (state.marks < offer.price) return fail(`Needs ${offer.price} marks (you have ${state.marks}).`);
  state.marks -= offer.price;
  addItem(state, ctx, offer.item, offer.qty);
  return ok(`Bought ${offer.qty} ${ITEMS[offer.item].name}.`);
}

export function sell(state: GameState, ctx: SimContext, item: string, qty: number): ActionResult {
  const have = count(state, item);
  const n = Math.min(have, Math.max(0, Math.floor(qty)));
  if (n <= 0) return fail('Nothing to sell.');
  const marks = (ITEMS[item]?.value ?? 0) * n;
  removeItems(state, [{ item, qty: n }]);
  state.marks += marks;
  state.stats.marksEarned += marks;
  pushFeed(state, ctx, 'info', `Sold ${n} ${ITEMS[item].name} for ${marks} marks.`);
  after(state, ctx);
  return ok(`Sold ${n} ${ITEMS[item].name} for ${marks} marks.`);
}

// ---------------------------------------------------------------------------
// Misc

export function markReportRead(state: GameState, id: number): void {
  const r = state.reports.find((x) => x.id === id);
  if (r) r.unread = false;
  refreshTutorial(state);
}

export function canDispatchRoute(state: GameState, routeId: string): boolean {
  return routeUnlocked(state, routeId);
}

export function reqMet(state: GameState, req: Parameters<typeof checkReq>[1]): boolean {
  return checkReq(state, req);
}
