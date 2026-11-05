/**
 * 연결 중개 (PeerJS 서버 규약, 라이브러리 없이 브라우저 기본 WebSocket으로).
 *   접속: <signal>peerjs?key=peerjs&id=<내 이름>&token=<아무 값>  → 서버가 {type:'OPEN'} 또는 {type:'ID-TAKEN'}
 *   보내기: {type:'OFFER'|'ANSWER'|'CANDIDATE', dst, payload}  → 서버가 src를 붙여 상대에게 넘긴다
 *   상대가 없으면 {type:'EXPIRE', src: 상대}를 돌려준다 → '그런 방 없음' (실제 클라우드는 바로, 공개 서버 패키지는 5초쯤 뒤)
 * 주의 (2026-11-05 확인): 실제 0.peerjs.com은 payload를 정해진 칸으로만 받는다. 칸이 다르면 소켓을 닫아 버린다 (1000·1011).
 *   OFFER: sdp, type('data'), connectionId, label, reliable, serialization, metadata(아무 JSON)
 *   ANSWER: sdp, type, connectionId        CANDIDATE: candidate, type, connectionId
 * 그래서 PeerJS 라이브러리가 보내는 모양 그대로 보낸다 (peer.ts)
 *   살아 있음 알림: 5초마다 {type:'HEARTBEAT'}
 */
import type { NetConfig } from './config';

export type SignalType = 'OPEN' | 'ID-TAKEN' | 'ERROR' | 'OFFER' | 'ANSWER' | 'CANDIDATE' | 'EXPIRE' | 'LEAVE';

export interface SignalMessage {
  type: SignalType;
  src?: string;
  dst?: string;
  payload?: unknown;
}

const HEARTBEAT_MS = 5000;

export class Signaler {
  private ws: WebSocket | null = null;
  private beat = 0;
  private opened = false;
  onopen: (() => void) | null = null;
  onmessage: ((m: SignalMessage) => void) | null = null;
  /** 접속 실패·끊김 (열리기 전이면 opened = false) */
  onclose: ((reason: string, opened: boolean) => void) | null = null;

  constructor(private readonly cfg: NetConfig, readonly id: string) {}

  connect(): void {
    const token = Math.random().toString(36).slice(2, 12);
    const url = `${this.cfg.signal}peerjs?key=${encodeURIComponent(this.cfg.key)}&id=${encodeURIComponent(this.id)}&token=${token}&version=1.5.4`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      queueMicrotask(() => this.onclose?.('server', false));
      return;
    }
    this.ws = ws;
    ws.onmessage = (ev) => {
      let m: SignalMessage;
      try {
        m = JSON.parse(String(ev.data)) as SignalMessage;
      } catch {
        return;
      }
      if (m.type === 'OPEN') {
        this.opened = true;
        this.beat = window.setInterval(() => this.raw({ type: 'HEARTBEAT' }), HEARTBEAT_MS);
        this.onopen?.();
      } else if (m.type === 'ID-TAKEN') this.finish('taken');
      else if (m.type === 'ERROR') this.finish('server');
      else this.onmessage?.(m);
    };
    ws.onerror = () => this.finish('server');
    ws.onclose = () => this.finish(this.opened ? 'closed' : 'server');
  }

  send(type: 'OFFER' | 'ANSWER' | 'CANDIDATE', dst: string, payload: unknown): void {
    this.raw({ type, dst, payload });
  }

  /** 다 쓰면 닫는다 (직접 연결이 열리면 중개는 필요 없다: 방 이름도 풀린다) */
  close(): void {
    const ws = this.ws;
    this.ws = null;
    window.clearInterval(this.beat);
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      try {
        ws.close();
      } catch {
        // 이미 닫힘
      }
    }
  }

  private raw(m: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  private finish(reason: string): void {
    if (!this.ws) return;
    const opened = this.opened;
    this.close();
    this.onclose?.(reason, opened);
  }
}
