import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-4xl font-bold text-slate-900 mb-3">ShopApp</h1>
      <p className="text-slate-500 max-w-md mb-8">
        ML-powered e-commerce platform with real-time late delivery and fraud prediction models.
      </p>
      <Link
        href="/select-customer"
        className="bg-slate-900 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
      >
        Get Started
      </Link>
    </div>
  );
}
