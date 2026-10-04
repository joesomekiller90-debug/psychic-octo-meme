import { useEffect, useState } from 'preact/hooks';
import { LORE } from '../../game/data/camp';
import { HEROES } from '../../game/data/heroes';
import { ITEMS } from '../../game/data/items';
import { SKILLS } from '../../game/data/skills';
import { DRIFTS, ROUTES } from '../../game/data/world';
import { markReportRead } from '../../game/sim/actions';
import { formatDuration } from '../../game/sim/format';
import { offlineCapMs, RISKS } from '../../game/sim/rules';
import type { SkillId } from '../../game/types';
import { Icon } from '../icons';
import { store } from '../store';
import { Button, HeroBadge, ItemChip, Modal, Segmented, Tag } from '../components/common';
import { JourneyLog } from '../components/log';
import { EquipModal } from '../screens/Party';

function Welcome() {
  return (
    <Modal
      title="Kindled Roads"
      icon="lantern"
      closeLabel="Begin"
      onClose={() => store.closeModal()}
      footer={
        <Button
          variant="primary"
          size="lg"
          icon="compass"
          onClick={() => {
            store.closeModal();
            store.go('expeditions', { routeId: 'wildroot_trail', region: 'hollowmere' });
          }}
        >
          Light the first lantern
        </Button>
      }
    >
      <div class="welcome">
        <p class="lede">{LORE.lore_compact.text}</p>
        <p>
          You lead the Compact now. Send your three wayfarers, <b>Brannoc</b> the warden, <b>Wren</b> the outrider and <b>Tamsin</b> the mender, out to chart routes, relight waystones and
          reconnect the settlements cut off by the Hush.
        </p>
        <ul class="welcome-list">
          <li>
            <Icon name="compass" size={18} /> <span>Expeditions run in real time, even while the game is closed, and come back with a journey report.</span>
          </li>
          <li>
            <Icon name="hand" size={18} /> <span>Camp hands run up to two work orders at once: gathering, crafting and construction. They also serve as porters.</span>
          </li>
          <li>
            <Icon name="anvil" size={18} /> <span>Turn what you find into gear, supplies and camp upgrades, then take on harder roads.</span>
          </li>
        </ul>
        <p class="small muted">Your first expedition is already planned. It takes under a minute.</p>
      </div>
    </Modal>
  );
}

