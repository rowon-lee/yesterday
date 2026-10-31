/**
 * 제한 팔레트. 캐릭터와 이펙트가 같은 색을 쓴다.
 * 색 이름 → 실제 색. 새 색은 여기에만 추가한다.
 */
export const COLORS = {
  ink: '#0a0712', // 외곽선
  night: '#07040e',
  panel: '#120a24',
  panelLight: '#1a1030',
  grid: '#2a1f44',
  gridLight: '#5a4c90',
  white: '#f4f0e6',
  gold: '#ffd25e',
  goldLight: '#fff3a8',
  goldDark: '#b07a26',
  sky: '#7fe3ff',
  skyLight: '#d4f8ff',
  skyDark: '#2a7fa6',
  red: '#ff4d6d',
  green: '#7bd88f',
  // 배경 (채도를 낮춘 녹슨 갈색·회색 벽돌·매연 낀 하늘)
  smog0: '#1c1a22',
  smog1: '#26232b',
  smog2: '#332e33',
  smog3: '#423a3a',
  brickFar: '#2f2a2e',
  brickMid: '#3b3232',
  brickNear: '#4a3c38',
  windowDim: '#6b5a44',
  street: '#2a2626',
  streetLine: '#3a3433',
  rail: '#55504c',
} as const;

export type ColorName = keyof typeof COLORS;
