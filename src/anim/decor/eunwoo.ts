import { restRibbon } from '../follow';
import type { Joints, Point } from '../pose';
import type { Decor, DecorPen, Look } from '../skeleton';
import type { Skin } from '../skins';
import { add, flutter, hangDir, headFrame, norm, torso } from './kit';

/*
 * 백은우 표식 (캐릭터 기획서 + 사용자 일러스트 2026-11-02 `docs/refs/백은우_일러스트.png` + 1차본 피드백 11-0·11-1).
 * - 색 (11-1): 흰 의사 가운, 안쪽 옷(셔츠·바지)은 짙은 회색이라 팔다리가 가운과 갈라져 읽힌다. 피부는 손·얼굴만.
 *   몸 색 = 안쪽 옷(회색), 옷 색 = 가운(흰색), 피부 = 얼굴·손.
 * - 잿빛 머리(분홍기 도는 회갈색): 숱 많고 흐트러진 머리, 눈을 덮는 긴 앞머리, 턱까지 오는 옆머리, 목덜미에서 낮게 묶은 꽁지머리.
 *   꽁지머리와 가운 자락은 동작보다 늦게 따라오고 멈출 때 한 번 지나쳤다 돌아온다 (anim/follow.ts의 hair·gown, 서로 다른 박자)
 * - 가운: 어깨에서 무릎 아래까지, 앞이 열려 회색 셔츠가 보인다. 금색 하네스(어깨끈·허리띠), 꽁지머리를 묶은 연분홍 끈
 * - 연검 스텔라리스 (11-0): 앞손에 쥔다. 손잡이 6px(금실 감김) + 날 32px = 38px, 날은 굵기 2px(안쪽 은빛 + 바깥쪽 가장자리 1px 밝게).
 *   늘 S자나 나선으로 휜 리본이고 곧게 펴지지 않는다. 모양은 동작마다 미리 계산한 리본 점(j.fx.rib)을 잇는다 (없으면 쉬는 S자)
 * 눈은 그리지 않는다 (CLAUDE.md, 설정의 금색 눈도 그리지 않음).
 */

/** 휘날림: 미리 계산한 값이 있으면 그것 (늦게 따라오고 지나쳤다 돌아온다), 없으면 자세로 짐작 */
const gownK = (j: Joints) => j.fx?.gown ?? flutter(j);
const hairK = (j: Joints) => j.fx?.hair ?? flutter(j);

/** 선분 a→b를 곧은 쪽 가장자리로 1px 옮긴 선 (n: 바깥쪽, 가로·세로 중 큰 쪽으로 맞춘다) */
const snap = (n: Point): Point => (Math.abs(n[0]) > Math.abs(n[1]) ? [Math.sign(n[0]), 0] : [0, Math.sign(n[1]) || -1]);

/**
 * 연검: 손잡이(금실 감긴 2px) → 날 (안쪽 1px 은빛 + 휜 바깥쪽 1px 밝은 가장자리).
 * 바깥쪽 = 그 마디에서 리본이 휘는 반대쪽 (곧으면 위쪽: 빛 받는 쪽)
 */
function sword(pen: DecorPen, r: readonly Point[]): void {
  pen.fill('accent', (s) => s.line(r[0]!, r[1]!, 2));
  const core: Array<[Point, Point]> = [];
  const edge: Array<[Point, Point]> = [];
  for (let k = 1; k + 1 < r.length; k++) {
    const a = r[k]!;
    const b = r[k + 1]!;
    const d = norm([b[0] - a[0], b[1] - a[1]]);
    const p = r[k - 1]!;
    const q = r[Math.min(r.length - 1, k + 2)]!;
    const d0 = norm([a[0] - p[0], a[1] - p[1]]);
    const d1 = norm([q[0] - b[0], q[1] - b[1]]);
    const turn = d0[0] * d1[1] - d0[1] * d1[0];
    let n: Point = turn >= 0 ? [d[1], -d[0]] : [-d[1], d[0]];
    if (Math.abs(turn) < 0.05) n = d[0] >= 0 ? [d[1], -d[0]] : [-d[1], d[0]];
    const o = snap(n);
    core.push([a, b]);
    edge.push([add(a, o), add(b, o)]);
  }
  // 날 전체(안쪽 + 가장자리)를 은빛으로: 몸·가운 위를 지나는 곳은 둘레가 외곽선 색이라 흰 가운 위에서도 보인다
  pen.fill('blade', (s) => {
    core.forEach(([a, b]) => s.line(a, b, 1));
    edge.forEach(([a, b]) => s.line(a, b, 1));
  });
  // 바깥쪽 가장자리 1px을 밝게
  pen.fill('metal', (s) => edge.forEach(([a, b]) => s.line(a, b, 1)));
}

