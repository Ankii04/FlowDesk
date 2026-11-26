'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createSales } = require('../rapidx/dashboard/lib/sales/session');

const concurrency = Number(process.argv[2] || 50);
if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 100) throw Error('Specify concurrency from 1 to 100.');

const expectedSources = {
  'What is the price?': ['FAQ-01'],
  'Can it speak Hindi and send leads to my CRM?': ['FAQ-03', 'FAQ-06'],
};
const sales = createSales({
  crm: {},
  chat: async options => {
    const { question } = JSON.parse(options.messages[0].text);
    const sources = expectedSources[question] || [];
    return { text: JSON.stringify({ answer: sources.length ? 'Synthetic fixture reply.' : 'Outside catalog.', sources }) };
  },
});
const timings = [];
const steps = [
  ['What is the price?', state => assert.equal(state.turns.at(-1).source.id, 'FAQ-01')],
  ['Can it speak Hindi and send leads to my CRM?', state => assert.equal(state.turns.at(-1).sources.length, 2)],
  ['Can you teach me chemistry?', state => assert.match(state.turns.at(-1).text, /does not cover/)],
  ['We need an agent to answer inbound product inquiries.', state => assert.match(state.profile.need, /product inquiries/)],
  ['15 people', state => assert.equal(state.profile.teamSize, 15)],
  ['Tomorrow', state => assert.equal(state.qualification.outcome, 'Qualified')],
];

async function simulate(index) {
  const context = { tenant: { id: 'synthetic-tenant-' + index }, user: { id: 'prospect' } };
  const session = await sales.start(context, { language: 'en', consent: true });
  for (const [text, check] of steps) {
    const started = performance.now();
    check(await sales.act(context, { action: 'turn', id: session.id, text }));
    timings.push(performance.now() - started);
  }
}

Promise.all(Array.from({ length: concurrency }, (_, index) => simulate(index))).then(() => {
  timings.sort((a, b) => a - b);
  const percentile = p => Number(timings[Math.ceil(timings.length * p) - 1].toFixed(1));
  console.log(JSON.stringify({
    mode: 'synthetic in-process session benchmark, fixture model, no audio or network',
    sessions: concurrency, turns: timings.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95),
  }));
}).catch(error => { console.error(error.message); process.exitCode = 1; });
