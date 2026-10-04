// Activity / recipe card used by the Skills and Workshop screens.
import { useState } from 'preact/hooks';
import { ACTION_LIST } from '../../game/data/actions';
import { ITEMS } from '../../game/data/items';
import { SKILLS } from '../../game/data/skills';
import { ROUTE_LIST, REGIONS } from '../../game/data/world';
import { UPGRADE_LIST } from '../../game/data/camp';
import { startOrder } from '../../game/sim/actions';
import { hasItems, missingItems } from '../../game/sim/core';
import { formatDuration } from '../../game/sim/format';
import { actionAvailability, actionCycleMs, extraOutputChance, freeHands, levelOf } from '../../game/sim/rules';
import type { ActionDef, SkillId } from '../../game/types';
import { Icon } from '../icons';
import { store } from '../store';
import { Button, CostList, EquipStats, ItemChip, Segmented, Tag } from './common';

export function nextUnlock(skill: SkillId, level: number): string | null {
  const cands: { level: number; text: string }[] = [];
  for (const a of ACTION_LIST) if (a.skill === skill && a.level > level) cands.push({ level: a.level, text: a.name });
  for (const r of ROUTE_LIST) for (const q of r.requires) if (q.type === 'skill' && q.skill === skill && q.level > level) cands.push({ level: q.level, text: `${r.name} (${REGIONS[r.region].name})` });
  for (const u of UPGRADE_LIST) u.levels.forEach((l, i) => l.requires?.forEach((q) => q.type === 'skill' && q.skill === skill && q.level > level && cands.push({ level: q.level, text: `${u.name} ${i + 1}` })));
  if (!cands.length) return null;
  cands.sort((a, b) => a.level - b.level);
  const lv = cands[0].level;
  return `Level ${lv}: ${cands.filter((c) => c.level === lv).map((c) => c.text).join(', ')}`;
}

export function ActionCard({ a }: { a: ActionDef }) {
  const s = store.state;
  const av = actionAvailability(s, a);
  const [qty, setQty] = useState<number>(a.kind === 'craft' ? 5 : 0);
  const [hands, setHands] = useState(1);
  const cycle = actionCycleMs(s, a, hands);
  const slotFree = s.orders.some((o) => !o);
  const running = s.orders.find((o) => o?.actionId === a.id);
  const free = freeHands(s);
  const mainOut = a.outputs[0];
  const outDef = ITEMS[mainOut.item];
  const extra = extraOutputChance(s, a);
  const maxCraft = a.inputs?.length ? Math.min(...a.inputs.map((q) => Math.floor((s.inventory[q.item] ?? 0) / q.qty))) : Infinity;
  let blocked: string | null = null;
  if (!av.ok) blocked = `Locked: ${av.reasons.join('; ')}.`;
  else if (!slotFree) blocked = 'Both work-order slots are busy. Cancel one in the activity panel or wait for it to finish.';
  else if (free < hands) blocked = `Needs ${hands} free hand${hands > 1 ? 's' : ''}; ${free} free. Porters on expeditions and other orders use hands.`;
  else if (a.inputs && !hasItems(s, a.inputs)) {
    blocked = `Missing ${missingItems(s, a.inputs)
      .map((m) => `${m.qty} ${ITEMS[m.item].name}`)
      .join(', ')}.`;
  }
  const qtyOpts =
    a.kind === 'craft'
      ? [
          { value: 1, label: '1' },
          { value: 5, label: '5' },
          { value: 10, label: '10' },
          { value: -2, label: `All (${Number.isFinite(maxCraft) ? maxCraft : '∞'})` },
        ]
      : [
          { value: 0, label: 'Until stopped' },
          { value: 10, label: '10' },
          { value: 25, label: '25' },
        ];
  const target = a.kind === 'craft' ? (qty === -2 ? Math.max(1, Number.isFinite(maxCraft) ? maxCraft : 1) : qty) : qty === 0 ? null : qty;
  return (
    <article class={`action-card ${av.ok ? '' : 'locked'} ${running ? 'running' : ''}`}>
      <header class="ac-head">
        <span class={`ac-icon skill-${a.skill}`}>
          <Icon name={av.known ? a.skill : 'lock'} size={18} />
        </span>
        <div class="ac-title">
          <b>{a.name}</b>
          <span class="tiny muted">
            {SKILLS[a.skill].name} {a.level} · {formatDuration(cycle)} each · {a.xp} xp
          </span>
        </div>
        {running && (
          <Tag tone="amber" icon="play">
            Running
          </Tag>
        )}
      </header>
      {a.desc && <p class="tiny muted ac-desc">{a.desc}</p>}
      <div class="ac-io">
        {a.inputs && a.inputs.length > 0 && (
          <div class="ac-in">
            <span class="tiny muted">Uses</span>
            <CostList items={a.inputs} />
          </div>
        )}
        <div class="ac-out">
          <span class="tiny muted">Makes</span>
          <div class="cost-list">
            {a.outputs.map((o) => (
              <span class="out-chip">
                <ItemChip id={o.item} qty={o.qty} />
                {o.chance !== undefined && o.chance < 1 && <span class="tiny muted">{Math.round(o.chance * 100)}%</span>}
              </span>
            ))}
          </div>
          {extra > 0 && <span class="tiny good">{Math.round(extra * 100)}% chance of a double batch</span>}
        </div>
      </div>
      {outDef?.equip && (
        <div class="ac-stats">
          <EquipStats def={outDef} />
        </div>
      )}
      {outDef?.supply && <p class="tiny ac-stats">{outDef.desc}</p>}
      {!av.ok ? (
        <div class="ac-locked">
          <Icon name="lock" size={14} /> {av.reasons.join(' · ')}
        </div>
      ) : (
        <div class="ac-controls">
          <Segmented<number> label={a.kind === 'craft' ? 'Quantity' : 'Repeat'} value={qty} options={qtyOpts} onChange={setQty} />
          <Segmented<number>
            label="Crew"
            value={hands}
            options={[
              { value: 1, label: '1 hand' },
              { value: 2, label: '2 hands (+60%)' },
            ]}
            onChange={setHands}
          />
          <Button variant="primary" icon="play" blocked={blocked} onClick={() => store.act((x, ctx) => startOrder(x, ctx, a.id, hands, target))}>
            Start
          </Button>
        </div>
      )}
    </article>
  );
}

export function skillLevel(skill: SkillId): number {
  return levelOf(store.state, skill);
}
