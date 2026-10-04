import { RECIPE_LIST } from '../../game/data/actions';
import { ITEMS } from '../../game/data/items';
import { actionAvailability } from '../../game/sim/rules';
import type { ActionDef } from '../../game/types';
import { store } from '../store';
import { ActionCard } from '../components/actions';
import { Empty } from '../components/common';

const TABS: { id: string; label: string; match: (a: ActionDef) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'weapon', label: 'Weapons', match: (a) => ITEMS[a.outputs[0].item]?.category === 'weapon' },
  { id: 'armor', label: 'Armor', match: (a) => ITEMS[a.outputs[0].item]?.category === 'armor' },
  { id: 'trinket', label: 'Trinkets', match: (a) => ITEMS[a.outputs[0].item]?.category === 'trinket' },
  { id: 'supply', label: 'Supplies', match: (a) => ITEMS[a.outputs[0].item]?.category === 'supply' },
  { id: 'component', label: 'Camp parts', match: (a) => ITEMS[a.outputs[0].item]?.category === 'component' },
  { id: 'salvage', label: 'Salvage', match: (a) => a.skill === 'salvaging' },
];

export function Workshop() {
  const s = store.state;
  const tab = TABS.find((t) => t.id === store.ui.workshopTab) ?? TABS[0];
  const list = RECIPE_LIST.filter(tab.match);
  const ready = list.filter((a) => actionAvailability(s, a).ok);
  const locked = list.filter((a) => !actionAvailability(s, a).ok);
  return (
    <div class="screen">
      <header class="screen-head">
        <h1>Workshop</h1>
        <p>Forge, brew and build. Every recipe runs as a camp work order and uses a hand. Gear goes to your stores; equip it from the Party screen.</p>
      </header>
      <div class="tabs" role="tablist" aria-label="Recipe categories">
        {TABS.map((t) => {
          const n = RECIPE_LIST.filter(t.match).filter((a) => actionAvailability(s, a).ok).length;
          return (
            <button type="button" role="tab" aria-selected={t.id === tab.id} class={`tab ${t.id === tab.id ? 'on' : ''}`} onClick={() => store.setUi({ workshopTab: t.id })}>
              {t.label} <span class="tab-count">{n}</span>
            </button>
          );
        })}
      </div>
      {ready.length === 0 && locked.length === 0 && <Empty title="No recipes here yet" />}
      {ready.length > 0 && (
        <div class="action-grid">
          {ready.map((a) => (
            <ActionCard a={a} />
          ))}
        </div>
      )}
      {locked.length > 0 && (
        <>
          <h2 class="section-h">Not yet available</h2>
          <div class="action-grid">
            {locked.map((a) => (
              <ActionCard a={a} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
