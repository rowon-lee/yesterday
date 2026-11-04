// 연검 판정 선과 그림 리본의 차이 보고 (3-0a(2) 뒤): 판정 선은 공격 데이터(data/moves/time.ts hits[].line)에 따로 있고 그림과 묶이지 않는다.
// 그림(연검 리본)을 다시 깎았을 때 판정 선과 얼마나 어긋났는지 숫자로만 본다 (애니메이션 재수정 지침 4장: 8px 넘게 어긋나면 표에 적고,
// 판정을 고칠지는 사용자가 정한다). 파일을 쓰지 않는다.
//   node tools/ribbon-lines.mjs
// 판정 구간마다: 그 구간이 시작하는 틱의 그림 프레임 리본 점 8개(손, 손잡이 끝, 날 마디 끝 6개)와 데이터 선 점 8개의 가장 큰 차이(px)
import { createServer } from 'vite';

/** 리본 점 10개 중 판정 선에 쓰던 점 */
const PICK = [0, 1, 3, 4, 5, 6, 8, 9];
const LIMIT = 8;

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const sim = await vite.ssrLoadModule('/src/sim/index.ts');
const anim = await vite.ssrLoadModule('/src/render/pose.ts');
await vite.close();

console.log('| 캐릭터.기술 | 동작 | 판정 구간 (틱) | 그림 프레임 | 가장 큰 차이 (px) |');
console.log('| --- | --- | --- | --- | --- |');
let over = 0;
for (const c of sim.CHAR_IDS) {
  for (const [id, mv] of Object.entries(sim.movesOf(c))) {
    const A = anim.moveAnim(mv);
    for (const h of mv.time.hits) {
      if (!h.line) continue;
      const f = anim.animFrameAt(A, h.t[0]);
      const rib = A.joints[f]?.fx?.rib;
      let diff = '리본 없음';
      if (rib) {
        const d = Math.max(...PICK.map((k, i) => Math.hypot(rib[k][0] - h.line[i][0], rib[k][1] - h.line[i][1])));
        diff = `${Math.round(d * 10) / 10}${d > LIMIT ? ' ⚠' : ''}`;
        if (d > LIMIT) over++;
      }
      console.log(`| ${c}.${id} | ${mv.time.motion} | ${h.t[0]}~${h.t[1]} | ${f + 1} | ${diff} |`);
    }
  }
}
console.log(over ? `\n${LIMIT}px 넘게 어긋난 구간 ${over}개 (판정을 고칠지는 사용자가 정한다)` : `\n모두 ${LIMIT}px 안`);
