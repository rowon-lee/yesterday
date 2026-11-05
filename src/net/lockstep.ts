/**
 * 딜레이 방식 락스텝의 입력 장부 (렌더·DOM·시간을 모른다: Node 시험에서 그대로 돈다).
 *
 * - 틱 k의 입력 = sim이 k-1 → k로 넘어갈 때 쓰는 두 사람의 입력. 틱 1..delay는 양쪽 다 0으로 미리 채운다.
 * - 내 입력은 sim이 틱 k에 있을 때 틱 k+1+delay 몫으로 하나 정해(sample) 상대에게 보낸다. 그래서 누른 입력이 delay틱 뒤에 반영된다.
 * - 양쪽 입력이 다 모인 틱만 진행한다 (상대 입력이 아직 없으면 그 틱에서 기다림).
 * - 입력 묶음은 손실·순서 바뀜이 있는 통로로 보낸다: 상대가 받았다고 알려 온 틱(ack) 다음부터 지금까지를 매번 다시 담는다 (중복 전송).
 */

/** 묶음 하나에 담는 입력 수 상한 (상대가 오래 응답이 없을 때) */
const MAX_PACKET = 64;

/** 입력 묶음 (상대에게 보냄). JSON으로 보낸다 */
export interface InputPacket {
  /** 경기 번호 (재대결마다 1씩. 지난 경기 묶음이 늦게 오면 버린다) */
  m: number;
  /** v[0]이 몇 틱 입력인지 */
  k: number;
  /** 입력 비트들 (틱 k, k+1, …) */
  v: number[];
  /** 내가 받은 상대 입력 중 빠짐없이 이어진 마지막 틱 (상대는 그 뒤부터 다시 보내면 된다) */
  a: number;
  /** 보낸 쪽 sim 틱 */
  t: number;
  /** 보낸 쪽이 본 자기 앞섬 (자기 틱 − 받은 상대 틱, 평균). 시간 맞추기용 */
  g?: number;
}

export class Lockstep {
  /** 지금까지 진행한 sim 틱 수 (= sim 상태의 tick) */
  simTick = 0;
  /** 상대 sim 틱 (마지막으로 받은 묶음 기준) */
  remoteTick = 0;
  /** 상대가 알려 온 상대 쪽 앞섬 */
  remoteAdv = 0;
  private readonly mine: number[] = [];
  private readonly theirs: number[] = [];
  /** 내가 정해 둔 마지막 틱 */
  private mineHead: number;
  /** 상대 입력을 빠짐없이 받은 마지막 틱 */
  private theirsHead: number;
  /** 상대가 빠짐없이 받았다고 알려 온 내 마지막 틱 */
  private peerAck = 0;

  constructor(
    /** 0 = 왼쪽(1P, 방장), 1 = 오른쪽(2P) */
    readonly side: 0 | 1,
    /** 입력 지연 (틱) */
    readonly delay: number,
    readonly match: number,
  ) {
    for (let t = 1; t <= delay; t++) {
      this.mine[t] = 0;
      this.theirs[t] = 0;
    }
    this.mineHead = delay;
    this.theirsHead = delay;
  }

  /** 다음에 진행할 틱의 delay틱 뒤 몫 내 입력을 아직 안 정했나 */
  needSample(): boolean {
    return this.mineHead < this.simTick + 1 + this.delay;
  }

  /** 내 입력을 다음 빈 틱(simTick+1+delay)에 정한다 */
  schedule(bits: number): number {
    this.mine[++this.mineHead] = bits;
    return this.mineHead;
  }

  /** 다음 틱의 두 입력이 다 있나 */
  canStep(): boolean {
    return this.theirsHead >= this.simTick + 1 && this.mineHead >= this.simTick + 1;
  }

  /** 상대 입력이 몇 틱 앞까지 와 있나 (0이면 다음 틱에서 기다려야 함) */
  remoteAhead(): number {
    return this.theirsHead - this.simTick;
  }

  /** 다음 틱으로: [1P 입력, 2P 입력] */
  take(): [number, number] {
    const k = ++this.simTick;
    const a = this.mine[k]!;
    const b = this.theirs[k]!;
    return this.side === 0 ? [a, b] : [b, a];
  }

  /** 보낼 묶음: 상대가 아직 못 받은 내 입력 전부 (최대 MAX_PACKET개) */
  packet(): InputPacket {
    const from = Math.max(this.peerAck + 1, this.mineHead - MAX_PACKET + 1, 1);
    return { m: this.match, k: from, v: this.mine.slice(from, this.mineHead + 1), a: this.theirsHead, t: this.simTick };
  }

  /** 상대 묶음을 받는다 (중복·순서 바뀜·다른 경기 묶음은 알아서 걸러짐) */
  receive(p: InputPacket): void {
    if (p.m !== this.match || !Array.isArray(p.v)) return;
    for (let i = 0; i < p.v.length; i++) {
      const k = p.k + i;
      if (k > this.theirsHead && this.theirs[k] === undefined) this.theirs[k] = p.v[i]! | 0;
    }
    while (this.theirs[this.theirsHead + 1] !== undefined) this.theirsHead++;
    if (p.a > this.peerAck) this.peerAck = p.a;
    if (p.t >= this.remoteTick) {
      this.remoteTick = p.t;
      if (typeof p.g === 'number') this.remoteAdv = p.g;
    }
  }
}
