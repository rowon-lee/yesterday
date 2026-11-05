/**
 * 온라인 경기 한 판을 굴리는 쪽 (렌더·DOM을 모른다: 시계와 통로를 받아서 Node 시험에서도 그대로 돈다).
 *
 * 장면 틱(1초 60번)마다 tick(이번 입력)을 부르면 이번에 진행할 sim 틱의 입력 쌍을 돌려준다 (0~1개).
 *   0개: 상대 입력이 아직 안 옴 (기다림) 또는 시간 맞추기로 한 틱 쉼
 * 시간 맞추기 (격투 게임 넷코드의 흔한 방식): 양쪽이 '내 틱 − 받은 상대 틱'(앞섬)을 재서 묶음에 실어 보낸다.
 * 내 앞섬이 상대 앞섬보다 크면 내가 앞서 달리는 것이라 가끔 한 틱 쉰다. 뒤처진 쪽은 두 틱씩 달리지 않는다 (덜컥거림을 피함)
 * 장면은 받은 입력으로 sim.step을 하고 afterStep(상태)을 부른다: 30틱마다 상태 해시를 보내고 상대 해시와 비교한다.
 * 어긋나면 desync에 첫 어긋난 틱을 적고 기록을 남긴다 (화면 표시는 장면이 한다).
 */
import { BUTTONS, hashState, IN_ATTACK, type CharId, type SimState } from '../sim';
import { Lockstep, type InputPacket } from './lockstep';
import type { NetLog } from './log';

/** 해시를 주고받는 간격 (틱) */
export const HASH_EVERY = 30;

export interface DriverOpts {
  side: 0 | 1;
  delay: number;
  match: number;
  seed: number;
  chars: [CharId, CharId];
  build: string;
  /** 시각 (ms) */
  now: () => number;
  /** 지금 왕복 지연 (ms, 모르면 0) */
  rtt: () => number;
  /** 이 시각(ms) 전에는 진행하지 않는다 (방장은 시작을 보낸 뒤 왕복의 절반만큼 기다려 둘이 같이 시작) */
  startAt: number;
}

export interface DriverSend {
  inp(data: string): void;
  ctl(msg: { t: 'hash'; m: number; k: number; h: string }): void;
}

export class NetDriver {
  readonly lock: Lockstep;
  /** 기다리는 동안 누른 버튼 (다음에 입력을 정할 때 더한다: 짧게 누른 버튼이 사라지지 않게) */
  private latch = 0;
  private prevBits = 0;
  private curStall = 0;
  /** 내 앞섬 (평균) */
  private advAvg = 0;
  private sinceSyncWait = 0;
  private readonly myHash = new Map<number, string>();
  private readonly theirHash = new Map<number, string>();
  /** 누른 시각 (공격 버튼이 새로 눌린 장면 틱) → 그 입력이 쓰일 틱 */
  private readonly pressAt = new Map<number, number>();
  private pendingPress = -1;
  desync: { k: number; mine: string; theirs: string } | null = null;
  readonly log: NetLog;
  readonly stats = {
    /** 장면 틱 수 (시작 뒤) */
    sceneTicks: 0,
    /** 진행한 sim 틱 */
    ticks: 0,
    /** 상대 입력이 없어 기다린 장면 틱 */
    stalls: 0,
    /** 가장 길게 이어서 기다린 틱 */
    maxStall: 0,
    /** 시간 맞추기로 쉰 틱 */
    syncWaits: 0,
    /** 해시가 맞은 횟수 */
    hashOk: 0,
    /** 공격 버튼을 누른 뒤 그 입력이 쓰인 틱을 진행하기까지 (ms): 합계와 수, 최대 */
    reactSum: 0,
    reactN: 0,
    reactMax: 0,
  };

  constructor(readonly opts: DriverOpts, private readonly send: DriverSend) {
    this.lock = new Lockstep(opts.side, opts.delay, opts.match);
    this.log = {
      v: 1,
      build: opts.build,
      at: new Date().toISOString(),
      side: opts.side,
      seed: opts.seed,
      chars: opts.chars,
      delay: opts.delay,
      match: opts.match,
      inputs: [],
      hashes: [],
      desync: null,
      stats: this.stats,
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'node',
    };
  }

