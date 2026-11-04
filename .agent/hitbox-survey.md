# 3-0a(1) 판정 현황 조사 — 12~14프레임 제한 폐기 시점 (2026-11-04)

3-0b~3-0e(4명 1차본)를 3-0a보다 먼저 만든 상태에서 조사했다. **이번 3-0a(1)은 조사와 제한 폐기만 한다. 동작·판정 값은 하나도 바꾸지 않았다**(220개 동작의 관절·dur와 공격 데이터 지문이 바꾸기 전과 같고, simtest 20판 해시도 같다).
기술별 숫자는 sim이 실제로 쓰는 값(`movesOf(캐릭터)`의 activeStart·activeEnd·total)을 뽑아 적었다. 프레임 번호는 1부터(시트·GIF와 같다).

## 0. 한눈에

1. **발동·지속·회복은 어디에도 틱으로 적혀 있지 않다.** 모든 기술이 `그림의 프레임별 dur` + `공격 데이터의 판정 프레임 번호(active)`로 계산된다(`src/sim/frames.ts` buildMove: 발동 = 첫 판정 프레임 앞까지 dur 합, 지속 = 판정 프레임 dur 합, 회복 = 나머지). 공격 데이터에 틱으로 있는 것은 히트스톱·경직·막힘 경직뿐이다.
2. **캔슬 구간도 기술마다 적혀 있지 않다.** 공통 규칙 넷이 모두 위 activeStart·activeEnd(그림에서 나온 틱)에 묶여 있다(3장).
3. **판정 위치는 여섯 가지 방식이 섞여 있다**(1장). 그림 관절에서 나오는 것(기본 스틱맨 전부, 라이덴 평타의 팔다리 부분, 백은우 공중 3타·내려찍기), 그림 리본에서 뽑아 적은 것(백은우 연검 선), 공격 데이터 상자·선(에드워드, 오스카, 라이덴 번개 범위·화과산·차지)이다.
4. **피격 상자는 모든 상태에서 그림 관절로 만든다**(`src/anim/boxes.ts` hurtBox ← `sim/pose.ts` fighterPose). CLAUDE.md "피격 상자도 데이터로 둔다"는 아직 아니다.
5. 그래서 **지금은 그림만 다시 깎아도** 프레임 수·dur·자세에 따라 발동·지속·회복, 연타·점프·스킬 캔슬 시점, 관절 판정 위치, 피격 상자, 몸 이동(`advance`는 프레임별), 필살기 연출 장면 길이(장면 길이 = 그 장면 동작의 dur 합)가 함께 바뀐다. 재수정 전에 3-0a(2)(판정·시간을 틱 단위 공격 데이터로 옮기기)가 필요하다.

## 1. 판정이 나오는 곳 — 방식

| 방식 | 계산 | 코드 | 그림을 바꾸면 |
| --- | --- | --- | --- |
| **관절** | 판정 프레임에서 그 프레임 관절 `limb[0]→limb[1]` 구간의 끝 1/3 + 여유 4px (+ 번개 사거리 `reach`) | `anim/boxes.ts` hitBox ← `sim/frames.ts` moveHitBox | 위치·크기가 그대로 따라 바뀐다 |
| **관절 ∪ 상자** | 위 관절 상자와 공격 데이터 `box`(라이덴은 번개 범위, 백은우는 궤적)를 합친 상자 | 같은 곳 | 관절 부분만 바뀐다 |
| **상자** (`boxOnly`) | 공격 데이터 `box`만 (차지는 단계별 `levels[].box`) | 같은 곳 | 위치는 그대로, **켜지는 틱**은 바뀐다 |
| **연검 선** (`line`) | 판정 프레임마다 리본 점 8개를 이은 선이 피격 상자를 지나면 맞음 | `data/moves/lines.ts` ← `tools/ribbon-lines.mjs`가 **그림 리본에서 뽑아 적음**(프레임 번호 키), `sim/combat.ts` lineReaches | 다시 뽑아야 한다(simtest가 그림과 다르면 실패) |
| **오스카 선** (`selfHit`) | 첫 판정 프레임 시작 틱에 `data/poses/oscar/slashes.ts`의 선(두께 6px)이 생기고, 피격 상자에 닿았으면 LATE 3틱 뒤 맞음 | `sim/chars/oscar.ts` cutNow·lateHit | 위치는 그대로, 생기는 틱은 바뀐다 |
| **몸 둘레** | `limb`도 `boxOnly`도 없으면 피격 상자 + 좌우 10·위아래 4px | moveHitBox | 따라 바뀐다 (기본 스틱맨 스킬 2만) |
| 특수 | 에드워드 내려찍기 착지 충격파(반지름 48px)·차지 바닥 파도(SLAB_*)·염동력 끌기(TK_*), 라이덴 잔흔 잔상 띠(닿으면 느려짐, ZAN_*), 오스카 필살기 화면 전체 | `sim/chars/*.ts`, `sim/combat.ts` zanTouch | 켜지는 시점이 프레임 번호 상수에 묶인 것이 있다(3장) |

