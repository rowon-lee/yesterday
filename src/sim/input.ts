/**
 * 한 틱 동안 플레이어 한 명의 입력. 네트워크로 보내기 쉽게 비트 묶음 정수로 둔다.
 * 버튼 6개의 이름과 키 배치는 기획 문서에서 정한 뒤 붙인다.
 */
export type PlayerInput = number;

export const IN_UP = 1 << 0;
export const IN_DOWN = 1 << 1;
export const IN_LEFT = 1 << 2;
export const IN_RIGHT = 1 << 3;
/** 버튼 1~6: 비트 4~9 */
export const BUTTON_COUNT = 6;
export const inButton = (i: number): PlayerInput => 1 << (4 + i);
export const INPUT_BITS = 4 + BUTTON_COUNT;
