import http from 'k6/http';
import { check, sleep } from 'k6';

// docs/features/popular-plants.md — How fast it must be:
// About 20 concurrent shoppers: 95% of GET /api/popular within 300 ms, and no request fails;
// at the same load, 95% of GET /api/plants within 300 ms.
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8100';
const ENDPOINTS = ['popular', 'catalog'];
const P95_LIMIT_MS = 300;

const requested = __ENV.SCENARIO || 'smoke';
if (requested !== 'smoke' && requested !== 'load') {
  throw new Error(`SCENARIO must be smoke or load, received "${requested}"`);
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
    http_req_failed: ['rate==0'],
    checks: ['rate>0.99'],
    'http_req_duration{endpoint:popular}': [`p(95)<${P95_LIMIT_MS}`],
    'http_req_duration{endpoint:catalog}': [`p(95)<${P95_LIMIT_MS}`],
  },
};

export default function () {
  const popular = http.get(`${BASE_URL}/api/popular`, {
    tags: { endpoint: 'popular', name: 'GET /api/popular' },
  });
  check(popular, { 'popular status is 200': (response) => response.status === 200 });

  const catalog = http.get(`${BASE_URL}/api/plants`, {
    tags: { endpoint: 'catalog', name: 'GET /api/plants' },
  });
  check(catalog, { 'catalog status is 200': (response) => response.status === 200 });

  if (requested === 'load') sleep(1);
}

function ms(value) {
  return typeof value === 'number' ? `${value.toFixed(2)} ms` : 'n/a';
}

function endpointRow(data, name) {
  const metric = data.metrics[`http_req_duration{endpoint:${name}}`];
  const values = metric && metric.values ? metric.values : {};
  const expression =
    metric && metric.thresholds
      ? Object.keys(metric.thresholds).find((key) => key.startsWith('p(95)<'))
      : undefined;
  const limit = expression ? Number(expression.slice('p(95)<'.length)) : P95_LIMIT_MS;
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
    lines.push(
      `| ${row.endpoint} | ${ms(row.p50)} | ${ms(row.p95)} | ${ms(row.p99)} | ${row.limit} ms | ${row.pass ? 'pass' : 'fail'} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

export function handleSummary(data) {
  const rows = ENDPOINTS.map((name) => endpointRow(data, name));
  const table = markdownTable(rows);
  const numbers = {
    scenario: requested,
    endpoints: Object.fromEntries(
      rows.map((row) => [
        row.endpoint,
        { p50: row.p50, p95: row.p95, p99: row.p99, limit: row.limit, pass: row.pass },
      ]),
    ),
  };

  return {
    stdout: table,
    [`reports/k6/popular-plants-${requested}.md`]: table,
    [`reports/k6/popular-plants-${requested}.json`]: `${JSON.stringify(numbers, null, 2)}\n`,
  };
}
