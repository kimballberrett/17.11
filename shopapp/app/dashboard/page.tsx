import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const customerId = cookieStore.get("customer_id")?.value;
  if (!customerId) redirect("/select-customer");

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("customer_id", Number(customerId))
    .single();

  if (!customer) redirect("/select-customer");

  // Stats
  const { data: ordersAll } = await supabase
    .from("orders")
    .select("order_total")
    .eq("customer_id", Number(customerId));

  const totalOrders = ordersAll?.length ?? 0;
  const totalSpend = ordersAll?.reduce((s, o) => s + (o.order_total ?? 0), 0) ?? 0;

  // Recent orders — shipments is one-to-one (order_id UNIQUE), returns object or null
  const { data: recentRaw } = await supabase
    .from("orders")
    .select("order_id, order_datetime, order_total, shipments(shipment_id)")
    .eq("customer_id", Number(customerId))
    .order("order_datetime", { ascending: false })
    .limit(5);

  const recent = (recentRaw ?? []).map((o: Record<string, unknown>) => ({
    order_id: o.order_id as number,
    order_datetime: o.order_datetime as string,
    order_total: o.order_total as number,
    status: o.shipments ? "Shipped" : "Pending",
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Dashboard</h1>
      <p className="text-slate-500 mb-6 text-sm">
        Welcome back, <span className="font-medium text-slate-700">{customer.full_name}</span>
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-slate-900">{totalOrders}</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Spend</p>
          <p className="text-2xl font-bold text-slate-900">${totalSpend.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Loyalty Tier</p>
          <p className="text-2xl font-bold text-slate-900 capitalize">{customer.loyalty_tier ?? "None"}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden mb-6">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Recent Orders</h2>
        </div>
        {recent.length === 0 ? (
          <p className="text-slate-400 text-sm px-5 py-6 text-center">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-5 py-2 text-left">Order</th>
                <th className="px-5 py-2 text-left">Date</th>
                <th className="px-5 py-2 text-right">Total</th>
                <th className="px-5 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((o) => (
                <tr key={o.order_id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5">
                    <Link href={`/orders/${o.order_id}`} className="text-blue-600 hover:underline font-mono text-xs">
                      #{o.order_id}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">{o.order_datetime.slice(0, 10)}</td>
                  <td className="px-5 py-2.5 text-right font-medium">${o.order_total.toFixed(2)}</td>
                  <td className="px-5 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      o.status === "Shipped" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                    }`}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex gap-3">
        <Link href="/place-order" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition">
          Place New Order
        </Link>
        <Link href="/orders" className="border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-100 transition">
          View All Orders
        </Link>
      </div>
    </div>
  );
}
