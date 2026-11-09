import { Match, MatchConfig } from './match';
import { Camera } from './camera';
import { Renderer } from './renderer';
import { FX } from './fx';
import { drawHUD, BtnLabel } from './hud';
import { DomHud } from './domhud';

const setCls = (e: HTMLElement, c: string, on: boolean) => { if (e.classList.contains(c) !== on) e.classList.toggle(c, on); };
import type { Input, BtnId } from '../engine/input';
import { audio } from '../engine/audio';
import { dist } from '../engine/math';
import { t } from '../engine/i18n';
import { itemById } from '../meta/items';
import { itemIcon } from '../pixel/icons';

const STEP = 1 / 60;

/** One running match with its camera, renderer and effects. */
export class Game {
  match: Match;
  cam = new Camera();
  fx = new FX();
  renderer: Renderer;
  paused = false;
  /** menu backdrop mode: no match simulation, slow camera pan */
  ambient = false;
  private acc = 0;
  time = 0;
  /**
   * Online 1v1. Host: hooks around every simulation step (feed the guest's input,
   * ship snapshots). Guest: `puppet` replaces the simulation (snapshots drive the match).
   */
  net: { beforeStep?(): void; afterStep?(dt: number): void; puppet?(dt: number): void } | null = null;

  constructor(cfg: MatchConfig, private input: Input | null) {
    this.match = new Match(cfg, this.fx);
    this.renderer = new Renderer(this.match);
    const b = this.match.ball;
    this.cam.x = b.x;
    this.cam.y = b.y;
    this.match.start();
    // your own club / quick match: the tactic switch is yours
    if (input) {
      input.tacticOn = this.match.managed(this.match.me);
      input.tacticReq = null;
    }
  }

  resize(W: number, H: number) {
    this.cam.resize(W, H);
  }

  update(dtReal: number) {
    if (this.paused) return;
    if (this.ambient) {
      this.time += dtReal;
      this.match.excitement = 0.3 + Math.max(0, Math.sin(this.time * 0.4)) * 0.4;
      audio.setCrowd(0.15);
      audio.update(dtReal);
      const P = this.match.pitch;
      this.cam.follow(Math.sin(this.time * 0.08) * P.hw * 0.7, Math.sin(this.time * 0.05) * P.hh * 0.4, dtReal, P, 1.5);
      return;
    }
    const ts = this.fx.timeScale;
    if (this.net?.puppet) {
      this.net.puppet(dtReal);
      this.time += dtReal;
      this.fx.update(dtReal * ts, dtReal);
      audio.update(dtReal);
      this.updateCamera(dtReal);
      return;
    }
    this.acc += dtReal * ts;
    let steps = 0;
    while (this.acc >= STEP && steps < 5) {
      this.net?.beforeStep?.();
      this.match.step(STEP, this.input);
      this.input?.consume(STEP);
      this.net?.afterStep?.(STEP);
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
      const k = m.cfg.lockStar ? 0.4 : 0.25;
      tx = tx * (1 - k) + h.x * k;
      ty = ty * (1 - k) + h.y * k;
    }
    if (m.phase === 'goal' && m.lastGoal && !m.replaying) {
      // watch the goal explosion first, then the celebrating scorer
      const sc = m.lastGoal.scorer;
      if (m.phaseT < 1.9) {
        tx = m.lastGoal.team.side * m.pitch.hw;
        ty = 0;
      } else if (sc) {
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
    const team = m.me;
    const hasBall = !!h && b.owner === h;
    const keeper = hasBall && !!h && h.isGK;
    // a ball on its way to you: SHOOT hits it first time (volley / header / one-timer)
    const incoming = !!h && !hasBall && m.oneTimerChance(h);
    const aerial = incoming && (b.z > 0.45 || b.vz > 1.5);
    let aText = L.tackleBtn;
    let aIc = 'slide';
    if (keeper) { aText = L.punt; aIc = 'punt'; }
    else if (hasBall) { aText = L.shoot; aIc = 'shoot'; }
    else if (aerial) { aText = b.z > 1.2 ? L.header : L.shoot; aIc = b.z > 1.2 ? 'header' : 'shoot'; }
    else if (incoming) { aText = L.shoot; aIc = 'shoot'; }
    else if (h) {
      for (const q of m.me.opp.players) {
        if (!q.isGK && q.state !== 'down' && dist(h.x, h.y, q.x, q.y) < 1.75) {
          aText = L.shove;
          aIc = 'shove';
          break;
        }
      }
    }
    // THROUGH key: a through ball on the ball, press / shove without it
    const dText = hasBall ? L.through : L.press;
    const dIc = hasBall ? 'through' : 'press';
    const it = team.item ? itemById('pw_' + team.item) : null;
    const usable = !!h && m.canUseItem(h);
    return {
      a: { text: aText, color: hasBall || incoming ? '#ff4d3d' : '#ff7a1f', ic: aIc, glow: incoming && !!h && h.volleyT > 0 },
      b: { text: keeper ? L.throwBtn : hasBall ? L.pass : m.cfg.lockStar ? L.callBtn : L.switchBtn, color: '#2f9bff', ic: keeper ? 'throw' : hasBall || m.cfg.lockStar ? 'pass' : 'switch' },
      c: { text: hasBall && !keeper ? L.sprintSkill : L.sprint, color: '#2fc46a', dim: keeper, ic: 'sprint' },
      d: { text: dText, color: '#ffd23f', dim: keeper, ic: dIc },
      e: it
        ? { text: '', color: usable ? '#ffb21f' : '#6a5a3a', glow: usable, icon: itemIcon(it.id, it.type, it.color), tier: m.tierOf(team, team.item!), dim: !usable }
        : { text: '?', color: '#3a4258', dim: true },
    };
  }

  /** DOM HUD layer (Dossier style), only for a real match */
  private dom: DomHud | null = null;

  draw(ctx: CanvasRenderingContext2D, W: number, H: number, showHud: boolean) {
    this.renderer.draw(ctx, this.cam, this.time);
    if (!this.input || this.match.cfg.demo) return;
    if (showHud) drawHUD(ctx, this.match, this.input, W, H);
    this.dom ??= new DomHud(document.body);
    setCls(this.dom.root, 'off', !showHud);
    if (showHud) this.dom.update(this, this.input, this.labels(), this.time);
  }

  dispose() {
    this.dom?.destroy();
    this.dom = null;
    this.renderer.dispose();
  }
}
