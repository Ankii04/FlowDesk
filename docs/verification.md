# Requirement matrix and test evidence

## Source audit

This table describes source found in the accessible checkouts, before runtime verification. The Windows checkout remained inaccessible to this session. The isolated RapidX snapshot is based on `b7f5449` with the two earlier patches applied once. The previous accessible workspace copy passed the reverse check for the timeout fix. LeadPulse is based on `060672d`.

| Requirement | Existing files inspected | Reuse and Round 3 work |
|---|---|---|
| Browser voice and timeouts | `rapidx/dashboard/public/assets/app.js` · `rapidx/dashboard/server.js` · `rapidx/dashboard/lib/providers.js` | Reuse authenticated per-turn STT and TTS plus the MediaRecorder pattern. Keep both previous patches for the general console. Sales has its own focused page and defaults to the per-turn HTTP lane, so a streaming WebSocket outage cannot stop capture. |
| Context, languages, FAQ | `rapidx/dashboard/lib/providers.js` | Add scoped short-lived sales state, English/Hindi choice, ranked product catalog, conversational sourced replies, and typed route through the same logic. |
| CRM login and leads | `leadpulse/src/modules/auth/auth.routes.ts` · `leadpulse/src/middleware/auth.ts` · `leadpulse/src/modules/leads/lead.routes.ts` · `leadpulse/src/modules/leads/lead.service.ts` | Reuse JWT login and lead and conversation data models. Add an authenticated transaction endpoint rather than chaining multiple non-atomic writes. Verify the result with the existing lead read endpoint. |
| Lead scoring | `leadpulse/src/modules/scoring/scoring.service.ts` | Its score measures engagement and response latency. Discovery fit uses explicit need, size and rollout data. Keep the fit outcome and reason separate so they don't alter LeadPulse's engagement score. |
| Timeline and data | `leadpulse/src/modules/conversations/conversation.routes.ts` · `conversation.service.ts` · `conversation.repository.ts` · `leadpulse/prisma/schema.prisma` | Reuse timeline reads. Add availability and booking, an atomic activity entry, a structured summary and a migration. Limit the selected fields on timeline actors. |
| Local infrastructure | `rapidx/README.md` · `leadpulse/README.md` · `leadpulse/docker-compose.yml` · `leadpulse/src/config/{database,redis}.ts` | Use the existing Node processes, Postgres and Redis. Add root Compose and a repeatable launcher. VoBiz and Dograh are outside the demo path. |

## Feature checklist

| Feature | Status | Evidence or next verification |
|---|---|---|
| Browser voice with live STT/TTS | Verified live with a simulated microphone · laptop hardware pending | Chromium used a synthetic WAV as microphone input. The real Deepgram endpoint returned a transcript and the browser decoded real Rumik WAV and started playback. |
| Typed backup | Verified live against local APIs and PostgreSQL | Same session and action endpoints as speech. Tested an entire English sales flow with typed inputs. |
| Contextual memory | Verified live | Need, 12-person team and 30-day rollout persisted in session; assistant repeated each without re-asking. Proposal valid for the current session. |
| Hindi | Verified live with typed and simulated microphone input · laptop hardware pending | Deepgram returned “Floor desk की कीमत क्या है?” and the app matched FAQ-01. Groq generated a Hindi reply and the browser decoded Rumik audio. Pronunciation quality needs a listening check. |
| RAG | Verified live | Pricing found FAQ-01 and Groq phrased the answer in both languages. An unrelated Mars question returned a knowledge gap. With Groq disabled the API returned the source passage with a warning. |
| Qualification and sentiment | Verified live | Rule rationale stored separately from an explicit budget concern and cautious sentiment. Incomplete profiles remain **Needs review**. |
| Appointment booking | Verified live in PostgreSQL | No write before confirmation. Exact date/time/IST proposal. Duplicate requests returned the existing run. A competing session received HTTP 409. |
| LeadPulse capture and call summary | Verified live in PostgreSQL and API read | Re-login and read the lead, activity timeline, booking and summary. Counted one run, one lead and one completed call record for the retried booking. |
| Business insights dashboard | Designed for later | Use `sales_runs` as the fact table. `COUNT(*)` gives completed sessions, `COUNT(*) FILTER (WHERE result->>'qualification'='Qualified')` gives qualified leads, and `COUNT("slotId")` gives appointments. Filter by account and `"createdAt"`; link returns to the confirmed slot. Verify aggregates against seeded runs before publishing. |
| Telephony and interruption | Designed for later | Connect a carrier webhook to a Dograh/media gateway, validate webhook signatures, publish a workflow with the same sales actions, stream speech and test barge-in. Verify inbound/outbound against a consented test number, with failure recording and replay. |
| External calendar | Designed for later | Emit the booking ID from a transactional outbox. A calendar worker uses it as the external idempotency key and reconciles remote conflicts. Test duplicate events, provider downtime and cancellation in a sandbox. |
| Long-term memory and richer sentiment | Designed for later | A tenant-scoped opt-in profile store restores verified details. A separate review pipeline can classify sentiment on labeled, consented data and record confidence. Test expiry, deletion, authorization, ambiguity, and bias across languages. |
| 100,000 registered users | Designed for later | Capacity and load test targets in [architecture.md](architecture.md). No scale test was claimed. |

