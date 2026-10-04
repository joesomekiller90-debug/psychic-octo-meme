// The guided first session. Steps complete themselves as soon as their goal
// is met, so players who explore ahead are never blocked.
import type { GameState } from './state';

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  /** Screen the "Show me" button opens. */
  screen: 'overview' | 'expeditions' | 'party' | 'skills' | 'workshop' | 'camp' | 'journal';
  done: (s: GameState) => boolean;
}

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'dispatch',
    title: 'Send out your first expedition',
    text: 'Open Expeditions. The Wildroot Trail is already planned: rations and tonics packed, one porter. Press "Dispatch" and the party sets off. It takes under a minute.',
    screen: 'expeditions',
    done: (s) => !!s.expedition || (s.stats.routeRuns.wildroot_trail ?? 0) > 0,
  },
  {
    id: 'work',
    title: 'Put your idle hands to work',
    text: 'You have spare camp hands. In Skills, start a work order such as "Pick Fenberries" or "Quarry Rustrock". Work orders keep running while you are away.',
    screen: 'skills',
    done: (s) => s.stats.ordersStarted > 0,
  },
  {
    id: 'report',
    title: 'Read the journey report',
    text: 'When the party returns, open the report from Expeditions or the Overview. It shows each leg: hazards, fights, finds and discoveries.',
    screen: 'expeditions',
    done: (s) => s.reports.some((r) => !r.unread),
  },
  {
    id: 'claim',
    title: 'Claim a contract',
    text: 'Contracts are listed in the Journal. "First Light on the Trail" is finished once you have walked the Wildroot Trail. Claim it for marks and tonics.',
    screen: 'journal',
    done: (s) => Object.values(s.contracts).some((c) => c.status === 'done'),
  },
  {
    id: 'craft',
    title: 'Craft something useful',
    text: 'In the Workshop, forge a Rustrock Hatchet for Brannoc (+5 Might) or brew Mending Tonics. Crafting runs as a work order and uses a camp hand.',
    screen: 'workshop',
    done: (s) => s.stats.totalCrafted > 0,
  },
  {
    id: 'ferry',
    title: 'Relight the Ferry waystone',
    text: 'The Ferryman’s Waymark revealed the Old Ferry Road. It is harder: craft gear, pack antidotes or a lantern, then relight the waystone to reconnect Fenwick Stile.',
    screen: 'expeditions',
    done: (s) => !!s.flags.fenwick,
  },
  {
    id: 'build',
    title: 'Improve the camp',
    text: 'In Camp, build an upgrade such as the Bunkhouse (one more camp hand) or the Storehouse. Construction is a work order too.',
    screen: 'camp',
    done: (s) => Object.values(s.upgrades).some((v) => v > 0),
  },
];

/** Index of the first unfinished step, or TUTORIAL.length when done. */
export function tutorialStep(state: GameState): number {
  for (let i = 0; i < TUTORIAL.length; i++) if (!TUTORIAL[i].done(state)) return i;
  return TUTORIAL.length;
}

export function refreshTutorial(state: GameState): boolean {
  const step = tutorialStep(state);
  if (step !== state.tutorial.step) {
    state.tutorial.step = step;
    return true;
  }
  return false;
}
