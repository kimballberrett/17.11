import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PlaceOrderForm from "./PlaceOrderForm";

interface Product {
  product_id: number;
  product_name: string;
  category: string;
  price: number;
}

export default async function PlaceOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const cookieStore = await cookies();
  const customerId = cookieStore.get("customer_id")?.value;
  if (!customerId) redirect("/select-customer");

  const params = await searchParams;

  const { data: products } = await supabase
    .from("products")
    .select("product_id, product_name, category, price")
    .eq("is_active", 1)
    .order("category")
    .order("product_name");

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Place Order</h1>
      <p className="text-slate-500 mb-6">Select products and quantities to place a new order.</p>
      {params.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
          ✓ Order placed successfully!
        </div>
      )}
      <PlaceOrderForm products={(products ?? []) as Product[]} customerId={Number(customerId)} />
    </div>
  );
}
