/** KICKR: the in-game social network, inbox and the sports paper. */
import type { Career, Post, DM, LastMatch } from '../../career/types';
import { esc, fmtText, crestOf, myPortrait, npcPortrait, mySprite, ratingClass, modal, closeModal, stars, paintAll, flagTag } from './kit';
import { L2, compact, isTR } from '../../career/util';
import { timeAgo, vibe, resolveDM, postOptions, publishPost, myHandle, PostOption } from '../../career/media';
import { clubName, teamDefOf } from '../../career/world';
import { saveCareer } from '../../career/state';
import { audio } from '../../engine/audio';
import { toast, crestTag } from '../common';

export type PhoneView = 'feed' | 'mentions' | 'dms' | 'news';
let view: PhoneView = 'feed';
let openThread: string | null = null;
let openPost: string | null = null;

export function setPhoneView(v: PhoneView) {
  view = v;
}

function avatar(c: Career, av: string, cls = 'kr-av', name = '') {
  if (av === 'me') return `<span class="${cls}">${myPortrait(c, 'kr-av-img')}</span>`;
  if (av.startsWith('npc:')) return `<span class="${cls}">${npcPortrait(c, av.slice(4), 'kr-av-img')}</span>`;
  if (av.startsWith('club:')) return `<span class="${cls} crest">${crestOf(c, av.slice(5), 'kr-av-crest')}</span>`;
  if (av.startsWith('nat:')) return `<span class="${cls} crest">${flagTag(av.slice(4), 'kr-av-flag')}</span>`;
  const col = av.startsWith('c:') ? av.slice(2) : '#8a94aa';
  return initialAvatar(name, col);
}

function initialAvatar(name: string, color: string) {
  const ch = (name.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '')[0] ?? '?').toUpperCase();
  return `<span class="kr-av plain" style="--c:${color}"><b>${esc(ch)}</b></span>`;
}

function media(c: Career, p: Post) {
  const m = p.media;
  if (!m) return '';
  const d = m.data;
  switch (m.kind) {
    case 'score': {
      const h = String(d.home), a = String(d.away);
      const th = teamDefOf(c, h), ta = teamDefOf(c, a);
      return `<div class="kr-m score" style="--h:${th.primary};--a:${ta.primary}">
        <small>${esc(String(d.comp ?? ''))}</small>
        <div class="kr-sc"><span>${crestOf(c, h, 'crest-md')}<b>${esc(th.short)}</b></span><strong>${d.hg} - ${d.ag}</strong><span>${crestOf(c, a, 'crest-md')}<b>${esc(ta.short)}</b></span></div>
        <em>${L2('FULL TIME', 'MAÇ SONU')}</em>
      </div>`;
    }
    case 'rating':
      return `<div class="kr-m rating"><div class="kr-rate ${ratingClass(Number(d.r))}">${d.r}</div><div>${mySprite(c, Number(d.g) > 0 ? 'cel0' : 'kick1', 'kr-pose')}</div><div class="kr-rl"><span>⚽ ${d.g}</span><span>🅰️ ${d.a}</span></div></div>`;
    case 'photo': {
      const pose = String(d.pose);
      const frame = pose === 'down' ? 'down0' : pose === 'sad' ? 'sad0' : pose === 'train' ? 'run2' : pose === 'sign' || pose === 'sponsor' ? 'cel1' : 'cel0';
      return `<div class="kr-m photo ${pose}">${mySprite(c, frame, 'kr-photo')}<i class="kr-flash"></i></div>`;
    }
    case 'transfer': {
      const club = String(d.club ?? '');
      return club && c.clubs[club] ? `<div class="kr-m transfer" style="--h:${c.clubs[club].primary}">${crestOf(c, club, 'crest-lg')}<div><small>${d.npc ? '' : L2('OFFICIAL', 'RESMİ')}</small><b>${esc(clubName(c, club))}</b><em>${esc(String(d.fee ?? ''))}</em></div></div>` : '';
    }
    case 'award':
      return `<div class="kr-m award"><span class="kr-cup">🏆</span><b>${esc(String(d.award ?? ''))}</b></div>`;
    case 'injury':
      return `<div class="kr-m injury"><span>🚑</span><b>${d.weeks} ${L2('weeks', 'hafta')}</b></div>`;
    case 'callup':
      return `<div class="kr-m callup">${flagTag(String(d.nat), 'kr-flag-big')}<b>${L2('CALLED UP', 'MİLLİ TAKIMDA')}</b></div>`;
    case 'stat':
      return `<div class="kr-m stat"><b>${esc(String(d.title ?? ''))}</b></div>`;
  }
  return '';
}

