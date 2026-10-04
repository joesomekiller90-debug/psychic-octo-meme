// The always-visible activity rail: what is running now and what could start next.
import { ACTIONS } from '../../game/data/actions';
import { UPGRADES } from '../../game/data/camp';
import { HEROES } from '../../game/data/heroes';
import { ROUTES } from '../../game/data/world';
import { legEnd, totalDuration } from '../../game/sim/expedition';
import { formatDuration } from '../../game/sim/format';
import { freeHands, healRatePerMs, heroStats, heroTravelling } from '../../game/sim/rules';
import type { ExpeditionState, GameState, WorkOrder } from '../../game/sim/state';
import { orderName } from '../../game/sim/workorders';
import { cancelOrder } from '../../game/sim/actions';
import { Icon } from '../icons';
import { store } from '../store';
import { Bar, HpBar, HeroBadge } from './common';
import { REST_THRESHOLD } from '../../game/sim/expedition';

export function expeditionStatus(s: GameState, e: ExpeditionState): { label: string; detail: string; frac: number; eta: number } {
  const route = ROUTES[e.routeId];
  if (e.phase === 'travel') {
    const total = totalDuration(e);
    const legStart = e.leg > 0 ? legEnd(e, e.leg - 1) : 0;
    const legLen = e.legs[e.leg] ?? 1;
    const legFrac = Math.max(0, Math.min(1, (e.elapsed - legStart) / legLen));
    return {
      label: `Leg ${Math.min(e.leg + 1, e.legs.length)} of ${e.legs.length} · ${e.legNames[e.leg] ?? ''}`,
      detail: `${Math.round(legFrac * 100)}% through this leg`,
      frac: e.elapsed / total,
      eta: total - e.elapsed,
    };
  }
  if (e.phase === 'return') {
    return {
      label: e.recalled ? 'Recalled · heading home' : e.outcome === 'defeat' ? 'Defeated · limping home' : 'Turned back · heading home',
      detail: route.name,
      frac: e.elapsed / Math.max(1, e.returnMs),
      eta: e.returnMs - e.elapsed,
    };
  }
  // resting between standing-order runs
  const rate = healRatePerMs(s);
  let wait = 0;
  for (const m of e.members) {
    const max = heroStats(s, m).vigor;
    const need = REST_THRESHOLD * max - s.heroes[m].hp;
    if (need > 0) wait = Math.max(wait, need / (max * rate));
  }
  return { label: `Resting before run ${e.run + 1}`, detail: 'Departs when everyone is at 90% health', frac: 1 - Math.min(1, wait / 120000), eta: wait };
}

function ExpeditionCard() {
  const s = store.state;
  const e = s.expedition;
  if (!e) {
    return (
      <button type="button" class="act-card act-idle" onClick={() => store.go('expeditions')}>
        <span class="act-icon">
          <Icon name="compass" />
        </span>
        <span class="act-main">
          <span class="act-title">No expedition out</span>
          <span class="act-sub">Plan a route and dispatch the party</span>
        </span>
        <Icon name="chevron" size={16} />
      </button>
    );
  }
  const st = expeditionStatus(s, e);
  const route = ROUTES[e.routeId];
  return (
    <button type="button" class={`act-card act-exp phase-${e.phase}`} onClick={() => store.go('expeditions')}>
      <span class="act-icon glow">
        <Icon name={e.phase === 'rest' ? 'repeat' : 'compass'} />
      </span>
      <span class="act-main">
        <span class="act-title">{route.name}</span>
        <span class="act-sub">{st.label}</span>
        {e.phase === 'travel' ? (
          <span class="legbar" aria-hidden="true">
            {e.legs.map((_, i) => {
              const start = i > 0 ? legEnd(e, i - 1) : 0;
              const f = Math.max(0, Math.min(1, (e.elapsed - start) / e.legs[i]));
              return (
                <span class={`leg ${i < e.leg ? 'done' : ''}`}>
                  <span class="leg-fill" style={{ width: `${f * 100}%` }} />
                </span>
              );
            })}
          </span>
        ) : (
          <Bar value={st.frac} tone={e.phase === 'rest' ? 'moss' : 'ember'} size="xs" label={st.label} />
        )}
        <span class="act-meta">
          <Icon name="clock" size={13} /> {formatDuration(st.eta)} {e.phase === 'travel' ? 'until home' : e.phase === 'return' ? 'until home' : 'until departure'}
          {e.repeatLeft !== 0 && <span class="tag-inline"> · standing orders {e.repeatLeft < 0 ? '∞' : `+${e.repeatLeft}`}</span>}
        </span>
      </span>
    </button>
  );
}

