# FlowDesk Sales Assistant
**Fortivex AI Round 3 · Project 1 · OC.44671.2027.65164**

## Business problem and customer

Small B2B software sales teams spend time answering repeated product questions, collecting incomplete lead details, and manually moving notes into a CRM. Prospects who contact the business outside working hours may wait until the next day. FlowDesk is a fictional company selling a voice agent for inbound sales. Its browser demo lets prospects ask what the product offers and hands sales teams an appointment with usable context.

## Workflow and implementation

A prospect acknowledges the demo disclosure, selects English or Hindi, and speaks or types. RapidX records each spoken turn in the browser, transcribes it through Deepgram, and sends the transcript to a server-side sales session. The session keeps the prospect’s use case, team size, rollout timeline, language, and proposed slot. Keyword ranking prioritizes a bilingual product catalog. Groq uses those facts and recent turns to answer natural follow-up questions. The interface shows the cited entries. Unsupported questions receive an explicit knowledge-gap response. Rumik synthesizes the reply. Qualification uses visible rules and routes incomplete profiles for human review.

Booking is a separate server action. LeadPulse reads actual local availability from PostgreSQL. The prospect confirms the displayed date, time, and timezone. A single transaction writes the appointment reference, lead, completed conversation and timeline activity. A session identifier makes a repeated confirmation safe, and a unique slot constraint prevents two prospects booking the same time. Reloading the browser retrieves the stored summary and CRM activity.

## Reuse and individual contribution

RapidX supplied the voice adapters and browser capture pattern. LeadPulse supplied JWT authentication, Prisma models for leads and conversations, and the timeline service. The Round 3 work connects those components with a FlowDesk interface, session and qualification rules, FAQ retrieval, atomic booking, synthetic seeds, and an integration test. The demo uses per-turn transcription to work around a prior streaming timeout and keeps typed input available.

## Commercial case and scale

The immediate value is faster first response and more qualified appointments with a clear next action. Measure appointment conversion and manual handling time against a control group. For 100,000 registered users with 10,000 monthly active users and two three-minute calls each, plan for 60,000 voice minutes monthly. At an illustrative $0.035 per minute, variable provider cost is $2,100 per month before infrastructure or telephony. At scale, shared session storage, stateless APIs, provider quotas, pooled databases and asynchronous jobs would replace the single-laptop setup. This prototype uses local booking and short-lived memory. Production telephony, external calendars and long-term customer memory remain future work.
