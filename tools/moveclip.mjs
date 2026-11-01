// 정해진 입력으로 대전 장면 한 토막을 GIF로 찍는다 (동작 승인·연속 캡처용). 상대는 가만히 선다(?p2=idle).
//   npm run moveclip -- dash_attack [--every 1] [--scale 2] [--crop x,y,w,h] [--to previews/base/dash_attack-fight.gif]
// → out/clips/<장면>.gif, 확인용으로 프레임을 이어 붙인 out/clips/<장면>-strip.png
//
// 장면은 아래 SCENES에 적는다: 두 사람 자리, 카메라가 자리 잡을 때까지 기다리는 틱, 그 뒤 틱마다 누를 키.
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { encodeGif } from './gif.mjs';

/**
 * steps: [키 묶음, 틱 수]. 키 묶음은 그동안 누르고 있는 키 (KeyboardEvent.code). 빈 배열이면 모두 뗀다.
 * 1P는 왼쪽(오른쪽을 봄), 2P는 오른쪽. q: 주소 뒤 (기본 대련·상대 가만히), p1·p2가 없으면 자리를 옮기지 않는다.
 * prep: 자리를 놓은 뒤 sim 상태(s)에 한 번 실행할 코드 (경기 끝 메뉴를 보려고 체력·승수를 바꾸는 등)
 */
