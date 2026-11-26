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
  const { id, turns } = await liveFixture.start('en');
  assert.match(turns[0].text, /offer an AI voice agent/);
  assert.match(turns[0].text, /what name should i call you by/i);
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

  const voiceBooking = await liveFixture.start('en');
  const noSlot = await liveFixture.ask(voiceBooking.id, 'Confirm booking');
  assert.match(noSlot.turns.at(-1).text, /choose an available demo time/i);
  assert.equal(effectCount, 1);
  await liveFixture.ask(voiceBooking.id, 'Show available demo slots');
  const pending = await liveFixture.ask(voiceBooking.id, 'Slot 1');
  assert.match(pending.turns.at(-1).text, /Say “Confirm booking”/);
  assert.equal((await liveFixture.ask(voiceBooking.id, 'Yes')).saved, null);
  assert.equal(effectCount, 1);
  const confirmed = await liveFixture.ask(voiceBooking.id, 'Please confirm booking.');
  assert.equal(confirmed.saved.slotId, slot.id);
  assert.match(confirmed.turns.at(-1).text, /Your demo is booked/);
  await liveFixture.ask(voiceBooking.id, 'Confirm booking');
  assert.equal(effectCount, 2);

  const recoverable = await liveFixture.start('en');
  const requestId = 'test-request-id-001';
  const firstTurn = await liveFixture.act(recoverable.id, { action: 'turn', text: 'My name is Dev', requestId });
  const retried = await liveFixture.act(recoverable.id, { action: 'turn', text: 'My name is Dev', requestId });
  assert.equal(firstTurn.turns.length, retried.turns.length);
  await assert.rejects(liveFixture.act(recoverable.id, { action: 'turn', text: 'Different content', requestId }), /already used/);
  assert.deepEqual(await liveFixture.act(recoverable.id, { action: 'end' }), { ended: true });
  await assert.rejects(liveFixture.ask(recoverable.id, 'Hello'), /expired/);

  const inventedPrice = fixture(async () => ({ text: JSON.stringify({ answer: 'It costs $12 per team.', sources: ['FAQ-01'] }) }));
  const priceCheck = await inventedPrice.start('en');
  const grounded = await inventedPrice.ask(priceCheck.id, 'What is the price?');
  assert.match(grounded.turns.at(-1).text, /\$49/);
  assert.doesNotMatch(grounded.turns.at(-1).text, /\$12/);

  const offline = fixture(async () => { throw Error('fixture outage'); });
  const offlineEnglish = await offline.start('en');
  for (const [text, source] of [['How is your product?', 'FAQ-02'], ['How can I buy this product?', 'FAQ-10'], ['What are the advantages of your product?', 'FAQ-11']]) {
    const answer = await offline.ask(offlineEnglish.id, text);
    assert.equal(answer.turns.at(-1).source.id, source);
    assert.equal(answer.profile.need, undefined);
  }
  const offTopicAfterPricing = await offline.ask(offlineEnglish.id, 'Does it work on Mars?');
  assert.equal(offTopicAfterPricing.turns.at(-1).source, undefined);
  assert.match(offTopicAfterPricing.turns.at(-1).text, /FAQ does not cover/);
  assert.equal((await offline.ask(offlineEnglish.id, 'Okay. So')).profile.need, undefined);
  await offline.ask(offlineEnglish.id, 'We need an agent to answer product inquiries.');
  await offline.ask(offlineEnglish.id, '15 people');
  const tomorrow = await offline.ask(offlineEnglish.id, 'Start from tomorrow');
  assert.equal(tomorrow.profile.timelineDays, 1);
  assert.equal(tomorrow.qualification.outcome, 'Qualified');
  assert.match(tomorrow.turns.at(-1).text, /available demo times/);
  const repeated = await offline.ask(offlineEnglish.id, 'Tomorrow');
  assert.equal(repeated.profile.timelineDays, 1);
  assert.doesNotMatch(repeated.turns.at(-1).text, /when would you like to start/i);
  const relativeOnly = await offline.start('en');
  const today = await offline.ask(relativeOnly.id, 'Today');
  assert.equal(today.profile.timelineDays, 0);
  assert.equal(today.profile.need, undefined);
  assert.equal((await offline.ask(relativeOnly.id, 'Next week')).profile.timelineDays, 7);
  const named = await liveFixture.start('en');
  const introduction = await liveFixture.ask(named.id, 'My name is Asha Rao.');
  assert.equal(introduction.profile.name, 'Asha Rao');
  assert.equal(introduction.profile.need, undefined);
  assert.match(introduction.turns.at(-1).text, /Nice to meet you, Asha Rao/);
  const personalized = await liveFixture.ask(named.id, 'Does it speak Hindi and save leads to a CRM?');
  assert.match(personalized.turns.at(-1).text, /^Asha Rao, /);
  assert.ok(!JSON.stringify(modelInput.context).includes('Asha Rao'));
  const corrected = await liveFixture.ask(named.id, 'Call me Asha.');
  assert.equal(corrected.profile.name, 'Asha');
  assert.match((await liveFixture.ask(named.id, 'What is my name?')).turns.at(-1).text, /Asha/);
  const nameFixture = fixture(async () => { throw Error('fixture outage'); });
  const bare = await nameFixture.start('en');
  assert.equal((await nameFixture.ask(bare.id, 'Vikram')).profile.name, 'Vikram');
  const skip = await nameFixture.start('en');
  assert.equal((await nameFixture.ask(skip.id, 'Skip')).profile.name, undefined);
  const afterSkip = await nameFixture.ask(skip.id, 'How can I buy this product?');
  assert.equal(afterSkip.turns.at(-1).source.id, 'FAQ-10');

  const spoken = await nameFixture.start('en');
  const screenshotText = 'Yeah. So my name is Ankit Kumar. And just tell me what are the products you are offering to.';
  const combined = await nameFixture.ask(spoken.id, screenshotText);
  assert.equal(combined.profile.name, 'Ankit Kumar');
  assert.equal(combined.profile.need, undefined);
  assert.equal(combined.turns.at(-2).text, screenshotText);
  assert.equal(combined.turns.at(-1).source.id, 'FAQ-02');
  assert.match(combined.turns.at(-1).text, /^Ankit Kumar, .*AI receptionist/);
  const misheard = await nameFixture.ask(spoken.id, 'What is Flutus? First, explain with that. What is Flutus?');
  assert.equal(misheard.turns.at(-1).source.id, 'FAQ-02');
  assert.match(misheard.turns.at(-1).text, /If you mean FlowDesk/);
  const allInOne = await nameFixture.ask(spoken.id,
    'Call me Ankit and what is this product, what is its price, and what are the teams?');
  assert.equal(allInOne.profile.name, 'Ankit');
  assert.deepEqual(new Set(allInOne.turns.at(-1).sources.map(source => source.id)), new Set(['FAQ-01', 'FAQ-02', 'FAQ-09']));
  assert.match(allInOne.turns.at(-1).text, /\$49/);
  const demo = await nameFixture.ask(spoken.id, 'What is my demo?');
  assert.equal(demo.turns.at(-1).source.id, 'FAQ-07');
  assert.equal(demo.offers.length, 0);

  const hindi = await offline.start('hi');
  assert.match(hindi.turns[0].text, /वॉइस एजेंट/);
  const fallback = await offline.ask(hindi.id, 'आप क्या करते हैं?');
  assert.equal(fallback.turns.at(-1).source.id, 'FAQ-02');
  assert.match(fallback.turns.at(-1).text, /रिसेप्शनिस्ट/);
  assert.match(fallback.turns.at(-1).warning, /Groq is unavailable/);
  await offline.ask(hindi.id, 'हमें नए लीड के सवालों का जवाब देना है।');
  await offline.ask(hindi.id, '१२ लोग');
  const qualifiedHindi = await offline.ask(hindi.id, '३० दिन');
  assert.equal(qualifiedHindi.qualification.outcome, 'Qualified');
  const kannada = await offline.start('kn');
  assert.match(kannada.turns[0].text, /ವಾಯ್ಸ್ ಏಜೆಂಟ್/);
  const kannadaOverview = await offline.ask(kannada.id, 'FlowDesk ಏನು ಮಾಡುತ್ತದೆ?');
  assert.equal(kannadaOverview.turns.at(-1).source.id, 'FAQ-02');
  assert.match(kannadaOverview.turns.at(-1).text, /ರಿಸೆಪ್ಷನಿಸ್ಟ್/);
  console.log('PASS: introduction, natural question without punctuation, multiple topics, follow-up context, sales scope, session names and skipping, Hindi and Kannada, outage, relative timelines, purchase and benefits, and explicit booking.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
