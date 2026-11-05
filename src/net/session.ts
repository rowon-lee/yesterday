/**
 * 온라인 대련 한 연결의 상태 (장면이 바뀌어도 남는 하나: 로비 장면 ↔ 대련 장면은 3D 장면끼리라 페이지를 다시 불러오지 않는다).
 *
 * 흐름: 방 만들기(4자리 코드) / 방 들어가기 → 직접 연결 → 로비(캐릭터 고르기를 서로 보여 줌, 핑을 재서 입력 지연 고름)
 *       → 둘 다 확정하면 방장이 시작(시드·캐릭터·지연) → 대련 → 재대결(둘 다 동의) / 캐릭터 바꾸기 / 나가기
 * 끊기면 error에 까닭을 적는다 (장면이 알리고 타이틀로).
 */
import { CHAR_IDS, type CharId } from '../sim';
import { BUILD_ID } from './build';
import { isRoomCode, netConfig, newRoomCode, PEER_PREFIX, ROOM_PREFIX, type NetConfig } from './config';
import { NetDriver } from './driver';
import { lagFromUrl, lagged, realClock, type Channel, type Lag } from './link';
import { saveLog } from './log';
import { PeerLink } from './peer';
import { Signaler, type SignalMessage } from './signal';

/** 규약 버전: 메시지 모양이 바뀌면 올린다 (다르면 '새로 고침' 안내) */
export const PROTOCOL = 1;

/** 고를 수 있는 캐릭터 (타이틀과 같은 순서) */
export const ONLINE_ROSTER: readonly CharId[] = (['raiden', 'eunwoo', 'edward', 'oscar'] as const).filter((c) => (CHAR_IDS as readonly string[]).includes(c));

export type OnlinePhase = 'idle' | 'creating' | 'waiting' | 'joining' | 'lobby' | 'match' | 'error';
/**
 * server 중개 서버에 못 붙음 / noroom 그런 방 없음 / version 서로 게임 버전이 다름 /
 * connect 직접 연결 실패 (망이 막음) / left 상대가 나감 / lost 연결이 끊김
 */
export type OnlineError = 'server' | 'noroom' | 'version' | 'connect' | 'left' | 'lost';

export interface Pick {
  sel: number;
  locked: boolean;
}

export interface MatchInfo {
  /** 경기 번호 (재대결마다 +1) */
  m: number;
  seed: number;
  chars: [CharId, CharId];
  delay: number;
  /** 내 자리 (0 = 1P 방장, 1 = 2P 손님) */
  side: 0 | 1;
}

type Ctl =
  | { t: 'hello'; v: number; build: string }
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number }
  | { t: 'pick'; sel: number; locked: boolean }
  | { t: 'delay'; d: number }
  | { t: 'start'; m: number; seed: number; chars: [CharId, CharId]; delay: number }
  | { t: 'hash'; m: number; k: number; h: string }
  | { t: 'rematch' }
  | { t: 'change' }
  | { t: 'bye' };

/**
 * 페이지를 처음 열 때의 주소 옵션 (3D 장면끼리 바뀌면 주소가 ?scene=… 로 바뀌므로 처음 것을 들고 있는다).
 * 확인용: signal·ice·lag·jitter·loss·netcpu
 */
const BOOT = new URLSearchParams(location.search);
export const bootParam = (k: string): string | null => BOOT.get(k);

/** 연결을 기다리는 최대 시간 (ms) */
const CONNECT_MS = 20000;
/** 이만큼 아무 메시지도 없으면 끊긴 것으로 (ms) */
const SILENCE_MS = 5000;
const TICK_MS = 1000 / 60;

class OnlineSession {
  phase: OnlinePhase = 'idle';
  role: 'host' | 'guest' = 'host';
  code = '';
  error: OnlineError | null = null;
  /** 핑 (ms, 최근 8개의 가운값)과 흔들림 (최근 8개의 (최대−최소)/2) */
  rtt = 0;
  jitter = 0;
  mine: Pick = { sel: 0, locked: false };
  theirs: Pick = { sel: 0, locked: false };
  /** 방장이 고른 입력 지연 (0 = 핑을 재서 자동) */
  delayChoice = 0;
  match: MatchInfo | null = null;
  driver: NetDriver | null = null;
  rematch = { mine: false, theirs: false };
  /** 대련 중 상대가 '캐릭터 바꾸기'를 골랐다 (대련 장면이 로비로 돌아간다) */
  wantLobby = false;
  private cfg: NetConfig = netConfig(BOOT);
  private lag: Lag = lagFromUrl(BOOT);
  private signaler: Signaler | null = null;
  private link: PeerLink | null = null;
  private ctl: Channel | null = null;
  private inp: Channel | null = null;
  private samples: number[] = [];
  private lastPing = 0;
  private lastHeard = 0;
  private deadline = 0;
  private createTries = 0;
  private startAt = 0;

