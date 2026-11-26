"use client";

import React from "react";
import { Fuel } from "lucide-react";

export interface FuelChargesConfig {
  fuelType: "Inclusive" | "Exclusive";
  fuelRatePerKm: number | string;
  showFuelInInvoice: boolean;
}

export const DEFAULT_FUEL_CHARGES_CONFIG: FuelChargesConfig = {
  fuelType: "Inclusive",
  fuelRatePerKm: "",
  showFuelInInvoice: false,
};

interface FuelChargesCardProps {
  dutyTitle: string;
  config: FuelChargesConfig;
  onChange: (cfg: FuelChargesConfig) => void;
}

export function FuelChargesCard({
  dutyTitle,
  config,
  onChange,
}: FuelChargesCardProps) {
  const currentConfig: FuelChargesConfig = {
    fuelType: config?.fuelType || "Inclusive",
    fuelRatePerKm: config?.fuelRatePerKm ?? "",
    showFuelInInvoice: !!config?.showFuelInInvoice,
  };

  const isExclusive = currentConfig.fuelType === "Exclusive";

  return (
    <div className="bg-slate-50/80 p-3.5 rounded-[6px] border border-slate-200 space-y-3 mt-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[4px] bg-orange-100/70 text-[#f16623] flex items-center justify-center">
            <Fuel className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-900 leading-tight">
              Fuel / Petrol Charges Policy ({dutyTitle} Duty)
            </h4>
            <p className="text-[10px] text-slate-500 font-normal">
              Specify whether fuel cost is inclusive or charged separately (Exclusive)
            </p>
          </div>
        </div>
        <span className="text-[10px] text-slate-500 font-mono self-start sm:self-auto bg-slate-200/60 px-2 py-0.5 rounded">
          Default: Inclusive
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Radios: Inclusive vs Exclusive */}
        <div className="md:col-span-6 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer select-none">
            <input
              type="radio"
              name={`fuel-policy-${dutyTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              checked={currentConfig.fuelType === "Inclusive"}
              onChange={() =>
                onChange({
                  ...currentConfig,
                  fuelType: "Inclusive",
                })
              }
              className="w-4 h-4 text-[#f16623] accent-[#f16623] cursor-pointer"
            />
            <span>Fuel Inclusive (Included in Fare)</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer select-none">
            <input
              type="radio"
              name={`fuel-policy-${dutyTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              checked={currentConfig.fuelType === "Exclusive"}
              onChange={() =>
                onChange({
                  ...currentConfig,
                  fuelType: "Exclusive",
                  showFuelInInvoice: true,
                })
              }
              className="w-4 h-4 text-[#f16623] accent-[#f16623] cursor-pointer"
            />
            <span>Fuel Exclusive (Billed to Client)</span>
          </label>
        </div>

        {/* If Exclusive: Explain auto calculation */}
        <div className="md:col-span-6">
          {isExclusive ? (
            <div className="text-[11px] text-amber-900 bg-amber-50/80 border border-amber-200 rounded px-2.5 py-1.5 leading-snug">
              Auto-calculated for trip: <br />
              <strong className="font-mono text-slate-900 font-semibold">
                (Total KM ÷ Vehicle Mileage) × Entity Fuel Rate
              </strong>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 italic">
              All package prices and extra km slabs include fuel charges by default.
            </div>
          )}
        </div>
      </div>

      {/* If Exclusive: Display Checkbox to show in invoice */}
      {isExclusive && (
        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/50 p-2.5 rounded-[4px] border border-amber-200/60">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={currentConfig.showFuelInInvoice}
              onChange={(e) =>
                onChange({
                  ...currentConfig,
                  showFuelInInvoice: e.target.checked,
                })
              }
              className="w-4 h-4 rounded text-[#f16623] accent-[#f16623] cursor-pointer"
            />
            <span>Display petrol / fuel charges in invoice</span>
          </label>
          <span className="text-[11px] text-amber-800 font-normal">
            {currentConfig.showFuelInInvoice
              ? "✓ Fuel charges will be itemized as a separate row on generated invoices ((Total KM ÷ Mileage) × Fuel Price)."
              : "Fuel charges will not be shown as a separate row in invoice particulars."}
          </span>
        </div>
      )}
    </div>
  );
}
