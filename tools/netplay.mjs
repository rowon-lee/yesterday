// 온라인 대련을 브라우저 두 개로 시험한다 (Playwright, 헤드리스 Chromium 두 개를 따로 띄움).
//   npm run netplay                    지연 표 (왕복 0·50·100·150ms × 입력 지연 AUTO·2·3·4) + 나가기·끊김·재대결 흐름
//   npm run netplay -- --quick         왕복 0·100ms × AUTO만 (빠른 확인)
//   npm run netplay -- --flows         지연 표 없이 나가기·끊김·재대결 흐름만
//   npm run netplay -- --cloud         로컬 중개 대신 실제 0.peerjs.com으로 한 판 (그 서버에 닿는 곳에서만)
//   npm run netplay -- --shots         화면 캡처만 (방 만들기·숫자 패드·로비·대련·나가기 확인·끊김) → previews/online/
//   --seconds 20                       한 칸에서 싸우는 시간
// 연결 중개는 PeerJS 공식 서버 패키지(peer)를 이 컴퓨터에 띄워 쓴다 (실제 게임은 같은 서버 소프트웨어가 도는 0.peerjs.com).
// 두 브라우저는 실제 화면 흐름 그대로 키를 눌러 방을 만들고(1P), 초대 링크로 들어가고(2P), 캐릭터를 고르고 READY 한다.
// 싸우는 동안은 CPU가 각자 자기 쪽 입력을 낸다 (?netcpu=1). 지연은 주소 ?lag=왕복ms&jitter=ms (src/net/link.ts: 보내는 쪽마다 절반씩).
// 손맛 재기는 ?draw=0으로 그리지 않고 한다: 이 컨테이너는 그래픽 칩이 없어 3D 그리기가 느려 틱이 밀리기 때문 (네트워크만 재려고).
// 잰 것: 기다림(상대 입력이 없어 멈춘 장면 틱 비율, 가장 긴 멈춤), 진행 속도(초당 틱), 누름→반영(공격을 누른 뒤 그 입력이 쓰인 틱까지 ms),
//        해시 일치 횟수와 어긋남, 양쪽이 쓴 입력 기록이 같은지
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { PeerServer } from 'peer';

const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const val = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const SECONDS = Number(val('--seconds', 20));
const SHOTS = has('--shots');
const QUICK = has('--quick');
const FLOWS = has('--flows');
const CLOUD = has('--cloud');