  get route(): string {
    return this.link?.route ?? 'unknown';
  }

  get unstable(): boolean {
    return this.link?.unstable === true;
  }

  get connected(): boolean {
    return this.phase === 'lobby' || this.phase === 'match';
  }

  /** 방 만들기: 4자리 코드를 정해 중개 서버에 그 이름으로 붙는다 (이미 쓰는 코드면 다른 코드로) */
  create(): void {
    this.reset();
    this.role = 'host';
    this.phase = 'creating';
    this.createTries = 0;
    this.listen(newRoomCode());
  }

  /** 방 들어가기: 코드의 방장에게 제안을 보낸다 */
  join(code: string): void {
    if (!isRoomCode(code)) return;
    this.reset();
    this.role = 'guest';
    this.phase = 'joining';
    this.code = code;
    this.deadline = performance.now() + CONNECT_MS;
    const sig = new Signaler(this.cfg, PEER_PREFIX + Math.random().toString(36).slice(2, 12));
    this.signaler = sig;
    sig.onopen = () => {
      const link = this.makeLink(ROOM_PREFIX + code, `dc_${Math.random().toString(36).slice(2, 13)}`);
      void link.offer({ v: PROTOCOL, build: BUILD_ID }).catch(() => this.fail('connect'));
    };
    sig.onmessage = (m) => this.onGuestSignal(m);
    sig.onclose = (_reason, opened) => {
      if (this.phase === 'joining') this.fail(opened ? 'connect' : 'server');
    };
    sig.connect();
  }

  /**
   * 나가기 (상대에게 알리고 끊는다). 'bye'를 보내자마자 연결을 닫으면 메시지가 나가기 전에 끊겨
   * 상대에게는 '연결 끊김'으로 보인다: 연결은 잠깐 뒤(시험용 지연이 있으면 그만큼 더)에 닫는다
   */
  leave(): void {
    const link = this.connected ? this.link : null;
    if (link) {
      this.send({ t: 'bye' });
      link.onclose = null;
      this.link = null;
      window.setTimeout(() => link.close(), 500 + this.lag.rtt + this.lag.jitter);
    }
    this.saveLog();
    this.reset();
  }

  /** 장면이 틱마다 부른다: 핑, 시간 초과 */
  tick(): void {
    const now = performance.now();
    if ((this.phase === 'joining' || (this.phase === 'waiting' && this.link)) && now > this.deadline) this.fail('connect');
    if (!this.connected) return;
    if (now - this.lastPing > (this.phase === 'lobby' ? 250 : 1000)) {
      this.lastPing = now;
      this.send({ t: 'ping', at: now });
    }
    if (now - this.lastHeard > SILENCE_MS) this.fail('lost');
  }

  /** 로비: 내 고르기 (상대에게 보인다) */
  setPick(sel: number, locked: boolean): void {
    this.mine = { sel: (sel + ONLINE_ROSTER.length) % ONLINE_ROSTER.length, locked };
    this.send({ t: 'pick', ...this.mine });
    this.maybeStart();
  }

  /** 방장: 입력 지연 (0 자동, 2~4) */
  setDelay(d: number): void {
    if (this.role !== 'host') return;
    this.delayChoice = d;
    this.send({ t: 'delay', d });
  }

  /** 핑으로 고른 입력 지연: 한쪽 지연 + 흔들림 + 여유 6ms가 몇 틱인가 (2~4) */
  autoDelay(): number {
    if (!this.samples.length) return 3;
    return Math.max(2, Math.min(4, Math.ceil((this.rtt / 2 + this.jitter + 6) / TICK_MS)));
  }

  /** 지금 쓸 입력 지연 (방장이 고정했으면 그 값) */
  delay(): number {
    return this.delayChoice || this.autoDelay();
  }

  /** 경기 끝: 재대결 (둘 다 고르면 방장이 새 시드로 시작) */
  requestRematch(): void {
    this.rematch.mine = true;
    this.send({ t: 'rematch' });
    this.maybeRematch();
  }

  /** 경기 끝: 둘 다 로비로 (캐릭터 다시 고르기) */
  requestChange(): void {
    this.send({ t: 'change' });
    this.toLobby();
  }

