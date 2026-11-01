import type { Joints, Point } from '../pose';
import type { Decor } from '../skeleton';

/*
 * 라이덴 표식 (캐릭터 기획서): 샤기컷 머리(삐쭉하게 삐친 선), 정장 재킷 자락과 넥타이.
 * 머리 색은 검정·빨강 (2026-11-01 결정, 처음 기획의 흰 머리에서 바꿈): 검은 윗단에 붉은 윤기 테두리, 붉은 안쪽 머리.
 * 모두 관절에 붙는 도형이라 어떤 동작에서도 따라간다. 오른쪽을 보는 모습 기준 (왼쪽은 시트를 그릴 때 뒤집는다).
 * 왼쪽 눈의 역안은 그리지 않는다 (2026-11-01 결정, CLAUDE.md '눈 그리지 않기').
 */

const add = (a: Point, b: Point, k = 1): Point => [a[0] + b[0] * k, a[1] + b[1] * k];
const norm = (v: Point): Point => {
  const d = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / d, v[1] / d];
};

/** 몸통 방향(엉덩이 → 목)과 몸의 앞쪽 (오른쪽을 볼 때 가슴 쪽) */
function torso(j: Joints): { up: Point; down: Point; front: Point } {
  const up = norm([j.neck[0] - j.hip[0], j.neck[1] - j.hip[1]]);
  return { up, down: [-up[0], -up[1]], front: [-up[1], up[0]] };
}

/**
 * 머리 (샤기컷, 애니메이션 미소년풍): 머리 기준 좌표 [앞 +, 위 +] (머리 반지름 5).
 * 숱 많은 둥근 볼륨에, 가닥 끝이 가늘고 뾰족하게 아래로 떨어진다. 앞머리는 눈을 덮을 만큼 길게(코 높이까지),
 * 볼을 따라 가닥이 내려오고, 뒷머리는 목덜미로 부드럽게 처진다. 위로 몇 가닥이 가볍게 삐친다.
 * 두 겹: 아랫단(검붉은 안쪽 머리) 위에 윗단(검정, 빛 받는 가장자리는 붉은 윤기). 가닥: [뿌리 한쪽, 뿌리 다른 쪽, 끝]
 */
type Lock = readonly [readonly [number, number], readonly [number, number], readonly [number, number]];
/** 아랫단: 목덜미로 처지는 뒷머리 안쪽과 볼 옆으로 내려오는 가닥 */
const UNDER: readonly Lock[] = [
  [[-2.0, 4.0], [-6.8, 1.0], [-6.4, -6.6]],
  [[-4.6, 0.0], [-2.0, -2.6], [-3.8, -8.0]],
  [[1.6, 3.0], [-0.6, 2.0], [0.6, -7.2]],
];
/** 윗단 */
const LOCKS: readonly Lock[] = [
  // 앞머리: 눈을 덮고 코 높이까지, 얼굴 앞으로 살짝 부풀어 나온다
  [[0.4, 6.4], [5.8, 4.0], [6.5, -1.8]],
  [[2.0, 6.0], [5.6, 2.4], [4.4, -3.0]],
  [[0.8, 5.6], [4.0, 3.0], [2.6, -1.8]],
  // 볼을 따라 내려오는 가닥
  [[2.4, 2.6], [0.8, 2.6], [1.8, -5.6]],
  // 뒷머리 윗단: 뒤로 부풀었다가 끝은 아래로
  [[-2.6, 6.2], [-6.8, 2.6], [-7.8, -3.4]],
  [[-5.2, 3.0], [-6.2, -1.0], [-5.8, -6.2]],
];
/** 가볍게 삐친 가닥 (1px): [시작, 끝] */
const WISPS: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [[-1.4, 6.4], [-3.8, 8.6]],
  [[1.2, 6.6], [3.0, 8.4]],
  [[3.4, 2.6], [5.2, -3.8]],
];

export const RAIDEN_DECOR: Decor = {
  /** 정장 재킷: 몸통보다 조금 넓은 몸판, 엉덩이 아래로 내려오는 자락(뒤가 조금 길다), 가슴의 흰 셔츠 깃과 붉은 넥타이 */
  body(pen, j) {
    const { down, front } = torso(j);
    const top = add(j.neck, down, 1.5);
    // 자락은 몸이 기울어도 아래로 처지게 몸통 방향에 중력을 섞는다. 등 쪽이 넓고, 뒷자락이 엉덩이 아래로 길게 뒤로 벌어진다
    const hang = norm([down[0] * 0.6, down[1] * 0.6 + 0.4]);
    pen.fill('cloth', (s) => s.poly([
      add(top, front, 2.4),
      add(top, front, -3.6),
      add(j.hip, front, -4.6),
      add(add(j.hip, front, -6), hang, 9),
      add(add(j.hip, front, -1.5), hang, 7),
      add(add(j.hip, front, 2.4), hang, 4.5),
    ]));
    // 셔츠 깃: 목 아래 앞쪽의 좁은 V
    pen.fill('trim', (s) => s.poly([add(top, front, 0.4), add(top, front, 2.8), add(add(top, down, 5), front, 2)]));
    // 넥타이: 매듭에서 가슴 아래까지
    const knot = add(add(top, down, 1), front, 1.6);
    pen.fill('accent', (s) => {
      s.disc(knot, 1);
      s.line(knot, add(add(top, down, 9), front, 1.8), 2);
    });
  },
  /** 머리: 아랫단(붉은 안쪽 머리) → 둥근 볼륨과 윗단 가닥 → 삐친 가닥 */
  head(pen, j) {
    const c = j.head;
    const r = j.ha;
    // 머리 기준 좌표 → 그림 좌표 (위 = 머리 기울기 방향, 앞 = 위를 시계 방향으로 90°)
    const u: Point = [Math.sin(r), -Math.cos(r)];
    const f: Point = [-u[1], u[0]];
    const at = (p: readonly [number, number]): Point => [c[0] + f[0] * p[0] + u[0] * p[1], c[1] + f[1] * p[0] + u[1] * p[1]];
    pen.fill('hairBack', (s) => {
      for (const [a, b, tip] of UNDER) s.poly([at(a), at(b), at(tip)]);
    });
    pen.fill('hair', (s) => {
      // 볼륨: 머리보다 조금 크고 위·뒤로 부푼 둥근 덩어리 (얼굴 쪽 아래는 남긴다)
      const o = at([-0.6, 1.2]);
      s.area(c[0] - 9, c[1] - 9, c[0] + 9, c[1] + 9, (x, y) => {
        const dx = x - c[0];
        const dy = y - c[1];
        const up = dx * u[0] + dy * u[1];
        const fr = dx * f[0] + dy * f[1];
        return Math.hypot(x - o[0], y - o[1]) <= 6.4 && (up >= 0.6 || fr <= -1.6);
      });
      for (const [a, b, tip] of LOCKS) s.poly([at(a), at(b), at(tip)]);
      for (const [a, b] of WISPS) s.line(at(a), at(b), 1);
    });
  },
};
