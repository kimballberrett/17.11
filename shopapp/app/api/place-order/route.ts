import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { customer_id, items } = await req.json();

  if (!customer_id || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  try {
    const orderTotal = items.reduce(
      (sum: number, item: { price: number; quantity: number }) =>
        sum + item.price * item.quantity,
      0
    );
    const shippingFee = 9.99;
    const taxAmount = parseFloat((orderTotal * 0.08).toFixed(2));
    const orderDatetime = new Date().toISOString().replace("T", " ").slice(0, 19);

    // Insert order
    const { data: orderRow, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id,
        order_datetime: orderDatetime,
        billing_zip: "",
        shipping_zip: "",
        shipping_state: "",
        payment_method: "card",
        device_type: "web",
        ip_country: "US",
        promo_used: 0,
        order_subtotal: orderTotal,
        shipping_fee: shippingFee,
        tax_amount: taxAmount,
        order_total: orderTotal + shippingFee + taxAmount,
        risk_score: 0,
        is_fraud: 0,
      })
      .select("order_id")
      .single();

    if (orderErr) throw orderErr;

    const orderId = orderRow.order_id;

    // Insert order items
    const orderItems = items.map((item: { product_id: number; price: number; quantity: number }) => ({
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price,
      line_total: item.price * item.quantity,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) throw itemsErr;

    return NextResponse.json({ ok: true, order_id: orderId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Database error." }, { status: 500 });
  }
}
