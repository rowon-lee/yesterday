// 공격 수치표 (동작연출지침서 2장·4장·8장): 타격 프레임의 발 간격·엉덩이 낮춤·몸통 기울기·팔 뻗음·어깨·동작선·리치, 발동·지속·회복 틱
//   node tools/numbers.mjs --char raiden [기술 id …]
// 엉덩이 낮춤은 그 캐릭터 대기 첫 프레임 기준. 끝(동작선·리치를 재는 점)은 무기가 있으면 무기 끝(에드워드 해머 머리), 없으면 치는 팔다리 끝
import { createServer } from 'vite';

const argv = process.argv.slice(2);
const ci = argv.indexOf('--char');
const char = ci >= 0 ? argv[ci + 1] : 'raiden';
const rest = argv.filter((_, i) => i !== ci && i !== ci + 1);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const sim = await vite.ssrLoadModule('/src/sim/index.ts');
// 자세 숫자는 그림(렌더 쪽 관절), 시간·몸 이동·상자는 공격 데이터 (3-0a(2))
const anim = await vite.ssrLoadModule('/src/render/pose.ts');
const ids = rest.length ? rest : ['atk1', 'atk2', 'atk3', 'atk4', 'launcher', 'sweep', 'dashAttack', 'air1', 'air2', 'air3', 'slam', 'wallKick', 'charge', 'skill1', 'skill2', 'super'];
const moves = sim.movesOf(char);
const stanceHip = anim.animOf(sim.motionOf(char, 'idle')).joints[0].hip[1];
const deg = (r) => (r * 180) / Math.PI;
/** 무기 길이 (그림 px): 에드워드 해머 머리까지 (src/anim/decor/edward.ts HAMMER.reach, 2026-11-02 자루 30px) */
const WEAPON = { edward: 30 };
const rows = [];
for (const id of ids) {
  const mv = moves[id];
  if (!mv) continue;
  const d = mv.data;
  // 첫 판정 틱의 그림 프레임
  const A = anim.moveAnim(mv);
  const fr = mv.time.hits.length ? anim.animFrameAt(A, mv.activeStart) : 0;
  const j = A.joints[fr];
  const end = d.limb?.[1] ?? 'hF';
  const tip = WEAPON[char] && typeof j.wa === 'number' ? [j.hF[0] + Math.cos(j.wa) * WEAPON[char], j.hF[1] + Math.sin(j.wa) * WEAPON[char]] : j[end];
  const footGap = j.fF[0] - j.fB[0];
  const hipDrop = j.hip[1] - stanceHip;
  const tilt = deg(Math.atan2(j.neck[0] - j.hip[0], j.hip[1] - j.neck[1]));
  const armF = Math.hypot(j.hF[0] - j.shF[0], j.hF[1] - j.shF[1]) / 18;
  const armB = Math.hypot(j.hB[0] - j.shB[0], j.hB[1] - j.shB[1]) / 18;
  const shFwd = j.shF[0] - j.sh[0];
  // 동작선: 뒷발 → 엉덩이 → 치는 어깨 → 끝, 전체 직선과의 가장 큰 어긋남
  const pts = [j.fB, j.hip, end === 'hB' ? j.shB : j.shF, tip];
  const all = Math.atan2(tip[1] - j.fB[1], tip[0] - j.fB[0]);
  let dev = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
    let dd = Math.abs(deg(a - all));
    if (dd > 180) dd = 360 - dd;
    dev = Math.max(dev, dd);
  }
  const box = d.box;
  rows.push({
    id, motion: d.motion, frames: A.dur.length, ticks: mv.total, startup: mv.activeStart, active: mv.activeEnd - mv.activeStart, recovery: mv.total - mv.activeEnd,
    footGap, hipDrop: +hipDrop.toFixed(1), tilt: +tilt.toFixed(0), armF: +(armF * 100).toFixed(0), armB: +(armB * 100).toFixed(0), shFwd, lineDev: +dev.toFixed(0),
    moved: (mv.time.advance ?? []).reduce((a, [, b]) => a + b, 0), boxEnd: (() => { const h = mv.time.hits[0]?.box; return h ? h[0] + h[2] : box ? box.x + box.w : ''; })(), damage: d.damage,
  });
}
console.table(rows);
await vite.close();
