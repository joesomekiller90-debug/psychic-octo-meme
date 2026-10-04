// Automatic combat. Each combatant acts on its own timer (faster units act more
// often). The fight is fully determined by the seed, the party and the tactics.
import { ENEMIES } from '../data/enemies';
import { HEROES } from '../data/heroes';
import { ITEMS } from '../data/items';
import type { EnemyTrait, HeroRole, Row } from '../types';
import { Rng } from './rng';
import type { HeroCombatStats } from './rules';
import type { CombatLine, FightRecord, Tactics } from './state';

export interface CombatHero {
  id: string;
  hp: number;
  stats: HeroCombatStats;
  row: Row;
}

export interface CombatOptions {
  heroes: CombatHero[];
  enemies: string[];
  tactics: Tactics;
  /** Packed supplies; consumed in place. */
  supplies: Record<string, number>;
  /** Tally of supplies used; updated in place. */
  used: Record<string, number>;
  light: boolean;
  forcedAmbush: boolean;
  finale: boolean;
  seed: number;
  title: string;
}

export interface CombatOutcome {
  result: 'victory' | 'fled' | 'defeat';
  hp: Record<string, number>;
  kills: Record<string, number>;
  record: FightRecord;
  damageTaken: number;
}

interface Unit {
  uid: number;
  side: 'hero' | 'enemy';
  id: string;
  name: string;
  max: number;
  hp: number;
  might: number;
  guard: number;
  speed: number;
  row: Row;
  ranged: boolean;
  pierce: number;
  mending: number;
  shock: number;
  role?: HeroRole;
  traits: EnemyTrait[];
  boss: boolean;
  next: number;
  acts: number;
  poison: number;
  poisonDmg: number;
  slow: number;
  stunned: boolean;
  bulwark: number;
  barrier: number;
  marked: boolean;
  enraged: boolean;
  summoned: boolean;
  overcharged: boolean;
  firstStrike: boolean;
  counted: boolean;
}

const MAX_ACTIONS = 450;
const MAX_LINES = 140;

