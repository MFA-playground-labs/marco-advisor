# Solution Design Template

Use this template for meaningful features, workflow changes, integrations, migrations, and platform decisions. Keep sections concise, but do not omit decisions the implementer needs.

## Title

Name the product capability or architecture decision.

## Context

- What product or business problem is being solved?
- Who uses or operates this capability?
- What exists today?
- What constraints are known?

## Goals

- List the required product and technical outcomes.
- Include measurable success criteria when available.

## Non-Goals

- List adjacent work that should not be included.
- Call out deferred capabilities or intentionally excluded scale.

## Current State

- Describe relevant routes, modules, jobs, data models, integrations, and deployment assumptions.
- Name current pain points, coupling, risks, and observability gaps.

## Proposed Architecture

- State the recommendation first.
- Define system boundaries and responsibilities.
- Explain why this architecture fits the product stage and expected scale.
- Name alternatives considered and why they were rejected.

## System Boundaries

- Identify UI, API, server workflow, domain, repository, database, storage, and external integration responsibilities.
- Specify ownership for each important state transition.

## API And Data Contracts

- Define new or changed request, response, event, webhook, database, or file contracts.
- Include validation rules, ownership rules, compatibility expectations, and versioning if relevant.

## Data Flow

- Describe the happy path from user or trigger to final persisted/user-visible state.
- Describe async job flow, retries, deduplication, and terminal states when relevant.
- Identify source of truth and derived data.

## Failure Modes

- Define expected behavior for invalid input, empty data, auth failure, dependency failure, timeout, duplicate event, partial success, and retry exhaustion.
- Include rollback, replay, or manual recovery paths when needed.

## Security And Privacy

- Define trust boundaries, authorization checks, secret handling, data exposure rules, audit needs, and sensitive logging constraints.
- Identify relevant injection, SSRF, path traversal, unsafe redirect, file handling, or privilege escalation risks.

## Observability

- List logs, metrics, traces, audit records, status fields, dashboards, and alerts needed to operate the feature.
- Include correlation identifiers and event names when useful.

## Rollout And Migration

- Define implementation sequence, feature flags, compatibility windows, data migrations, backfills, cleanup, and rollback strategy.
- State whether the rollout is reversible.

## Testing And Acceptance Criteria

- List domain, integration, route, workflow, UI, migration, and failure-path tests that matter.
- Include acceptance criteria an implementer can verify before handoff.

## Open Risks

- List unresolved questions, architectural risks, product dependencies, operational risks, and follow-up decisions.
- Assign a recommended default for each risk when progress should continue.

## Decision Log

- Record the key architecture decisions, tradeoffs, and consequences.
- Include decisions that future engineers are likely to revisit.
