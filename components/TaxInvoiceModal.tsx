"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Calendar,
  Clock,
  Car,
  Download,
} from "lucide-react";
import {
  formatInvoiceDate,
  numberToWordsINR,
  getStateCode,
} from "@/lib/invoice-utils";

export interface InvoiceBookingData {
  id: string;
  bookingNumber: string;
  invoiceNumber?: string;
  invoiceDate?: string;

  // Customer / Client
  clientType?: "Company" | "Individual Customer";
  customerType?: "Company" | "Individual Customer";
  customerId?: string;
  customerName: string;
  travelerName: string;
  travelerMobile?: string;

  // Duty particulars
  tariffType?: "Local" | "Pickup & Drop" | "Day Rent" | "Outstation" | string;
  tariffPackageName?: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  fromLocation: string;
  toLocation: string;
  travelledPlaces?: string[];

  // Assignment
  vehicleCategory?: string;
  vehicleRegNumber?: string;
  driverName?: string;
  startingKm?: number;
  endingKm?: number;
  totalKm?: number;
  totalHours?: number;
  totalDays?: number;
  durationText?: string;

  // Charges
  baseFare?: number;
  extraHoursRate?: number;
  extraHoursCost?: number;
  extraKmRate?: number;
  extraKmCost?: number;
  driverBataCost?: number;
  nightHaltCost?: number;

  // Fuel configuration / cost
  fuelChargesCost?: number;
  fuelRatePerKm?: number;
  showFuelInInvoice?: boolean;

  // Pass-through
  tolls?: number;
  parking?: number;
  statePermit?: number;
  meals?: number;
  interstateEntryTax?: number;
  totalPassThrough?: number;

  // Advance & Net
  customerAdvance?: number;
  discount?: number;
  grossAmount?: number;
  netAmount?: number;
  balanceAmount?: number;
  receivedAmount?: number;

  // Operating entity
  entityId?: string;
  entityName?: string;
}

interface TaxInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: InvoiceBookingData | null;
  entityData?: any; // Operating entity from Firestore
  companyData?: any; // Customer company from Firestore
  onGenerateInvoice?: (bookingId: string) => Promise<string | void>;
  isGenerating?: boolean;
}

