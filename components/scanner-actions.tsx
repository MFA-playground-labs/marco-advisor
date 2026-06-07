"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RunScannerButton() {
  const [busy, setBusy] = useState(false);

  async function runScan() {
    setBusy(true);
    try {
      await fetch("/api/scanner", { method: "POST" });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={runScan}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-black text-ink disabled:opacity-60"
    >
      <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
      Run full scan
    </button>
  );
}
