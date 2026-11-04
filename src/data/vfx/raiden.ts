// 라이덴 이펙트 실루엣 설계 (숫자 데이터만). 판정·동작 데이터(data/characters/raiden)와 따로 둔다: 그림만 정한다.
// 색 단계 번호 = render/chars/raiden-anime의 RAIDEN_SIL_RAMP 순서:
//   0 순백 (번개 줄기·흰 줄) · 1 흰 심 · 2 연분홍 (속도선) · 3 분홍빨강 · 4 빨강 · 5 검붉은 (속도선) · 6 아주 검붉은 · 7 자홍 (가시 별·테두리 번개)
import { RAIDEN_ATK4_PEAK } from './raiden-atk4-peak';
import type { VDesign } from './types';

export const RAIDEN_VFX: Partial<Record<string, VDesign>> = {
  /**
   * 4타 슈퍼맨 펀치 (목업 docs/refs/effect_mockup_raiden4.png가 기준, 2026-11-04).
   * 주먹에서 머리 높이로 터져 상대를 지나 오른쪽 위로 넓어지는 원뿔 덩어리 하나 (흰 심 → 분홍빨강 → 빨강 → 아주 검붉은, 번개처럼 꺾인 윤곽),
   * 앞끝은 층층이 찢어진 가닥, 맞은 자리(상대 가슴)에 자홍·흰 가시 별, 덩어리를 따라 기운 속도선 몇 줄과 흰 번개 줄기 둘.
   * 지금은 피크 키 하나 (승인 뒤 찢어짐·흩어짐 키를 더한다): 0틱에 다 나타나 4틱 머문 뒤 사라진다 (14-2 강 유지 0~4틱).
   * 배경은 목업처럼 무대 밝기 40% + 검붉은 기 (2틱). 목업은 이펙트만 밝고 무대는 고르게 어두우므로
   * 실제 광원·빛 번짐은 약하게 (덩어리가 커서 다 켜면 무대가 갈색으로 뜬다)
   */
  atk4: {
    keys: [{ name: 'peak', at: 0, hold: 4 }],
    end: 5,
    parts: RAIDEN_ATK4_PEAK,
    center: [52, -38],
    mass: [137, -65],
    press: { ticks: 2, mode: 'tint', k: 1, color: '#17030a', scale: 0.4 },
    glow: 0.25,
    light: 0.3,
  },
};
