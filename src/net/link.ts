/**
 * Peer-to-peer link between two phones (WebRTC data channel via PeerJS).
 * The public PeerJS broker only introduces the two devices; the match itself
 * flows directly between them (or through PeerJS' TURN relay when a network
 * blocks direct connections).
 */
import Peer, { DataConnection, PeerOptions } from 'peerjs';

const PREFIX = 'madfb-v1-';
/** characters per data-channel message (PeerJS JSON channel limit is ~16 KB) */
const CHUNK = 12000;
const LAG = (() => {
  try {
    return Math.max(0, Math.min(1000, Number(localStorage.getItem('mf.netLag')) || 0));
  } catch {
    return 0;
  }
})();
/** room codes: no 0/O, 1/I/L - easy to read out loud */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newRoomCode(n = 5) {
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export function cleanCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

/** Dev / test override: localStorage mf.peer = {"host":"localhost","port":9000,"path":"/","secure":false} */
function peerOptions(): PeerOptions {
  const o: PeerOptions = { debug: 0 };
  try {
    const raw = localStorage.getItem('mf.peer');
    if (raw) Object.assign(o, JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return o;
}

export type LinkState = 'connecting' | 'waiting' | 'open' | 'closed';

export class NetLink {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  onMessage: (msg: unknown) => void = () => {};
  onState: (s: LinkState, why?: string) => void = () => {};
  state: LinkState = 'connecting';
  private closing = false;

  private set(s: LinkState, why?: string) {
    if (this.state === 'closed') return;
    this.state = s;
    this.onState(s, why);
  }

  /** Open a room with this code and wait for one opponent. */
  host(code: string) {
    const peer = (this.peer = new Peer(PREFIX + code, peerOptions()));
    peer.on('open', () => this.set('waiting'));
    peer.on('connection', (c) => {
      if (this.conn) {
        // room is full
        c.on('open', () => {
          c.send({ t: 'full' });
          setTimeout(() => c.close(), 300);
        });
        return;
      }
      this.attach(c);
    });
    peer.on('error', (e) => this.fail(e));
    peer.on('disconnected', () => {
      // lost the broker (not the opponent): try to stay reachable while waiting
      if (!this.conn && !this.closing) peer.reconnect();
    });
  }

  /** Join the room with this code. */
  join(code: string) {
    const peer = (this.peer = new Peer(peerOptions()));
    peer.on('open', () => {
      const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      this.attach(c);
      // the room does not answer: wrong code, or the host left
      setTimeout(() => {
        if (this.state === 'connecting') this.fail({ type: 'peer-unavailable' });
      }, 12000);
    });
    peer.on('error', (e) => this.fail(e));
  }

  /** Take over a peer and an already-open connection (from the matchmaker). */
  adopt(peer: Peer, c: DataConnection) {
    this.peer = peer;
    this.attach(c);
    // late "nobody in that lobby" answers from the matchmaker's other knocks are not our problem
    peer.on('error', (e) => {
      if ((e as { type?: string }).type !== 'peer-unavailable') this.fail(e);
    });
    if (c.open) this.set('open');
  }

  private attach(c: DataConnection) {
    this.conn = c;
    c.on('open', () => this.set('open'));
    c.on('data', (d) => {
      try {
        const msg = this.unchunk(d);
        if (msg === undefined) return;
        // dev / test: simulated one-way latency (localStorage mf.netLag = ms)
        if (LAG > 0) setTimeout(() => this.state !== 'closed' && this.onMessage(msg), LAG);
        else this.onMessage(msg);
      } catch (e) {
        console.error('net message', e);
      }
    });
    c.on('close', () => this.fail({ type: 'closed' }));
    c.on('error', (e) => this.fail(e));
  }

  private fail(e: unknown) {
    if (this.state === 'closed') return;
    const type = (e as { type?: string })?.type ?? 'error';
    const pc = this.conn?.peerConnection;
    console.warn('net link closed:', type, String((e as Error)?.message ?? ''), 'ice', pc?.iceConnectionState, 'conn', pc?.connectionState);
    this.set('closed', type);
    this.close();
  }

  get ready() {
    return this.state === 'open' && !!this.conn?.open;
  }

  /**
   * PeerJS' JSON channel refuses messages over ~16 KB (and then drops the link), so
   * anything big (the first full snapshot, the match setup with both squads) goes
   * out in pieces and is put back together on the other side.
   */
  send(msg: unknown) {
    const c = this.conn;
    if (!c?.open) return;
    const js = JSON.stringify(msg);
    if (js.length <= CHUNK) {
      c.send(msg);
      return;
    }
    const id = ++this.chunkId;
    const n = Math.ceil(js.length / CHUNK);
    for (let i = 0; i < n; i++) c.send({ t: '~', id, i, n, s: js.slice(i * CHUNK, (i + 1) * CHUNK) });
  }
  private chunkId = 0;
  private parts = new Map<number, string[]>();
  private unchunk(d: unknown): unknown {
    const m = d as { t?: string; id?: number; i?: number; n?: number; s?: string };
    if (m?.t !== '~') return d;
    const id = (m.id ?? 0) | 0, n = (m.n ?? 0) | 0, i = (m.i ?? 0) | 0;
    if (n <= 0 || n > 400 || i < 0 || i >= n || typeof m.s !== 'string') return undefined;
    let arr = this.parts.get(id);
    if (!arr) {
      arr = new Array(n).fill(null);
      this.parts.set(id, arr);
      // forget anything half-received long ago
      for (const k of this.parts.keys()) if (k < id - 20) this.parts.delete(k);
    }
    arr[i] = m.s;
    if (arr.some((x) => x === null)) return undefined;
    this.parts.delete(id);
    return JSON.parse(arr.join(''));
  }

  /** bytes waiting in the data channel (back-pressure check) */
  get buffered() {
    return this.conn?.dataChannel?.bufferedAmount ?? 0;
  }

  close() {
    this.closing = true;
    try {
      this.conn?.close();
    } catch {
      /* ignore */
    }
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
    this.conn = null;
    this.peer = null;
    if (this.state !== 'closed') {
      this.state = 'closed';
      this.onState('closed', 'left');
    }
  }
}

// ---------------------------------------------------------------- random opponent (no server)

const SLOTS = 8;
const slotId = (k: number) => PREFIX + 'mm-' + k;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shuffled = (n: number) => [...Array(n).keys()].sort(() => Math.random() - 0.5);

/**
 * Finds a random opponent with nothing but the PeerJS broker: a few well-known
 * lobby ids. A seeker knocks on each one; a lobby that answers is a waiting player.
 * If nobody is waiting, it waits in a free lobby itself for a few (random) seconds,
 * then goes knocking again - so two players never both wait forever.
 */
export class Matchmaker {
  onFound: (link: NetLink, role: 'host' | 'guest') => void = () => {};
  onStatus: (s: 'searching' | 'waiting' | 'error', why?: string) => void = () => {};
  private stopped = false;
  private peer: Peer | null = null;

  start() {
    void this.loop();
  }

  cancel() {
    this.stopped = true;
    this.drop();
  }

  private drop() {
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
    this.peer = null;
  }

  private async loop() {
    let fails = 0;
    while (!this.stopped) {
      this.onStatus('searching');
      const r1 = await this.seek();
      if (r1 === 'found' || this.stopped) return;
      if (r1 === 'error') {
        if (++fails >= 3) return this.onStatus('error', 'network');
        await wait(1500);
        continue;
      }
      this.onStatus('waiting');
      const r2 = await this.host(6000 + Math.random() * 6000);
      if (r2 === 'found' || this.stopped) return;
      if (r2 === 'error' && ++fails >= 3) return this.onStatus('error', 'network');
    }
  }

  /** Knock on every lobby; the first waiting player that answers is the match. */
  private seek(): Promise<'found' | 'none' | 'error'> {
    return new Promise((resolve) => {
      const peer = (this.peer = new Peer(peerOptions()));
      let done = false;
      const finish = (r: 'found' | 'none' | 'error') => {
        if (done) return;
        done = true;
        if (r !== 'found') this.drop();
        resolve(r);
      };
      peer.on('error', (e) => {
        const type = (e as { type?: string }).type;
        if (type === 'peer-unavailable') return; // an empty lobby: handled per knock
        finish('error');
      });
      peer.on('open', () => {
        // knock on every lobby at once: the first waiting player who accepts wins
        let left = SLOTS;
        for (const k of shuffled(SLOTS)) {
          void this.knock(peer, slotId(k)).then((c) => {
            left--;
            if (c && !done && !this.stopped) {
              done = true;
              const link = new NetLink();
              link.adopt(peer, c);
              this.peer = null;
              resolve('found');
              this.onFound(link, 'guest');
              return;
            }
            if (c) {
              // a second lobby accepted too late: tell it we are taken
              try {
                c.send({ t: 'bye' });
                setTimeout(() => c.close(), 200);
              } catch {
                /* ignore */
              }
            }
            if (left === 0) finish('none');
          });
        }
      });
      setTimeout(() => finish('none'), 8000);
    });
  }

  /** Connect to one lobby; resolves with the open connection if a player accepted us. */
  private knock(peer: Peer, id: string): Promise<DataConnection | null> {
    return new Promise((resolve) => {
      let settled = false;
      const c = peer.connect(id, { reliable: true, serialization: 'json' });
      const end = (v: DataConnection | null) => {
        if (settled) return;
        settled = true;
        c.off('data', onData);
        peer.off('error', onErr);
        if (!v) {
          try {
            c.close();
          } catch {
            /* ignore */
          }
        }
        resolve(v);
      };
      const onData = (d: unknown) => {
        const t = (d as { t?: string })?.t;
        if (t === 'mm-ok') end(c);
        else if (t === 'full') end(null);
      };
      const onErr = (e: unknown) => {
        if ((e as { type?: string }).type === 'peer-unavailable' && String((e as Error).message ?? '').includes(id)) end(null);
      };
      peer.on('error', onErr);
      c.on('data', onData);
      c.on('open', () => c.send({ t: 'mm' }));
      setTimeout(() => end(null), 3500);
    });
  }

  /** Wait in a free lobby for `ms`; resolves 'found' when a seeker joins. */
  private host(ms: number): Promise<'found' | 'none' | 'error'> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (r: 'found' | 'none' | 'error') => {
        if (done) return;
        done = true;
        if (r !== 'found') this.drop();
        resolve(r);
      };
      const tryId = (left: number[]) => {
        const k = left.shift();
        if (k === undefined) return finish('none');
        const peer = (this.peer = new Peer(slotId(k), peerOptions()));
        peer.on('error', (e) => {
          const type = (e as { type?: string }).type;
          if (type === 'unavailable-id') {
            // someone is waiting there already: let the next seek find them
            try {
              peer.destroy();
            } catch {
              /* ignore */
            }
            return finish('none');
          }
          if (type !== 'peer-unavailable') finish('error');
        });
        peer.on('connection', (c) => {
          if (done) {
            c.on('open', () => {
              c.send({ t: 'full' });
              setTimeout(() => c.close(), 300);
            });
            return;
          }
          const onData = (d: unknown) => {
            if ((d as { t?: string })?.t !== 'mm' || done) return;
            c.off('data', onData);
            c.send({ t: 'mm-ok' });
            done = true;
            const link = new NetLink();
            link.adopt(peer, c);
            this.peer = null;
            resolve('found');
            this.onFound(link, 'host');
          };
          c.on('data', onData);
        });
        setTimeout(() => finish('none'), ms);
      };
      tryId(shuffled(SLOTS));
    });
  }
}
