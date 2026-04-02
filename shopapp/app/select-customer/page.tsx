export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import SelectForm from "./SelectForm";

interface Customer {
  customer_id: number;
  full_name: string;
  email: string;
  customer_segment: string;
  loyalty_tier: string;
}

export default async function SelectCustomerPage() {
  const { data: customers } = await supabase
    .from("customers")
    .select("customer_id, full_name, email, customer_segment, loyalty_tier")
    .order("full_name");

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Select Customer</h1>
      <p className="text-slate-500 mb-6">
        Choose an existing customer to act as. No login required.
      </p>
      <SelectForm customers={(customers ?? []) as Customer[]} />
    </div>
  );
}
