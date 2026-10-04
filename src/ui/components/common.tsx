import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ENEMIES } from '../../game/data/enemies';
import { HEROES } from '../../game/data/heroes';
import { CATEGORY_LABEL, ITEMS } from '../../game/data/items';
import { REGIONS } from '../../game/data/world';
import type { EnemyTrait, ItemDef, ItemQty } from '../../game/types';
import { GLOSSARY } from '../glossary';
import { Icon } from '../icons';
import { store } from '../store';

// ---------------------------------------------------------------------------
// Buttons

interface BtnProps {
  children?: ComponentChildren;
  onClick?: (e: MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  /** If set, the button looks disabled but explains why when pressed. */
  blocked?: string | null;
  disabled?: boolean;
  title?: string;
  label?: string;
  class?: string;
  type?: 'button' | 'submit';
  pressed?: boolean;
}

export function Button(p: BtnProps) {
  const blocked = !!p.blocked;
  return (
    <button
      type={p.type ?? 'button'}
      class={`btn btn-${p.variant ?? 'secondary'} btn-${p.size ?? 'md'} ${blocked ? 'is-blocked' : ''} ${p.class ?? ''}`}
      disabled={p.disabled}
      aria-disabled={blocked ? 'true' : undefined}
      aria-pressed={p.pressed}
      aria-label={p.label}
      title={p.blocked ?? p.title}
      onClick={(e) => {
        if (blocked) {
          store.toast({ tone: 'bad', title: 'Not yet', body: p.blocked! });
          return;
        }
        p.onClick?.(e as unknown as MouseEvent);
      }}
    >
      {p.icon && <Icon name={p.icon} size={p.size === 'sm' ? 16 : 18} />}
      {p.children && <span>{p.children}</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives

export function Panel(p: {
  title?: ComponentChildren;
  icon?: string;
  actions?: ComponentChildren;
  children?: ComponentChildren;
  class?: string;
  sub?: ComponentChildren;
  id?: string;
  tone?: 'default' | 'accent' | 'quiet';
}) {
  return (
    <section class={`panel panel-${p.tone ?? 'default'} ${p.class ?? ''}`} id={p.id} aria-label={typeof p.title === 'string' ? p.title : undefined}>
      {(p.title || p.actions) && (
        <header class="panel-head">
          <div class="panel-title">
            {p.icon && <Icon name={p.icon} size={18} />}
            <h2>{p.title}</h2>
            {p.sub && <span class="panel-sub">{p.sub}</span>}
          </div>
          {p.actions && <div class="panel-actions">{p.actions}</div>}
        </header>
      )}
      <div class="panel-body">{p.children}</div>
    </section>
  );
}

export function Empty(p: { icon?: string; title: string; children?: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class="empty">
      <Icon name={p.icon ?? 'lantern'} size={28} />
      <div class="empty-title">{p.title}</div>
      {p.children && <div class="empty-text">{p.children}</div>}
      {p.action && <div class="empty-action">{p.action}</div>}
    </div>
  );
}

export function Bar(p: { value: number; tone?: string; label?: string; size?: 'xs' | 'sm' | 'md'; striped?: boolean; class?: string }) {
  const v = Math.max(0, Math.min(1, p.value || 0));
  return (
    <div
      class={`bar bar-${p.size ?? 'sm'} tone-${p.tone ?? 'amber'} ${p.striped ? 'bar-striped' : ''} ${p.class ?? ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={p.label}
    >
      <div class="bar-fill" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function HpBar(p: { hp: number; max: number; size?: 'xs' | 'sm' | 'md'; label?: string }) {
  const f = p.max > 0 ? p.hp / p.max : 0;
  const tone = f > 0.6 ? 'moss' : f > 0.3 ? 'warn' : 'ember';
  return <Bar value={f} tone={tone} size={p.size} label={p.label ?? `Health ${Math.round(p.hp)} of ${p.max}`} />;
}

export function Pips(p: { n: number; max: number; tone?: string; label?: string }) {
  return (
    <span class={`pips tone-${p.tone ?? 'amber'}`} aria-label={p.label ?? `${p.n} of ${p.max}`} role="img">
      {Array.from({ length: p.max }, (_, i) => (
        <span class={`pip ${i < p.n ? 'on' : ''}`} />
      ))}
    </span>
  );
}

export function Tag(p: { children: ComponentChildren; tone?: string; icon?: string; title?: string }) {
  return (
    <span class={`tag tone-${p.tone ?? 'muted'}`} title={p.title}>
      {p.icon && <Icon name={p.icon} size={14} />}
      {p.children}
    </span>
  );
}

/** A term with an accessible explanation bubble (hover, focus or tap). */
export function Term(p: { k: string; children: ComponentChildren; text?: string }) {
  const text = p.text ?? GLOSSARY[p.k] ?? '';
  return (
    <span class="term">
      <button type="button" class="term-btn" aria-describedby={undefined}>
        {p.children}
        <span class="term-tip" role="tooltip">
          {text}
        </span>
      </button>
    </span>
  );
}

export function Segmented<T extends string | number>(p: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  disabled?: string | null;
}) {
  return (
    <div class="seg" role="radiogroup" aria-label={p.label}>
      {p.options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={o.value === p.value}
          class={`seg-btn ${o.value === p.value ? 'on' : ''}`}
          title={o.hint}
          onClick={() => {
            if (p.disabled) store.toast({ tone: 'bad', title: 'Locked', body: p.disabled });
            else p.onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper(p: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; disabled?: boolean }) {
  return (
    <div class="stepper" role="group" aria-label={p.label}>
      <button type="button" class="step-btn" aria-label={`Fewer ${p.label}`} disabled={p.disabled || p.value <= p.min} onClick={() => p.onChange(p.value - 1)}>
        <Icon name="minus" size={16} />
      </button>
      <output class="step-val" aria-live="polite">
        {p.value}
      </output>
      <button type="button" class="step-btn" aria-label={`More ${p.label}`} disabled={p.disabled || p.value >= p.max} onClick={() => p.onChange(p.value + 1)}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Items

export function itemGlyph(def: ItemDef | undefined): string {
  if (!def) return 'gem';
  if (def.supply) {
    switch (def.supply.kind) {
      case 'ration':
        return 'sack';
      case 'tonic':
        return 'flask';
      case 'antidote':
        return 'vial';
      case 'flask':
        return 'fire';
      case 'rope':
        return 'coil';
      case 'salve':
        return 'jar';
      case 'draught':
        return 'drop';
    }
  }
  switch (def.category) {
    case 'herb':
      return 'leaf';
    case 'food':
      return 'berry';
    case 'fiber':
      return 'strands';
    case 'wood':
      return 'log';
    case 'ore':
      return 'crystal';
    case 'scrap':
      return 'nut';
    case 'part':
      return 'gear';
    case 'trophy':
      return 'fang';
    case 'notes':
      return 'scroll';
    case 'component':
      return def.id === 'braced_beam' ? 'beam' : 'bracket';
    case 'weapon':
      return def.equip?.ranged ? 'bow' : 'sword';
    case 'armor':
      return 'shield';
    case 'trinket':
      return def.equip?.light ? 'lantern' : def.equip?.carry ? 'pack' : def.equip?.discovery ? 'spyglass' : 'amulet';
  }
  return 'gem';
}

export function ItemIcon(p: { id: string; size?: number }) {
  const def = ITEMS[p.id];
  return (
    <span class={`item-icon cat-${def?.category ?? 'x'} tier-${def?.tier ?? 1}`} style={`--s:${p.size ?? 30}px`} aria-hidden="true">
      <Icon name={itemGlyph(def)} size={Math.round((p.size ?? 30) * 0.6)} />
    </span>
  );
}

export function ItemChip(p: { id: string; qty?: number; need?: number; have?: number; compact?: boolean; showName?: boolean }) {
  const def = ITEMS[p.id];
  const short = p.need !== undefined && (p.have ?? 0) < p.need;
  return (
    <span class={`item-chip ${short ? 'short' : ''} ${p.compact ? 'compact' : ''}`} title={def ? `${def.name} — ${def.desc}` : p.id}>
      <ItemIcon id={p.id} size={p.compact ? 22 : 26} />
      {p.showName !== false && <span class="item-name">{def?.name ?? p.id}</span>}
      {p.need !== undefined ? (
        <span class="item-qty">
          <span class={short ? 'bad' : 'good'}>{p.have ?? 0}</span>/{p.need}
        </span>
      ) : (
        p.qty !== undefined && <span class="item-qty">{p.qty > 0 && p.qty % 1 === 0 ? `×${p.qty}` : p.qty}</span>
      )}
    </span>
  );
}

export function CostList(p: { items: ItemQty[]; times?: number; marks?: number }) {
  const s = store.state;
  return (
    <div class="cost-list">
      {p.marks !== undefined && p.marks > 0 && (
        <span class={`item-chip ${s.marks < p.marks ? 'short' : ''}`}>
          <span class="item-icon cat-mark" style="--s:26px">
            <Icon name="mark" size={16} />
          </span>
          <span class="item-name">Marks</span>
          <span class="item-qty">
            <span class={s.marks < p.marks ? 'bad' : 'good'}>{s.marks}</span>/{p.marks}
          </span>
        </span>
      )}
      {p.items.map((q) => (
        <ItemChip id={q.item} need={q.qty * (p.times ?? 1)} have={s.inventory[q.item] ?? 0} />
      ))}
    </div>
  );
}

export function equipSummary(def: ItemDef): { label: string; k: string; v: string }[] {
  const e = def.equip;
  if (!e) return [];
  const out: { label: string; k: string; v: string }[] = [];
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  for (const [k, v] of Object.entries(e.stats ?? {})) if (v) out.push({ label: k[0].toUpperCase() + k.slice(1), k, v: sign(v) });
  if (e.ranged) out.push({ label: 'Ranged', k: 'ranged', v: '' });
  if (e.pierce) out.push({ label: 'Pierce', k: 'pierce', v: `${e.pierce}` });
  if (e.light) out.push({ label: 'Light', k: 'light', v: '' });
  if (e.carry) out.push({ label: 'Carry', k: 'carry', v: sign(e.carry) });
  if (e.ward) out.push({ label: 'Ward', k: 'ward', v: `${e.ward}%` });
  if (e.discovery) out.push({ label: 'Discovery', k: 'discovery', v: `+${e.discovery}%` });
  if (e.mending) out.push({ label: 'Mending', k: 'mending', v: sign(e.mending) });
  if (e.shock) out.push({ label: 'Shock', k: 'shock', v: `${e.shock}%` });
  return out;
}

export function EquipStats(p: { def: ItemDef }) {
  const rows = equipSummary(p.def);
  if (!rows.length) return null;
  return (
    <span class="equip-stats">
      {rows.map((r) => (
        <Term k={r.k}>
          <span class="stat-pill">
            {r.label}
            {r.v && <b> {r.v}</b>}
          </span>
        </Term>
      ))}
    </span>
  );
}

export function ItemDescription(p: { id: string }) {
  const def = ITEMS[p.id];
  if (!def) return null;
  return (
    <div class="item-desc">
      <div class="item-desc-head">
        <ItemIcon id={p.id} size={36} />
        <div>
          <div class="item-desc-name">{def.name}</div>
          <div class="muted small">
            {CATEGORY_LABEL[def.category]} · Tier {def.tier} · worth {def.value} marks
          </div>
        </div>
      </div>
      <p class="small">{def.desc}</p>
      <EquipStats def={def} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Characters

const ROLE_ICON: Record<string, string> = { defender: 'shield', striker: 'bow', support: 'cross', sapper: 'bomb', scout: 'eye' };
const ROLE_TONE: Record<string, string> = { defender: 'tide', striker: 'amber', support: 'moss', sapper: 'ember', scout: 'violet' };

export function HeroBadge(p: { id: string; size?: number; dim?: boolean }) {
  const def = HEROES[p.id];
  const size = p.size ?? 44;
  return (
    <span class={`hero-badge tone-${ROLE_TONE[def.role]} ${p.dim ? 'dim' : ''}`} style={`--s:${size}px`} aria-hidden="true">
      <span class="hero-initial">{def.name[0]}</span>
      <span class="hero-role">
        <Icon name={ROLE_ICON[def.role]} size={Math.round(size * 0.32)} />
      </span>
    </span>
  );
}

export function roleIcon(role: string): string {
  return ROLE_ICON[role] ?? 'users';
}

export const TRAIT_LABEL: Record<EnemyTrait, string> = {
  ambush: 'Ambush',
  charge: 'Charge',
  spore: 'Poison',
  armored: 'Armored',
  pack: 'Pack',
  frenzy: 'Frenzy',
  flying: 'Flying',
  dive: 'Dive',
  shield: 'Ward',
  lull: 'Lull',
  ranged: 'Ranged',
  enrage: 'Enrage',
  summon: 'Summoner',
  vent: 'Steam Vent',
  overcharge: 'Overcharge',
};

export function EnemyBadge(p: { id: string; size?: number; unknown?: boolean }) {
  const def = ENEMIES[p.id];
  const size = p.size ?? 40;
  const color = REGIONS[def.region]?.color ?? '#888';
  return (
    <span class={`enemy-badge ${def.boss ? 'boss' : ''} ${p.unknown ? 'unknown' : ''}`} style={`--s:${size}px;--c:${color}`} aria-hidden="true">
      <Icon name={p.unknown ? 'info' : def.boss ? 'skull' : def.traits.includes('flying') ? 'feather' : def.traits.includes('shield') ? 'shield' : 'paw'} size={Math.round(size * 0.55)} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Misc

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Trap focus inside an element while mounted; restore it on unmount. */
export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(
        (x) => x.offsetParent !== null,
      );
    const first = focusables()[0];
    (first ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const a = f[0];
      const b = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    el?.addEventListener('keydown', onKey);
    return () => {
      el?.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [active]);
  return ref;
}

export function Modal(p: { title: ComponentChildren; onClose: () => void; children: ComponentChildren; wide?: boolean; footer?: ComponentChildren; icon?: string; closeLabel?: string }) {
  const ref = useFocusTrap(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.onClose]);
  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && p.onClose()}>
      <div class={`modal ${p.wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref} tabIndex={-1}>
        <header class="modal-head">
          <div class="modal-title">
            {p.icon && <Icon name={p.icon} size={22} />}
            <h2 id="modal-title">{p.title}</h2>
          </div>
          <button type="button" class="icon-btn" onClick={p.onClose} aria-label={p.closeLabel ?? 'Close'}>
            <Icon name="close" />
          </button>
        </header>
        <div class="modal-body">{p.children}</div>
        {p.footer && <footer class="modal-foot">{p.footer}</footer>}
      </div>
    </div>
  );
}

export function KeyVal(p: { k: ComponentChildren; v: ComponentChildren; icon?: string }) {
  return (
    <div class="kv">
      <span class="kv-k">
        {p.icon && <Icon name={p.icon} size={15} />}
        {p.k}
      </span>
      <span class="kv-v">{p.v}</span>
    </div>
  );
}
