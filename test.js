// Cosmic Age — Playwright test suite
// Usage: node test.js   (BASE_URL env overrides the target, e.g. live Vercel URL)
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const BIRTH = '1990-06-15';

// Independent copies of the app's orbital-period constants (sidereal, Earth years)
const PERIODS = {
  moon: 27.3217 / 365.2425, mercury: 0.240846, venus: 0.615198, earth: 1,
  mars: 1.88082, jupiter: 11.8626, saturn: 29.4571, uranus: 84.0205,
  neptune: 164.8, pluto: 248.1,
};
const DAY_MS = 86400000;
const YEAR_MS = 365.2425 * DAY_MS;
const BEATS_PER_YEAR = 365.2425 * 24 * 60 * 80; // 80 bpm heartbeats per year

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✅ ' + msg); }
  else { fail++; console.log('  ❌ ' + msg); }
}
function relErr(a, b) { return Math.abs(a - b) / Math.abs(b); }

// --- Reference implementations, recomputed independently in Node ---
const now = () => new Date();
function daysInMonth(m, y) { return new Date(y, m + 1, 0).getDate(); }
function refYmd(birth, n) {
  let y = n.getFullYear() - birth.getFullYear();
  let m = n.getMonth() - birth.getMonth();
  let d = n.getDate() - birth.getDate();
  if (d < 0) { m -= 1; d += daysInMonth(n.getMonth() === 0 ? 11 : n.getMonth() - 1, n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear()); }
  if (m < 0) { y -= 1; m += 12; }
  return { y, m, d };
}
function refNextBirthday(birth, n) {
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const bd = new Date(n.getFullYear(), birth.getMonth(), birth.getDate());
  if (bd.getTime() < today.getTime()) bd.setFullYear(bd.getFullYear() + 1);
  return Math.round((bd.getTime() - today.getTime()) / DAY_MS);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  console.log('== Cosmic Age: initial state ==');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  ok(await page.title() === 'Cosmic Age — Your Age Across the Solar System', `title correct (${await page.title()})`);
  await page.waitForSelector('#emptyState', { state: 'visible', timeout: 5000 });
  ok(await page.locator('#emptyState').isVisible(), 'empty state shown before any date');
  ok(await page.locator('#results').isHidden(), 'results hidden before any date');

  console.log('== Error handling ==');
  await page.click('#calcBtn');
  const err1 = await page.textContent('#err');
  ok(err1.includes('Please pick a birth date'), `empty-date error shown ("${err1}")`);
  await page.evaluate(() => window.__app.setBirth('2099-01-01'));
  const err2 = await page.textContent('#err');
  ok(err2.includes('future'), `future-date error shown ("${err2}")`);
  let st = await page.evaluate(() => window.__app.getState());
  ok(st.hasResult === false, 'no result computed for future date');

  console.log('== Compute via UI (fill + click) ==');
  await page.fill('#birthInput', BIRTH);
  await page.click('#calcBtn');
  await page.waitForSelector('#card-earth', { state: 'visible', timeout: 5000 });
  ok(await page.locator('#results').isVisible(), 'results visible after calculating');
  ok(await page.locator('#emptyState').isHidden(), 'empty state hidden after calculating');

  console.log('== State cross-checks (independent recomputation) ==');
  st = await page.evaluate(() => window.__app.getState());
  const n = now();
  const birth = new Date(BIRTH + 'T00:00:00');
  const expectedEarth = (n.getTime() - birth.getTime()) / YEAR_MS;
  ok(relErr(st.earthYears, expectedEarth) < 1e-4, `earthYears ≈ ${expectedEarth.toFixed(4)} (got ${st.earthYears.toFixed(4)})`);
  ok(st.earthYears > 35 && st.earthYears < 37, `earthYears in sane range (${st.earthYears.toFixed(3)})`);

  const refY = refYmd(birth, n);
  ok(st.ymd.y === refY.y && st.ymd.m === refY.m && st.ymd.d === refY.d,
     `ymd matches recomputed ${refY.y}y ${refY.m}m ${refY.d}d (got ${st.ymd.y}y ${st.ymd.m}m ${st.ymd.d}d)`);

  const refBday = refNextBirthday(birth, n);
  ok(Math.abs(st.nextBirthdayDays - refBday) <= 1, `next birthday ${refBday}d ±1 (got ${st.nextBirthdayDays})`);

  const refBeats = expectedEarth * BEATS_PER_YEAR;
  ok(relErr(st.heartbeats, refBeats) < 1e-4, `heartbeats ≈ ${Math.round(refBeats).toLocaleString()} (got ${Math.round(st.heartbeats).toLocaleString()})`);

  for (const [id, period] of Object.entries(PERIODS)) {
    const exp = expectedEarth / period;
    const got = st.ages[id];
    ok(relErr(got, exp) < 1e-4, `${id} age ≈ ${exp.toFixed(4)} Earth years (got ${got.toFixed(4)})`);
  }

  console.log('== DOM rendering ==');
  const mercuryText = await page.textContent('#age-mercury');
  const mercuryVal = parseFloat(mercuryText);
  ok(Math.abs(mercuryVal - expectedEarth / PERIODS.mercury) < 0.5, `Mercury card renders ~${expectedEarth / PERIODS.mercury} yrs (got "${mercuryText}")`);
  const plutoText = await page.textContent('#age-pluto');
  ok(parseFloat(plutoText) > 0.1 && parseFloat(plutoText) < 0.2, `Pluto card shows sub-1-year age (${plutoText})`);
  ok((await page.textContent('#card-mercury .caption')).includes('88 Earth days'), 'Mercury caption shows orbital period');
  ok((await page.textContent('#card-earth')).includes('you are here'), 'Earth card shows "you are here" badge');
  ok((await page.textContent('#earthCard .value')) === '36y 2m 3d', `Earth stat value is exactly 36y 2m 3d (got "${await page.textContent('#earthCard .value')}")`);
  ok((await page.textContent('#earthCard')).includes('Earth age'), 'Earth stat has "Earth age" label');
  const earthCardCount = await page.locator('#card-earth').count();
  ok(earthCardCount === 1, 'exactly one Earth card');
  const cardCount = await page.locator('.card').count();
  ok(cardCount === 10, `10 celestial body cards (got ${cardCount})`);

  const funFact = await page.textContent('#funFact');
  ok(funFact.includes('Jupiter years') && funFact.includes('Mercury years'), 'fun fact rendered');

  console.log('== Screenshot (results view) ==');
  await page.screenshot({ path: '/tmp/daily-app/screenshot.png', fullPage: true });
  ok(true, 'screenshot saved to /tmp/daily-app/screenshot.png');

  console.log('== localStorage persistence (reload) ==');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#card-earth', { state: 'visible', timeout: 5000 });
  const restored = await page.inputValue('#birthInput');
  ok(restored === BIRTH, `birthdate restored after reload (${restored})`);
  const st2 = await page.evaluate(() => window.__app.getState());
  ok(st2.hasResult === true && st2.birthISO === BIRTH, 'result recomputed after reload');
  const stored = await page.evaluate(() => localStorage.getItem('cosmicAgeBirth'));
  ok(stored === BIRTH, 'localStorage holds birthdate');

  console.log('== Reset ==');
  await page.click('#resetBtn');
  await page.waitForSelector('#emptyState', { state: 'visible', timeout: 5000 });
  ok(await page.locator('#results').isHidden(), 'results hidden after reset');
  const cleared = await page.evaluate(() => localStorage.getItem('cosmicAgeBirth'));
  ok(cleared === null, 'localStorage cleared on reset');
  ok(await page.inputValue('#birthInput') === '', 'input cleared on reset');

  console.log('== Mobile viewport (375×667) ==');
  const mPage = await browser.newPage({ viewport: { width: 375, height: 667 } });
  mPage.on('console', m => { if (m.type() === 'error') errors.push('mobile console: ' + m.text()); });
  mPage.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
  await mPage.goto(BASE, { waitUntil: 'networkidle' });
  await mPage.evaluate(() => window.__app.setBirth('1990-06-15'));
  await mPage.waitForSelector('#card-earth', { state: 'visible', timeout: 5000 });
  const overflow = await mPage.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
  ok(overflow <= 0, `no horizontal overflow on mobile (overflow=${overflow}px)`);
  const cols = await mPage.evaluate(() => getComputedStyle(document.getElementById('bodyGrid')).gridTemplateColumns.split(' ').length);
  ok(cols === 2, `mobile grid is 2 columns (got ${cols})`);
  ok(await mPage.locator('#card-saturn .planet.saturn').isVisible(), 'Saturn (with ring) visible on mobile');
  await mPage.screenshot({ path: '/tmp/daily-app/screenshot-mobile.png' });
  await mPage.close();

  console.log('== Console / page errors ==');
  ok(errors.length === 0, `no browser errors (${errors.length})`);
  if (errors.length) console.log(errors.join('\n'));

  await browser.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });