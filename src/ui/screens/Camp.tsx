import { useState } from 'preact/hooks';
import { DOCTRINES, RANKS, REPLEDGE_COST, UPGRADE_LIST } from '../../game/data/camp';
import { CATEGORY_LABEL, ITEMS, ITEM_LIST } from '../../game/data/items';
import { buy, pledgeDoctrine, sell, SHOP, startBuild } from '../../game/sim/actions';
import { hasItems, missingItems } from '../../game/sim/core';
import { formatDuration } from '../../game/sim/format';
import { buildCycleMs, describeReq, freeHands, handsInUse, offlineCapMs, rankOf, stackCap, totalHands, unmetReqs, upgradeLevel } from '../../game/sim/rules';
import { ROMAN } from '../../game/sim/workorders';
import type { UpgradeDef } from '../../game/types';
import { Icon } from '../icons';
import { store } from '../store';
import { Bar, Button, CostList, Empty, ItemIcon, Panel, Pips, Segmented, Tag, Term } from '../components/common';

function UpgradeCard({ u }: { u: UpgradeDef }) {
  const s = store.state;
  const [hands, setHands] = useState(1);
  const lvl = upgradeLevel(s, u.id);
  const next = u.levels[lvl];
  const building = s.orders.find((o) => o?.kind === 'build' && o.upgradeId === u.id);
  const unmet = next ? unmetReqs(s, next.requires) : [];
  let blocked: string | null = null;
  if (next) {
    if (building) blocked = 'Already under construction.';
    else if (unmet.length) blocked = `Requires ${unmet.map(describeReq).join('; ')}.`;
    else if (s.marks < next.marks) blocked = `Needs ${next.marks} marks (you have ${s.marks}).`;
    else if (!hasItems(s, next.items))
      blocked = `Missing ${missingItems(s, next.items)
        .map((m) => `${m.qty} ${ITEMS[m.item].name}`)
        .join(', ')}.`;
    else if (!s.orders.some((o) => !o)) blocked = 'Both work-order slots are busy. Construction needs a free slot.';
    else if (freeHands(s) < hands) blocked = `Needs ${hands} free hand${hands > 1 ? 's' : ''}; ${freeHands(s)} free.`;
  }
  return (
    <article class={`upgrade-card ${building ? 'building' : ''}`}>
      <header class="ac-head">
        <span class="ac-icon">
          <Icon name={u.icon} size={20} />
        </span>
        <div class="ac-title">
          <b>{u.name}</b>
          <Pips n={lvl} max={u.levels.length} label={`Level ${lvl} of ${u.levels.length}`} />
        </div>
        {building && (
          <Tag tone="tide" icon="hammer">
            Building
          </Tag>
        )}
      </header>
      <p class="small muted">{u.desc}</p>
      <div class="upg-effects">
        <div>
          <span class="tiny muted">Now</span>
          <div class="small">{lvl > 0 ? u.levels[lvl - 1].effect : 'Not built'}</div>
        </div>
        {next && (
          <div>
            <span class="tiny muted">Level {ROMAN[lvl + 1]}</span>
            <div class="small good">{next.effect}</div>
          </div>
        )}
      </div>
      {next ? (
        <>
          <CostList items={next.items} marks={next.marks} />
          <div class="tiny muted">
            Build time {formatDuration(buildCycleMs(s, next.seconds, hands))}
            {unmet.length > 0 && (
              <span class="bad">
                {' '}
                · Requires {unmet.map(describeReq).join(', ')}
              </span>
            )}
          </div>
          <div class="ac-controls">
            <Segmented<number>
              label="Crew"
              value={hands}
              options={[
                { value: 1, label: '1 hand' },
                { value: 2, label: '2 hands (+60%)' },
              ]}
              onChange={setHands}
            />
            <Button variant="primary" icon="hammer" blocked={blocked} onClick={() => store.act((x, ctx) => startBuild(x, ctx, u.id, hands))}>
              Build
            </Button>
          </div>
        </>
      ) : (
        <p class="small good">
          <Icon name="check" size={14} /> Fully upgraded
        </p>
      )}
    </article>
  );
}