## 2. 기술별 표

열: **판정 프레임**은 공격 데이터 `active`(1부터). **발동·지속·회복**은 틱(그림 dur에서 계산). **프레임 번호에 묶인 값**은 공격 데이터에서 프레임 번호나 프레임 수에 기대는 칸(그림 프레임 수를 바꾸면 같이 고쳐야 한다). **점프 캔슬**은 맞힌 뒤 점프로 끊기(`jumpCancel`, 차지는 단계별). 숫자 수치는 각 캐릭터 파일 `moves`(없으면 `src/data/moves/base.ts`).


### 라이덴 (`src/data/characters/raiden.ts`)

| 기술 | 그림 (프레임 / 틱) | 판정 프레임 | 발동 · 지속 · 회복 (틱) | 판정이 나오는 곳 | 프레임 번호에 묶인 값 | 점프 캔슬 |
| --- | --- | --- | --- | --- | --- | --- |
| 1타 | `raiden/jab` (12 / 19) | 5, 6 | 4 · 3 · 12 | 관절 eF→hF 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) | active, advance | - |
| 2타 | `raiden/cross` (12 / 19) | 5, 6 | 4 · 3 · 12 | 관절 eB→hB 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) | active, advance | - |
| 3타 | `raiden/middle_kick` (13 / 26) | 5, 6 | 7 · 3 · 16 | 관절 kB→fB 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) | active, advance | - |
| 4타 | `raiden/superman_punch` (14 / 32) | 6, 7 | 11 · 3 · 18 | 관절 eB→hB 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) | active, advance | - |
| 띄우기 | `raiden/uppercut` (13 / 26) | 5, 6, 7 | 6 · 5 · 15 | 관절 eB→hB 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) | active, advance | O |
| 쓸기 | `raiden/leg_sweep` (13 / 25) | 5, 6, 7 | 6 · 4 · 15 | 관절 kB→fB 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) | active, advance | - |
| 대시 공격 | `raiden/flying_knee` (13 / 25) | 5, 6, 7 | 5 · 5 · 15 | 관절 hip→kF 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) | active, advance | - |
| 차지 | `raiden/charge` (14 / 36) | 10, 11 | 21 · 4 · 11 | 공격 데이터 상자 (차지 단계별 box) | active, advance, charge.windup/loopTo/from, levels.advance | ---- |
| 공중 1타 | `raiden/air_jab` (12 / 18) | 5, 6 | 5 · 3 · 10 | 관절 eF→hF 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) | active, advance | O |
| 공중 2타 | `raiden/air_cross` (12 / 18) | 5, 6 | 5 · 3 · 10 | 관절 eB→hB 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) | active, advance | O |
| 공중 3타 | `raiden/air_roundhouse` (13 / 25) | 5, 6, 7 | 5 · 5 · 15 | 관절 kB→fB 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) | active, advance | - |
| 내려찍기 | `raiden/axe_kick` (13 / 25) | 5, 6, 7 | 6 · 5 · 14 | 관절 kF→fF 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) | active, advance | - |
| 벽 박차기 | `raiden/wall_kick` (13 / 32) | 4, 5, 6, 7, 8, 9 | 6 · 16 · 10 | 관절 kF→fF 끝 1/3 + 4px + 번개 사거리 12px | active, dive | O |
| 스킬 1 | `raiden/zanhen` (13 / 26) | 6, 7 | 8 · 3 · 15 | 관절 kB→fB 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위) + 잔상 띠 닿으면 느려짐(zanTouch, sim/combat.ts, ZAN_* 상수) | active, step, blink | - |
| 스킬 2 | `raiden/hwagwasan` (13 / 27) | 5, 6, 7 | 7 · 4 · 16 | 공격 데이터 상자 (box) | active | - |
| 필살기 | `raiden/pacheon` (14 / 35) | 6, 7, 8 | 12 · 6 · 17 | 관절 eB→hB 끝 1/3 ∪ 공격 데이터 상자 (box = 번개 범위). 맞으면 연출(장면 길이 = 장면 동작의 dur 합) | active, advance | - |

### 백은우 (`src/data/characters/eunwoo.ts`)

