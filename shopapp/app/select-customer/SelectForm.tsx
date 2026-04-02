"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Customer {
  customer_id: number;
  full_name: string;
  email: string;
  customer_segment: string;
  loyalty_tier: string;
}

export default function SelectForm({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const filtered = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    await fetch("/api/set-customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: selected }),
    });
    router.push("/dashboard");
  }

  return (
    <div className="max-w-xl">
      <input
        type="text"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-4 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
      <div className="border rounded-lg overflow-hidden mb-4 max-h-80 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-6 text-sm">No customers found.</p>
        )}
        {filtered.map((c) => (
          <div
            key={c.customer_id}
            onClick={() => setSelected(c.customer_id)}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b last:border-b-0 transition ${
              selected === c.customer_id
                ? "bg-slate-800 text-white"
                : "hover:bg-slate-50"
            }`}
          >
            <div className="flex-1">
              <p className="font-medium text-sm">{c.full_name}</p>
              <p className={`text-xs ${selected === c.customer_id ? "text-slate-300" : "text-slate-400"}`}>
                {c.email} · {c.loyalty_tier} · {c.customer_segment}
              </p>
            </div>
            {selected === c.customer_id && <span className="text-sm">✓</span>}
          </div>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={!selected || loading}
        className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-40 transition text-sm"
      >
        {loading ? "Saving…" : "Continue to Dashboard →"}
      </button>
    </div>
  );
}
