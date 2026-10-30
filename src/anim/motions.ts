import { MOTION_DATA } from '../data/poses';
import { buildMotion } from './bake';

/** 게임에 들어가는 모든 동작. 시트 출력(npm run sheets)도 이 목록을 쓴다. */
export const MOTIONS = MOTION_DATA.map(buildMotion);

/** 시작할 때 한 번: 모든 동작의 시트를 미리 그린다. */
export function bakeAllMotions(): void {
  for (const m of MOTIONS) m.bake();
}