| 기술 | 그림 (프레임 / 틱) | 판정 프레임 | 발동 · 지속 · 회복 (틱) | 판정이 나오는 곳 | 프레임 번호에 묶인 값 | 점프 캔슬 |
| --- | --- | --- | --- | --- | --- | --- |
| 1타 | `eunwoo/flick` (12 / 20) | 5, 6 | 4 · 5 · 11 | 연검 판정 선 (data/moves/lines.ts, 그림 리본에서 뽑은 프레임별 점 8개) | active, advance, line(프레임 키) | - |
| 2타 | `eunwoo/backhand` (12 / 22) | 5, 6 | 6 · 5 · 11 | 연검 판정 선 (data/moves/lines.ts, 그림 리본에서 뽑은 프레임별 점 8개) | active, advance, line(프레임 키) | - |
| 3타 | `eunwoo/spin` (12 / 22) | 5, 6 | 7 · 5 · 10 | 연검 판정 선 (data/moves/lines.ts, 그림 리본에서 뽑은 프레임별 점 8개) | active, advance, line(프레임 키) | - |
| 4타 | `eunwoo/lash` (13 / 30) | 6, 7 | 9 · 4 · 17 | 연검 판정 선 (data/moves/lines.ts, 그림 리본에서 뽑은 프레임별 점 8개) | active, advance, line(프레임 키) | - |
| 띄우기 | `eunwoo/rise` (12 / 21) | 5, 6 | 5 · 3 · 13 | 연검 판정 선 (data/moves/lines.ts, 그림 리본에서 뽑은 프레임별 점 8개) | active, advance, line(프레임 키) | O |
| 쓸기 | `eunwoo/low` (12 / 22) | 5, 6 | 5 · 3 · 14 | 연검 판정 선 (data/moves/lines.ts, 그림 리본에서 뽑은 프레임별 점 8개) | active, advance, line(프레임 키) | - |
| 대시 공격 | `eunwoo/thrust` (12 / 24) | 4, 5 | 6 · 4 · 14 | 연검 판정 선 (data/moves/lines.ts, 그림 리본에서 뽑은 프레임별 점 8개) | active, advance, line(프레임 키) | - |
| 차지 | `eunwoo/batto` (14 / 36) | 10, 11 | 22 · 4 · 10 | 연검 판정 선 (data/moves/lines.ts, 그림 리본에서 뽑은 프레임별 점 8개) | active, advance, charge.windup/loopTo/from, line(프레임 키) | OOO |
| 공중 1타 | `eunwoo/air_flick` (12 / 20) | 4, 5 | 4 · 3 · 13 | 연검 판정 선 (data/moves/lines.ts, 그림 리본에서 뽑은 프레임별 점 8개) | active, advance, line(프레임 키) | O |
| 공중 2타 | `eunwoo/air_rise` (12 / 20) | 4, 5 | 4 · 3 · 13 | 연검 판정 선 (data/moves/lines.ts, 그림 리본에서 뽑은 프레임별 점 8개) | active, advance, line(프레임 키) | O |
| 공중 3타 | `eunwoo/air_spin` (12 / 21) | 5, 6 | 5 · 4 · 12 | 관절 eF→hF 끝 1/3 ∪ 공격 데이터 상자 (box = 궤적) | active, advance | - |
| 내려찍기 | `eunwoo/wire` (13 / 25) | 6, 7, 8 | 7 · 6 · 12 | 관절 eB→hB 끝 1/3 ∪ 공격 데이터 상자 (box = 궤적) | active, advance | - |
| 벽 박차기 | `eunwoo/wall_kick` (13 / 32) | 4, 5, 6, 7, 8, 9 | 6 · 16 · 10 | 연검 판정 선 (data/moves/lines.ts, 그림 리본에서 뽑은 프레임별 점 8개) | active, dive, line(프레임 키) | O |
| 스킬 1 | `eunwoo/answer` (12 / 21) | — | — | 판정 없음 | active | - |
| 스킬 2 | `eunwoo/still_here` (12 / 28) | — | — | 판정 없음 | active | - |
| 필살기 | `eunwoo/goodwill` (13 / 33) | 9, 10, 11 | 20 · 9 · 4 | 공격 데이터 상자 (box). 맞으면 연출(장면 길이 = 장면 동작의 dur 합) | active, advance | - |

### 에드워드 (`src/data/characters/edward.ts`)

