"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScoringButton() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<{
    scored: number | null;
    timestamp: string;
    error?: string;
  } | null>(null);
  const router = useRouter();

  async function handleRun() {
    setStatus("running");
    setResult(null);

    const res = await fetch("/api/run-scoring", { method: "POST" });
    const data = await res.json();

    if (data.ok) {
      setStatus("done");
      setResult({ scored: data.scored, timestamp: data.timestamp });
      router.refresh();
    } else {
      setStatus("error");
      setResult({ scored: null, timestamp: new Date().toISOString(), error: data.error });
    }
  }

  return (
    <div>
      <button
        onClick={handleRun}
        disabled={status === "running"}
        className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium transition ${
          status === "running"
            ? "bg-slate-400 cursor-not-allowed"
            : status === "done"
            ? "bg-green-600 hover:bg-green-700"
            : status === "error"
            ? "bg-red-600 hover:bg-red-700"
            : "bg-slate-900 hover:bg-slate-800"
        }`}
      >
        {status === "running"
          ? "Running inference..."
          : status === "done"
          ? "Done — Run Again"
          : status === "error"
          ? "Failed — Retry"
          : "Run Scoring"}
      </button>

      {result && status === "done" && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          <p className="font-medium">Scored {result.scored ?? 0} orders</p>
          <p className="text-xs text-green-600 mt-0.5">{result.timestamp.slice(0, 19)}</p>
          <a href="/warehouse/priority" className="text-blue-600 hover:underline text-xs mt-1 block">
            View Priority Queue
          </a>
        </div>
      )}

      {result && status === "error" && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Scoring failed</p>
          <pre className="text-xs whitespace-pre-wrap text-red-600 mt-1 max-h-32 overflow-y-auto">
            {result.error}
          </pre>
        </div>
      )}
    </div>
  );
}
