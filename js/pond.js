(() => {
'use strict';

const canvas = document.getElementById('pond');
let ctx;
try { ctx = canvas.getContext('2d', { colorSpace: 'display-p3' }); } catch (e) { ctx = null; }
if (!ctx) ctx = canvas.getContext('2d');
const hint = document.getElementById('hint');
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const angleDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};

let W = 0, H = 0, DPR = 1;

// ---------- static water background ----------
const bg = document.createElement('canvas');
function renderBg() {
  bg.width = W; bg.height = H;
  const b = bg.getContext('2d');
  const g = b.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
  g.addColorStop(0, '#57e8ab');
  g.addColorStop(0.45, '#35d195');
  g.addColorStop(0.8, '#18a87a');
  g.addColorStop(1, '#0c7c5c');
  b.fillStyle = g;
  b.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    const x = rand(0, W), y = rand(0, H), r = rand(60, 260) * DPR;
    const rg = b.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(4,58,36,0.12)');
    rg.addColorStop(1, 'rgba(4,58,36,0)');
    b.fillStyle = rg;
    b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill();
  }
  for (let i = 0; i < 18; i++) {
    const x = rand(0, W), y = rand(0, H), r = rand(40, 200) * DPR;
    const rg = b.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(215,255,225,0.09)');
    rg.addColorStop(1, 'rgba(215,255,225,0)');
    b.fillStyle = rg;
    b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill();
  }
}

// ---------- animated light caustics ----------
const cvs = document.createElement('canvas');
const CW = 160, CH = 90;
cvs.width = CW; cvs.height = CH;
const cctx = cvs.getContext('2d');
const cimg = cctx.createImageData(CW, CH);
function renderCaustics(t) {
  const d = cimg.data;
  let p = 0;
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const v = Math.sin(x * 0.32 + t * 1.3 + Math.sin(y * 0.21 + t * 0.8) * 2.0)
              + Math.sin(y * 0.27 - t * 1.1 + Math.sin(x * 0.19 - t * 0.6) * 2.0)
              + Math.sin((x + y) * 0.16 + t * 0.9);
      const c = Math.pow(Math.max(0, v / 3), 6) * 255;
      d[p++] = c; d[p++] = c; d[p++] = c; d[p++] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
}

// ---------- koi ----------
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

// Koi silhouette from above: blunt snout, fullest just behind the head,
// then a long taper into a slim tail wrist.
function bodyWidth(t) {
  const tp = 0.30;
  if (t < tp) {
    const u = t / tp;
    return 0.42 + 0.58 * Math.pow(Math.sin(u * Math.PI / 2), 0.85);
  }
  const u = (t - tp) / (1 - tp);
  return 1 - 0.80 * Math.pow(u, 1.45);
}

const PALETTES = [
  { base: '#fbf7ec', patches: ['#d83527'] },                    // kohaku (red on white)
  { base: '#fbf7ec', patches: ['#d83527', '#ef7d24'] },         // kohaku-orange
  { base: '#ef7d24', patches: ['#fbf7ec'] },                    // hi (white on orange)
  { base: '#2a2a30', patches: ['#d83527', '#f2eee2'] },         // showa (red/white on black)
  { base: '#f2eee2', patches: ['#2a2a30', '#d83527'] },         // calico
  { base: '#f2eee2', patches: ['#2a2a30'] },                    // shiro utsuri (black on white)
  { base: '#e9c64f', patches: ['#f6e7a8', '#d8a928'] },         // yamabuki (golden)
];

// soft-edged, irregular marking rendered once, then blitted each frame
function makePatchSprite(color, r) {
  const R = Math.ceil(r * 2.4);
  const c = document.createElement('canvas');
  c.width = c.height = R * 2;
  const x = c.getContext('2d');
  for (let i = 0; i < 5; i++) {
    const bx = R + rand(-r * 0.38, r * 0.38);
    const by = R + rand(-r * 0.38, r * 0.38);
    const br = r * rand(0.55, 1.0);
    const g = x.createRadialGradient(bx, by, br * 0.3, bx, by, br);
    g.addColorStop(0, color);
    g.addColorStop(0.82, color);
    g.addColorStop(1, hexA(color, 0));
    x.fillStyle = g;
    x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fill();
  }
  return c;
}

