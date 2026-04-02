"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FraudConfirmButton({ orderId }: { orderId: number }) {
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function confirm(isFraud: boolean) {
    setSaving(true);
    await fetch("/api/confirm-fraud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, is_fraud: isFraud }),
    });
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => confirm(true)}
        disabled={saving}
        className="px-3 py-1 text-xs rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition disabled:opacity-50"
      >
        Yes, Fraud
      </button>
      <button
        onClick={() => confirm(false)}
        disabled={saving}
        className="px-3 py-1 text-xs rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition disabled:opacity-50"
      >
        No, Legitimate
      </button>
    </div>
  );
}
