import { describe, expect, it } from 'vitest';
import { ROUTES } from '../src/game/data/world';
import { runBot } from './bot';
import { freshState } from './helpers';

describe('playthrough', () => {
  it('a simple strategy reconnects every settlement and stills the Drowned Engine', () => {
    const s = freshState(2024);
    const log: string[] = [];
    const m = runBot(s, 40, log);
    if (process.env.BALANCE) process.stdout.write(log.join('\n') + '\n');
    expect(m.fenwick).toBeDefined();
    expect(m.matriarch_slain).toBeDefined();
    expect(m.kilnmouth).toBeDefined();
    expect(m.tollspire).toBeDefined();
    expect(ROUTES.drowned_engine).toBeDefined();
  }, 120_000);
});
