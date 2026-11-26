'use strict';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const base = process.env.TEST_STUDIO_URL || 'http://127.0.0.1:8787';
const crm = process.env.FORTIVEX_CRM_URL;
const ids = {};
async function request(baseUrl, route, { body, headers = {}, expected = 200 } = {}) {
  const response = await fetch(baseUrl + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000),
  });
  const data = await response.json().catch(() => ({}));
  assert.equal(response.status, expected, route + ' → ' + (data.error || data.message || response.status));
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const login = async () => (await request(base, '/api/auth/login', { body: {
  email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD,
} })).cookie;

async function verify({ configureFault = async () => {}, assertFault = false } = {}) {
  let cookie = await login();
  const send = async (route, body, expected) => (await request(base, '/api/sales/' + route, {
    body, expected, headers: { Cookie: cookie },
  })).data;
  const start = () => send('start', { language: 'en', consent: true });
  const act = (id, action, fields, expected) => send('action', { id, action, ...fields }, expected);
  const turn = (id, text) => act(id, 'turn', { text });
  await request(base, '/api/sales/start', { body: { language: 'en', consent: true }, expected: 401 });
  await send('start', { language: 'en', consent: false }, 400);

  const { id } = await start();
  ids.primary = id;
  await turn(id, 'My name is Asha Rao');
  await act(id, 'contact', { email: 'asha@example.test', consent: false }, 400);
  const contact = await act(id, 'contact', { email: 'asha@example.test', consent: true });
  assert.equal(contact.hasContact, true);
  assert.ok(!JSON.stringify(contact).includes('asha@example.test'));
  const requestId = randomUUID();
  const first = await act(id, 'turn', { text: 'What is FlowDesk?', requestId });
  const retried = await act(id, 'turn', { text: 'What is FlowDesk?', requestId });
  assert.equal(retried.turns.length, first.turns.length);
  await act(id, 'turn', { text: 'What is the price?', requestId }, 409);
  assert.equal((await send('session?id=' + id)).profile.name, 'Asha Rao');
  const faq = await turn(id, 'What is the price?');
  assert.equal(faq.turns.at(-1).source.id, 'FAQ-01');
  if (process.env.TEST_EXPECT_PROVIDER_FALLBACK === '1') {
    assert.match(faq.turns.at(-1).warning, /Groq is unavailable/);
    assert.match(faq.turns.at(-1).text, /\$49/);
  }
  const unknown = await turn(id, 'Does it work on Mars?');
  assert.match(unknown.turns.at(-1).text, /FAQ does not cover/);
  assert.equal(unknown.turns.at(-1).source, undefined);
  await turn(id, 'We need an agent to answer inbound product inquiries.');
  await turn(id, 'We have 12 people.');
  const memory = await turn(id, 'We want to start in 30 days.');
  assert.match(memory.turns.at(-1).text, /12 people.*30-day/);
  assert.equal(memory.qualification.outcome, 'Qualified');
  assert.match(memory.profile.need, /inbound product inquiries/i);

  const cautious = await turn(id, 'I am concerned about the budget.');
  assert.equal(cautious.sentiment.label, 'Cautious');
  assert.equal(cautious.qualification.outcome, 'Qualified');
  const offered = await turn(id, 'Show available demo slots');
  assert.ok(offered.offers.length >= 2, 'Seed three future slots before running this test.');
  const slotId = offered.offers[0].id;
  await act(id, 'confirm', { slotId }, 409);
  const proposed = await act(id, 'propose', { slotId });
  assert.match(proposed.proposed.label, /IST \(Asia\/Kolkata\)/);
  assert.equal(proposed.saved, null);

  const rival = await start();
  await turn(rival.id, 'Show available demo slots');
  await act(rival.id, 'propose', { slotId });

  if (assertFault) {
    await configureFault(true, id);
    await act(id, 'confirm', { slotId }, 503);
    await send('saved?id=' + id, undefined, 404);
    await configureFault(false, id);
  }

  const booked = await turn(id, 'Confirm booking');
  const again = await turn(id, 'Confirm booking');
  assert.equal(booked.saved.result.bookingReference, id);
  assert.deepEqual(again.saved, booked.saved);
  const conflict = await act(rival.id, 'confirm', { slotId }, 409);
  assert.equal(conflict.code, 'slot_unavailable');

  cookie = await login();
  const readBack = await send('saved?id=' + id);
  assert.equal(readBack.slot.id, slotId);
  assert.equal(readBack.conversation.type, 'CALL');
  assert.equal(readBack.result.qualification, 'Qualified');
  assert.equal(readBack.result.teamSize, '12');
  assert.equal(readBack.result.sentiment, 'Cautious');
  assert.match(readBack.result.objection, /budget/);
  assert.equal(readBack.timeline.filter(item => item.type === 'CONVERSATION_ADDED').length, 1);
  assert.ok(!JSON.stringify(readBack).includes('passwordHash'));

  const loginCrm = await request(crm, '/auth/login', { body: {
    email: process.env.FORTIVEX_CRM_EMAIL, password: process.env.FORTIVEX_CRM_PASSWORD,
  } });
  const headers = { Authorization: 'Bearer ' + loginCrm.data.data.accessToken };
  const lead = (await request(crm, '/leads/' + id, { headers })).data.data;
  const timeline = (await request(crm, '/conversations/' + id + '/timeline', { headers })).data.data;
  assert.equal(lead.customFields.salesRunId, id);
  assert.equal(lead.customerName, 'Asha Rao');
  assert.equal(lead.email, 'asha@example.test');
  assert.equal(readBack.result.prospectName, 'Asha Rao');
  assert.ok(!JSON.stringify(readBack).includes('asha@example.test'));
  assert.equal(lead.nextFollowUpAt, readBack.slot.startsAt);
  assert.equal(timeline.filter(item => item.type === 'CONVERSATION_ADDED').length, 1);
  assert.ok(!JSON.stringify(timeline).includes('passwordHash'));

  const otherSlots = (await request(crm, '/sales-demo/slots?tenantId=other-tenant', { headers })).data.data;
  assert.ok(otherSlots.length >= 2);
  assert.ok(!otherSlots.some(slot => slot.id === slotId));
  await request(crm, '/sales-demo/runs/' + id + '?account=' + encodeURIComponent(readBack.account) + '&tenantId=other-tenant', { headers, expected: 404 });
  await request(crm, '/sales-demo/runs', { headers, expected: 409, body: {
    id: randomUUID(), account: 'other-tenant_user', tenantId: 'other-tenant', summary: readBack.result, slotId: offered.offers[1].id,
  } });

  const hi = await send('start', { language: 'hi', consent: true });
  await turn(hi.id, 'हमें नए लीड बाँटने हैं।');
  await turn(hi.id, '१२ लोग');
  const hiMemory = await turn(hi.id, '३० दिन');
  assert.equal(hiMemory.language, 'hi');
  assert.equal(hiMemory.qualification.outcome, 'Qualified');
  assert.match(hiMemory.turns.at(-1).text, /12 लोगों/);
  const review = await act(hi.id, 'finish', {});
  assert.equal(review.saved.result.bookingReference, null);
  console.log('PASS: auth + consent, FAQ source + unsupported question, English and Hindi text memory, qualification, explicit booking, retry, slot conflict, CRM lead/timeline read in a fresh login.');
  if (assertFault) console.log('PASS: injected database failure rolled back the booking, lead and timeline. Retrying the original confirmation committed once.');
  return ids;
}
if (require.main === module) verify().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { verify };
