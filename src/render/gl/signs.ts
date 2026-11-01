/**
 * 간판·글자 자리 목록 (렌더 전용, 확인 도구용). 무대를 그리는 코드가 글자를 그릴 때마다 자리를 적어 둔다.
 * 맵 검사(tools/mapcheck.mjs)의 '글자 검사'가 이 목록으로 화면마다 본다:
 * 글자가 판보다 넓지 않은지, 화면 가장자리에서 반쯤 잘리지 않는지, 같은 깊이의 글자끼리 겹치지 않는지,
 * 같은 문구가 한 화면에 두 번 나오지 않는지.
 */
export interface SignEntry {
  /** 그린 글자 */
  text: string;
  /** 무엇인지 (간판·포스터·전광판·페인트 글씨…) */
  kind: string;
  /** 월드 자리: x 범위, 높이(바닥 위) 범위, 깊이. layer가 있으면 먼 겹 좌표(겹 속도 layer, x·y는 겹 그림 위에서부터) */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z: number;
  layer?: number;
  /** 글자 폭과 받침 판 폭 (월드 px). 글자가 판보다 넓으면 넘친다 */
  textW: number;
  plateW: number;
}

export const SIGNS: SignEntry[] = [];

/** 월드 자리의 글자 (높이 y0~y1은 바닥 위) */
export function registerSign(text: string, kind: string, x0: number, x1: number, y0: number, y1: number, z: number, textW: number, plateW: number): void {
  SIGNS.push({ text, kind, x0, x1, y0, y1, z, textW, plateW });
}

/** 먼 겹 그림 위의 글자 (겹 좌표: x는 겹 그림 왼쪽에서, y는 겹 그림 위에서부터) */
export function registerLayerSign(text: string, kind: string, layer: number, x0: number, x1: number, y0: number, y1: number, textW: number, plateW: number): void {
  SIGNS.push({ text, kind, x0, x1, y0, y1, z: 0, layer, textW, plateW });
}