function makeGlowSprite(color, r) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(r * 2);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, color);
  g.addColorStop(1, hexA(color, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

function makePatches(palette, segs, halfW) {
  const n = 2 + Math.floor(Math.random() * 3);
  const slots = [];
  for (let i = 3; i < segs - 3; i++) slots.push(i);
  const out = [];
  for (let i = 0; i < n && slots.length; i++) {
    const idx = slots.splice(Math.floor(Math.random() * slots.length), 1)[0];
    if (out.some((p) => Math.abs(p.i - idx) < 2)) continue;
    const r = halfW * rand(0.85, 1.5);
    out.push({
      i: idx,
      side: rand(-0.28, 0.28),
      r,
      rot: rand(-0.4, 0.4),
      sprite: makePatchSprite(pick(palette.patches), r),
    });
  }
  return out;
}

// fan fin with rays; root at (x,y), opens along ang with spread `sweep`
function drawFanFin(c, x, y, ang, len, sweep, alpha, color) {
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y);
  c.arc(x, y, len, ang - sweep / 2, ang + sweep / 2);
  c.closePath();
  c.fill();
  c.globalAlpha = Math.min(1, alpha * 0.9);
  c.strokeStyle = 'rgba(25,35,35,0.28)';
  c.lineWidth = Math.max(0.6, DPR * 0.7);
  for (let i = 1; i < 6; i++) {
    const a = ang - sweep / 2 + (sweep * i) / 6;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * len * 0.96, y + Math.sin(a) * len * 0.96);
    c.stroke();
  }
  c.restore();
}

class Koi {
  constructor() {
    this.x = rand(W * 0.15, W * 0.85);
    this.y = rand(H * 0.15, H * 0.85);
    this.angle = rand(0, TAU);
    this.len = rand(54, 96) * DPR;
    this.segs = 14;
    this.spacing = this.len / this.segs;
    this.fat = rand(0.145, 0.175);
    this.baseSpeed = rand(24, 44) * DPR;
    this.speed = this.baseSpeed;
    this.turn = rand(-1, 1);
    this.phase = rand(0, TAU);
    this.dart = 0;
    this.depth = rand(0, 1);                 // swim depth: tint + shadow offset
    this.palette = pick(PALETTES);
    this.halfW = this.len * this.fat;
    this.patches = makePatches(this.palette, this.segs, this.halfW);
    this.scaleStroke = luminance(this.palette.base) > 0.5
      ? 'rgba(80,80,70,0.07)'
      : 'rgba(255,255,255,0.06)';
    this.finColor = this.palette.base;
    this.sheen = makeGlowSprite('rgba(255,255,255,0.55)', Math.ceil(this.halfW * 2.2));
    this.finPhase = rand(0, TAU);
    this.spine = [];
    for (let i = 0; i <= this.segs; i++) {
      this.spine.push({
        x: this.x - Math.cos(this.angle) * i * this.spacing,
        y: this.y - Math.sin(this.angle) * i * this.spacing,
      });
    }
  }

  scare(fromX, fromY) {
    const d = Math.hypot(this.x - fromX, this.y - fromY);
    if (d < 170 * DPR) {
      this.dart = 1;
      this.angle = Math.atan2(this.y - fromY, this.x - fromX) + rand(-0.4, 0.4);
    }
  }

  update(dt, pointer) {
    this.turn += (rand(-1, 1) - this.turn * 0.55) * dt * 1.6;
    let steer = this.turn * 0.5;

    const m = Math.min(W, H) * 0.13;
    const distWall = Math.min(this.x, this.y, W - this.x, H - this.y);
    if (distWall < m) {
      const away = Math.atan2(H / 2 - this.y, W / 2 - this.x);
      steer += angleDiff(away, this.angle) * (1 - Math.max(0, distWall) / m) * 2.4;
    }

    if (pointer.active) {
      const dx = pointer.x - this.x, dy = pointer.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > this.len * 1.4) {
        const want = Math.atan2(dy, dx);
        steer += angleDiff(want, this.angle) * 1.5 * Math.min(1, (320 * DPR) / d);
      }
    }

    this.angle += steer * dt * 2.6;