export function TaxInvoiceModal({
  isOpen,
  onClose,
  booking,
  entityData,
  companyData,
  onGenerateInvoice,
  isGenerating = false,
}: TaxInvoiceModalProps) {
  const [mounted, setMounted] = useState(false);
  const invoiceContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !booking || !mounted) return null;

  const isAllocated = !!booking.invoiceNumber;
  const billNo = booking.invoiceNumber || "Not yet allocated";
  const invoiceDateStr = formatInvoiceDate(
    booking.invoiceDate || booking.startDate || new Date()
  );

  // --- Entity / Supplier Profile (Matching screenshot ARUNA CABS fallback) ---
  const supplierName =
    entityData?.legalName ||
    entityData?.entityName ||
    booking.entityName ||
    "ARUNA CABS";

  const supplierAddress =
    entityData?.addressLine1 ||
    entityData?.address ||
    "# 29-13-56, NEAR INDIAN BANK,KALESWARAO ROAD,, SURYARAOPET, VIJAYAWADA - 520002";

  const supplierEmail =
    entityData?.emailForPrint || entityData?.email || "arunacabs9@gmail.com";
  const supplierPhone =
    entityData?.phoneForPrint ||
    entityData?.mobileNumber ||
    entityData?.phone ||
    "9542224422";
  const supplierGstin =
    entityData?.gstin ||
    entityData?.panGstin ||
    "37CTTPN7411C1ZG";
  const supplierState = entityData?.supplierState || "Andhra Pradesh";
  const supplierStateCode = getStateCode(supplierState);

  // Bank details
  const defaultBank =
    entityData?.bankAccounts?.find((b: any) => b.isDefault) ||
    entityData?.bankAccounts?.[0] || {
      bankName: "HDFC",
      accountHolderName: supplierName,
      accountNumber: "99992745274527",
      ifscCode: "HDFC0000568",
    };

  // --- Customer / Bill To Profile ---
  const billToName =
    companyData?.legalName ||
    companyData?.name ||
    booking.customerName ||
    "HIMEROS PHARMA";

  const billToAddress =
    companyData?.address ||
    (companyData?.addressLine1
      ? `${companyData.addressLine1}, ${companyData.city || ""}, ${
          companyData.pinCode || ""
        }`
      : "FLAT NO.102,UMMED CASA BLANCA APPARTMENT,DEVI NAGAR MODE, METRO PILLAR 73,NEW SANGANER ROAD, JAIPUR, 302019");

  const placeOfSupplyState =
    companyData?.billingState || "Rajasthan";
  const placeOfSupplyCode = getStateCode(placeOfSupplyState);
  const billToGstin =
    companyData?.gstin ||
    (companyData?.customerType === "Individual" ||
    booking.clientType === "Individual Customer"
      ? "Unregistered"
      : "08AAMFH6950L1ZR");

  // --- Clean Location Helper (no state code, no state name) ---
  const cleanLocationName = (loc?: string): string => {
    if (!loc) return "";
    let s = loc.split(" — ")[0].split(" - ")[0].split(",")[0].trim();
    return s || loc.trim();
  };

  // --- Travelled Places List (From location -> travelled places -> To location) ---
  const travelledPoints: string[] = [];
  if (booking.fromLocation) {
    const fromClean = cleanLocationName(booking.fromLocation);
    if (fromClean) travelledPoints.push(fromClean);
  }
  if (booking.travelledPlaces && booking.travelledPlaces.length > 0) {
    booking.travelledPlaces.forEach((p) => {
      const cleanP = cleanLocationName(p);
      if (cleanP && !travelledPoints.includes(cleanP)) {
        travelledPoints.push(cleanP);
      }
    });
  }
  if (booking.toLocation) {
    const toClean = cleanLocationName(booking.toLocation);
    if (toClean && !travelledPoints.includes(toClean)) {
      travelledPoints.push(toClean);
    }
  }

  // Duty period string
  const dutyPeriodStr = `${formatInvoiceDate(booking.startDate)} · ${
    booking.startTime || "08:00"
  } → ${booking.endTime || "21:00"}`;

  // Vehicle info
  const vehicleDisplay =
    booking.vehicleRegNumber || booking.vehicleCategory || "AP31TJ0203";

  // Total km & odometer
  const startKm = booking.startingKm ?? 470977;
  const totalKm = booking.totalKm || (booking.endingKm ? Math.max(0, booking.endingKm - startKm) : 159);
  const endKm = booking.endingKm ?? (startKm + totalKm);

  // Duration metrics
  const totalHours = booking.totalHours || 13;
  const totalDays = booking.totalDays || 1;

  // --- Particulars Line Items Calculation (No Taxes) ---
  interface ParticularItem {
    num: number;
    description: string;
    qty: number;
    rate: number;
    amount: number;
  }

  const items: ParticularItem[] = [];
  let itemCounter = 1;

  // 1. Base Fare
  const baseFare = booking.baseFare || 4000;
  let baseDesc = `${booking.tariffType}`;
  if (booking.tariffPackageName) {
    baseDesc += ` (${booking.tariffPackageName})`;
  } else if (booking.tariffType === "Local") {
    baseDesc += " (8 HOURS 80 KM base)";
  }
  items.push({
    num: itemCounter++,
    description: baseDesc,
    qty: 1,
    rate: baseFare,
    amount: baseFare,
  });

  // 2. Extra Hours
  if (booking.extraHoursCost && booking.extraHoursCost > 0) {
    const rate = booking.extraHoursRate || 250;
    const hours = Math.round(booking.extraHoursCost / rate);
    items.push({
      num: itemCounter++,
      description: `Extra Hours (${hours}h × ₹${rate})`,
      qty: 1,
      rate: booking.extraHoursCost,
      amount: booking.extraHoursCost,
    });
  }

  // 3. Extra KM
  if (booking.extraKmCost && booking.extraKmCost > 0) {
    const rate = booking.extraKmRate || 20;
    const km = Math.round(booking.extraKmCost / rate);
    items.push({
      num: itemCounter++,
      description: `Extra KM (${km}km × ₹${rate})`,
      qty: 1,
      rate: booking.extraKmCost,
      amount: booking.extraKmCost,
    });
  }

  // 4. Driver Bata
  if (booking.driverBataCost && booking.driverBataCost > 0) {
    items.push({
      num: itemCounter++,
      description: "Driver Bata",
      qty: 1,
      rate: booking.driverBataCost,
      amount: booking.driverBataCost,
    });
  }

  // 5. Night Halt
  if (booking.nightHaltCost && booking.nightHaltCost > 0) {
    items.push({
      num: itemCounter++,
      description: "Night Halt",
      qty: 1,
      rate: booking.nightHaltCost,
      amount: booking.nightHaltCost,
    });
  }

  // 6. Fuel / Petrol charges if exclusive and showFuelInInvoice is true
  if (booking.showFuelInInvoice && (booking.fuelChargesCost || booking.fuelRatePerKm)) {
    const fuelRate = booking.fuelRatePerKm || 12;
    const fuelAmount = booking.fuelChargesCost || totalKm * fuelRate;
    items.push({
      num: itemCounter++,
      description: `Petrol / Fuel Charges (${totalKm}km × ₹${fuelRate})`,
      qty: 1,
      rate: fuelAmount,
      amount: fuelAmount,
    });
  }

  // 7. Tolls (Pass-through)
  if (booking.tolls && booking.tolls > 0) {
    items.push({
      num: itemCounter++,
      description: "Tolls",
      qty: 1,
      rate: booking.tolls,
      amount: booking.tolls,
    });
  }

  // 8. Parking (Pass-through)
  if (booking.parking && booking.parking > 0) {
    items.push({
      num: itemCounter++,
      description: "Parking",
      qty: 1,
      rate: booking.parking,
      amount: booking.parking,
    });
  }

  // 9. State Permits / Entry / Meals
  const otherPassThrough =
    (booking.statePermit || 0) +
    (booking.interstateEntryTax || 0) +
    (booking.meals || 0);
  if (otherPassThrough > 0) {
    items.push({
      num: itemCounter++,
      description: "State Permit & Entry Charges",
      qty: 1,
      rate: otherPassThrough,
      amount: otherPassThrough,
    });
  }

  // --- Subtotal & Charges Calculation (No Taxes) ---
  const isPassThroughItem = (desc: string) =>
    desc === "Tolls" || desc === "Parking" || desc === "State Permit & Border Taxes";

  const tripSubtotal = items
    .filter((i) => !isPassThroughItem(i.description))
    .reduce((sum, i) => sum + i.amount, 0);

  const passThroughSubtotal = items
    .filter((i) => isPassThroughItem(i.description))
    .reduce((sum, i) => sum + i.amount, 0);

  const totalInvoiceAmount = tripSubtotal + passThroughSubtotal;

  const advancePaid = booking.customerAdvance || 0;
  const balancePayable = Math.max(0, totalInvoiceAmount - advancePaid);

  const amountInWords = numberToWordsINR(totalInvoiceAmount);

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div id="tax-invoice-portal-root">
      <div className="tax-invoice-modal-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
        {/* Container Dialog with fixed 92vh height to enforce inner scrolling */}
        <div className="tax-invoice-dialog-card relative w-full max-w-4xl bg-white rounded-lg shadow-2xl border border-slate-200 flex flex-col h-[92vh] max-h-[92vh] overflow-hidden">
          {/* Top Floating App Bar (Hidden on print) */}
          <div className="tax-invoice-appbar flex items-center justify-between px-4 py-3 bg-slate-900 text-white shrink-0 print:hidden">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#f16623] flex items-center justify-center text-white font-bold text-xs">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-xs tracking-wide">
                  INVOICE — {billNo}
                </span>
                <span className="text-[10px] text-slate-400 ml-2">
                  Booking: {booking.bookingNumber}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isAllocated && onGenerateInvoice && (
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => onGenerateInvoice(booking.id)}
                  className="h-[30px] max-h-[34px] px-3 rounded-[4px] bg-[#f16623] hover:bg-[#d95318] disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isGenerating ? "Allocating..." : "Allocate Invoice Number"}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="h-[30px] max-h-[34px] px-3 rounded-[4px] bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Download PDF</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-[4px] text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* SCROLLABLE INVOICE CANVAS (Paper preview with active scrollbar) */}
          {/* ================================================================= */}
          <div
            ref={invoiceContainerRef}
            className="tax-invoice-canvas flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 bg-slate-100/70 custom-invoice-scrollbar"
          >
            {/* Paper Sheet (Exact Layout from reference invoice) */}
            <div
              id="tax-invoice-printable-sheet"
              className="max-w-[780px] mx-auto bg-white p-6 sm:p-9 shadow-sm border border-slate-200/90 rounded-[2px] space-y-3.5 text-slate-900 font-sans print:p-0 print:shadow-none print:border-none print:max-w-none"
            >
              {/* 1. Header: Left Company Branding, Right Tax Invoice Meta */}
              <div className="flex items-start justify-between gap-4">
                {/* Left Company Details */}
                <div className="space-y-0.5">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                    {supplierName}
                  </h1>
                <p className="text-[11px] text-slate-600 max-w-md leading-tight">
                  {supplierAddress}
                </p>
                <p className="text-[11px] text-slate-600">
                  {supplierEmail} · {supplierPhone}
                </p>
              </div>

                {/* Right Invoice Meta */}
                <div className="text-right shrink-0 space-y-0.5">
                  <h2 className="text-xl sm:text-2xl font-black text-[#f16623] tracking-tight uppercase">
                    INVOICE
                  </h2>
                <div className="text-xs pt-1">
                  <span className="text-slate-500 font-normal mr-2">Bill No</span>
                  <span
                    className={`font-bold font-mono ${
                      isAllocated
                        ? "text-slate-900"
                        : "text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded"
                    }`}
                  >
                    {billNo}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500 font-normal mr-2">Date</span>
                  <span className="font-semibold text-slate-900">
                    {invoiceDateStr}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500 font-normal mr-2">Booking</span>
                  <span className="font-bold font-mono text-slate-900">
                    {booking.bookingNumber}
                  </span>
                </div>
              </div>
            </div>

            {/* Thick Horizontal Rule */}
            <hr className="border-t-[2.5px] border-slate-900 my-2" />

            {/* 2. Side-by-Side Cards: BILL TO and TRIP DETAILS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 invoice-two-col gap-3 text-xs">
              {/* Card 1: BILL TO */}
              <div className="border border-slate-300 rounded-[4px] p-3 space-y-2 flex flex-col justify-between bg-white">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    BILL TO
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 uppercase mt-0.5">
                    {billToName}
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-snug mt-1">
                    {billToAddress}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[11px] space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Traveler Name</span>
                    <span className="font-bold text-slate-900">
                      {booking.travelerName || booking.customerName}
                    </span>
                  </div>
                  {booking.travelerMobile && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Contact No</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {booking.travelerMobile}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: TRIP DETAILS */}
              <div className="border border-slate-300 rounded-[4px] p-3 space-y-2 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    TRIP DETAILS
                  </span>
                </div>

                {/* Vehicle & Duty Period */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold block">
                      VEHICLE
                    </span>
                    <span className="font-black text-sm text-slate-900 font-mono tracking-tight block">
                      {vehicleDisplay}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold block">
                      DUTY PERIOD
                    </span>
                    <span className="font-bold text-[11px] text-slate-900 block leading-tight">
                      {dutyPeriodStr}
                    </span>
                  </div>
                </div>

                {/* Metric Badges: Total KM, Hours, Day */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div className="border border-slate-200 rounded p-1.5 text-center bg-slate-50">
                    <span className="font-black text-sm text-slate-900 font-mono block">
                      {totalKm}
                    </span>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold block">
                      TOTAL KM
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded p-1.5 text-center bg-slate-50">
                    <span className="font-black text-sm text-slate-900 font-mono block">
                      {totalHours}
                    </span>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold block">
                      HOURS
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded p-1.5 text-center bg-slate-50">
                    <span className="font-black text-sm text-slate-900 font-mono block">
                      {totalDays}
                    </span>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold block">
                      DAY
                    </span>
                  </div>
                </div>

                {/* Odometer */}
                <div className="text-[10px] text-slate-500 font-mono text-center pt-0.5">
                  Odometer <strong className="text-slate-800">{startKm}</strong> →{" "}
                  <strong className="text-slate-800">{endKm}</strong>
                </div>
              </div>
            </div>

            {/* 2b. Card 3: TRAVELLED PLACES (Full-width box below BILL TO and TRIP DETAILS) */}
            <div className="border border-slate-300 rounded-[4px] p-2.5 bg-white space-y-1">
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                TRAVELLED PLACES
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-900 font-medium leading-relaxed">
                {travelledPoints.length > 0 ? (
                  travelledPoints.map((pt, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && (
                        <span className="text-[#f16623] font-bold px-0.5 select-none">
                          →
                        </span>
                      )}
                      <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-slate-800">
                        {pt}
                      </span>
                    </React.Fragment>
                  ))
                ) : (
                  <span className="text-slate-400 text-xs italic">
                    {cleanLocationName(booking.fromLocation)} → {cleanLocationName(booking.toLocation)}
                  </span>
                )}
              </div>
            </div>

            {/* 3. Table of Particulars (Matching Exact Table in Screenshot) */}
            <div className="relative border-t-2 border-b-2 border-slate-900 mt-2">
              {/* Draft Watermark if not finalized */}
              {!isAllocated && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
                  <span className="text-slate-200/80 text-7xl sm:text-8xl font-black -rotate-12 tracking-widest">
                    DRAFT
                  </span>
                </div>
              )}

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-[10px] uppercase font-bold text-slate-700">
                    <th className="py-2 px-2 w-8 text-center">#</th>
                    <th className="py-2 px-3">PARTICULARS</th>
                    <th className="py-2 px-2 w-14 text-center">QTY</th>
                    <th className="py-2 px-3 w-32 text-right">RATE (₹)</th>
                    <th className="py-2 px-3 w-32 text-right">AMOUNT (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-normal">
                  {items.map((row) => (
                    <tr key={row.num} className="hover:bg-slate-50/40">
                      <td className="py-1.5 px-2 text-center text-slate-500 font-mono">
                        {row.num}
                      </td>
                      <td className="py-1.5 px-3 text-slate-900 font-medium">
                        {row.description}
                      </td>
                      <td className="py-1.5 px-2 text-center text-slate-700 font-mono">
                        {row.qty}
                      </td>
                      <td className="py-1.5 px-3 text-right text-slate-800 font-mono">
                        {row.rate.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-900 font-mono">
                        {row.amount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 4. Amount in Words and Total Breakdown (Zero Tax) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 invoice-split-cols gap-4 pt-1 items-start">
              {/* Left Column: Amount in Words */}
              <div className="sm:col-span-7 print:col-span-7 space-y-1.5 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    AMOUNT IN WORDS
                  </span>
                  <p className="font-bold text-slate-900 leading-snug pt-0.5">
                    {amountInWords}
                  </p>
                </div>
              </div>

              {/* Right Column: Only Total (No Subtotal or Pass-through rows) */}
              <div className="sm:col-span-5 print:col-span-5 text-xs space-y-1">
                {/* Grand Total */}
                <div className="border-t-2 border-b-2 border-slate-900 py-1.5 flex justify-between items-baseline">
                  <span className="font-black text-sm uppercase text-slate-900">
                    Total
                  </span>
                  <span className="font-black text-lg text-slate-900 font-mono">
                    ₹{" "}
                    {totalInvoiceAmount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {/* Advance Deductions if any */}
                {advancePaid > 0 && (
                  <div className="pt-1 text-[11px] text-emerald-700 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Less: Advance Received</span>
                      <span className="font-mono">
                        − ₹{advancePaid.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 pt-0.5 border-t border-slate-200">
                      <span>Net Balance Payable</span>
                      <span className="font-mono text-[#f16623]">
                        ₹{balancePayable.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Footer: Bank Details & Authorised Signatory */}
            <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 invoice-split-cols gap-4 pt-3 items-end">
              {/* Left: Bank Details Box */}
              <div className="sm:col-span-7 print:col-span-7 border border-slate-300 rounded-[4px] p-3 text-xs space-y-1 bg-white">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  BANK ACCOUNT DETAILS
                </span>
                <div className="grid grid-cols-12 gap-1 text-[11px] pt-0.5">
                  <span className="col-span-3 text-slate-500">Bank</span>
                  <span className="col-span-9 font-bold text-slate-900">
                    {defaultBank.bankName}
                  </span>

                  <span className="col-span-3 text-slate-500">Name</span>
                  <span className="col-span-9 font-bold text-slate-900">
                    {defaultBank.accountHolderName || supplierName}
                  </span>

                  <span className="col-span-3 text-slate-500">A/C No</span>
                  <span className="col-span-9 font-black text-slate-900 font-mono tracking-wider">
                    {defaultBank.accountNumber}
                  </span>

                  <span className="col-span-3 text-slate-500">IFSC</span>
                  <span className="col-span-9 font-bold text-slate-900 font-mono">
                    {defaultBank.ifscCode}
                  </span>
                </div>
              </div>

              {/* Right: Signature */}
              <div className="sm:col-span-5 print:col-span-5 text-right space-y-9">
                <p className="text-xs font-bold text-slate-900">
                  For {supplierName}
                </p>
                <div className="border-t border-slate-300 pt-1 inline-block min-w-[180px] text-center">
                  <span className="text-[11px] text-slate-600 block">
                    Authorised Signatory
                  </span>
                </div>
              </div>
            </div>

            {/* 6. Legal Jurisdiction & Draft Disclaimer */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400 gap-1">
              <span>
                {!isAllocated
                  ? "DRAFT — invoice number will be allocated on finalize."
                  : "Final Invoice issued electronically."}
              </span>
              <span>
                Subject to Vijayawada jurisdiction · E.&O.E.
              </span>
            </div>
          </div>
        </div>

        {/* Global styles for custom scrollbar & native print styling */}
        <style dangerouslySetInnerHTML={{
          __html: `
            .custom-invoice-scrollbar {
              scrollbar-width: thin;
              scrollbar-color: #94a3b8 #f1f5f9;
            }
            .custom-invoice-scrollbar::-webkit-scrollbar {
              width: 8px;
            }
            .custom-invoice-scrollbar::-webkit-scrollbar-track {
              background: #f1f5f9;
            }
            .custom-invoice-scrollbar::-webkit-scrollbar-thumb {
              background: #94a3b8;
              border-radius: 4px;
            }
            .custom-invoice-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #64748b;
            }

            @media print {
              @page {
                size: A4 portrait;
                margin: 6mm 8mm;
              }

              /* Hide the entire background web application */
              body > *:not(#tax-invoice-portal-root) {
                display: none !important;
              }

              html, body {
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              #tax-invoice-portal-root {
                display: block !important;
                position: static !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                overflow: visible !important;
              }

              .tax-invoice-modal-backdrop {
                position: static !important;
                background: transparent !important;
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
                overflow: visible !important;
              }

              .tax-invoice-dialog-card {
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                height: auto !important;
                max-height: none !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                overflow: visible !important;
                background: transparent !important;
              }

              .tax-invoice-appbar {
                display: none !important;
              }

              .tax-invoice-canvas {
                background: transparent !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
                height: auto !important;
              }

              #tax-invoice-printable-sheet {
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                padding: 0 !important;
                margin: 0 auto !important;
                width: 100% !important;
                max-width: 760px !important;
                background: #ffffff !important;
              }

              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `
        }} />
      </div>
    </div>
  </div>,
  document.body
);
}
