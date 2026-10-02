"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Building2 } from "lucide-react";

export default function BusinessOwnersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/companies");
  }, [router]);

  return (
    <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
      <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center text-[#f16623]">
        <Building2 className="w-5 h-5 animate-pulse" />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
        <Loader2 className="w-4 h-4 animate-spin text-[#f16623]" />
        <span>Redirecting to Companies directory...</span>
      </div>
    </div>
  );
}
