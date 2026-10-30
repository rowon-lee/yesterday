// npm run sheets가 헤드리스 브라우저로 여는 페이지. 동작마다 띠를 그려 PNG 데이터로 넘긴다.
import type { Motion } from '../../src/anim/motion';
import { MOTIONS } from '../../src/anim/motions';
import { checkMotion, drawStrip, scaleCanvas } from '../../src/anim/sheet';
import { SELFTEST_MOTIONS } from './selftest';

const params = new URLSearchParams(location.search);
const scale = Number(params.get('scale') ?? 4);
const only = params.getAll('only');
let list: Motion[] = params.has('selftest') ? SELFTEST_MOTIONS : MOTIONS;
if (only.length) list = list.filter((m) => only.includes(m.name));

(window as unknown as { __sheets: unknown }).__sheets = list.map((m) => {
  const errors = checkMotion(m);
  return {
    name: m.name,
    dur: m.dur,
    errors,
    png: errors.length ? null : scaleCanvas(drawStrip(m), scale).toDataURL('image/png'),
  };
});
