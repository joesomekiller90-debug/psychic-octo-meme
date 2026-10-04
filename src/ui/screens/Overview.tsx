import { ACTIONS } from '../../game/data/actions';
import { CONTRACTS, SETTLEMENT_GIVERS, UPGRADE_LIST } from '../../game/data/camp';
import { ITEMS } from '../../game/data/items';
import { REGION_LIST, REGIONS, ROUTE_LIST, ROUTES } from '../../game/data/world';
import { startOrder } from '../../game/sim/actions';
import { activeContracts, contractProgress, readyContracts } from '../../game/sim/contracts';
import { hasItems } from '../../game/sim/core';
import { formatDuration } from '../../game/sim/format';
import { actionAvailability, freeHands, heroStats, offlineCapMs, regionUnlocked, routeLockReasons, routeUnlocked, unmetReqs, upgradeLevel } from '../../game/sim/rules';
import type { GameState } from '../../game/sim/state';
import { TUTORIAL } from '../../game/sim/tutorial';
import { Icon } from '../icons';
import { store, type Screen } from '../store';
import { expeditionStatus } from '../components/activity';
import { Bar, Button, Empty, ItemChip, Panel, Tag } from '../components/common';

interface Goal {
  icon: string;
  title: string;
  text: string;
  screen: Screen;
  cta: string;
  patch?: Partial<typeof store.ui>;
}

export function nextGoals(s: GameState): Goal[] {
  const out: Goal[] = [];
  for (const c of readyContracts(s)) {
    out.push({ icon: 'scroll', title: `Claim "${c.title}"`, text: 'This contract is complete. Claim its reward in the Journal.', screen: 'journal', cta: 'Claim', patch: { journalTab: 'contracts' } });
  }
  const unread = s.reports.find((r) => r.unread);
  if (unread) out.push({ icon: 'journal', title: 'Read the latest journey report', text: `${ROUTES[unread.routeId].name}: see what the party found.`, screen: 'expeditions', cta: 'Open' });
  if (!s.expedition) {
    const next = ROUTE_LIST.find((r) => routeUnlocked(s, r.id) && !(s.stats.routeClears[r.id] ?? 0));
    const r = next ?? ROUTE_LIST.filter((x) => routeUnlocked(s, x.id)).pop();
    if (r) out.push({ icon: 'compass', title: `Send the party: ${r.name}`, text: next ? 'A route you have not completed yet.' : 'Run it again for materials and experience.', screen: 'expeditions', cta: 'Plan', patch: { routeId: r.id, region: r.region } });
  }
  if (s.orders.some((o) => !o) && freeHands(s) > 0) {
    out.push({ icon: 'hand', title: 'Put idle hands to work', text: `${freeHands(s)} hand${freeHands(s) > 1 ? 's are' : ' is'} free and a work slot is open.`, screen: 'skills', cta: 'Start work' });
  }
  const locked = ROUTE_LIST.find((r) => !routeUnlocked(s, r.id));
  if (locked) {
    const why = routeLockReasons(s, locked.id)[0];
    if (why) out.push({ icon: 'lock', title: `Unlock ${regionUnlocked(s, locked.region) ? locked.name : REGIONS[locked.region].name}`, text: `Requires: ${why}`, screen: 'expeditions', cta: 'View', patch: { routeId: locked.id, region: locked.region } });
  }
  for (const u of UPGRADE_LIST) {
    const lvl = upgradeLevel(s, u.id);
    const next = u.levels[lvl];
    if (!next || unmetReqs(s, next.requires).length) continue;
    if (s.marks >= next.marks && hasItems(s, next.items)) {
      out.push({ icon: u.icon, title: `Build ${u.name} ${lvl + 1}`, text: next.effect, screen: 'camp', cta: 'Build' });
      break;
    }
  }
  return out.slice(0, 4);
}

