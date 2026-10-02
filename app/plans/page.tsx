"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function PlansRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/tariffs");
  }, [router]);

  return (
    <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
      <span className="text-xs font-normal">Redirecting to Tariffs...</span>
    </div>
  );
}