  /** 상대 입력 묶음이 왔다 */
  onInput(p: InputPacket): void {
    this.lock.receive(p);
  }

  /** 상대 해시가 왔다 */
  onHash(m: number, k: number, h: string): void {
    if (m !== this.opts.match) return;
    this.theirHash.set(k, h);
    this.compare(k);
  }

  /** 시작했나 (방장은 시작을 보낸 뒤 조금 기다린다) */
  started(): boolean {
    return this.opts.now() >= this.opts.startAt;
  }

  /** 지금 상대 입력을 기다리는 중 (이어서 몇 틱째) */
  get waiting(): number {
    return this.curStall;
  }

  /**
   * 장면 틱 하나: bits = 이번 장면 틱의 내 입력 (누르고 있는 것 + 이번에 누른 것).
   * 진행할 sim 틱들의 [1P, 2P] 입력을 돌려준다
   */
  tick(bits: number): Array<[number, number]> {
    const now = this.opts.now();
    const out: Array<[number, number]> = [];
    if (now < this.opts.startAt) {
      this.sendPacket();
      return out;
    }
    this.stats.sceneTicks++;
    // 반응 시간: 공격 버튼이 새로 눌린 순간
    if (bits & IN_ATTACK && !(this.prevBits & IN_ATTACK)) this.pendingPress = now;
    this.prevBits = bits;
    let sampled = false;
    this.advAvg = this.advAvg * 0.95 + (this.lock.simTick - this.lock.remoteTick) * 0.05;
    this.sinceSyncWait++;
    if (this.lock.needSample()) {
      const k = this.lock.schedule(bits | this.latch);
      if (this.pendingPress >= 0) {
        this.pressAt.set(k, this.pendingPress);
        this.pendingPress = -1;
      }
      this.latch = 0;
      sampled = true;
    }
    if (!this.lock.canStep()) {
      this.stats.stalls++;
      this.curStall++;
      this.stats.maxStall = Math.max(this.stats.maxStall, this.curStall);
    } else if (this.advAvg - this.lock.remoteAdv > 1.5 && this.sinceSyncWait >= 15) {
      // 내가 상대보다 앞서 달린다: 한 틱 쉬어 상대가 따라오게 (늘 앞선 쪽만 기다리지 않도록)
      this.stats.syncWaits++;
      this.sinceSyncWait = 0;
      this.advAvg -= 1;
    } else {
      this.curStall = 0;
      const pair = this.lock.take();
      const k = this.lock.simTick;
      this.log.inputs.push(pair[0], pair[1]);
      const at = this.pressAt.get(k);
      if (at !== undefined) {
        const ms = now - at;
        this.stats.reactSum += ms;
        this.stats.reactN++;
        this.stats.reactMax = Math.max(this.stats.reactMax, ms);
        this.pressAt.delete(k);
      }
      this.stats.ticks++;
      out.push(pair);
    }
    if (!sampled) this.latch |= bits & BUTTONS;
    this.sendPacket();
    return out;
  }

  /** sim을 한 틱 진행한 뒤: 해시 차례면 보내고 비교 */
  afterStep(s: SimState): void {
    if (s.tick % HASH_EVERY !== 0) return;
    const h = hashState(s);
    this.myHash.set(s.tick, h);
    this.send.ctl({ t: 'hash', m: this.opts.match, k: s.tick, h });
    this.compare(s.tick);
  }

  private sendPacket(): void {
    const p = this.lock.packet();
    p.g = Math.round(this.advAvg * 100) / 100;
    this.send.inp(JSON.stringify(p));
  }

  private compare(k: number): void {
    const mine = this.myHash.get(k);
    const theirs = this.theirHash.get(k);
    if (mine === undefined || theirs === undefined) return;
    this.log.hashes.push([k, mine, theirs]);
    this.myHash.delete(k);
    this.theirHash.delete(k);
    if (mine === theirs) this.stats.hashOk++;
    else if (!this.desync) {
      this.desync = { k, mine, theirs };
      this.log.desync = this.desync;
    }
  }
}
