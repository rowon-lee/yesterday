import { MOTION_DATA } from '../data/poses';
import { buildMotion } from './bake';

/**
 * 게임에 들어가는 모든 동작. 시트 출력(npm run sheets)도 이 목록을 쓴다.
 * 그림은 처음 쓸 때 그린다 (대련은 불러오기 화면이 미리 다 그린다: render/preload).
 */
export const MOTIONS = MOTION_DATA.map(buildMotion);