| 기술 | 그림 (프레임 / 틱) | 판정 프레임 | 발동 · 지속 · 회복 (틱) | 판정이 나오는 곳 | 프레임 번호에 묶인 값 | 점프 캔슬 |
| --- | --- | --- | --- | --- | --- | --- |
| 1타 | `edward/chop` (14 / 43) | 6, 7 | 16 · 4 · 23 | 공격 데이터 상자 (box) | active, advance | - |
| 2타 | `edward/swing` (14 / 43) | 6, 7 | 16 · 4 · 23 | 공격 데이터 상자 (box) | active, advance, step | - |
| 3타 | `edward/rise` (14 / 44) | 6, 7 | 17 · 4 · 23 | 공격 데이터 상자 (box) | active, advance, step | - |
| 4타 | `edward/smash` (14 / 48) | 6, 7 | 19 · 4 · 25 | 공격 데이터 상자 (box) | active, advance, step | - |
| 띄우기 | `edward/scoop` (13 / 36) | 5, 6 | 11 · 4 · 21 | 공격 데이터 상자 (box) | active, advance, step | O |
| 쓸기 | `edward/sweep` (13 / 36) | 5, 6 | 11 · 4 · 21 | 공격 데이터 상자 (box) | active, advance, step | - |
| 대시 공격 | `edward/rush` (13 / 33) | 6, 7 | 11 · 4 · 18 | 공격 데이터 상자 (box) | active, advance | - |
| 차지 | `edward/charge` (14 / 62) | 10, 11 | 30 · 4 · 28 | 공격 데이터 상자 (box) + 바닥 파도 상자(SLAB_* 상수, 단계별 길이, sim/chars/edward.ts) | active, advance, charge.windup/loopTo/from | OOO |
| 공중 1타 | `edward/air_chop` (14 / 34) | 6, 7 | 14 · 4 · 16 | 공격 데이터 상자 (box) | active, advance | O |
| 공중 2타 | `edward/air_swing` (14 / 34) | 6, 7 | 14 · 4 · 16 | 공격 데이터 상자 (box) | active, advance | O |
| 공중 3타 | `edward/air_spin` (14 / 42) | 6, 7 | 16 · 4 · 22 | 공격 데이터 상자 (box) | active, advance | - |
| 내려찍기 | `edward/air_slam` (14 / 44) | 5, 6 | 15 · 5 · 24 | 공격 데이터 상자 (box) + 착지 충격파 상자(반지름 SLAM_RADIUS, sim/chars/edward.ts tick) | active, advance | - |
| 벽 박차기 | `edward/wall_kick` (13 / 33) | 4, 5, 6, 7, 8, 9 | 7 · 16 · 10 | 공격 데이터 상자 (box) | active, dive | O |
| 스킬 1 | `edward/reenact` (13 / 34) | — | — | 판정 없음 | active | - |
| 스킬 2 | `edward/telekinesis` (14 / 48) | 4, 5 | 10 · 4 · 34 | 공격 데이터 상자 (box) + 붙잡아 끌기(TK_* 상수, sim/chars/edward.ts tkCarry). 밀어내기 그림 edward/tk_push | active | - |
| 필살기 | `edward/super` (14 / 37) | 6, 7 | 10 · 6 · 21 | 공격 데이터 상자 (box). 맞으면 연출(장면 길이 = 장면 동작의 dur 합) | active, advance | - |

### 오스카 (`src/data/characters/oscar.ts`)

| 기술 | 그림 (프레임 / 틱) | 판정 프레임 | 발동 · 지속 · 회복 (틱) | 판정이 나오는 곳 | 프레임 번호에 묶인 값 | 점프 캔슬 |
| --- | --- | --- | --- | --- | --- | --- |
| 1타 | `oscar/atk1` (13 / 26) | 4, 5, 6 | 4 · 5 · 17 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, advance | - |
| 2타 | `oscar/atk2` (13 / 26) | 4, 5, 6 | 4 · 5 · 17 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, advance | - |
| 3타 | `oscar/atk3` (13 / 26) | 4, 5, 6 | 4 · 5 · 17 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, advance | - |
| 4타 | `oscar/atk4` (14 / 30) | 7, 8, 9 | 10 · 5 · 15 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, advance | - |
| 띄우기 | `oscar/launcher` (13 / 27) | 4, 5, 6 | 5 · 5 · 17 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, advance | O |
| 쓸기 | `oscar/sweep` (13 / 27) | 4, 5, 6 | 5 · 5 · 17 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, advance | - |
| 대시 공격 | `oscar/dash_attack` (13 / 26) | 4, 5, 6 | 4 · 5 · 17 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, advance | - |
| 차지 | `oscar/charge` (14 / 39) | 11, 12, 13 | 28 · 8 · 3 | 오스카 베기 선 다발 (slashes.ts BLOOMS·BLOOM_CUTS, 단계 수만큼 꽃) — 첫 판정 프레임 시작 틱, LATE 3틱 뒤 맞음 | active, charge.windup/loopTo/from | OO- |
| 공중 1타 | `oscar/air1` (12 / 20) | 3, 4, 5 | 2 · 4 · 14 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, advance | O |
| 공중 2타 | `oscar/air2` (12 / 20) | 3, 4, 5 | 2 · 4 · 14 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, advance | O |
| 공중 3타 | `oscar/air3` (12 / 20) | 3, 4, 5 | 2 · 4 · 14 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, advance | - |
| 내려찍기 | `oscar/slam` (13 / 26) | 4, 5, 6 | 4 · 5 · 17 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, advance | - |
| 벽 박차기 | `oscar/wall_kick` (13 / 32) | 4, 5, 6, 7, 8, 9 | 6 · 16 · 10 | 오스카 베기 선 (slashes.ts OSCAR_CUTS, 두께 6px) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active, dive | O |
| 스킬 1 | `oscar/skill1` (14 / 34) | 8, 9, 10 | 18 · 6 · 10 | 오스카 베기 선 한 줄 (slashes.ts SKILL1_CUT, 표식 자리) — 첫 판정 프레임 시작 틱에 생기고 LATE 3틱 뒤 맞음 | active | - |
| 스킬 2 | `oscar/skill2` (14 / 24) | 7 | 9 · 1 · 14 | 판정 없음 (selfHit라 공통 판정을 끄고, 베지도 않는다). SKILL2_WARP 9틱에 검영으로 순간이동 | active | - |
| 필살기 | `oscar/super` (14 / 48) | 8, 9 | 24 · 4 · 20 | 화면 전체: 첫 판정 프레임 시작 틱에 상대가 SUPER_REACH 240px 안이면 피격 상자 그대로 맞음 (sim/chars/oscar.ts). 맞으면 연출(장면 길이 = 장면 동작의 dur 합) | active | - |

