import http from 'k6/http';
import { check, sleep } from 'k6';

// Shopper journey from GET /openapi.json: browse the catalog, search it, then open one plant.
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8100';
const SEARCH = 'monstera';
const EXAMPLE_PLANT_ID = 'pl-monstera';
const ENDPOINTS = ['catalog', 'search', 'plant'];

const requested = __ENV.SCENARIO || 'smoke';
if (requested !== 'smoke' && requested !== 'load') {
  throw new Error(`SCENARIO must be smoke or load, received "${requested}"`);
}

// Placeholder until someone owns a speed target for these endpoints.
// The limit is three times today's p95 from tests/performance/baseline.json,
// never below 50 ms and never above 300 ms. Until a baseline exists, use the ceiling.
function placeholderLimit(p95) {
  if (typeof p95 !== 'number' || !Number.isFinite(p95)) return 300;
  return Math.round(Math.min(300, Math.max(50, p95 * 3)));
}

function readBaseline() {
  try {
    return JSON.parse(open('./baseline.json'));
  } catch (error) {
    return {};
  }
}

const baseline = readBaseline();
const limits = {};
for (const name of ENDPOINTS) {
  limits[name] = placeholderLimit(baseline[name]);
}

const scenarios = {
  smoke: {
    executor: 'per-vu-iterations',
    vus: 1,
    iterations: 10,
    maxDuration: '1m',
  },
  load: {
    executor: 'constant-vus',
    vus: 20,
    duration: '30s',
  },
};

export const options = {
  scenarios: {
    [requested]: scenarios[requested],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{endpoint:catalog}': [`p(95)<${limits.catalog}`],
    'http_req_duration{endpoint:search}': [`p(95)<${limits.search}`],
    'http_req_duration{endpoint:plant}': [`p(95)<${limits.plant}`],
  },
};

function plantIdFrom(response) {
  try {
    const items = response.json('items');
    if (Array.isArray(items) && items.length > 0 && items[0].id) return String(items[0].id);
  } catch (error) {
    // The catalog body was not a plant list. The OpenAPI example id is the fallback.
  }
  return EXAMPLE_PLANT_ID;
}

export default function () {
  const catalog = http.get(`${BASE_URL}/api/plants`, {
    tags: { endpoint: 'catalog', name: 'GET /api/plants' },
  });
  check(catalog, { 'catalog status is 200': (response) => response.status === 200 });

  const search = http.get(`${BASE_URL}/api/plants?search=${encodeURIComponent(SEARCH)}`, {
    tags: { endpoint: 'search', name: 'GET /api/plants?search' },
  });
  check(search, { 'search status is 200': (response) => response.status === 200 });

  const plantId = plantIdFrom(catalog);
  const plant = http.get(`${BASE_URL}/api/plants/${encodeURIComponent(plantId)}`, {
    tags: { endpoint: 'plant', name: 'GET /api/plants/{plantId}' },
  });
  check(plant, { 'plant status is 200': (response) => response.status === 200 });

  // Load rounds pause so a shopper has a second to read before the next click.
  if (requested === 'load') sleep(1);
}

function ms(value) {
  return typeof value === 'number' ? `${value.toFixed(2)} ms` : 'n/a';
}

function endpointRow(data, name) {
  const metric = data.metrics[`http_req_duration{endpoint:${name}}`];
  const values = metric && metric.values ? metric.values : {};
  const expression = metric && metric.thresholds ? Object.keys(metric.thresholds).find((key) => key.startsWith('p(95)<')) : undefined;
  const limit = expression ? Number(expression.slice('p(95)<'.length)) : limits[name];
  const pass = Boolean(expression && metric.thresholds[expression].ok);
  return {
    endpoint: name,
    p50: values['p(50)'],
    p95: values['p(95)'],
    p99: values['p(99)'],
    limit,
    pass,
  };
}

function markdownTable(rows) {
  const lines = [
    `| Endpoint | p50 | p95 | p99 | Limit | Result |`,
    `| --- | ---: | ---: | ---: | ---: | --- |`,
  ];
  for (const row of rows) {
    lines.push(`| ${row.endpoint} | ${ms(row.p50)} | ${ms(row.p95)} | ${ms(row.p99)} | ${row.limit} ms | ${row.pass ? 'pass' : 'fail'} |`);
  }
  return `${lines.join('\n')}\n`;
}

export function handleSummary(data) {
  const rows = ENDPOINTS.map((name) => endpointRow(data, name));
  const table = markdownTable(rows);
  const numbers = {
    scenario: requested,
    endpoints: Object.fromEntries(rows.map((row) => [row.endpoint, { p50: row.p50, p95: row.p95, p99: row.p99, limit: row.limit, pass: row.pass }])),
  };

  const summary = {
    stdout: table,
    [`reports/k6/catalog-${requested}.md`]: table,
    [`reports/k6/catalog-${requested}.json`]: `${JSON.stringify(numbers, null, 2)}\n`,
  };

  if (__ENV.SAVE_BASELINE === '1') {
    const recorded = {};
    for (const row of rows) recorded[row.endpoint] = row.p95;
    summary['tests/performance/baseline.json'] = `${JSON.stringify(recorded, null, 2)}\n`;
  }

  return summary;
}
