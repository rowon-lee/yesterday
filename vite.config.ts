import { defineConfig } from 'vite';

// GitHub Pages는 /저장소이름/ 아래에서 열리므로 상대 경로로 빌드한다.
// __BUILD_ID__: 온라인 대련에서 두 사람이 같은 빌드인지 보는 표시 (Actions 빌드는 커밋 번호, 그 밖은 'dev')
export default defineConfig({
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 8)),
  },
});