/** 빠르게 돌려 만든 은빛 원 (방어): 손을 가운데로 호 세 개 (사이가 비어 안이 막히지 않는다), 앞끝은 더 밝게 */
function disc(pen: DecorPen, c: Point, r: number, phase: number): void {
  const arcs: Point[][] = [];
  const heads: Point[][] = [];
  for (let a = 0; a < 3; a++) {
    const from = phase * 38 + a * 120;
    const pts: Point[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = ((from + k * 10) * Math.PI) / 180;
      pts.push([Math.round(c[0] + Math.cos(t) * r), Math.round(c[1] + Math.sin(t) * r)]);
    }
    arcs.push(pts.slice(0, 7));
    heads.push(pts.slice(6));
  }
  pen.fill('blade', (s) => arcs.forEach((pts) => pts.slice(1).forEach((p, i) => s.line(pts[i]!, p, 1))));
  pen.fill('metal', (s) => heads.forEach((pts) => pts.slice(1).forEach((p, i) => s.line(pts[i]!, p, 1))));
}

export const EUNWOO_DECOR: Decor = {
  skin: { face: true, hands: true },
  // 리본이 다리·몸과 만든 고리는 비워 둔다 (작은 틈만 메운다)
  keepHoles: 6,
  /**
   * 가운 뒷자락: 어깨 뒤에서 엉덩이를 지나 무릎 아래까지 늘어지는 흰 천 (한 단계 어둡게). 다리보다 뒤에 그린다.
   * 끝은 몸 아래와 중력을 섞어 처지고, 휘날리는 만큼 뒤로 들린다. 끝단은 두 갈래로 갈라진다 (가운 뒤트임)
   */
  behind(pen, j) {
    // 몸 뒤로 돌아간 연검 (피루엣)
    if (j.fx?.back && j.fx.rib) sword(pen, j.fx.rib);
    const { down, front, back } = torso(j);
    const k = gownK(j);
    const fl = j.fx?.flare ?? 0;
    const hang = hangDir(j, Math.min(1.2, k));
    const top = add(j.neck, down, 2);
    const len = 17 + 3 * Math.min(1, k);
    pen.fill('clothBack', (s) => s.poly([
      add(top, back, 2.5),
      add(top, front, 1),
      add(add(j.hip, front, 1.5), hang, 7),
      add(add(j.hip, front, -0.5), hang, len - 1),
      add(add(j.hip, back, 2 + 2 * k), hang, len - 3),
      add(add(j.hip, back, 3.5 + 2.5 * k), hang, len + 1),
      add(add(j.hip, back, 5.5 + 3 * k), hang, len - 3),
      add(j.hip, back, 4.5),
    ]));
    // 돌 때 둥글게 펼쳐지는 뒷자락: 엉덩이 높이에서 뒤로 넓게 퍼진다
    if (fl > 0.05) {
      const out = norm([back[0] * 0.9 + down[0] * 0.5, back[1] * 0.9 + down[1] * 0.5]);
      pen.fill('clothBack', (s) => s.poly([
        add(j.hip, down, -2),
        add(add(j.hip, out, 9 + 7 * fl), down, -1 - 4 * fl),
        add(add(j.hip, out, 11 + 8 * fl), down, 4),
        add(j.hip, down, 9),
      ]));
    }
  },
  /** 가운 몸판·앞자락(흰색), 가운 깃 사이로 보이는 회색 셔츠, 하네스 (금색 어깨끈·허리띠) */
  body(pen, j) {
    const { up, down, front } = torso(j);
    const top = add(j.neck, down, 1.5);
    const k = gownK(j);
    const hang = norm([down[0] * 0.6 - front[0] * 0.2 * k, down[1] * 0.6 + 0.4 - front[1] * 0.2 * k]);
    const fl = j.fx?.flare ?? 0;
    // 돌 때 둥글게 펼쳐지는 앞자락: 엉덩이 높이에서 앞으로 넓게 퍼진다
    if (fl > 0.05) {
      const out = norm([front[0] * 0.9 + down[0] * 0.5, front[1] * 0.9 + down[1] * 0.5]);
      pen.fill('cloth', (s) => s.poly([
        add(j.hip, down, -2),
        add(add(j.hip, out, 8 + 7 * fl), down, -1 - 4 * fl),
        add(add(j.hip, out, 10 + 8 * fl), down, 4),
        add(j.hip, down, 9),
      ]));
    }
    pen.fill('cloth', (s) => {
      // 몸판: 어깨에서 엉덩이까지 몸통보다 조금 넓게
      s.poly([add(top, front, 2.6), add(top, front, -3.2), add(j.hip, front, -3.6), add(j.hip, front, 3)]);
      // 앞자락: 엉덩이 앞에서 무릎 아래까지 (열린 가운이라 앞쪽은 가볍게 흔들린다)
      s.poly([
        add(j.hip, front, 3),
        add(j.hip, front, -1.5),
        add(add(j.hip, front, -1), hang, 11 + 2 * Math.min(1, k)),
        add(add(j.hip, front, 2.5), hang, 9),
      ]);
    });
    // 열린 가운 앞으로 보이는 회색 셔츠: 목 앞에서 가슴까지 좁은 띠
    pen.fill('body', (s) => s.poly([add(top, front, 0.4), add(top, front, 2.6), add(add(top, down, 6.5), front, 2.4), add(add(top, down, 6.5), front, 1.2)]));
    // 하네스: 어깨에서 허리 앞으로 내려오는 금색 끈과 허리띠
    pen.fill('accent', (s) => {
      s.line(add(add(top, front, -1.5), up, 0.5), add(add(j.hip, front, 2), up, 3), 1);
      s.line(add(add(j.hip, front, -3), up, 3), add(add(j.hip, front, 3), up, 3), 1);
    });
  },
  /**
   * 머리 (일러스트): 아랫단(목덜미·꽁지머리) → 숱 많은 볼륨 → 눈을 덮는 긴 앞머리·턱까지 오는 옆머리 → 삐친 가닥 → 연분홍 머리끈.
   * 꽁지머리는 목덜미에서 낮게 묶어 짧게 늘어지고, 몸이 움직이면 늦게 따라 뒤로 날린다 (멈추면 앞으로 한 번 넘어왔다 돌아온다)
   */
  head(pen, j) {
    const { c, u, f, at } = headFrame(j);
    const back: Point = [-f[0], -f[1]];
    const k = hairK(j);
    const tie = at([-5.0, -2.2]);
    const sag = (b: number, g: number): Point => norm([back[0] * b, back[1] * b + g]);
    const p1 = add(tie, sag(0.45 + 1.2 * k, 1.0 - 0.3 * k), 3);
    const p2 = add(p1, sag(0.25 + 1.4 * k, 1.0 - 0.4 * k), 4);
    pen.fill('hairBack', (s) => {
      // 목덜미를 덮는 뒷머리 아랫단 (한 단계 어둡게)
      s.poly([at([-1.2, 0.6]), at([-5.8, 1.0]), at([-5.6, -3.0]), at([-2.8, -2.8])]);
      // 낮게 묶은 꽁지머리 아랫단
      s.line(tie, p1, 3);
      s.line(p1, p2, 2);
    });
    pen.fill('hair', (s) => {
      // 숱 많은 볼륨: 머리 위·뒤를 머리보다 조금 크게 덮는다 (얼굴 앞 아래는 남긴다)
      const o = at([-0.6, 0.6]);
      s.area(c[0] - 9, c[1] - 9, c[0] + 9, c[1] + 9, (x, y) => {
        const dx = x - c[0];
        const dy = y - c[1];
        const upk = dx * u[0] + dy * u[1];
        const fr = dx * f[0] + dy * f[1];
        return Math.hypot(x - o[0], y - o[1]) <= 5.8 && (upk >= 0.8 || fr <= -1.0);
      });
      // 긴 앞머리: 이마를 덮고 눈 높이까지, 한 가닥은 볼까지 내려온다
      s.poly([at([-0.6, 6.0]), at([5.4, 3.8]), at([5.6, 0.2]), at([3.4, 2.0])]);
      s.poly([at([2.0, 5.0]), at([4.6, 2.6]), at([3.2, -1.6]), at([2.2, 1.8])]);
      // 옆머리: 귀 앞에서 턱까지 늘어진 가닥
      s.poly([at([1.6, 2.4]), at([-0.2, 2.6]), at([0.6, -5.2])]);
      // 꽁지머리 윗단: 아랫단보다 조금 위로 비켜 가늘게 (빛 받는 쪽)
      const lift: Point = [u[0] * 0.7, u[1] * 0.7];
      s.line(add(tie, lift), add(p1, lift), 2);
      s.line(add(p1, lift), p2, 1);
      // 흐트러진 끝: 정수리 뒤와 뒤통수에서 짧게 삐친다
      s.line(at([-2.2, 5.8]), at([-3.0, 6.8]), 1);
      s.line(at([-5.4, 2.6]), at([-6.6, 3.0]), 1);
    });
    // 연분홍 머리끈
    pen.fill('trim', (s) => s.disc(tie, 0.7));
  },
  /** 연검 (맨 위: 앞손에 쥔다). 방어에서 돌리는 동안은 손잡이와 은빛 원 */
  top(pen, j) {
    if (j.fx?.disc) {
      const d = norm([j.hF[0] - j.eF[0], j.hF[1] - j.eF[1]]);
      pen.fill('accent', (s) => s.line(j.hF, add(j.hF, d, 5), 2));
      disc(pen, j.hF, j.fx.disc.r, j.fx.disc.phase);
      return;
    }
    if (j.fx?.back) return;
    const rib = j.fx ? j.fx.rib : restRibbon(j);
    if (rib) sword(pen, rib);
  },
};

