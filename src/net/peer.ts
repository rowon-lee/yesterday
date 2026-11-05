/**
 * WebRTC 직접 연결 하나 (두 사람 사이). 데이터 채널 둘을 미리 정한 번호로 연다 (양쪽이 같은 걸 만들면 이어짐):
 *   ctl (0번): 빠짐없이·순서대로 — 로비 신호, 해시, 재대결, 핑
 *   inp (1번): 순서 없이·다시 보내지 않음 — 입력 묶음 (빠지면 다음 묶음이 다시 담아 온다. 늦은 재전송에 막히지 않게)
 * 손님(join)이 제안(OFFER)을 만들고 방장(host)이 답(ANSWER)한다. ICE 후보는 오는 대로 주고받는다.
 */
import type { Channel } from './link';
import type { Signaler } from './signal';

export type PeerState = 'connecting' | 'open' | 'closed';

/** 연결 경로: 직접 (같은 망·STUN으로 뚫음) / 중계 (TURN 서버를 돌아감: 멀어서 느림) */
export type PeerRoute = 'direct' | 'relay' | 'unknown';

export class PeerLink {
  readonly pc: RTCPeerConnection;
  readonly ctl: Channel;
  readonly inp: Channel;
  state: PeerState = 'connecting';
  route: PeerRoute = 'unknown';
  /** 연결이 잠깐 불안정 (끊긴 건 아님: 다시 이어질 수 있음) */
  unstable = false;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  private readonly dcs: [RTCDataChannel, RTCDataChannel];
  private pending: RTCIceCandidateInit[] = [];
  private remoteSet = false;

  constructor(iceServers: RTCIceServer[], private readonly signaler: Signaler | null, private readonly remoteId: string) {
    this.pc = new RTCPeerConnection({ iceServers });
    const ctl = this.pc.createDataChannel('ctl', { negotiated: true, id: 0 });
    const inp = this.pc.createDataChannel('inp', { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
    this.dcs = [ctl, inp];
    const wrap = (dc: RTCDataChannel): Channel => {
      const ch: Channel = {
        onmessage: null,
        send: (d) => {
          if (dc.readyState === 'open') {
            try {
              dc.send(d);
            } catch {
              // 버퍼가 가득 찼거나 닫히는 중: 입력 묶음은 다음에 다시 담긴다
            }
          }
        },
      };
      dc.onmessage = (ev) => ch.onmessage?.(String(ev.data));
      return ch;
    };
    this.ctl = wrap(ctl);
    this.inp = wrap(inp);
    let opened = 0;
    for (const dc of this.dcs) {
      dc.onopen = () => {
        if (++opened === 2) {
          this.state = 'open';
          void this.detectRoute();
          this.onopen?.();
        }
      };
      dc.onclose = () => this.close();
    }
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) this.signaler?.send('CANDIDATE', this.remoteId, { candidate: ev.candidate.toJSON() });
    };
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      this.unstable = s === 'disconnected';
      if (s === 'failed' || s === 'closed') this.close();
    };
  }

  /** 손님: 제안을 만들어 보낸다 (payload에 규약 버전·빌드를 함께) */
  async offer(extra: Record<string, unknown>): Promise<void> {
    const o = await this.pc.createOffer();
    await this.pc.setLocalDescription(o);
    this.signaler?.send('OFFER', this.remoteId, { sdp: this.pc.localDescription, ...extra });
  }

  /** 방장: 받은 제안에 답한다 */
  async answer(sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(sdp);
    await this.flushCandidates();
    const a = await this.pc.createAnswer();
    await this.pc.setLocalDescription(a);
    this.signaler?.send('ANSWER', this.remoteId, { sdp: this.pc.localDescription });
  }

  /** 손님: 방장의 답을 받았다 */
  async accept(sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(sdp);
    await this.flushCandidates();
  }

  /** 상대 ICE 후보 (원격 설명이 아직이면 모아 두었다 넣는다) */
  async candidate(c: RTCIceCandidateInit): Promise<void> {
    if (!this.remoteSet) {
      this.pending.push(c);
      return;
    }
    try {
      await this.pc.addIceCandidate(c);
    } catch {
      // 맞지 않는 후보는 버린다
    }
  }

  close(): void {
    if (this.state === 'closed') return;
    this.state = 'closed';
    for (const dc of this.dcs) {
      dc.onclose = null;
      try {
        dc.close();
      } catch {
        // 이미 닫힘
      }
    }
    try {
      this.pc.close();
    } catch {
      // 이미 닫힘
    }
    this.onclose?.();
  }

  private async flushCandidates(): Promise<void> {
    this.remoteSet = true;
    const list = this.pending;
    this.pending = [];
    for (const c of list) await this.candidate(c);
  }

  /** 고른 경로가 TURN 중계인지 (getStats의 선택된 후보 쌍) */
  private async detectRoute(): Promise<void> {
    try {
      const stats = await this.pc.getStats();
      let pairId = '';
      stats.forEach((r) => {
        if (r.type === 'transport' && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId as string;
      });
      let localId = '';
      stats.forEach((r) => {
        if (r.type === 'candidate-pair' && (r.id === pairId || (!pairId && r.nominated && r.state === 'succeeded'))) localId = r.localCandidateId as string;
      });
      stats.forEach((r) => {
        if (r.type === 'local-candidate' && r.id === localId) this.route = r.candidateType === 'relay' ? 'relay' : 'direct';
      });
    } catch {
      this.route = 'unknown';
    }
  }
}
