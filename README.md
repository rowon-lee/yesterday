# YESTERDAY 스틱 액션

YESTERDAY 세계관의 2D 도트 액션 게임. 작업 규칙은 [CLAUDE.md](CLAUDE.md), 기획은 `docs/`.

- 배포: main에 머지되면 GitHub Actions가 빌드해서 GitHub Pages에 올린다. PR에서는 빌드와 simtest만 돌린다.
- `npm run build` — 타입 검사 + 빌드 (`dist/`)

## 확인 도구

| 명령 | 하는 일 | 결과 |
| --- | --- | --- |
| `npm run sheets` | `src/anim/motions.ts`의 모든 동작을 가로 띠(4배, 프레임 번호)로 출력. 12~14프레임 규칙 검사 | `out/sheets/<캐릭터>/<동작>.png`, 같은 이름 `.md`에 프레임별 표시 틱 표 |
| `npm run sheets -- --approve raiden/jab` | 위와 같고, 승인 요청용으로 `previews/`에 복사 | `previews/raiden/jab.png` |
| `npm run shot` | 장면을 PC·휴대폰 크기로 캡처. 오류·정수배·틱 속도·키 입력 확인 | `out/shots/<장면>-<화면>.png` |
| `npm run shot -- blank --tick 300 --view pc-1280x720` | 장면·멈출 틱·화면 크기 지정 | |
| `npm run simtest` | CPU끼리 N판 대전. 예외, `sim/`의 무작위·시간 값 사용, 같은 입력 재생·저장/복원 후 상태 해시 일치 확인 | 콘솔 |
| `npm run simtest -- --matches 50 --ticks 5400 --seed 7` | 판 수·판당 최대 틱·시작 시드 지정 | |

장면은 `src/scenes.ts`에 등록하고, 게임 주소 뒤 `?scene=이름`으로 열 수 있다.