export function runCombat(opts: CombatOptions): CombatOutcome {
  const rng = new Rng(opts.seed);
  const lines: CombatLine[] = [];
  const log = (k: CombatLine['k'], t: string) => {
    if (lines.length < MAX_LINES) lines.push({ k, t });
    else if (lines.length === MAX_LINES) lines.push({ k: 'info', t: '…the fighting goes on…' });
  };
  let uid = 0;
  const units: Unit[] = [];

  for (const h of opts.heroes) {
    const def = HEROES[h.id];
    units.push({
      uid: uid++, side: 'hero', id: h.id, name: def.name.split(' ')[0],
      max: h.stats.vigor, hp: Math.max(0, h.hp), might: h.stats.might, guard: h.stats.guard, speed: h.stats.speed,
      row: h.row, ranged: h.stats.ranged, pierce: h.stats.pierce, mending: h.stats.mending, shock: h.stats.shock,
      role: def.role, traits: [], boss: false, next: 0, acts: 0, poison: 0, poisonDmg: 0, slow: 0, stunned: false,
      bulwark: 0, barrier: 0, marked: false, enraged: false, summoned: false, overcharged: false, firstStrike: false, counted: false,
    });
  }

  const nameCounts: Record<string, number> = {};
  for (const e of opts.enemies) nameCounts[e] = (nameCounts[e] ?? 0) + 1;
  const nameSeen: Record<string, number> = {};
  const letters = 'ABCDEFGH';
  const addEnemy = (id: string, at: number, summoned: boolean) => {
    const def = ENEMIES[id];
    let name = def.name;
    if (summoned) name = `${def.name} (summoned)`;
    else if (nameCounts[id] > 1) {
      nameSeen[id] = (nameSeen[id] ?? 0) + 1;
      name = `${def.name} ${letters[nameSeen[id] - 1]}`;
    }
    const u: Unit = {
      uid: uid++, side: 'enemy', id, name, max: def.hp, hp: def.hp, might: def.might, guard: def.guard, speed: def.speed,
      row: 'front', ranged: def.traits.includes('ranged') || def.traits.includes('flying'), pierce: 0, mending: 0, shock: 0,
      traits: def.traits, boss: !!def.boss, next: at, acts: 0, poison: 0, poisonDmg: 0, slow: 0, stunned: false,
      bulwark: 0, barrier: 0, marked: false, enraged: false, summoned, overcharged: false, firstStrike: false, counted: false,
    };
    units.push(u);
    return u;
  };
  for (const id of opts.enemies) addEnemy(id, 0, false);

  const interval = (u: Unit) => {
    let s = u.speed;
    if (u.slow > 0) s *= 0.7;
    if (u.overcharged) s *= 1.5;
    return 1000 / Math.max(1, s);
  };

  // Opening timers, ambushes.
  const heroesAll = () => units.filter((u) => u.side === 'hero');
  const enemiesAll = () => units.filter((u) => u.side === 'enemy');
  for (const u of units) u.next = interval(u) * (0.55 + rng.next() * 0.45);
  for (const e of enemiesAll()) {
    const ambusher = e.traits.includes('ambush') || opts.forcedAmbush;
    if (ambusher) {
      if (opts.light) {
        if (e.traits.includes('ambush')) log('info', `Lantern-light catches ${e.name} before it can strike from hiding.`);
      } else {
        e.firstStrike = true;
        e.next = rng.next() * 20;
      }
    }
  }
  if (opts.forcedAmbush && opts.light) log('info', 'The mist is thick, but the party’s light keeps them from being surprised.');

  const alive = (side: 'hero' | 'enemy') => units.filter((u) => u.side === side && u.hp > 0);
  const kills: Record<string, number> = {};
  let damageTaken = 0;
  const startHeroHp = heroesAll().reduce((s, u) => s + u.hp, 0);

  const useSupply = (id: string) => {
    opts.supplies[id] = (opts.supplies[id] ?? 0) - 1;
    opts.used[id] = (opts.used[id] ?? 0) + 1;
  };

  // Opening volley of fire flasks.
  const flaskOk = opts.tactics.flasks === 'always' || (opts.tactics.flasks === 'finale' && opts.finale);
  if (flaskOk && (opts.supplies.fire_flask ?? 0) > 0) {
    useSupply('fire_flask');
    const dmg = ITEMS.fire_flask.supply?.damage ?? 14;
    for (const e of alive('enemy')) {
      e.hp -= dmg;
    }
    log('hit', `The party opens with a Fire Flask: ${dmg} damage to every enemy.`);
    for (const e of enemiesAll()) if (e.hp <= 0) onEnemyDown(e);
  }

  function onEnemyDown(e: Unit) {
    if (e.hp > 0 || e.counted) return;
    e.counted = true;
    e.hp = 0;
    kills[e.id] = (kills[e.id] ?? 0) + 1;
    log('down', `${e.name} falls.`);
    for (const o of alive('enemy')) {
      if (o.traits.includes('frenzy')) {
        o.might += 2;
      }
    }
    if (alive('enemy').some((o) => o.traits.includes('frenzy'))) log('enemy', 'The pack howls and grows frenzied (+2 Might).');
  }

  function checkThresholds(e: Unit, now: number) {
    if (e.hp <= 0 || e.hp > e.max / 2) return;
    if (e.traits.includes('enrage') && !e.enraged) {
      e.enraged = true;
      log('enemy', `${e.name} is enraged! (+50% Might)`);
    }
    if (e.traits.includes('summon') && !e.summoned) {
      e.summoned = true;
      const sid = ENEMIES[e.id].summon ?? 'bramble_wisp';
      addEnemy(sid, now + 200, true);
      addEnemy(sid, now + 260, true);
      log('enemy', `${e.name} calls her brood: two ${ENEMIES[sid].name}s join the fight.`);
    }
  }

  let lastAbsorbed = 0;
  const absorbNote = () => (lastAbsorbed > 0 ? ` (${lastAbsorbed} absorbed by its ward)` : '');

  function strike(att: Unit, tgt: Unit, mult: number, o: { pierceFrac?: number; ability?: boolean } = {}): number | null {
    if (tgt.traits.includes('flying') && !att.ranged && !o.ability) {
      if (rng.chance(0.4)) return null;
    }
    if (tgt.role === 'scout' && rng.chance(0.2)) return null;
    let raw = att.might * mult * (0.85 + rng.next() * 0.3);
    if (att.side === 'hero' && att.row === 'back' && !att.ranged && !o.ability) raw *= 0.7;
    if (att.role === 'sapper' && tgt.traits.includes('armored')) raw *= 1.25;
    if (tgt.marked) raw *= 1.25;
    if (att.enraged) raw *= 1.5;
    if (att.firstStrike) {
      raw *= 2;
      att.firstStrike = false;
    }
    let guard = tgt.guard * (tgt.bulwark > 0 ? 2 : 1);
    guard = Math.max(0, guard - att.pierce);
    if (o.pierceFrac) guard *= 1 - o.pierceFrac;
    let dmg = Math.max(Math.ceil(raw * 0.3), Math.round(raw - guard));
    lastAbsorbed = 0;
    if (tgt.barrier > 0) {
      const absorbed = Math.min(tgt.barrier, dmg);
      tgt.barrier -= absorbed;
      dmg -= absorbed;
      lastAbsorbed = absorbed;
    }
    tgt.hp -= dmg;
    if (tgt.side === 'hero') damageTaken += dmg;
    if (dmg > 0 && att.shock > 0 && tgt.hp > 0 && rng.chance(att.shock / 100)) {
      tgt.stunned = true;
    }
    return dmg;
  }

  function heroTarget(): Unit | undefined {
    const foes = alive('enemy');
    if (foes.length === 0) return undefined;
    const focus = opts.tactics.focus;
    const sorted = [...foes];
    if (focus === 'weakest') sorted.sort((a, b) => a.hp - b.hp || a.uid - b.uid);
    else if (focus === 'strongest') sorted.sort((a, b) => b.hp - a.hp || a.uid - b.uid);
    else {
      const threat = (e: Unit) =>
        (e.traits.includes('lull') ? 4 : 0) +
        (e.traits.includes('spore') ? 3 : 0) +
        (e.traits.includes('dive') ? 2 : 0) +
        (e.traits.includes('ranged') ? 1 : 0) +
        (e.summoned ? 1 : 0);
      sorted.sort((a, b) => threat(b) - threat(a) || a.hp - b.hp || a.uid - b.uid);
    }
    return sorted[0];
  }

  function enemyTarget(mode: 'melee' | 'ranged' | 'back'): Unit | undefined {
    const hs = alive('hero');
    if (hs.length === 0) return undefined;
    const taunter = hs.find((h) => h.bulwark > 0);
    if (taunter) return taunter;
    const back = hs.filter((h) => h.row === 'back');
    const front = hs.filter((h) => h.row === 'front');
    if (mode === 'back' && back.length) return rng.pick(back);
    if (mode === 'ranged') {
      if (back.length && rng.chance(0.65)) return rng.pick(back);
      return rng.pick(hs);
    }
    if (front.length) {
      const weighted = front.map((h) => ({ h, weight: h.role === 'defender' ? 2 : 1 }));
      return rng.weighted(weighted).h;
    }
    return rng.pick(hs);
  }

  function afterHeroHit(tgt: Unit) {
    if (tgt.bulwark > 0) tgt.bulwark--;
    if (tgt.hp <= 0) {
      tgt.hp = 0;
      tgt.poison = 0;
      log('down', `${tgt.name} is down!`);
    }
  }

  function heroAct(u: Unit, now: number) {
    if (u.stunned) {
      u.stunned = false;
      if ((opts.supplies.steadying_draught ?? 0) > 0) {
        useSupply('steadying_draught');
        log('status', `${u.name} downs a Steadying Draught and shakes off the daze.`);
      } else {
        log('status', `${u.name} is dazed and loses a turn.`);
        return;
      }
    }
    if (u.poison > 0) {
      u.hp -= u.poisonDmg;
      damageTaken += u.poisonDmg;
      u.poison--;
      if (u.hp <= 0) {
        log('down', `${u.name} succumbs to poison and is down!`);
        u.hp = 0;
        return;
      }
    }
    // Tonics
    if (u.hp / u.max < opts.tactics.tonicAt) {
      const missing = u.max - u.hp;
      const hasG = (opts.supplies.greater_tonic ?? 0) > 0;
      const hasM = (opts.supplies.mending_tonic ?? 0) > 0;
      let pick: string | null = null;
      if (hasG && (missing >= u.max * 0.5 || !hasM)) pick = 'greater_tonic';
      else if (hasM) pick = 'mending_tonic';
      if (pick) {
        useSupply(pick);
        const heal = Math.min(missing, Math.round(u.max * (ITEMS[pick].supply?.power ?? 0.35)));
        u.hp += heal;
        log('heal', `${u.name} drinks a ${ITEMS[pick].name}: +${heal}.`);
        return;
      }
    }
    const third = u.acts % 3 === 2;
    switch (u.role) {
      case 'support': {
        const hurt = alive('hero')
          .filter((h) => h.hp / h.max < 0.65)
          .sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
        if (hurt) {
          const amt = Math.min(hurt.max - hurt.hp, Math.round(8 + 1.0 * u.might + u.mending));
          hurt.hp += amt;
          const cured = hurt.poison > 0;
          hurt.poison = 0;
          log('heal', `${u.name} mends ${hurt === u ? 'herself' : hurt.name}: +${amt}${cured ? ', poison cured' : ''}.`);
          return;
        }
        break;
      }
      case 'defender':
        if (third) {
          u.bulwark = 2;
          log('status', `${u.name} braces his shield: Guard doubled, enemies must strike him.`);
          return;
        }
        break;
      case 'striker':
        if (third) {
          const t = heroTarget();
          if (!t) return;
          const d = strike(u, t, 1.75);
          if (d === null) log('hit', `${u.name}’s pinning shot misses ${t.name}.`);
          else {
            t.slow = 1;
            log('hit', `${u.name} looses a pinning shot at ${t.name}: ${d} damage${absorbNote()}, slowed.`);
            if (t.hp <= 0) onEnemyDown(t);
            else checkThresholds(t, now);
          }
          return;
        }
        break;
      case 'sapper':
        if (third) {
          const foes = alive('enemy');
          const parts: string[] = [];
          for (const t of foes) {
            const d = strike(u, t, 0.85, { pierceFrac: 0.5, ability: true });
            if (d !== null) parts.push(`${d}`);
          }
          log('hit', `${u.name} hurls a Blast Charge: ${parts.join(', ')} damage across ${foes.length} ${foes.length === 1 ? 'foe' : 'foes'}.`);
          for (const t of foes) {
            if (t.hp <= 0) onEnemyDown(t);
            else checkThresholds(t, now);
          }
          return;
        }
        break;
      case 'scout':
        if (third) {
          const t = alive('enemy')
            .filter((e) => !e.marked)
            .sort((a, b) => b.hp - a.hp)[0];
          if (t) {
            t.marked = true;
            log('status', `${u.name} exposes ${t.name}’s weak spot: it takes 25% more damage.`);
            return;
          }
        }
        break;
    }
    const t = heroTarget();
    if (!t) return;
    const d = strike(u, t, 1);
    if (d === null) {
      log('hit', `${u.name} misses ${t.name}${t.traits.includes('flying') ? ' (flying)' : ''}.`);
      return;
    }
    const stunned = t.stunned && t.hp > 0 ? ', staggered' : '';
    log('hit', `${u.name} hits ${t.name} for ${d}${absorbNote()}${stunned}.`);
    if (t.hp <= 0) onEnemyDown(t);
    else checkThresholds(t, now);
  }

  function enemyAct(e: Unit) {
    if (e.stunned) {
      e.stunned = false;
      log('status', `${e.name} is staggered and loses its action.`);
      return;
    }
    if (e.slow > 0) e.slow--;
    if (e.traits.includes('overcharge') && !e.overcharged && e.hp <= e.max / 3) {
      e.overcharged = true;
      log('enemy', `${e.name} overcharges, pistons screaming! (acts 50% more often)`);
    }
    const k = e.acts;
    if (e.traits.includes('shield') && k % 3 === 2) {
      const ward = Math.round(e.might);
      e.barrier += ward;
      log('enemy', `${e.name} raises a tide ward (absorbs ${ward}).`);
      return;
    }
    if (e.traits.includes('vent') && k % 4 === 3) {
      const parts: string[] = [];
      for (const h of alive('hero')) {
        const d = strike(e, h, 0.7, { ability: true });
        if (d !== null) parts.push(`${h.name} ${d}`);
        afterHeroHit(h);
      }
      log('enemy', `${e.name} vents scalding steam over the party: ${parts.join(', ')}.`);
      return;
    }
    if (e.traits.includes('lull') && k % 3 === 2) {
      const cands = alive('hero').filter((h) => !h.stunned);
      if (cands.length) {
        const t = rng.pick(cands);
        t.stunned = true;
        log('enemy', `${e.name} sings; ${t.name} grows heavy-eyed (will lose a turn).`);
        return;
      }
    }
    if (e.traits.includes('spore') && k % 2 === 1) {
      const t = enemyTarget('ranged');
      if (!t) return;
      if ((opts.supplies.antidote ?? 0) > 0) {
        useSupply('antidote');
        log('heal', `${e.name} puffs spores at ${t.name}; an antidote neutralises them.`);
      } else {
        t.poison = 3;
        t.poisonDmg = 2 + Math.floor(e.might / 4);
        log('enemy', `${e.name} poisons ${t.name} (${t.poisonDmg} per action for 3 actions).`);
      }
      return;
    }
    let mult = 1;
    let verb = 'strikes';
    let mode: 'melee' | 'ranged' | 'back' = e.ranged ? 'ranged' : 'melee';
    if (e.traits.includes('dive')) {
      mode = 'back';
      verb = 'dives at';
    }
    if (e.traits.includes('charge')) {
      if (k % 3 === 1) {
        log('enemy', `${e.name} lowers its head and paws the ground…`);
        return;
      }
      if (k % 3 === 2) {
        mult = 2.2;
        verb = 'charges';
      }
    }
    if (e.firstStrike) {
      mode = 'back';
      verb = 'strikes from ambush at';
    }
    const t = enemyTarget(mode);
    if (!t) return;
    const d = strike(e, t, mult);
    if (d === null) {
      log('info', `${t.name} sidesteps ${e.name}.`);
      return;
    }
    const stunNote = t.stunned && t.hp > 0 && e.shock > 0 ? ' (staggered)' : '';
    log(verb === 'strikes' ? 'enemy' : 'enemy', `${e.name} ${verb} ${t.name}: ${d} damage${stunNote}.`);
    afterHeroHit(t);
  }

  // --- Main loop -------------------------------------------------------------
  let actions = 0;
  let result: CombatOutcome['result'] = 'victory';
  const totalMax = heroesAll().reduce((s, u) => s + u.max, 0);
  while (true) {
    if (alive('enemy').length === 0) {
      result = 'victory';
      break;
    }
    if (alive('hero').length === 0) {
      result = 'defeat';
      break;
    }
    const partyFrac = alive('hero').reduce((s, u) => s + u.hp, 0) / totalMax;
    if (partyFrac < opts.tactics.retreatAt) {
      result = 'fled';
      log('result', `With the party below ${Math.round(opts.tactics.retreatAt * 100)}% health, Brannoc’s horn sounds the retreat.`);
      break;
    }
    if (actions >= MAX_ACTIONS) {
      result = 'fled';
      log('result', 'The fight grinds on with no end in sight; the party breaks off.');
      break;
    }
    let u: Unit | undefined;
    for (const c of units) {
      if (c.hp <= 0) continue;
      if (!u || c.next < u.next || (c.next === u.next && (c.side === 'hero' ? 0 : 1) < (u.side === 'hero' ? 0 : 1))) u = c;
    }
    if (!u) break;
    const now = u.next;
    if (u.side === 'hero') heroAct(u, now);
    else enemyAct(u);
    if (u.side === 'hero' && u.slow > 0) u.slow--;
    u.acts++;
    u.next = now + interval(u);
    actions++;
  }

  const supportUp = alive('hero').some((h) => h.role === 'support');
  if (result === 'victory') {
    if (supportUp) {
      for (const h of heroesAll()) {
        if (h.hp <= 0) h.hp = Math.max(1, Math.round(h.max * 0.1));
        else h.hp = Math.min(h.max, h.hp + Math.round(h.max * 0.08));
      }
    } else {
      for (const h of heroesAll()) if (h.hp <= 0) h.hp = 1;
    }
  } else {
    for (const h of heroesAll()) if (h.hp <= 0) h.hp = 1;
  }
  for (const h of heroesAll()) h.poison = 0;

  const foes = opts.enemies.length + units.filter((u) => u.summoned && u.side === 'enemy').length;
  const exchanges = Math.ceil(actions / Math.max(1, units.length / 2));
  const endHp = heroesAll().reduce((s, u) => s + u.hp, 0);
  const usedHere = lines.filter((l) => l.k === 'heal' && l.t.includes('drinks')).length;
  const resultWord = result === 'victory' ? 'Victory' : result === 'fled' ? 'Retreat' : 'Defeat';
  const hpList = heroesAll().map((h) => `${h.name} ${Math.round(h.hp)}/${h.max}`).join(', ');
  log('result', `${resultWord}. ${hpList}.`);
  const summary = `${resultWord} against ${foes} ${foes === 1 ? 'foe' : 'foes'} in ${exchanges} exchanges · ${Math.max(0, Math.round(startHeroHp - endHp + 0))} net health lost${usedHere ? ` · ${usedHere} tonic${usedHere > 1 ? 's' : ''}` : ''}${supportUp && result === 'victory' ? ' · field dressing applied' : ''}`;

  const hp: Record<string, number> = {};
  for (const h of heroesAll()) hp[h.id] = Math.max(1, Math.round(h.hp));
  return {
    result,
    hp,
    kills,
    damageTaken,
    record: { title: opts.title, enemies: [...opts.enemies], result: result === 'victory' ? 'victory' : result === 'fled' ? 'fled' : 'defeat', summary, lines },
  };
}
