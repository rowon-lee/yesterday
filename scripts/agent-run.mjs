// 무인 에이전트 실행 (GitHub Actions의 .github/workflows/agent-run.yml이 부른다. 안내: docs/tasks/에이전트실행.md).
// 지시문 파일을 읽어 Claude Agent SDK의 query()로 이 저장소에서 작업시키고,
// PR 제목·설명·비용을 .agent/에 남긴다. 커밋·푸시·PR은 워크플로가 한다.
//
//   node scripts/agent-run.mjs            실행 (ANTHROPIC_API_KEY 필요)
//   node scripts/agent-run.mjs --dry-run  API를 부르지 않고, 만들어질 지시문과 설정만 보여 준다
//
// 환경변수: TASK_FILE (기본 docs/tasks/next.md), NOTE (지난 결과에 대한 한 줄 피드백, 선택),
//           MODEL (기본 claude-opus-5-5), MAX_TURNS (기본 200), GITHUB_STEP_SUMMARY (Actions가 준다)
// 남기는 파일: .agent/title.txt (PR 제목 = 지시문 첫 줄), .agent/prompt.md (보낸 지시문),
//             .agent/pr-body.md (에이전트가 쓴다. 없으면 마지막 응답으로 채운다), .agent/cost.md (비용·토큰)
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const AGENT_DIR = resolve(ROOT, '.agent');
const dryRun = process.argv.includes('--dry-run');

const taskFile = process.env.TASK_FILE?.trim() || 'docs/tasks/next.md';
const note = process.env.NOTE?.trim() ?? '';
const model = process.env.MODEL?.trim() || 'claude-opus-5-5';
const maxTurns = Number.parseInt(process.env.MAX_TURNS ?? '', 10) || 200;

/** 무인 실행 규칙 (사용자 지시 그대로). 지시문 앞에 붙인다 */
const RULES = [
  '이 실행은 무인 실행이다. 질문하거나 확인을 기다릴 수 없다. CLAUDE.md의 \'계획부터 보여주기\'와 \'승인 대기\'는,',
  '계획·한 일·확인한 미리보기 PNG 경로·틱 표를 .agent/pr-body.md에 쓰는 것으로 대신한다.',
  '지시문이 하나씩 승인받으라고 하면 첫 번째 단위만 끝내고 멈춘다. 확인 도구(npm run sheets·shot·simtest)는 그대로 돌린다.',
].join('\n');
/** 워크플로가 맡는 일 (에이전트가 겹쳐 하지 않게) */
const WORKFLOW_DUTIES = '브랜치 만들기·커밋·푸시·PR 만들기는 이 실행이 끝난 뒤 워크플로가 한다. git commit·git push·gh는 쓰지 말고 파일만 고친다.';

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

const taskPath = resolve(ROOT, taskFile);
if (!existsSync(taskPath)) fail(`지시문 파일이 없다: ${taskFile}`);
const task = readFileSync(taskPath, 'utf8').trim();
if (!task) fail(`지시문 파일이 비어 있다: ${taskFile}`);

