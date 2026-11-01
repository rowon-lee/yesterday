/**
 * 한 틱 동안 플레이어 한 명의 입력. 네트워크로 보내기 쉽게 비트 묶음 정수로 둔다.
 * 방향 4개 + 버튼 6개 (공격, 스킬 1, 스킬 2, 필살기, 점프, 대시). 커맨드 입력은 없다.
 */
export type PlayerInput = number;

export const IN_UP = 1 << 0;
export const IN_DOWN = 1 << 1;
export const IN_LEFT = 1 << 2;
export const IN_RIGHT = 1 << 3;
export const IN_ATTACK = 1 << 4;
export const IN_JUMP = 1 << 5;
export const IN_DASH = 1 << 6;
export const IN_SKILL1 = 1 << 7;
export const IN_SKILL2 = 1 << 8;
export const IN_SUPER = 1 << 9;

export const BUTTON_COUNT = 6;
export const INPUT_BITS = 4 + BUTTON_COUNT;
export const BUTTONS = IN_ATTACK | IN_JUMP | IN_DASH | IN_SKILL1 | IN_SKILL2 | IN_SUPER;
