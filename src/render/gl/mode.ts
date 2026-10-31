/**
 * ?render=3d: three.js 2.5D 렌더로 그린다 (옮기는 중이라 지금은 극장·다이너 거리만 3D, 나머지는 비어 있다).
 * 없으면 지금까지의 Canvas 2D 렌더.
 */
export const GL_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('render') === '3d';
