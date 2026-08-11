// The status strip and GOD MODE must report the SAME company.
// Previously the strip rendered seeded demo numbers directly above GOD MODE's
// real ones; this asserts both now agree with the server's own payload.
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
  const res = await fetch(`${api}/api/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}, API);
const totalEvidence = truth.evidenceCounts.reduce((s, e) => s + e.count, 0);
console.log(
  `server truth: genomes=${truth.genomeCount} nodes=${truth.nodes.activeOrScaling}/${truth.nodes.total} ` +
  `pressure=${truth.resourcePressure ? Math.round(truth.resourcePressure.ratio * 100) + '% ' + truth.resourcePressure.resourceType : 'null'}`
);

await page.goto(`${BASE}/#/control`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const strip = await page.locator('.status-strip').innerText();
console.log('strip: ' + strip.replace(/\n/g, ' | '));

// Every strip metric must match the server.
check('strip: ranked opportunities matches', strip.includes(`${truth.opportunities.length} ranked opportunities`));
check('strip: evidence records matches', strip.includes(`${totalEvidence} evidence records`));
check('strip: genome count matches', strip.includes(`${truth.genomeCount} company genomes`));
check('strip: node counts match', strip.includes(`${truth.nodes.activeOrScaling}/${truth.nodes.total} nodes active/scaling`));
check(
  'strip: resource pressure matches the tightest pool',
  strip.includes(`${Math.round(truth.resourcePressure.ratio * 100)}%`) &&
    strip.includes(truth.resourcePressure.resourceType),
  `expected ${Math.round(truth.resourcePressure.ratio * 100)}% ${truth.resourcePressure.resourceType}`
);

// The old seeded values must be gone.
check('strip: no seeded demo values remain', !/\b4 active opportunities|2 company genomes|1\/4 nodes\b/.test(strip));
check('strip: chip no longer claims LIVE DEMO STATE', !(await page.locator('.topbar-status').innerText()).includes('DEMO'));

// The strip and GOD MODE must not disagree on the same screen.
const body = await page.locator('.shell-main').innerText();
const godEvidence = await page.locator('.snapshot-card', { hasText: 'EVIDENCE RECORDS' }).locator('.snapshot-num').innerText();
check(
  'strip and GOD MODE agree on evidence count',
  Number(godEvidence) === totalEvidence && strip.includes(`${totalEvidence} evidence records`),
  `god=${godEvidence} strip/server=${totalEvidence}`
);
check('no NaN or undefined rendered', !body.includes('NaN') && !strip.includes('NaN') && !strip.includes('undefined'));

// Genomes/nodes/pools are their own real endpoints too.
const lists = await page.evaluate(async (api) => {
  const token = localStorage.getItem('fable5:auth:token');
  const get = async (p) => (await fetch(`${api}${p}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  return {
    genomes: await get('/api/genomes'),
    nodes: await get('/api/market-nodes'),
    pools: await get('/api/resource-pools'),
  };
}, API);
check('GET /api/genomes returns real rows', Array.isArray(lists.genomes) && lists.genomes.length === truth.genomeCount);
check('GET /api/market-nodes returns real rows', Array.isArray(lists.nodes) && lists.nodes.length === truth.nodes.total);
check('GET /api/resource-pools computes pressure server-side', lists.pools.every((p) => typeof p.pressure === 'number'));

await browser.close();
console.log(fails.length === 0 ? '\nALL CHECKS PASSED' : `\n${fails.length} FAILED: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
