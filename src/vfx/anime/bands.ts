// YESTERDAY 애니 이펙트 부품 2 — 4색 띠 (동작연출지침서 14-1 ② '4색 띠, 경계는 딱딱하게').
// 안에서 밖으로 흰 심 → 밝은 주색 → 진한 주색 → 보색 테두리(소량). 매끈한 그라데이션 없이 셀 단계로 끊는다.
// 판정과의 관계 (14-5): 흰 심과 밝은 주색은 판정 범위 안에만 둔다 (가장 밝은 머리 = 판정 범위).
// 범위 밖으로 나가는 몸통·꼬리·가장자리는 바깥 두 단계(진한 주색·보색 테두리)로만 그린다.
// 사라질 때는 바깥 단계부터 빠진다 (14-2): 테두리 → 진한 주색 → 밝은 주색, 흰 심이 마지막.
import type { Ramp4 } from './common';

/** 색 단계: 0 흰 심 · 1 밝은 주색 · 2 진한 주색 · 3 보색 테두리 */
export type Step = 0 | 1 | 2 | 3;

/**
 * 칸 하나의 색 단계.
 * rd: 판정 범위 가장자리까지 거리 (px, 0 = 범위 밖), av: 중심선에서 거리 (px), edge: 이 자리 반두께 (px), rimW: 보색 테두리 두께 (px, 0이면 없음),
 * coreIn: 흰 심이 범위 가장자리에서 들어오는 깊이 (px), mainIn: 밝은 주색이 시작하는 깊이 (px, 0이면 범위 가장자리부터.
 * 크게 두면 범위 가장자리 안쪽 몇 칸은 진한 주색: 꺾인 경계가 범위를 넘지 않고 범위 안에서 꺾인다),
 * coreW·mainW: 띠 두께에 대한 흰 심·밝은 주색의 반두께 비율 (범위가 띠보다 넓을 때도 가운데에서 바깥으로 단계가 나뉘게)
 */
export function stepOf(rd: number, av: number, edge: number, rimW: number, coreIn: number, mainIn: number, coreW = 0.32, mainW = 0.72): Step {
  if (rd > 0) {
    if (rd >= coreIn && av <= edge * coreW) return 0;
    if (rd > mainIn && av <= edge * mainW) return 1;
  }
  return av <= edge - rimW ? 2 : 3;
}

/**
 * 바깥 단계부터 빠진다: 찢어지는 진행 p (0 피크 → 1 끝)와 길 위 자리 u (꼬리 0 → 머리 1)에서 이 단계가 아직 남았는가.
 * 꼬리 쪽이 먼저 빠진다 (머리가 가장 오래 남아 판정 자리를 보여 준다)
 */
export function stepAlive(step: Step, p: number, u: number): boolean {
  if (p <= 0) return true;
  switch (step) {
    case 3:
      return p < 0.16 + 0.1 * u;
    case 2:
      return p < 0.42 + 0.4 * u;
    case 1:
      return p < 0.72 + 0.25 * u;
    default:
      return true;
  }
}

/** 단계 → 색 */
export const colorOf = (r: Ramp4, s: Step): number => (s === 0 ? r.core : s === 1 ? r.main : s === 2 ? r.deep : r.rim);