export function postHTML(c: Career, p: Post, compact_ = false) {
  const open = openPost === p.id;
  return `<article class="kr-post ${p.mine ? 'mine' : ''} ${p.tag === 'nemesis' ? 'nem' : ''} ${compact_ ? 'cmp' : ''}" data-post="${p.id}">
    ${avatar(c, p.av, 'kr-av', p.name)}
    <div class="kr-main">
      <div class="kr-head"><b>${esc(p.name)}</b>${p.verified ? '<i class="kr-ver">✓</i>' : ''}<span>@${esc(p.handle)} · ${timeAgo(c, p)}</span></div>
      <div class="kr-text">${fmtText(compact_ && p.text.length > 110 ? p.text.slice(0, 108) + '…' : p.text)}</div>
      ${compact_ ? '' : media(c, p)}
      <div class="kr-acts"><span>💬 ${compact(p.replyCount)}</span><span>🔁 ${compact(p.reposts)}</span><span class="lk">♥ ${compact(p.likes)}</span></div>
      ${!compact_ && open && p.replies.length ? `<div class="kr-replies">${p.replies.map((r) => `<div class="kr-reply">${initialAvatar(r.name, r.color ?? '#6c7480')}<div><div class="kr-head"><b>${esc(r.name)}</b>${r.verified ? '<i class="kr-ver">✓</i>' : ''}<span>@${esc(r.handle)}</span></div><div class="kr-text">${fmtText(r.text)}</div><div class="kr-acts"><span class="lk">♥ ${compact(r.likes)}</span></div></div></div>`).join('')}</div>` : ''}
      ${!compact_ && !open && p.replies.length ? `<button class="kr-more">${L2(`Show ${p.replies.length} replies`, `${p.replies.length} yanıtı göster`)}</button>` : ''}
    </div>
  </article>`;
}

function vibeMeter(c: Career) {
  const v = vibe(c);
  const label = v > 0.45 ? L2('Loved', 'Seviliyorsun') : v > 0.1 ? L2('Positive', 'Olumlu') : v > -0.15 ? L2('Mixed', 'Karışık') : v > -0.5 ? L2('Critical', 'Eleştirel') : L2('Toxic', 'Toksik');
  return `<div class="kr-vibe"><small>${L2('FAN VIBE', 'TARAFTAR HAVASI')}</small><div class="kr-vtrack"><i style="left:${50 + v * 48}%"></i></div><b>${label}</b></div>`;
}