    this.dart = Math.max(0, this.dart - dt * 1.8);
    const target = this.baseSpeed * (1 + this.dart * 3.4);
    this.speed += (target - this.speed) * Math.min(1, dt * 3);
    this.phase += dt * (2.0 + this.speed / (13 * DPR));

    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    this.spine[0].x = this.x;
    this.spine[0].y = this.y;
    for (let i = 1; i <= this.segs; i++) {
      const p = this.spine[i], q = this.spine[i - 1];
      const dx = p.x - q.x, dy = p.y - q.y;
      const d = Math.hypot(dx, dy) || 1;
      p.x = q.x + (dx / d) * this.spacing;
      p.y = q.y + (dy / d) * this.spacing;
    }
  }

  drawPts() {
    const pts = [];
    for (let i = 0; i <= this.segs; i++) {
      const p = this.spine[i];
      const q = this.spine[Math.max(0, i - 1)];
      const ang = Math.atan2(p.y - q.y, p.x - q.x);
      // traveling wave: head stays almost still, the tail sweeps wide
      const amp = this.spacing * (0.05 + 0.5 * Math.pow(i / this.segs, 1.6));
      const sway = Math.sin(this.phase - i * 0.62) * amp;
      pts.push({
        x: p.x + Math.cos(ang + Math.PI / 2) * sway,
        y: p.y + Math.sin(ang + Math.PI / 2) * sway,
        ang,
      });
    }
    return pts;
  }

  bodyPath(pts) {
    const path = new Path2D();
    const left = [], right = [];
    for (let i = 0; i <= this.segs; i++) {
      const w = bodyWidth(i / this.segs) * this.halfW;
      const nx = Math.cos(pts[i].ang + Math.PI / 2);
      const ny = Math.sin(pts[i].ang + Math.PI / 2);
      left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
      right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
    }
    path.moveTo(left[0].x, left[0].y);
    for (const p of left) path.lineTo(p.x, p.y);
    for (let i = this.segs; i >= 0; i--) path.lineTo(right[i].x, right[i].y);
    path.closePath();
    return path;
  }

  drawTail(c, pts) {
    const tail = pts[this.segs];
    const flutter = Math.sin(this.phase - this.segs * 0.62) * 0.22;
    const ang = tail.ang + flutter;
    const tl = this.len * 0.36;
    const spread = 0.46;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const tipA = { x: tail.x + Math.cos(ang + spread) * tl, y: tail.y + Math.sin(ang + spread) * tl };
    const tipB = { x: tail.x + Math.cos(ang - spread) * tl, y: tail.y + Math.sin(ang - spread) * tl };
    const notch = { x: tail.x + dx * tl * 0.42, y: tail.y + dy * tl * 0.42 };
    c.save();
    c.globalAlpha = 0.72;
    c.fillStyle = this.palette.base;
    c.beginPath();
    c.moveTo(tail.x, tail.y);
    c.quadraticCurveTo(
      tail.x + Math.cos(ang + spread * 1.7) * tl * 0.62,
      tail.y + Math.sin(ang + spread * 1.7) * tl * 0.62,
      tipA.x, tipA.y
    );
    c.quadraticCurveTo(tail.x + dx * tl * 0.8, tail.y + dy * tl * 0.8, notch.x, notch.y);
    c.quadraticCurveTo(tail.x + dx * tl * 0.8, tail.y + dy * tl * 0.8, tipB.x, tipB.y);
    c.quadraticCurveTo(
      tail.x + Math.cos(ang - spread * 1.7) * tl * 0.62,
      tail.y + Math.sin(ang - spread * 1.7) * tl * 0.62,
      tail.x, tail.y
    );
    c.fill();
    c.globalAlpha = 0.5;
    c.strokeStyle = 'rgba(25,35,35,0.30)';
    c.lineWidth = Math.max(0.6, DPR * 0.7);
    for (const f of [-0.85, -0.45, 0, 0.45, 0.85]) {
      const a = ang + f * spread;
      const rl = tl * (f === 0 ? 0.42 : 0.96);
      c.beginPath();
      c.moveTo(tail.x, tail.y);
      c.lineTo(tail.x + Math.cos(a) * rl, tail.y + Math.sin(a) * rl);
      c.stroke();
    }
    c.restore();
  }

  draw(c) {
    const pts = this.drawPts();
    const path = this.bodyPath(pts);

    // shadow on the pond floor
    c.save();
    c.translate((5 + this.depth * 7) * DPR, (9 + this.depth * 9) * DPR);
    c.fillStyle = `rgba(4,38,38,${0.15 + this.depth * 0.08})`;
    c.filter = `blur(${3 * DPR}px)`;
    c.fill(path);
    c.restore();

    // tail fin
    this.drawTail(c, pts);

    // pectoral fins behind the gills, smaller pelvic fins midway back
    const pec = pts[3];
    const pecW = bodyWidth(3 / this.segs) * this.halfW;
    for (const s of [-1, 1]) {
      const nx = Math.cos(pec.ang + Math.PI / 2), ny = Math.sin(pec.ang + Math.PI / 2);
      const fa = pec.ang + s * (Math.PI * 0.62) + Math.sin(this.finPhase + this.phase * 1.3) * 0.14 * s;
      drawFanFin(
        c,
        pec.x + nx * pecW * 0.55 * s, pec.y + ny * pecW * 0.55 * s,
        fa, this.len * 0.26, 1.05, 0.5, this.finColor
      );
    }
    const pel = pts[8];
    for (const s of [-1, 1]) {
      const fa = pel.ang + s * (Math.PI * 0.66) + Math.sin(this.finPhase + this.phase * 1.1 + 1) * 0.1 * s;
      drawFanFin(c, pel.x, pel.y, fa, this.len * 0.15, 0.8, 0.38, this.finColor);
    }

    // body
    c.fillStyle = this.palette.base;
    c.fill(path);

    // everything below is clipped inside the silhouette
    c.save();
    c.clip(path);

    // scale rows
    c.strokeStyle = this.scaleStroke;
    c.lineWidth = Math.max(0.6, DPR * 0.8);
    for (let i = 2; i < this.segs - 1; i++) {
      const pt = pts[i];
      const hw = bodyWidth(i / this.segs) * this.halfW;
      const nx = Math.cos(pt.ang + Math.PI / 2), ny = Math.sin(pt.ang + Math.PI / 2);
      for (const off of [-0.52, -0.17, 0.17, 0.52]) {
        c.beginPath();
        c.arc(pt.x + nx * hw * off, pt.y + ny * hw * off, hw * 0.34, pt.ang - 1.15, pt.ang + 1.15);
        c.stroke();
      }
    }

    // markings
    for (const pa of this.patches) {
      const pt = pts[pa.i];
      const hw = bodyWidth(pa.i / this.segs) * this.halfW;
      const nx = Math.cos(pt.ang + Math.PI / 2), ny = Math.sin(pt.ang + Math.PI / 2);
      const R = pa.r * 2.4;
      c.save();
      c.translate(pt.x + nx * pa.side * hw, pt.y + ny * pa.side * hw);
      c.rotate(pt.ang + pa.rot);
      c.drawImage(pa.sprite, -R, -R, R * 2, R * 2);
      c.restore();
    }

    // sheen along the back
    const mid = pts[4];
    c.save();
    c.globalAlpha = 0.16;
    c.translate(mid.x, mid.y);
    c.rotate(mid.ang);
    c.scale(2.6, 1);
    c.drawImage(this.sheen, -this.sheen.width / 2, -this.sheen.height / 2);
    c.restore();

    // underwater tint, deeper fish sit further down
    c.fillStyle = `rgba(10,80,74,${0.05 + this.depth * 0.09})`;
    c.fillRect(0, 0, W, H);

    c.restore();

    // dorsal ridge along the spine
    c.save();
    c.globalAlpha = 0.4;
    c.fillStyle = this.palette.base;
    c.beginPath();
    const d0 = 4, d1 = 9;
    c.moveTo(pts[d0].x, pts[d0].y);
    for (let i = d0; i <= d1; i++) {
      const hw = bodyWidth(i / this.segs) * this.halfW;
      const nx = Math.cos(pts[i].ang + Math.PI / 2), ny = Math.sin(pts[i].ang + Math.PI / 2);
      const ridge = hw * 0.24 * Math.sin(((i - d0) / (d1 - d0)) * Math.PI);
      c.lineTo(pts[i].x + nx * ridge, pts[i].y + ny * ridge);
    }
    for (let i = d1; i >= d0; i--) {
      const hw = bodyWidth(i / this.segs) * this.halfW;
      const nx = Math.cos(pts[i].ang + Math.PI / 2), ny = Math.sin(pts[i].ang + Math.PI / 2);
      const ridge = hw * 0.24 * Math.sin(((i - d0) / (d1 - d0)) * Math.PI);
      c.lineTo(pts[i].x - nx * ridge, pts[i].y - ny * ridge);
    }
    c.closePath();
    c.fill();
    c.restore();

    // outline for definition
    c.strokeStyle = 'rgba(0,50,45,0.20)';
    c.lineWidth = Math.max(0.8, DPR);
    c.stroke(path);

    // head: eyes, mouth, barbels
    const head = pts[0], hd = pts[2];
    const hnx = Math.cos(hd.ang + Math.PI / 2), hny = Math.sin(hd.ang + Math.PI / 2);
    const headW = bodyWidth(2 / this.segs) * this.halfW;
    for (const s of [-1, 1]) {
      const ex = hd.x + hnx * headW * 0.58 * s;
      const ey = hd.y + hny * headW * 0.58 * s;
      c.fillStyle = 'rgba(18,18,16,0.88)';
      c.beginPath(); c.arc(ex, ey, Math.max(1, this.len * 0.017), 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath(); c.arc(ex - this.len * 0.005, ey - this.len * 0.005, Math.max(0.5, this.len * 0.006), 0, TAU); c.fill();
    }
    const mx = head.x + Math.cos(head.ang) * 2 * DPR, my = head.y + Math.sin(head.ang) * 2 * DPR;
    c.strokeStyle = 'rgba(60,30,25,0.5)';
    c.lineWidth = Math.max(0.8, DPR * 0.9);
    c.beginPath();
    c.arc(mx, my, this.len * 0.028, head.ang + Math.PI / 2, head.ang + Math.PI * 1.5);
    c.stroke();
    c.strokeStyle = hexA(luminance(this.palette.base) > 0.5 ? '#8a7a5a' : '#c8b98a', 0.7);
    c.lineWidth = Math.max(0.7, DPR * 0.8);
    for (const s of [-1, 1]) {
      const bx = head.x + hnx * headW * 0.5 * s, by = head.y + hny * headW * 0.5 * s;
      const tipx = head.x + Math.cos(head.ang + s * 0.9) * this.len * 0.075;
      const tipy = head.y + Math.sin(head.ang + s * 0.9) * this.len * 0.075;
      c.beginPath();
      c.moveTo(bx, by);
      c.quadraticCurveTo(
        head.x + Math.cos(head.ang + s * 0.5) * this.len * 0.06,
        head.y + Math.sin(head.ang + s * 0.5) * this.len * 0.06,
        tipx, tipy
      );
      c.stroke();
    }
  }
}
// ---------- ripples ----------
const ripples = [];
function addRipple(x, y, s = 1) {
  ripples.push({ x, y, r: 5 * DPR * s, max: rand(70, 120) * DPR * s, a: 0.55, w: rand(2, 3.2) * DPR });
  if (ripples.length > 60) ripples.shift();
}
function drawRipples(c, dt) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.r += dt * 90 * DPR;
    r.a -= dt * 0.55;
    if (r.a <= 0 || r.r > r.max) { ripples.splice(i, 1); continue; }
    c.strokeStyle = `rgba(235,255,250,${r.a})`;
    c.lineWidth = r.w;
    c.beginPath(); c.arc(r.x, r.y, r.r, 0, TAU); c.stroke();
    c.strokeStyle = `rgba(235,255,250,${r.a * 0.5})`;
    c.lineWidth = r.w * 0.6;
    c.beginPath(); c.arc(r.x, r.y, r.r * 0.62, 0, TAU); c.stroke();
  }
}

