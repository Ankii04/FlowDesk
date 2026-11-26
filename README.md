# FlowDesk Sales Assistant

Individual prototype for Fortivex AI Round 3, **Project 1 · Autonomous AI Sales Voice Agent**.

FlowDesk is a fictional company selling an AI voice agent for inbound B2B sales. The demo assistant introduces that product, answers natural sales questions from a product catalog in English, Hindi and Kannada, and books a discovery appointment after explicit confirmation. It saves the appointment and a structured summary in LeadPulse so a salesperson can follow up with context.

- [One-page project report](REPORT.md) · [Print-ready report](REPORT.pdf)
- [Architecture and 100,000-user design](docs/architecture.md) · [Security, deployment, and costs](docs/operations.md)
- [Source audit, feature coverage, and verification](docs/verification.md) · [Changed files](docs/changed-files.md)
- [Three-minute demo, pitch, and interview prep](docs/round3-demo.md)
- [Third-party source and attribution](THIRD_PARTY.md)

## Windows setup

Install **Node.js 24 LTS with npm** and **Docker Desktop**. Start Docker Desktop in Linux-container mode. Git is useful for submission and optional for starting an extracted ZIP. In a fresh PowerShell window check `node --version`, `npm.cmd --version`, and `docker compose version`. If npm is missing, install the official Node.js LTS distribution with npm and reopen PowerShell. Stop your old RapidX process on port 8787.

Save `AI-voice-agent.zip` to Downloads and extract it to your Desktop. The archive already contains the `AI-voice-agent` folder. The Windows Desktop path below also works when redirected to OneDrive.

```powershell
$desktop = [Environment]::GetFolderPath('Desktop')
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\AI-voice-agent.zip" -DestinationPath $desktop
Set-Location (Join-Path $desktop 'AI-voice-agent')
node scripts/control.cjs setup
node scripts/control.cjs login
node scripts/control.cjs start
```

Setup creates the ignored root `.env`, generates separate local demo and CRM credentials, and copies **only** Deepgram, Groq and Rumik keys from `%USERPROFILE%\rapidx-voice-agent-stack\.env` if available. It starts PostgreSQL and Redis, installs dependencies, applies the LeadPulse migrations, builds LeadPulse and seeds future slots. PostgreSQL and Redis are isolated from the older project's volumes. If provider keys were not copied, edit the root `.env` and restart. Keep Groq on `openai/gpt-oss-20b` unless your account requires a different model. Keep the PowerShell server window open.

| Service | Local endpoint | Purpose |
|---|---|---|
| RapidX | [FlowDesk demo](http://localhost:8787/sales.html) | Browser, session logic, FAQ retrieval, voice APIs |
| LeadPulse | [Health](http://127.0.0.1:3100/health) | JWT-authenticated CRM and booking API |
| PostgreSQL | 127.0.0.1:5434 | Leads, timeline, summaries, bookings and availability |
| Redis | 127.0.0.1:6381 | Short-lived FlowDesk conversation recovery and LeadPulse queue infrastructure |

### Demo

1. Open **FlowDesk demo**, sign in with the local demo credentials printed by `node scripts/control.cjs login`, choose English, and acknowledge the disclosure.
2. Uncheck **Speak replies** for a typed-only backup. With it checked, use **Speak a turn**. With **Auto-listen** enabled, pause at the end of a turn to send it. With manual recording, click **Send voice turn**. **Review voice transcript before sending** lets you correct names and numbers. **Interrupt reply** stops playback, and **Switch to typing** stops recording and focuses the text field.
3. Ask **“What does your voice agent do?”** and point out **FAQ-02**. Follow with **“Can it speak Hindi and save leads to our CRM?”** or **“What is the price?”**. The demo price is illustrative. Give a use case, **12 people**, and **30 days**. The assistant repeats those earlier details and shows the qualification reason.
4. Say **“Show available demo slots”**, say **“Slot 1”** or choose a time. After the agent reads back the exact time, say **“Confirm booking”** or click **Confirm**. An optional contact email can be saved with consent. The UI shows the booking reference and LeadPulse timeline.
5. Reload the page and click **Refresh LeadPulse**. The record is fetched from LeadPulse using the saved reference.

### Update an existing checkout

Stop the running services with **Ctrl+C**. From the updated repository root, run `node scripts/control.cjs setup` again to install the Redis client and apply the tenant calendar migration, then run `node scripts/control.cjs start`. The launcher uses local Redis by default. Set `FLOWDESK_REDIS_URL` to override it or use `FLOWDESK_MEMORY_ONLY=1` with a blank Redis URL for an isolated demo. Memory-only mode loses open conversations when the Node process restarts.

### Reset and verification

Stop the servers with **Ctrl+C**. Leave the database running, then execute these commands from the project root.

```powershell
node scripts/control.cjs reset
node scripts/control.cjs start
```

Reset clears only the dedicated Fortivex sales tables and tagged synthetic leads, then seeds future availability. The browser may remember a deleted reference. A new saved run replaces it. Use a separate terminal to run the HTTP workflow checks on a fresh set of synthetic slots. The check intentionally reserves one slot and saves another no-booking timeline.

```powershell
node scripts/verify-sales-conversation.cjs
node scripts/benchmark-sales.cjs 50
node --env-file=.env scripts/verify.cjs
```

The benchmark measures synthetic, in-process sales logic. Use the **Turn timings** panel for a voice rehearsal. Run `docker compose down` after evaluation to stop infrastructure while retaining data. The printable report and standalone architecture diagrams can be opened without running the app.

### Troubleshooting

- **localhost refused** · Check the server terminal and ensure this project owns port 8787. Run the app on the same laptop as the browser.
- **Old screen or wrong login** · Open `/sales.html`, use the generated **browser** login and refresh the page. The CRM service account runs only on the server.
- **Deepgram timeout** · FlowDesk uses RapidX's per-turn HTTP route. Try a full sentence, verify the laptop has an internet connection to Deepgram, and use **Type a turn** to keep demonstrating the same workflow.
- **No audio or no microphone** · Use Chrome or Edge, permit the site microphone, check the selected Windows input/output and **Speak replies**, and confirm Rumik is reachable. A written reply with a playback error means the sales logic ran.
- **Cannot save or conflict** · Check the LeadPulse health URL. Retry the same confirmation after LeadPulse returns. If the slot was claimed by another session, ask for fresh slots.
- **Docker not available** · Start Docker Desktop locally and retry setup. The Windows launcher uses Docker Compose for PostgreSQL and Redis.

## Source and submission

RapidX provides authentication, browser audio patterns, rate limiting and provider adapters. LeadPulse provides JWT authentication, the existing lead/conversation/activity data model, and the timeline service. Round 3 additions are the FlowDesk view, conversation rules, FAQ corpus, authenticated service connector, booking transaction, migrations, seeds, launcher, verification script, and documentation. The existing working checkout remains independent. To prepare a GitHub submission from an extracted copy, initialize a local branch with `git init -b fortivex-round3`, review `git status --short --ignored`, and verify **REPORT.md is at the root**. The ZIP contains source and documentation. External publishing requires authorization.
