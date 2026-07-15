import { Card, PageHeader, StatusPill } from "@/components/ui";
import { hasSupabaseEnv } from "@/lib/supabase";

export default function SettingsPage() {
  const checks = [
    ["Supabase URL", Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), true],
    [
      "Supabase publishable key",
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      true
    ],
    ["OpenAI API key", Boolean(process.env.OPENAI_API_KEY), true],
    ["Supabase service role", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), true]
  ] as const;

  return (
    <>
      <PageHeader title="Settings" eyebrow="Private MVP configuration and ingest readiness" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Environment</h2>
          <div className="mt-4 space-y-3">
            {checks.map(([label, configured, required]) => {
              const tone = configured ? "green" : required ? "red" : "gold";
              return (
                <div key={label} className="flex items-center justify-between border-t border-line pt-3">
                  <span className="font-semibold">{label}</span>
                  <StatusPill tone={tone}>{configured ? "configured" : required ? "missing" : "optional"}</StatusPill>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Runtime Behavior</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>A read-only public demo trip is shown until the current session creates private trip data.</p>
            <p>Magic links are disabled; middleware creates anonymous Supabase sessions automatically.</p>
            <p>Uploads create extraction candidates first; candidates require review before becoming bookings.</p>
            <p>Scanner output is derived from confirmed bookings and saved as trip issues.</p>
            <p>Private trips, uploads, bookings, candidates, and scanner issues are isolated by Supabase RLS.</p>
            <p>{hasSupabaseEnv() ? "Supabase client is available." : "Supabase env is missing, so pages render empty-state previews."}</p>
          </div>
        </Card>
      </div>
    </>
  );
}