export function phoneHTML(c: Career): string {
  const dms = c.dms.filter((d) => !d.mine && !d.read).length;
  const me = c.me;
  const nav: [PhoneView, string, string, number][] = [
    ['feed', '⌂', L2('For you', 'Sana özel'), 0],
    ['mentions', '@', L2('About you', 'Hakkında'), 0],
    ['dms', '✉', L2('Messages', 'Mesajlar'), dms],
    ['news', '▤', L2('Sport Daily', 'Spor Gazetesi'), 0],
  ];
  let main = '';
  if (view === 'feed' || view === 'mentions') {
    const name = me.name.split(' ').pop()!.toLowerCase();
    const posts = view === 'feed' ? c.feed : c.feed.filter((p) => p.text.toLowerCase().includes(name) || p.av === 'me' || p.media?.data.who === 'me');
    main = `<div class="kr-feed">${posts.length ? posts.slice(0, 60).map((p) => postHTML(c, p)).join('') : `<div class="kr-empty">${L2('Nothing here yet.', 'Henüz bir şey yok.')}</div>`}</div>`;
  } else if (view === 'dms') main = dmsHTML(c);
  else main = newsHTML(c);
  return `<div class="kr">
    <aside class="kr-side">
      <div class="kr-logo">KICKR</div>
      ${nav.map(([id, ic, l, b]) => `<button class="kr-nav ${view === id ? 'on' : ''}" data-kv="${id}"><i>${ic}</i><span>${l}</span>${b ? `<em>${b}</em>` : ''}</button>`).join('')}
      <button class="kr-compose" data-act="kr-compose">✎ ${L2('Post', 'Paylaş')}</button>
      <div class="kr-me">${myPortrait(c, 'kr-me-face')}<div><b>${esc(me.name)}${me.followers > 50000 ? ' <i class="kr-ver">✓</i>' : ''}</b><small>@${esc(myHandle(c))}</small><span><b>${compact(me.followers)}</b> ${L2('followers', 'takipçi')}</span></div></div>
      ${vibeMeter(c)}
    </aside>
    <section class="kr-center">${main}</section>
    <aside class="kr-right">
      <div class="kr-box"><h4>${L2('Trending', 'Gündemde')}</h4>${(c.trends.length ? c.trends : [{ tag: 'MadFootball', n: 120000 }, { tag: 'NoRules', n: 54000 }]).slice(0, 6).map((t, i) => `<div class="kr-trend"><small>${i + 1} · ${L2('Football', 'Futbol')}</small><b>#${esc(t.tag)}</b><small>${compact(t.n)} ${L2('posts', 'gönderi')}</small></div>`).join('')}</div>
      ${c.news[0] ? `<div class="kr-box news-mini" data-kv="news"><h4>${L2('Breaking', 'Son dakika')}</h4><b>${esc(c.news[0].title)}</b><small>${esc(c.news[0].sub)}</small></div>` : ''}
    </aside>
  </div>`;
}

// ------------------------------------------------------------------ DMs

function threads(c: Career) {
  const map = new Map<string, DM[]>();
  for (const d of c.dms) {
    const a = map.get(d.thread) ?? [];
    a.push(d);
    map.set(d.thread, a);
  }
  return [...map.entries()].sort((a, b) => {
    const la = a[1][a[1].length - 1], lb = b[1][b[1].length - 1];
    return lb.season * 100 + lb.week - (la.season * 100 + la.week) || c.dms.indexOf(lb) - c.dms.indexOf(la);
  });
}

const FROM_ICON: Record<string, string> = { agent: '💼', manager: '📋', mate: '👕', club: '🏟️', sponsor: '💸', family: '❤️', nemesis: '😈', national: '🌍', press: '🎙️' };
const FROM_LABEL = (f: string) => ({ agent: L2('Agent', 'Menajer'), manager: L2('Manager', 'Teknik direktör'), mate: L2('Team-mate', 'Takım arkadaşı'), club: L2('Club', 'Kulüp'), sponsor: L2('Brand', 'Marka'), family: L2('Family', 'Aile'), nemesis: L2('Rival', 'Rakip'), national: L2('National team', 'Milli takım'), press: L2('Press', 'Basın') } as Record<string, string>)[f] ?? f;

function dmsHTML(c: Career) {
  const th = threads(c);
  if (!openThread && th.length) openThread = th[0][0];
  const cur = th.find(([k]) => k === openThread);
  if (cur) for (const d of cur[1]) if (!d.choices) d.read = true;
  return `<div class="kr-dms">
    <div class="kr-threads">${th.map(([k, ds]) => {
      const last = ds[ds.length - 1];
      const unread = ds.some((d) => !d.mine && !d.read);
      const head = ds.find((d) => !d.mine) ?? last;
      return `<button class="kr-th ${k === openThread ? 'on' : ''} ${unread ? 'unread' : ''}" data-thread="${esc(k)}"><span class="kr-th-ic">${head.from === 'nemesis' && c.npcs[c.nemesis] ? npcPortrait(c, c.nemesis, 'kr-av-img') : FROM_ICON[head.from] ?? '✉'}</span><div><b>${esc(head.name)}</b><small>${FROM_LABEL(head.from)}</small><p>${esc(last.mine ? L2('You: ', 'Sen: ') + last.text : last.text)}</p></div></button>`;
    }).join('') || `<div class="kr-empty">${L2('No messages', 'Mesaj yok')}</div>`}</div>
    <div class="kr-conv">${cur ? `<div class="kr-conv-head">${esc((cur[1].find((d) => !d.mine) ?? cur[1][0]).name)} <small>${FROM_LABEL(cur[1][0].from)}</small></div><div class="kr-bubbles">${cur[1].map((d) => `<div class="kr-bub ${d.mine ? 'mine' : ''}"><p>${fmtText(d.text)}</p><small>${L2('S', 'S')}${d.season} · ${L2('W', 'H')}${d.week}</small>${d.choices && !d.read ? `<div class="kr-choices">${d.choices.map((ch) => `<button data-dm="${d.id}" data-ch="${ch.id}">${esc(ch.label)}</button>`).join('')}</div>` : ''}</div>`).join('')}</div>` : ''}</div>
  </div>`;
}

// ------------------------------------------------------------------ news

function newsHTML(c: Career) {
  const top = c.news.find((n) => n.big) ?? c.news[0];
  const rest = c.news.filter((n) => n !== top && n.kind !== 'rumour').slice(0, 8);
  const rum = c.news.filter((n) => n.kind === 'rumour').slice(0, 5);
  const date = `${L2('Season', 'Sezon')} ${c.season} · ${L2('Week', 'Hafta')} ${c.week}`;
  return `<div class="np">
    <div class="np-mast"><b>MAD SPORT DAILY</b><small>${date} · ${L2('No refs. No rules. All the news.', 'Hakem yok. Kural yok. Bütün haberler.')}</small></div>
    ${top ? `<div class="np-top">${top.pic ? `<div class="np-pic">${crestOf(c, top.pic, 'crest-xl')}</div>` : ''}<div><h2>${esc(top.title)}</h2><p>${esc(top.sub)}</p></div></div>` : `<div class="kr-empty">${L2('The presses are warming up…', 'Matbaa ısınıyor…')}</div>`}
    <div class="np-cols">
      <div class="np-list">${rest.map((n) => `<div class="np-item k-${n.kind}"><b>${esc(n.title)}</b><small>${esc(n.sub)}</small></div>`).join('')}</div>
      <div class="np-rum"><h4>${L2('RUMOUR MILL', 'DEDİKODU KAZANI')}</h4>${rum.length ? rum.map((n) => `<div class="np-ru"><b>${esc(n.title)}</b><small>${esc(n.sub)}</small>${stars(n.rel ?? 2)}</div>`).join('') : `<small>${L2('Quiet… for now.', 'Sessiz… şimdilik.')}</small>`}</div>
    </div>
  </div>`;
}

// ------------------------------------------------------------------ binding

export function bindPhone(c: Career, root: HTMLElement, rerender: () => void) {
  root.querySelectorAll<HTMLElement>('[data-kv]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.kv as PhoneView; audio.click(); rerender(); }));
  root.querySelectorAll<HTMLElement>('.kr-post').forEach((el) => el.addEventListener('click', () => {
    openPost = openPost === el.dataset.post ? null : el.dataset.post!;
    audio.click();
    rerender();
  }));
  root.querySelectorAll<HTMLElement>('[data-thread]').forEach((b) => b.addEventListener('click', () => { openThread = b.dataset.thread!; audio.click(); rerender(); }));
  root.querySelectorAll<HTMLElement>('[data-dm]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const d = c.dms.find((x) => x.id === b.dataset.dm);
    const ch = d?.choices?.find((x) => x.id === b.dataset.ch);
    if (!d || !ch) return;
    const msg = resolveDM(c, d, ch);
    saveCareer();
    audio.select();
    if (msg) toast(msg);
    rerender();
  }));
  root.querySelector<HTMLElement>('[data-act=kr-compose]')?.addEventListener('click', () => { audio.click(); compose(c, c.last && !c.last.posted ? c.last : null, rerender); });
  // newest content at the top
  root.querySelector('.kr-bubbles')?.lastElementChild?.scrollIntoView({ block: 'end' });
}

/** Compose sheet: pick what to post. */
export function compose(c: Career, lm: LastMatch | null, done: () => void) {
  const opts = postOptions(c, lm);
  const m = modal(`
    <div class="kr-compose-sheet">
      <div class="cr-mh"><b>✎ ${L2('New post', 'Yeni gönderi')}</b><button class="cr-x" data-x>✕</button></div>
      <p class="cr-hint">${L2('What you post moves your followers, your image and how fans, team-mates and rivals see you.', 'Paylaştıkların takipçilerini, imajını ve taraftarın, takım arkadaşlarının, rakiplerin seni nasıl gördüğünü etkiler.')}</p>
      <div class="kr-opts">${opts.map((o, i) => `<button class="kr-opt t${o.tone > 0.4 ? 'good' : o.tone < -0.3 ? 'spicy' : 'mid'}" data-o="${i}"><small>${esc(o.label)}${o.tagNemesis ? ' 🔥' : ''}${o.sponsor ? ' 💸' : ''}</small><span>${fmtText(o.text)}</span></button>`).join('')}</div>
    </div>`, 'sheet');
  m.querySelector('[data-x]')?.addEventListener('click', () => closeModal());
  m.querySelectorAll<HTMLElement>('[data-o]').forEach((b) => b.addEventListener('click', () => {
    const o: PostOption = opts[Number(b.dataset.o)];
    const line = publishPost(c, o, lm);
    if (lm) lm.posted = true;
    saveCareer();
    closeModal();
    audio.select();
    toast(line);
    view = 'feed';
    done();
  }));
  void isTR;
  void crestTag;
  void paintAll;
}