function Guide() {
  const s = store.state;
  const step = s.tutorial.step;
  if (s.tutorial.hidden) return null;
  if (step >= TUTORIAL.length) return null;
  const t = TUTORIAL[step];
  return (
    <Panel
      title="Guide"
      icon="lantern"
      tone="accent"
      class="guide"
      sub={`Step ${step + 1} of ${TUTORIAL.length}`}
      actions={
        <Button size="sm" variant="ghost" onClick={() => store.act((x) => void (x.tutorial.hidden = true), { quiet: true })}>
          Hide guide
        </Button>
      }
    >
      <div class="guide-body">
        <div>
          <h3 class="guide-title">{t.title}</h3>
          <p>{t.text}</p>
        </div>
        <Button variant="primary" icon="chevron" onClick={() => store.go(t.screen, t.screen === 'journal' ? { journalTab: 'contracts' } : {})}>
          Show me
        </Button>
      </div>
      <div class="guide-steps" aria-hidden="true">
        {TUTORIAL.map((_, i) => (
          <span class={`gstep ${i < step ? 'done' : i === step ? 'now' : ''}`} />
        ))}
      </div>
    </Panel>
  );
}

function NowPanel() {
  const s = store.state;
  const e = s.expedition;
  return (
    <Panel title="Expedition" icon="compass">
      {e ? (
        (() => {
          const st = expeditionStatus(s, e);
          const route = ROUTES[e.routeId];
          const last = [...e.log].reverse().find((l) => l.kind !== 'travel') ?? e.log[e.log.length - 1];
          return (
            <div class="now-exp">
              <div class="row between">
                <div>
                  <b class="big">{route.name}</b>
                  <div class="small muted">{st.label}</div>
                </div>
                <Tag tone="amber" icon="clock">
                  {formatDuration(st.eta)}
                </Tag>
              </div>
              <Bar value={st.frac} tone={e.phase === 'travel' ? 'amber' : e.phase === 'rest' ? 'moss' : 'ember'} size="sm" label="Expedition progress" />
              {last && <p class="small now-last">{last.text}</p>}
              <Button size="sm" icon="chevron" onClick={() => store.go('expeditions')}>
                Follow the journey
              </Button>
            </div>
          );
        })()
      ) : (
        <Empty icon="compass" title="The party is in camp" action={<Button variant="primary" icon="compass" onClick={() => store.go('expeditions')}>Plan an expedition</Button>}>
          {s.party.members.some((m) => s.heroes[m].hp / heroStats(s, m).vigor < 0.6)
            ? 'Some wayfarers are still recovering. You can still go, with tonics packed.'
            : 'Everyone is rested. Choose a route on the map.'}
        </Empty>
      )}
    </Panel>
  );
}

const QUICK = ['brew_rations', 'gather_fenberries', 'gather_wildroot', 'mine_rustrock', 'sift_scrapheap', 'study_waymarks'];

