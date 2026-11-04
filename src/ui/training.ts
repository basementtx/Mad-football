/** Training: pick free practice with the whole team or one player against the keeper. */
import { t } from '../engine/i18n';
import { audio } from '../engine/audio';
import { profile, clubTeamDef, lineupCards, cardById } from '../meta/profile';
import { TEAMS } from '../game/teams';
import { setScreen, bind, paintTag, spriteSource, lookFor, MenuHandlers } from './common';
import { showHub } from './hub';

let pick: 'team' | 'keeper' = 'keeper';

export function showTraining(h: MenuHandlers) {
  const L = t();
  const club = clubTeamDef()!;
  const me = cardById(profile.myPlayer) ?? lineupCards().find((c) => c && c.pos !== 'GK') ?? null;
  const myLook = me?.look ?? { skin: '#e5b48f', hair: '#3b2416', hairStyle: 0, beard: false };
  const squad = lineupCards().filter((c) => c && c.pos !== 'GK').slice(0, 3);
  const keeperKit = TEAMS[(club.name.length + 2) % TEAMS.length];
  const render = () => {
    setScreen(
      'screen-training',
      `<div class="training">
        <div class="panel-head">
          <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
          <div class="panel-title">${L.training}</div>
          <div style="width:80px"></div>
        </div>
        <div class="tr-modes">
          <button class="tr-card ${pick === 'team' ? 'on' : ''}" data-mode="team">
            <div class="tr-art">${squad.map((c, i) => paintTag(spriteSource(lookFor(club, c!.look), i % 2 ? 'run1' : 'idle0', i === 2), 'tr-spr')).join('')}</div>
            <b>${L.trainTeam}</b>
            <p>${L.trainTeamDesc}</p>
          </button>
          <button class="tr-card ${pick === 'keeper' ? 'on' : ''}" data-mode="keeper">
            <div class="tr-art">${paintTag(spriteSource(lookFor(club, myLook), 'kick1'), 'tr-spr')}<span class="tr-vs">VS</span>${paintTag(spriteSource(lookFor(keeperKit, { skin: '#c98d63', hair: '#1a1310', hairStyle: 1, beard: true }, true), 'dive', true), 'tr-spr')}</div>
            <b>${L.trainKeeper}</b>
            <p>${L.trainKeeperDesc}</p>
          </button>
        </div>
        <button class="btn btn-primary btn-start" data-act="go">${L.start} ▶</button>
      </div>`,
    );
    bind('[data-act=back]', () => { audio.click(); showHub(h); });
    bind('[data-mode]', (el) => { pick = el.dataset.mode as 'team' | 'keeper'; audio.click(); render(); });
    bind('[data-act=go]', () => { audio.select(); h.startTraining(pick); });
  };
  render();
}
