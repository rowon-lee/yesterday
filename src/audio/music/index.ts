/**
 * 곡 데이터 자리 (사운드기획서 3장). 지금은 비어 있다: 5장 진행 순서 4번(대련곡 스케치 2안)에서 채운다.
 * 형식 계획: 빠르기(BPM), 화음 진행(마디마다), 악기 설정(FM 일렉트릭 피아노·패드·서브 베이스·노이즈 드럼·킥·리드), 층(기본·전투·고조).
 * 층은 믹서의 음악 버스로 나가고, 강타 덕킹·필살기 컷인 필터를 함께 받는다.
 */

/** 대련곡 적응형 층 (3-2) */
export type MusicLayer = 'base' | 'battle' | 'climax';

export const MUSIC_LAYERS: readonly MusicLayer[] = ['base', 'battle', 'climax'];

/** 아직 만든 곡이 없다 (소리 시험 화면의 음악 층 버튼이 흐리게 보인다) */
export const MUSIC_READY = false;