  /** 대련 장면: 이 경기의 시작 시각이 지났나 */
  started(): boolean {
    return performance.now() >= this.startAt;
  }

  /** 경기 기록을 브라우저에 남긴다 (어긋남이 났거나 경기가 끝났을 때) */
  saveLog(): void {
    if (this.driver && this.driver.log.inputs.length) saveLog(this.driver.log);
  }

  /** 확인 도구용 요약 */
  debug(): object {
    return {
      phase: this.phase,
      role: this.role,
      code: this.code,
      error: this.error,
      rtt: this.rtt,
      jitter: this.jitter,
      route: this.route,
      delay: this.match?.delay ?? this.delay(),
      mine: this.mine,
      theirs: this.theirs,
      match: this.match,
      stats: this.driver?.stats ?? null,
      desync: this.driver?.desync ?? null,
      simTick: this.driver?.lock.simTick ?? 0,
    };
  }

  // ---------- 안쪽 ----------

  private reset(): void {
    this.signaler?.close();
    this.signaler = null;
    const link = this.link;
    this.link = null;
    if (link) {
      link.onclose = null;
      link.close();
    }
    this.ctl = null;
    this.inp = null;
    this.phase = 'idle';
    this.error = null;
    this.code = '';
    this.samples = [];
    this.rtt = 0;
    this.jitter = 0;
    this.mine = { sel: this.mine.sel, locked: false };
    this.theirs = { sel: 0, locked: false };
    this.delayChoice = 0;
    this.match = null;
    this.driver = null;
    this.rematch = { mine: false, theirs: false };
    this.wantLobby = false;
  }

  private fail(e: OnlineError): void {
    if (this.phase === 'error' || this.phase === 'idle') return;
    this.saveLog();
    const keep = this.code;
    this.reset();
    this.code = keep;
    this.phase = 'error';
    this.error = e;
  }

  /** 방장: 코드 이름으로 중개 서버에 붙어 기다린다 */
  private listen(code: string): void {
    this.code = code;
    const sig = new Signaler(this.cfg, ROOM_PREFIX + code);
    this.signaler = sig;
    sig.onopen = () => {
      this.phase = 'waiting';
    };
    sig.onmessage = (m) => this.onHostSignal(m);
    sig.onclose = (reason, opened) => {
      if (this.signaler !== sig) return;
      if (reason === 'taken' && this.createTries++ < 6) {
        this.signaler = null;
        this.listen(newRoomCode());
      } else if (this.phase === 'creating' || this.phase === 'waiting') this.fail(opened ? 'lost' : 'server');
    };
    sig.connect();
  }

  /**
   * 방장: 손님의 제안. 이미 누가 들어오는 중이면 무시한다 (이어지는 순간 중개를 닫아 방 코드가 풀리므로 세 번째 사람은 '그런 방 없음'을 본다).
   * 버전이 다르면 연결 뒤 hello에서 양쪽 다 '버전 다름'으로 끝난다 (ANSWER에는 다른 칸을 실을 수 없다: signal.ts 주의)
   */
  private onHostSignal(m: SignalMessage): void {
    const p = (m.payload ?? {}) as { sdp?: RTCSessionDescriptionInit; connectionId?: string; candidate?: RTCIceCandidateInit };
    if (!m.src) return;
    if (m.type === 'OFFER') {
      if (this.link || !p.sdp) return;
      this.deadline = performance.now() + CONNECT_MS;
      const link = this.makeLink(m.src, p.connectionId ?? 'dc_host');
      void link.answer(p.sdp).catch(() => this.fail('connect'));
    } else if (m.type === 'CANDIDATE' && this.link && m.src === this.link.remote && p.candidate) void this.link.candidate(p.candidate);
  }

