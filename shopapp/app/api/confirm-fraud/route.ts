import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { order_id, is_fraud } = await req.json();

  if (typeof order_id !== "number" || typeof is_fraud !== "boolean") {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const { error } = await supabase
    .from("fraud_predictions")
    .update({ user_confirmed_fraud: is_fraud })
    .eq("order_id", order_id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
