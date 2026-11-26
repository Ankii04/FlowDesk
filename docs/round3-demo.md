# Round 3 demonstration and technical discussion

## Three-minute live demo

**Before reporting** · Bring your charged laptop, charger, source folder and its ZIP backup, plus the PDF and offline architecture tab. The résumé hard copy and college ID are personal items. Set Windows input and output, log in, open the architecture diagram in another tab, and verify one English voice turn. Reset after rehearsal, then keep both servers running. Pick a seeded slot from the UI so the spoken date matches the session.

| Time | Screen action and exact dialogue |
|---|---|
| 0:00–0:25 | Open [FlowDesk](http://localhost:8787/sales.html). “FlowDesk sells an AI voice agent for B2B sales teams. This assistant is the first point of contact for someone interested in that product. It answers routine product questions, qualifies the prospect, and saves a confirmed appointment to the CRM.” Select English, acknowledge the disclosure, and click **Start conversation**. |
| 0:25–0:50 | Click **Speak a turn**, say “What does your voice agent do?”, then click **Send voice turn**. Point to the transcript, spoken reply and **FAQ-02**. If a provider is slow, type the exact same question. “The assistant retrieved the product overview and shows its source.” |
| 0:50–1:30 | Say or type “We need an agent to answer inbound product inquiries.” Then “We have 12 people.” Then “We want to start in 30 days.” Point to the assistant’s recap and the **Qualified** reason. “It carried the use case and team size forward.” |
| 1:30–2:20 | Say or type “Show available demo slots.” Choose the first time. Read the exact date and timezone shown. “That is the slot I want.” Click the matching **Confirm** button. “The model does not write the booking. The server validates the confirmation against the stored offer and commits it with the lead and timeline.” |
| 2:20–3:00 | Reload the browser, then click **Refresh LeadPulse**. Show the booking reference, the reason, the next action and the completed LeadPulse conversation. “This is a fresh read from LeadPulse. The same confirmation is safe to retry, and a second prospect cannot take that slot.” |

Backup dialogue: “Does it work on Mars?” The unsupported answer demonstrates the retrieval boundary. For a Hindi clip use “कीमत क्या है?” and show the source or, if the provider check is incomplete, demo the typed Hindi flow and state that scope.

## 60-second pitch

“Small sales teams lose time answering repeat questions and passing incomplete notes between people. FlowDesk is a browser voice assistant for the first discovery conversation. It gives a sourced product answer, remembers what the prospect said, and tells the sales team why the lead is qualified. It offers real slots from a local schedule and saves an appointment only after the prospect confirms the exact time. I reused RapidX's voice adapters and LeadPulse's authenticated CRM and timeline. For Round 3 I built the sales session, FAQ retrieval, qualification rules, confirmation flow, transactional booking and verification. I can refresh the page and pull back a real booking and call summary. The next business check is whether this shortens first response and increases attended qualified appointments.”

## Trace the code

1. **Microphone to transcript** · `rapidx/dashboard/public/assets/sales.js`, `recordTurn()`, records a bounded browser MediaRecorder clip. `POST /api/stt` maps in `rapidx/dashboard/server.js` to `apiStt()`. The Deepgram adapter in `rapidx/dashboard/lib/providers.js` transcribes using the selected language, `en` or `hi`. The written turn takes the same route from the transcript onward.
2. **Meaning and response** · `act()` calls `POST /api/sales/action`. In `rapidx/dashboard/lib/sales/session.js`, `turn()` first handles slot intents and product questions, then updates the bounded profile. `retrieve()` ranks the JSON catalog by phrase matches. Groq uses catalog facts and recent turns to answer and the rules own qualification and action gating. `speak()` posts the final reply to RapidX's existing Rumik endpoint and plays the WAV through browser Web Audio.
3. **Confirmation to storage** · `act()` sends an explicit `confirm` with the displayed slot ID. `session.js` checks the proposal, computes a summary, and calls `lib/sales/crm.js`. The connector signs in server-side and posts to LeadPulse's `/api/v1/sales-demo/runs`. `leadpulse/src/modules/sales-demo/sales.routes.ts` checks the account, slot, and session and writes `SalesRun`, `Lead`, `Conversation`, and `Activity` atomically. `refreshSaved()` rereads the record and timeline from the same PostgreSQL database.

## Three live modification drills

| Drill | Where to edit | Verification |
|---|---|---|
| Raise minimum qualified team size from five to ten | `rapidx/dashboard/lib/sales/session.js`, `qualify()`. Change the threshold and both reason strings. | Restart RapidX. A team of 8 is **Nurture**, 12 is **Qualified**, with a 30-day rollout. |
| Add an FAQ about data export | `rapidx/dashboard/lib/sales/faq.json`. Add a unique ID and English/Hindi keywords and passages. | Restart RapidX. Ask “Does FlowDesk support export?” and verify the new source appears. Ask about an unrelated product and verify the unsupported response. |
| Diagnose a timeout or booking conflict | `rapidx/dashboard/public/assets/sales.js`, `recordTurn()`; `rapidx/dashboard/lib/providers.js` for per-turn STT; `leadpulse/src/modules/sales-demo/sales.routes.ts` for writes and conflict handling. | For a voice timeout, inspect `/api/stt` in Chrome Network and use the typed fallback. For a conflict, propose the same slot in two distinct sessions, confirm in both, and show the first saves while the second must refresh availability. |

## Likely interview questions

- **Why two services?** RapidX owns media and the conversational UI. LeadPulse owns CRM data and the transaction. The integration is a single server-side authenticated connector.
- **Why a per-turn clip?** The earlier streaming WebSocket sometimes timed out. A bounded HTTP audio clip makes the demo repeatable. Streaming and interruption handling would improve responsiveness in production.
- **What makes this RAG?** The API selects a relevant passage and inserts it into the model request. Lexical ranking prioritizes relevant facts and the small catalog lets the model cover natural paraphrases. The cited IDs are returned to the UI. There is no vector database in the prototype.
- **What does the model decide?** Groq phrases an FAQ answer. Deterministic server rules capture supported fields, qualify the lead and authorize booking after confirmation. The LLM has no database credentials or tools.
- **How do you handle uncertainty?** With incomplete profile fields, show **Needs review**. A missing FAQ yields an explicit answer gap. A model outage shows the source passage directly. Unsupported compound queries may need a salesperson.
- **What if a CRM write fails halfway?** PostgreSQL rolls back all writes. Retrying with the same session ID either commits once or replays the saved result.
- **How are tenant boundaries enforced?** The RapidX auth context scopes session and saved-run reads. The connector is dedicated to this local instance. Production requires tenant-aware authorization and database RLS.
- **How would you scale to 100,000 registered users?** Separate regional media workers and stateless sales APIs, use Redis for short-lived shared state, pool Postgres connections, and move CRM/calendar sync and analytics to workers. Plan for quotas and test bursts with simulated speech.
- **What will this cost?** The example assumes $0.035 variable spend per voice minute, plus an infrastructure budget. Track cost per attended qualified appointment and audit usage before assigning final rates.