const SIGNAL_PORT = 9000 + Math.floor(Math.random() * 500);
const peerServer = PeerServer({ port: SIGNAL_PORT, path: '/', host: '127.0.0.1' });
// 파일을 고쳐도 시험 중인 페이지가 다시 불러와지지 않게 (HMR·감시 끔)
const vite = await createServer({ logLevel: 'error', server: { port: 5195, hmr: false, watch: null } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
/** 연결 중개: 기본은 이 컴퓨터에 띄운 PeerServer, --cloud면 게임 기본값(0.peerjs.com) */
const SIG = CLOUD ? '' : `signal=ws://127.0.0.1:${SIGNAL_PORT}/&`;
const ARGS = ['--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'];
let failed = 0;
const ng = (m) => {
  failed++;
  console.log(`NG  ${m}`);
};

/** 브라우저 하나 (따로 띄움) */
async function open(query, view = { width: 960, height: 540 }) {
  const browser = await chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: view });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?${query}`, { timeout: 600000 });
  await page.waitForFunction(() => window.__debug !== undefined, null, { timeout: 600000 });
  return { browser, page, errors };
}

const netOf = (p) => p.page.evaluate(() => window.__debug.net);
const waitNet = (p, fn, arg, ms = 30000) => p.page.waitForFunction(fn, arg, { timeout: ms, polling: 50 });
async function keys(p, list, gap = 90) {
  for (const k of list) {
    await p.page.keyboard.press(k);
    await p.page.waitForTimeout(gap);
  }
}

/**
 * 두 사람을 잇고 경기를 시작한다. delay: 0 = AUTO, 2~4 고정. chars: [1P 줄 번호, 2P 줄 번호]
 * 1P는 타이틀 → ONLINE → CREATE ROOM, 2P는 초대 링크(?scene=online&room=코드)로 바로 들어간다
 */
async function connect({ rtt, jitter, delay, chars = [0, 3], extra = '' }) {
  const q = `${SIG}ice=none&lag=${rtt}&jitter=${jitter}${extra}`;
  const A = await open(`scene=title&${q}`);
  // 타이틀 메뉴: VERSUS CPU, PRACTICE, OPTIONS, ONLINE → ONLINE (S 세 번, J) → CREATE ROOM (J)
  await keys(A, ['KeyS', 'KeyS', 'KeyS', 'KeyJ']);
  await A.page.waitForFunction(() => window.__debug.scene === 'online', null, { timeout: 20000 });
  await keys(A, ['KeyJ']);
  await waitNet(A, () => window.__debug.net.phase === 'waiting');
  const code = (await netOf(A)).code;
  const t0 = Date.now();
  const B = await open(`scene=online&room=${code}&${q}`);
  await Promise.all([A, B].map((p) => waitNet(p, () => window.__debug.net.phase === 'lobby')));
  const joinMs = Date.now() - t0;
  // 핑을 몇 번 재게 잠깐 둔다 (AUTO 지연이 핑으로 정해진다)
  await A.page.waitForTimeout(1500);
  // 1P: DELAY 줄(5번째)로 내려가 J로 AUTO → 2 → 3 → 4, 다시 올라와 캐릭터에서 J(READY)
  if (delay) await keys(A, ['KeyS', 'KeyS', 'KeyS', 'KeyS', ...Array(delay - 1).fill('KeyJ'), 'KeyW', 'KeyW', 'KeyW', 'KeyW']);
  await keys(A, [...Array(chars[0]).fill('KeyS'), 'KeyJ']);
  await keys(B, [...Array(chars[1]).fill('KeyS'), 'KeyJ']);
  await Promise.all([A, B].map((p) => p.page.waitForFunction(() => window.__debug.scene === 'fight' && window.__debug.net.simTick > 0, null, { timeout: 30000 })));
  return { A, B, code, joinMs };
}

async function close(...ps) {
  for (const p of ps) await p.browser.close().catch(() => {});
}

function sameInputs(la, lb) {
  if (!la || !lb) return false;
  const n = Math.min(la.inputs.length, lb.inputs.length);
  for (let i = 0; i < n; i++) if (la.inputs[i] !== lb.inputs[i]) return false;
  return n > 0;
}

// ---------- 화면 캡처 ----------
if (SHOTS) {
  mkdirSync('previews/online', { recursive: true });
  const view = { width: 960, height: 540 };
  const q = `${SIG}ice=none&lag=60&jitter=5`;
  const A = await open(`scene=online&${q}`, view);
  await A.page.waitForTimeout(1500);
  await A.page.screenshot({ path: 'previews/online/1-menu.png' });
  await keys(A, ['KeyS', 'KeyJ', 'Digit4', 'Digit8']);
  await A.page.waitForTimeout(600);
  await A.page.screenshot({ path: 'previews/online/2-numpad.png' });
  await keys(A, ['KeyK', 'KeyW', 'KeyJ']);
  await waitNet(A, () => window.__debug.net.phase === 'waiting');
  await A.page.waitForTimeout(800);
  await A.page.screenshot({ path: 'previews/online/3-room-code.png' });
  const code = (await netOf(A)).code;
  const B = await open(`scene=online&room=${code}&${q}`, view);
  await Promise.all([A, B].map((p) => waitNet(p, () => window.__debug.net.phase === 'lobby')));
  await A.page.waitForTimeout(1500);
  await keys(A, ['KeyJ']);
  await keys(B, ['KeyS', 'KeyS', 'KeyS']);
  await A.page.waitForTimeout(1500);
  await A.page.screenshot({ path: 'previews/online/4-lobby-1p.png' });
  await B.page.screenshot({ path: 'previews/online/4-lobby-2p.png' });
  await keys(B, ['KeyJ']);
  await Promise.all([A, B].map((p) => p.page.waitForFunction(() => window.__debug.scene === 'fight' && window.__debug.net.simTick > 200, null, { timeout: 180000 })));
  await A.page.screenshot({ path: 'previews/online/5-fight-1p.png' });
  await keys(A, ['Escape']);
  await A.page.waitForTimeout(1500);
  await A.page.screenshot({ path: 'previews/online/6-leave-confirm.png' });
  await keys(A, ['KeyS', 'KeyJ']);
  await waitNet(B, () => window.__debug.net.phase === 'error');
  await B.page.waitForTimeout(1500);
  await B.page.screenshot({ path: 'previews/online/7-rival-left.png' });
  for (const p of [A, B]) p.errors.forEach((e) => ng(`페이지 오류: ${e}`));
  await close(A, B);
  console.log('OK  화면 캡처 → previews/online/1-menu.png … 7-rival-left.png');
  await finish();
}

// ---------- 지연 표 ----------
const rows = [];
const RTTS = FLOWS ? [] : CLOUD ? [0] : QUICK ? [0, 100] : [0, 50, 100, 150];
const DELAYS = QUICK || CLOUD ? [0] : [0, 2, 3, 4];
for (const rtt of RTTS) {
  for (const delay of DELAYS) {
    const jitter = rtt ? 8 : 0;
    let A;
    let B;
    try {
      ({ A, B } = await connect({ rtt, jitter, delay, extra: '&draw=0&netcpu=1' }));
      await A.page.waitForTimeout(SECONDS * 1000);
      const [na, nb] = await Promise.all([netOf(A), netOf(B)]);
      const [la, lb] = await Promise.all([A.page.evaluate(() => window.__debug.netlog), B.page.evaluate(() => window.__debug.netlog)]);
      const tag = `왕복 ${rtt}ms 지연 ${delay || 'AUTO'}`;
      const usedDelay = na.match?.delay;
      if (na.desync || nb.desync) ng(`${tag}: 어긋남 ${JSON.stringify(na.desync ?? nb.desync)}`);
      if (!sameInputs(la, lb)) ng(`${tag}: 양쪽이 쓴 입력 기록이 다름`);
      for (const p of [A, B]) p.errors.forEach((e) => ng(`${tag} 페이지 오류: ${e}`));
      const st = [na.stats, nb.stats];
      const sum = (k) => st[0][k] + st[1][k];
      const row = {
        rtt,
        delay: delay || `AUTO→${usedDelay}`,
        measuredRtt: Math.round((na.rtt + nb.rtt) / 2),
        stallPct: (sum('stalls') / sum('sceneTicks')) * 100,
        maxStall: Math.max(st[0].maxStall, st[1].maxStall),
        speed: (sum('ticks') / sum('sceneTicks')) * 60,
        react: sum('reactN') ? sum('reactSum') / sum('reactN') : 0,
        reactMax: Math.max(st[0].reactMax, st[1].reactMax),
        hashOk: sum('hashOk'),
        ticks: Math.min(na.simTick, nb.simTick),
      };
      rows.push(row);
      if (row.hashOk < 4) ng(`${tag}: 해시 비교가 거의 안 됨 (${row.hashOk})`);
      console.log(
        `OK  ${tag.padEnd(16)} 잰 핑 ${row.measuredRtt}ms, 쓴 지연 ${usedDelay}틱: 기다림 ${row.stallPct.toFixed(1)}% (가장 길게 ${row.maxStall}틱), ` +
          `진행 ${row.speed.toFixed(1)}틱/초, 누름→반영 평균 ${row.react.toFixed(0)}ms 최대 ${row.reactMax.toFixed(0)}ms, 해시 일치 ${row.hashOk}번, ${row.ticks}틱`,
      );
    } catch (e) {
      ng(`왕복 ${rtt}ms 지연 ${delay || 'AUTO'}: ${e.message.split('\n')[0]}`);
    }
    if (A && B) await close(A, B);
  }
}

// ---------- 흐름: 나가기, 끊김, 재대결 ----------
if (CLOUD) {
  // 실제 중개 서버: 없는 방 코드
  const C = await open(`scene=online&room=9871&ice=none&draw=0`);
  await waitNet(C, () => window.__debug.net.phase === 'error', null, 30000).catch(() => {});
  const nc = await netOf(C);
  if (nc.error === 'noroom') console.log('OK  실제 0.peerjs.com: 없는 방 코드 9871 → NO ROOM WITH THAT CODE');
  else ng(`실제 0.peerjs.com 없는 방: ${nc.phase} ${nc.error}`);
  await close(C);
}
if (!QUICK && !CLOUD) {
  // 나가기: 1P가 Esc → LEAVE MATCH → 2P에 '상대가 나감', 아무 키 → 타이틀
  {
    const { A, B } = await connect({ rtt: 40, jitter: 4, delay: 0, extra: '&draw=0' });
    await A.page.waitForTimeout(1000);
    await keys(A, ['Escape', 'KeyS', 'KeyJ']);
    await waitNet(B, () => window.__debug.net.phase === 'error', null, 10000).catch(() => {});
    const nb = await netOf(B);
    await B.page.waitForTimeout(800);
    await keys(B, ['KeyJ']);
    await B.page.waitForFunction(() => window.__debug.scene === 'title', null, { timeout: 10000 }).catch(() => {});
    const sa = await A.page.evaluate(() => window.__debug.scene);
    const sb = await B.page.evaluate(() => window.__debug.scene);
    if (nb.error === 'left' && sa === 'title' && sb === 'title') console.log('OK  나가기: 1P가 LEAVE MATCH → 1P 타이틀, 2P에 THE RIVAL LEFT → 키를 누르니 타이틀');
    else ng(`나가기 흐름: 2P error=${nb.error}, 1P 장면 ${sa}, 2P 장면 ${sb}`);
    await close(A, B);
  }
  // 끊김: 2P 브라우저를 그냥 닫는다 → 1P가 알아채고 CONNECTION LOST (또는 상대 나감)
  {
    const { A, B } = await connect({ rtt: 40, jitter: 4, delay: 0, extra: '&draw=0' });
    await A.page.waitForTimeout(1000);
    const t0 = Date.now();
    await B.browser.close();
    await waitNet(A, () => window.__debug.net.phase === 'error', null, 15000).catch(() => {});
    const na = await netOf(A);
    const ms = Date.now() - t0;
    if (na.phase === 'error') console.log(`OK  끊김: 2P 브라우저를 닫으니 ${(ms / 1000).toFixed(1)}초 뒤 1P에 '${na.error === 'lost' ? 'CONNECTION LOST' : na.error}' (그 뒤 키·5초 → 타이틀)`);
    else ng(`끊김을 15초 안에 알아채지 못함 (${na.phase})`);
    await close(A);
  }
  // 재대결: 한 경기를 끝까지 (CPU끼리, 지연 없음) → 둘 다 REMATCH → 경기 번호 2, 새 시드로 다시 시작하고 해시가 계속 맞는지
  {
    const { A, B } = await connect({ rtt: 0, jitter: 0, delay: 2, extra: '&draw=0&netcpu=1' });
    const first = await netOf(A);
    await Promise.all([A, B].map((p) => p.page.waitForFunction(() => window.__fight?.().phase === 'matchEnd' && window.__fight().phaseT > 130, null, { timeout: 300000 })));
    await keys(A, ['KeyJ']);
    await keys(B, ['KeyJ']);
    await Promise.all([A, B].map((p) => waitNet(p, () => window.__debug.net.match?.m === 2 && window.__debug.net.simTick > 200, null, 30000)));
    await A.page.waitForTimeout(3000);
    const [na, nb] = await Promise.all([netOf(A), netOf(B)]);
    if (na.match.seed !== first.match.seed && na.match.seed === nb.match.seed && !na.desync && !nb.desync && na.stats.hashOk > 3)
      console.log(`OK  재대결: 한 경기를 끝까지 하고 둘 다 REMATCH → 경기 2 (새 시드), 해시 일치 ${na.stats.hashOk}번`);
    else ng(`재대결 흐름: ${JSON.stringify({ a: na.match, b: nb.match, da: na.desync, db: nb.desync, ok: na.stats.hashOk })}`);
    await close(A, B);
  }
}

mkdirSync('out/netplay', { recursive: true });
if (rows.length) writeFileSync('out/netplay/table.json', JSON.stringify(rows, null, 2));
await finish();

async function finish() {
  await vite.close();
  peerServer.close?.();
  console.log(failed ? `NG ${failed}개` : '모두 통과');
  process.exit(failed ? 1 : 0);
}