const SCENES = {
  // 대시(L) → 3틱 뒤 공격(J) → 맞히고 일어설 때까지
  dash_attack: {
    p1: 2196, p2: 2310, settle: 70,
    steps: [[[], 8], [['KeyL'], 1], [[], 3], [['KeyJ'], 1], [[], 44]],
  },
  // 연속 장면: 대시(L) → 대시 공격(J)을 누른 채 → 차지 1단계 → 점프(K+→)로 쫓아 공중 1·2·3타 (simtest '연속 장면'과 같은 입력)
  combo: {
    p1: 2196, p2: 2296, settle: 70,
    steps: [
      [[], 6], [['KeyL'], 1], [[], 2], [['KeyJ'], 19], [[], 4], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 14],
      [['KeyJ', 'ArrowRight'], 1], [['ArrowRight'], 6], [['KeyJ', 'ArrowRight'], 1], [['ArrowRight'], 6], [['KeyJ', 'ArrowRight'], 1], [[], 60],
    ],
  },
  // 타이틀: 메뉴를 내려갔다 올라오고, 대련(CPU 강도) 메뉴를 열었다 닫는다
  title: {
    q: 'scene=title', settle: 30,
    steps: [[[], 50], [['KeyS'], 1], [[], 16], [['KeyS'], 1], [[], 16], [['KeyS'], 1], [[], 16], [['KeyW'], 1], [[], 16], [['KeyW'], 1], [[], 16], [['KeyW'], 1], [[], 20], [['KeyJ'], 1], [[], 36], [['KeyS'], 1], [[], 20], [['KeyK'], 1], [[], 40]],
  },
  // 일시정지(Esc): 메뉴를 옮겨 보고 계속하기
  pause: {
    q: 'scene=fight', settle: 10, p1: 3150, p2: 3260,
    steps: [[[], 20], [['Escape'], 1], [[], 24], [['KeyS'], 1], [[], 14], [['KeyS'], 1], [[], 14], [['KeyW'], 1], [[], 14], [['KeyW'], 1], [[], 14], [['KeyJ'], 1], [[], 30]],
  },
  // 경기 끝: 1P가 한 판 이긴 2판째, 2P 체력이 거의 없을 때 4타로 쓰러뜨리고 → 다시 하기·타이틀로 메뉴
  results: {
    q: 'scene=fight&p2=idle', settle: 10, p1: 3150, p2: 3196,
    prep: 's.fighters[0].wins = 1; s.round = 2; s.fighters[1].hp = 30;',
    steps: [[[], 4], [['KeyJ'], 1], [[], 6], [['KeyJ'], 1], [[], 6], [['KeyJ'], 1], [[], 6], [['KeyJ'], 1], [[], 300], [['KeyS'], 1], [[], 30]],
  },
  // 연습: 시간 --, 상대 체력이 콤보가 끝나고 1초 뒤 다시 찬다
  practice: {
    q: 'scene=fight&mode=practice&dummy=stand', settle: 10, p1: 3150, p2: 3196,
    steps: [[[], 6], [['KeyJ'], 1], [[], 6], [['KeyJ'], 1], [[], 6], [['KeyJ'], 1], [[], 6], [['KeyJ'], 1], [[], 200]],
  },
  // 필살기(O) 연출: 발동 정지·2배 확대·컷인 → 맞으면 난타 → 어퍼로 띄우기 → 내려찍기 → 끝 타격에 피해·파괴 (기력 가득)
  super: {
    p1: 3150, p2: 3196, settle: 70, meter: true,
    steps: [[[], 8], [['KeyO'], 1], [[], 236]],
  },
  // 필살기가 빗나감: 확대가 풀리고 발동자가 한참 굳는다
  super_whiff: {
    p1: 3000, p2: 3260, settle: 70, meter: true,
    steps: [[[], 8], [['KeyO'], 1], [[], 130]],
  },
  // 약하게 맞음 (공통 동작): 평타 1타 한 대 → 기준 자세로 돌아올 때까지, 한 걸음 다가가 1·2·3타 (모두 약하게 맞음, 경직 16·16·19틱)
  hit_light: {
    p1: 3150, p2: 3196, settle: 70,
    steps: [[[], 6], [['KeyJ'], 1], [[], 34], [['ArrowRight'], 4], [[], 4], [['KeyJ'], 1], [[], 7], [['KeyJ'], 1], [[], 7], [['KeyJ'], 1], [[], 50]],
  },
  // 세게 맞음 (공통 동작): 대시 공격(경직 26틱, 땅에 선 채 세게 맞는 기본 스틱맨 기술)에 맞아 접힘 → 반동 → 휘청 → 기준 자세.
  // 대시 공격 승인 장면과 같은 거리(114px)
  hit_heavy: {
    p1: 3100, p2: 3214, settle: 70,
    steps: [[[], 8], [['KeyL'], 1], [[], 3], [['KeyJ'], 1], [[], 56]],
  },
  // 가드 크러시 (공통 동작): 막기만 하는 상대의 방어 내구도가 거의 없을 때 평타 → 방어가 깨져 44틱 무방비 → 다시 막기
  guard_crush: {
    q: 'scene=fight&dummy=guard', settle: 10, p1: 3150, p2: 3190,
    prep: 's.fighters[1].guard = 1;',
    steps: [[[], 6], [['KeyJ'], 1], [[], 70]],
  },
  // 공중에서 맞음 (공통 동작): 연속 장면(대시 공격 → 차지 → 점프 → 공중 3타). 공중 타격마다 1번부터, 떨어지는 동안 10~12번 되풀이,
  // 다섯 대째에 낙법이 가능해져 한 번 하얗게 깜빡이고, 바닥에 닿으면 다운
  hit_air: {
    p1: 2196, p2: 2296, settle: 70,
    steps: [
      [[], 6], [['KeyL'], 1], [[], 2], [['KeyJ'], 19], [[], 4], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 14],
      [['KeyJ', 'ArrowRight'], 1], [['ArrowRight'], 6], [['KeyJ', 'ArrowRight'], 1], [['ArrowRight'], 6], [['KeyJ', 'ArrowRight'], 1], [[], 50],
    ],
  },
  // 다운 → 기상 (공통 동작): 쓸기(↓+J)에 맞아 넘어져 한 번 튀고(다시 닿을 때 먼지) 누운 채 기다렸다가 일어선다
  knockdown: {
    p1: 3150, p2: 3196, settle: 70,
    steps: [[[], 6], [['KeyS', 'KeyJ'], 1], [[], 130]],
  },
  // 낙법 (공통 동작): 연속 장면 다섯 대째에 상대가 낙법 (?p2=tech: 가능해지면 바로 점프) → 웅크려 뒤로 한 바퀴(흰 잔상) → 낙하
  tech: {
    q: 'scene=fight&p2=tech', p1: 2196, p2: 2296, settle: 70,
    steps: [
      [[], 6], [['KeyL'], 1], [[], 2], [['KeyJ'], 19], [[], 4], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 14],
      [['KeyJ', 'ArrowRight'], 1], [['ArrowRight'], 6], [['KeyJ', 'ArrowRight'], 1], [['ArrowRight'], 6], [['KeyJ', 'ArrowRight'], 1], [[], 70],
    ],
  },
  // 라이덴 겉모습 확인 (1P만 라이덴 표식·색, 동작은 아직 기본 스틱맨): 대기 → 앞으로 뛰기 → 평타 1·2·3타 → 공격을 길게 눌러 모으기(붉은 빛) → 차지
  raiden_look: {
    q: 'scene=fight&p2=idle&p1skin=raiden', p1: 3060, p2: 3200, settle: 70,
    steps: [
      [[], 50], [['ArrowRight'], 18], [[], 8], [['KeyJ'], 1], [[], 7], [['KeyJ'], 1], [[], 9], [['KeyJ'], 1], [[], 34],
      [['KeyJ'], 70], [[], 50],
    ],
  },
  // 라이덴 대기: 1P·2P 모두 라이덴 (1P 흰 머리, 2P 검은 머리), 가만히 세 바퀴 (42틱 × 3)
  raiden_idle: {
    q: 'scene=fight&p2=idle&p1char=raiden&p2char=raiden', p1: 3060, p2: 3180, settle: 70,
    steps: [[[], 126]],
  },
  // 라이덴 이동 (?p1char=raiden): 앞 걷기 → 뒤 걷기 → 점프·2단 점프·낙하·착지 → 지상 대시 → 점프·공중 대시 → 방어
  raiden_moves: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 3000, p2: 3260, settle: 70,
    steps: [
      [[], 16], [['ArrowRight'], 52], [[], 14], [['ArrowLeft'], 46], [[], 16],
      [['KeyK'], 1], [[], 22], [['KeyK'], 1], [[], 52],
      [['KeyL'], 1], [[], 30],
      [['KeyK'], 1], [[], 9], [['KeyL'], 1], [[], 50],
      [['KeyS'], 30], [[], 20],
    ],
  },
  // 라이덴 방어·방어 막힘: 2P 라이덴(검은 머리)이 막기만 하고, 1P 기본 스틱맨이 평타 1·2·3타 → 대시 공격
  raiden_guard: {
    q: 'scene=fight&dummy=guard&p2char=raiden', p1: 3150, p2: 3196, settle: 30,
    steps: [[[], 10], [['KeyJ'], 1], [[], 7], [['KeyJ'], 1], [[], 7], [['KeyJ'], 1], [[], 40], [['ArrowLeft'], 12], [[], 6], [['KeyL'], 1], [[], 3], [['KeyJ'], 1], [[], 50]],
  },
  // 라이덴 벽 기동: 기둥탑 왼쪽 면(x 3040) 앞. ↗ 점프로 벽 붙기 → 미끄러짐 → 벽 박차기 공격 → 다시 벽 쪽으로 걸어가
  // ↑+대시로 벽 달리기 → 꼭대기에 못 닿아 벽 붙기 → 벽 점프
  raiden_wall: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 2985, p2: 3260, settle: 40,
    steps: [
      [[], 10], [['ArrowRight', 'ArrowUp', 'KeyK'], 1], [['ArrowRight', 'ArrowUp'], 18], [['ArrowRight'], 14], [['KeyJ'], 1], [[], 46],
      [['ArrowRight'], 24], [[], 4], [['ArrowRight', 'ArrowUp', 'KeyL'], 1], [['ArrowRight'], 34], [['ArrowRight'], 20], [['KeyK'], 1], [[], 50],
    ],
  },
  // 라이덴 등장: 경기 시작부터 (1P·2P 모두 라이덴, 2P는 검은 머리)
  raiden_intro: {
    q: 'scene=fight&p2=idle&p1char=raiden&p2char=raiden', stopAt: 1, settle: 0,
    steps: [[[], 100]],
  },
  // 라이덴 승리: 체력이 거의 없는 상대를 평타로 쓰러뜨리고 승리 동작
  raiden_win: {
    q: 'scene=fight&p2=idle&p1char=raiden', settle: 10, p1: 3150, p2: 3196,
    prep: 's.fighters[0].wins = 1; s.round = 2; s.fighters[1].hp = 30;',
    steps: [[[], 4], [['KeyJ'], 1], [[], 6], [['KeyJ'], 1], [[], 6], [['KeyJ'], 1], [[], 6], [['KeyJ'], 1], [[], 200]],
  },
  // 라이덴 지상 평타: 공격을 4틱마다 눌러 잽 → 스트레이트 → 훅 → 니킥 (니킥에 날아감)
  raiden_ground: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 3150, p2: 3190, settle: 30,
    steps: [[[], 6], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [[], 50]],
  },
  // 라이덴 띄우기(↑+공격, 어퍼컷) → 점프로 쫓아 공중 잽 → 스트레이트 → 니킥
  raiden_air: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 3150, p2: 3186, settle: 30,
    steps: [[[], 6], [['ArrowUp', 'KeyJ'], 1], [[], 14], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 8], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [['KeyJ'], 1], [[], 3], [[], 50]],
  },
  // 라이덴 띄우기 → 쫓아 점프 → 내려찍기(↓+공격, 해머 피스트)
  raiden_slam: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 3150, p2: 3186, settle: 30,
    steps: [[[], 6], [['ArrowUp', 'KeyJ'], 1], [[], 14], [['KeyK', 'ArrowRight'], 1], [['ArrowRight'], 8], [['ArrowDown', 'KeyJ'], 1], [[], 70]],
  },
  // 라이덴 쓸기(↓+공격, 로킥) → 상대가 일어나면 물러났다가 대시 공격(슈퍼맨 펀치)
  raiden_low: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 3150, p2: 3188, settle: 30,
    steps: [[[], 6], [['ArrowDown', 'KeyJ'], 1], [[], 100], [['ArrowLeft'], 20], [[], 6], [['KeyL'], 1], [[], 3], [['KeyJ'], 1], [[], 50]],
  },
  // 라이덴 금강: 2P 라이덴이 3스택인 채로 1P 기본 스틱맨에게 맞기 시작 → 첫 대에 4스택 금강불괴 (붉은 반짝임, 이름 옆 4칸 깜빡임)
  // → 그 뒤로는 맞아도 경직 없이 대기를 이어 감 (밀림 80% 감소)
  raiden_kongo: {
    q: 'scene=fight&p2=idle&p2char=raiden', p1: 3150, p2: 3190, settle: 20,
    prep: 's.fighters[1].kongo = 3;',
    steps: [[[], 10], [['KeyJ'], 1], [[], 40], [['KeyJ'], 1], [[], 7], [['KeyJ'], 1], [[], 7], [['KeyJ'], 1], [[], 60]],
  },
  // 라이덴 차지 투전승불: 공격을 길게 눌러 잽 → 모으기 1~4단계 (적빛 오라·단계마다 몸 둘레 번개) → 떼면 뒷주먹, 벽 쪽으로 날림
  raiden_charge: {
    q: 'scene=fight&p2=idle&p1char=raiden', p1: 4300, p2: 4350, settle: 40,
    steps: [[[], 6], [['KeyJ'], 100], [[], 70]],
  },
  // 공격(J)을 길게 눌러 평타 → 모으기 1·2·3단계 → 떼면 3단계 차지 (막혀도 방어를 깨고, 맞으면 벽 쪽으로 날림)
  charge: {
    p1: 4300, p2: 4356, settle: 70,
    steps: [[[], 6], [['KeyJ'], 82], [[], 56]],
  },
};