// ---------- lily pads, lotus flowers, drifting petals ----------
let pads = [], flowers = [], petals = [], shrubs = [];

class Pad {
  constructor(x, y, r) {
    this.x = x; this.y = y; this.r = r;
    this.rot = rand(0, TAU);
    this.notch = rand(0.4, 0.7);
    this.shade = rand(-12, 12);
  }
  draw(c) {
    const g = 58 + this.shade;
    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.rot);
    // shadow
    c.fillStyle = 'rgba(4,40,36,0.22)';
    c.beginPath();
    c.ellipse(4 * DPR, 7 * DPR, this.r, this.r * 0.92, 0, 0, TAU);
    c.fill();
    // pad
    c.fillStyle = `rgb(${14 + this.shade},${g},${30 + this.shade})`;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, this.r, this.notch / 2, TAU - this.notch / 2);
    c.closePath();
    c.fill();
    // lighter center
    const rg = c.createRadialGradient(0, 0, 0, 0, 0, this.r);
    rg.addColorStop(0, 'rgba(110,190,120,0.30)');
    rg.addColorStop(1, 'rgba(110,190,120,0)');
    c.fillStyle = rg;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, this.r, this.notch / 2, TAU - this.notch / 2);
    c.closePath();
    c.fill();
    // veins
    c.strokeStyle = 'rgba(6,32,18,0.55)';
    c.lineWidth = Math.max(1, this.r * 0.03);
    for (let i = 0; i < 9; i++) {
      const a = this.notch / 2 + 0.25 + (i / 9) * (TAU - this.notch - 0.5);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * this.r * 0.92, Math.sin(a) * this.r * 0.92);
      c.stroke();
    }
    c.restore();
  }
}