### 기본 스틱맨 (`src/data/moves/base.ts`)

| 기술 | 그림 (프레임 / 틱) | 판정 프레임 | 발동 · 지속 · 회복 (틱) | 판정이 나오는 곳 | 프레임 번호에 묶인 값 | 점프 캔슬 |
| --- | --- | --- | --- | --- | --- | --- |
| 1타 | `base/atk1` (12 / 15) | 5, 6 | 4 · 4 · 7 | 관절 eF→hF 끝 1/3 + 4px | active | - |
| 2타 | `base/atk2` (12 / 15) | 5, 6 | 4 · 4 · 7 | 관절 eB→hB 끝 1/3 + 4px | active, step | - |
| 3타 | `base/atk3` (13 / 15) | 6, 7 | 5 · 4 · 6 | 관절 kF→fF 끝 1/3 + 4px | active, step | - |
| 4타 | `base/atk4` (14 / 20) | 7, 8 | 8 · 3 · 9 | 관절 eF→hF 끝 1/3 + 4px | active, step | - |
| 띄우기 | `base/launcher` (13 / 20) | 5, 6, 7 | 4 · 6 · 10 | 관절 eF→hF 끝 1/3 + 4px | active, step | O |
| 쓸기 | `base/sweep` (14 / 21) | 5, 6, 7 | 4 · 5 · 12 | 관절 kF→fF 끝 1/3 + 4px | active, step | - |
| 대시 공격 | `base/dash_attack` (13 / 23) | 6, 7 | 5 · 4 · 14 | 관절 eF→hF 끝 1/3 + 4px | active, step | - |
| 차지 | `base/charge` (14 / 38) | 11, 12 | 23 · 4 · 11 | 관절 eF→hF 끝 1/3 + 4px | active, step, charge.windup/loopTo/from | OO- |
| 공중 1타 | `base/air1` (12 / 14) | 4, 5 | 3 · 4 · 7 | 관절 eF→hF 끝 1/3 + 4px | active | O |
| 공중 2타 | `base/air2` (12 / 14) | 4, 5 | 3 · 4 · 7 | 관절 kF→fF 끝 1/3 + 4px | active | O |
| 공중 3타 | `base/air3` (13 / 19) | 5, 6 | 4 · 4 · 11 | 관절 kF→fF 끝 1/3 + 4px | active | - |
| 내려찍기 | `base/slam` (14 / 20) | 6, 7, 8 | 5 · 6 · 9 | 관절 eF→hF 끝 1/3 + 4px | active | - |
| 벽 박차기 | `base/wall_kick` (13 / 32) | 4, 5, 6, 7, 8, 9 | 6 · 16 · 10 | 관절 kF→fF 끝 1/3 + 4px | active, dive | O |
| 스킬 1 | `base/skill1` (14 / 17) | 5, 6, 7, 8, 9 | 4 · 5 · 8 | 관절 eF→hF 끝 1/3 + 4px | active, step | - |
| 스킬 2 | `base/skill2` (13 / 19) | 6, 7 | 6 · 3 · 10 | 몸 둘레 (피격 상자 + 여유) | active | - |
| 필살기 | `base/super` (14 / 25) | 7, 8, 9 | 8 · 5 · 12 | 관절 eF→hF 끝 1/3 + 4px. 맞으면 연출(장면 길이 = 장면 동작의 dur 합) | active, step | - |

