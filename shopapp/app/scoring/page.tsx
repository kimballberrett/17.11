import ScoringButton from "./ScoringButton";
import Link from "next/link";

export default function ScoringPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Run ML Scoring</h1>
      <p className="text-slate-500 text-sm mb-6">
        This triggers the ML inference pipeline on unfulfilled orders (orders that haven&apos;t shipped yet).
        It runs two models:
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Late Delivery Model</h3>
          <p className="text-xs text-slate-500">
            Predicts the probability of late delivery based on order size, customer history, and item details.
            Results appear in the <Link href="/warehouse/priority" className="text-blue-600 hover:underline">Priority Queue</Link>.
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Fraud Detection Model</h3>
          <p className="text-xs text-slate-500">
            Predicts fraud probability using payment, device, and order features (from the CRISP-DM notebook).
            Results appear in <Link href="/orders" className="text-blue-600 hover:underline">Order History</Link>.
          </p>
        </div>
      </div>

      <ScoringButton />

      <p className="text-xs text-slate-400 mt-4">
        Note: The database has {">"}5,000 historical orders that are already shipped. Only newly placed orders will be unfulfilled and appear in the priority queue after scoring.
      </p>
    </div>
  );
}
