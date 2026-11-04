// 이펙트 문법 설계 미리보기 (게임 없이 빠르게): 기술마다 피크(또는 지정한 틱)의 모양을 공격자 뼈대·상대 막대와 함께 그린다.
//   node tools/ggpreview.mjs atk1,atk3,atk4,launcher [--t 0,4,8] [--out out/ggpreview]
// 배경은 어두운 남색, 바닥 줄, 공격자는 판정이 시작하는 프레임 관절, 상대는 맞은 점 뒤의 막대 사람. 2배로 저장.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { encodePng } from './png.mjs';

const argv = process.argv.slice(2);
const ids = (argv[0] ?? 'atk1,atk2,atk3,atk4,launcher').split(',');
const ti = argv.indexOf('--t');
const ticks = ti >= 0 ? argv[ti + 1].split(',').map(Number) : [0];
const oi = argv.indexOf('--out');
const outDir = oi >= 0 ? argv[oi + 1] : 'out/ggpreview';
mkdirSync(outDir, { recursive: true });

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const GG = (await vite.ssrLoadModule('/src/vfx/gg/index.ts')).default;
const { RAIDEN_GG } = await vite.ssrLoadModule('/src/data/vfx/raiden.ts');
const F = await vite.ssrLoadModule('/src/sim/frames.ts');
// 그림 박자·관절은 렌더 쪽 (3-0a(2): 판정은 공격 데이터, 그림은 render/pose)
const RP = await vite.ssrLoadModule('/src/render/pose.ts');
await vite.close();
const M = F.movesOf('raiden');

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const RAMP = ['#fff6f8', '#ff526e', '#cd1634', '#46081e', '#ff46c8'];
const rampInt = RAMP.map((h) => {
  const [r, g, b] = hex(h);
  return (255 << 24) | (b << 16) | (g << 8) | r;
});
/** 상대 자리 (공격자 앞 px): 장면에서 본 거리 */
const DEF = { atk1: 52, atk2: 54, atk3: 44, atk4: 47, launcher: 30, sweep: 40, dashAttack: 30, air1: 40, air2: 42, air3: 34, slam: 30, charge: 50, skill2: 30, super: 40 };

const W = 480;
const H = 270;
function render(id, tick) {
  const mv = RAIDEN_GG[id];
  const data = M[id];
  const OX = 180;
  const OY = 200;
  const color = new Uint32Array(W * H);
  const frame = { w: W, h: H, ox: 0, oy: 0, color, light: new Uint32Array(W * H), mark: new Uint8Array(W * H), box: [W, H, -1, -1] };
  const dx = DEF[id] ?? 45;
  const b = data.data.box;
  const hy = Math.max(-46, Math.min(-10, mv.hitY ?? (b ? b.y + b.h / 2 : -30)));
  const hit = [OX + dx - 3, OY + hy];
  const mk = (anchor) => GG({ shapes: mv.shapes.filter((s) => (s.anchor ?? 'self') === anchor), ramp: rampInt, origin: anchor === 'hit' ? hit : [OX, OY], facing: 1, seed: 7 });
  const fxs = [mk('self'), mk('hit')];
  for (const fx of fxs) for (let k = 0; k < tick; k++) fx.update(1 / 60);
  const img = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) img.set(y >= OY ? [22, 20, 30] : [14, 16, 30], (y * W + x) * 3);
  const paintFrame = () => {
    for (let i = 0; i < W * H; i++) {
      const c = color[i];
      if (c >>> 24) img.set([c & 255, (c >>> 8) & 255, (c >>> 16) & 255], i * 3);
    }
    color.fill(0);
  };
  for (const fx of fxs) fx.draw(frame, 'back');
  paintFrame();
  // 막대 사람 (공격자: 관절, 상대: 서 있는 막대)
  const line = (x0, y0, x1, y1, w, rgb) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) + 1;
    for (let s = 0; s <= n; s++) {
      const x = x0 + ((x1 - x0) * s) / n;
      const y = y0 + ((y1 - y0) * s) / n;
      for (let yy = -w; yy <= w; yy++) for (let xx = -w; xx <= w; xx++) {
        const X = Math.round(x + xx);
        const Y = Math.round(y + yy);
        if (X >= 0 && Y >= 0 && X < W && Y < H) img.set(rgb, (Y * W + X) * 3);
      }
    }
  };
  // 판정이 시작하는 틱의 그림 프레임 관절
  const j = RP.moveAnim(data).joints[RP.activeFrames(data)[0] ?? 0];
  if (j) {
    const P = (p) => [OX + p[0], OY + p[1]];
    const ink = [10, 7, 18];
    const body = [217, 58, 60];
    for (const [a, c, w] of [['hip', 'neck', 3], ['shF', 'eF', 2], ['eF', 'hF', 2], ['shB', 'eB', 2], ['eB', 'hB', 2], ['hip', 'kF', 2], ['kF', 'fF', 2], ['hip', 'kB', 2], ['kB', 'fB', 2]]) {
      if (!j[a] || !j[c]) continue;
      const [x0, y0] = P(j[a]);
      const [x1, y1] = P(j[c]);
      line(x0, y0, x1, y1, w, ink);
      line(x0, y0, x1, y1, w - 1, body);
    }
    const [hx, hy2] = P(j.head);
    for (let yy = -6; yy <= 6; yy++) for (let xx = -6; xx <= 6; xx++) if (xx * xx + yy * yy <= 30) img.set(xx * xx + yy * yy > 20 ? [10, 7, 18] : [240, 236, 230], ((hy2 + yy) * W + hx + xx) * 3);
  }
  const DX = OX + dx;
  const cyan = [123, 219, 220];
  line(DX, OY - 40, DX, OY - 20, 2, cyan);
  line(DX, OY - 20, DX - 6, OY, 2, cyan);
  line(DX, OY - 20, DX + 5, OY, 2, cyan);
  line(DX, OY - 36, DX - 8, OY - 28, 2, cyan);
  line(DX, OY - 36, DX + 6, OY - 30, 2, cyan);
  for (let yy = -6; yy <= 6; yy++) for (let xx = -6; xx <= 6; xx++) if (xx * xx + yy * yy <= 30) img.set(cyan, ((OY - 46 + yy) * W + DX + xx) * 3);
  for (const fx of fxs) fx.draw(frame, 'front');
  paintFrame();
  return img;
}
const S = 2;
const cells = [];
for (const id of ids) for (const t of ticks) cells.push({ id, t, img: render(id, t) });
const cols = ticks.length > 1 ? ticks.length : Math.min(2, cells.length);
const rows = Math.ceil(cells.length / cols);
const OW = cols * (W * S + 6) - 6;
const OH = rows * (H * S + 6) - 6;
const out = new Uint8Array(OW * OH * 3).fill(40);
cells.forEach((c, k) => {
  const ox = (k % cols) * (W * S + 6);
  const oy = Math.floor(k / cols) * (H * S + 6);
  for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) {
    const si = (Math.floor(y / S) * W + Math.floor(x / S)) * 3;
    out.set(c.img.subarray(si, si + 3), ((oy + y) * OW + ox + x) * 3);
  }
});
const file = `${outDir}/${ids.join('-')}${ticks.length > 1 ? `-t${ticks.join('_')}` : ''}.png`;
writeFileSync(file, encodePng(OW, OH, out));
console.log(file, `${OW}×${OH}`);
