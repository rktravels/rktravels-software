"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CustomerTariffRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/customer-tariffs");
  }, [router]);

  return (
    <div className="p-8 text-center text-xs text-slate-500">
      Redirecting to Customer Tariffs...
    </div>
  );
}
