// Journey log rendering shared by the live journey view and saved reports.
import { ENEMIES } from '../../game/data/enemies';
import type { LogEntry } from '../../game/sim/state';
import { Icon } from '../icons';
import { EnemyBadge } from './common';

const KIND_ICON: Record<string, string> = {
  travel: 'route',
  ration: 'sack',
  hunger: 'alert',
  hazard: 'alert',
  safe: 'check',
  fight: 'sword',
  find: 'leaf',
  full: 'pack',
  discovery: 'sparkle',
  retreat: 'back',
  defeat: 'skull',
  objective: 'waystone',
  return: 'camp',
};

export function JourneyLog({ log, live }: { log: LogEntry[]; live?: boolean }) {
  // Group by leg for readability.
  const groups: { leg: number; entries: LogEntry[] }[] = [];
  for (const e of log) {
    const g = groups[groups.length - 1];
    if (g && g.leg === e.leg) g.entries.push(e);
    else groups.push({ leg: e.leg, entries: [e] });
  }
  return (
    <ol class="jlog" aria-live={live ? 'polite' : undefined}>
      {groups.map((g) => (
        <li class="jlog-leg">
          {g.entries.map((e, i) => {
            const head = e.kind === 'travel' && i === 0 && e.leg > 0;
            return (
              <div class={`jlog-entry k-${e.kind} ${head ? 'jlog-head' : ''}`}>
                <span class="jlog-icon">
                  <Icon name={KIND_ICON[e.kind] ?? 'info'} size={15} />
                </span>
                <div class="jlog-text">
                  {e.fight && e.fight.lines.length === 0 ? (
                    <span>
                      {e.text} <span class="tiny muted">(blow-by-blow log kept only for recent reports)</span>
                    </span>
                  ) : e.fight ? (
                    <details class="fight">
                      <summary>
                        <span class="fight-enemies">
                          {e.fight.enemies.map((id) => (
                            <EnemyBadge id={id} size={22} />
                          ))}
                        </span>
                        <span>{e.text}</span>
                        <span class="fight-more">Combat log</span>
                      </summary>
                      <ol class="clog">
                        {e.fight.lines.map((l) => (
                          <li class={`cl-${l.k}`}>{l.t}</li>
                        ))}
                      </ol>
                    </details>
                  ) : (
                    e.text
                  )}
                </div>
              </div>
            );
          })}
        </li>
      ))}
    </ol>
  );
}

export function enemyList(ids: string[]): string {
  return ids.map((id) => ENEMIES[id]?.name ?? id).join(', ');
}
