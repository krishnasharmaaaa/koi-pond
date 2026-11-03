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
  g.addColorStop(0, '#42dcc4');
  g.addColorStop(0.45, '#2cc2ac');
  g.addColorStop(0.8, '#149c8e');
  g.addColorStop(1, '#0b756c');
  b.fillStyle = g;
  b.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    const x = rand(0, W), y = rand(0, H), r = rand(60, 260) * DPR;
    const rg = b.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(5,55,55,0.10)');
    rg.addColorStop(1, 'rgba(5,55,55,0)');
    b.fillStyle = rg;
    b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill();
  }
  for (let i = 0; i < 18; i++) {
    const x = rand(0, W), y = rand(0, H), r = rand(40, 200) * DPR;
    const rg = b.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(190,255,240,0.07)');
    rg.addColorStop(1, 'rgba(190,255,240,0)');
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
function bodyWidth(t) {
  const s = Math.sin(Math.min(1, t * 1.12) * Math.PI);
  return Math.pow(Math.max(0, s), 0.75);
}

const PALETTES = [
  { base: '#fdfdf6', patches: ['#e2483a'] },              // kohaku
  { base: '#fdfdf6', patches: ['#e2483a', '#f5822a'] },   // kohaku-orange
  { base: '#f5822a', patches: ['#fdfdf6'] },              // hi
  { base: '#2b2b30', patches: ['#e2483a', '#f2efe6'] },   // showa
  { base: '#f2efe6', patches: ['#2b2b30', '#e2483a'] },   // calico
];

function makePatches(palette, segs) {
  const n = 1 + Math.floor(Math.random() * 3);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      i: 2 + Math.floor(Math.random() * (segs - 6)),
      side: rand(-0.45, 0.45),
      r: rand(0.28, 0.55),
      color: pick(palette.patches),
    });
  }
  return out;
}

