/**
 * 온라인 연결 설정 (사용자 결정 2026-11-05: (가) WebRTC 직접 연결 + PeerJS 무료 공개 연결 중개).
 * 운영할 서버가 없다: 두 사람이 서로를 찾을 때만 PeerJS 클라우드(0.peerjs.com)를 거치고, 찾은 뒤에는 둘이 직접 이어진다.
 * PeerJS 라이브러리는 쓰지 않고 같은 규약을 직접 쓴다 (런타임 의존성은 three.js 하나: CLAUDE.md).
 *
 * 확인 도구용 주소 옵션: ?signal=ws://localhost:9000/ (로컬 PeerServer), ?ice=none (STUN·TURN 없이 같은 기기 안에서만)
 */
export interface NetConfig {
  /** 연결 중개 서버 (PeerJS 규약) 웹소켓 주소 앞부분: 뒤에 peerjs?key=… 이 붙는다 */
  signal: string;
  key: string;
  iceServers: RTCIceServer[];
}

/** PeerJS 클라우드와 PeerJS 라이브러리 기본 ICE 설정 (구글 STUN + PeerJS 무료 TURN: 직접 연결이 안 될 때 유럽·미국을 돌아 이어짐) */
export const DEFAULT_NET: NetConfig = {
  signal: 'wss://0.peerjs.com/',
  key: 'peerjs',
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
  ],
};

/** PeerJS 클라우드는 모두가 같이 쓰므로 이 게임 방 이름 앞에 붙이는 말 (다른 앱의 이름과 겹치지 않게) */
export const ROOM_PREFIX = 'yesterday-stick-v1-room-';
export const PEER_PREFIX = 'yesterday-stick-v1-p-';

export function netConfig(params: URLSearchParams): NetConfig {
  const signal = params.get('signal');
  const ice = params.get('ice');
  return {
    ...DEFAULT_NET,
    signal: signal && /^wss?:\/\//.test(signal) ? (signal.endsWith('/') ? signal : `${signal}/`) : DEFAULT_NET.signal,
    iceServers: ice === 'none' ? [] : DEFAULT_NET.iceServers,
  };
}

/** 방 코드: 4자리 숫자 (1000~9999) */
export const isRoomCode = (s: string | null | undefined): s is string => !!s && /^[1-9][0-9]{3}$/.test(s);
export const newRoomCode = (): string => String(1000 + Math.floor(Math.random() * 9000));
