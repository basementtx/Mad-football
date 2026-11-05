/** KICKR: the in-game social network, inbox and the sports paper. */
import type { Career, Post, DM, LastMatch } from '../../career/types';
import { esc, fmtText, crestOf, myPortrait, npcPortrait, mySprite, ratingClass, modal, closeModal, stars, paintAll, flagTag } from './kit';
import { L2, compact, isTR } from '../../career/util';
import { timeAgo, vibe, resolveDM, postOptions, publishPost, myHandle, PostOption } from '../../career/media';
import { kx, votePoll, toggleLike, unseenNotifs } from '../../career/kickr';
import type { KStory } from '../../career/types';
import { clubName, teamDefOf } from '../../career/world';
import { saveCareer } from '../../career/state';
import { audio } from '../../engine/audio';
import { toast, crestTag } from '../common';

export type PhoneView = 'feed' | 'explore' | 'notifs' | 'mentions' | 'dms' | 'news';
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
    case 'clip': {
      const pose = String(d.pose);
      return `<div class="kr-m clip ${d.old ? 'old' : ''}"><div class="kr-clip-stage">${mySprite(c, pose === 'celebrate' ? 'cel0' : 'kick1', 'kr-clip-sprite')}<i class="kr-play">▶</i><span class="kr-dur">${esc(String(d.dur))}</span>${d.old ? `<span class="kr-old">${L2('1 YEAR AGO', '1 YIL ÖNCE')}</span>` : ''}<span class="kr-live-bar"><i></i></span></div><div class="kr-clip-meta">👁 ${compact(Number(d.views))} ${L2('views', 'izlenme')} · vs ${esc(String(d.opp ?? ''))}</div></div>`;
    }
    case 'poll': {
      const opts = String(d.opts).split('|');
      const pct = String(d.pct).split('|').map(Number);
      const voted = kx(c).polls[p.id];
      const show = voted !== undefined;
      const best = Math.max(...pct);
      return `<div class="kr-m poll ${show ? 'voted' : ''}">${opts.map((o, i) => `<button class="kr-pollopt ${show && pct[i] === best ? 'lead' : ''} ${voted === i ? 'mine' : ''}" data-vote="${p.id}:${i}" ${show ? 'disabled' : ''}><i style="--w:${show ? pct[i] : 0}%"></i><span>${esc(o)}${voted === i ? ' ✓' : ''}</span>${show ? `<b>${pct[i]}%</b>` : ''}</button>`).join('')}<small>${compact(Number(d.total))} ${L2('votes', 'oy')} · ${show ? L2('Final results', 'Sonuçlar') : L2('Tap to vote', 'Oy vermek için dokun')}</small></div>`;
    }
    case 'quote':
      return `<div class="kr-m quote">${avatar(c, String(d.qav ?? 'c:#6c7480'), 'kr-av sm', String(d.qn))}<div><div class="kr-head"><b>${esc(String(d.qn))}</b><span>@${esc(String(d.qh))}</span></div><div class="kr-text">${fmtText(String(d.qt))}</div></div></div>`;
    case 'meme':
      return `<div class="kr-m meme"><b class="mt">${esc(String(d.top))}</b>${mySprite(c, String(d.pose) === 'down' ? 'down0' : 'cel0', 'kr-meme-sprite')}<b class="mb">${esc(String(d.bot))}</b></div>`;
    case 'compare': {
      const rows = String(d.rows).split('|').map((r) => r.split(':'));
      return `<div class="kr-m compare"><div class="kr-cmp-h"><span>${myPortrait(c, 'kr-cmp-face')}<b>${esc(String(d.a).split(' ').pop()!)}</b></span><em>VS</em><span>${npcPortrait(c, String(d.nid), 'kr-cmp-face')}<b>${esc(String(d.b).split(' ').pop()!)}</b></span></div>${rows.map(([l, a, b]) => { const na = Number(a), nb = Number(b); const t = na + nb || 1; return `<div class="kr-cmp-r"><b class="${na >= nb ? 'w' : ''}">${a}</b><div class="kr-cmp-bar"><i style="--w:${(na / t) * 100}%"></i></div><span>${esc(l)}</span><div class="kr-cmp-bar r"><i style="--w:${(nb / t) * 100}%"></i></div><b class="${nb > na ? 'w' : ''}">${b}</b></div>`; }).join('')}</div>`;
    }
    case 'graph': {
      const rows = String(d.rows).split('|').map((r) => r.split(':'));
      return `<div class="kr-m graph"><div class="kr-g-badge">${esc(String(d.r))}</div>${rows.map(([l, v, mx]) => `<div class="kr-g-r"><span>${esc(l)}</span><div class="kr-g-bar"><i style="--w:${Math.min(100, (Number(v) / Number(mx)) * 100)}%"></i></div><b>${esc(v)}</b></div>`).join('')}</div>`;
    }
    case 'odds':
      return `<div class="kr-m odds"><div class="kr-odds-h">${esc(String(d.h))} <em>v</em> ${esc(String(d.a))}</div><div class="kr-odds-row"><span><small>1</small><b>${d.o1}</b></span><span><small>X</small><b>${d.ox}</b></span><span><small>2</small><b>${d.o2}</b></span></div><div class="kr-odds-sc">${esc(String(d.sc))} <b>${d.so}</b></div></div>`;
    case 'board':
      return `<div class="kr-m board"><div class="kr-bd-pitch"><i class="kr-bd-p me" style="left:62%;top:42%"></i><i class="kr-bd-p" style="left:40%;top:30%"></i><i class="kr-bd-p" style="left:44%;top:66%"></i><i class="kr-bd-p o" style="left:70%;top:58%"></i><i class="kr-bd-p o" style="left:76%;top:30%"></i><svg class="kr-bd-arrow" viewBox="0 0 100 60" preserveAspectRatio="none"><path d="M40 30 Q55 18 62 25" /><path d="M62 25 L84 30" class="run" /></svg><span class="kr-bd-zone"></span></div><small>1/4 🧵</small></div>`;
    case 'table': {
      const rows = String(d.rows).split('|').map((r) => r.split(':'));
      return `<div class="kr-m table">${rows.map(([pos, n, pts, me]) => `<div class="kr-tb-r ${me === '1' ? 'me' : ''}"><span>${pos}</span><b>${esc(n)}</b><em>${pts}</em></div>`).join('')}</div>`;
    }
    case 'milestone':
      return `<div class="kr-m milestone"><b>${esc(String(d.m))}</b><span>${L2('FOLLOWERS', 'TAKİPÇİ')}</span><i class="kr-confetti"></i></div>`;
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
      <div class="kr-acts"><span>💬 <em data-n="${p.replyCount}">${compact(p.replyCount)}</em></span><span>🔁 <em data-n="${p.reposts}">${compact(p.reposts)}</em></span><button class="kr-like ${kx(c).liked.includes(p.id) ? 'on' : ''}" data-like="${p.id}"><i>♥</i> <em data-n="${p.likes}">${compact(p.likes)}</em></button>${p.media?.kind === 'clip' ? `<span>👁 ${compact(Number(p.media.data.views))}</span>` : ''}</div>
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
    ['explore', '#', L2('Explore', 'Keşfet'), 0],
    ['notifs', '🔔', L2('Notifications', 'Bildirimler'), unseenNotifs(c)],
    ['mentions', '@', L2('About you', 'Hakkında'), 0],
    ['dms', '✉', L2('Messages', 'Mesajlar'), dms],
    ['news', '▤', L2('Sport Daily', 'Spor Gazetesi'), 0],
  ];
  let main = '';
  if (view === 'feed' || view === 'mentions') {
    const name = me.name.split(' ').pop()!.toLowerCase();
    const posts = view === 'feed' ? c.feed : c.feed.filter((p) => p.text.toLowerCase().includes(name) || p.av === 'me' || p.media?.data.who === 'me');
    const st = kx(c);
    const now = c.season * 100 + c.week;
    const fresh = view === 'feed' && st.seen < now ? posts.filter((p) => p.season * 100 + p.week === now).length : 0;
    main = `<div class="kr-feed">${view === 'feed' ? storiesHTML(c) : ''}${fresh ? `<button class="kr-newpill" data-act="kr-top">↑ ${fresh} ${L2('new posts', 'yeni gönderi')}</button>` : ''}${posts.length ? posts.slice(0, 60).map((p) => postHTML(c, p)).join('') : `<div class="kr-empty">${L2('Nothing here yet.', 'Henüz bir şey yok.')}</div>`}</div>`;
  } else if (view === 'explore') main = exploreHTML(c);
  else if (view === 'notifs') main = notifsHTML(c);
  else if (view === 'dms') main = dmsHTML(c);
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

