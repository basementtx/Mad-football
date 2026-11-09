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
