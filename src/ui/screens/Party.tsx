import { HERO_LIST, HEROES, MAX_PARTY } from '../../game/data/heroes';
import { ITEMS } from '../../game/data/items';
import { equip, setRow, setTactics, toggleMember } from '../../game/sim/actions';
import { formatDuration, pct } from '../../game/sim/format';
import { healRatePerMs, heroOnExpedition, heroStats, heroTravelling, heroXpToNext } from '../../game/sim/rules';
import type { Tactics } from '../../game/sim/state';
import type { EquipSlot, Row } from '../../game/types';
import { Icon } from '../icons';
import { store } from '../store';
import { Bar, Button, EquipStats, HeroBadge, HpBar, ItemIcon, Modal, Panel, Segmented, Tag, Term } from '../components/common';

const SLOT_LABEL: Record<EquipSlot, string> = { weapon: 'Weapon', armor: 'Armor', trinket: 'Trinket' };

function Lineup() {
  const s = store.state;
  const locked = !!s.expedition;
  const members = s.party.members;
  return (
    <Panel title="Expedition party" icon="users" sub={`${members.length}/${MAX_PARTY} wayfarers`}>
      {locked && (
        <p class="small warn-text">
          <Icon name="lock" size={14} /> The party is out{s.expedition?.phase === 'rest' ? ' on standing orders' : ''}. Lineup and gear are locked until they stand down.
        </p>
      )}
      <div class="lineup">
        {(['front', 'back'] as Row[]).map((row) => (
          <div class={`lineup-row row-${row}`}>
            <div class="lineup-label">
              <Term k={row}>{row === 'front' ? 'Front row' : 'Back row'}</Term>
            </div>
            <div class="lineup-slots">
              {members
                .filter((m) => (s.party.rows[m] ?? HEROES[m].defaultRow) === row)
                .map((m) => (
                  <button type="button" class={`lineup-hero ${store.ui.hero === m ? 'sel' : ''}`} onClick={() => store.setUi({ hero: m })}>
                    <HeroBadge id={m} size={40} />
                    <span>
                      <b>{HEROES[m].name.split(' ')[0]}</b>
                      <span class="tiny muted"> {HEROES[m].roleLabel}</span>
                    </span>
                  </button>
                ))}
              {members.filter((m) => (s.party.rows[m] ?? HEROES[m].defaultRow) === row).length === 0 && <span class="tiny muted">Empty</span>}
            </div>
          </div>
        ))}
      </div>
      <p class="tiny muted">Melee enemies strike the front row while anyone stands there; ranged and diving enemies prefer the back. Brannoc draws extra attacks in front.</p>
      <h3 class="sub-h">Roster</h3>
      <div class="roster">
        {HERO_LIST.map((h) => {
          const hs = s.heroes[h.id];
          const inParty = members.includes(h.id);
          const st = heroStats(s, h.id);
          return (
            <div class={`roster-card ${hs.recruited ? '' : 'locked'} ${store.ui.hero === h.id ? 'sel' : ''}`}>
              <button type="button" class="roster-main" onClick={() => store.setUi({ hero: h.id })} aria-label={`View ${h.name}`}>
                <HeroBadge id={h.id} size={40} dim={!hs.recruited} />
                <span class="roster-text">
                  <b>{h.name}</b>
                  <span class="tiny muted">
                    {h.roleLabel}
                    {hs.recruited ? ` · Lv ${hs.level}` : ''}
                  </span>
                  {hs.recruited ? <HpBar hp={heroTravelling(s, h.id) && s.expedition ? s.expedition.hp[h.id] : hs.hp} max={st.vigor} size="xs" /> : <span class="tiny muted">{h.recruitHint}</span>}
                </span>
              </button>
              {hs.recruited && (
                <Button
                  size="sm"
                  variant={inParty ? 'ghost' : 'secondary'}
                  icon={inParty ? 'minus' : 'plus'}
                  blocked={locked ? 'The party is out. Wait until it stands down.' : !inParty && members.length >= MAX_PARTY ? `The party holds ${MAX_PARTY}. Remove someone first.` : null}
                  onClick={() => store.act((x) => toggleMember(x, h.id))}
                  label={inParty ? `Remove ${h.name} from party` : `Add ${h.name} to party`}
                >
                  {inParty ? 'Bench' : 'Add'}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function StatRow({ k, label, value, base }: { k: string; label: string; value: number | string; base?: number }) {
  const diff = typeof value === 'number' && base !== undefined ? value - Math.round(base) : 0;
  return (
    <div class="stat-row">
      <Term k={k}>{label}</Term>
      <span class="stat-val">
        {value}
        {diff !== 0 && <span class={`tiny ${diff > 0 ? 'good' : 'bad'}`}> ({diff > 0 ? '+' : ''}{diff} gear)</span>}
      </span>
    </div>
  );
}

function HeroDetail() {
  const s = store.state;
  const id = store.ui.hero;
  const def = HEROES[id];
  const h = s.heroes[id];
  const st = heroStats(s, id);
  const bare = heroStats(s, id, { weapon: null, armor: null, trinket: null });
  const away = heroTravelling(s, id);
  const hp = away && s.expedition ? s.expedition.hp[id] : h.hp;
  const healEta = !away && hp < st.vigor ? (st.vigor - hp) / (st.vigor * healRatePerMs(s)) : 0;
  const locked = heroOnExpedition(s, id);
  if (!h.recruited) {
    return (
      <Panel title={def.name} icon="lock" sub={def.roleLabel}>
        <div class="hero-head">
          <HeroBadge id={id} size={64} dim />
          <div>
            <p>{def.bio}</p>
            <p class="small">
              <b>How to recruit:</b> {def.recruitHint}
            </p>
          </div>
        </div>
        <div class="ability">
          <b>{def.ability.name}</b>
          <p class="small">{def.ability.desc}</p>
          <b>{def.passive.name}</b>
          <p class="small">{def.passive.desc}</p>
        </div>
      </Panel>
    );
  }
  const xpNeed = heroXpToNext(h.level);
  return (
    <Panel title={def.name} icon="users" sub={`${def.title} · ${def.roleLabel}`}>
      <div class="hero-head">
        <HeroBadge id={id} size={64} />
        <div class="hero-head-main">
          <div class="row between">
            <b>Level {h.level}</b>
            <span class="small muted">
              {h.xp}/{xpNeed} xp
            </span>
          </div>
          <Bar value={h.xp / xpNeed} tone="violet" size="xs" label="Experience" />
          <div class="row between">
            <span class="small">Health</span>
            <span class="small muted">
              {Math.round(hp)}/{st.vigor}
            </span>
          </div>
          <HpBar hp={hp} max={st.vigor} size="sm" />
          <span class="tiny muted">{away ? 'On the road. Heals in camp after returning.' : healEta > 0 ? `Healing in the infirmary · full in ${formatDuration(healEta)}` : 'Fully rested'}</span>
        </div>
      </div>
      <p class="small bio">{def.bio}</p>
      <div class="hero-cols">
        <div>
          <h3 class="sub-h">Stats</h3>
          <StatRow k="vigor" label="Vigor" value={st.vigor} base={bare.vigor} />
          <StatRow k="might" label="Might" value={st.might} base={bare.might} />
          <StatRow k="guard" label="Guard" value={st.guard} base={bare.guard} />
          <StatRow k="speed" label="Speed" value={st.speed} base={bare.speed} />
          {st.pierce > 0 && <StatRow k="pierce" label="Pierce" value={st.pierce} />}
          {st.mending > 0 && <StatRow k="mending" label="Mending" value={st.mending} />}
          {st.ward > 0 && <StatRow k="ward" label="Ward" value={`${st.ward}%`} />}
          {st.shock > 0 && <StatRow k="shock" label="Shock" value={`${st.shock}%`} />}
          {st.discovery > 0 && <StatRow k="discovery" label="Discovery" value={`+${st.discovery}%`} />}
          {st.carry > 0 && <StatRow k="carry" label="Carry" value={`+${st.carry}`} />}
          <div class="trait-tags">
            {st.ranged && (
              <Term k="ranged">
                <Tag tone="tide">Ranged</Tag>
              </Term>
            )}
            {st.light && (
              <Term k="light">
                <Tag tone="amber">Light</Tag>
              </Term>
            )}
          </div>
        </div>
        <div>
          <h3 class="sub-h">Abilities</h3>
          <div class="ability">
            <b>
              <Icon name="star" size={14} /> {def.ability.name}
            </b>
            <p class="small">{def.ability.desc}</p>
            <b>
              <Icon name="shield" size={14} /> {def.passive.name}
            </b>
            <p class="small">{def.passive.desc}</p>
          </div>
          {s.party.members.includes(id) && (
            <>
              <h3 class="sub-h">Formation</h3>
              <Segmented<Row>
                label={`${def.name} row`}
                value={s.party.rows[id] ?? def.defaultRow}
                options={[
                  { value: 'front', label: 'Front row' },
                  { value: 'back', label: 'Back row' },
                ]}
                disabled={locked ? 'Formation is locked while the party is out.' : null}
                onChange={(v) => store.act((x) => setRow(x, id, v), { quiet: true })}
              />
              {!st.ranged && (s.party.rows[id] ?? def.defaultRow) === 'back' && def.role !== 'support' && (
                <p class="tiny warn-text">Non-ranged weapons deal 70% damage from the back row.</p>
              )}
            </>
          )}
        </div>
      </div>
      <h3 class="sub-h">Equipment</h3>
      <div class="gear">
        {(['weapon', 'armor', 'trinket'] as EquipSlot[]).map((slot) => {
          const item = h.gear[slot];
          const idef = item ? ITEMS[item] : null;
          return (
            <div class="gear-slot">
              <span class="gear-label">{SLOT_LABEL[slot]}</span>
              {idef ? (
                <div class="gear-item">
                  <ItemIcon id={idef.id} size={34} />
                  <div>
                    <b>{idef.name}</b>
                    <EquipStats def={idef} />
                  </div>
                </div>
              ) : (
                <div class="gear-item empty-slot">
                  <span class="muted small">Empty</span>
                </div>
              )}
              <div class="gear-actions">
                <Button size="sm" icon="repeat" blocked={locked ? `${def.name} is out with the party.` : null} onClick={() => store.openModal({ kind: 'equip', hero: id, slot })}>
                  Change
                </Button>
                {item && (
                  <Button size="sm" variant="ghost" blocked={locked ? `${def.name} is out with the party.` : null} onClick={() => store.act((x) => equip(x, id, slot, null))}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function TacticsPanel() {
  const s = store.state;
  const t = s.tactics;
  const set = (patch: Partial<Tactics>) => store.act((x) => setTactics(x, patch), { quiet: true });
  return (
    <Panel title="Tactics" icon="flag" sub="Apply to the next expedition">
      <div class="tactics">
        <div class="tactic">
          <h3 class="plan-label">Focus target</h3>
          <Segmented<Tactics['focus']>
            label="Focus target"
            value={t.focus}
            options={[
              { value: 'threats', label: 'Threats first' },
              { value: 'weakest', label: 'Weakest first' },
              { value: 'strongest', label: 'Strongest first' },
            ]}
            onChange={(v) => set({ focus: v })}
          />
          <p class="tiny muted">
            {t.focus === 'threats'
              ? 'Silence casters, poisoners and divers before anything else.'
              : t.focus === 'weakest'
                ? 'Finish off wounded foes quickly to thin the enemy’s numbers.'
                : 'Pour damage into the biggest enemy, such as a boss.'}
          </p>
        </div>
        <div class="tactic">
          <h3 class="plan-label">Drink tonics below</h3>
          <Segmented<number>
            label="Tonic threshold"
            value={t.tonicAt}
            options={[
              { value: 0.3, label: '30%' },
              { value: 0.5, label: '50%' },
              { value: 0.7, label: '70%' },
            ]}
            onChange={(v) => set({ tonicAt: v })}
          />
          <p class="tiny muted">Higher keeps everyone safer but uses tonics faster. Drinking takes the wayfarer’s turn.</p>
        </div>
        <div class="tactic">
          <h3 class="plan-label">Fire flasks</h3>
          <Segmented<Tactics['flasks']>
            label="Fire flask use"
            value={t.flasks}
            options={[
              { value: 'always', label: 'Every fight' },
              { value: 'finale', label: 'Objective fights' },
              { value: 'never', label: 'Never' },
            ]}
            onChange={(v) => set({ flasks: v })}
          />
          <p class="tiny muted">A packed flask opens the fight with 14 damage to every enemy.</p>
        </div>
        <div class="tactic">
          <h3 class="plan-label">Retreat below</h3>
          <Segmented<number>
            label="Retreat threshold"
            value={t.retreatAt}
            options={[
              { value: 0.15, label: '15%' },
              { value: 0.3, label: '30%' },
              { value: 0.45, label: '45%' },
            ]}
            onChange={(v) => set({ retreatAt: v })}
          />
          <p class="tiny muted">
            If total party health drops below {pct(t.retreatAt)}, the party breaks off and heads home with its loot. Lower pushes on further, but a wipe loses half the pack.
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function EquipModal({ hero, slot }: { hero: string; slot: EquipSlot }) {
  const s = store.state;
  const def = HEROES[hero];
  const h = s.heroes[hero];
  const cur = heroStats(s, hero);
  const options = Object.keys(s.inventory).filter((id) => ITEMS[id]?.equip?.slot === slot && (s.inventory[id] ?? 0) > 0);
  const delta = (id: string | null) => {
    const st = heroStats(s, hero, { ...h.gear, [slot]: id });
    return (['vigor', 'might', 'guard', 'speed'] as const)
      .map((k) => ({ k, d: st[k] - cur[k] }))
      .filter((x) => x.d !== 0);
  };
  return (
    <Modal title={`${def.name}: ${SLOT_LABEL[slot]}`} icon="repeat" onClose={() => store.closeModal()}>
      {h.gear[slot] && (
        <p class="small">
          Currently: <b>{ITEMS[h.gear[slot]!].name}</b>
        </p>
      )}
      {options.length === 0 ? (
        <p class="muted">
          No spare {SLOT_LABEL[slot].toLowerCase()} items in stores. Craft them in the Workshop ({slot === 'trinket' ? 'Engineering and Alchemy' : slot === 'weapon' ? 'Smithing and Engineering' : 'Smithing and Engineering'}).
        </p>
      ) : (
        <ul class="equip-list">
          {options.map((id) => {
            const idef = ITEMS[id];
            const d = delta(id);
            return (
              <li class="equip-option">
                <ItemIcon id={id} size={36} />
                <div class="equip-main">
                  <div>
                    <b>{idef.name}</b> <span class="tiny muted">×{s.inventory[id]} in stores</span>
                  </div>
                  <EquipStats def={idef} />
                  <div class="tiny">
                    {d.length === 0 ? (
                      <span class="muted">No change to core stats</span>
                    ) : (
                      d.map((x) => (
                        <span class={x.d > 0 ? 'good' : 'bad'}>
                          {x.k[0].toUpperCase() + x.k.slice(1)} {x.d > 0 ? '+' : ''}
                          {x.d}{' '}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    const r = store.act((x) => equip(x, hero, slot, id));
                    if (r.ok) store.closeModal();
                  }}
                >
                  Equip
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

export function Party() {
  return (
    <div class="screen">
      <header class="screen-head">
        <h1>Party</h1>
        <p>Choose who goes out, where they stand, what they carry, and how they fight.</p>
      </header>
      <div class="party-layout">
        <div class="col">
          <Lineup />
          <TacticsPanel />
        </div>
        <div class="col">
          <HeroDetail />
        </div>
      </div>
    </div>
  );
}
