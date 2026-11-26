import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 font-sans">
      <div className="w-14 h-14 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-[#f16623] mb-3 shadow-xs">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">404 - Page Not Found</h1>
      <p className="text-xs text-slate-500 max-w-sm mt-1">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#f16623] text-white text-xs font-medium hover:bg-[#d95318] transition shadow-xs"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
}
