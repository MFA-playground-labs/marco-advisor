# Marco Advisor n8n Parser E2E

This test validates the deployed Marco Advisor upload pipeline against n8n and Supabase:

1. Marco accepts a test booking file.
2. Marco creates `uploads` and `extraction_jobs`.
3. Marco dispatches the job to n8n.
4. n8n fetches job/file metadata from Marco.
5. n8n posts the extraction callback to Marco.
6. Marco writes `upload_pages` and `extracted_booking_candidates`.
7. Optional: Marco accepts the candidate and creates `bookings` plus `booking_segments`.

## Required Environment

Set these locally or in `.env.local` before running the full test:

```bash
MARCO_BASE_URL=https://your-vercel-deployment.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
EXTRACTION_WEBHOOK_SECRET=...
N8N_EXTRACTION_TEST_WEBHOOK_URL=https://marco-advisor.app.n8n.cloud/webhook-test/f02c9c49-a8c5-46f2-880d-aab36bb7304c
```

The deployed Vercel app must also have:

```bash
N8N_EXTRACTION_WEBHOOK_URL=https://marco-advisor.app.n8n.cloud/webhook/f02c9c49-a8c5-46f2-880d-aab36bb7304c
EXTRACTION_WEBHOOK_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EXTRACTION_PROVIDER=n8n
EXTRACTION_FALLBACK_MODEL=claude-haiku
```

## Commands

Preflight only:

```bash
npm run e2e:n8n -- --mode=preflight
```

n8n test webhook smoke test:

```bash
npm run e2e:n8n -- --mode=webhook-test
```

n8n production webhook smoke test:

```bash
npm run e2e:n8n -- --mode=production-webhook
```

Full deployed E2E:

```bash
npm run e2e:n8n
```

Keep candidate in review instead of accepting it:

```bash
E2E_ACCEPT_CANDIDATE=false npm run e2e:n8n
```

## Two-Pass n8n Validation

Use the test URL first because it is visible in the n8n editor and easier to debug. Then activate the workflow and run the production webhook check. Production URLs only work when the workflow is active.

## Tradeoffs

- Vercel deployment is the preferred target because n8n cloud can reach it without tunnels.
- Local tunnels are useful for debugging but add callback URL churn and tunnel reliability risk.
- UI plus Supabase SQL verification is more reliable than UI-only checks because it proves row-level state.
- Test artifacts are intentionally labeled and retained so failed runs can be diagnosed from `/pipeline` and Supabase.
