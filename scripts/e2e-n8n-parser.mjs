#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const defaultWebhookTestUrl =
  "https://marco-advisor.app.n8n.cloud/webhook-test/f02c9c49-a8c5-46f2-880d-aab36bb7304c";

loadDotEnv(".env.local");

const args = parseArgs(process.argv.slice(2));
const mode = args.mode ?? process.env.E2E_MODE ?? "full";
const runId = process.env.E2E_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, "-");
const testTripName = process.env.E2E_TRIP_NAME ?? `E2E n8n Test - ${runId}`;
const testFileName = process.env.E2E_FILE_NAME ?? "marco-e2e-hotel-confirmation.txt";
const acceptCandidate = (process.env.E2E_ACCEPT_CANDIDATE ?? "true") !== "false";

const testFileContent = `Marco Advisor E2E Hotel Confirmation
Hotel: Hotel Cypress Test Suites
Confirmation code: E2E-${runId.slice(0, 12).toUpperCase()}
Traveler: Maya Test
Check-in: 2026-07-12 15:00
Check-out: 2026-07-15 11:00
Total: USD 912.45
Refundable until: 2026-07-08 23:59
Address: 101 Test Avenue, San Francisco, CA
`;

async function main() {
  logHeader("Marco Advisor n8n parser E2E");
  console.log(`Mode: ${mode}`);
  console.log(`Run id: ${runId}`);

  if (mode === "preflight") {
    preflight();
    return;
  }

  if (mode === "webhook-test") {
    await smokeWebhook(process.env.N8N_EXTRACTION_TEST_WEBHOOK_URL ?? defaultWebhookTestUrl);
    return;
  }

  if (mode === "production-webhook") {
    requireEnv(["N8N_EXTRACTION_WEBHOOK_URL"]);
    await smokeWebhook(process.env.N8N_EXTRACTION_WEBHOOK_URL);
    return;
  }

  if (mode !== "full") {
    throw new Error(`Unsupported mode "${mode}". Use preflight, webhook-test, production-webhook, or full.`);
  }

  preflight({ strict: true });
  await smokeWebhook(process.env.N8N_EXTRACTION_TEST_WEBHOOK_URL ?? defaultWebhookTestUrl);

  const baseUrl = normalizeBaseUrl(process.env.MARCO_BASE_URL);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const cookies = createCookieJar();
  await getPage(`${baseUrl}/upload`, cookies, "open upload page");
  const uploadResult = await uploadTestFile(baseUrl, cookies);

  const uploadId = uploadResult.upload?.id;
  const jobId = uploadResult.job?.id;
  const tripId = uploadResult.job?.trip_id ?? uploadResult.upload?.trip_id;
  assert(uploadId, "Upload response did not include upload.id.");
  assert(jobId, "Upload response did not include job.id.");
  assert(uploadResult.dispatched === true, `Expected dispatched=true, received ${JSON.stringify(uploadResult)}`);

  console.log(`Queued upload ${uploadId}`);
  console.log(`Queued job ${jobId}`);
  console.log(`Trip ${tripId}`);

  await runNegativeChecks(baseUrl, jobId);
  const state = await waitForExtraction(supabase, { uploadId, jobId });
  await verifyUi(baseUrl, cookies);

  if (acceptCandidate) {
    await acceptFirstCandidate(baseUrl, cookies, supabase, state.candidate.id);
    await verifyAcceptedBooking(supabase, { uploadId, tripId });
  } else {
    console.log("Skipping candidate acceptance because E2E_ACCEPT_CANDIDATE=false.");
  }

  logHeader("E2E validation complete");
}

function preflight(options = {}) {
  const required = [
    "MARCO_BASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "EXTRACTION_WEBHOOK_SECRET"
  ];
  const optional = ["N8N_EXTRACTION_WEBHOOK_URL", "N8N_EXTRACTION_TEST_WEBHOOK_URL"];
  const missing = [];

  for (const key of required) {
    const value = process.env[key];
    console.log(`${key}: ${value ? summarizeValue(key, value) : "missing"}`);
    if (!value) missing.push(key);
  }
  for (const key of optional) {
    const value = process.env[key];
    console.log(`${key}: ${value ? summarizeValue(key, value) : "not set"}`);
  }

  if (options.strict && missing.length > 0) {
    throw new Error(`Missing required env vars for full E2E: ${missing.join(", ")}`);
  }
}

