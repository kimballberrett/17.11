import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const { customer_id } = await req.json();
  const cookieStore = await cookies();
  cookieStore.set("customer_id", String(customer_id), {
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    httpOnly: false,
    sameSite: "lax",
  });
  return NextResponse.json({ ok: true });
}
