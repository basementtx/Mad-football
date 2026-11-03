import { Match, MatchConfig } from './match';
import { Camera } from './camera';
import { Renderer } from './renderer';
import { FX } from './fx';
import { drawHUD, BtnLabel } from './hud';
import type { Input, BtnId } from '../engine/input';
import { audio } from '../engine/audio';
import { settings } from '../engine/storage';
import { dist } from '../engine/math';
import { t } from '../engine/i18n';

const STEP = 1 / 60;

/** One running match with its camera, renderer and effects. */
export class Game {
  match: Match;
  cam = new Camera();
  fx = new FX();
  renderer: Renderer;
  paused = false;
  private acc = 0;
  time = 0;

  constructor(cfg: MatchConfig, private input: Input | null) {
    this.match = new Match(cfg, this.fx);
    this.renderer = new Renderer(this.match);
    const b = this.match.ball;
    this.cam.x = b.x;
    this.cam.y = b.y;
    if (!cfg.demo) {
      this.cam.zoom = 0.72;
    }
    this.match.start();
  }

  resize(W: number, H: number) {
    this.cam.W = W;
    this.cam.H = H;
    this.cam.resize(W, H, settings.zoom);
  }

  update(dtReal: number) {
    if (this.paused) return;
    const ts = this.fx.timeScale;
    this.acc += dtReal * ts;
    let steps = 0;
    while (this.acc >= STEP && steps < 5) {
      this.match.step(STEP, this.input);
      this.input?.consume(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps >= 5) this.acc = 0;
    this.time += dtReal;
    this.fx.update(dtReal * ts, dtReal);
    audio.update(dtReal);
    this.updateCamera(dtReal);
  }

  private updateCamera(dt: number) {
    const m = this.match;
    const b = m.ball;
    const cam = this.cam;
    let tx = b.x + b.vx * 0.22;
    let ty = b.y + b.vy * 0.22;
    const h = m.human;
    if (h && m.phase === 'play') {
      // keep the controlled player in view
      tx = tx * 0.75 + h.x * 0.25;
      ty = ty * 0.75 + h.y * 0.25;
    }
    // zoom behaviour
    let z = 1;
    if (m.phase === 'intro') z = 0.72;
    if (m.phase === 'goal') z = m.phaseT < 2 ? 1.25 : 1.1;
    if (m.phase === 'fulltime') z = 0.85;
    if (m.cfg.demo) z = 0.95;
    if (m.replaying) z = 1.12;
    cam.zoom += (z - cam.zoom) * Math.min(1, dt * (m.phase === 'goal' ? 3 : 1.5));
    cam.resize(cam.W, cam.H, settings.zoom);
    if (m.phase === 'goal' && m.lastGoal && !m.replaying) {
      const sc = m.lastGoal.scorer;
      if (sc && m.phaseT > 0.9) {
        tx = sc.x;
        ty = sc.y;
      }
    }
    cam.follow(tx, ty, dt, m.pitch, m.phase === 'goal' && !m.replaying ? 3 : 4.5);
    cam.applyShake(this.fx.shake, this.time);
  }

  labels(): Record<BtnId, BtnLabel> {
    const m = this.match;
    const L = t();
    const h = m.human;
    const b = m.ball;
    const hasBall = !!h && b.owner === h;
    const rageFull = m.teams[0].rage >= 1;
    let aText = L.tackleBtn;
    if (hasBall) aText = L.shoot;
    else if (h) {
      if (!b.owner && b.z > 0.6 && dist(h.x, h.y, b.x, b.y) < 3) aText = L.header;
      else {
        for (const q of m.teams[1].players) {
          if (q.state !== 'down' && dist(h.x, h.y, q.x, q.y) < 1.75) {
            aText = L.shove;
            break;
          }
        }
      }
    }
    return {
      a: { text: aText, color: hasBall ? '#ff4d3d' : '#ff7a1f' },
      b: { text: hasBall ? L.pass : L.switchBtn, color: '#2f9bff' },
      c: { text: L.sprint, color: '#2fc46a' },
      d: hasBall && rageFull ? { text: '🔥' + L.powerShot, color: '#ff8a1f', glow: true } : { text: L.spin, color: '#a35cff' },
    };
  }

  draw(ctx: CanvasRenderingContext2D, W: number, H: number, showHud: boolean) {
    this.renderer.draw(ctx, this.cam, this.time);
    if (showHud && this.input) drawHUD(ctx, this.match, this.input, W, H, this.time, this.match.cfg.demo ? null : this.labels());
  }
}