/** 1P: 흰 가운(차가운 회청 그늘), 짙은 회색 셔츠·바지, 잿빛 머리, 금색 하네스·손잡이 금실, 연분홍 머리끈, 은빛 연검, 창백한 살빛 */
const P1: Look = {
  outline: 'ink', shadow: 'suitGreyDark', base: 'suitGrey', light: 'suitGreyLight',
  hair: ['ashDark', 'ash', 'ashLight'],
  cloth: ['gownShade', 'gown', 'white'],
  accent: ['thread', 'threadLight'],
  trim: 'lily',
  glow: 'threadLight',
  metal: ['moonDark', 'moon', 'moonLight'],
  skin: ['skinDark', 'skin', 'skinLight'],
};
/** 2P: 백합 연분홍 가운, 더 짙은 셔츠·바지, 기획서의 밝은 갈색 머리, 어두운 금색 */
const P2: Look = {
  outline: 'ink', shadow: 'suitDark', base: 'suit', light: 'suitLight',
  hair: ['hairBrownDark', 'hairBrown', 'hairBrownLight'],
  cloth: ['lilyDark', 'lily', 'lilyLight'],
  accent: ['goldDark', 'gold'],
  trim: 'white',
  glow: 'thread',
  metal: ['moonDark', 'moon', 'moonLight'],
  skin: ['skinDark', 'skin', 'skinLight'],
};
/** 금색 잔상 (금색 실을 따라 미끄러지는 대시·순간이동) */
const GHOST: Look = { outline: 'thread', shadow: 'thread', base: 'thread', light: 'thread' };
/** 차지로 모으는 동안 몸이 대표 색(흰빛·금색)으로 빛난다 */
const GLOW: Look = { outline: 'ink', shadow: 'thread', base: 'threadLight', light: 'white' };

/** 백은우 겉모습: 장식과 색 묶음 (1P·2P·잔상·빛남) */
export const EUNWOO_SKIN: Skin = {
  id: 'eunwoo',
  label: '백은우',
  decor: EUNWOO_DECOR,
  looks: { p1: P1, p2: P2, ghost1: GHOST, ghost2: GHOST, glow1: GLOW, glow2: GLOW },
};