class Flower {
  constructor(x, y, r) { this.x = x; this.y = y; this.r = r; this.rot = rand(0, TAU); }
  draw(c) {
    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.rot);
    for (let layer = 0; layer < 2; layer++) {
      const n = layer === 0 ? 7 : 6;
      const rr = this.r * (layer === 0 ? 1 : 0.62);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + layer * 0.5;
        const grd = c.createLinearGradient(0, 0, Math.cos(a) * rr, Math.sin(a) * rr);
        grd.addColorStop(0, '#ffb3ad');
        grd.addColorStop(1, '#e02338');
        c.fillStyle = grd;
        c.save();
        c.rotate(a);
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(rr * 0.42, -rr * 0.34, rr, 0);
        c.quadraticCurveTo(rr * 0.42, rr * 0.34, 0, 0);
        c.fill();
        c.restore();
      }
    }
    c.fillStyle = '#ffd94d';
    c.beginPath(); c.arc(0, 0, this.r * 0.18, 0, TAU); c.fill();
    c.restore();
  }
}

class Petal {
  constructor() {
    this.x = rand(0, W); this.y = rand(0, H);
    this.r = rand(3, 6) * DPR;
    this.rot = rand(0, TAU);
    this.vr = rand(-0.4, 0.4);
    this.vx = rand(-6, 6) * DPR;
    this.vy = rand(-4, 4) * DPR;
    this.leaf = Math.random() < 0.3;
    if (this.leaf) this.r *= rand(1.6, 2.4);
    this.color = this.leaf
      ? pick(['rgba(226,132,36,0.9)', 'rgba(204,102,30,0.9)', 'rgba(160,150,60,0.9)'])
      : 'rgba(249,168,197,0.85)';
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.rot += this.vr * dt;
    if (this.x < -20) this.x = W + 20; if (this.x > W + 20) this.x = -20;
    if (this.y < -20) this.y = H + 20; if (this.y > H + 20) this.y = -20;
  }
  draw(c) {
    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.rot);
    c.fillStyle = this.color;
    c.beginPath();
    c.ellipse(0, 0, this.r * 1.5, this.r * 0.8, 0, 0, TAU);
    c.fill();
    c.restore();
  }
}