class Koi {
  constructor() {
    this.x = rand(W * 0.15, W * 0.85);
    this.y = rand(H * 0.15, H * 0.85);
    this.angle = rand(0, TAU);
    this.len = rand(50, 88) * DPR;
    this.segs = 13;
    this.spacing = this.len / this.segs;
    this.fat = rand(0.15, 0.19);
    this.baseSpeed = rand(24, 44) * DPR;
    this.speed = this.baseSpeed;
    this.turn = rand(-1, 1);
    this.phase = rand(0, TAU);
    this.dart = 0;
    this.palette = pick(PALETTES);
    this.patches = makePatches(this.palette, this.segs);
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
      const sway = Math.sin(this.phase - i * 0.52) * this.spacing * 0.18 * (i / this.segs);
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
      const w = bodyWidth(i / this.segs) * this.len * this.fat;
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

  draw(c) {
    const pts = this.drawPts();
    const path = this.bodyPath(pts);

    // shadow on the pond floor
    c.save();
    c.translate(7 * DPR, 12 * DPR);
    c.fillStyle = 'rgba(4,38,38,0.20)';
    c.filter = `blur(${3 * DPR}px)`;
    c.fill(path);
    c.restore();

    // tail fin
    const tail = pts[this.segs];
    const tw = this.len * this.fat * 0.9;
    const tl = this.len * 0.34;
    const flutter = Math.sin(this.phase - this.segs * 0.52) * 0.5;
    c.save();
    c.globalAlpha = 0.85;
    c.fillStyle = this.palette.base;
    c.beginPath();
    c.moveTo(tail.x, tail.y);
    c.quadraticCurveTo(
      tail.x - Math.cos(tail.ang) * tl * 0.6 + Math.cos(tail.ang + Math.PI / 2) * tw * (1 + flutter * 0.4),
      tail.y - Math.sin(tail.ang) * tl * 0.6 + Math.sin(tail.ang + Math.PI / 2) * tw * (1 + flutter * 0.4),
      tail.x - Math.cos(tail.ang + flutter * 0.35) * tl,
      tail.y - Math.sin(tail.ang + flutter * 0.35) * tl
    );
    c.quadraticCurveTo(
      tail.x - Math.cos(tail.ang) * tl * 0.6 - Math.cos(tail.ang + Math.PI / 2) * tw * (1 - flutter * 0.4),
      tail.y - Math.sin(tail.ang) * tl * 0.6 - Math.sin(tail.ang + Math.PI / 2) * tw * (1 - flutter * 0.4),
      tail.x, tail.y
    );
    c.fill();
    c.restore();

    // body
    c.fillStyle = this.palette.base;
    c.fill(path);

    // pattern patches clipped to the body
    c.save();
    c.clip(path);
    for (const pa of this.patches) {
      const pt = pts[pa.i];
      const rr = this.len * this.fat * 2 * pa.r;
      const ox = Math.cos(pt.ang + Math.PI / 2) * pa.side * this.len * this.fat;
      const oy = Math.sin(pt.ang + Math.PI / 2) * pa.side * this.len * this.fat;
      c.fillStyle = pa.color;
      c.beginPath();
      c.ellipse(pt.x + ox, pt.y + oy, rr * 1.4, rr, pt.ang, 0, TAU);
      c.fill();
    }
    c.restore();

    // pectoral fins
    const f = pts[2];
    const finLen = this.len * 0.22;
    for (const s of [-1, 1]) {
      const fa = f.ang + s * (Math.PI / 2) + Math.sin(this.phase * 1.7) * 0.25 * s;
      c.save();
      c.globalAlpha = 0.55;
      c.fillStyle = this.palette.base;
      c.beginPath();
      c.ellipse(
        f.x + Math.cos(fa) * finLen * 0.7,
        f.y + Math.sin(fa) * finLen * 0.7,
        finLen * 0.7, finLen * 0.3, fa, 0, TAU
      );
      c.fill();
      c.restore();
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
let pads = [], flowers = [], petals = [];

class Pad {
  constructor(x, y, r) {
    this.x = x; this.y = y; this.r = r;
    this.rot = rand(0, TAU);
    this.notch = rand(0.4, 0.7);
    this.shade = rand(-12, 12);
  }
  draw(c) {
    const g = 96 + this.shade;
    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.rot);
    // shadow
    c.fillStyle = 'rgba(4,40,36,0.22)';
    c.beginPath();
    c.ellipse(4 * DPR, 7 * DPR, this.r, this.r * 0.92, 0, 0, TAU);
    c.fill();
    // pad
    c.fillStyle = `rgb(${34 + this.shade},${g},${62 + this.shade})`;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, this.r, this.notch / 2, TAU - this.notch / 2);
    c.closePath();
    c.fill();
    // lighter center
    const rg = c.createRadialGradient(0, 0, 0, 0, 0, this.r);
    rg.addColorStop(0, 'rgba(140,220,150,0.35)');
    rg.addColorStop(1, 'rgba(140,220,150,0)');
    c.fillStyle = rg;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, this.r, this.notch / 2, TAU - this.notch / 2);
    c.closePath();
    c.fill();
    // veins
    c.strokeStyle = 'rgba(20,70,45,0.45)';
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
        grd.addColorStop(0, '#fff0f5');
        grd.addColorStop(1, '#f26d9e');
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
    c.fillStyle = 'rgba(249,168,197,0.85)';
    c.beginPath();
    c.ellipse(0, 0, this.r * 1.5, this.r * 0.8, 0, 0, TAU);
    c.fill();
    c.restore();
  }
}

function buildScenery() {
  pads = []; flowers = []; petals = [];
  const scale = Math.min(W, H) / (900 * DPR);
  const padCount = Math.round(11 * scale) + 6;
  for (let i = 0; i < padCount; i++) {
    // cluster pads toward the edges
    const edge = Math.floor(rand(0, 4));
    let x, y;
    const inset = rand(-20, 0.28 * Math.min(W, H));
    if (edge === 0) { x = rand(0, W); y = inset; }
    else if (edge === 1) { x = rand(0, W); y = H - inset; }
    else if (edge === 2) { x = inset; y = rand(0, H); }
    else { x = W - inset; y = rand(0, H); }
    pads.push(new Pad(x, y, rand(22, 52) * DPR * Math.max(0.7, scale)));
  }
  const flowerCount = Math.round(3 * scale) + 2;
  for (let i = 0; i < flowerCount; i++) {
    const p = pads[Math.floor(rand(0, pads.length))];
    flowers.push(new Flower(p.x + rand(-14, 14) * DPR, p.y + rand(-14, 14) * DPR, rand(10, 17) * DPR));
  }
  for (let i = 0; i < 10; i++) petals.push(new Petal());
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

const fishCount = Math.max(7, Math.min(14, Math.round((W * H) / (140000 * DPR * DPR))));
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
  const causticAlpha = state.time === 'night' ? 0.14 : state.weather === 'cloudy' ? 0.26 : state.time === 'sunset' ? 0.44 : 0.38;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = causticAlpha;
  ctx.drawImage(cvs, 0, 0, W, H);
  ctx.restore();

  for (const f of fish) { f.update(dt, pointer); f.draw(ctx); }
  for (const p of pads) p.draw(ctx);
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
})();
