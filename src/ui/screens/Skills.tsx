import { ACTION_LIST } from '../../game/data/actions';
import { SKILL_ORDER, SKILLS } from '../../game/data/skills';
import { skillProgress } from '../../game/sim/rules';
import { Icon } from '../icons';
import { store } from '../store';
import { ActionCard, nextUnlock } from '../components/actions';
import { Bar, Button, Panel } from '../components/common';

export function Skills() {
  const s = store.state;
  const sel = store.ui.skill;
  const def = SKILLS[sel];
  const prog = skillProgress(s.skills[sel] ?? 0);
  const actions = ACTION_LIST.filter((a) => a.skill === sel);
  const gathers = actions.filter((a) => a.kind === 'gather');
  const crafts = actions.filter((a) => a.kind === 'craft');
  return (
    <div class="screen">
      <header class="screen-head">
        <h1>Skills</h1>
        <p>Seven crafts keep the Compact moving. Each levels up as your hands and wayfarers use it.</p>
      </header>
      <div class="skill-grid" role="tablist" aria-label="Skills">
        {SKILL_ORDER.map((id) => {
          const p = skillProgress(s.skills[id] ?? 0);
          const running = s.orders.some((o) => o?.actionId && ACTION_LIST.find((a) => a.id === o.actionId)?.skill === id);
          return (
            <button
              type="button"
              role="tab"
              aria-selected={sel === id}
              class={`skill-card ${sel === id ? 'sel' : ''}`}
              style={`--c:${SKILLS[id].color}`}
              onClick={() => store.setUi({ skill: id })}
            >
              <span class="skill-ico">
                <Icon name={id} size={20} />
              </span>
              <span class="skill-main">
                <span class="row between">
                  <b>{SKILLS[id].name}</b>
                  <span class="skill-lvl">{p.level}</span>
                </span>
                <Bar value={p.frac} tone="skill" size="xs" label={`${SKILLS[id].name} experience`} />
                <span class="tiny muted">{running ? 'Working now' : `${p.into}/${p.need} xp`}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Panel title={`${def.name} · level ${prog.level}`} icon={sel} class="skill-detail">
        <div class="skill-summary" style={`--c:${def.color}`}>
          <div>
            <p>{def.role}</p>
            <p class="small">
              <Icon name="star" size={14} /> {def.passive}
            </p>
            <p class="small">
              <Icon name="flag" size={14} /> <b>Next unlock:</b> {nextUnlock(sel, prog.level) ?? 'All current content unlocked.'}
            </p>
          </div>
          <div class="skill-xp">
            <span class="small">
              {prog.into} / {prog.need} xp to level {prog.level + 1}
            </span>
            <Bar value={prog.frac} tone="skill" size="sm" label="Experience" />
          </div>
        </div>
        {gathers.length > 0 && (
          <>
            <h3 class="sub-h">Activities</h3>
            <div class="action-grid">
              {gathers.map((a) => (
                <ActionCard a={a} />
              ))}
            </div>
          </>
        )}
        {crafts.length > 0 && (
          <>
            <div class="row between">
              <h3 class="sub-h">Recipes</h3>
              <Button size="sm" variant="ghost" icon="anvil" onClick={() => store.go('workshop')}>
                Open Workshop
              </Button>
            </div>
            <div class="action-grid">
              {crafts.map((a) => (
                <ActionCard a={a} />
              ))}
            </div>
          </>
        )}
        {sel === 'scouting' && (
          <p class="small muted">Scouting also grows on every expedition leg. Its level shortens journeys, raises discovery odds, improves forecasts and opens new routes.</p>
        )}
      </Panel>
    </div>
  );
}
