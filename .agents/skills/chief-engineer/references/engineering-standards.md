# Engineering Standards

Use this reference as a calibration checklist. Apply the relevant sections; do not turn every small task into a ceremony.

## Product And Scope

- Tie the change to a user, operator, or business outcome.
- Prefer a vertical slice over a broad platform rewrite.
- Make assumptions explicit when they affect UX, data contracts, cost, or operations.
- Preserve momentum: choose the simplest design that can survive the next plausible round of product learning.

## Maintainability

- Follow local patterns before introducing new ones.
- Keep modules cohesive: domain rules in domain/server layers, framework glue at the edges.
- Prefer explicit data shapes, named helpers, and small pure functions for business logic.
- Avoid hidden coupling through global mutable state, implicit environment behavior, or duplicated constants.
- Delete dead paths when safe; do not leave parallel implementations without a migration reason.
- Add comments only for non-obvious intent, invariants, or operational constraints.

## Clarity And Concision

- Make the happy path easy to read and the failure path easy to inspect.
- Use precise names that encode domain meaning rather than implementation trivia.
- Avoid abstractions that only wrap one call site unless they name a real concept or isolate volatility.
- Keep functions short enough that inputs, decisions, side effects, and outputs are visible.
- Prefer structured validation over scattered boolean checks.

## Scalability

- Identify expected cardinality, concurrency, data growth, latency budget, and fan-out.
- Push filtering, pagination, and aggregation to the right layer.
- Avoid N+1 queries, unbounded loops, unbounded payloads, and synchronous work in request paths when it can grow.
- Make external side effects idempotent when retries or duplicate events are possible.
- Use queues, jobs, caching, or denormalization only when the current bottleneck or near-term growth justifies it.
- Check database indexes, ownership filters, and migration safety for query or schema changes.

## Observability

- Instrument meaningful boundaries: incoming requests, background jobs, external services, state transitions, and irreversible actions.
- Prefer structured logs with stable event names and contextual IDs.
- Record enough context to debug without logging secrets, raw credentials, sensitive personal data, or large payloads.
- Expose or preserve metrics for latency, throughput, error rate, retry count, queue depth, and business-critical state changes when relevant.
- Make errors actionable: include cause, attempted operation, safe identifiers, and next diagnostic step.
- Ensure swallowed errors are intentional and visible through logs, metrics, or user-facing state.

## Reliability

- Define behavior for invalid input, empty data, partial success, timeout, cancellation, and retry.
- Keep writes transactional where consistency matters.
- Make background workflows resumable or idempotent when practical.
- Avoid irreversible work before validation and authorization.
- Include rollback or recovery notes for migrations, data rewrites, and contract changes.
- Fail closed for security and data ownership decisions.

## Security

- Treat all client input, webhook payloads, file contents, and third-party responses as untrusted.
- Keep secrets server-only; never expose service-role keys or privileged tokens to browser bundles.
- Enforce authorization close to the data access layer as well as at route boundaries.
- Validate ownership filters on every read/write path that touches tenant or user data.
- Avoid logging secrets, auth headers, tokens, full webhook bodies, or sensitive personal data.
- Check SSRF, injection, path traversal, unsafe redirects, and deserialization risks when handling URLs, queries, files, or dynamic execution.

## Testing

- Match test depth to blast radius.
- Cover domain decisions with fast unit tests.
- Cover route handlers, workflows, and repository code with focused integration-style tests when behavior spans boundaries.
- Include regression tests for bug fixes.
- Test unhappy paths that users or operators will actually encounter.
- Avoid brittle snapshots unless the rendered contract is genuinely important.

## API And Data Contracts

- Keep request and response contracts explicit.
- Version or migrate contracts when clients may depend on old behavior.
- Normalize data at boundaries; keep internal types clean.
- Ensure timestamps, currency, locale, and timezone behavior is intentional.
- Prefer additive schema changes; split risky migrations into expand/backfill/contract phases.

## Frontend Product Quality

- Build the actual workflow as the first screen for tools and apps.
- Keep interaction states complete: loading, empty, error, disabled, success, and permission-limited states.
- Ensure controls are keyboard-accessible and text fits at mobile and desktop sizes.
- Keep dense operational UI scannable; avoid decorative structure that slows repeated use.
- Avoid duplicating domain thresholds or business rules in UI components.

## Delivery Hand-Off

- Summarize what changed in behavior, not just files touched.
- List verification commands and results.
- Name residual risks, follow-up migrations, or monitoring needs.
- If a risky path was intentionally deferred, explain why it is acceptable now.