function OrderCard({ o, slot }: { o: WorkOrder | null; slot: number }) {
  const s = store.state;
  if (!o) {
    const free = freeHands(s);
    return (
      <button type="button" class="act-card act-idle" onClick={() => store.go('skills')}>
        <span class="act-icon">
          <Icon name="hand" />
        </span>
        <span class="act-main">
          <span class="act-title">Work slot {slot + 1} idle</span>
          <span class="act-sub">{free > 0 ? `${free} hand${free > 1 ? 's' : ''} free · start work` : 'No free hands right now'}</span>
        </span>
        <Icon name="chevron" size={16} />
      </button>
    );
  }
  const name = orderName(o);
  const icon = o.kind === 'build' ? UPGRADES[o.upgradeId!].icon : ACTIONS[o.actionId!].skill;
  const frac = o.status === 'running' ? o.elapsed / o.cycleMs : 0;
  return (
    <div class={`act-card act-order ${o.status === 'blocked' ? 'blocked' : ''}`}>
      <span class={`act-icon ${o.status === 'running' ? 'glow' : 'warn'}`}>
        <Icon name={o.status === 'blocked' ? 'alert' : icon} />
      </span>
      <span class="act-main">
        <span class="act-title">{name}</span>
        {o.status === 'blocked' ? (
          <span class="act-sub warn-text">{o.blocked}</span>
        ) : (
          <>
            <Bar value={frac} tone={o.kind === 'build' ? 'tide' : 'amber'} size="xs" label={`${name} progress`} />
            <span class="act-meta">
              <Icon name="hand" size={13} /> {o.hands} · {o.kind === 'build' ? `${formatDuration(o.cycleMs - o.elapsed)} left` : `${o.done}${o.target ? `/${o.target}` : ''} done · ${formatDuration(o.cycleMs - o.elapsed)}`}
            </span>
          </>
        )}
      </span>
      <button
        type="button"
        class="icon-btn icon-btn-sm"
        aria-label={`Cancel ${name}`}
        title="Cancel (unfinished materials are returned)"
        onClick={() => store.act((st, ctx) => cancelOrder(st, ctx, slot))}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

function PartyHealth() {
  const s = store.state;
  const e = s.expedition;
  const members = e ? e.members : s.party.members;
  if (!members.length) return null;
  return (
    <div class="rail-party">
      {members.map((m) => {
        const max = heroStats(s, m).vigor;
        const away = heroTravelling(s, m);
        const hp = away && e ? e.hp[m] : s.heroes[m].hp;
        const healing = !away && hp < max;
        const eta = healing ? (max - hp) / (max * healRatePerMs(s)) : 0;
        return (
          <div class="rail-hero">
            <HeroBadge id={m} size={30} />
            <div class="rail-hero-main">
              <div class="rail-hero-top">
                <span>{HEROES[m].name.split(' ')[0]}</span>
                <span class="muted small">
                  {Math.round(hp)}/{max}
                </span>
              </div>
              <HpBar hp={hp} max={max} size="xs" />
              <span class="muted tiny">{away ? 'On the road' : healing ? `Healing · full in ${formatDuration(eta)}` : 'Rested'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ActivityRail() {
  const s = store.state;
  return (
    <aside class="rail" aria-label="Current activity">
      <div class="rail-section">
        <h3 class="rail-h">
          <Icon name="compass" size={15} /> Expedition
        </h3>
        <ExpeditionCard />
      </div>
      <div class="rail-section">
        <h3 class="rail-h">
          <Icon name="hand" size={15} /> Camp work
        </h3>
        {s.orders.map((o, i) => (
          <OrderCard o={o} slot={i} />
        ))}
      </div>
      <div class="rail-section rail-hide-sm">
        <h3 class="rail-h">
          <Icon name="heart" size={15} /> Party health
        </h3>
        <PartyHealth />
      </div>
      <div class="rail-section rail-hide-sm">
        <h3 class="rail-h">
          <Icon name="sparkle" size={15} /> Recent
        </h3>
        {s.feed.length === 0 ? (
          <p class="muted small">Nothing yet. Rewards and events will appear here.</p>
        ) : (
          <ul class="feed">
            {s.feed.slice(0, 6).map((f) => (
              <li class={`feed-item feed-${f.kind}`}>{f.text}</li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
