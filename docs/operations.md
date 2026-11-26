# Security, operations, and costs

## Local evaluation

Both Node services and the development database and Redis are bound to the laptop's loopback interface by the launcher and Compose. RapidX reuses its browser session cookie, session checks, origin checks and API rate limiting. Its connector signs in as a dedicated synthetic LeadPulse manager and keeps the short-lived JWT server-side. Sales run reads use the authenticated RapidX tenant and user scope; the CRM trusts the designated connector within this dedicated demo instance. LeadPulse stores a summary and timeline activity, and the timeline projection excludes password hashes. The rest of the inherited dashboard is outside the demo scope.

The start disclosure identifies Deepgram, Groq and Rumik and requires acknowledgment before sales capture. Audio is held in browser memory for transcription and not written by the prototype. Session transcripts and consented email drafts expire with the conversation after 30 minutes of inactivity. With Redis enabled, session data can survive a Node restart. Finalized names and consented emails are stored on the LeadPulse lead. The sales transcript and selected audio are sent only as needed for the chosen providers. The saved summary may still contain what a prospect volunteers, so use synthetic details. Provider processing and retention follow their account settings. Reset the demo after evaluation. Provider keys, JWT secrets, demo credentials and the CRM password belong only in the ignored `.env` file.

## Implemented reliability controls

- The browser streams audio to a bounded same-origin Deepgram WebSocket and keeps the recording available for authenticated HTTP transcription if that stream fails. Rumik streaming falls back to HTTP WAV if the stream fails before playback. Once streaming audio has played, a failed stream keeps the written reply available and avoids repeating the whole answer.
- Catalog answers must cite valid entries. USD prices stated in a generated answer must appear in those cited entries. This check covers explicit dollar amounts; broader claim quality is evaluated separately.
- The browser can pause audio, switch to typing, review a transcript, end an unsaved conversation, and restore a session after refreshing. Spoken confirmation is valid only for a pending offer. Redis leases serialize turns for an account, and a recent request ID replays a successful action without a duplicate write.
- LeadPulse derives each tenant's demo slots from the seed schedule using separate slot IDs. New writes and reads check the tenant and use the existing atomic booking transaction. Legacy runs use their original account scope. The shared LeadPulse connector remains a privileged, trusted service identity inside the private network.
- Enable `FLOWDESK_TIMING_LOG=1` for structured timing of STT, TTS, catalog responses and booking saves. The UI shows transcript, reply and time-to-playable-audio timings for the prospect’s turn. Log events omit transcripts, provider response bodies and contact details. Use `FLOWDESK_INVITE_ONLY=1` to disable open signup. Pipe the captured server output into `node scripts/summarize-voice-timings.cjs` to get per-stage p50, p95 and outcome counts. A Windows rehearsal can capture logs with `node scripts/control.cjs start | Tee-Object -FilePath flowdesk.log`, then analyze them with `Get-Content flowdesk.log | node scripts/summarize-voice-timings.cjs`.
- A new install starts with the bundled demo configuration. Replace demo credentials and seed calendar templates before serving real prospects. This app still uses RapidX's single-instance authentication store. Standardize shared authentication, provision tenant calendars explicitly, and use a scoped service identity before running multiple public replicas.

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