class Shrub {
  constructor(x, y, r) {
    this.x = x; this.y = y; this.r = r;
    const R = Math.ceil(r * 2.2);
    this.sprite = document.createElement('canvas');
    this.sprite.width = this.sprite.height = R * 2;
    const x2 = this.sprite.getContext('2d');
    const leaves = 12 + Math.floor(rand(0, 8));
    for (let i = 0; i < leaves; i++) {
      const a = rand(0, TAU);
      const d = rand(0.15, 0.85) * r;
      const lx = R + Math.cos(a) * d, ly = R + Math.sin(a) * d * 0.85;
      const lr = r * rand(0.18, 0.34);
      const g2 = Math.floor(rand(70, 140));
      x2.fillStyle = `rgba(${Math.floor(g2 * 0.35)},${g2},${Math.floor(g2 * 0.45)},${rand(0.75, 0.95)})`;
      x2.save();
      x2.translate(lx, ly);
      x2.rotate(a);
      x2.beginPath();
      x2.ellipse(0, 0, lr * 1.5, lr * 0.7, 0, 0, TAU);
      x2.fill();
      x2.restore();
    }
  }
  draw(c) {
    c.drawImage(this.sprite, this.x - this.sprite.width / 2, this.y - this.sprite.height / 2);
  }
}

