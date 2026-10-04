import { useMemo } from 'preact/hooks';
import { ENEMIES } from '../../game/data/enemies';
import { HEROES } from '../../game/data/heroes';
import { ITEMS, SUPPLY_ORDER } from '../../game/data/items';
import { DISCOVERIES, DRIFTS, HAZARDS, REGION_LIST, REGIONS, ROUTE_LIST, ROUTES } from '../../game/data/world';
import { autoPack, dispatch, markReportRead, recall, setStandingOrders, setSupply, updatePlan } from '../../game/sim/actions';
import { checkPlan, legEnd } from '../../game/sim/expedition';
import { forecastExpedition, type Forecast } from '../../game/sim/forecast';
import { formatDuration, pct } from '../../game/sim/format';
import {
  RISKS,
  describeReq,
  driftEndsAt,
  driftFor,
  expeditionDurationMult,
  freeHands,
  heroStats,
  intelLevel,
  partyCarry,
  regionUnlocked,
  routeLockReasons,
  routeUnlocked,
} from '../../game/sim/rules';
import type { Risk } from '../../game/sim/state';
import type { RouteDef } from '../../game/types';
import { Icon } from '../icons';
import { store } from '../store';
import { expeditionStatus } from '../components/activity';
import {
  Bar,
  Button,
  Empty,
  EnemyBadge,
  HeroBadge,
  HpBar,
  ItemChip,
  ItemIcon,
  Panel,
  Pips,
  Segmented,
  Stepper,
  Tag,
  Term,
  TRAIT_LABEL,
  useNow,
} from '../components/common';
import { JourneyLog } from '../components/log';

const KIND_LABEL: Record<string, string> = { survey: 'Survey', gather: 'Gathering', relight: 'Relight waystone', hunt: 'Hunt' };
const KIND_ICON: Record<string, string> = { survey: 'spyglass', gather: 'leaf', relight: 'waystone', hunt: 'skull' };

// ---------------------------------------------------------------------------
// Map

const LINKS: [string, string][] = [
  ['camp', 'wildroot_trail'],
  ['wildroot_trail', 'reedcutters_loop'],
  ['wildroot_trail', 'old_ferry_road'],
  ['wildroot_trail', 'matriarch_thicket'],
  ['matriarch_thicket', 'slagstep_terraces'],
  ['slagstep_terraces', 'harrier_ridge'],
  ['harrier_ridge', 'kilnmouth_gate'],
  ['kilnmouth_gate', 'saltmarsh_approach'],
  ['saltmarsh_approach', 'sunken_archive'],
  ['sunken_archive', 'drowned_engine'],
];

const CAMP = { x: 38, y: 86 };
const px = (p: { x: number; y: number }) => ({ x: p.x * 10, y: p.y * 6.4 });

