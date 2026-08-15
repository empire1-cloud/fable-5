// Browser verification: /control/decisions and /control/escalations are
// wired to the REAL scale-v2 Postgres backend, not the old demo data files.
import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:4173';
const EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL;
const PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
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
await page.waitForTimeout(600);
check('login redirected off /sign-in', !page.url().includes('sign-in'));

// Create a WEAK opportunity via the real API directly (no UI form exists yet
// for opportunity creation) so we can drive a real gate refusal.
const weakTitle = `Smoke weak ${Date.now()}`;
const weak = await page.evaluate(async ({ title }) => {
  const token = localStorage.getItem('fable5:auth:token');
  const res = await fetch('http://127.0.0.1:3001/api/opportunities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, claim: title }),
  });
  return res.json();
}, { title: weakTitle });
check('weak opportunity created via real API', Boolean(weak.opportunityId), JSON.stringify(weak));

const refusal = await page.evaluate(async ({ id }) => {
  const token = localStorage.getItem('fable5:auth:token');
  const res = await fetch(`http://127.0.0.1:3001/api/opportunities/${id}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason: 'smoke test — should be refused' }),
  });
  return { status: res.status, body: await res.json() };
}, { id: weak.opportunityId });
check('weak opportunity authorize refused (409)', refusal.status === 409, JSON.stringify(refusal));

// Create a STRONG opportunity + receipt, then authorize for real.
const strongTitle = `Smoke strong ${Date.now()}`;
const strong = await page.evaluate(async ({ title }) => {
  const token = localStorage.getItem('fable5:auth:token');
  const res = await fetch('http://127.0.0.1:3001/api/opportunities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, claim: title, evidenceGrade: 'A', evidenceStrength: 90, demandSignal: 80, strategicFit: 80, executionReadiness: 80 }),
  });
  return res.json();
}, { title: strongTitle });

await page.evaluate(async ({ evidenceId }) => {
  const token = localStorage.getItem('fable5:auth:token');
  await fetch(`http://127.0.0.1:3001/api/evidence/${evidenceId}/receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ receipt_type: 'log', description: 'smoke test receipt' }),
  });
}, { evidenceId: strong.evidenceId });

const authorized = await page.evaluate(async ({ id }) => {
  const token = localStorage.getItem('fable5:auth:token');
  const res = await fetch(`http://127.0.0.1:3001/api/opportunities/${id}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason: 'smoke test — strong evidence' }),
  });
  return { status: res.status, body: await res.json() };
}, { id: strong.opportunityId });
check('strong opportunity authorized (200)', authorized.status === 200, JSON.stringify(authorized));

// --- Decisions page: must show the REAL authorized decision, no demo data ---
await page.goto(`${BASE}/#/control/decisions`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
check('Decisions page shows real strong-opportunity title', await page.getByText(strongTitle).first().isVisible());
check('Decisions page shows AUTHORIZED badge', await page.getByText('AUTHORIZED', { exact: true }).first().isVisible());
check('Decisions page does NOT show old demo question text', (await page.getByText('Authorize landing-page pre-sell test').count()) === 0);

// --- Escalations page: must show the REAL refusal, and support resolving it ---
await page.goto(`${BASE}/#/control/escalations`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
check('Escalations page shows real Engine 00 refusal reason', await page.getByText(/Engine 00 gate refused/).first().isVisible());
check('Escalations page does NOT show old demo BLOCKED copy', (await page.getByText('record blocked with no retained reason').count()) === 0);

await page.getByPlaceholder(/re-graded evidence/).first().fill('smoke test resolution — re-graded and receipted');
await page.getByRole('button', { name: 'RESOLVE' }).first().click();
await page.waitForTimeout(500);
check('escalation moved to RESOLVED after real resolve action', await page.getByText('RESOLVED', { exact: true }).first().isVisible());

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
check('resolution persists after reload (real DB, not local state)', await page.getByText('smoke test resolution').first().isVisible());

await browser.close();
console.log(fails.length === 0 ? '\nALL CHECKS PASSED' : `\n${fails.length} FAILED: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