function buildScenery() {
  pads = []; flowers = []; petals = []; shrubs = [];
  const scale = Math.max(0.7, Math.min(W, H) / (900 * DPR));
  const band = 0.26 * Math.min(W, H);

  // dense clusters of large dark pads along every edge, a few drifting inward
  const putPad = (x, y, big) => {
    const r = (big ? rand(38, 76) : rand(20, 42)) * DPR * scale;
    pads.push(new Pad(x, y, r));
    if (Math.random() < 0.55) {
      pads.push(new Pad(x + rand(-r * 1.6, r * 1.6), y + rand(-r * 1.2, r * 1.2), r * rand(0.5, 0.85)));
    }
  };
  const topN = Math.max(4, Math.round(W / (220 * DPR * scale)));
  const sideN = Math.max(3, Math.round(H / (220 * DPR * scale)));
  for (let i = 0; i < topN; i++) {
    const x = ((i + rand(-0.3, 0.7)) / topN) * W;
    putPad(x, rand(-30, band * 0.6) * DPR * 0.9, true);
    putPad(x + rand(-50, 50) * DPR, H - rand(-30, band * 0.55) * DPR * 0.9, true);
  }
  for (let i = 0; i < sideN; i++) {
    const y = ((i + rand(-0.3, 0.7)) / sideN) * H;
    putPad(rand(-30, band * 0.55) * DPR * 0.9, y, true);
    putPad(W - rand(-30, band * 0.55) * DPR * 0.9, y + rand(-50, 50) * DPR, true);
  }
  // a few small pads out in the open water
  const openN = Math.round(3 * scale) + 2;
  for (let i = 0; i < openN; i++) {
    putPad(rand(W * 0.25, W * 0.75), rand(H * 0.25, H * 0.75), false);
  }

  // leafy shrubs filling the margins between pads
  const shrubN = Math.round(14 * scale) + 8;
  for (let i = 0; i < shrubN; i++) {
    const edge = Math.floor(rand(0, 4));
    const inset = rand(-14, band * 0.8) * DPR * 0.9;
    let x, y;
    if (edge === 0) { x = rand(0, W); y = inset; }
    else if (edge === 1) { x = rand(0, W); y = H - inset; }
    else if (edge === 2) { x = inset; y = rand(0, H); }
    else { x = W - inset; y = rand(0, H); }
    shrubs.push(new Shrub(x, y, rand(26, 52) * DPR * scale));
  }

  // red lotus flowers resting on pads
  const flowerCount = Math.round(5 * scale) + 4;
  for (let i = 0; i < flowerCount; i++) {
    const p = pads[Math.floor(rand(0, pads.length))];
    flowers.push(new Flower(p.x + rand(-14, 14) * DPR, p.y + rand(-14, 14) * DPR, rand(10, 18) * DPR * scale));
  }

  for (let i = 0; i < 18; i++) petals.push(new Petal());
}

// ---------- pointer interaction ----------
const pointer = { x: 0, y: 0, active: false, downAt: 0 };
let lastRippleAt = 0;

function hideHint() { if (hint) hint.classList.add('hidden'); }

