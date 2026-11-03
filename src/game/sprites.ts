import type { Player } from './entities';
import type { TeamDef } from './teams';
import { shade, TAU } from '../engine/math';
import { drawStar } from './fx';

export interface Look {
  kit: TeamDef;
  isGK: boolean;
  skin: string;
  hair: string;
  hairStyle: number;
  beard: boolean;
  number: number;
  build: number;
}

export interface Pose {
  runPhase: number;
  speed: number; // 0..1 normalized
  facingLeft: boolean;
  state: Player['state'] | 'idle';
  stateT: number;
  stateDur: number;
  kickAnim: number;
  charge: number;
  hasBallGK: boolean;
  diveUp: number; // -1 dive "up" (screen), 1 down, 0 side
  spinT: number;
}

const OUT = 'rgba(10,12,20,0.55)';

/** Draws a footballer with feet at (0,0). k = pixels per meter. */
export function drawFootballer(ctx: CanvasRenderingContext2D, look: Look, pose: Pose, k: number) {
  const kit = look.kit;
  const jersey = look.isGK ? kit.gk : kit.primary;
  const jersey2 = look.isGK ? shade(kit.gk, -0.35) : kit.secondary;
  const shorts = look.isGK ? shade(kit.gk, -0.5) : kit.shorts;
  const socks = look.isGK ? shade(kit.gk, -0.2) : kit.socks;
  const S = k * 1.18 * look.build;
  ctx.save();
  ctx.scale(S, S);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const lw = Math.max(0.035, 1.2 / S);

  let legA = 0, legB = 0, armA = 0, armB = 0;
  let bodyRot = 0, lift = 0, lean = 0;
  const sw = Math.sin(pose.runPhase);
  const amp = Math.min(1, pose.speed) * 0.75;
  legA = sw * amp;
  legB = -sw * amp;
  armA = -sw * amp * 0.9;
  armB = sw * amp * 0.9;
  lift = Math.abs(Math.cos(pose.runPhase)) * 0.05 * Math.min(1, pose.speed);
  lean = pose.speed * 0.12;

  let starHead = false;
  switch (pose.state) {
    case 'slide': {
      bodyRot = -1.15;
      legA = 1.45;
      legB = 1.05;
      armA = -2.2;
      armB = -1.6;
      lift = -0.15;
      break;
    }
    case 'down': {
      bodyRot = -Math.PI / 2;
      legA = 0.3 + Math.sin(pose.stateT * 6) * 0.05;
      legB = -0.2;
      armA = -2.6;
      armB = -0.5;
      lift = -0.55;
      starHead = true;
      break;
    }
    case 'recover': {
      const t = Math.min(1, pose.stateT / Math.max(0.01, pose.stateDur));
      bodyRot = -Math.PI / 2 * (1 - t);
      lift = -0.55 * (1 - t);
      legA = 0.6 * (1 - t);
      legB = -0.3;
      armA = -1.2 * (1 - t);
      break;
    }
    case 'dive': {
      bodyRot = -Math.PI / 2 + 0.1;
      armA = -3.0;
      armB = -2.8;
      legA = 0.15;
      legB = -0.15;
      lift = -0.4;
      break;
    }
    case 'shove': {
      armA = 1.55;
      armB = 1.4;
      lean = 0.35;
      break;
    }
    case 'celebrate': {
      armA = -2.7 + Math.sin(pose.stateT * 14) * 0.25;
      armB = -2.5 - Math.sin(pose.stateT * 14) * 0.25;
      break;
    }
    case 'sad': {
      lean = -0.05;
      armA = 0.15;
      armB = -0.1;
      break;
    }
  }
  if (pose.kickAnim > 0) {
    const kt = 1 - pose.kickAnim / 0.3;
    legA = kt < 0.35 ? -0.9 * (kt / 0.35) : -0.9 + (kt - 0.35) / 0.65 * 2.4;
    if (kt > 0.75) legA = 1.5 - (kt - 0.75) * 4;
    armB = 0.9;
    armA = -0.8;
  } else if (pose.charge > 0) {
    legA = -0.7 * Math.min(1, pose.charge);
    lean = -0.12;
    armB = 0.8;
  }
  if (pose.hasBallGK) {
    armA = 0.9;
    armB = 0.7;
  }

  if (pose.facingLeft) ctx.scale(-1, 1);
  if (pose.spinT > 0) ctx.scale(Math.cos(pose.spinT * 26), 1);

  const hipY = -0.9;
  ctx.translate(0, -lift);
  if (bodyRot !== 0) {
    // rotate around the hip so the body lies down
    ctx.translate(0, hipY);
    ctx.rotate(bodyRot);
    ctx.translate(0, -hipY);
  }

  const drawLeg = (a: number, back: boolean) => {
    const len = 0.86;
    const fx = Math.sin(a) * len, fy = hipY + Math.cos(a) * len;
    const kx = Math.sin(a * 0.6) * len * 0.5 + (a < 0 ? -0.02 : 0.02), ky = hipY + Math.cos(a * 0.6) * len * 0.5;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 0.2 + lw * 2;
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    // skin thigh
    ctx.strokeStyle = back ? shade(look.skin, -0.25) : look.skin;
    ctx.lineWidth = 0.17;
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(kx, ky);
    ctx.stroke();
    // sock
    ctx.strokeStyle = back ? shade(socks, -0.3) : socks;
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    // boot
    ctx.fillStyle = back ? '#0b0b10' : '#16161d';
    ctx.beginPath();
    ctx.ellipse(fx + 0.07, fy - 0.01, 0.15, 0.075, a * 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(fx - 0.02, fy - 0.03, 0.06, 0.03);
  };

  const drawArm = (a: number, back: boolean) => {
    const sx = 0, sy = -1.5;
    const len = 0.62;
    const ex = Math.sin(a) * len * 0.5, ey = sy + Math.cos(a) * len * 0.5;
    const hx = Math.sin(a) * len, hy = sy + Math.cos(a) * len;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 0.15 + lw * 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.strokeStyle = back ? shade(jersey, -0.3) : jersey;
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = back ? shade(look.skin, -0.25) : look.skin;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    if (look.isGK) {
      ctx.fillStyle = back ? '#cfd3da' : '#ffffff';
      ctx.beginPath();
      ctx.arc(hx, hy, 0.1, 0, TAU);
      ctx.fill();
    }
  };

  drawArm(armB, true);
  drawLeg(legB, true);
  drawLeg(legA, false);

  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  ctx.translate(0, -hipY);

  // shorts
  ctx.fillStyle = shorts;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = lw;
  roundRect(ctx, -0.25, -1.05, 0.5, 0.3, 0.06);
  ctx.fill();
  ctx.stroke();

  // torso
  const tx = -0.27, ty = -1.62, tw = 0.54, th = 0.66;
  ctx.save();
  roundRect(ctx, tx, ty, tw, th, 0.12);
  ctx.fillStyle = jersey;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = jersey2;
  if (!look.isGK) {
    switch (kit.pattern) {
      case 'stripes':
        for (let i = 0; i < 3; i++) ctx.fillRect(tx + 0.06 + i * 0.18, ty, 0.08, th);
        break;
      case 'hoops':
        for (let i = 0; i < 3; i++) ctx.fillRect(tx, ty + 0.1 + i * 0.2, tw, 0.09);
        break;
      case 'half':
        ctx.fillRect(0, ty, tw, th);
        break;
      case 'sash':
        ctx.beginPath();
        ctx.moveTo(tx, ty + 0.05);
        ctx.lineTo(tx + 0.2, ty);
        ctx.lineTo(tx + tw, ty + th - 0.1);
        ctx.lineTo(tx + tw - 0.2, ty + th);
        ctx.closePath();
        ctx.fill();
        break;
      case 'chevron':
        ctx.beginPath();
        ctx.moveTo(tx, ty + 0.1);
        ctx.lineTo(0, ty + 0.3);
        ctx.lineTo(tx + tw, ty + 0.1);
        ctx.lineTo(tx + tw, ty + 0.24);
        ctx.lineTo(0, ty + 0.44);
        ctx.lineTo(tx, ty + 0.24);
        ctx.closePath();
        ctx.fill();
        break;
      default:
        ctx.fillRect(tx, ty + th - 0.08, tw, 0.08);
    }
  } else {
    ctx.fillRect(tx, ty + 0.18, tw, 0.06);
  }
  // shading
  const g = ctx.createLinearGradient(tx, 0, tx + tw, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.25)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(tx, ty, tw, th);
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = lw;
  roundRect(ctx, tx, ty, tw, th, 0.12);
  ctx.stroke();
  // number
  if (S > 18) {
    ctx.fillStyle = look.isGK ? '#111' : jersey2 === jersey ? '#fff' : jersey2;
    if (!look.isGK && (kit.pattern === 'stripes' || kit.pattern === 'half' || kit.pattern === 'hoops')) ctx.fillStyle = '#fff';
    ctx.save();
    ctx.scale((pose.facingLeft ? -1 : 1) / S, 1 / S);
    ctx.font = `${0.3 * S}px "Russo One", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 0.05 * S;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(String(look.number), 0, -1.3 * S);
    ctx.fillText(String(look.number), 0, -1.3 * S);
    ctx.restore();
  }

  // neck + head
  const hx = 0.03, hy = -1.9;
  ctx.fillStyle = shade(look.skin, -0.15);
  ctx.fillRect(-0.06, -1.7, 0.12, 0.1);
  // afro / long hair behind
  if (look.hairStyle === 2) {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.arc(hx - 0.02, hy - 0.06, 0.37, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = lw;
    ctx.stroke();
  } else if (look.hairStyle === 5) {
    ctx.fillStyle = look.hair;
    roundRect(ctx, hx - 0.3, hy - 0.2, 0.3, 0.52, 0.1);
    ctx.fill();
  }
  ctx.fillStyle = look.skin;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(hx, hy, 0.27, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // beard
  if (look.beard) {
    ctx.fillStyle = shade(look.hair, 0.05);
    ctx.beginPath();
    ctx.arc(hx + 0.02, hy + 0.04, 0.24, 0.1, Math.PI - 0.6);
    ctx.fill();
  }
  // hair
  ctx.fillStyle = look.hair;
  switch (look.hairStyle) {
    case 0: // short
    case 5:
      ctx.beginPath();
      ctx.arc(hx, hy - 0.02, 0.285, Math.PI * 0.95, Math.PI * 2.08);
      ctx.closePath();
      ctx.fill();
      break;
    case 1: // buzz
      ctx.beginPath();
      ctx.arc(hx, hy, 0.275, Math.PI * 1.05, Math.PI * 1.95);
      ctx.closePath();
      ctx.fill();
      break;
    case 3: // mohawk
      ctx.beginPath();
      ctx.moveTo(hx - 0.2, hy - 0.18);
      ctx.lineTo(hx - 0.05, hy - 0.48);
      ctx.lineTo(hx + 0.05, hy - 0.26);
      ctx.lineTo(hx + 0.15, hy - 0.42);
      ctx.lineTo(hx + 0.2, hy - 0.2);
      ctx.closePath();
      ctx.fill();
      break;
    case 4: // bald: shine
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(hx - 0.07, hy - 0.15, 0.08, 0.05, -0.4, 0, TAU);
      ctx.fill();
      break;
    case 6: // headband + spikes
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + (i / 4) * Math.PI;
        ctx.lineTo(hx + Math.cos(a) * 0.3, hy - 0.02 + Math.sin(a) * 0.3);
        const a2 = a + Math.PI / 8;
        ctx.lineTo(hx + Math.cos(a2) * 0.42, hy - 0.02 + Math.sin(a2) * 0.42);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = look.isGK ? '#fff' : kit.secondary;
      ctx.fillRect(hx - 0.27, hy - 0.13, 0.54, 0.07);
      break;
  }
  // eye + brow
  ctx.fillStyle = '#121218';
  ctx.beginPath();
  ctx.ellipse(hx + 0.15, hy - 0.01, 0.035, 0.05, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,10,0.8)';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  if (pose.state === 'down') {
    // X eyes
    ctx.moveTo(hx + 0.11, hy - 0.05);
    ctx.lineTo(hx + 0.19, hy + 0.03);
    ctx.moveTo(hx + 0.19, hy - 0.05);
    ctx.lineTo(hx + 0.11, hy + 0.03);
  } else if (pose.state === 'shove' || pose.state === 'slide' || pose.charge > 0.5) {
    ctx.moveTo(hx + 0.08, hy - 0.12);
    ctx.lineTo(hx + 0.22, hy - 0.07);
  } else if (pose.state === 'sad') {
    ctx.moveTo(hx + 0.08, hy - 0.07);
    ctx.lineTo(hx + 0.22, hy - 0.11);
  } else {
    ctx.moveTo(hx + 0.08, hy - 0.1);
    ctx.lineTo(hx + 0.22, hy - 0.1);
  }
  ctx.stroke();
  // mouth when celebrating / shouting
  if (pose.state === 'celebrate' || pose.state === 'shove') {
    ctx.fillStyle = '#3a0d0d';
    ctx.beginPath();
    ctx.ellipse(hx + 0.17, hy + 0.12, 0.06, 0.05, 0, 0, TAU);
    ctx.fill();
  }

  ctx.restore(); // lean

  drawArm(armA, false);

  ctx.restore();

  if (starHead) {
    // circling stars above the knocked-out head (screen space, not rotated)
    const t = pose.stateT;
    const headX = (pose.facingLeft ? 1 : -1) * 1.45 * S;
    const headY = -0.25 * S;
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * TAU) / 3;
      drawStar(ctx, headX + Math.cos(a) * 0.35 * S, headY - 0.35 * S + Math.sin(a) * 0.12 * S, 0.11 * S, a, '#ffe36e');
    }
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawBallSprite(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, fire: boolean) {
  if (fire) {
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3.2);
    g.addColorStop(0, 'rgba(255,220,120,0.9)');
    g.addColorStop(0.4, 'rgba(255,120,30,0.5)');
    g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.2, 0, TAU);
    ctx.fill();
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fire ? '#fff3d0' : '#fbfbfb';
  ctx.fill();
  ctx.clip();
  // rotating panels
  ctx.fillStyle = fire ? '#a63c00' : '#1a1a22';
  const off = (rot % TAU) / TAU;
  for (let i = -1; i <= 2; i++) {
    const px = x + ((off + i * 0.5) * 2 - 1) * r * 1.4;
    for (const py of [y - r * 0.55, y + r * 0.65]) {
      ctx.beginPath();
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * TAU - Math.PI / 2;
        ctx.lineTo(px + Math.cos(a) * r * 0.32, py + Math.sin(a) * r * 0.32);
      }
      ctx.fill();
    }
  }
  const px = x + ((off + 0.25) * 2 - 1) * r * 1.4;
  ctx.beginPath();
  for (let j = 0; j < 5; j++) {
    const a = (j / 5) * TAU - Math.PI / 2;
    ctx.lineTo(px + Math.cos(a) * r * 0.36, y + Math.sin(a) * r * 0.36);
  }
  ctx.fill();
  // shading
  const sg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  sg.addColorStop(0, 'rgba(255,255,255,0.55)');
  sg.addColorStop(0.5, 'rgba(255,255,255,0)');
  sg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = sg;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}