function HandsPanel() {
  const s = store.state;
  const use = handsInUse(s);
  const total = totalHands(s);
  return (
    <Panel title="Camp hands" icon="hand">
      <div class="hands-vis" aria-label={`${use.orders} on work orders, ${use.porters} portering, ${total - use.total} free`}>
        {Array.from({ length: total }, (_, i) => (
          <span class={`hand-dot ${i < use.orders ? 'work' : i < use.orders + use.porters ? 'porter' : 'free'}`}>
            <Icon name="hand" size={16} />
          </span>
        ))}
      </div>
      <p class="small">
        <b>{use.orders}</b> on work orders · <b>{use.porters}</b> portering · <b>{total - use.total}</b> free
      </p>
      <p class="tiny muted">Hands are shared between camp work and expedition porters. The Bunkhouse adds more.</p>
      <div class="kv-list">
        <div class="kv">
          <span class="kv-k">
            <Term k="offline">Offline limit</Term>
          </span>
          <span class="kv-v">{offlineCapMs(s) / 3600_000} hours</span>
        </div>
        <div class="kv">
          <span class="kv-k">Stack size</span>
          <span class="kv-v">{stackCap(s)} per item</span>
        </div>
      </div>
    </Panel>
  );
}

function CharterPanel() {
  const s = store.state;
  const rank = rankOf(s.standing);
  const next = RANKS[rank + 1];
  const cur = RANKS[rank];
  return (
    <Panel title="Compact charter" icon="standing" sub={cur.name}>
      <div class="row between">
        <span class="small">
          <Term k="standing">Standing</Term> <b>{s.standing}</b>
        </span>
        {next && <span class="small muted">Next: {next.name} at {next.standing}</span>}
      </div>
      {next && <Bar value={(s.standing - cur.standing) / (next.standing - cur.standing)} tone="gold" size="sm" label="Standing toward next rank" />}
      <ol class="ranks">
        {RANKS.map((r) => (
          <li class={r.rank <= rank ? 'on' : ''}>
            <Icon name={r.rank <= rank ? 'check' : 'lock'} size={14} />
            <b>{r.name}</b> <span class="tiny muted">({r.standing})</span> <span class="small">{r.perk}</span>
          </li>
        ))}
      </ol>
      <h3 class="sub-h">Doctrines</h3>
      <p class="tiny muted">Permanent specialisations. You can re-pledge later for {REPLEDGE_COST} marks.</p>
      {[1, 2].map((tier) => {
        const needed = RANKS.find((r) => r.doctrineTier === tier)!;
        const unlocked = rank >= needed.rank;
        const chosen = s.doctrines.find((d) => DOCTRINES.find((x) => x.id === d)?.tier === tier);
        return (
          <div class="doctrine-tier">
            <div class="tiny muted">
              Tier {tier} · {unlocked ? 'available' : `unlocks at ${needed.name}`}
            </div>
            <div class="doctrines">
              {DOCTRINES.filter((d) => d.tier === tier).map((d) => (
                <div class={`doctrine ${chosen === d.id ? 'on' : ''}`}>
                  <b>{d.name}</b>
                  <p class="small">{d.desc}</p>
                  {chosen === d.id ? (
                    <Tag tone="gold" icon="check">
                      Pledged
                    </Tag>
                  ) : (
                    <Button
                      size="sm"
                      blocked={!unlocked ? `Reach ${needed.name} (${needed.standing} standing).` : chosen && s.marks < REPLEDGE_COST ? `Re-pledging costs ${REPLEDGE_COST} marks.` : null}
                      onClick={() =>
                        chosen
                          ? store.openModal({
                              kind: 'confirm',
                              title: `Re-pledge to ${d.name}?`,
                              body: `This replaces your current tier ${tier} doctrine and costs ${REPLEDGE_COST} marks.`,
                              confirm: 'Re-pledge',
                              onConfirm: () => store.act((x) => pledgeDoctrine(x, d.id)),
                            })
                          : store.act((x) => pledgeDoctrine(x, d.id))
                      }
                    >
                      {chosen ? `Re-pledge (${REPLEDGE_COST})` : 'Pledge'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

function QuartermasterPanel() {
  const s = store.state;
  return (
    <Panel title="Quartermaster" icon="mark" sub="Odile Pell">
      <p class="small muted">Odile sells basic stores and buys anything at full value.</p>
      <ul class="shop">
        {SHOP.map((o, i) => (
          <li>
            <ItemIcon id={o.item} size={30} />
            <span class="grow">
              <b>
                {o.qty} {ITEMS[o.item].name}
              </b>
              <span class="tiny muted"> · you have {s.inventory[o.item] ?? 0}</span>
            </span>
            <Button size="sm" icon="mark" blocked={s.marks < o.price ? `Needs ${o.price} marks (you have ${s.marks}).` : null} onClick={() => store.act((x, ctx) => buy(x, ctx, i))}>
              {o.price}
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function StoresPanel() {
  const s = store.state;
  const cap = stackCap(s);
  const [filter, setFilter] = useState('all');
  const cats = ['all', 'herb', 'ore', 'scrap', 'part', 'trophy', 'component', 'supply', 'weapon', 'armor', 'trinket'];
  const items = ITEM_LIST.filter((i) => (s.inventory[i.id] ?? 0) > 0).filter((i) => {
    if (filter === 'all') return true;
    if (filter === 'herb') return ['herb', 'food', 'fiber', 'wood'].includes(i.category);
    if (filter === 'scrap') return ['scrap', 'notes'].includes(i.category);
    return i.category === filter;
  });
  return (
    <Panel title="Stores" icon="crate" sub={`Stacks hold ${cap}`}>
      <div class="tabs small-tabs" role="tablist" aria-label="Store categories">
        {cats.map((c) => (
          <button type="button" role="tab" aria-selected={filter === c} class={`tab ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
            {c === 'all' ? 'All' : c === 'herb' ? 'Forage' : c === 'scrap' ? 'Salvage & notes' : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty icon="crate" title="Nothing here">
          Gather, craft and explore to fill your stores.
        </Empty>
      ) : (
        <ul class="stores">
          {items.map((i) => {
            const n = s.inventory[i.id] ?? 0;
            return (
              <li class="store-row">
                <ItemIcon id={i.id} size={32} />
                <div class="grow">
                  <div class="row between">
                    <b>{i.name}</b>
                    <span class={`small ${n >= cap ? 'warn-text' : 'muted'}`}>
                      {n}/{cap}
                    </span>
                  </div>
                  <div class="tiny muted">{i.desc}</div>
                </div>
                <div class="store-actions">
                  <Button size="sm" variant="ghost" onClick={() => store.act((x, ctx) => sell(x, ctx, i.id, 1))} label={`Sell one ${i.name} for ${i.value} marks`}>
                    Sell 1 · {i.value}
                  </Button>
                  {n > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        store.openModal({
                          kind: 'confirm',
                          title: `Sell all ${i.name}?`,
                          body: `Sell ${n} ${i.name} for ${n * i.value} marks. This cannot be undone.`,
                          confirm: 'Sell all',
                          danger: true,
                          onConfirm: () => store.act((x, ctx) => sell(x, ctx, i.id, n)),
                        })
                      }
                    >
                      Sell all
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function Camp() {
  return (
    <div class="screen">
      <header class="screen-head">
        <h1>Camp</h1>
        <p>Lanternhold grows one beam at a time. Construction runs as a work order and needs a free slot and hands.</p>
      </header>
      <div class="camp-top">
        <HandsPanel />
        <QuartermasterPanel />
      </div>
      <Panel title="Upgrades" icon="hammer">
        <div class="upgrade-grid">
          {UPGRADE_LIST.map((u) => (
            <UpgradeCard u={u} />
          ))}
        </div>
      </Panel>
      <div class="two-col">
        <div class="col">
          <CharterPanel />
        </div>
        <div class="col">
          <StoresPanel />
        </div>
      </div>
    </div>
  );
}
