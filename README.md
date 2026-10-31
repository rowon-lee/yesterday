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
| `npm run shot -- "fight?p1=cpu" --tick 3000 --fast` | 주소 옵션을 붙인 장면, 멈출 틱까지 바로 돌려서 찍기 | |
| `npm run clip -- "fight?p1=cpu&seed=5" --from 130 --ticks 200 --name 이름` | 장면 한 토막을 움직이는 GIF로 (2배, 30fps). 동작 느낌 확인·PR 미리보기용 | `out/clips/이름.gif` |
| `npm run simtest` | CPU끼리 N판 대전. 예외, 규칙 범위(체력·기력·방어 내구도·위치), 경기 종료, `sim/`의 무작위·시간 값 사용, 같은 입력 재생·저장/복원 후 상태 해시 일치 확인. 히트·띄우기·낙법·크러시 등 집계 | 콘솔 |
| `npm run simtest -- --matches 50 --ticks 5400 --seed 7` | 판 수·판당 최대 틱·시작 시드 지정 | |

장면은 `src/scenes/index.ts`에 등록하고, 게임 주소 뒤 `?scene=이름`으로 열 수 있다.

## 대련 (연습: 1P 대 CPU)

배포 주소: https://rowon-lee.github.io/yesterday/

| 버튼 | 키 |
| --- | --- |
| 방향 (← → 뛰기, ↓ 방어, ↑+공격 띄우기, ↓+공격 쓸기·내려찍기) | 화살표 또는 WASD |
| 공격 | J |
| 점프 (공중에서 2단 점프, 맞고 있을 때 낙법) | K |
| 대시 (← 누르고 대시 = 뒤로) | L |
| 기술 A · 기술 B · 필살 | U · I · O |
| 판정 상자 켜고 끄기 | B |

주소 옵션: `?p2=idle` 상대가 가만히 섬 (연습), `?p1=cpu` CPU끼리 (구경), `?boxes=1` 판정 상자, `?seed=n` CPU 시드.

## 무대 보기

`?scene=stage`: 첫 구역 '도심 대로'만 띄운다. 카메라가 맵 끝에서 끝까지 오가고, ← →로 직접 움직일 수 있다. `?cam=320`처럼 카메라 위치를 고정할 수도 있다.

- 배치 숫자: `src/data/stages/downtown.ts`
- 그리기: `src/render/stage/` (여러 겹 시차 배경, 매연·서치라이트·가스등 불빛은 매 틱)

## 모션 뷰어

배포 주소 뒤에 `?scene=viewer`: https://rowon-lee.github.io/yesterday/?scene=viewer

화면 아래 버튼으로 동작 선택, 재생/정지, 한 프레임씩, 1·0.5·0.25배속, 판정 상자, 1P/2P 색, 좌우를 바꾼다.
키보드: ↑↓ 동작, ←→ 한 프레임, Space 재생/정지, S 속도, H 판정, C 색, F 좌우.

## 동작 데이터

- 포즈와 키프레임: `src/data/poses/` (숫자만). 목록은 `src/data/poses/index.ts`.
- 뼈대·IK·보간·그리기: `src/anim/`. 시작할 때 모든 동작을 시트로 미리 그린다 (`bakeAllMotions`).