## Voice-agent product update

Run `node scripts/verify-sales-conversation.cjs` for deterministic checks of the introduction, unpunctuated product questions, multiple topics, conversational follow-ups, the product boundary, Hindi and Kannada, provider failure, and explicit booking. An English live Groq check returned both CRM and Hindi support sources for a compound question, answered a phone-channel follow-up, and declined an unrelated sports question. The product overview still answered from the catalog when live generation fell back. Kannada product replies were checked with the catalog fallback. Browser microphone and playback for this update were not re-tested.

## Runtime evidence

- Ran `npm ci`, Prisma Client generation, migrations on a fresh PostgreSQL database, LeadPulse build, and the demo seed. Ran `pnpm install --frozen-lockfile` and RapidX's existing `pnpm test`.
- Ran `scripts/verify.cjs` against running RapidX, LeadPulse, PostgreSQL and Redis. PostgreSQL and Redis were native local processes for this test. The Windows Docker Compose launcher was not run in this environment.
- A test-only PostgreSQL trigger failed the conversation insert after the run and lead inserts. The user-facing request returned HTTP 503, a read returned 404, and a direct query found zero partially written run/lead rows. Removing the trigger and retrying the same confirmation produced exactly one run, lead and conversation. The test stack is disposable.
- A Chromium browser run used synthetic WAVs as microphone fixtures, real MediaRecorder WebM clips, and live Deepgram, Groq and Rumik requests. English STT returned “What is the price” and Hindi STT returned “Floor desk की कीमत क्या है?” The browser decoded WAV and started playback for both languages. The English browser flow confirmed a real PostgreSQL booking, reloaded the page, and displayed a fresh LeadPulse timeline.
- The initial browser run hit the workspace HTTPS proxy's five-second CONNECT timeout. The passing live browser run used a test-only curl transport through that same managed network and called the real services. The submission uses the original RapidX Node HTTPS transport. Neither a physical Windows microphone nor audible speaker output was verified here.
- Reset was run after the integration test. The database contained zero tagged synthetic leads, zero saved runs, and three future slots afterward.
- The fallback test intentionally cleared provider keys. It verified that the product question still returns the seeded pricing passage with a provider warning. No test placed a telephone call.
- Rendered both Mermaid diagrams to offline assets. Exported the report with embedded fonts and verified the PDF is one A4 page.

### Laptop verification checklist

1. Restart from the [README](../README.md), confirm the health endpoint, sign into `/sales.html`, acknowledge the disclosure, and choose **English**.
2. Enable **Speak replies**. Click **Speak a turn**, speak **“What is the price?”** into the actual microphone, then click **Send voice turn**. Confirm the actual words appear, the source is FAQ-01, and audio comes out of the laptop speakers.
3. Try Hindi in a separate session with **“FlowDesk की कीमत क्या है?”**. Record the exact audio result. If recognition or pronunciation is poor, show Hindi typed mode and explain the provider gap.
4. Finish a booking and reload the page, then confirm the reference, summary and LeadPulse timeline. Run the reset command after your rehearsal and leave one seeded slot available for evaluation.
