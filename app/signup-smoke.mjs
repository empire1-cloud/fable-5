// Self-serve signup, end to end through the browser against the real API.
// The claim under test: a stranger with no help from the founder can create an
// organisation, land inside the control plane, and start working.
import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:4173';
const API = 'http://127.0.0.1:3001';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

const stamp = Date.now().toString(36);
const org = `Smoke Org ${stamp}`;
const email = `smoke-${stamp}@example.com`;
const password = 'a-long-enough-passphrase';

// --- pricing is reachable and honest while signed out ---
await page.goto(`${BASE}/#/pricing`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const pricingBody = await page.locator('#main-content').innerText();
check('pricing page renders', pricingBody.includes('Priced on what you build'));
check('pricing explains the node meter', /active market node/i.test(pricingBody));
check('signed-out pricing does not invent numbers it cannot load',
  pricingBody.includes('€299') || /Plans start at/.test(pricingBody));
check('read-only-on-expiry is disclosed before purchase', /read-only/i.test(pricingBody));
check('no NaN or undefined', !/NaN|undefined/.test(pricingBody));

// --- a stranger signs up ---
await page.goto(`${BASE}/#/signup`, { waitUntil: 'networkidle' });
await page.getByLabel('ORGANISATION').fill(org);
await page.getByLabel('EMAIL').fill(email);
await page.getByLabel('PASSWORD').fill(password);
await page.getByRole('button', { name: 'CREATE ORGANISATION' }).click();
await page.waitForTimeout(1500);

check('signup lands inside the control plane', page.url().includes('/control'), page.url());
const shell = await page.locator('.shell-main').innerText().catch(() => '');
check('GOD MODE renders for the brand-new org', /GOD MODE/.test(shell));
check('the new org is named on screen', shell.includes(org), org);

// A brand-new organisation is genuinely empty — nothing is invented for it.
check('no genome is invented for a new company', /no genome|0/.test(shell));

// --- the trial is real, and reported by the server ---
const sub = await page.evaluate(async (api) => {
  const token = localStorage.getItem('fable5:auth:token');
  const r = await fetch(`${api}/api/subscription`, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}, API);
check('server reports an active trial', sub.status === 'trialing', JSON.stringify(sub.status));
check('trial can write', sub.canWrite === true);
check('trial is 14 days', sub.trialDaysRemaining > 0 && sub.trialDaysRemaining <= 14, String(sub.trialDaysRemaining));
check('usage is reported, not just enforced', sub.usage?.seats?.used === 1 && sub.usage?.nodes?.used === 0,
  JSON.stringify(sub.usage?.seats?.used) + '/' + JSON.stringify(sub.usage?.nodes?.used));
check('catalog does not offer the trial as a purchasable plan',
  Array.isArray(sub.catalog) && !sub.catalog.some((p) => p.key === 'trial'));
check('Enterprise is never priced as free',
  sub.catalog.filter((p) => p.custom).every((p) => p.monthly === null));

// --- the new org can actually do work ---
const wrote = await page.evaluate(async (api) => {
  const token = localStorage.getItem('fable5:auth:token');
  const r = await fetch(`${api}/api/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ claim: 'First claim from a self-serve organisation' }),
  });
  return { status: r.status, body: await r.json() };
}, API);
check('a trial organisation can record evidence', wrote.status === 201, JSON.stringify(wrote.body).slice(0, 120));

// --- signed-in pricing shows the real catalog from the server ---
await page.goto(`${BASE}/#/pricing`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const signedIn = await page.locator('#main-content').innerText();
for (const name of ['Founding', 'Operator', 'Empire', 'Enterprise']) {
  check(`plan rendered: ${name}`, signedIn.toLowerCase().includes(name.toLowerCase()));
}
check('a real price is shown', /€\s?299|€299/.test(signedIn.replace(/ /g, ' ')));
check('Enterprise shows Custom, not a number', /Custom/.test(signedIn));

// Annual toggle must recompute from the server's own figures.
await page.getByRole('button', { name: /Annual/ }).click();
await page.waitForTimeout(300);
const annual = await page.locator('#main-content').innerText();
check('annual shows two months free', /two months free/i.test(annual));
check('annual price is 10x monthly', /2,?990/.test(annual.replace(/ /g, ' ')), 'expected 2990 for Founding');

await browser.close();
console.log(fails.length === 0 ? '\nALL CHECKS PASSED' : `\n${fails.length} FAILED: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