/** PR 제목: 지시문 파일의 첫 줄 (마크다운 제목 기호 #는 뗀다) */
const firstLine = task.split('\n').find((line) => line.trim()) ?? taskFile;
const title = firstLine.replace(/^#+\s*/, '').trim().slice(0, 120) || taskFile;

/** 작업 브랜치·저장소 (워크플로가 준다): PR 설명의 미리보기 이미지 링크를 쓸 수 있게 */
const branch = process.env.AGENT_BRANCH?.trim() ?? '';
const repo = process.env.GITHUB_REPOSITORY?.trim() ?? '';
const LINKS = branch && repo
  ? `작업 브랜치는 ${branch}, 저장소는 ${repo}다. .agent/pr-body.md의 미리보기 이미지는 https://github.com/${repo}/blob/${branch}/<경로>?raw=true 로 건다.`
  : '';

const prompt = [
  RULES,
  WORKFLOW_DUTIES,
  ...(LINKS ? [LINKS] : []),
  '',
  '---',
  '',
  task,
  ...(note ? ['', '---', '', `지난 결과에 대한 피드백: ${note}`] : []),
].join('\n');

const options = {
  cwd: ROOT,
  model,
  maxTurns,
  systemPrompt: { type: 'preset', preset: 'claude_code' },
  // 'project'가 있어야 CLAUDE.md와 .claude/settings.json을 읽는다
  settingSources: ['project'],
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
};

if (dryRun) {
  console.log(`PR 제목: ${title}`);
  console.log(`설정: ${JSON.stringify({ ...options, cwd: '<저장소 루트>' })}`);
  console.log('---- 보낼 지시문 ----');
  console.log(prompt);
  process.exit(0);
}

mkdirSync(AGENT_DIR, { recursive: true });
writeFileSync(resolve(AGENT_DIR, 'title.txt'), `${title}\n`);
writeFileSync(resolve(AGENT_DIR, 'prompt.md'), `${prompt}\n`);

const { query } = await import('@anthropic-ai/claude-agent-sdk');

const started = Date.now();
/** 마지막 결과 메시지 (비용·토큰은 누적값이라 마지막 것을 읽는다) */
let result = null;
let crash = null;
try {
  for await (const message of query({ prompt, options })) {
    if (message.type === 'result') {
      result = message;
    } else if (message.type === 'assistant' && message.parent_tool_use_id === null) {
      // Actions 로그에 진행 상황을 짧게 남긴다
      for (const block of message.message.content) {
        if (block.type === 'text' && block.text.trim()) console.log(`[응답] ${block.text.trim().slice(0, 600)}`);
        else if (block.type === 'tool_use') console.log(`[도구] ${block.name} ${JSON.stringify(block.input).slice(0, 200)}`);
      }
    }
  }
} catch (error) {
  crash = error;
  console.error(`::error::에이전트 실행 중 오류: ${error instanceof Error ? error.message : String(error)}`);
}

// ---- 비용·토큰 정리 (작업 요약과 PR 설명 맨 아래에 붙는다) ----
const minutes = ((result?.duration_ms ?? Date.now() - started) / 60000).toFixed(1);
const usd = (n) => `$${(n ?? 0).toFixed(4)}`;
const lines = [
  '## 에이전트 실행 비용',
  '',
  `- 결과: ${result ? result.subtype : '결과 메시지 없음 (실행 오류)'} · 턴 ${result?.num_turns ?? 0} · ${minutes}분`,
  `- 모델 ${model} · 최대 턴 ${maxTurns} · 지시문 \`${taskFile}\`${note ? ` · 메모: ${note}` : ''}`,
  `- **total_cost_usd: ${usd(result?.total_cost_usd)}** (SDK가 계산한 추정값. 실제 차감은 콘솔 Billing에서 확인)`,
];
const models = Object.entries(result?.modelUsage ?? {});
if (models.length) {
  const sum = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 };
  lines.push('', '| 모델 | 입력 토큰 | 출력 토큰 | 캐시 읽기 | 캐시 쓰기 | 비용 |', '| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const [name, u] of models) {
    for (const key of Object.keys(sum)) sum[key] += u[key] ?? 0;
    lines.push(`| ${name} | ${u.inputTokens} | ${u.outputTokens} | ${u.cacheReadInputTokens} | ${u.cacheCreationInputTokens} | ${usd(u.costUSD)} |`);
  }
  if (models.length > 1) lines.push(`| 합계 | ${sum.inputTokens} | ${sum.outputTokens} | ${sum.cacheReadInputTokens} | ${sum.cacheCreationInputTokens} | ${usd(sum.costUSD)} |`);
}
if (result?.subtype && result.subtype !== 'success') {
  lines.push('', `> 끝까지 마치지 못했다 (${result.subtype}).${result.errors?.length ? ` 오류: ${result.errors.slice(0, 3).join(' / ')}` : ''}`);
}
if (crash) lines.push('', `> 실행 오류: ${crash instanceof Error ? crash.message : String(crash)}`);
const costText = `${lines.join('\n')}\n`;
writeFileSync(resolve(AGENT_DIR, 'cost.md'), costText);

// 에이전트가 PR 설명을 쓰지 않았으면 마지막 응답으로 채운다
const bodyPath = resolve(AGENT_DIR, 'pr-body.md');
if (!existsSync(bodyPath) || !readFileSync(bodyPath, 'utf8').trim()) {
  const last = result && result.subtype === 'success' ? result.result : '(마지막 응답 없음)';
  writeFileSync(bodyPath, `# ${title}\n\n에이전트가 .agent/pr-body.md를 쓰지 않아 마지막 응답을 옮겼다.\n\n${last}\n`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `# ${title}\n\n${costText}\n`);
}
console.log(costText);

// 오류로 끝나면 실패로 표시한다 (워크플로는 그래도 바뀐 파일을 커밋해 남긴다). 최대 턴에 닿은 것은 실패로 보지 않는다
const failed = crash !== null || !result || (result.is_error && result.subtype !== 'error_max_turns');
process.exit(failed ? 1 : 0);
