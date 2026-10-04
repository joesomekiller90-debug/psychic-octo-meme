import { ACTION_LIST, RECIPE_LIST } from '../../game/data/actions';
import { CONTRACT_LIST, LORE, RANKS, SETTLEMENT_GIVERS, UPGRADE_LIST } from '../../game/data/camp';
import { ENEMY_LIST, ENEMIES } from '../../game/data/enemies';
import { HEROES } from '../../game/data/heroes';
import { CATEGORY_LABEL, ITEM_LIST, ITEMS } from '../../game/data/items';
import { SKILLS } from '../../game/data/skills';
import { DISCOVERY_LIST, REGION_LIST, ROUTE_LIST, ROUTES } from '../../game/data/world';
import { claimContract } from '../../game/sim/actions';
import { contractProgress } from '../../game/sim/contracts';
import { formatNumber } from '../../game/sim/format';
import { rankOf, regionUnlocked, upgradeLevel } from '../../game/sim/rules';
import type { ContractDef } from '../../game/types';
import { Icon } from '../icons';
import { store } from '../store';
import { Bar, Button, Empty, EnemyBadge, ItemChip, ItemIcon, Panel, Tag, TRAIT_LABEL } from '../components/common';

const TABS = [
  { id: 'contracts', label: 'Contracts', icon: 'scroll' },
  { id: 'bestiary', label: 'Bestiary', icon: 'paw' },
  { id: 'materials', label: 'Materials', icon: 'gem' },
  { id: 'recipes', label: 'Recipes', icon: 'recipe' },
  { id: 'atlas', label: 'Atlas', icon: 'map' },
  { id: 'lore', label: 'Lore', icon: 'journal' },
  { id: 'milestones', label: 'Milestones', icon: 'standing' },
];

export function goalText(c: ContractDef): string {
  const g = c.goal;
  switch (g.type) {
    case 'deliver':
      return `Hand in ${g.qty} ${ITEMS[g.item].name}`;
    case 'route':
      return `Complete ${ROUTES[g.route].name}${g.count > 1 ? ` ${g.count} times` : ''}`;
    case 'defeat':
      return `Defeat ${g.count > 1 ? `${g.count} ` : ''}${ENEMIES[g.enemy].name}${g.count > 1 ? 's' : ''}`;
    case 'craft':
      return `Craft ${g.count} ${ITEMS[g.item].name}`;
    case 'skill':
      return `Reach ${SKILLS[g.skill].name} level ${g.level}`;
    case 'upgrade':
      return `Build ${UPGRADE_LIST.find((u) => u.id === g.upgrade)?.name} level ${g.level}`;
  }
}

function Reward({ c }: { c: ContractDef }) {
  const r = c.reward;
  return (
    <div class="reward">
      {r.marks ? (
        <Tag tone="amber" icon="mark">
          {r.marks} marks
        </Tag>
      ) : null}
      {r.standing ? (
        <Tag tone="gold" icon="standing">
          {r.standing} standing
        </Tag>
      ) : null}
      {r.recruit && (
        <Tag tone="violet" icon="users">
          {HEROES[r.recruit].name} joins
        </Tag>
      )}
      {r.recipes?.map((id) => (
        <Tag tone="tide" icon="recipe">
          Recipe: {ACTION_LIST.find((a) => a.id === id)?.name}
        </Tag>
      ))}
      {r.items?.map((q) => (
        <ItemChip id={q.item} qty={q.qty} compact />
      ))}
    </div>
  );
}

