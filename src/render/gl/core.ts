import * as THREE from 'three';
import { GROUND } from '../../stage/citadel';
import { SCREEN_H, SCREEN_W } from '../screen';

/**
 * 2.5D 렌더의 공통 숫자 (렌더 전용).
 * three.js 좌표: x는 월드 x와 같고, y는 바닥에서 위로(= GROUND - 월드 y), z는 카메라 쪽이 +. 싸우는 면이 z = 0.
 * 카메라는 싸우는 면에서 DIST만큼 떨어진 원근 카메라라서 z = 0에서 월드 1px이 화면 1px이다.
 * 멀리 있는 것일수록 작게, 느리게 움직인다 (겹 속도 s ↔ 깊이 z = DIST·(1 - 1/s)).
 */
export const DIST = 3000;
/** 화면 둘레 여유 (px): 카메라는 정수 px로만 움직이고, 남는 소수점만큼 확대 단계에서 화면을 민다 */
export const MARGIN = 1;
export const RT_W = SCREEN_W + MARGIN * 2;
export const RT_H = SCREEN_H + MARGIN * 2;
export const NEAR = 300;
export const FAR = 140000;
export const FOV = (2 * Math.atan(RT_H / 2 / DIST) * 180) / Math.PI;

/** 겹 속도 s(카메라 대비 움직이는 비율)로 놓을 깊이 */
export const depthOfSpeed = (s: number): number => DIST * (1 - 1 / s);
/** 깊이 z에 있는 것이 화면에서 보이는 배율 (z = 0이면 1) */
export const scaleAt = (z: number): number => DIST / (DIST - z);

/** 카메라: 화면 왼쪽 위가 월드의 어디인지 (px, 소수점 허용) */
export interface View {
  x: number;
  y: number;
}

/** 정수 px로 놓은 카메라와 남는 소수점 */
export interface Placed {
  ix: number;
  iy: number;
  fx: number;
  fy: number;
}

export function makeCamera(): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(FOV, RT_W / RT_H, NEAR, FAR);
}

export function placeCamera(cam: THREE.PerspectiveCamera, v: View): Placed {
  const ix = Math.floor(v.x);
  const iy = Math.floor(v.y);
  cam.position.set(ix + SCREEN_W / 2, GROUND - (iy + SCREEN_H / 2), DIST);
  cam.updateMatrixWorld();
  return { ix, iy, fx: v.x - ix, fy: v.y - iy };
}

/** 월드 y(아래로 +) → three y(바닥에서 위로 +) */
export const up = (worldY: number): number => GROUND - worldY;