// ------------------------------------------------------------------ stories, explore, notifications

function storiesHTML(c: Career) {
  const st = kx(c).stories;
  if (!st.length) return '';
  return `<div class="kr-stories">${st.map((x) => `<button class="kr-story ${x.seen ? 'seen' : ''}" data-story="${x.id}"><span class="kr-ring">${avatar(c, x.av, 'kr-av', x.name)}</span><small>${esc(x.name)}</small></button>`).join('')}</div>`;
}

function openStory(c: Career, s: KStory, done: () => void) {
  let i = 0;
  const m = modal(`<div class="kr-sv"><div class="kr-sv-bars">${s.slides.map((_, k) => `<i data-b="${k}"><b></b></i>`).join('')}</div><div class="kr-sv-head">${avatar(c, s.av, 'kr-av', s.name)}<b>${esc(s.name)}</b><button class="cr-x" data-x>✕</button></div><div class="kr-sv-slide"></div></div>`, 'story');
  const slideEl = m.querySelector<HTMLElement>('.kr-sv-slide')!;
  let timer = 0;
  const show = () => {
    if (i >= s.slides.length) { close(); return; }
    const sl = s.slides[i];
    slideEl.style.setProperty('--bg', sl.bg);
    slideEl.innerHTML = `<b>${esc(sl.big)}</b><span>${esc(sl.text)}</span>${sl.sub ? `<small>${esc(sl.sub)}</small>` : ''}`;
    slideEl.classList.remove('in');
    void slideEl.offsetWidth;
    slideEl.classList.add('in');
    m.querySelectorAll<HTMLElement>('[data-b]').forEach((b) => { const k = Number(b.dataset.b); b.className = k < i ? 'done' : k === i ? 'run' : ''; });
    clearTimeout(timer);
    timer = window.setTimeout(() => { i++; show(); }, 3200);
  };
  const close = () => { clearTimeout(timer); s.seen = true; saveCareer(); closeModal(); done(); };
  m.querySelector('[data-x]')?.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  slideEl.addEventListener('click', () => { i++; audio.click(); show(); });
  show();
}

