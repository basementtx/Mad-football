/** Club facilities screen: a stadium that grows with its level, and five upgradeable buildings. */
import { settings } from '../engine/storage';
import { audio, vibrate } from '../engine/audio';
import { FACILITIES, FAC_MAX, FacId, facLevel, upgradeCost, upgradeFacility, effectText, academyReadyIn, claimAcademy, stadiumSeats } from '../meta/facilities';
import { clubTeamDef } from '../meta/profile';
import { setScreen, bind, esc, coinTag, coinsPill, crestTag, toast, paintAll, MenuHandlers } from './common';
import { cardHTML } from './cards';

const tr = () => settings.lang === 'tr';
const L2 = (en: string, trs: string) => (tr() ? trs : en);
const tl = (o: { tr: string; en: string }) => (tr() ? o.tr : o.en);
const fmt = (n: number) => n.toLocaleString(tr() ? 'tr-TR' : 'en-US');

function hhmm(ms: number) {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}${L2('h', 's')} ${m}${L2('m', 'dk')}` : `${m}${L2('m', 'dk')} ${s % 60}${L2('s', 'sn')}`;
}

/** Side-on stadium: more stands, then floodlights, big screen and a roof as it levels up. */
function stadiumArt(lv: number) {
  const club = clubTeamDef();
  const c1 = club?.primary ?? '#2f7bff', c2 = club?.secondary ?? '#ffffff';
  return `<div class="fc-stad lv${lv}" style="--c1:${c1};--c2:${c2}">
    <div class="fc-sky"></div>
    ${lv >= 5 ? '<div class="fc-roof"></div>' : ''}
    ${lv >= 3 ? '<i class="fc-light l1"></i><i class="fc-light l2"></i><i class="fc-light l3"></i><i class="fc-light l4"></i>' : ''}
    ${lv >= 4 ? '<div class="fc-screen"><b>MAD</b></div>' : ''}
    <div class="fc-stand back" style="--tiers:${Math.min(4, lv)}"><span class="fc-crowd"></span></div>
    <div class="fc-pitch"><span class="fc-mid"></span><span class="fc-circ"></span><span class="fc-goal g1"></span><span class="fc-goal g2"></span></div>
    <div class="fc-stand front" style="--tiers:${Math.max(1, lv - 1)}"><span class="fc-crowd"></span></div>
    <div class="fc-flags">${Array.from({ length: lv + 1 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
  </div>`;
}

export function showFacilities(h: MenuHandlers, back: () => void) {
  let timer = 0;
  const render = () => {
    clearInterval(timer);
    const club = clubTeamDef();
    const slv = facLevel('stadium');
    const ready = academyReadyIn();
    setScreen(
      'screen-facilities',
      `<div class="facilities">
        <div class="panel-head">
          <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L2('BACK', 'GERİ')}</button>
          <div class="panel-title">${L2('FACILITIES', 'TESİSLER')}</div>
          ${coinsPill()}
        </div>
        <div class="fc-body">
          <div class="fc-hero">
            ${stadiumArt(slv)}
            <div class="fc-hero-cap">${club ? crestTag(club, 'crest-sm') : ''}<b>${esc(club?.name ?? '')} ${L2('Arena', 'Arena')}</b><small>${fmt(stadiumSeats(slv))} ${L2('seats', 'koltuk')} · ${L2('level', 'seviye')} ${slv}/${FAC_MAX}</small></div>
          </div>
          <div class="fc-grid">
            ${FACILITIES.map((f) => {
              const lv = facLevel(f.id);
              const max = lv >= FAC_MAX;
              const cost = upgradeCost(f.id);
              return `<div class="fc-card f-${f.id} ${max ? 'max' : ''}">
                <div class="fc-top"><span class="fc-ic">${f.icon}</span><div class="fc-name"><b>${esc(tl(f.name))}</b><small>${esc(tl(f.effect))}</small></div></div>
                <div class="fc-pips">${Array.from({ length: FAC_MAX }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>
                <div class="fc-eff"><span>${effectText(f.id, lv, tr())}</span>${max ? '' : `<em>▶</em><b>${effectText(f.id, lv + 1, tr())}</b>`}</div>
                ${f.id === 'academy' ? `<button class="btn btn-sm fc-claim ${ready ? '' : 'ready'}" data-act="claim" ${ready ? 'disabled' : ''}>${ready ? `🎓 <span id="fc-acad">${hhmm(ready)}</span>` : L2('🎓 SIGN THE GRADUATE', '🎓 MEZUNU AL')}</button>` : ''}
                <button class="btn ${max ? 'btn-ghost' : 'btn-primary'} btn-sm fc-up" data-up="${f.id}" ${max ? 'disabled' : ''}>${max ? L2('MAX LEVEL', 'MAKS. SEVİYE') : `${L2('UPGRADE', 'GELİŞTİR')} · ${coinTag()} ${fmt(cost)}`}</button>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>`,
    );
    bind('[data-act=back]', () => { clearInterval(timer); audio.click(); back(); });
    bind('[data-up]', (b) => {
      const id = b.dataset.up as FacId;
      if (!upgradeFacility(id)) { toast(L2('Not enough coins', 'Yeterli altın yok')); audio.groan(); return; }
      audio.horn();
      audio.cheer(0.4);
      vibrate([30, 30, 60]);
      render();
      const card = document.querySelector<HTMLElement>(`.fc-card.f-${id}`);
      card?.classList.add('upgraded');
      if (id === 'stadium') document.querySelector('.fc-stad')?.classList.add('grow');
    });
    bind('[data-act=claim]', () => {
      const c = claimAcademy();
      if (!c) { toast(L2('Squad is full (20)', 'Kadro dolu (20)')); return; }
      audio.horn();
      vibrate(40);
      render();
      // show the new boy
      const pop = document.createElement('div');
      pop.className = 'fc-grad';
      pop.innerHTML = `<div class="fc-grad-in"><small>${L2('ACADEMY GRADUATE', 'AKADEMİ MEZUNU')}</small>${cardHTML(c, { club, size: 'lg', badge: L2('NEW!', 'YENİ!') })}<button class="btn btn-primary" data-act="ok">${L2('WELCOME!', 'HOŞ GELDİN!')}</button></div>`;
      document.getElementById('ui')!.appendChild(pop);
      paintAll(pop);
      pop.querySelector('[data-act=ok]')!.addEventListener('click', (e) => { e.stopPropagation(); audio.click(); pop.remove(); });
    });
    timer = window.setInterval(() => {
      const el = document.getElementById('fc-acad');
      if (!el) { clearInterval(timer); return; }
      const left = academyReadyIn();
      if (left <= 0) render();
      else el.textContent = hhmm(left);
    }, 1000);
  };
  render();
  void h;
}