  private onGuestSignal(m: SignalMessage): void {
    const p = (m.payload ?? {}) as { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
    if (m.type === 'EXPIRE') this.fail('noroom');
    else if (m.type === 'ANSWER') {
      if (p.sdp && this.link) void this.link.accept(p.sdp).catch(() => this.fail('connect'));
    } else if (m.type === 'CANDIDATE' && this.link && p.candidate) void this.link.candidate(p.candidate);
  }

  private makeLink(remote: string, connectionId: string): PeerLink {
    const link = new PeerLink(this.cfg.iceServers, this.signaler, remote, connectionId);
    this.link = link;
    link.onopen = () => {
      // 직접 이어졌으면 중개는 닫는다 (방 코드도 풀린다)
      this.signaler?.close();
      this.signaler = null;
      this.ctl = lagged(link.ctl, this.lag, true, realClock);
      this.inp = lagged(link.inp, this.lag, false, realClock);
      this.ctl.onmessage = (d) => this.onCtl(d);
      this.inp.onmessage = (d) => {
        this.lastHeard = performance.now();
        try {
          this.driver?.onInput(JSON.parse(d));
        } catch {
          // 망가진 묶음은 버린다
        }
      };
      this.lastHeard = performance.now();
      this.phase = 'lobby';
      this.send({ t: 'hello', v: PROTOCOL, build: BUILD_ID });
      this.send({ t: 'pick', ...this.mine });
    };
    link.onclose = () => {
      if (this.link === link) this.fail(this.phase === 'lobby' || this.phase === 'match' ? 'lost' : 'connect');
    };
    return link;
  }

  private send(m: Ctl): void {
    this.ctl?.send(JSON.stringify(m));
  }

  private onCtl(d: string): void {
    const now = performance.now();
    this.lastHeard = now;
    let m: Ctl;
    try {
      m = JSON.parse(d) as Ctl;
    } catch {
      return;
    }
    switch (m.t) {
      case 'hello':
        if (m.v !== PROTOCOL || m.build !== BUILD_ID) this.fail('version');
        break;
      case 'ping':
        this.send({ t: 'pong', at: m.at });
        break;
      case 'pong': {
        this.samples.push(now - m.at);
        if (this.samples.length > 8) this.samples.shift();
        const sorted = [...this.samples].sort((a, b) => a - b);
        this.rtt = sorted[Math.floor(sorted.length / 2)]!;
        this.jitter = (sorted[sorted.length - 1]! - sorted[0]!) / 2;
        break;
      }
      case 'pick':
        this.theirs = { sel: m.sel, locked: m.locked };
        this.maybeStart();
        break;
      case 'delay':
        this.delayChoice = m.d;
        break;
      case 'start':
        if (this.role === 'guest') this.begin({ m: m.m, seed: m.seed, chars: m.chars, delay: m.delay, side: 1 }, now);
        break;
      case 'hash':
        this.driver?.onHash(m.m, m.k, m.h);
        break;
      case 'rematch':
        this.rematch.theirs = true;
        this.maybeRematch();
        break;
      case 'change':
        this.toLobby();
        break;
      case 'bye':
        this.fail('left');
        break;
    }
  }

  /** 방장: 로비에서 둘 다 확정하면 시작 */
  private maybeStart(): void {
    if (this.role !== 'host' || this.phase !== 'lobby' || !this.mine.locked || !this.theirs.locked) return;
    this.hostStart();
  }

  private maybeRematch(): void {
    if (this.role !== 'host' || this.phase !== 'match' || !this.rematch.mine || !this.rematch.theirs) return;
    this.hostStart();
  }

  private hostStart(): void {
    const info: MatchInfo = {
      m: (this.match?.m ?? 0) + 1,
      seed: (Math.random() * 0x7fffffff) | 0,
      chars: [ONLINE_ROSTER[this.mine.sel]!, ONLINE_ROSTER[this.theirs.sel]!],
      delay: this.delay(),
      side: 0,
    };
    this.send({ t: 'start', m: info.m, seed: info.seed, chars: info.chars, delay: info.delay });
    // 시작 신호가 상대에게 닿는 데 걸리는 만큼(왕복의 절반) 기다렸다 시작해 둘이 같은 때 시작한다
    this.begin(info, performance.now() + this.rtt / 2);
  }

  private begin(info: MatchInfo, startAt: number): void {
    this.saveLog();
    this.match = info;
    this.startAt = startAt;
    this.rematch = { mine: false, theirs: false };
    this.wantLobby = false;
    this.driver = new NetDriver(
      { side: info.side, delay: info.delay, match: info.m, seed: info.seed, chars: info.chars, build: BUILD_ID, now: () => performance.now(), rtt: () => this.rtt, startAt },
      { inp: (x) => this.inp?.send(x), ctl: (msg) => this.send(msg) },
    );
    this.phase = 'match';
  }

  private toLobby(): void {
    if (!this.connected) return;
    this.saveLog();
    this.phase = 'lobby';
    this.match = null;
    this.driver = null;
    this.mine = { sel: this.mine.sel, locked: false };
    this.theirs = { sel: this.theirs.sel, locked: false };
    this.rematch = { mine: false, theirs: false };
    this.wantLobby = true;
    this.send({ t: 'pick', ...this.mine });
  }
}

/** 게임 전체에 하나 */
export const net = new OnlineSession();