판정이 없는 스킬: 백은우 스킬 1 응답(ANSWER_TELE_TICK 5틱에 순간이동, `data/poses/eunwoo/skill.ts`)·스킬 2 아직 여기 있어(버프), 에드워드 스킬 1 재현:나(버프), 오스카 스킬 2(위 표).

## 3. 시간·캔슬이 적힌 곳

**시간** — `src/sim/frames.ts` buildMove: `activeStart = cum[active[0]−1]`, `activeEnd = cum[active.at(−1)]`, `total = dur 합`. 몸 이동 `advance`는 프레임마다 px이고 그 프레임 dur 동안 고르게 나눈다(advanceTicks). `step`·`dive`·`blink`·차지 `windup/loopTo/from`도 프레임 번호다.

**캔슬** — 기술마다 따로 적힌 구간은 없고 공통 규칙만 있다(`src/sim/fighter.ts`).

| 캔슬 | 언제 | 어디 |
| --- | --- | --- |
| 연타(다음 타) | activeStart부터 누르면 예약, activeEnd에 넘어감 | fighter.ts attackControl (431·446행) |
| 점프 캔슬 | 맞히면(히트스톱 뒤) 언제든, `jumpCancel`인 기술만 | fighter.ts 417행 |
| 스킬·필살기 캔슬 | 맞히거나 막히면 언제든 | fighter.ts attackControl (trySkills) |
| 길게 눌러 차지로 | 평타의 activeEnd부터 | fighter.ts tryCharge (464행) |
| CPU가 보는 "판정 끝" | activeEnd | sim/cpu.ts 55행 |

**프레임 번호에 묶인 sim 상수** (그림 프레임 수를 바꾸면 같이 봐야 한다. 값은 0부터 센 프레임 번호, 시트 번호는 +1)

| 상수 | 값 | 뜻 | 곳 |
| --- | --- | --- | --- |
| SLAM_DROP · SLAM_FALL_HOLD · SLAM_LAND | 4 · 5 · 6 | 에드워드 내려찍기: 이 프레임부터 떨어짐 / 떨어지는 동안 머무는 프레임 / 착지하면 이어지는 프레임(충격파 판정 시점) | sim/chars/edward.ts 118~120 |
| SLAB_FRAME | 11 | 에드워드 차지: 바닥 파도가 시작하는 프레임(판정 시작) | edward.ts 113 |
| TK_PULL_FRAME · TK_DROP_FRAME | 5 · 10 | 에드워드 염동력: 끌어오기 시작·놓는 프레임 | edward.ts 99~100 |
| (식) activeStart + 1 | — | 에드워드 4타: 주변 물건 부수는 틱 | edward.ts 322 |
| (식) active[0] | — | 에드워드 공중 평타: 첫 판정 프레임 전까지 공중에 버팀 | edward.ts 302 |
| HIT_AIR_LOOP_FROM | 9 | 공중에서 맞음: 이 프레임부터 끝까지 되풀이 | data/poses/common.ts 171 |
| HIT_STRETCH | 약 4 · 강 5 · 크러시 6 | 맞는 동작: 경직 길이에 맞춰 이 프레임 dur만 늘림 | common.ts 264 |
| KNOCKDOWN_RELAND | 5 | 다운: 다시 땅에 닿는 프레임(렌더 먼지) | common.ts 201 |
| GETUP_INVULN · TECH_INVULN | 20 · 12틱 | 사양서 "기상 1~10번·낙법 1~8번 무적"을 틱으로 적음 (simtest가 cum과 같은지 확인) | sim/rules.ts |
| WALL_CLING_LOOP_FROM · WALL_RUN_TOP_FROM | 4 · 10 | 벽 붙기 되풀이 시작, 벽 달리기 꼭대기 넘어가기 시작 | data/poses/wall.ts 44·110 |
| ANSWER_TELE_TICK | 5틱 | 백은우 응답 순간이동 (주석: "3프레임 시작 틱" — 지금 그림의 프레임 경계와 맞춰 둔 틱) | data/poses/eunwoo/skill.ts 40 |
| SKILL2_WARP · LATE | 9틱 · 3틱 | 오스카 스킬 2 순간이동, 베기 선 늦은 타격 | sim/chars/oscar.ts |

## 4. 12~14 때문에 프레임을 억지로 맞춘 흔적

