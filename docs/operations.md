# Security, operations, and costs

## Local evaluation

Both Node services and the development database and Redis are bound to the laptop's loopback interface by the launcher and Compose. RapidX reuses its browser session cookie, session checks, origin checks and API rate limiting. Its connector signs in as a dedicated synthetic LeadPulse manager and keeps the short-lived JWT server-side. Sales run reads use the authenticated RapidX tenant and user scope; the CRM trusts the designated connector within this dedicated demo instance. LeadPulse stores a summary and timeline activity, and the timeline projection excludes password hashes. The rest of the inherited dashboard is outside the demo scope.

The start disclosure identifies Deepgram, Groq and Rumik and requires acknowledgment before sales capture. Audio is held in browser memory for transcription and not written by the prototype. In-session transcript is temporary. The saved summary may still contain what a prospect volunteers, so use synthetic details. Provider processing and retention follow their account settings. Reset the demo after evaluation. Provider keys, JWT secrets, demo credentials and the CRM password belong only in the ignored `.env` file.

## Production design and failure recovery

Use managed HTTPS with HSTS, secure cookies, a private API subnet, database TLS, encryption at rest and a managed secret store. Enforce per-user and tenant permissions in the API and database. Limit audio duration, request bytes, concurrent sessions, model tokens and per-tenant spend. Rotate service credentials, redact logs, reject untrusted instructions in retrieval inputs, and keep the model away from write credentials. Require separately recorded, jurisdiction-appropriate consent before storing any real call recording. Start with no audio retention, 30-day transcript deletion and configurable summary retention, subject to customer policy and legal review. Include data export/deletion and audit entry retention.

Add provider-specific timeout and error metrics, failed booking and outbox rates, database connection windows and alarms for missed delivery. Use daily backups with point-in-time recovery, practice restores, and replay queued work by stable identifiers. If a provider is down, let the user type or request a human follow-up. If CRM is down, preserve in-session confirmation context and report a failed save. A successful booking write should have a durable reference. External calendar synchronization requires an outbox worker and a reconciliation screen for remote conflicts.

## Illustrative unit economics

These are **planning assumptions**, not vendor quotes or measured bills. USD, connected call minute:

| Component | Assumption | Cost / minute |
|---|---|---:|
| STT | One connected minute at $0.010 per minute | $0.010 |
| LLM | 1,000 billed tokens at a blended $10 per million | $0.010 |
| TTS | 300 synthesized characters at $50 per million | $0.015 |
| **Variable total** | Excludes phone carrier and tax | **$0.035** |

At 60,000 minutes per month, variable provider cost is **$2,100**. Assuming $700 for regional compute, managed databases, logs, and network, the modeled total is **$2,800/mo**, or about **$0.14 per three-minute call**. Actual turn length, provider tariffs, retry rates, region and intent mix change both costs. Deduplicate requests and cap output audio to control overruns. Compare the fully loaded cost per qualified appointment with manual intake. At an assumed 20% appointment conversion, $0.14 per call implies **$0.70 per booked appointment** before staffing, acquisition or external calendar/telephony fees. Validate against booking attendance and downstream conversion before claiming savings.
