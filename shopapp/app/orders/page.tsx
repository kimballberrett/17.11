import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const cookieStore = await cookies();
  const customerId = cookieStore.get("customer_id")?.value;
  if (!customerId) redirect("/select-customer");

  const params = await searchParams;

  // Fetch orders with shipment status and fraud prediction
  const { data: ordersRaw } = await supabase
    .from("orders")
    .select("order_id, order_datetime, order_total, shipments(shipment_id), fraud_predictions(fraud_probability, predicted_fraud)")
    .eq("customer_id", Number(customerId))
    .order("order_datetime", { ascending: false });

  const orders = (ordersRaw ?? []).map((o: Record<string, unknown>) => {
    const fraud = o.fraud_predictions as Record<string, unknown> | null;
    return {
      order_id: o.order_id as number,
      order_datetime: o.order_datetime as string,
      order_total: o.order_total as number,
      status: o.shipments ? "Shipped" : "Pending",
      fraud_probability: fraud?.fraud_probability as number | null,
      predicted_fraud: fraud?.predicted_fraud as boolean | null,
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Order History</h1>
      <p className="text-slate-500 text-sm mb-6">{orders.length} orders for this customer</p>

      {params.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
          Order placed successfully. Run Scoring to generate predictions.
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        {orders.length === 0 ? (
          <p className="text-slate-400 px-6 py-10 text-sm text-center">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-5 py-2.5 text-left">Order</th>
                <th className="px-5 py-2.5 text-left">Date</th>
                <th className="px-5 py-2.5 text-right">Total</th>
                <th className="px-5 py-2.5 text-center">Status</th>
                <th className="px-5 py-2.5 text-center">Fraud Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.order_id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5">
                    <Link href={`/orders/${o.order_id}`} className="text-blue-600 hover:underline font-mono text-xs">
                      #{o.order_id}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">{o.order_datetime.slice(0, 10)}</td>
                  <td className="px-5 py-2.5 text-right font-medium">${o.order_total.toFixed(2)}</td>
                  <td className="px-5 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      o.status === "Shipped" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                    }`}>{o.status}</span>
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    {o.fraud_probability !== null ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        o.predicted_fraud ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                      }`}>
                        {o.predicted_fraud ? "Flagged" : "Clear"} ({(o.fraud_probability! * 100).toFixed(0)}%)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
