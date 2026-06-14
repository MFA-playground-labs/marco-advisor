# Spec Review Checklist

Use this checklist before implementation starts.

## Completeness

- [ ] The problem is stated in user or operational terms.
- [ ] Goals and non-goals are explicit.
- [ ] Current behavior is linked to the catalog.
- [ ] Proposed behavior is decision-complete enough for implementation.
- [ ] Data, API, UI, and workflow contracts are all addressed.
- [ ] Failure modes are named.
- [ ] Open questions are resolved or marked as assumptions.

## Verification

- [ ] Every acceptance criterion maps to a test, manual verification step, or explicit product decision.
- [ ] Test plan covers unit, workflow, route/API, UI/manual, and regression scenarios where relevant.
- [ ] Existing tests that should be updated are identified.
- [ ] New behavior has at least one happy-path verification and one failure-path verification.

## Safety

- [ ] Supabase RLS/ownership impact is documented.
- [ ] Storage access impact is documented when uploads or files are involved.
- [ ] Environment variable impact is documented.
- [ ] Backward compatibility and migration requirements are documented.
- [ ] User-visible error behavior is documented.

## Handoff

- [ ] The implementer should not need to make product decisions.
- [ ] The spec names likely source areas without requiring unrelated refactors.
- [ ] Deferred decisions are listed as assumptions or follow-ups.
- [ ] Runtime behavior is unchanged until implementation work begins.
