/**
 * 게임 빌드 표시: 온라인에서 두 사람이 같은 빌드인지 본다 (다르면 sim 규칙이 다를 수 있어 어긋난다 → '새로 고침' 안내).
 * GitHub Actions 빌드는 커밋 번호 앞 8자리, 그 밖(로컬·확인 도구)은 'dev'. vite.config.ts의 define이 채운다
 */
declare const __BUILD_ID__: string | undefined;

export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