function Summary() {
  const s = store.state;
  const sum = s.pendingSummary;
  if (!sum) {
    store.closeModal();
    return null;
  }
  const gained = Object.entries(sum.items).filter(([, n]) => n > 0);
  const used = Object.entries(sum.items).filter(([, n]) => n < 0);
  return (
    <Modal
      title="While you were away"
      icon="lantern"
      wide
      onClose={() => store.closeModal()}
      footer={
        <Button variant="primary" onClick={() => store.closeModal()}>
          Back to Lanternhold
        </Button>
      }
    >
      <p class="lede">
        {formatDuration(sum.elapsed)} passed at Lanternhold.{' '}
        <span class="small muted">Offline progress counts for up to {offlineCapMs(s) / 3600_000} hours (raise it with the Signal Beacon).</span>
      </p>
      {sum.attention.length > 0 && (
        <div class="sum-section attention">
          <h3>
            <Icon name="alert" size={16} /> Needs your attention
          </h3>
          <ul>
            {sum.attention.map((a) => (
              <li>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <div class="sum-grid">
        {sum.reports.length > 0 && (
          <div class="sum-section">
            <h3>
              <Icon name="compass" size={16} /> Expeditions
            </h3>
            <ul>
              {sum.reports.map((id) => {
                const r = s.reports.find((x) => x.id === id);
                if (!r) return null;
                return (
                  <li class="row between">
                    <span>
                      <Tag tone={r.outcome === 'success' ? 'moss' : r.outcome === 'retreat' ? 'warn' : 'ember'}>{r.outcome === 'success' ? 'Completed' : r.outcome === 'retreat' ? 'Turned back' : 'Defeated'}</Tag> {ROUTES[r.routeId].name}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => store.openModal({ kind: 'report', id })}>
                      Report
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {(sum.orders.length > 0 || sum.builds.length > 0) && (
          <div class="sum-section">
            <h3>
              <Icon name="hand" size={16} /> Camp work
            </h3>
            <ul>
              {sum.orders.map((o) => (
                <li>
                  {o.name} <b>×{o.cycles}</b>
                </li>
              ))}
              {sum.builds.map((b) => (
                <li>
                  <Icon name="hammer" size={14} /> Built {b}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(Object.keys(sum.skillXp).length > 0 || Object.keys(sum.heroLevels).length > 0) && (
          <div class="sum-section">
            <h3>
              <Icon name="star" size={16} /> Experience
            </h3>
            <ul>
              {(Object.entries(sum.skillXp) as [SkillId, number][]).map(([k, v]) => (
                <li>
                  {SKILLS[k].name} +{v} xp
                  {sum.skillLevels[k] && (
                    <b class="good">
                      {' '}
                      · level {sum.skillLevels[k]![0]} → {sum.skillLevels[k]![1]}
                    </b>
                  )}
                </li>
              ))}
              {Object.entries(sum.heroLevels).map(([h, [a, b]]) => (
                <li>
                  {HEROES[h].name}{' '}
                  <b class="good">
                    level {a} → {b}
                  </b>
                </li>
              ))}
            </ul>
          </div>
        )}
        {sum.discoveries.length > 0 && (
          <div class="sum-section">
            <h3>
              <Icon name="sparkle" size={16} /> Discoveries
            </h3>
            <ul>
              {sum.discoveries.map((d) => (
                <li>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {(gained.length > 0 || sum.marks !== 0) && (
        <div class="sum-section">
          <h3>
            <Icon name="crate" size={16} /> Gained
          </h3>
          <div class="haul">
            {sum.marks > 0 && <Tag tone="amber" icon="mark">+{sum.marks} marks</Tag>}
            {sum.standing > 0 && <Tag tone="gold" icon="standing">+{sum.standing} standing</Tag>}
            {gained.map(([id, n]) => (
              <ItemChip id={id} qty={n} compact />
            ))}
          </div>
        </div>
      )}
      {used.length > 0 && (
        <div class="sum-section">
          <h3>
            <Icon name="minus" size={16} /> Used
          </h3>
          <div class="haul">
            {used.map(([id, n]) => (
              <ItemChip id={id} qty={-n} compact />
            ))}
          </div>
        </div>
      )}
      {gained.length === 0 && sum.reports.length === 0 && sum.orders.length === 0 && <p class="muted">Nothing was running while you were away. Start a work order or an expedition and it will keep going next time.</p>}
    </Modal>
  );
}

function Report({ id }: { id: number }) {
  const s = store.state;
  const r = s.reports.find((x) => x.id === id);
  useEffect(() => {
    if (r?.unread) store.act((x) => markReportRead(x, id), { quiet: true });
  }, [id]);
  if (!r) {
    return (
      <Modal title="Report" onClose={() => store.closeModal()}>
        <p>This report is no longer in the journal.</p>
      </Modal>
    );
  }
  const route = ROUTES[r.routeId];
  const word = r.outcome === 'success' ? 'Completed' : r.outcome === 'retreat' ? (r.recalled ? 'Recalled' : 'Turned back') : 'Defeated';
  return (
    <Modal
      title={`Journey report: ${route.name}`}
      icon="journal"
      wide
      onClose={() => store.closeModal()}
      footer={
        <Button variant="primary" onClick={() => store.closeModal()}>
          Done
        </Button>
      }
    >
      <div class="report-head">
        <Tag tone={r.outcome === 'success' ? 'moss' : r.outcome === 'retreat' ? 'warn' : 'ember'}>{word}</Tag>
        <span class="small muted">
          Run {r.run} · {formatDuration(r.duration)} · {RISKS[r.risk].name} pace · {DRIFTS[r.drift].name}
        </span>
      </div>
      {r.firstClear && (
        <div class="first-clear">
          <Icon name="beacon" size={22} />
          <p>{r.firstClear}</p>
        </div>
      )}
      <div class="report-grid">
        <div class="sum-section">
          <h3>
            <Icon name="crate" size={16} /> Brought home
          </h3>
          <div class="haul">
            <Tag tone="amber" icon="mark">
              +{r.marks} marks
            </Tag>
            {Object.entries(r.loot).map(([i, n]) => (
              <ItemChip id={i} qty={n} compact />
            ))}
          </div>
          {r.sold > 0 && <p class="tiny muted">Stores were full: overflow sold for {r.sold} marks.</p>}
          {Object.keys(r.lost).length > 0 && (
            <p class="tiny bad">Lost in the rout: {Object.entries(r.lost).map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ')}</p>
          )}
          {Object.keys(r.leftBehind).length > 0 && (
            <p class="tiny warn-text">Left behind (packs full): {Object.entries(r.leftBehind).map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ')}</p>
          )}
          {Object.keys(r.used).length > 0 && <p class="tiny muted">Supplies used: {Object.entries(r.used).map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ')}</p>}
        </div>
        <div class="sum-section">
          <h3>
            <Icon name="users" size={16} /> Party
          </h3>
          <ul class="report-party">
            {r.members.map((m) => (
              <li>
                <HeroBadge id={m} size={26} /> {HEROES[m].name.split(' ')[0]} <span class="tiny muted">{Math.round(r.hpAfter[m] ?? 0)} health on return</span>
              </li>
            ))}
          </ul>
          <p class="small">
            +{r.heroXp} wayfarer xp each ·{' '}
            {(Object.entries(r.skillXp) as [SkillId, number][]).map(([k, v]) => `${SKILLS[k].name} +${v}`).join(' · ')}
          </p>
          {r.levelUps.length > 0 && <p class="small good">{r.levelUps.join(' · ')}</p>}
        </div>
      </div>
      <h3 class="sub-h">The journey</h3>
      <JourneyLog log={r.log} />
    </Modal>
  );
}

function Settings() {
  const s = store.state;
  const [text, setText] = useState('');
  const [exported, setExported] = useState('');
  return (
    <Modal title="Settings & save" icon="settings" onClose={() => store.closeModal()}>
      <div class="settings">
        <section>
          <h3>Motion</h3>
          <Segmented<'system' | 'on' | 'off'>
            label="Reduced motion"
            value={s.settings.reducedMotion}
            options={[
              { value: 'system', label: 'Follow system' },
              { value: 'on', label: 'Reduce motion' },
              { value: 'off', label: 'Full motion' },
            ]}
            onChange={(v) => store.act((x) => void (x.settings.reducedMotion = v), { quiet: true })}
          />
        </section>
        <section>
          <h3>Guide</h3>
          <Button size="sm" onClick={() => store.act((x) => void (x.tutorial.hidden = !x.tutorial.hidden), { quiet: true })}>
            {s.tutorial.hidden ? 'Show the guide on the Overview' : 'Hide the guide'}
          </Button>
        </section>
        <section>
          <h3>Offline progress</h3>
          <p class="small">
            While the game is closed, expeditions, work orders and healing continue for up to <b>{offlineCapMs(s) / 3600_000} hours</b>. Time beyond that is not counted. Build the Signal Beacon to
            raise the limit. Progress is calculated once when you return, from the saved time. If your device clock moves backwards, nothing is gained or lost.
          </p>
        </section>
        <section>
          <h3>Saving</h3>
          <p class="small">
            The game saves automatically every few seconds and after every action, alternating between two save slots so a cut-off save never destroys your progress.
            {!store.persistent && <b class="bad"> This browser is blocking storage; progress will not persist.</b>}
            {store.saveError && <b class="bad"> Last save failed: {store.saveError}</b>}
          </p>
          <div class="row gap-sm wrap">
            <Button size="sm" icon="download" onClick={() => setExported(store.exportText())}>
              Export save
            </Button>
            {exported && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard?.writeText(exported).then(
                    () => store.toast({ tone: 'info', title: 'Save copied to clipboard' }),
                    () => store.toast({ tone: 'bad', title: 'Could not copy', body: 'Select the text and copy it manually.' }),
                  );
                }}
              >
                Copy
              </Button>
            )}
          </div>
          {exported && <textarea class="save-text" readOnly value={exported} aria-label="Exported save" onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />}
          <label class="small" for="import-save">
            Import a save
          </label>
          <textarea id="import-save" class="save-text" value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Paste an exported save here" />
          <Button
            size="sm"
            icon="upload"
            blocked={text.trim() ? null : 'Paste an exported save first.'}
            onClick={() =>
              store.openModal({
                kind: 'confirm',
                title: 'Replace your current game?',
                body: 'Importing replaces the current guild with the imported one.',
                confirm: 'Import',
                danger: true,
                onConfirm: () => {
                  const r = store.importText(text);
                  store.toast({ tone: r.ok ? 'good' : 'bad', title: r.msg });
                },
              })
            }
          >
            Import
          </Button>
        </section>
        <section>
          <h3>Start over</h3>
          <p class="small muted">Erases this guild completely. There is no undo.</p>
          <Button
            size="sm"
            variant="danger"
            icon="trash"
            onClick={() =>
              store.openModal({
                kind: 'confirm',
                title: 'Erase this guild?',
                body: 'All progress will be deleted and a new game started. Export your save first if you might want it back.',
                confirm: 'Erase and restart',
                danger: true,
                onConfirm: () => store.reset(),
              })
            }
          >
            Reset game
          </Button>
        </section>
        <section>
          <h3>Keyboard</h3>
          <p class="small">Keys 1–7 switch screens. Tab moves between controls, Enter or Space activates them, and Escape closes dialogs.</p>
        </section>
      </div>
    </Modal>
  );
}

export function ModalHost() {
  const m = store.ui.modal;
  if (!m) return null;
  switch (m.kind) {
    case 'welcome':
      return <Welcome />;
    case 'summary':
      return <Summary />;
    case 'report':
      return <Report id={m.id} />;
    case 'settings':
      return <Settings />;
    case 'equip':
      return <EquipModal hero={m.hero} slot={m.slot} />;
    case 'confirm':
      return (
        <Modal
          title={m.title}
          icon="alert"
          onClose={() => store.closeModal()}
          footer={
            <>
              <Button variant="ghost" onClick={() => store.closeModal()}>
                Cancel
              </Button>
              <Button
                variant={m.danger ? 'danger' : 'primary'}
                onClick={() => {
                  store.closeModal();
                  m.onConfirm();
                }}
              >
                {m.confirm}
              </Button>
            </>
          }
        >
          <p>{m.body}</p>
        </Modal>
      );
  }
}
