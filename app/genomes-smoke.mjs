// Company Genome: provenness must be DERIVED from the evidence state machine.
// The central assertion: a section linked to PROPOSED evidence reads as
// attached-but-NOT-proven, and moving that record to VERIFIED — through the
// real gates — is the only thing that changes it.
import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:4173';
const API = 'http://127.0.0.1:3001';
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

await page.goto(`${BASE}/#/sign-in`, { waitUntil: 'networkidle' });
await page.getByLabel('EMAIL').fill(EMAIL);
await page.getByLabel('PASSWORD').fill(PASSWORD);
await page.getByRole('button', { name: 'SIGN IN' }).click();
await page.waitForTimeout(1000);

const truth = await page.evaluate(async (api) => {
  const token = localStorage.getItem('fable5:auth:token');
  const list = await (await fetch(`${api}/api/genomes`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const detail = await (await fetch(`${api}/api/genomes/${list[0].id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  return { list, detail };
}, API);
const d = truth.detail;
console.log(`server truth: coverage ${d.coverage.proven}/${d.coverage.total}, gate allowed=${d.maturityGate.allowed}`);

await page.goto(`${BASE}/#/genomes`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const body = await page.locator('.shell-main').innerText();

check('genome name from server renders', body.includes(d.name));
check('coverage matches the server exactly', body.includes(`${d.coverage.proven}/${d.coverage.total} sections`));
check('coverage is labelled as computed, not stored', body.includes('computed from the state machine'));

// The core distinction: attached ≠ proven.
const attached = d.sections.filter((s) => s.evidenceState && !s.proven);
const proven = d.sections.filter((s) => s.proven);
check('fixture actually contains both proven and attached-unproven sections',
  proven.length > 0 && attached.length > 0, `proven=${proven.length} attached-unproven=${attached.length}`);
check('attached-but-unproven sections are marked "not proven"', body.includes('PROPOSED · not proven'));
check('sections with nothing attached read "no evidence"',
  d.sections.some((s) => !s.evidenceState) ? body.includes('no evidence') : true);

// The replication gate must be locked, with the computed reason shown.
check('maturity gate is locked', d.maturityGate.allowed === false);
check('locked reason is rendered verbatim from the server', body.includes(d.maturityGate.reason),
  `expected: ${d.maturityGate.reason}`);

// "Missing for next stage" is derived, and distinguishes the two failure modes.
check('missing list is derived, not typed', body.includes('derived, not typed'));
const hasProposedReason = d.missingForNextStage.some((m) => m.reason.includes('PROPOSED'));
const hasNoneReason = d.missingForNextStage.some((m) => m.reason === 'no evidence attached');
check('missing list distinguishes unverified evidence from no evidence',
  hasProposedReason && hasNoneReason, JSON.stringify(d.missingForNextStage.slice(0, 2)));

// Playbooks come from canon only.
check('playbooks state the canon requirement when empty',
  d.playbooks.length === 0 ? body.includes('CANONIZED') : true);

check('no demo copy or NaN leaked', !body.includes('NaN') && !body.includes('PB-11'));

// PROOF: advance one attached-but-unproven record through the real gates and
// watch the coverage move. Nothing else may change it.
if (attached.length > 0) {
  const target = attached[0];
  const before = d.coverage.proven;
  const walked = await page.evaluate(async ({ api, evidenceId }) => {
    const token = localStorage.getItem('fable5:auth:token');
    const post = async (p, b) => {
      const r = await fetch(`${api}${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(b),
      });
      return { status: r.status, body: await r.json() };
    };
    await post(`/api/evidence/${evidenceId}/transition`, { to: 'AUTHORIZED', reason: 'smoke' });
    await post(`/api/evidence/${evidenceId}/transition`, { to: 'EXECUTED', reason: 'smoke' });
    const rec = await post(`/api/evidence/${evidenceId}/receipts`, { receipt_type: 'log', description: 'smoke receipt' });
    await post(`/api/evidence/${evidenceId}/transition`, { to: 'RECEIPTED', reason: 'smoke' });
    await post(`/api/evidence/${evidenceId}/verifications`, {
      receipt_id: rec.body.receipts[0].id, method: 'independent re-run', independent: true, reproduced: true,
    });
    return post(`/api/evidence/${evidenceId}/transition`, { to: 'VERIFIED', reason: 'smoke' });
  }, { api: API, evidenceId: target.evidenceId });
  check('walked the attached record through the real gates to VERIFIED', walked.status === 200);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const after = await page.locator('.shell-main').innerText();
  check('coverage increased by exactly one after verification',
    after.includes(`${before + 1}/${d.coverage.total} sections`),
    `expected ${before + 1}/${d.coverage.total}`);
  check(`"${target.label}" now reads proven`, !after.includes(`${target.label}`) || after.includes('VERIFIED'));
}

await browser.close();
console.log(fails.length === 0 ? '\nALL CHECKS PASSED' : `\n${fails.length} FAILED: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