canvas.addEventListener('pointerdown', (e) => {
  pointer.x = e.clientX * DPR;
  pointer.y = e.clientY * DPR;
  pointer.active = true;
  pointer.downAt = performance.now();
  addRipple(pointer.x, pointer.y, 1.2);
  hideHint();
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointer.active) return;
  pointer.x = e.clientX * DPR;
  pointer.y = e.clientY * DPR;
  const now = performance.now();
  if (now - lastRippleAt > 90) {
    addRipple(pointer.x, pointer.y, 0.8);
    lastRippleAt = now;
  }
});
function endPointer(e) {
  if (!pointer.active) return;
  pointer.active = false;
  const quick = performance.now() - pointer.downAt < 240;
  if (quick && e.clientX !== undefined) {
    const x = e.clientX * DPR, y = e.clientY * DPR;
    addRipple(x, y, 1.5);
    for (const f of fish) f.scare(x, y);
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', () => { pointer.active = false; });


// ---------- weather & time of day ----------
const state = { weather: 'sunny', time: 'day' };
try {
  const saved = JSON.parse(localStorage.getItem('koi-pond-settings') || '{}');
  if (saved.weather) state.weather = saved.weather;
  if (saved.time) state.time = saved.time;
} catch (e) {}
const qp = new URLSearchParams(location.search);
if (qp.get('weather')) state.weather = qp.get('weather');
if (qp.get('time')) state.time = qp.get('time');

function saveState() {
  try { localStorage.setItem('koi-pond-settings', JSON.stringify(state)); } catch (e) {}
}

const fireflies = [];
function buildFireflies() {
  fireflies.length = 0;
  for (let i = 0; i < 9; i++) {
    fireflies.push({
      x: rand(0, W), y: rand(0, H),
      a: rand(0, TAU), speed: rand(10, 26) * DPR, blink: rand(0, TAU),
    });
  }
}

function updateWeather(dt) {
  if (state.weather === 'rain') {
    for (let i = 0; i < 2; i++) {
      if (Math.random() < 0.55) {
        ripples.push({
          x: rand(0, W), y: rand(0, H),
          r: 2 * DPR, max: rand(18, 42) * DPR, a: 0.5, w: rand(1, 1.8) * DPR,
        });
      }
    }
    while (ripples.length > 110) ripples.shift();
  }
  if (state.time === 'night') {
    for (const f of fireflies) {
      f.a += rand(-1, 1) * dt * 1.5;
      f.x += Math.cos(f.a) * f.speed * dt;
      f.y += Math.sin(f.a) * f.speed * dt;
      f.blink += dt * 2;
      if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20;
      if (f.y < -20) f.y = H + 20; if (f.y > H + 20) f.y = -20;
    }
  }
}

function drawMood(c) {
  if (state.time === 'sunset') {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255,140,50,0.20)');
    g.addColorStop(0.6, 'rgba(255,90,60,0.10)');
    g.addColorStop(1, 'rgba(90,20,120,0.18)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  } else if (state.time === 'night') {
    c.fillStyle = 'rgba(6,16,58,0.42)';
    c.fillRect(0, 0, W, H);
    const mg = c.createRadialGradient(W * 0.78, H * 0.16, 0, W * 0.78, H * 0.16, Math.min(W, H) * 0.4);
    mg.addColorStop(0, 'rgba(200,220,255,0.22)');
    mg.addColorStop(1, 'rgba(200,220,255,0)');
    c.fillStyle = mg; c.fillRect(0, 0, W, H);
  }
  if (state.weather === 'cloudy') {
    c.fillStyle = 'rgba(70,90,100,0.16)';
    c.fillRect(0, 0, W, H);
  } else if (state.weather === 'rain') {
    c.fillStyle = 'rgba(40,60,80,0.20)';
    c.fillRect(0, 0, W, H);
  }
  if (state.time === 'night') {
    for (const f of fireflies) {
      const glow = Math.max(0, Math.sin(f.blink)) ** 2;
      if (glow < 0.05) continue;
      const r = (2.2 + glow * 2) * DPR;
      const fg = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 4);
      fg.addColorStop(0, `rgba(255,240,150,${0.9 * glow})`);
      fg.addColorStop(1, 'rgba(255,240,150,0)');
      c.fillStyle = fg;
      c.beginPath(); c.arc(f.x, f.y, r * 4, 0, TAU); c.fill();
    }
  }
}

// settings panel
const panel = document.getElementById('panel');
const settingsBtn = document.getElementById('settingsBtn');
if (settingsBtn && panel) {
  const syncPanel = () => {
    panel.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.weather === state.weather || b.dataset.time === state.time);
    });
  };
  settingsBtn.addEventListener('click', () => panel.classList.toggle('hidden'));
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.weather) state.weather = b.dataset.weather;
    if (b.dataset.time) state.time = b.dataset.time;
    saveState();
    syncPanel();
  });
  syncPanel();
}

// ---------- setup + main loop ----------
let fish = [];
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.floor(innerWidth * DPR);
  H = Math.floor(innerHeight * DPR);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  renderBg();
  buildScenery();
  buildFireflies();
}
addEventListener('resize', resize);
resize();

const fishCount = Math.max(9, Math.min(18, Math.round((W * H) / (100000 * DPR * DPR))));
for (let i = 0; i < fishCount; i++) fish.push(new Koi());

// a few welcoming ripples
setTimeout(() => addRipple(W * 0.3, H * 0.4), 400);
setTimeout(() => addRipple(W * 0.7, H * 0.6), 900);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  ctx.drawImage(bg, 0, 0);

  renderCaustics(t);
  const causticAlpha = state.time === 'night' ? 0.18 : state.weather === 'cloudy' ? 0.34 : state.time === 'sunset' ? 0.52 : 0.5;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = causticAlpha;
  ctx.drawImage(cvs, 0, 0, W, H);
  ctx.restore();

  for (const f of fish) { f.update(dt, pointer); f.draw(ctx); }
  for (const p of pads) p.draw(ctx);
  for (const sh of shrubs) sh.draw(ctx);
  for (const fl of flowers) fl.draw(ctx);
  for (const pe of petals) { pe.update(dt); pe.draw(ctx); }
  updateWeather(dt);
  drawRipples(ctx, dt);
  drawMood(ctx);

  // gentle vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,40,40,0)');
  vg.addColorStop(1, 'rgba(0,40,40,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// console/testing handle
window.koiPond = { state, ripples, fish, addRipple };
})();