애니메이션 재수정 지침 0장의 "12~14에 눌림" 신호는 이 장의 A~D와 같은 기준이다(`npm run motioncheck`). E(복사한 자세)는 '복사로 길이 채움' 신호로 따로 센다. 220개 동작 모두 12~14프레임이다.

### A. 잘린 동작 — 동작연출지침서 3장 참고값보다 프레임이 적음 (34개)

큰 휘두르기 16~24, 차지·스킬 16~30인데 12~14에 넣었다. **굵게**는 거의 모든 프레임이 키(사이 프레임이 없음 — 14장 안에 자세를 욱여넣은 흔적).

`base/skill1`(14, 16~30), `base/skill2`(13, 16~30), `base/super`(14, 16~30), `base/charge`(14, 16~30), `raiden/charge`(14, 16~30), **`raiden/zanhen`**(13, 16~30) 보호, **`raiden/hwagwasan`**(13, 16~30), **`raiden/pacheon`**(14, 16~30), **`eunwoo/spin`**(12, 16~24), `eunwoo/air_spin`(12, 16~24) 보호, `eunwoo/answer`(12, 16~30), `eunwoo/still_here`(12, 16~30), `eunwoo/batto`(14, 16~30), `eunwoo/goodwill`(13, 16~30), **`edward/chop`**(14, 16~24), **`edward/swing`**(14, 16~24), **`edward/rise`**(14, 16~24), **`edward/smash`**(14, 16~24), `edward/scoop`(13, 16~24), **`edward/sweep`**(13, 16~24), `edward/rush`(13, 16~24), **`edward/air_chop`**(14, 16~24), **`edward/air_swing`**(14, 16~24), **`edward/air_spin`**(14, 16~24), **`edward/air_slam`**(14, 16~24), `edward/reenact`(13, 16~30), `edward/telekinesis`(14, 16~30), `edward/tk_push`(14, 16~30), **`edward/charge`**(14, 16~30), `edward/super`(14, 16~30) 보호, `oscar/skill1`(14, 16~30), `oscar/skill2`(14, 16~30), **`oscar/charge`**(14, 16~30), `oscar/super`(14, 16~30)

### B. 늘린 동작 — 참고값보다 프레임이 많음 (14개)

빠른 타격(잽, 오스카 검격 생성)은 6~10인데 12~13을 썼다: `raiden/jab`, `raiden/cross`, `raiden/air_jab`(보호), `raiden/air_cross`(보호), `oscar/atk1`, `oscar/atk2`, `oscar/atk3`, `oscar/launcher`, `oscar/sweep`, `oscar/dash_attack`, `oscar/air1`, `oscar/air2`, `oscar/air3`, `oscar/slam`

### C. 키가 적어 사이 프레임으로 채운 동작 — 키 하나에 평균 4프레임 이상 (24개)

`base/idle`(키 2개 → 12프레임), `base/fall`(키 3개 → 12프레임), `base/guard`(키 3개 → 12프레임), `base/guard_hit`(키 3개 → 12프레임), `raiden/guard`(키 3개 → 12프레임), `raiden/pacheon_press`(키 2개 → 12프레임), `raiden/pacheon_react1`(키 2개 → 12프레임), `raiden/pacheon_react5`(키 3개 → 12프레임), `eunwoo/super_deploy`(키 2개 → 12프레임), `eunwoo/super_deploy_s`(키 2개 → 12프레임), `eunwoo/super_world`(키 2개 → 13프레임), `eunwoo/super_heal`(키 3개 → 12프레임), `eunwoo/super_release`(키 3개 → 13프레임), `eunwoo/super_daze`(키 2개 → 12프레임), `eunwoo/super_rest`(키 3개 → 13프레임), `edward/guard`(키 3개 → 12프레임), `oscar/guard`(키 3개 → 12프레임), `oscar/super_orbit`(키 3개 → 14프레임), `oscar/super_cut`(키 3개 → 13프레임), `react/oscar_orbit`(키 3개 → 14프레임), `react/oscar_open_s`(키 3개 → 14프레임), `react/oscar_still`(키 2개 → 12프레임), `react/oscar_cut`(키 2개 → 13프레임), `react/oscar_fall`(키 3개 → 13프레임)

### D. 1틱짜리 프레임으로 12장을 채운 동작 — 반복이 아닌데 모든 프레임이 1틱 (24개)