function WorkPanel() {
  const s = store.state;
  const idle = s.orders.filter((o) => !o).length;
  const quick = QUICK.map((id) => ACTIONS[id]).filter((a) => actionAvailability(s, a).ok && hasItems(s, a.inputs)).slice(0, 4);
  return (
    <Panel title="Camp work" icon="hand" sub={`${freeHands(s)} hands free`}>
      {idle === 0 ? (
        <p class="small muted">Both work slots are busy. Their progress is shown in the activity rail.</p>
      ) : (
        <>
          <p class="small">
            {idle === 2 ? 'Both work slots are idle.' : 'One work slot is idle.'} Quick start (1 hand, runs until stopped):
          </p>
          <div class="quick-grid">
            {quick.map((a) => (
              <Button
                icon={a.skill}
                blocked={freeHands(s) < 1 ? 'No free hands. Porters and other work orders are using them all.' : null}
                onClick={() => store.act((x, ctx) => startOrder(x, ctx, a.id, 1, a.kind === 'craft' ? 5 : null))}
              >
                {a.name}
                {a.kind === 'craft' ? ' ×5' : ''}
              </Button>
            ))}
            <Button variant="ghost" icon="skills" onClick={() => store.go('skills')}>
              All activities
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}

function ContractsPanel() {
  const s = store.state;
  const list = activeContracts(s)
    .map((c) => ({ c, p: contractProgress(s, c) }))
    .sort((a, b) => Number(b.p.ready) - Number(a.p.ready) || b.p.have / b.p.need - a.p.have / a.p.need)
    .slice(0, 4);
  return (
    <Panel title="Contracts" icon="scroll" actions={<Button size="sm" variant="ghost" onClick={() => store.go('journal', { journalTab: 'contracts' })}>All contracts</Button>}>
      {list.length === 0 ? (
        <p class="small muted">No open contracts. Reconnect settlements to hear their requests.</p>
      ) : (
        <ul class="mini-contracts">
          {list.map(({ c, p }) => (
            <li>
              <div class="row between">
                <b>{c.title}</b>
                {p.ready ? <Tag tone="moss" icon="check">Ready</Tag> : <span class="small muted">{p.have}/{p.need}</span>}
              </div>
              <div class="tiny muted">{SETTLEMENT_GIVERS[c.giver]?.name} · {c.settlement}</div>
              <Bar value={p.have / p.need} tone={p.ready ? 'moss' : 'amber'} size="xs" label={`${c.title} progress`} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function StoresPanel() {
  const s = store.state;
  const key = ['trail_ration', 'mending_tonic', 'antidote', 'fire_flask', 'climbing_kit', 'fittings', 'braced_beam', 'iron_brackets'];
  const shown = key.filter((k) => (s.inventory[k] ?? 0) > 0 || k === 'trail_ration' || k === 'mending_tonic');
  return (
    <Panel title="Key stores" icon="crate" actions={<Button size="sm" variant="ghost" onClick={() => store.go('camp')}>All stores</Button>}>
      <div class="haul">
        {shown.map((k) => (
          <ItemChip id={k} qty={s.inventory[k] ?? 0} compact />
        ))}
      </div>
      {(s.inventory.trail_ration ?? 0) < 4 && (
        <p class="small warn-text">
          <Icon name="alert" size={14} /> Rations are low. Brew Trail Rations (Alchemy) from fenberries and wildroot, or buy them in Camp.
        </p>
      )}
    </Panel>
  );
}

function Settlements() {
  const s = store.state;
  return (
    <div class="settle-row">
      <div class="settle-card on">
        <Icon name="lantern" size={20} />
        <div>
          <b>Lanternhold</b>
          <div class="tiny muted">Your camp · the last lit waystone</div>
        </div>
      </div>
      {REGION_LIST.map((r) => {
        const on = !!s.flags[r.settlement.flag];
        return (
          <div class={`settle-card ${on ? 'on' : ''}`}>
            <Icon name={on ? 'waystone' : 'lock'} size={20} />
            <div>
              <b>{r.settlement.name}</b>
              <div class="tiny muted">{on ? 'Reconnected' : `Cut off · ${r.name}`}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Overview() {
  const s = store.state;
  const goals = nextGoals(s);
  const day = Math.floor((Date.now() - s.createdAt) / 86_400_000) + 1;
  return (
    <div class="screen">
      <header class="screen-head">
        <h1>Lanternhold</h1>
        <p>
          Day {day} of the Compact · offline progress counts for up to {offlineCapMs(s) / 3600_000} hours while you are away.
        </p>
      </header>
      <Settlements />
      <Guide />
      {goals.length > 0 && (
        <Panel title="Next steps" icon="flag">
          <ul class="goals">
            {goals.map((g) => (
              <li class="goal">
                <span class="goal-icon">
                  <Icon name={g.icon} size={18} />
                </span>
                <div class="goal-main">
                  <b>{g.title}</b>
                  <div class="small muted">{g.text}</div>
                </div>
                <Button size="sm" onClick={() => store.go(g.screen, g.patch ?? {})}>
                  {g.cta}
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <div class="two-col">
        <div class="col">
          <NowPanel />
          <WorkPanel />
        </div>
        <div class="col">
          <ContractsPanel />
          <StoresPanel />
        </div>
      </div>
    </div>
  );
}

export function contractTitle(id: string): string {
  return CONTRACTS[id]?.title ?? id;
}

export function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
}
