'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

function requestJson(baseUrl, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${baseUrl}${pathname}`, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body || '{}') });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
  });
}

test('generalLimiter skips /api/health so health probes never exhaust admin IP quota', async (t) => {
  const prevDisable = process.env.DISABLE_RATE_LIMIT;
  const prevRateMax = process.env.RATE_LIMIT_MAX;
  const prevMock = process.env.ALLOW_MOCK_MODE;

  process.env.DISABLE_RATE_LIMIT = 'false';
  process.env.RATE_LIMIT_MAX = '2';
  process.env.ALLOW_MOCK_MODE = 'true';

  delete require.cache[require.resolve('../app')];
  const app = require('../app');
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (prevDisable === undefined) delete process.env.DISABLE_RATE_LIMIT;
    else process.env.DISABLE_RATE_LIMIT = prevDisable;
    if (prevRateMax === undefined) delete process.env.RATE_LIMIT_MAX;
    else process.env.RATE_LIMIT_MAX = prevRateMax;
    if (prevMock === undefined) delete process.env.ALLOW_MOCK_MODE;
    else process.env.ALLOW_MOCK_MODE = prevMock;
    delete require.cache[require.resolve('../app')];
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  for (let i = 0; i < 5; i += 1) {
    const res = await requestJson(baseUrl, '/api/health');
    assert.equal(res.status, 200, `Expected /api/health attempt #${i + 1} to return 200 without being rate-limited`);
    assert.equal(res.body.status, 'ok');
  }
});

test('ToastProvider memoizes context value and AdminDashboard load does not loop on toast updates', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const toastProvider = fs.readFileSync(path.join(repoRoot, 'src/context/ToastProvider.jsx'), 'utf8');
  const adminDashboard = fs.readFileSync(path.join(repoRoot, 'src/pages/AdminDashboard/index.jsx'), 'utf8');

  assert.match(
    toastProvider,
    /const\s+value\s*=\s*useMemo\(\s*\(\)\s*=>\s*\(\{[\s\S]{0,250}addToast[\s\S]{0,250}error[\s\S]{0,250}\}\)/,
    'ToastProvider must memoize its context value so adding/removing toasts does not re-trigger consumer useEffects'
  );

  const loadCallbackMatch = adminDashboard.match(/const\s+load\s*=\s*useCallback\([\s\S]*?\},\s*\[([^\]]*)\]\)/);
  assert.ok(loadCallbackMatch, 'AdminDashboard must define load with useCallback');
  assert.doesNotMatch(
    loadCallbackMatch[1],
    /\btoast\b/,
    'AdminDashboard load callback must not depend on the toast object directly'
  );
});

test('Admin button readiness fixes remain intact across LaunchReadinessPanel, Courses, Withdrawals, Search, and Dashboard', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const launchPanel = fs.readFileSync(path.join(repoRoot, 'src/pages/AdminDashboard/LaunchReadinessPanel.jsx'), 'utf8');
  const coursesTab = fs.readFileSync(path.join(repoRoot, 'src/pages/AdminDashboard/AdminCoursesTab.jsx'), 'utf8');
  const withdrawalsTab = fs.readFileSync(path.join(repoRoot, 'src/pages/AdminDashboard/AdminWithdrawalsTab.jsx'), 'utf8');
  const peopleSearch = fs.readFileSync(path.join(repoRoot, 'src/pages/AdminDashboard/AdminPeopleSearch.jsx'), 'utf8');
  const adminDashboard = fs.readFileSync(path.join(repoRoot, 'src/pages/AdminDashboard/index.jsx'), 'utf8');

  assert.match(
    launchPanel,
    /response\.status\s*===\s*503\s*&&\s*validLaunchPayload/,
    'LaunchReadinessPanel must accept HTTP 503 payloads when /api/launch-readiness reports NO-GO'
  );
  assert.match(
    coursesTab,
    /showDemoSeedCard\s*=\s*Boolean\(import\.meta\.env\.DEV\)/,
    'AdminCoursesTab must hide the dev-only demo course seed button in production builds'
  );
  assert.match(
    withdrawalsTab,
    /\['pending',\s*'processing'\]\.includes\(w\.status\)/,
    'AdminWithdrawalsTab must expose approve/reject controls for processing payouts too'
  );
  assert.match(
    peopleSearch,
    /disabled=\{!openable\}/,
    'AdminPeopleSearch must disable results without a 360 dossier instead of failing silently'
  );
  assert.match(
    adminDashboard,
    /else\s+if\s*\(!requestedTab\)\s*\{\s*setTab\('overview'\)/,
    'AdminDashboard must reset to overview tab when navigating back to /admin without ?tab='
  );
  assert.match(
    adminDashboard,
    /if\s*\(tab\s*===\s*'people'\)\s*loadApprovedTeachers\(\)/,
    'AdminDashboard must populate approved teachers when entering the people tab directly'
  );
});