`base/land`(12프레임 = 12틱), `base/dash`(12프레임 = 12틱), `base/air_dash`(12프레임 = 12틱), `base/guard`(12프레임 = 12틱), `base/guard_hit`(12프레임 = 12틱), `raiden/land`(12프레임 = 12틱), `raiden/dash`(12프레임 = 12틱), `raiden/air_dash`(12프레임 = 12틱), `raiden/guard`(12프레임 = 12틱), `raiden/guard_hit`(12프레임 = 12틱), `eunwoo/land`(12프레임 = 12틱), `eunwoo/dash`(12프레임 = 12틱), `eunwoo/air_dash`(12프레임 = 12틱), `eunwoo/guard`(12프레임 = 12틱), `eunwoo/guard_hit`(12프레임 = 12틱), `edward/land`(12프레임 = 12틱), `edward/air_dash`(12프레임 = 12틱), `edward/guard`(12프레임 = 12틱), `edward/guard_hit`(12프레임 = 12틱), `oscar/land`(12프레임 = 12틱), `oscar/dash`(12프레임 = 12틱) 보호, `oscar/air_dash`(12프레임 = 12틱), `oscar/guard`(12프레임 = 12틱), `oscar/guard_hit`(12프레임 = 12틱)

### E. 복사한 자세 — 앞 프레임과 모든 관절 차이 1px 이하 (stop 키·양 끝 키 제외, 82개)

프레임 쌍은 `docs/motions/점검표.md`의 '복사로 길이 채움' 칸. 묶음별: 라이덴 19, 백은우 5, 에드워드 15, 오스카 25, 공통·기본·상대 반응 18. 복사 쌍이 6개 이상인 것(거의 멈춘 자세를 늘어놓음): `base/idle`, `common/knockdown`, `base/guard`, `base/guard_hit`, `raiden/guard`, `raiden/pacheon_press`, `raiden/pacheon_react1`, `raiden/pacheon_surge`, `raiden/pacheon_fly`, `raiden/pacheon_react5`, `eunwoo/super_deploy`, `eunwoo/super_deploy_s`, `eunwoo/super_daze`, `eunwoo/super_rest`, `edward/guard`, `edward/super_absorb`(보호), `oscar/guard`, `oscar/super_orbit`, `oscar/super_open_s`, `oscar/super_cut`, `react/oscar_open`, `react/oscar_orbit`, `react/oscar_still`, `react/oscar_cut`, `react/oscar_fall`

### F. 코드에 남은 흔적

- **오스카 공중 평타 3개**: 발도 함수 `iai()`가 `dur.length === 12`로 공중판을 알아내 "손을 얹는 멈칫" 키 하나를 뺐다(12프레임에 맞추려고). 이번에 `air` 인자로 떼어 냈다(그림은 같다). `src/data/poses/oscar/attack.ts`
- **오스카 걷기**: 14프레임에 맞춘 생성 반복(`i <= 14`, 7프레임째에 발을 바꿈). `src/data/poses/oscar/move.ts` 47행 (보호 동작)
- **공통 맞는 동작**: 프레임 수를 고정하고 HIT_STRETCH 프레임의 dur만 늘려 경직 길이를 맞춘다. `docs/공통동작사양서.md` 21행에 "12~14프레임 규칙을 지킨다"가 아직 있다(이번 PR에서는 고치지 않음 — 확인 필요).
- **임시 동작** `src/data/poses/temp.ts`(기본 스틱맨 평타 등): 시제품 포즈를 12~14에 맞춰 옮긴 것(주석만 고침).
- 동작 주석의 "14프레임 43틱" 같은 박자 설명(에드워드 평타 4개, 라이덴 등장)은 그때의 사실이라 그대로 두었다.

## 5. 이번에 없앤 12~14 강제

| 곳 | 전 | 지금 |
| --- | --- | --- |
| `src/anim/motion.ts` | `MIN_FRAMES = 12`, `MAX_FRAMES = 14`, 주석 "12~14" | 상수 없앰, 주석 "동작의 목적에 맞게" |
| `src/anim/sheet.ts` checkMotion | 12~14가 아니면 시트 출력 실패 | 프레임 1개 이상·dur 1 이상 정수·관절 수 = dur 수만 본다 |
| `tools/pages/selftest.ts` | 3프레임이면 실패해야 하는 가짜 동작 | 3·12·24프레임이 섞여 모두 통과, dur 0만 실패 |
| `tools/simtest.mjs` 공통 동작 시험 | "약하게 맞음은 12프레임", "1번부터 12(14)번까지" 숫자 | 길이(틱)만 보고, 끝 프레임은 그 동작의 프레임 수로 |
| `src/data/poses/oscar/attack.ts` | `dur.length === 12`로 공중판 판단 | `air` 인자 |
| `README.md` | "12~14프레임 규칙 검사" | 표시 틱 검사, selftest 설명 |
| `docs/게임기획서.md`(4곳)·`docs/캐릭터기획서.md`(1곳) | "12~14프레임" | "동작의 목적에 맞게 프레임 수를 정한다" |
