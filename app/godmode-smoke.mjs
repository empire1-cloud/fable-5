// GOD MODE verification: /control renders the REAL /api/dashboard payload,
// and seeing everything grants no power to skip a gate.
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
await page.waitForTimeout(900);

// Ground truth straight from the API, so the UI is compared against the server.
const truth = await page.evaluate(async (api) => {
  const token = localStorage.getItem('fable5:auth:token');
  const res = await fetch(`${api}/api/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}, API);
const totalEvidence = truth.evidenceCounts.reduce((s, e) => s + e.count, 0);
console.log(`server truth: evidence=${totalEvidence} escalations=${truth.openEscalations} opps=${truth.opportunities.length}`);

await page.goto(`${BASE}/#/control`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

check('GOD MODE title renders', await page.getByRole('heading', { name: /GOD MODE/ }).first().isVisible());
check('the doctrine line is present', await page.getByText(/You can see everything\. You still can't fake anything\./).first().isVisible());
check('tenant name from server is shown', await page.getByText(truth.tenant.name).first().isVisible());

// Numbers must match the server exactly.
const evidenceCard = await page.locator('.snapshot-card', { hasText: 'EVIDENCE RECORDS' }).locator('.snapshot-num').innerText();
check('evidence total matches server', Number(evidenceCard) === totalEvidence, `ui=${evidenceCard} server=${totalEvidence}`);
const escCard = await page.locator('.snapshot-card', { hasText: 'OPEN ESCALATIONS' }).locator('.snapshot-num').innerText();
check('escalation count matches server', Number(escCard) === truth.openEscalations, `ui=${escCard} server=${truth.openEscalations}`);
const oppCard = await page.locator('.snapshot-card', { hasText: 'RANKED OPPORTUNITIES' }).locator('.snapshot-num').innerText();
check('opportunity count matches server', Number(oppCard) === truth.opportunities.length, `ui=${oppCard} server=${truth.opportunities.length}`);

// All 8 evidence states and all 9 engines are always rendered.
check('all 8 evidence states rendered', (await page.locator('.godmode-stage').count()) === 8);
check('all 9 engines rendered', (await page.locator('.godmode-engine').count()) === 9);

// Ranking score arrives as a STRING from this endpoint — must not render NaN.
const bodyText = await page.locator('.page-stack').innerText();
check('no NaN rendered anywhere', !bodyText.includes('NaN'));
if (truth.opportunities.length > 0) {
  const expected = Number(truth.opportunities[0].ranking_score).toFixed(2);
  check('top opportunity score formatted from string', bodyText.includes(expected), `expected ${expected}`);
}

// No seeded demo values leaking in from the old systemSnapshot view.
check('old demo copy is gone', !bodyText.includes('Seeded records stay labeled as demo data'));

// THE KICKER: GOD MODE grants visibility, not permission. Attempt a skipped
// gate while holding this exact session — the server must still refuse.
const skip = await page.evaluate(async (api) => {
  const token = localStorage.getItem('fable5:auth:token');
  const mk = await fetch(`${api}/api/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ claim: `God mode skip attempt ${Date.now()}` }),
  });
  const rec = await mk.json();
  const jump = await fetch(`${api}/api/evidence/${rec.id}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: 'CANONIZED', reason: 'god mode should not permit this' }),
  });
  return { status: jump.status, body: await jump.json() };
}, API);
check('GOD MODE still cannot skip a gate (409)', skip.status === 409, JSON.stringify(skip.body));

await browser.close();
console.log(fails.length === 0 ? '\nALL CHECKS PASSED' : `\n${fails.length} FAILED: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
