// 도구가 제대로 도는지 보는 가짜 동작. 게임에는 들어가지 않는다.
// 프레임 수는 동작마다 다르다 (12~14 규칙 폐기, 3-0a): 3·12·24프레임이 섞여도 띠가 한 줄로 나와야 하고, 표시 틱이 잘못된 것만 걸려야 한다.
import { FOOT_X, FOOT_Y, type Motion } from '../../src/anim/motion';

/** 프레임마다 높이가 다른 상자 (몇 번째 프레임인지 눈으로 보이게) */
function boxes(name: string, label: string, dur: number[], color: string): Motion {
  return {
    name,
    label,
    dur,
    draw(ctx, frame, ox, oy) {
      const h = 8 + Math.round((frame * 48) / Math.max(1, dur.length - 1));
      ctx.fillStyle = color;
      ctx.fillRect(ox + FOOT_X - 4, oy + FOOT_Y - h + 1, 8, h);
    },
  };
}

const box = boxes('_selftest/box', '확인용 상자 (12프레임)', [4, 4, 3, 3, 2, 2, 2, 2, 3, 3, 4, 4], '#5ee6ff');
const short = boxes('_selftest/short', '짧은 동작 (3프레임)', [2, 1, 4], '#7be07b');
const long = boxes('_selftest/long', '긴 동작 (24프레임)', Array.from({ length: 24 }, (_, i) => 1 + (i % 3)), '#ffd25e');
/** 걸려야 하는 것: 표시 틱 0 */
const bad: Motion = { name: '_selftest/bad-dur', label: '표시 틱 0', dur: [4, 0, 4], draw() {} };

export const SELFTEST_MOTIONS: Motion[] = [box, short, long, bad];