function exploreHTML(c: Career) {
  const trends = c.trends.length ? c.trends : [{ tag: 'MadFootball', n: 120000 }, { tag: 'NoRules', n: 54000 }];
  const mx = Math.max(...trends.map((t) => t.n));
  const polls = c.feed.filter((p) => p.media?.kind === 'poll').slice(0, 3);
  const cast = kx(c).personas.slice(0, 8);
  return `<div class="kr-explore">
    <div class="kr-ex-sec"><h4>${L2('Trending in football', 'Futbolda gündem')}</h4>${trends.slice(0, 8).map((t, i) => `<div class="kr-ex-tr"><span class="n">${i + 1}</span><div><b>#${esc(t.tag)}</b><small>${compact(t.n)} ${L2('posts', 'gönderi')}</small></div><div class="kr-ex-spark"><i style="--w:${Math.max(6, (t.n / mx) * 100)}%"></i></div></div>`).join('')}</div>
    ${polls.length ? `<div class="kr-ex-sec"><h4>${L2('Polls', 'Anketler')}</h4>${polls.map((p) => postHTML(c, p)).join('')}</div>` : ''}
    ${cast.length ? `<div class="kr-ex-sec"><h4>${L2('Who to follow', 'Kimi takip etmeli')}</h4><div class="kr-ex-cast">${cast.map((x) => `<div class="kr-ex-p">${avatar(c, 'c:' + x.color, 'kr-av', x.name)}<div><b>${esc(x.name)}${x.verified ? ' <i class="kr-ver">✓</i>' : ''}</b><small>@${esc(x.handle)}</small></div></div>`).join('')}</div></div>` : ''}
  </div>`;
}

const NOTIF_IC: Record<string, string> = { like: '♥', mention: '@', follow: '👤', milestone: '🎉', quote: '❝', trend: '📈' };
function notifsHTML(c: Career) {
  const ns = kx(c).notifs;
  const html = `<div class="kr-notifs">${ns.length ? ns.map((n) => `<div class="kr-nt k-${n.kind} ${n.seen ? '' : 'new'}"><span class="kr-nt-ic">${NOTIF_IC[n.kind] ?? '•'}</span><div><p>${fmtText(n.text)}</p><small>${L2('S', 'S')}${n.season} · ${L2('W', 'H')}${n.week}</small></div></div>`).join('') : `<div class="kr-empty">${L2('No notifications yet.', 'Henüz bildirim yok.')}</div>`}</div>`;
  for (const n of ns) n.seen = true;
  return html;
}

/** Counters on the newest posts tick up to their value: the post is going viral as you watch. */
function liveCounters(root: HTMLElement) {
  const els = [...root.querySelectorAll<HTMLElement>('.kr-post:nth-child(-n+8) [data-n]')];
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / 1400);
    const e = 1 - Math.pow(1 - k, 3);
    for (const el of els) {
      if (!el.isConnected) return;
      const n = Number(el.dataset.n);
      el.textContent = compact(Math.round(n * (0.55 + 0.45 * e)));
    }
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
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
  root.querySelectorAll<HTMLElement>('[data-like]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const p = c.feed.find((x) => x.id === b.dataset.like);
    if (!p) return;
    const on = toggleLike(c, p);
    b.classList.toggle('on', on);
    b.classList.remove('pop');
    void b.offsetWidth;
    if (on) b.classList.add('pop');
    const em = b.querySelector('em');
    if (em) em.textContent = compact(p.likes);
    audio.click();
    saveCareer();
  }));
  root.querySelectorAll<HTMLElement>('[data-vote]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const [id, i] = b.dataset.vote!.split(':');
    const p = c.feed.find((x) => x.id === id);
    if (!p) return;
    votePoll(c, p, Number(i));
    saveCareer();
    audio.select();
    rerender();
  }));
  root.querySelectorAll<HTMLElement>('[data-story]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = kx(c).stories.find((x) => x.id === b.dataset.story);
    if (s) { audio.click(); openStory(c, s, rerender); }
  }));
  root.querySelector<HTMLElement>('[data-act=kr-top]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    root.querySelector('.kr-center')?.scrollTo({ top: 0, behavior: 'smooth' });
    (e.currentTarget as HTMLElement).remove();
  });
  // first look at this week's feed: watch the numbers climb
  const st = kx(c);
  const now = c.season * 100 + c.week;
  if (view === 'feed' && st.seen < now) {
    liveCounters(root);
    st.seen = now;
    saveCareer();
  }
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