function Contracts() {
  const s = store.state;
  const avail = CONTRACT_LIST.filter((c) => s.contracts[c.id]);
  const active = avail.filter((c) => s.contracts[c.id].status === 'active');
  const done = avail.filter((c) => s.contracts[c.id].status === 'done');
  const unseen = CONTRACT_LIST.length - avail.length;
  const sorted = [...active].sort((a, b) => Number(contractProgress(s, b).ready) - Number(contractProgress(s, a).ready));
  return (
    <div class="contracts">
      {sorted.length === 0 && <Empty icon="scroll" title="No open contracts">Reconnect settlements and grow the camp to hear new requests.</Empty>}
      {sorted.map((c) => {
        const p = contractProgress(s, c);
        const giver = SETTLEMENT_GIVERS[c.giver];
        return (
          <article class={`contract ${p.ready ? 'ready' : ''}`}>
            <header class="row between">
              <div>
                <b class="contract-title">{c.title}</b>
                <div class="tiny muted">
                  {giver.name}, {giver.role}
                </div>
              </div>
              {p.ready ? <Tag tone="moss" icon="check">Ready</Tag> : <Tag tone="muted">{c.settlement}</Tag>}
            </header>
            <p class="small contract-text">{c.text}</p>
            <div class="contract-goal">
              <span class="small">
                <Icon name="flag" size={14} /> {goalText(c)}
              </span>
              <span class="small muted">
                {p.have}/{p.need}
              </span>
            </div>
            <Bar value={p.have / p.need} tone={p.ready ? 'moss' : 'amber'} size="xs" label="Contract progress" />
            <div class="row between wrap gap-sm">
              <Reward c={c} />
              <Button
                variant="primary"
                size="sm"
                icon="check"
                blocked={p.ready ? null : `Not finished yet: ${goalText(c)} (${p.have}/${p.need}).`}
                onClick={() => store.act((x, ctx) => claimContract(x, ctx, c.id))}
              >
                {c.goal.type === 'deliver' ? `Hand over & claim` : 'Claim'}
              </Button>
            </div>
          </article>
        );
      })}
      {unseen > 0 && (
        <p class="small muted">
          <Icon name="lock" size={14} /> {unseen} more contract{unseen > 1 ? 's' : ''} will appear as you reconnect settlements and reach new regions.
        </p>
      )}
      {done.length > 0 && (
        <details class="done-list">
          <summary>Completed contracts ({done.length})</summary>
          <ul>
            {done.map((c) => (
              <li>
                <Icon name="check" size={14} /> <b>{c.title}</b> <span class="tiny muted">· {c.settlement}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Bestiary() {
  const s = store.state;
  return (
    <div class="codex-grid">
      {ENEMY_LIST.map((e) => {
        const c = s.codex.enemies[e.id];
        const seen = (c?.seen ?? 0) > 0;
        const region = REGION_LIST.find((r) => r.id === e.region)!;
        if (!seen)
          return (
            <article class="codex-card unknown">
              <EnemyBadge id={e.id} size={44} unknown />
              <div>
                <b>Unknown {e.boss ? 'great beast' : 'creature'}</b>
                <div class="tiny muted">Somewhere in {regionUnlocked(s, e.region) ? region.name : 'an uncharted region'}</div>
              </div>
            </article>
          );
        return (
          <article class={`codex-card ${e.boss ? 'boss' : ''}`}>
            <header class="row gap-sm">
              <EnemyBadge id={e.id} size={44} />
              <div class="grow">
                <b>{e.name}</b>
                {e.boss && <Tag tone="ember">Boss</Tag>}
                <div class="tiny muted">
                  {region.name} · met {c.seen}× · defeated {c.defeated}
                </div>
              </div>
            </header>
            <p class="small">{e.desc}</p>
            <div class="tiny stat-line">
              {e.hp} HP · Might {e.might} · Guard {e.guard} · Speed {e.speed} · {e.xp} xp
            </div>
            <div class="threat-traits">
              {e.traits.map((t) => (
                <Tag tone="ember">{TRAIT_LABEL[t]}</Tag>
              ))}
            </div>
            <ul class="behaviors">
              {e.behavior.map((b) => (
                <li class="small">{b}</li>
              ))}
            </ul>
            <p class="tiny counter">
              <Icon name="shield" size={12} /> {e.counter}
            </p>
            <div class="tiny muted">
              Drops:{' '}
              {e.loot.map((l, i) => (
                <span>
                  {i > 0 ? ', ' : ''}
                  {ITEMS[l.item].name} ({Math.round(l.chance * 100)}%)
                </span>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function sourcesFor(id: string): string[] {
  const out: string[] = [];
  for (const a of ACTION_LIST) if (a.outputs.some((o) => o.item === id)) out.push(`${a.kind === 'craft' ? 'Crafted' : 'Gathered'}: ${a.name} (${SKILLS[a.skill].name})`);
  for (const r of ROUTE_LIST) if (r.finds.some((f) => f.item === id)) out.push(`Found on ${r.name}`);
  for (const e of ENEMY_LIST) if (e.loot.some((l) => l.item === id)) out.push(`Dropped by ${e.name}`);
  return out;
}

function usesFor(id: string): string[] {
  const out: string[] = [];
  for (const a of ACTION_LIST) if (a.inputs?.some((q) => q.item === id)) out.push(a.name);
  for (const u of UPGRADE_LIST) if (u.levels.some((l) => l.items.some((q) => q.item === id))) out.push(`${u.name} (camp)`);
  for (const c of CONTRACT_LIST) if (c.goal.type === 'deliver' && c.goal.item === id) out.push(`Contract: ${c.title}`);
  return out;
}

function Materials() {
  const s = store.state;
  return (
    <div class="codex-grid">
      {ITEM_LIST.map((i) => {
        const known = !!s.codex.items[i.id];
        if (!known)
          return (
            <article class="codex-card unknown small-card">
              <span class="item-icon unknown-icon" style="--s:32px">
                <Icon name="info" size={18} />
              </span>
              <div>
                <b>Undiscovered</b>
                <div class="tiny muted">{CATEGORY_LABEL[i.category]} · Tier {i.tier}</div>
              </div>
            </article>
          );
        const src = sourcesFor(i.id);
        const uses = usesFor(i.id);
        return (
          <article class="codex-card small-card">
            <header class="row gap-sm">
              <ItemIcon id={i.id} size={36} />
              <div class="grow">
                <b>{i.name}</b>
                <div class="tiny muted">
                  {CATEGORY_LABEL[i.category]} · Tier {i.tier} · {i.value} marks · in stores: {s.inventory[i.id] ?? 0}
                </div>
              </div>
            </header>
            <p class="small">{i.desc}</p>
            {src.length > 0 && <div class="tiny muted">Source: {src.slice(0, 3).join(' · ')}</div>}
            {uses.length > 0 && <div class="tiny muted">Used in: {uses.slice(0, 4).join(' · ')}</div>}
          </article>
        );
      })}
    </div>
  );
}

function Recipes() {
  const s = store.state;
  return (
    <div class="codex-grid">
      {RECIPE_LIST.map((a) => {
        const known = s.recipes.includes(a.id);
        return (
          <article class={`codex-card small-card ${known ? '' : 'unknown'}`}>
            <header class="row gap-sm">
              {known ? (
                <ItemIcon id={a.outputs[0].item} size={34} />
              ) : (
                <span class="item-icon unknown-icon" style="--s:34px">
                  <Icon name="lock" size={18} />
                </span>
              )}
              <div class="grow">
                <b>{known ? a.name : 'Unlearned recipe'}</b>
                <div class="tiny muted">
                  {SKILLS[a.skill].name} level {a.level}
                </div>
              </div>
            </header>
            {known ? (
              <div class="tiny muted">Needs: {(a.inputs ?? []).map((q) => `${q.qty} ${ITEMS[q.item].name}`).join(', ')}</div>
            ) : (
              <div class="tiny">{a.learnHint}</div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Atlas() {
  const s = store.state;
  return (
    <div class="atlas">
      {REGION_LIST.map((r) => {
        const open = regionUnlocked(s, r.id);
        return (
          <Panel title={open ? r.name : 'Uncharted region'} icon={open ? 'map' : 'lock'} tone="quiet">
            {open ? (
              <>
                <p class="small">{r.blurb}</p>
                <p class="small">
                  <Icon name="waystone" size={14} /> <b>{r.settlement.name}</b>: {s.flags[r.settlement.flag] ? 'reconnected' : 'still cut off'}. <span class="muted">{r.settlement.blurb}</span>
                </p>
                <ul class="atlas-routes">
                  {ROUTE_LIST.filter((x) => x.region === r.id).map((x) => (
                    <li>
                      <b>{x.name}</b>{' '}
                      <span class="tiny muted">
                        runs {s.stats.routeRuns[x.id] ?? 0} · completed {s.stats.routeClears[x.id] ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
                <h4 class="fc-h">Sites and discoveries</h4>
                <ul class="atlas-disc">
                  {DISCOVERY_LIST.filter((d) => ROUTES[d.route].region === r.id).map((d) => {
                    const n = s.codex.discoveries[d.id] ?? 0;
                    return n > 0 ? (
                      <li>
                        <Icon name="sparkle" size={14} /> <b>{d.name}</b> {d.rare && <span class="tiny muted">(found {n}×)</span>}
                        <div class="small muted">{d.text}</div>
                      </li>
                    ) : (
                      <li class="muted small">
                        <Icon name="info" size={14} /> Undiscovered site on {ROUTES[d.route].name}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p class="small muted">The Drift hides this land. Push further along the roads you know to reach it.</p>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

function Lore() {
  const s = store.state;
  const total = Object.keys(LORE).length;
  return (
    <div class="lore">
      {s.codex.lore.map((id) => (
        <article class="lore-entry">
          <h3>{LORE[id].title}</h3>
          <p>{LORE[id].text}</p>
        </article>
      ))}
      {s.codex.lore.length < total && (
        <p class="small muted">
          <Icon name="lock" size={14} /> {total - s.codex.lore.length} more accounts are waiting to be found on the roads.
        </p>
      )}
    </div>
  );
}

function Milestones() {
  const s = store.state;
  const rank = rankOf(s.standing);
  const kills = Object.values(s.stats.kills).reduce((a, b) => a + b, 0);
  const upgrades = Object.values(s.upgrades).reduce((a, b) => a + b, 0);
  const maxUp = UPGRADE_LIST.reduce((a, u) => a + u.levels.length, 0);
  const settlements = REGION_LIST.filter((r) => s.flags[r.settlement.flag]).length;
  const items = [
    { icon: 'waystone', label: 'Settlements reconnected', v: `${settlements}/3` },
    { icon: 'compass', label: 'Expeditions completed', v: formatNumber(s.stats.expeditions) },
    { icon: 'skull', label: 'Foes defeated', v: formatNumber(kills) },
    { icon: 'anvil', label: 'Items crafted', v: formatNumber(s.stats.totalCrafted) },
    { icon: 'camp', label: 'Camp upgrades', v: `${upgrades}/${maxUp}` },
    { icon: 'mark', label: 'Marks earned', v: formatNumber(s.stats.marksEarned) },
    { icon: 'sparkle', label: 'Discoveries', v: `${Object.keys(s.codex.discoveries).length}/${DISCOVERY_LIST.length}` },
    { icon: 'paw', label: 'Bestiary', v: `${Object.values(s.codex.enemies).filter((e) => e.seen > 0).length}/${ENEMY_LIST.length}` },
  ];
  return (
    <div>
      <div class="milestones">
        {items.map((m) => (
          <div class="milestone">
            <Icon name={m.icon} size={20} />
            <b>{m.v}</b>
            <span class="tiny muted">{m.label}</span>
          </div>
        ))}
      </div>
      <Panel title="Charter ranks" icon="standing" tone="quiet">
        <ol class="ranks">
          {RANKS.map((r) => (
            <li class={r.rank <= rank ? 'on' : ''}>
              <Icon name={r.rank <= rank ? 'check' : 'lock'} size={14} /> <b>{r.name}</b> <span class="tiny muted">({r.standing} standing)</span> <span class="small">{r.perk}</span>
            </li>
          ))}
        </ol>
        <p class="small muted">
          Camp: {UPGRADE_LIST.map((u) => `${u.name} ${upgradeLevel(s, u.id)}/${u.levels.length}`).join(' · ')}
        </p>
      </Panel>
    </div>
  );
}

export function Journal() {
  const tab = store.ui.journalTab;
  return (
    <div class="screen">
      <header class="screen-head">
        <h1>Journal</h1>
        <p>Contracts, the bestiary and everything the Compact has learned about the Marches.</p>
      </header>
      <div class="tabs" role="tablist" aria-label="Journal sections">
        {TABS.map((t) => (
          <button type="button" role="tab" aria-selected={tab === t.id} class={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => store.setUi({ journalTab: t.id })}>
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'contracts' && <Contracts />}
      {tab === 'bestiary' && <Bestiary />}
      {tab === 'materials' && <Materials />}
      {tab === 'recipes' && <Recipes />}
      {tab === 'atlas' && <Atlas />}
      {tab === 'lore' && <Lore />}
      {tab === 'milestones' && <Milestones />}
    </div>
  );
}
