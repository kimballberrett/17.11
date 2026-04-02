"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Product {
  product_id: number;
  product_name: string;
  category: string;
  price: number;
}

interface LineItem {
  product_id: number;
  product_name: string;
  price: number;
  quantity: number;
}

export default function PlaceOrderForm({
  products,
  customerId,
}: {
  products: Product[];
  customerId: number;
}) {
  const [lines, setLines] = useState<LineItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number>(products[0]?.product_id ?? 0);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function addLine() {
    const p = products.find((x) => x.product_id === selectedProduct);
    if (!p) return;
    const existing = lines.findIndex((l) => l.product_id === p.product_id);
    if (existing >= 0) {
      const updated = [...lines];
      updated[existing].quantity += qty;
      setLines(updated);
    } else {
      setLines([...lines, { product_id: p.product_id, product_name: p.product_name, price: p.price, quantity: qty }]);
    }
  }

  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }

  const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  async function handleSubmit() {
    if (lines.length === 0) { setError("Add at least one item."); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/place-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId, items: lines }),
    });
    const data = await res.json();
    if (data.ok) {
      router.push("/orders?success=1");
    } else {
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-white border rounded-xl shadow-sm p-6 mb-4">
        <h2 className="font-semibold text-slate-700 mb-4">Add Items</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">Product</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} — ${p.price.toFixed(2)} ({p.category})
                </option>
              ))}
            </select>
          </div>
          <div className="w-20">
            <label className="text-xs text-slate-500 mb-1 block">Qty</label>
            <input
              type="number"
              min={1}
              max={99}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <button
            onClick={addLine}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition"
          >
            Add
          </button>
        </div>
      </div>

      {lines.length > 0 && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Unit</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">{l.product_name}</td>
                  <td className="px-4 py-3 text-right">{l.quantity}</td>
                  <td className="px-4 py-3 text-right">${l.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium">${(l.price * l.quantity).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={3} className="px-4 py-3 text-right text-slate-600">Total</td>
                <td className="px-4 py-3 text-right">${total.toFixed(2)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || lines.length === 0}
        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-40 transition text-sm"
      >
        {loading ? "Placing order…" : "Place Order"}
      </button>
    </div>
  );
}
