// 도구가 제대로 도는지 보는 가짜 동작. 게임에는 들어가지 않는다.
import { FOOT_X, FOOT_Y, type Motion } from '../../src/anim/motion';

const box: Motion = {
  name: '_selftest/box',
  dur: [4, 4, 3, 3, 2, 2, 2, 2, 3, 3, 4, 4],
  draw(ctx, frame, ox, oy) {
    const h = 20 + frame * 2;
    ctx.fillStyle = '#5ee6ff';
    ctx.fillRect(ox + FOOT_X - 4, oy + FOOT_Y - h + 1, 8, h);
  },
};

const bad: Motion = { name: '_selftest/too-short', dur: [4, 4, 4], draw() {} };

export const SELFTEST_MOTIONS: Motion[] = [box, bad];
