# Round 3 file changes

| Area | Relevant files |
|---|---|
| Demo entry and UX | `rapidx/dashboard/public/sales.html`, `rapidx/dashboard/public/assets/sales.js`, `rapidx/dashboard/public/assets/sales.css` |
| FAQ, session and qualification | `rapidx/dashboard/lib/sales/faq.json`, `rapidx/dashboard/lib/sales/session.js` |
| Server-to-server CRM connector | `rapidx/dashboard/lib/sales/crm.js`, `rapidx/dashboard/server.js` |
| Provider routing and earlier patches | `rapidx/dashboard/lib/providers.js`, `rapidx/dashboard/public/assets/app.js`, `rapidx/dashboard/public/app.html`, `rapidx/dashboard/server.js` |
| LeadPulse booking and reads | `leadpulse/src/modules/sales-demo/sales.routes.ts`, `leadpulse/src/app.ts`, `leadpulse/src/modules/conversations/conversation.repository.ts` |
| Migrations and synthetic seed | `leadpulse/prisma/schema.prisma`, `leadpulse/prisma/migrations/20261126090000_sales_demo/migration.sql`, `leadpulse/prisma/sales-demo-seed.ts` |
| Entrypoint and launch setup | `leadpulse/package.json`, `leadpulse/src/server.ts`, `scripts/control.cjs`, `compose.yaml`, `.env.example`, `.gitignore` |
| Verification | `scripts/verify.cjs`, `docs/verification.md` |
| Evaluation materials | `README.md`, `REPORT.md`, `REPORT.pdf`, `docs/architecture.md`, `docs/operations.md`, `docs/round3-demo.md`, `rapidx/dashboard/public/architecture.html`, `rapidx/dashboard/public/assets/flowdesk-local.svg`, `rapidx/dashboard/public/assets/flowdesk-production.svg` |
| Reuse attribution | `THIRD_PARTY.md`, `leadpulse/LICENSE`; retained original `rapidx/LICENSE` |
