import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "ShopApp — ML Pipeline Demo",
  description: "Assignment 17.11: End-to-end ML deployment with late delivery and fraud prediction",
};

async function NavBar() {
  const cookieStore = await cookies();
  const customerId = cookieStore.get("customer_id")?.value;
  let customerName = "";
  if (customerId) {
    const { data } = await supabase
      .from("customers")
      .select("full_name")
      .eq("customer_id", Number(customerId))
      .single();
    customerName = data?.full_name ?? "";
  }

  const links = [
    { href: "/select-customer", label: "Select Customer" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/place-order", label: "Place Order" },
    { href: "/orders", label: "Order History" },
    { href: "/warehouse/priority", label: "Priority Queue" },
    { href: "/scoring", label: "Run Scoring" },
  ];

  return (
    <nav className="bg-slate-900 text-white px-6 py-3 flex items-center gap-6 shadow-md">
      <Link href="/" className="font-bold text-lg tracking-tight mr-2">ShopApp</Link>
      <div className="flex items-center gap-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-3 py-1.5 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            {l.label}
          </Link>
        ))}
      </div>
      {customerName && (
        <span className="ml-auto text-xs bg-slate-700 px-3 py-1 rounded-full text-slate-300">
          {customerName}
        </span>
      )}
    </nav>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen">
        <NavBar />
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
