export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function WarehousePriorityPage() {
  // Stats
  const { count: totalOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });

  const { count: totalShipments } = await supabase
    .from("shipments")
    .select("*", { count: "exact", head: true });

  const unfulfilledCount = (totalOrders ?? 0) - (totalShipments ?? 0);

  // Get all order IDs and shipped IDs (paginate past 1000 row default limit)
  const pageSize = 1000;

  let allOrderIds: number[] = [];
  let orderFrom = 0;
  while (true) {
    const { data: page } = await supabase
      .from("orders")
      .select("order_id")
      .range(orderFrom, orderFrom + pageSize - 1);
    if (!page || page.length === 0) break;
    allOrderIds = allOrderIds.concat(page.map((r) => r.order_id as number));
    if (page.length < pageSize) break;
    orderFrom += pageSize;
  }

  let allShippedIds: number[] = [];
  let shipFrom = 0;
  while (true) {
    const { data: page } = await supabase
      .from("shipments")
      .select("order_id")
      .range(shipFrom, shipFrom + pageSize - 1);
    if (!page || page.length === 0) break;
    allShippedIds = allShippedIds.concat(page.map((r) => r.order_id as number));
    if (page.length < pageSize) break;
    shipFrom += pageSize;
  }

  const shippedSet = new Set(allShippedIds);
  const unfulfilledIds = allOrderIds.filter((id) => !shippedSet.has(id));

  // Get predictions only for unfulfilled orders (small set, no pagination needed)
  const { data: predictions } = unfulfilledIds.length > 0
    ? await supabase
        .from("order_predictions")
        .select("order_id, late_delivery_probability, predicted_late_delivery, prediction_timestamp")
        .in("order_id", unfulfilledIds)
        .order("late_delivery_probability", { ascending: false })
        .limit(50)
    : { data: [] };

  const unfulfilledPreds = predictions ?? [];

  // Get order + customer details for these
  const predOrderIds = unfulfilledPreds.map((p) => p.order_id as number);
  const { data: ordersData } = await supabase
    .from("orders")
    .select("order_id, order_datetime, order_total, customer_id")
    .in("order_id", predOrderIds);

  const customerIds = [...new Set((ordersData ?? []).map((o) => o.customer_id as number))];
  const { data: customersData } = await supabase
    .from("customers")
    .select("customer_id, full_name")
    .in("customer_id", customerIds);

  const orderMap: Record<number, Record<string, unknown>> = {};
  for (const o of (ordersData ?? [])) orderMap[o.order_id as number] = o;
  const customerMap: Record<number, string> = {};
  for (const c of (customersData ?? [])) customerMap[c.customer_id as number] = c.full_name as string;

  const rows = unfulfilledPreds.map((p, i) => {
    const order = orderMap[p.order_id as number] ?? {};
    return {
      rank: i + 1,
      order_id: p.order_id as number,
      order_datetime: (order.order_datetime as string) ?? "",
      order_total: (order.order_total as number) ?? 0,
      customer_name: customerMap[order.customer_id as number] ?? "",
      late_delivery_probability: p.late_delivery_probability as number,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-900">Late Delivery Priority Queue</h1>
        <Link
          href="/scoring"
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition"
        >
          Run Scoring
        </Link>
      </div>
      <p className="text-slate-500 text-sm mb-4">
        Warehouse fulfillment queue — unfulfilled orders ranked by ML-predicted late-delivery probability (highest risk first).
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Total Orders</p>
          <p className="text-xl font-bold text-slate-900">{totalOrders?.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Shipped</p>
          <p className="text-xl font-bold text-green-600">{totalShipments?.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Unfulfilled</p>
          <p className="text-xl font-bold text-amber-600">{unfulfilledCount}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border rounded-lg p-10 text-center">
          <p className="text-slate-500 mb-2">
            {unfulfilledCount === 0
              ? "All orders have been shipped. Place a new order to see it here."
              : "No predictions yet for unfulfilled orders."}
          </p>
          <p className="text-sm text-slate-400">
            <Link href="/place-order" className="text-blue-600 hover:underline">Place a new order</Link>, then{" "}
            <Link href="/scoring" className="text-blue-600 hover:underline">Run Scoring</Link>{" "}
            to generate late-delivery predictions.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left w-12">#</th>
                <th className="px-4 py-2.5 text-left">Order</th>
                <th className="px-4 py-2.5 text-left">Customer</th>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5 text-right">Late Probability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const prob = row.late_delivery_probability;
                const color = prob >= 0.7 ? "text-red-600 font-bold"
                  : prob >= 0.5 ? "text-amber-600 font-semibold"
                  : "text-green-600";

                return (
                  <tr key={row.order_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-300 font-mono text-xs">{row.rank}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/orders/${row.order_id}`} className="text-blue-600 hover:underline font-mono text-xs">
                        #{row.order_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{row.customer_name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{row.order_datetime.slice(0, 10)}</td>
                    <td className="px-4 py-2.5 text-right">${row.order_total.toFixed(2)}</td>
                    <td className={`px-4 py-2.5 text-right ${color}`}>
                      {(prob * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 bg-slate-50 border-t text-xs text-slate-400">
            {rows.length} unfulfilled order{rows.length !== 1 ? "s" : ""} with predictions
          </div>
        </div>
      )}
    </div>
  );
}
