# Marco Feature Specs

This directory turns the current-state catalog in [docs/specification-catalog.md](../docs/specification-catalog.md) into a repeatable specification-driven development motion.

Use specs in this order:

1. Read the current-state catalog sections that relate to the feature.
2. Start from [_templates/feature-spec.md](_templates/feature-spec.md).
3. Fill every required section before implementation begins.
4. Run the [_templates/spec-review-checklist.md](_templates/spec-review-checklist.md).
5. Implement only after open questions are resolved or explicitly marked as assumptions.
6. Update the feature spec and catalog when implementation changes current behavior.

## Spec Types

- **Current-state catalog:** `docs/specification-catalog.md` describes how the app works today.
- **Feature specs:** `specs/features/*.md` describe intended future behavior before code changes.
- **Archived specs:** `specs/archive/*` preserves implemented, superseded, deferred, or retired specs that are not active implementation targets.
- **Templates/checklists:** `specs/_templates/*` standardize new feature specs and review.

## Current Catalog Anchors

- [Data and RLS contract](../docs/specification-catalog.md#4-persistent-data-contract)
- [API route specifications](../docs/specification-catalog.md#5-api-route-specifications)
- [Server workflow specifications](../docs/specification-catalog.md#6-server-workflow-specifications)
- [Repository contract](../docs/specification-catalog.md#7-repository-contract)
- [Domain function specifications](../docs/specification-catalog.md#8-domain-function-specifications)
- [UI surface specifications](../docs/specification-catalog.md#9-ui-surface-specifications)
- [Test coverage map](../docs/specification-catalog.md#10-test-coverage-map)
- [Open specification gaps](../docs/specification-catalog.md#11-open-specification-gaps)

## Active Feature Specs

- [Extraction Pipeline Reliability](features/extraction-pipeline-reliability.md)

Archived feature history lives in [specs/archive](archive/README.md).

## Page-Organized Specs

Page specs organize feature work around the screens users actually use. Start at [pages/README.md](pages/README.md), then open the page folder that owns the workflow you are changing.

- [Dashboard](pages/dashboard/README.md)
- [Bookings](pages/bookings/README.md)
- [Upload](pages/upload/README.md)
- [Pipeline](pages/pipeline/README.md)
- [Scanner](pages/scanner/README.md)
- [Timeline](pages/timeline/README.md)
- [Itinerary](pages/itinerary/README.md)
- [Settings](pages/settings/README.md)

## Working Rules

- A feature spec is not ready for implementation until every acceptance criterion maps to a test, manual verification step, or explicit product decision.
- Active README files should list only current implementation targets; completed or superseded specs should move to `specs/archive/`.
- Open questions should be resolved before implementation. If a question is intentionally deferred, mark it as an assumption with an owner or follow-up.
- Specs should name user-visible behavior, data/API changes, failure modes, and verification. They should not prescribe incidental code style unless it prevents ambiguity.
- Documentation-only spec work must not change runtime behavior.
