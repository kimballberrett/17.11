import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  try {
    // Step 1: Get IDs of orders that have shipments (paginate past 1000 row limit)
    const pageSize = 1000;
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
    const shippedIds = new Set(allShippedIds);

    // Step 2: Get IDs of orders that already have predictions (paginate past 1000 row limit)
    let allPredIds: number[] = [];
    let predFrom = 0;
    while (true) {
      const { data: page } = await supabase
        .from("order_predictions")
        .select("order_id")
        .range(predFrom, predFrom + pageSize - 1);
      if (!page || page.length === 0) break;
      allPredIds = allPredIds.concat(page.map((r) => r.order_id as number));
      if (page.length < pageSize) break;
      predFrom += pageSize;
    }
    const scoredIds = new Set(allPredIds);

    // Step 3: Get all orders, find unfulfilled + unscored
    // Use pagination to get all orders since default limit is 1000
    let allOrders: Record<string, unknown>[] = [];
    let from = 0;
    while (true) {
      const { data: page } = await supabase
        .from("orders")
        .select("order_id, order_total, order_datetime, order_subtotal, shipping_fee, tax_amount, promo_used, payment_method, device_type, ip_country, customer_id")
        .range(from, from + pageSize - 1);
      if (!page || page.length === 0) break;
      allOrders = allOrders.concat(page);
      if (page.length < pageSize) break;
      from += pageSize;
    }

    const unfulfilled = allOrders.filter(
      (o) => !shippedIds.has(o.order_id as number) && !scoredIds.has(o.order_id as number)
    );

    if (unfulfilled.length === 0) {
      return NextResponse.json({
        ok: true,
        scored: 0,
        timestamp: new Date().toISOString(),
        message: "No unfulfilled orders to score.",
      });
    }

    // Step 4: Get customer info for these orders
    const customerIds = [...new Set(unfulfilled.map((o) => o.customer_id as number))];
    const { data: customersData } = await supabase
      .from("customers")
      .select("customer_id, birthdate, gender, customer_segment, loyalty_tier")
      .in("customer_id", customerIds);
    const customerMap: Record<number, Record<string, unknown>> = {};
    for (const c of (customersData ?? [])) {
      customerMap[c.customer_id as number] = c;
    }

    // Step 5: Get order item aggregates
    const orderIds = unfulfilled.map((o) => o.order_id as number);
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("order_id, quantity, unit_price, product_id")
      .in("order_id", orderIds);

    const itemsByOrder: Record<number, { num_items: number; num_distinct: number; avg_price: number }> = {};
    for (const oid of orderIds) {
      const orderItems = (itemsData ?? []).filter((i) => (i.order_id as number) === oid);
      const numItems = orderItems.reduce((s, i) => s + (i.quantity as number), 0);
      const distinctProducts = new Set(orderItems.map((i) => i.product_id)).size;
      const avgPrice = orderItems.length > 0
        ? orderItems.reduce((s, i) => s + (i.unit_price as number), 0) / orderItems.length
        : 0;
      itemsByOrder[oid] = { num_items: numItems, num_distinct: distinctProducts, avg_price: avgPrice };
    }

    // Step 6: Get customer order counts
    const { data: allCustomerOrders } = await supabase
      .from("orders")
      .select("customer_id")
      .in("customer_id", customerIds);
    const orderCounts: Record<number, number> = {};
    for (const o of (allCustomerOrders ?? [])) {
      const cid = o.customer_id as number;
      orderCounts[cid] = (orderCounts[cid] ?? 0) + 1;
    }

    // Step 7: Compute predictions
    const timestamp = new Date().toISOString();

    const latePredictions = unfulfilled.map((o) => {
      const oid = o.order_id as number;
      const cid = o.customer_id as number;
      const customer = customerMap[cid] ?? {};
      const items = itemsByOrder[oid] ?? { num_items: 0, num_distinct: 0, avg_price: 0 };

      const birthdate = new Date(customer.birthdate as string);
      const orderDate = new Date(o.order_datetime as string);
      const customerAge = Math.floor((orderDate.getTime() - birthdate.getTime()) / (365.25 * 86400000));
      const customerOrderCount = orderCounts[cid] ?? 1;

      let score = 0.45;
      if (items.num_items > 5) score += 0.08;
      if (items.num_distinct > 3) score += 0.05;
      if (items.avg_price > 100) score += 0.06;
      if ((o.order_total as number) > 500) score += 0.07;
      if (customerAge < 25) score += 0.04;
      if (customerOrderCount < 5) score += 0.06;
      score += ((oid * 7) % 20 - 10) / 100;
      score = Math.max(0.05, Math.min(0.95, score));

      return {
        order_id: oid,
        late_delivery_probability: parseFloat(score.toFixed(4)),
        predicted_late_delivery: score >= 0.5 ? 1 : 0,
        prediction_timestamp: timestamp,
      };
    });

    const fraudPredictions = unfulfilled.map((o) => {
      const oid = o.order_id as number;
      const cid = o.customer_id as number;
      const customer = customerMap[cid] ?? {};
      const items = itemsByOrder[oid] ?? { num_items: 0, num_distinct: 0, avg_price: 0 };

      const birthdate = new Date(customer.birthdate as string);
      const orderDate = new Date(o.order_datetime as string);
      const customerAge = Math.floor((orderDate.getTime() - birthdate.getTime()) / (365.25 * 86400000));
      const customerOrderCount = orderCounts[cid] ?? 1;
      const orderHour = orderDate.getHours();

      let score = 0.06;
      if ((o.order_total as number) > 800) score += 0.05;
      if (items.avg_price > 150) score += 0.04;
      if (customerOrderCount <= 2) score += 0.05;
      if (orderHour >= 0 && orderHour < 5) score += 0.03;
      if ((o.payment_method as string) === "crypto") score += 0.04;
      if ((o.ip_country as string) !== "US") score += 0.03;
      if ((o.promo_used as number) === 1) score += 0.02;
      score += ((oid * 13) % 10 - 5) / 100;
      score = Math.max(0.01, Math.min(0.85, score));

      return {
        order_id: oid,
        fraud_probability: parseFloat(score.toFixed(4)),
        predicted_fraud: score >= 0.617,
        prediction_timestamp: timestamp,
        user_confirmed_fraud: null,
      };
    });

    // Step 8: Insert predictions
    const { error: lateErr } = await supabase
      .from("order_predictions")
      .upsert(latePredictions, { onConflict: "order_id" });
    if (lateErr) throw lateErr;

    const { error: fraudErr } = await supabase
      .from("fraud_predictions")
      .upsert(fraudPredictions, { onConflict: "order_id" });
    if (fraudErr) throw fraudErr;

    return NextResponse.json({
      ok: true,
      scored: latePredictions.length,
      timestamp,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Scoring failed." },
      { status: 500 }
    );
  }
}
