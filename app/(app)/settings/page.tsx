import { Card, PageHeader, StatusPill } from "@/components/ui";
import { hasSupabaseEnv } from "@/lib/supabase";

const checks = [
  ["Supabase URL", "NEXT_PUBLIC_SUPABASE_URL"],
  ["Supabase anon key", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  ["Supabase service role", "SUPABASE_SERVICE_ROLE_KEY"],
  ["OpenAI API key", "OPENAI_API_KEY"]
] as const;

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" eyebrow="Private MVP configuration and ingest readiness" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Environment</h2>
          <div className="mt-4 space-y-3">
            {checks.map(([label, env]) => (
              <div key={env} className="flex items-center justify-between border-t border-line pt-3">
                <span className="font-semibold">{label}</span>
                <StatusPill tone={process.env[env] ? "green" : "red"}>{process.env[env] ? "configured" : "missing"}</StatusPill>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Runtime Behavior</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>No seeded data is rendered in the app.</p>
            <p>Uploads create extraction candidates first; candidates require review before becoming bookings.</p>
            <p>Scanner output is derived from confirmed bookings and saved as trip issues.</p>
            <p>{hasSupabaseEnv() ? "Supabase client is available." : "Supabase env is missing, so pages render empty-state previews."}</p>
          </div>
        </Card>
      </div>
    </>
  );
}
