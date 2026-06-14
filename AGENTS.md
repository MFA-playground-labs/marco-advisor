# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router application for Marco Advisor. Route handlers and pages live in `app/`, with protected app pages under `app/(app)/` and API routes under `app/api/`. Shared UI components live in `components/`. Core TypeScript modules live in `lib/`: domain logic in `lib/domain/`, server workflows and Supabase repository code in `lib/server/`, and generated Supabase types in `lib/database.types.ts`. Tests live in `tests/` and follow `*.test.ts`. Supabase schema is managed through `supabase/migrations/`. Product and implementation specs live in `specs/`, while supporting operational docs live in `docs/`.

## Build, Test, and Development Commands

- `npm run dev`: start the local Next.js development server.
- `npm run build`: create a production build and validate route/page compilation.
- `npm run start`: run the production build locally.
- `npm run typecheck`: run TypeScript with `tsc --noEmit`.
- `npm run test`: run the Vitest suite once.
- `npm run e2e:n8n`: run the n8n parser script in `scripts/`.
- `npm run supabase:start`: start Supabase services.
- `npm run supabase:types`: regenerate local database types into `lib/database.types.ts`.

## Coding Style & Naming Conventions

Use TypeScript, React Server Components by default, and client components only when browser state or events are required. Match the existing style: two-space indentation, double quotes, semicolons, named exports for helpers/components, and concise domain functions. Prefer structured domain helpers in `lib/domain/` over duplicating thresholds or validation logic in UI files. Keep route handlers thin and delegate workflow behavior to `lib/server/workflows/`.

## Testing Guidelines

Vitest is the test framework. Add focused tests beside related coverage in `tests/`, using names like `workflows.test.ts` or `extraction-job-route.test.ts`. Cover domain helpers, workflow state transitions, route error branches, and source-level UI contracts when no component harness exists. Run `npm run test`, `npm run typecheck`, and `npm run build` before handing off substantial changes.

## Commit & Pull Request Guidelines

Prefer short imperative commit subjects. Existing history commonly uses Conventional Commit style, such as `feat: enhance pipeline page...`; use `feat:`, `fix:`, `docs:`, or `test:` where appropriate. Pull requests should include a brief behavior summary, linked spec or issue when relevant, test results, and screenshots for visible UI changes.

## Security & Configuration Tips

Do not expose service-role keys in client code. Keep public Supabase values in `NEXT_PUBLIC_*` variables only, and server-only secrets such as `SUPABASE_SERVICE_ROLE_KEY`, `EXTRACTION_WEBHOOK_SECRET`, `OPENAI_API_KEY`, and `N8N_EXTRACTION_WEBHOOK_URL` out of browser bundles. New Supabase tables in exposed schemas must have RLS and owner-scoped policies.
