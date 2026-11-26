'use strict';
const assert = require('node:assert/strict');
const { createSales } = require('../rapidx/dashboard/lib/sales/session');

const account = { tenant: { id: 'tenant' }, user: { id: 'user' } };
let modelInput;
let effectCount = 0;
const slot = { id: 'demo-slot', startsAt: '2030-04-09T05:00:00Z', timeZone: 'Asia/Kolkata' };

function fixture(chat) {
  const sales = createSales({
    chat,
    crm: {
      slots: async () => [slot],
      finalize: async data => { effectCount += 1; return data; },
    },
  });
  const start = language => sales.start(account, { language, consent: true });
  const act = (id, body) => sales.act(account, { id, ...body });
  return { start, act, ask: (id, text) => act(id, { action: 'turn', text }) };
}

async function main() {
  const liveFixture = fixture(async payload => {
    modelInput = JSON.parse(payload.messages[0].text);
    const question = modelInput.question;
    if (question.includes('Hindi and')) return { text: JSON.stringify({
      answer: 'It supports Hindi and saves leads in LeadPulse.', sources: ['FAQ-06', 'FAQ-03'],
    }) };
    if (question.includes('what about')) return { text: JSON.stringify({
      answer: 'The demo works in a browser. Phone calling is outside the demo.', sources: ['FAQ-05'],
    }) };
    if (question.includes('cricket')) return { text: JSON.stringify({ answer: 'Out of scope.', sources: [] }) };
    return { text: 'invalid response' };
  });
  const { id, turns } = liveFixture.start('en');
  assert.match(turns[0].text, /offer an AI voice agent/);
  const about = await liveFixture.ask(id, 'What does your voice agent do');
  assert.equal(about.turns.at(-1).source.id, 'FAQ-02');
  assert.match(about.turns.at(-1).text, /AI receptionist/);
  assert.equal(about.profile.need, undefined);

  const multiple = await liveFixture.ask(id, 'Does it speak Hindi and save leads to a CRM?');
  assert.deepEqual(multiple.turns.at(-1).sources.map(source => source.id), ['FAQ-06', 'FAQ-03']);
  const contextual = await liveFixture.ask(id, 'And what about our phone number?');
  assert.match(contextual.turns.at(-1).text, /browser/);
  assert.ok(modelInput.context.some(turn => turn.text.includes('saves leads')));
  const outside = await liveFixture.ask(id, 'Can you explain cricket?');
  assert.equal(outside.turns.at(-1).source, undefined);
  assert.match(outside.turns.at(-1).text, /FAQ does not cover/);

  const capability = await liveFixture.ask(id, 'Can it book a demo?');
  assert.equal(capability.offers.length, 0);
  assert.equal(capability.turns.at(-1).source.id, 'FAQ-07');
  const offered = await liveFixture.ask(id, 'Show available demo slots');
  assert.equal(offered.offers[0].id, slot.id);
  await assert.rejects(liveFixture.act(id, { action: 'confirm', slotId: slot.id }), /currently proposed/);
  await liveFixture.act(id, { action: 'propose', slotId: slot.id });
  await liveFixture.act(id, { action: 'confirm', slotId: slot.id });
  await liveFixture.act(id, { action: 'confirm', slotId: slot.id });
  assert.equal(effectCount, 1);

  const offline = fixture(async () => { throw Error('fixture outage'); });
  const hindi = offline.start('hi');
  assert.match(hindi.turns[0].text, /वॉइस एजेंट/);
  const fallback = await offline.ask(hindi.id, 'आप क्या करते हैं?');
  assert.equal(fallback.turns.at(-1).source.id, 'FAQ-02');
  assert.match(fallback.turns.at(-1).text, /रिसेप्शनिस्ट/);
  assert.match(fallback.turns.at(-1).warning, /Groq is unavailable/);
  await offline.ask(hindi.id, 'हमें नए लीड के सवालों का जवाब देना है।');
  await offline.ask(hindi.id, '१२ लोग');
  const qualifiedHindi = await offline.ask(hindi.id, '३० दिन');
  assert.equal(qualifiedHindi.qualification.outcome, 'Qualified');
  const kannada = offline.start('kn');
  assert.match(kannada.turns[0].text, /ವಾಯ್ಸ್ ಏಜೆಂಟ್/);
  const kannadaOverview = await offline.ask(kannada.id, 'FlowDesk ಏನು ಮಾಡುತ್ತದೆ?');
  assert.equal(kannadaOverview.turns.at(-1).source.id, 'FAQ-02');
  assert.match(kannadaOverview.turns.at(-1).text, /ರಿಸೆಪ್ಷನಿಸ್ಟ್/);
  console.log('PASS: introduction, natural question without punctuation, multiple topics, follow-up context, sales scope, Hindi and Kannada, outage and explicit booking.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
