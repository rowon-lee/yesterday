// 휘는 무기(백은우 연검) 판정 선을 동작 그림의 리본에서 뽑아 src/data/moves/lines.ts에 적는다 (사용자 피드백 2026-11-02 11-0:
// "판정 = 그 프레임 리본 위의 6~8점을 이은 선, 공격 데이터에 적는다"). 리본 모양은 anim/follow.ts가 미리 계산한 값이라 같은 동작이면 늘 같다.
//   node tools/ribbon-lines.mjs          다시 뽑아 쓴다 (동작 그림이나 리본 박자를 고친 뒤)
//   node tools/ribbon-lines.mjs --check  적힌 값이 지금 그림과 같은지만 본다 (다르면 실패)
// 리본(follow.ribbon)이 있는 동작 중 기술이 쓰는 동작의 판정 프레임마다 점 8개 (손, 손잡이 끝, 날 마디 끝 6개).
// 함께 기술마다 리치(몸 이동 + 선 끝, 몸 중심 기준 px)를 표로 보인다.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const check = process.argv.includes('--check');
/** 리본 점 10개 중 판정 선에 쓰는 점 */
const PICK = [0, 1, 3, 4, 5, 6, 8, 9];
const FILE = 'src/data/moves/lines.ts';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { MOTIONS } = await vite.ssrLoadModule('/src/anim/motions.ts');
const { CHARACTERS } = await vite.ssrLoadModule('/src/data/characters/index.ts');
const { BASE_MOVES } = await vite.ssrLoadModule('/src/data/moves/base.ts');
await vite.close();

const byName = new Map(MOTIONS.map((m) => [m.name, m]));
const lines = {};
const used = [];
for (const [cid, c] of Object.entries(CHARACTERS)) {
  for (const [id, own] of Object.entries(c.moves ?? {})) {
    const d = { ...BASE_MOVES[id], ...own };
    const m = byName.get(d.motion);
    if (!m || !d.active?.length) continue;
    const frames = {};
    for (const f of d.active) {
      const rib = m.joints[f]?.fx?.rib;
      if (rib) frames[f] = PICK.map((k) => [rib[k][0], rib[k][1]]);
    }
    if (!Object.keys(frames).length) continue;
    lines[d.motion] = frames;
    if (d.line) used.push({ cid, id, d, frames });
  }
}

const body = Object.entries(lines)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, fr]) => `  '${name}': {\n${Object.entries(fr).map(([f, pts]) => `    ${f}: [${pts.map(([x, y]) => `[${x}, ${y}]`).join(', ')}],`).join('\n')}\n  },`)
  .join('\n');
const text = `/**
 * 휘는 무기 판정 선 (자동 생성: node tools/ribbon-lines.mjs, 손으로 고치지 않는다).
 * 동작 이름 → 판정 프레임 → 그 프레임 리본 위의 점 8개 (손, 손잡이 끝, 날 마디 끝 6개. 발밑 기준, 오른쪽 보는 기준 px).
 * 기술 데이터의 line으로 쓴다 (data/moves/base.ts MoveData.line). simtest가 지금 동작 그림과 같은지 확인한다
 */
export const RIBBON_LINES: Readonly<Record<string, Readonly<Record<number, ReadonlyArray<readonly [number, number]>>>>> = {
${body}
};
`;

let old = '';
try {
  old = readFileSync(FILE, 'utf8');
} catch {}
if (check) {
  if (old !== text) {
    console.log(`NG  ${FILE}가 지금 동작 그림의 리본과 다르다: node tools/ribbon-lines.mjs로 다시 뽑는다`);
    process.exit(1);
  }
  console.log(`OK  ${FILE} = 지금 동작 그림의 리본`);
} else {
  writeFileSync(FILE, text);
  console.log(`${FILE}: 동작 ${Object.keys(lines).length}개${old === text ? ' (바뀐 것 없음)' : ' (다시 씀)'}`);
}

// 리치 표: 판정 프레임마다 선 끝(가장 앞 x) + 그 프레임까지의 몸 이동
console.log('\n| 기술 | 동작 | 판정 프레임 | 몸 이동(px) | 선 앞끝 x | 리치 | 선 위아래 |');
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const { cid, id, d, frames } of used) {
  for (const [f, pts] of Object.entries(frames)) {
    const adv = (d.advance ?? []).slice(0, Number(f) + 1).reduce((a, b) => a + b, 0);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    console.log(`| ${cid}.${id} | ${d.motion} | ${f} | ${adv} | ${Math.max(...xs)} | ${adv + Math.max(...xs)} | ${Math.min(...ys)}~${Math.max(...ys)} |`);
  }
}
