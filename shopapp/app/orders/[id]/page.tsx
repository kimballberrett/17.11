import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import FraudConfirmButton from "./FraudConfirmButton";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const customerId = cookieStore.get("customer_id")?.value;
  if (!customerId) redirect("/select-customer");

  const { id } = await params;

  const { data: order } = await supabase
    .from("orders")
    .select("*, customers(full_name), shipments(shipment_id, carrier, shipping_method, ship_datetime, late_delivery)")
    .eq("order_id", Number(id))
    .single();

  if (!order) notFound();

  const shipment = order.shipments as Record<string, unknown> | null;
  const status = shipment ? "Shipped" : "Pending";

  const { data: itemsRaw } = await supabase
    .from("order_items")
    .select("quantity, unit_price, line_total, products(product_name, category)")
    .eq("order_id", Number(id));

  const items = (itemsRaw ?? []).map((item: Record<string, unknown>) => {
    const product = item.products as Record<string, unknown> | null;
    return {
      quantity: item.quantity as number,
      unit_price: item.unit_price as number,
      line_total: item.line_total as number,
      product_name: (product?.product_name as string) ?? "Unknown",
      category: (product?.category as string) ?? "",
    };
  });

  const { data: latePred } = await supabase
    .from("order_predictions")
    .select("*")
    .eq("order_id", Number(id))
    .maybeSingle();

  const { data: fraudPred } = await supabase
    .from("fraud_predictions")
    .select("*")
    .eq("order_id", Number(id))
    .maybeSingle();

  const customer = order.customers as Record<string, unknown>;

  return (
    <div>
      <Link href="/orders" className="text-sm text-slate-400 hover:text-slate-600">
        &larr; Back to Order History
      </Link>

      <div className="flex items-baseline gap-3 mt-2 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Order #{id}</h1>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          status === "Shipped" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
        }`}>{status}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Customer</p>
          <p className="font-medium text-slate-800">{customer?.full_name as string}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Order Date</p>
          <p className="font-medium text-slate-800">{order.order_datetime.slice(0, 16)}</p>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg border overflow-hidden mb-6">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Line Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-5 py-2 text-left">Product</th>
              <th className="px-5 py-2 text-left">Category</th>
              <th className="px-5 py-2 text-right">Qty</th>
              <th className="px-5 py-2 text-right">Price</th>
              <th className="px-5 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, i) => (
              <tr key={i}>
                <td className="px-5 py-2 font-medium">{item.product_name}</td>
                <td className="px-5 py-2 text-slate-400">{item.category}</td>
                <td className="px-5 py-2 text-right">{item.quantity}</td>
                <td className="px-5 py-2 text-right">${item.unit_price.toFixed(2)}</td>
                <td className="px-5 py-2 text-right font-medium">${item.line_total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 bg-slate-50 border-t flex justify-end gap-6 text-sm">
          <span className="text-slate-400">Subtotal: ${order.order_subtotal.toFixed(2)}</span>
          <span className="text-slate-400">Shipping: ${order.shipping_fee.toFixed(2)}</span>
          <span className="text-slate-400">Tax: ${order.tax_amount.toFixed(2)}</span>
          <span className="font-bold text-slate-900">Total: ${order.order_total.toFixed(2)}</span>
        </div>
      </div>

      {/* ML Predictions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {latePred && (
          <div className="bg-white rounded-lg border p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Late Delivery Prediction</h3>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-slate-900">
                {(latePred.late_delivery_probability * 100).toFixed(1)}%
              </span>
              <span className={`text-sm font-medium ${latePred.predicted_late_delivery ? "text-red-600" : "text-green-600"}`}>
                {latePred.predicted_late_delivery ? "Late" : "On Time"}
              </span>
            </div>
            <p className="text-xs text-slate-400">Scored {latePred.prediction_timestamp?.slice(0, 16)}</p>
          </div>
        )}

        {fraudPred && (
          <div className="bg-white rounded-lg border p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Fraud Prediction</h3>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-slate-900">
                {(fraudPred.fraud_probability * 100).toFixed(1)}%
              </span>
              <span className={`text-sm font-medium ${fraudPred.predicted_fraud ? "text-red-600" : "text-green-600"}`}>
                {fraudPred.predicted_fraud ? "Flagged" : "Clear"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">Scored {fraudPred.prediction_timestamp?.slice(0, 16)}</p>
            <div className="border-t pt-3">
              <p className="text-xs text-slate-500 mb-2">
                {fraudPred.user_confirmed_fraud === null
                  ? "Was this order actually fraudulent?"
                  : fraudPred.user_confirmed_fraud
                  ? "Confirmed as fraud"
                  : "Confirmed as legitimate"}
              </p>
              {fraudPred.user_confirmed_fraud === null && (
                <FraudConfirmButton orderId={Number(id)} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
