# Architecture Standards

Use these standards to review or design product architecture. Apply the relevant sections; do not turn small changes into unnecessary ceremony.

## Product Alignment

- Tie the architecture to a user outcome, business constraint, operational need, or product learning goal.
- Keep the solution as small as possible while preserving a credible path to the next expected scale.
- Make goals, non-goals, assumptions, and constraints explicit.
- Prefer reversible decisions when product direction is uncertain.
- Identify who owns the workflow operationally after launch.

## Boundaries And Modularity

- Define clear responsibilities for routes, UI, domain logic, workflows, repositories, and external integrations.
- Keep domain rules out of transport, view, and persistence glue.
- Avoid circular dependencies, hidden shared state, duplicated business rules, and broad utility modules without ownership.
- Introduce new abstractions only when they isolate volatility, name a real domain concept, or reduce meaningful coupling.
- Treat module boundaries as product boundaries when they affect team velocity or future feature work.

## Data Ownership And Flow

- Identify the source of truth for every important entity and state transition.
- Define who can read, write, mutate, backfill, delete, or export data.
- Keep ownership filters and tenant/user boundaries close to data access.
- Make derived data, denormalized data, and cached data traceable to source data.
- Define data lifecycle expectations: creation, updates, retries, retention, archival, deletion, and auditability.

## APIs And Contracts

- Keep request, response, event, and webhook contracts explicit.
- Prefer additive contract changes when existing clients or jobs may depend on current behavior.
- Validate input at system boundaries and normalize before internal use.
- Define idempotency, retry behavior, pagination, ordering, timestamp, locale, and timezone expectations when relevant.
- Include versioning or migration strategy for contracts that may change independently.

## Integrations

- Treat external systems as unreliable and contract-drifting.
- Define authentication, authorization, rate limits, timeout behavior, retries, backoff, idempotency keys, and duplicate delivery handling.
- Separate third-party payload shapes from internal domain shapes.
- Capture enough integration state to debug failures and safely replay when appropriate.
- Avoid putting slow or fragile external calls on critical request paths unless the product requires it.

## Async Workflows

- Define workflow ownership, trigger source, state machine, retry policy, cancellation behavior, and terminal states.
- Make jobs resumable or idempotent when duplicate events, retries, or crashes are possible.
- Preserve user-visible status for long-running work.
- Avoid irreversible side effects before validation and authorization.
- Include poison-message, timeout, and partial-failure behavior.

## Scalability And Performance

- Name expected growth dimensions: users, tenants, records, file sizes, jobs, concurrency, fan-out, and latency targets.
- Avoid unbounded queries, payloads, loops, queue growth, and synchronous fan-out.
- Use pagination, filtering, indexing, batching, caching, or background work based on observed or near-term bottlenecks.
- Keep hot paths simple and measurable.
- Choose scale mechanisms that match startup reality before adding distributed complexity.

## Reliability

- Define behavior for empty data, invalid input, dependency failure, timeout, retry exhaustion, partial success, and recovery.
- Keep critical writes transactional where consistency matters.
- Design rollback or compensation for migrations and irreversible actions.
- Fail closed for security and data ownership decisions.
- Make degraded modes explicit when full functionality is unavailable.

## Security And Privacy

- Treat client input, files, webhooks, third-party responses, and generated content as untrusted.
- Keep privileged secrets and service-role capabilities server-only.
- Enforce authorization at route/workflow boundaries and near data access.
- Avoid logging secrets, credentials, raw tokens, sensitive personal data, or large payloads.
- Check injection, SSRF, path traversal, unsafe redirects, insecure deserialization, and privilege escalation risks when relevant.
- Define audit requirements for sensitive data access or privileged operations.

## Observability

- Define what operators need to know when the system is slow, failing, stuck, or producing wrong business outcomes.
- Use stable event names and correlation identifiers across requests, jobs, integrations, and state transitions.
- Capture latency, throughput, error rate, retry count, terminal states, queue depth, and integration failure reasons when relevant.
- Make alerts actionable and tied to user or business impact.
- Ensure logs are useful without exposing secrets or sensitive data.

## Cost And Operational Load

- Identify cost drivers: compute, storage, database load, external APIs, model calls, queue volume, and human operations.
- Prefer designs that reduce manual recovery and support safe replay or repair.
- Avoid permanent platform commitments before the product need is validated.
- Call out monitoring, runbooks, feature flags, and migration cleanup that operators will need.

## Migration And Governance

- Prefer expand/backfill/contract phases for risky schema or contract changes.
- Define compatibility windows and cleanup checkpoints.
- Record important architecture decisions with context, tradeoffs, and consequences.
- Track architecture debt separately from implementation cleanup when it affects product velocity or reliability.
- Review decisions again when scale, team shape, product direction, or vendor constraints materially change.
