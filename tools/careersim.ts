// Headless career run: sims many seasons with random choices and checks the world stays sane.
import { newCareer, trialOffers, signFirstContract, simUserMatch, applyUserMatch, finishWeek, userFixture, prepareWeek, retire, legacyScore, legacyTier } from '../src/career/season';
import { setCareer } from '../src/career/state';
import { train, takePerk, PERKS, buyLife, marketValue } from '../src/career/me';
import { resolveDM, postOptions, publishPost } from '../src/career/media';
import { openOffers, signOffer, negotiate } from '../src/career/transfer';
import { myOvr } from '../src/career/world';
import { randomLook } from '../src/meta/cards';

const seasons = Number(process.argv[2] || 8);
const pos = (process.argv[3] || 'FWD') as any;
const c = newCareer({ me: { name: 'Test Kid', nat: 'tr', pos, foot: 'R', num: 9, personality: 'confident', backstory: 'academy', look: randomLook() }, difficulty: 'normal', duration: 180 });
setCareer(c);
trialOffers(c, 7.6);
signFirstContract(c, c.offers[0]);
let guard = 0;
const bad = (v: any) => typeof v === 'number' && !Number.isFinite(v);
while (c.season <= seasons && c.phase !== 'retired' && guard++ < 2000) {
  if (!c.ws.trained && Math.random() < 0.8) { train(c, ['finishing', 'speed', 'playmaking', 'gym'][guard % 4], 'normal'); c.ws.trained = true; }
  const f = userFixture(c);
  if (f && !f.played && (c.ws.sel === 'start' || c.ws.sel === 'sub')) {
    const r = simUserMatch(c, c.ws.sel === 'sub');
    const lm = applyUserMatch(c, r.line, { sim: true, sub: c.ws.sel === 'sub' });
    if (Math.random() < 0.5) { const o = postOptions(c, lm); publishPost(c, o[Math.floor(Math.random() * o.length)], lm); }
  }
  for (const d of c.dms) if (d.choices && !d.read) resolveDM(c, d, d.choices[Math.floor(Math.random() * d.choices.length)]);
  for (const o of openOffers(c)) { if (o.clubOk && Math.random() < 0.3) { negotiate(c, o, { wage: o.wage * 1.1, years: o.years, role: o.role, clause: o.clause }); if (o.status === 'open') signOffer(c, o); break; } }
  for (const p of PERKS) takePerk(c, p.id);
  buyLife(c, 'flat'); buyLife(c, 'hatch'); if (c.me.money > 2e6) buyLife(c, 'trainer');
  const before = c.season;
  if (process.env.DUMP && `${c.season}:${c.week}` === process.env.DUMP_AT) { (await import('node:fs')).writeFileSync(process.env.DUMP, JSON.stringify(c)); console.log('dumped', process.env.DUMP_AT); }
  finishWeek(c);
  if (c.season !== before) {
    const h = c.history[c.history.length - 1];
    console.log(`S${h.season} age ${h.age} ${c.clubs[h.club]?.name ?? '-'} (div ${h.div}) ovr ${h.ovr} apps ${h.apps} g ${h.goals} a ${h.assists} avg ${h.avg} pos ${h.leaguePos} tr [${h.trophies}] aw [${h.awards}] value ${Math.round(h.value / 1e3)}K rep ${c.me.rep.toFixed(1)} fol ${c.me.followers} money ${c.me.money} caps ${c.me.intlApps}`);
  }
  for (const k of ['fitness', 'morale', 'rep', 'followers', 'money'] as const) if (bad((c.me as any)[k])) throw new Error('NaN ' + k);
  if (c.feed.some((p) => bad(p.likes))) throw new Error('NaN likes');
}
// sanity: every past fixture played, table points consistent
const unplayed = c.fixtures.filter((f) => f.week < c.week && !f.played && c.phase === 'season');
console.log('unplayed past fixtures:', unplayed.length, 'feed', c.feed.length, 'news', c.news.length, 'dms', c.dms.length, 'moments', c.moments.length, 'size KB', Math.round(JSON.stringify(c).length / 1024));
console.log('stats', c.stats, 'ovr', myOvr(c), 'pot', c.me.pot, 'value', marketValue(c));
retire(c);
console.log('legacy', legacyScore(c), legacyTier(c), 'trophies', c.trophies.map((t) => t.name[0] + ' ' + t.season).join(', '), 'awards', c.awards.map((a) => a.name[0] + ' ' + a.season).join(', '));