const argv = process.argv.slice(2);
const opt = { every: 1, scale: 2, crop: '', to: '' };
let name = '';
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  if (argv[i].startsWith('--') && k in opt) opt[k] = typeof opt[k] === 'number' ? Number(argv[++i]) : argv[++i];
  else name = argv[i];
}
const sc = SCENES[name];
if (!sc) {
  console.log(`장면 이름: ${Object.keys(SCENES).join(', ')}`);
  process.exit(1);
}

const server = await preview({ preview: { port: 4186 }, logLevel: 'error' });
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// stopAt: 이 틱에서 멈춘 뒤 찍기 시작 (등장 장면은 경기 시작부터 찍으려고 1)
const stopAt = sc.stopAt ?? 75;
await page.goto(`${server.resolvedUrls.local[0]}?${sc.q ?? 'scene=fight&p2=idle'}&stopAt=${stopAt}&ff=1&quality=high`);
await page.waitForFunction((n) => window.__debug?.tick >= n, stopAt);
await page.evaluate(() => window.__debug.unstop());
if (sc.p1 !== undefined) {
  await page.evaluate(([x1, x2, meter, prep]) => {
    const s = window.__fight();
    const [a, b] = s.fighters;
    Object.assign(a, { x: x1 * 256, y: 0, floor: 0, vx: 0, vy: 0, mode: 'idle', t: 0, facing: 1 });
    Object.assign(b, { x: x2 * 256, y: 0, floor: 0, vx: 0, vy: 0, mode: 'idle', t: 0, facing: -1 });
    if (meter) a.meter = 300;
    if (prep) new Function('s', prep)(s);
  }, [sc.p1, sc.p2, !!sc.meter, sc.prep ?? '']);
}
await page.evaluate((n) => window.__debug.benchTicks(n), sc.settle);