function MapView() {
  const s = store.state;
  const ui = store.ui;
  const e = s.expedition;
  const pt = (id: string) => (id === 'camp' ? px(CAMP) : px(ROUTES[id].map));
  const regionLocked = (id: string) => !regionUnlocked(s, id);
  return (
    <div class="map-wrap">
      <svg class="map" viewBox="0 0 1000 640" role="group" aria-label="Map of the Marches">
        <defs>
          <pattern id="fog" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="10" height="10" fill="#0d1316" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="#24323a" stroke-width="3" />
          </pattern>
          <radialGradient id="lit" r="50%">
            <stop offset="0" stop-color="#ffd58a" stop-opacity="0.9" />
            <stop offset="1" stop-color="#f2ad4e" stop-opacity="0" />
          </radialGradient>
          <pattern id="waves" width="40" height="16" patternUnits="userSpaceOnUse">
            <path d="M0 8 q10 -6 20 0 t20 0" fill="none" stroke="#2b5562" stroke-width="1.2" opacity="0.6" />
          </pattern>
        </defs>
        {/* Sea */}
        <path d="M600 330 C700 300 820 300 1000 280 L1000 640 L620 640 C650 560 590 470 640 420 C660 390 610 360 600 330z" fill="#0f2730" />
        <path d="M600 330 C700 300 820 300 1000 280 L1000 640 L620 640 C650 560 590 470 640 420 C660 390 610 360 600 330z" fill="url(#waves)" />
        {/* Regions */}
        <path class="reg reg-hollowmere" d="M60 330 C120 250 300 230 430 280 C540 320 610 380 600 470 C590 560 520 620 380 630 C230 640 90 600 50 520 C20 450 30 380 60 330z" />
        <path class="reg reg-cinderscar" d="M300 60 C420 20 700 20 880 60 C960 90 960 200 930 260 C880 330 700 300 560 290 C430 280 330 250 290 190 C260 140 260 90 300 60z" />
        <path class="reg reg-causeway" d="M640 330 C760 300 900 300 980 320 L980 600 C900 630 760 630 660 610 C620 540 610 450 640 330z" />
        {/* Decorations */}
        <g class="deco">
          {[
            [140, 400],
            [180, 560],
            [240, 450],
            [420, 560],
            [470, 360],
            [120, 470],
            [330, 590],
          ].map(([x, y]) => (
            <path d={`M${x} ${y - 14} l9 14 h-18z M${x} ${y} v6`} />
          ))}
          {[
            [380, 110],
            [520, 80],
            [720, 70],
            [600, 170],
            [860, 120],
          ].map(([x, y]) => (
            <path d={`M${x - 26} ${y + 14} l16 -24 8 10 10 -16 18 30`} />
          ))}
          <path d="M700 520 h220" class="causeway-line" />
          <path d="M700 520 h220" class="causeway-dash" />
        </g>
        {/* Fog over locked regions */}
        {REGION_LIST.filter((r) => regionLocked(r.id)).map((r) => (
          <path
            class="fog"
            d={
              r.id === 'cinderscar'
                ? 'M300 60 C420 20 700 20 880 60 C960 90 960 200 930 260 C880 330 700 300 560 290 C430 280 330 250 290 190 C260 140 260 90 300 60z'
                : 'M640 330 C760 300 900 300 980 320 L980 600 C900 630 760 630 660 610 C620 540 610 450 640 330z'
            }
            fill="url(#fog)"
          />
        ))}
        {/* Region labels */}
        {REGION_LIST.map((r) => {
          const pos = r.id === 'hollowmere' ? [230, 612] : r.id === 'cinderscar' ? [620, 46] : [815, 600];
          return (
            <text class={`reg-label ${ui.region === r.id ? 'on' : ''}`} x={pos[0]} y={pos[1]} text-anchor="middle">
              {r.name.toUpperCase()}
            </text>
          );
        })}
        {/* Links */}
        {LINKS.map(([a, b]) => {
          const pa = pt(a);
          const pb = pt(b);
          const lit = (b !== 'camp' && (s.stats.routeClears[b] ?? 0) > 0) || false;
          const vis = routeUnlocked(s, b) || lit;
          const mx = (pa.x + pb.x) / 2 + (pb.y - pa.y) * 0.12;
          const my = (pa.y + pb.y) / 2 - (pb.x - pa.x) * 0.12;
          return <path class={`link ${lit ? 'lit' : vis ? 'open' : 'closed'}`} d={`M${pa.x} ${pa.y} Q${mx} ${my} ${pb.x} ${pb.y}`} />;
        })}
        {/* Settlements */}
        {[
          { name: 'Fenwick Stile', flag: 'fenwick', x: 590, y: 548 },
          { name: 'Kilnmouth', flag: 'kilnmouth', x: 885, y: 252 },
          { name: 'Tollspire', flag: 'tollspire', x: 948, y: 372 },
        ].map((t) => (
          <g class={`settle ${s.flags[t.flag] ? 'on' : ''}`} transform={`translate(${t.x} ${t.y})`}>
            <rect x="-9" y="-9" width="18" height="18" rx="3" transform="rotate(45)" />
            <text y="26" text-anchor="middle">
              {t.name}
            </text>
          </g>
        ))}
        {/* Camp */}
        <g class="camp-node" transform={`translate(${px(CAMP).x} ${px(CAMP).y})`}>
          <circle r="34" fill="url(#lit)" />
          <path d="M-12 8 L0 -14 L12 8z" />
          <text y="30" text-anchor="middle">
            Lanternhold
          </text>
        </g>
        {/* Route nodes */}
        {ROUTE_LIST.map((r) => {
          const p = px(r.map);
          const open = routeUnlocked(s, r.id);
          const cleared = (s.stats.routeClears[r.id] ?? 0) > 0;
          const active = e?.routeId === r.id;
          const sel = ui.routeId === r.id;
          const hiddenName = !open && !regionUnlocked(s, r.region);
          const label = hiddenName ? 'Uncharted route' : r.name;
          return (
            <g
              class={`node ${open ? 'open' : 'locked'} ${cleared ? 'cleared' : ''} ${active ? 'active' : ''} ${sel ? 'sel' : ''}`}
              transform={`translate(${p.x} ${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${label}${cleared ? ', cleared' : open ? ', available' : ', locked'}`}
              onClick={() => store.setUi({ routeId: r.id, region: r.region })}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  store.setUi({ routeId: r.id, region: r.region });
                }
              }}
            >
              {cleared && <circle r="26" fill="url(#lit)" />}
              {active && <circle class="pulse" r="18" />}
              <path class="node-shape" d="M0 -13 L9 0 L0 13 L-9 0z" />
              {!open && <path class="node-lock" d="M-3 -1 h6 v5 h-6z M-2 -1 v-2 a2 2 0 0 1 4 0 v2" />}
              {(!hiddenName || sel) && (
                <text class="node-label" y={-20} x={p.x > 860 ? 14 : 0} text-anchor={p.x > 860 ? 'end' : 'middle'}>
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div class="map-legend" aria-hidden="true">
        <span>
          <i class="lg lg-open" /> Available
        </span>
        <span>
          <i class="lg lg-cleared" /> Waystone relit / cleared
        </span>
        <span>
          <i class="lg lg-locked" /> Locked
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Region and routes

function DriftInfo({ regionId }: { regionId: string }) {
  const now = useNow(30000);
  const id = driftFor(regionId, now);
  const d = DRIFTS[id];
  return (
    <div class={`drift drift-${id}`}>
      <Icon name={id === 'mist' ? 'drop' : id === 'bloom' ? 'leaf' : id === 'quiet' ? 'eye' : id === 'ashfall' ? 'fire' : id === 'springtide' ? 'wave' : 'sparkle'} size={18} />
      <div>
        <div>
          <Term k="drift">
            <b>{d.name}</b>
          </Term>{' '}
          <span class="muted small">shifts in {formatDuration(driftEndsAt(now) - now, { short: true })}</span>
        </div>
        <div class="small muted">{d.desc}</div>
      </div>
    </div>
  );
}

function RouteRow({ r }: { r: RouteDef }) {
  const s = store.state;
  const open = routeUnlocked(s, r.id);
  const cleared = s.stats.routeClears[r.id] ?? 0;
  const runs = s.stats.routeRuns[r.id] ?? 0;
  const sel = store.ui.routeId === r.id;
  const dur = r.legs * r.legSeconds * 1000 * expeditionDurationMult(s, s.party.members, 'standard', 'clear').mult;
  const reasons = open ? [] : routeLockReasons(s, r.id);
  return (
    <button type="button" class={`route-row ${sel ? 'sel' : ''} ${open ? '' : 'locked'}`} aria-pressed={sel} onClick={() => store.setUi({ routeId: r.id })}>
      <span class={`route-ico kind-${r.kind}`}>
        <Icon name={open ? KIND_ICON[r.kind] : 'lock'} size={18} />
      </span>
      <span class="route-main">
        <span class="route-name">
          {r.name}
          {cleared > 0 && <Tag tone="moss" icon="check">{r.kind === 'relight' ? 'Relit' : r.kind === 'hunt' ? 'Slain' : `Cleared ×${cleared}`}</Tag>}
        </span>
        <span class="route-meta">
          {KIND_LABEL[r.kind]} · {r.legs} legs · ~{formatDuration(dur, { short: true })} ·{' '}
          <Pips n={r.danger} max={5} tone={r.danger >= 4 ? 'ember' : r.danger >= 3 ? 'warn' : 'moss'} label={`Danger ${r.danger} of 5`} />
        </span>
        {!open && <span class="route-lock">Requires: {reasons.join(' · ')}</span>}
        {open && runs === 0 && <span class="route-new">New route</span>}
      </span>
    </button>
  );
}

function RegionPanel() {
  const s = store.state;
  const region = REGIONS[store.ui.region];
  const unlocked = regionUnlocked(s, region.id);
  return (
    <Panel
      title={region.name}
      icon={region.id === 'hollowmere' ? 'tree' : region.id === 'cinderscar' ? 'mountain' : 'wave'}
      class="region-panel"
      actions={
        <div class="region-tabs" role="tablist" aria-label="Regions">
          {REGION_LIST.map((r) => (
            <button
              type="button"
              role="tab"
              aria-selected={r.id === region.id}
              class={`chip-btn ${r.id === region.id ? 'on' : ''}`}
              onClick={() => store.setUi({ region: r.id, routeId: ROUTE_LIST.find((x) => x.region === r.id)?.id ?? null })}
            >
              {!regionUnlocked(s, r.id) && <Icon name="lock" size={13} />}
              {r.name.split(' ')[0]}
            </button>
          ))}
        </div>
      }
    >
      <p class="lede">{region.blurb}</p>
      {unlocked ? (
        <DriftInfo regionId={region.id} />
      ) : (
        <div class="locked-note">
          <Icon name="lock" size={16} /> Locked. Requires: {region.requires.map((q) => describeReq(q)).join(' · ')}.
        </div>
      )}
      <div class={`settlement ${s.flags[region.settlement.flag] ? 'on' : ''}`}>
        <Icon name="waystone" size={18} />
        <div>
          <b>{region.settlement.name}</b> <Tag tone={s.flags[region.settlement.flag] ? 'moss' : 'muted'}>{s.flags[region.settlement.flag] ? 'Reconnected' : 'Cut off'}</Tag>
          <div class="small muted">{region.settlement.blurb}</div>
        </div>
      </div>
      <div class="route-list">
        {ROUTE_LIST.filter((r) => r.region === region.id).map((r) => (
          <RouteRow r={r} />
        ))}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Planner

const REPEAT_OPTS = [
  { value: 0, label: 'Once' },
  { value: 2, label: '3 runs' },
  { value: 4, label: '5 runs' },
  { value: -1, label: 'Until stopped' },
];

function Planner({ route }: { route: RouteDef }) {
  const s = store.state;
  const plan = s.plan.routeId === route.id ? s.plan : { ...s.plan, routeId: route.id };
  const check = checkPlan(s, plan);
  const open = routeUnlocked(s, route.id);
  const members = s.party.members.filter((m) => s.heroes[m].recruited);
  const carry = partyCarry(s, members, plan.porters);
  const load = check.load;
  const handsAvail = freeHands(s);
  const maxPorters = Math.min(3, handsAvail);
  const ensureRoute = () => {
    if (s.plan.routeId !== route.id) store.act((st) => updatePlan(st, { routeId: route.id }), { quiet: true });
  };
  const supplyIds = SUPPLY_ORDER.filter((id) => (s.inventory[id] ?? 0) > 0 || (plan.supplies[id] ?? 0) > 0);
  const missingSupplies = SUPPLY_ORDER.filter((id) => !supplyIds.includes(id) && s.codex.items[id]);
  const blocked = !open ? `Route locked: ${routeLockReasons(s, route.id).join('; ')}` : s.expedition ? 'An expedition is already out. Wait for it, or recall it.' : check.errors[0] ?? null;
  const rationsShort = (plan.supplies.trail_ration ?? 0) < route.legs;

  return (
    <div class="planner">
      <div class="plan-section">
        <div class="plan-h">
          <h3>
            <Icon name="users" size={17} /> Party &amp; formation
          </h3>
          <Button size="sm" variant="ghost" icon="chevron" onClick={() => store.go('party')}>
            Edit party &amp; tactics
          </Button>
        </div>
        {members.length === 0 ? (
          <p class="warn-text">No wayfarers selected. Choose a party first.</p>
        ) : (
          <div class="plan-party">
            {members.map((m) => {
              const st = heroStats(s, m);
              const hp = s.heroes[m].hp;
              return (
                <div class="plan-hero">
                  <HeroBadge id={m} size={36} />
                  <div class="plan-hero-main">
                    <div class="plan-hero-top">
                      <b>{HEROES[m].name.split(' ')[0]}</b>
                      <span class="muted small">
                        {HEROES[m].roleLabel} · Lv {s.heroes[m].level} · {s.party.rows[m] === 'front' ? 'Front' : 'Back'}
                      </span>
                    </div>
                    <HpBar hp={hp} max={st.vigor} size="xs" />
                    <span class="tiny muted">
                      {Math.round(hp)}/{st.vigor} health · Might {st.might} · Guard {st.guard}
                      {st.light ? ' · Light' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p class="small muted plan-tactics">
          Tactics: focus {s.tactics.focus === 'threats' ? 'threats first' : `${s.tactics.focus} first`} · tonics below {pct(s.tactics.tonicAt)} · flasks{' '}
          {s.tactics.flasks === 'always' ? 'every fight' : s.tactics.flasks === 'finale' ? 'objective fights' : 'never'} · retreat below {pct(s.tactics.retreatAt)}
        </p>
      </div>

      <div class="plan-section">
        <div class="plan-h">
          <h3>
            <Icon name="pack" size={17} /> Supplies
          </h3>
          <Button
            size="sm"
            variant="ghost"
            icon="sparkle"
            onClick={() =>
              store.act((st) => {
                updatePlan(st, { routeId: route.id });
                return autoPack(st);
              })
            }
          >
            Pack recommended
          </Button>
        </div>
        <div class="carry">
          <Term k="capacity">
            <span class="small">
              Load <b>{load}</b> of <b>{carry}</b> carry
            </span>
          </Term>
          <Bar value={load / Math.max(1, carry)} tone={load > carry ? 'ember' : 'tide'} size="xs" label="Pack load" />
          <span class="tiny muted">{Math.max(0, carry - load)} free for loot</span>
        </div>
        {supplyIds.length === 0 ? (
          <p class="small warn-text">No supplies in stock. Brew rations and tonics in the Workshop, or buy rations in Camp.</p>
        ) : (
          <div class="supply-list">
            {supplyIds.map((id) => {
              const def = ITEMS[id];
              const have = s.inventory[id] ?? 0;
              const n = plan.supplies[id] ?? 0;
              return (
                <div class="supply-row">
                  <ItemIcon id={id} size={30} />
                  <div class="supply-main">
                    <div>
                      <b>{def.name}</b> <span class="muted small">{have} in stores</span>
                    </div>
                    <div class="tiny muted">{def.desc}</div>
                  </div>
                  <Stepper
                    label={def.name}
                    value={n}
                    min={0}
                    max={have}
                    onChange={(v) => {
                      ensureRoute();
                      store.act((st) => setSupply(st, id, v), { quiet: true });
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
        {rationsShort && (
          <p class="small warn-text">
            <Icon name="alert" size={14} /> {route.legs} legs need {route.legs} rations; {plan.supplies.trail_ration ?? 0} packed.
          </p>
        )}
        {missingSupplies.length > 0 && <p class="tiny muted">Out of stock: {missingSupplies.map((id) => ITEMS[id].name).join(', ')}.</p>}
      </div>

      <div class="plan-section plan-grid">
        <div>
          <h3 class="plan-label">
            <Term k="porters">Porters</Term>
          </h3>
          <Stepper
            label="porters"
            value={plan.porters}
            min={route.minPorters ?? 0}
            max={Math.max(plan.porters, maxPorters)}
            onChange={(v) => store.act((st) => updatePlan(st, { routeId: route.id, porters: v }), { quiet: true })}
          />
          <p class="tiny muted">
            {handsAvail} hand{handsAvail === 1 ? '' : 's'} free · +8 carry each{route.minPorters ? ` · min ${route.minPorters} for kindling` : ''}
          </p>
        </div>
        <div>
          <h3 class="plan-label">
            <Term k="risk">Pace</Term>
          </h3>
          <Segmented<Risk>
            label="Pace"
            value={plan.risk}
            options={(['careful', 'standard', 'bold'] as Risk[]).map((r) => ({ value: r, label: RISKS[r].name, hint: RISKS[r].desc }))}
            onChange={(v) => store.act((st) => updatePlan(st, { routeId: route.id, risk: v }), { quiet: true })}
          />
          <p class="tiny muted">{RISKS[plan.risk].desc}</p>
        </div>
        <div>
          <h3 class="plan-label">
            <Term k="standingOrders">Standing orders</Term>
          </h3>
          <Segmented<number>
            label="Standing orders"
            value={plan.repeat}
            options={REPEAT_OPTS}
            onChange={(v) => store.act((st) => updatePlan(st, { routeId: route.id, repeat: v }), { quiet: true })}
          />
          <p class="tiny muted">{plan.repeat === 0 ? 'The party comes home and waits.' : 'Repeats with the same supplies while you have them.'}</p>
        </div>
      </div>

      {(check.warnings.length > 0 || (check.errors.length > 0 && open && !s.expedition)) && (
        <ul class="plan-warnings">
          {(open && !s.expedition ? check.errors : []).map((w) => (
            <li class="bad">
              <Icon name="alert" size={14} /> {w}
            </li>
          ))}
          {check.warnings.map((w) => (
            <li>
              <Icon name="info" size={14} /> {w}
            </li>
          ))}
        </ul>
      )}

      <div class="dispatch-row">
        <Button
          variant="primary"
          size="lg"
          icon="compass"
          blocked={blocked}
          onClick={() =>
            store.act((st, ctx) => {
              updatePlan(st, { routeId: route.id });
              return dispatch(st, ctx);
            })
          }
        >
          Dispatch to {route.name}
        </Button>
      </div>
    </div>
  );
}

function ForecastView({ route }: { route: RouteDef }) {
  const s = store.state;
  const plan = s.plan.routeId === route.id ? s.plan : { ...s.plan, routeId: route.id };
  const hpKey = s.party.members.map((m) => Math.round((s.heroes[m].hp / heroStats(s, m).vigor) * 20)).join(',');
  const key = JSON.stringify([
    plan,
    s.party,
    s.tactics,
    hpKey,
    Object.values(s.heroes).map((h) => [h.level, h.gear]),
    s.skills.scouting,
    s.skills.foraging,
    s.skills.mining,
    s.skills.salvaging,
    s.upgrades,
    s.doctrines,
    Math.floor(Date.now() / (30 * 60 * 1000)),
    s.flags,
  ]);
  const f = useMemo<Forecast | null>(() => forecastExpedition(s, plan, Date.now(), 32), [key]);
  if (!f) return <Empty title="No forecast" icon="compass">Choose at least one wayfarer to see a forecast.</Empty>;
  const intel = intelLevel(s);
  const band = f.band;
  const succ = f.success;
  const lo = Math.max(0, succ - band);
  const hi = Math.min(1, succ + band);
  const dur = expeditionDurationMult(s, s.party.members, plan.risk, f.drift);
  const lightInParty = s.party.members.some((m) => heroStats(s, m).light);
  const readinessLabel = { ready: 'Ready', risky: 'Risky', dangerous: 'Dangerous', reckless: 'Reckless' }[f.readiness];
  const counterState = (hz: string) => {
    const c = HAZARDS[hz].counter;
    if (!c) return { ok: false, text: 'No counter; Ward reduces it' };
    if (c === 'light') return lightInParty ? { ok: true, text: 'Countered by your Light' } : { ok: false, text: 'Light would negate it' };
    if (c === 'rope') return (plan.supplies.climbing_kit ?? 0) > 0 ? { ok: true, text: `${plan.supplies.climbing_kit} Climbing Kit packed` } : { ok: false, text: 'A Climbing Kit would negate it' };
    return (plan.supplies.antidote ?? 0) > 0 ? { ok: true, text: `${plan.supplies.antidote} Antidote packed` } : { ok: false, text: 'An Antidote would negate it' };
  };
  return (
    <div class="forecast">
      <div class={`readiness r-${f.readiness}`}>
        <div class="readiness-main">
          <span class="readiness-label">{readinessLabel}</span>
          <span class="readiness-pct">
            {band > 0 ? `${Math.round(lo * 100)}–${Math.round(hi * 100)}%` : pct(succ)}
            <span class="small"> chance to complete</span>
          </span>
        </div>
        <div class="outcomes" aria-label={`Complete ${pct(f.success)}, turn back ${pct(f.retreat)}, defeated ${pct(f.defeat)}`}>
          <span class="o-success" style={{ flex: f.success || 0.0001 }} />
          <span class="o-retreat" style={{ flex: f.retreat || 0.0001 }} />
          <span class="o-defeat" style={{ flex: f.defeat || 0.0001 }} />
        </div>
        <div class="tiny muted">
          Simulated {f.samples} journeys with your exact party, gear, supplies and tactics. Turn back {pct(f.retreat)} · defeated {pct(f.defeat)} ·{' '}
          <Term k="intel">intel {intel}</Term>
          {band > 0 ? ` (estimate ±${Math.round(band * 100)}%)` : ' (precise)'}
        </div>
      </div>

      <div class="fc-grid">
        <div class="fc-stat">
          <Icon name="clock" size={16} />
          <span>
            <b>{formatDuration(f.duration.full, { short: true })}</b>
            <span class="tiny muted"> full route</span>
          </span>
        </div>
        <div class="fc-stat">
          <Icon name="mark" size={16} />
          <span>
            <b>~{f.marks.avg}</b>
            <span class="tiny muted"> marks</span>
          </span>
        </div>
        <div class="fc-stat">
          <Icon name="heart" size={16} />
          <span>
            <b>{pct(f.hpEnd)}</b>
            <span class="tiny muted"> health on return</span>
          </span>
        </div>
        <div class="fc-stat">
          <Icon name="sword" size={16} />
          <span>
            <b>~{f.fights.toFixed(1)}</b>
            <span class="tiny muted"> fights</span>
          </span>
        </div>
      </div>

      {dur.parts.length > 0 && (
        <div class="fc-bonuses">
          {dur.parts.map((p) => (
            <Tag tone={p.mult < 1 ? 'moss' : 'ember'} icon="clock">
              {p.label} {p.mult < 1 ? `−${Math.round((1 - p.mult) * 100)}%` : `+${Math.round((p.mult - 1) * 100)}%`}
            </Tag>
          ))}
        </div>
      )}

      <h4 class="fc-h">
        <Icon name="skull" size={15} /> Likely threats
      </h4>
      <ul class="threats">
        {f.threats.map((t) => {
          const def = ENEMIES[t.enemy];
          return (
            <li class="threat">
              <EnemyBadge id={t.enemy} size={32} unknown={!t.known} />
              <div class="threat-main">
                <div>
                  <b>{t.known ? def.name : `Unknown ${def.boss ? 'great beast' : 'creature'}`}</b>{' '}
                  <span class="tiny muted">{t.finale ? 'Objective fight (certain)' : `${pct(t.chance)} chance to meet`}</span>
                </div>
                {t.known ? (
                  <>
                    <div class="threat-traits">
                      {def.traits.map((tr) => (
                        <Tag tone="ember">{TRAIT_LABEL[tr]}</Tag>
                      ))}
                      <span class="tiny muted">
                        {def.hp} HP · Might {def.might} · Guard {def.guard} · Speed {def.speed}
                      </span>
                    </div>
                    <div class="tiny counter">
                      <Icon name="shield" size={12} /> {def.counter}
                    </div>
                  </>
                ) : (
                  <div class="tiny muted">Not yet in your bestiary. Face it once to learn its strength and tricks. Rumour: {def.desc}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <h4 class="fc-h">
        <Icon name="alert" size={15} /> Hazards
      </h4>
      <ul class="hazards">
        {f.hazards.map((h) => {
          const hz = HAZARDS[h.id];
          const c = counterState(h.id);
          return (
            <li>
              <b>{hz.name}</b> <span class="tiny muted">{pct(h.chance)} per run · {Math.round(hz.damage * 100)}% health each</span>
              <div class={`tiny ${c.ok ? 'good' : 'muted'}`}>
                <Icon name={c.ok ? 'check' : 'info'} size={12} /> {c.text}
              </div>
            </li>
          );
        })}
      </ul>

      <h4 class="fc-h">
        <Icon name="pack" size={15} /> Expected haul
      </h4>
      {f.loot.length === 0 ? (
        <p class="small muted">Little to carry home. This route is about the objective.</p>
      ) : (
        <div class="haul">
          {f.loot.slice(0, 8).map((l) => (
            <ItemChip id={l.item} qty={Math.round(l.avg * 10) / 10} compact />
          ))}
        </div>
      )}
      {f.leftBehind > 0.5 && <p class="tiny warn-text">About {Math.round(f.leftBehind)} finds left behind per run for lack of space. Add a porter or a Porter's Frame.</p>}

      <h4 class="fc-h">
        <Icon name="sparkle" size={15} /> Discoveries
      </h4>
      <ul class="discs">
        {f.discoveries.map((d) => {
          const def = DISCOVERIES[d.id];
          const known = d.found || d.rare;
          return (
            <li class={d.found && d.once ? 'found' : ''}>
              <Icon name={d.found && d.once ? 'check' : d.rare ? 'gem' : 'sparkle'} size={14} />{' '}
              {d.found && d.once ? (
                <span>
                  <b>{def.name}</b> <span class="tiny muted">already found</span>
                </span>
              ) : (
                <span>
                  <b>{known ? def.name : d.finalLeg ? 'Something at the route’s end' : 'Something hidden along the way'}</b>{' '}
                  <span class="tiny muted">
                    {d.finalLeg ? 'found on completing the route' : `${pct(d.chance)} chance per run`}
                    {d.rare ? ' · rare, repeatable' : ''}
                  </span>
                </span>
              )}
            </li>
          );
        })}
        {f.discoveries.length === 0 && <li class="muted small">Nothing known to find here.</li>}
      </ul>
    </div>
  );
}

function RouteDetail() {
  const s = store.state;
  const id = store.ui.routeId;
  const route = id ? ROUTES[id] : null;
  if (!route) {
    return (
      <Panel title="Plan an expedition" icon="route">
        <Empty icon="map" title="Choose a route">
          Pick a waystone on the map or a route in the list to plan an expedition.
        </Empty>
      </Panel>
    );
  }
  const open = routeUnlocked(s, route.id);
  const regionOpen = regionUnlocked(s, route.region);
  return (
    <Panel
      title={route.name}
      icon={KIND_ICON[route.kind]}
      sub={`${REGIONS[route.region].name} · ${KIND_LABEL[route.kind]}`}
      class="route-detail"
      actions={<Pips n={route.danger} max={5} tone={route.danger >= 4 ? 'ember' : route.danger >= 3 ? 'warn' : 'moss'} label={`Danger ${route.danger} of 5`} />}
    >
      <p class="lede">{regionOpen ? route.blurb : 'The Drift hides this route. Unlock the region to chart it.'}</p>
      {!open && (
        <div class="locked-note">
          <Icon name="lock" size={16} />
          <div>
            <b>Locked.</b> Requires: {routeLockReasons(s, route.id).join(' · ')}
          </div>
        </div>
      )}
      {route.firstClear && !(s.stats.routeClears[route.id] ?? 0) && regionOpen && (
        <div class="objective-note">
          <Icon name="waystone" size={16} /> <b>Objective:</b>{' '}
          {route.kind === 'relight'
            ? `Relight the waystone to reconnect ${REGIONS[route.region].settlement.name}.`
            : route.finale
              ? `Defeat ${route.finale.enemies.map((e) => ENEMIES[e].name).filter((v, i, a) => a.indexOf(v) === i).join(' and ')}.`
              : 'Chart the route.'}
        </div>
      )}
      {open ? (
        <div class="plan-layout">
          <Planner route={route} />
          <ForecastView route={route} />
        </div>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Live journey

function Journey() {
  const s = store.state;
  const e = s.expedition!;
  const route = ROUTES[e.routeId];
  const st = expeditionStatus(s, e);
  return (
    <Panel
      title={`On the road: ${route.name}`}
      icon="compass"
      tone="accent"
      sub={`Run ${e.run} · ${RISKS[e.risk].name} pace · ${DRIFTS[e.drift].name}`}
      actions={
        <div class="row gap-sm">
          {e.repeatLeft !== 0 && (
            <Button size="sm" variant="ghost" icon="stop" onClick={() => store.act((x) => setStandingOrders(x, 0))}>
              Last run
            </Button>
          )}
          {e.phase !== 'return' && (
            <Button
              size="sm"
              variant="danger"
              icon={e.phase === 'rest' ? 'stop' : 'back'}
              onClick={() =>
                store.openModal({
                  kind: 'confirm',
                  title: e.phase === 'rest' ? 'Cancel standing orders?' : 'Recall the party?',
                  body:
                    e.phase === 'rest'
                      ? 'The party will stand down and stay in camp. Nothing is lost.'
                      : 'The party turns back now and keeps what it carries, but the route will not be completed and you get only half the marks.',
                  confirm: e.phase === 'rest' ? 'Stand down' : 'Send recall signal',
                  danger: true,
                  onConfirm: () => store.act((x, ctx) => recall(x, ctx)),
                })
              }
            >
              {e.phase === 'rest' ? 'Stand down' : 'Recall'}
            </Button>
          )}
        </div>
      }
    >
      <div class="journey">
        <div class="journey-status">
          <div class="journey-phase">
            <b>{st.label}</b> <span class="muted small">· {formatDuration(st.eta)} {e.phase === 'rest' ? 'until departure' : 'until home'}</span>
          </div>
          {e.phase === 'travel' ? (
            <ol class="legs">
              {e.legs.map((len, i) => {
                const start = i > 0 ? legEnd(e, i - 1) : 0;
                const f = Math.max(0, Math.min(1, (e.elapsed - start) / len));
                const entries = e.log.filter((l) => l.leg === i + 1);
                const fight = entries.some((l) => l.kind === 'fight');
                const hz = entries.some((l) => l.kind === 'hazard');
                const disc = entries.some((l) => l.kind === 'discovery');
                return (
                  <li class={`legcell ${i < e.leg ? 'done' : i === e.leg ? 'now' : ''}`} title={e.legNames[i]}>
                    <span class="legcell-bar">
                      <span style={{ width: `${f * 100}%` }} />
                    </span>
                    <span class="legcell-name">{e.legNames[i]}</span>
                    <span class="legcell-icons">
                      {fight && <Icon name="sword" size={12} />}
                      {hz && <Icon name="alert" size={12} />}
                      {disc && <Icon name="sparkle" size={12} />}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Bar value={st.frac} tone={e.phase === 'rest' ? 'moss' : 'ember'} label={st.label} />
          )}
        </div>
        <div class="journey-grid">
          <div>
            <h4 class="fc-h">
              <Icon name="heart" size={15} /> Party
            </h4>
            {e.members.map((m) => {
              const max = e.stats[m].vigor;
              const hp = e.phase === 'rest' ? s.heroes[m].hp : e.hp[m];
              return (
                <div class="plan-hero">
                  <HeroBadge id={m} size={30} />
                  <div class="plan-hero-main">
                    <div class="plan-hero-top">
                      <b>{HEROES[m].name.split(' ')[0]}</b>
                      <span class="small muted">
                        {Math.round(hp)}/{max}
                      </span>
                    </div>
                    <HpBar hp={hp} max={max} size="xs" />
                  </div>
                </div>
              );
            })}
            <h4 class="fc-h">
              <Icon name="pack" size={15} /> Packs
            </h4>
            <div class="haul">
              {Object.entries(e.supplies)
                .filter(([, n]) => n > 0)
                .map(([id, n]) => (
                  <ItemChip id={id} qty={n} compact />
                ))}
              {Object.entries(e.pack).map(([id, n]) => (
                <ItemChip id={id} qty={n} compact />
              ))}
              {Object.keys(e.pack).length === 0 && <span class="small muted">No loot yet.</span>}
            </div>
            <div class="tiny muted">
              {Object.values(e.supplies).reduce((a, b) => a + b, 0) + Object.values(e.pack).reduce((a, b) => a + b, 0)} / {e.carry} carry · {e.marks} marks from foes so far
            </div>
          </div>
          <div>
            <h4 class="fc-h">
              <Icon name="journal" size={15} /> Journey so far
            </h4>
            <div class="jlog-scroll">
              <JourneyLog log={e.phase === 'rest' ? [{ leg: 0, kind: 'return', text: 'Back at Lanternhold, resting before the next run. The previous run’s report is in Recent reports.' }] : e.log} live />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Reports() {
  const s = store.state;
  if (s.reports.length === 0) return null;
  const unread = s.reports.filter((r) => r.unread).length;
  return (
    <Panel
      title="Recent reports"
      icon="journal"
      actions={
        unread > 1 ? (
          <Button size="sm" variant="ghost" icon="check" onClick={() => store.act((x) => x.reports.forEach((r) => markReportRead(x, r.id)), { quiet: true })}>
            Mark all read
          </Button>
        ) : undefined
      }
    >
      <ul class="report-list">
        {s.reports.slice(0, 8).map((r) => {
          const loot = Object.values(r.loot).reduce((a, b) => a + b, 0);
          return (
            <li>
              <button type="button" class={`report-row ${r.unread ? 'unread' : ''}`} onClick={() => store.openModal({ kind: 'report', id: r.id })}>
                <Tag tone={r.outcome === 'success' ? 'moss' : r.outcome === 'retreat' ? 'warn' : 'ember'}>
                  {r.outcome === 'success' ? 'Completed' : r.outcome === 'retreat' ? (r.recalled ? 'Recalled' : 'Turned back') : 'Defeated'}
                </Tag>
                <span class="report-name">
                  {ROUTES[r.routeId].name}
                  {r.run > 1 ? ` (run ${r.run})` : ''}
                </span>
                <span class="small muted">
                  +{r.marks} marks · {loot} items{r.discoveries.length ? ` · ${r.discoveries.length} discover${r.discoveries.length > 1 ? 'ies' : 'y'}` : ''}
                </span>
                {r.unread && <span class="dot" aria-label="unread" />}
                <Icon name="chevron" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function Expeditions() {
  const s = store.state;
  return (
    <div class="screen">
      <header class="screen-head">
        <h1>Expeditions</h1>
        <p>Chart routes, relight waystones and bring home what the wild gives up.</p>
      </header>
      {s.expedition && <Journey />}
      <div class="exp-top">
        <Panel title="The Marches" icon="map" class="map-panel">
          <MapView />
        </Panel>
        <RegionPanel />
      </div>
      <RouteDetail />
      <Reports />
    </div>
  );
}
