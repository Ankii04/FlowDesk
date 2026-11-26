'use strict';
const readline = require('node:readline');
const stages = new Map();

async function main() {
  for await (const line of readline.createInterface({ input: process.stdin })) {
    let event;
    try { event = JSON.parse(line); } catch (_) { continue; }
    if (event.event !== 'flowdesk.timing' || typeof event.stage !== 'string' ||
        !Number.isFinite(event.durationMs) || event.durationMs < 0) continue;
    const stage = stages.get(event.stage) || { durations: [], outcomes: new Map() };
    stage.durations.push(event.durationMs);
    const outcome = typeof event.outcome === 'string' ? event.outcome : 'unknown';
    stage.outcomes.set(outcome, (stage.outcomes.get(outcome) || 0) + 1);
    stages.set(event.stage, stage);
  }
  if (!stages.size) throw Error('No FlowDesk timing events found. Set FLOWDESK_TIMING_LOG=1 and run a rehearsal.');
  for (const [stage, { durations, outcomes }] of stages) {
    durations.sort((a, b) => a - b);
    const percentile = p => durations[Math.ceil(durations.length * p) - 1];
    console.log(JSON.stringify({ stage, count: durations.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), outcomes: Object.fromEntries(outcomes) }));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