const frames = [];
const log = [];
const held = new Set();
let tick = 0;
for (const [keys, n] of sc.steps) {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  for (let i = 0; i < n; i++) {
    tick++;
    if (tick % opt.every === 0 || i === 0) {
      frames.push(await page.evaluate((m) => window.__debug.frame(m), 1));
      log.push(await page.evaluate(() => {
        if (window.__debug.scene !== 'fight') return window.__debug.scene;
        const s = window.__fight();
        return s.fighters.map((f) => `${f.mode}${f.move ? `/${f.move}` : ''}${f.t ? `@${f.t}` : ''}`).join(' | ');
      }));
    } else await page.evaluate((m) => window.__debug.benchTicks(m), 1);
  }
}
for (const k of held) await page.keyboard.up(k);
await browser.close();
await new Promise((r) => server.httpServer.close(r));
if (errors.length) {
  console.log('NG  페이지 오류:', errors.join(' / '));
  process.exit(1);
}

// 자르기와 확대, 한 팔레트로 합치기
const { w, h } = frames[0];
const [cx, cy, cw, ch] = opt.crop ? opt.crop.split(',').map(Number) : [0, 0, w, h];
const S = opt.scale;
const W = cw * S;
const H = ch * S;
const palette = [];
const global = new Map();
const gifFrames = frames.map((f) => {
  const raw = Buffer.from(f.data, 'base64');
  const map = f.colors.map((c) => {
    if (!global.has(c)) {
      if (palette.length >= 256) return 0;
      global.set(c, palette.length);
      palette.push(c);
    }
    return global.get(c);
  });
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const sy = (cy + Math.floor(y / S)) * w;
    for (let x = 0; x < W; x++) out[y * W + x] = map[raw[sy + cx + Math.floor(x / S)]];
  }
  return out;
});
const delay = Math.max(2, Math.round((opt.every * 100) / 60));
const delays = gifFrames.map(() => delay);
delays[delays.length - 1] += 60;
const gif = encodeGif(W, H, palette, gifFrames, delays);
mkdirSync('out/clips', { recursive: true });
const file = `out/clips/${name}.gif`;
writeFileSync(file, gif);
console.log(`OK  ${file}  ${frames.length}장, ${tick}틱, 색 ${palette.length}개, ${(gif.length / 1024).toFixed(0)}KB`);
log.forEach((l, i) => console.log(`    ${String(i + 1).padStart(3)} ${l}`));
if (opt.to) {
  mkdirSync(dirname(opt.to), { recursive: true });
  copyFileSync(file, opt.to);
  console.log(`    → ${opt.to}`);
}