async function smokeWebhook(url) {
  logHeader("n8n webhook smoke test");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: `smoke-job-${runId}`,
      upload_id: `smoke-upload-${runId}`,
      trip_id: `smoke-trip-${runId}`,
      source: "marco-e2e-runner"
    })
  });
  const text = await response.text();
  console.log(`Webhook ${url}`);
  console.log(`HTTP ${response.status}`);
  console.log(text);
  assert(response.ok, `n8n webhook smoke test failed with HTTP ${response.status}.`);
}

async function uploadTestFile(baseUrl, cookies) {
  logHeader("Upload test file");
  const form = new FormData();
  form.set("tripName", testTripName);
  form.set("destination", "San Francisco, CA");
  form.set("startsOn", "2026-07-12");
  form.set("endsOn", "2026-07-15");
  form.set("file", new Blob([testFileContent], { type: "text/plain" }), testFileName);

  const response = await fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers: cookieHeader(cookies),
    body: form
  });
  absorbCookies(cookies, response);
  const text = await response.text();
  console.log(`POST /api/upload -> HTTP ${response.status}`);
  console.log(text);
  assert(response.ok, `Upload failed with HTTP ${response.status}.`);
  return JSON.parse(text);
}

async function runNegativeChecks(baseUrl, jobId) {
  logHeader("Negative auth checks");
  const noAuth = await fetch(`${baseUrl}/api/extractions/jobs/${jobId}`);
  console.log(`No-auth job endpoint -> HTTP ${noAuth.status}`);
  assert(noAuth.status === 401, `Expected no-auth job endpoint to return 401, got ${noAuth.status}.`);

  const wrongBearer = await fetch(`${baseUrl}/api/extractions/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer definitely-wrong"
    },
    body: JSON.stringify({ job_id: jobId, status: "succeeded" })
  });
  console.log(`Wrong-bearer callback -> HTTP ${wrongBearer.status}`);
  assert(wrongBearer.status === 401, `Expected wrong-bearer callback to return 401, got ${wrongBearer.status}.`);

  const malformed = await fetch(`${baseUrl}/api/extractions/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.EXTRACTION_WEBHOOK_SECRET}`
    },
    body: JSON.stringify({
      job_id: jobId,
      status: "succeeded",
      bookings: [{ title: "Malformed booking without booking_type" }]
    })
  });
  console.log(`Malformed callback -> HTTP ${malformed.status}`);
  assert(!malformed.ok, `Expected malformed callback to fail, got HTTP ${malformed.status}.`);
}

async function waitForExtraction(supabase, ids) {
  logHeader("Poll Supabase extraction state");
  const deadline = Date.now() + Number(process.env.E2E_TIMEOUT_MS ?? 180000);
  let last = null;

  while (Date.now() < deadline) {
    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .select("*")
      .eq("id", ids.uploadId)
      .single();
    if (uploadError) throw uploadError;

    const { data: job, error: jobError } = await supabase
      .from("extraction_jobs")
      .select("*")
      .eq("id", ids.jobId)
      .single();
    if (jobError) throw jobError;

    const { data: pages, error: pagesError } = await supabase
      .from("upload_pages")
      .select("*")
      .eq("job_id", ids.jobId);
    if (pagesError) throw pagesError;

    const { data: candidates, error: candidatesError } = await supabase
      .from("extracted_booking_candidates")
      .select("*")
      .eq("source_job_id", ids.jobId);
    if (candidatesError) throw candidatesError;

    last = { upload, job, pages: pages ?? [], candidates: candidates ?? [] };
    console.log(
      `upload=${upload.status} job=${job.status} pages=${last.pages.length} candidates=${last.candidates.length}`
    );

    if (job.status === "failed" || upload.status === "failed") {
      throw new Error(`Extraction failed: ${job.error_message ?? "No error message recorded."}`);
    }

    if (
      upload.status === "review_ready" &&
      job.status === "succeeded" &&
      last.pages.length > 0 &&
      last.candidates.some((candidate) => candidate.status === "needs_review")
    ) {
      const candidate = last.candidates.find((item) => item.status === "needs_review");
      assert(candidate.source_job_id === ids.jobId, "Candidate is missing source_job_id.");
      assert(candidate.source_pages?.length > 0, "Candidate is missing source_pages.");
      assert(candidate.source_snippets?.length > 0, "Candidate is missing source_snippets.");
      assert(candidate.extraction_method, "Candidate is missing extraction_method.");
      return { ...last, candidate };
    }

    await delay(5000);
  }

  throw new Error(`Timed out waiting for extraction callback. Last state: ${JSON.stringify(last, null, 2)}`);
}

async function verifyUi(baseUrl, cookies) {
  logHeader("Verify Marco UI pages");
  await getPage(`${baseUrl}/pipeline`, cookies, "pipeline page", [testFileName, "candidates"]);
  await getPage(`${baseUrl}/upload`, cookies, "upload page", ["Review Queue"]);
  await getPage(`${baseUrl}/bookings`, cookies, "bookings page", ["Review Extracted Candidates"]);
}

async function acceptFirstCandidate(baseUrl, cookies, supabase, candidateId) {
  logHeader("Accept candidate");
  const form = new URLSearchParams({ intent: "accept" });
  const response = await fetch(`${baseUrl}/api/candidates/${candidateId}`, {
    method: "POST",
    headers: {
      ...cookieHeader(cookies),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form,
    redirect: "manual"
  });
  console.log(`POST /api/candidates/${candidateId} -> HTTP ${response.status}`);
  assert(response.status === 303 || response.ok, `Candidate accept failed with HTTP ${response.status}.`);

  const { data: candidate, error } = await supabase
    .from("extracted_booking_candidates")
    .select("*")
    .eq("id", candidateId)
    .single();
  if (error) throw error;
  assert(candidate.status === "accepted", `Expected candidate status accepted, got ${candidate.status}.`);
}

async function verifyAcceptedBooking(supabase, ids) {
  logHeader("Verify accepted booking rows");
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("*")
    .eq("source_upload_id", ids.uploadId);
  if (bookingsError) throw bookingsError;
  assert(bookings?.length > 0, "Expected at least one booking for source_upload_id.");

  const bookingIds = bookings.map((booking) => booking.id);
  const { data: segments, error: segmentsError } = await supabase
    .from("booking_segments")
    .select("*")
    .in("booking_id", bookingIds);
  if (segmentsError) throw segmentsError;
  assert(segments?.length > 0, "Expected at least one booking segment.");
}

async function getPage(url, cookies, label, expectedText = []) {
  const response = await fetch(url, { headers: cookieHeader(cookies) });
  absorbCookies(cookies, response);
  const text = await response.text();
  console.log(`${label} -> HTTP ${response.status}`);
  assert(response.ok, `${label} failed with HTTP ${response.status}.`);
  for (const expected of expectedText) {
    assert(text.includes(expected), `${label} did not include expected text: ${expected}`);
  }
  return text;
}

function createCookieJar() {
  return new Map();
}

function absorbCookies(jar, response) {
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : splitSetCookie(response.headers.get("set-cookie"));
  for (const cookie of setCookies) {
    const first = cookie.split(";")[0];
    const index = first.indexOf("=");
    if (index > 0) jar.set(first.slice(0, index), first.slice(index + 1));
  }
}

function cookieHeader(jar) {
  if (!jar || jar.size === 0) return {};
  return {
    Cookie: Array.from(jar.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ")
  };
}

function splitSetCookie(value) {
  if (!value) return [];
  return [value];
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, value = "true"] = arg.slice(2).split("=");
    parsed[key] = value;
  }
  return parsed;
}

function loadDotEnv(path) {
  if (!fs.existsSync(path)) return;
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireEnv(keys) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`Missing env vars: ${missing.join(", ")}`);
}

function normalizeBaseUrl(value) {
  assert(value, "MARCO_BASE_URL is required.");
  return value.replace(/\/+$/, "");
}

function summarizeValue(key, value) {
  if (/SECRET|KEY|TOKEN/.test(key)) return "present";
  if (/URL|BASE/.test(key)) {
    try {
      return new URL(value).origin;
    } catch {
      return "present but invalid URL";
    }
  }
  return "present";
}

function logHeader(label) {
  console.log(`\n=== ${label} ===`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
