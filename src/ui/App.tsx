import { useEffect } from 'preact/hooks';
import { rankOf, freeHands, totalHands } from '../game/sim/rules';
import { RANKS } from '../game/data/camp';
import { readyContracts } from '../game/sim/contracts';
import { formatNumber } from '../game/sim/format';
import { Icon } from './icons';
import { store, useStore, type Screen } from './store';
import { ActivityRail } from './components/activity';
import { Term } from './components/common';
import { Toasts } from './components/toasts';
import { ModalHost } from './modals/ModalHost';
import { Overview } from './screens/Overview';
import { Expeditions } from './screens/Expeditions';
import { Party } from './screens/Party';
import { Skills } from './screens/Skills';
import { Workshop } from './screens/Workshop';
import { Camp } from './screens/Camp';
import { Journal } from './screens/Journal';

const NAV: { id: Screen; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'lantern' },
  { id: 'expeditions', label: 'Expeditions', icon: 'compass' },
  { id: 'party', label: 'Party', icon: 'users' },
  { id: 'skills', label: 'Skills', icon: 'skills' },
  { id: 'workshop', label: 'Workshop', icon: 'anvil' },
  { id: 'camp', label: 'Camp', icon: 'camp' },
  { id: 'journal', label: 'Journal', icon: 'journal' },
];

function Brand() {
  return (
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
        <defs>
          <radialGradient id="glow" cx="50%" cy="55%" r="50%">
            <stop offset="0" stop-color="#ffd58a" />
            <stop offset="0.5" stop-color="#f2ad4e" stop-opacity="0.55" />
            <stop offset="1" stop-color="#f2ad4e" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle cx="20" cy="22" r="17" fill="url(#glow)" />
        <path d="M14 10h12M20 6v4M13 13h14l2 4v11l-2 4H13l-2-4V17z" fill="#1a2329" stroke="#f2ad4e" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M17 18c1.5-2 4.5-2 6 0v7c-1.5 2-4.5 2-6 0z" fill="#ffcf83" />
      </svg>
      <div class="brand-text">
        <span class="brand-name">Kindled Roads</span>
        <span class="brand-sub">The Lantern Compact</span>
      </div>
    </div>
  );
}

function badgeFor(id: Screen): number {
  const s = store.state;
  if (id === 'journal') return readyContracts(s).length;
  if (id === 'expeditions') return s.reports.filter((r) => r.unread).length;
  return 0;
}

export function App() {
  const st = useStore();
  const s = st.state;
  const ui = st.ui;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (st.ui.modal) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= NAV.length) {
        st.go(NAV[n - 1].id);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const rm = s.settings.reducedMotion;
    document.documentElement.dataset.motion = rm;
  }, [s.settings.reducedMotion]);

  const rank = rankOf(s.standing);
  const hands = freeHands(s);

  return (
    <div class="app">
      <a class="skip" href="#main">
        Skip to content
      </a>
      <aside class="sidebar">
        <Brand />
        <nav class="nav" aria-label="Main">
          {NAV.map((n, i) => {
            const b = badgeFor(n.id);
            return (
              <button
                type="button"
                class={`nav-btn ${ui.screen === n.id ? 'on' : ''}`}
                aria-current={ui.screen === n.id ? 'page' : undefined}
                onClick={() => st.go(n.id)}
                title={`${n.label} (${i + 1})`}
              >
                <Icon name={n.icon} size={20} />
                <span class="nav-label">{n.label}</span>
                {b > 0 && (
                  <span class="nav-badge" aria-label={`${b} new`}>
                    {b}
                  </span>
                )}
                <kbd class="nav-key" aria-hidden="true">
                  {i + 1}
                </kbd>
              </button>
            );
          })}
        </nav>
        <div class="sidebar-foot">
          <button type="button" class="nav-btn" onClick={() => st.openModal({ kind: 'settings' })}>
            <Icon name="settings" size={20} />
            <span class="nav-label">Settings &amp; save</span>
          </button>
        </div>
      </aside>

      <div class="main-col">
        <header class="topbar">
          <div class="topbar-brand">
            <Brand />
          </div>
          <div class="res-row" aria-label="Resources">
            <span class="res">
              <Icon name="mark" size={18} />
              <Term k="marks">
                <b>{formatNumber(s.marks)}</b> <span class="res-label">marks</span>
              </Term>
            </span>
            <span class="res">
              <Icon name="standing" size={18} />
              <Term k="standing" text={`${RANKS[rank].name}: ${RANKS[rank].perk} ${rank < RANKS.length - 1 ? `Next rank at ${RANKS[rank + 1].standing} standing.` : 'Highest rank.'}`}>
                <b>{s.standing}</b> <span class="res-label">{RANKS[rank].name}</span>
              </Term>
            </span>
            <span class={`res ${hands === 0 ? 'res-warn' : ''}`}>
              <Icon name="hand" size={18} />
              <Term k="hands">
                <b>
                  {hands}/{totalHands(s)}
                </b>{' '}
                <span class="res-label">hands free</span>
              </Term>
            </span>
          </div>
          <button type="button" class="icon-btn topbar-settings" aria-label="Settings and save" onClick={() => st.openModal({ kind: 'settings' })}>
            <Icon name="settings" />
          </button>
        </header>

        <div class="content-wrap">
          <main id="main" class="content" tabIndex={-1}>
            {ui.screen === 'overview' && <Overview />}
            {ui.screen === 'expeditions' && <Expeditions />}
            {ui.screen === 'party' && <Party />}
            {ui.screen === 'skills' && <Skills />}
            {ui.screen === 'workshop' && <Workshop />}
            {ui.screen === 'camp' && <Camp />}
            {ui.screen === 'journal' && <Journal />}
          </main>
          <ActivityRail />
        </div>
      </div>

      <nav class="tabbar" aria-label="Main">
        {NAV.map((n) => {
          const b = badgeFor(n.id);
          return (
            <button type="button" class={`tab-btn ${ui.screen === n.id ? 'on' : ''}`} aria-current={ui.screen === n.id ? 'page' : undefined} onClick={() => st.go(n.id)}>
              <Icon name={n.icon} size={20} />
              <span>{n.label}</span>
              {b > 0 && <span class="nav-badge">{b}</span>}
            </button>
          );
        })}
      </nav>

      <Toasts />
      <ModalHost />
      {st.dormant && (
        <div class="dormant" role="alertdialog" aria-modal="true" aria-labelledby="dormant-title">
          <div class="dormant-card">
            <Icon name="lantern" size={36} />
            <h2 id="dormant-title">The ledger is open elsewhere</h2>
            <p>Kindled Roads was opened in another tab or window. This tab has stopped so the two can't overwrite each other's progress.</p>
            <button type="button" class="btn btn-primary btn-md" onClick={() => st.claimTab()}>
              Play in this tab
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
