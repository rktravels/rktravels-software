"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  FileSpreadsheet,
} from "lucide-react";
import type { BookingRecord } from "@/app/bookings/page";

interface TripSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingRecord | null;
  entityData?: any;
}

/**
 * Format date to DD-Mon-YYYY (e.g. 26-Nov-2026) matching Duty Slip image
 */
function formatTripDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format 24hr or already formatted time string to 12hr AM/PM (e.g. 6:00 AM)
 */
function formatTime12Hr(timeStr?: string): string {
  if (!timeStr) return "";
  try {
    if (/am|pm/i.test(timeStr)) return timeStr.toUpperCase();
    const parts = timeStr.split(":");
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] || "00";
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes.padStart(2, "0")} ${ampm}`;
  } catch {
    return timeStr;
  }
}

/**
 * Extract or compute 5-digit Duty Slip number matching "No : 00018"
 */
function getDutySlipNumber(booking?: BookingRecord | null): string {
  if (!booking) return "00018";
  if ((booking as any).dutySlipNumber) {
    return String((booking as any).dutySlipNumber).padStart(5, "0");
  }
  const digits = (booking.bookingNumber || "").replace(/\D/g, "");
  if (digits.length >= 5) {
    return digits.slice(-5);
  }
  if (digits.length > 0) {
    return digits.padStart(5, "0");
  }
  return "00018";
}

export default function TripSheetModal({
  isOpen,
  onClose,
  booking,
  entityData,
}: TripSheetModalProps) {
  const [mounted, setMounted] = useState(false);
  const [generatedTimestamp, setGeneratedTimestamp] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const datePart = `${String(now.getDate()).padStart(2, "0")}/${String(
        now.getMonth() + 1
      ).padStart(2, "0")}/${now.getFullYear()}`;
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12;
      hours = hours ? hours : 12;
      setGeneratedTimestamp(
        `${datePart}, ${hours}:${minutes}:${seconds} ${ampm}`
      );
    }
  }, [isOpen]);

  if (!mounted || !isOpen || !booking) return null;

  const dutySlipNo = getDutySlipNumber(booking);

  // Entity Details
  const entityName =
    entityData?.tradeName ||
    entityData?.legalName ||
    booking.entityName ||
    "RK TRAVELS";
  const entityAddress = entityData?.addressLine1
    ? [
        entityData.addressLine1,
        entityData.addressLine2,
        entityData.city
          ? `${entityData.city} - ${entityData.pin || ""}`
          : entityData.pin,
      ]
        .filter(Boolean)
        .join(", ")
    : "# 29-13-56, NEAR INDIAN BANK, KALESWARAO ROAD, SURYARAOPET, VIJAYAWADA - 520002";
  const entityContact =
    entityData?.phoneForPrint ||
    entityData?.phone ||
    entityData?.mobileNumber ||
    "9542224422";

  // Service City
  const serviceCity =
    booking.fromLocation?.split(",")[0]?.trim()?.toUpperCase() || "VIJAYAWADA";

  // Travel Dates & Times
  const bookingDateFormatted = formatTripDate(booking.startDate);
  const travelDateFormatted = formatTripDate(booking.startDate);
  const closeDateFormatted = booking.endDate
    ? formatTripDate(booking.endDate)
    : "";
  const reportingTimeFormatted = formatTime12Hr(booking.startTime);
  const closingTimeFormatted = booking.endTime
    ? formatTime12Hr(booking.endTime)
    : "";

  // Travel Type
  const travelType = (
    booking.tariffType ||
    booking.tariffPackageName ||
    "OUTSTATION"
  ).toUpperCase();

  // Car Details
  const carType = (
    booking.vehicleCategory ||
    booking.vehicleName ||
    "CRYSTA (A/C)"
  ).toUpperCase();
  const carNo = (booking.vehicleRegNumber || "—").toUpperCase();

  // Driver Details
  const driverName = (booking.driverName || "—").toUpperCase();
  const driverMobile = booking.driverMobile || "—";

  // Customer / Traveler
  const companyName = (booking.customerName || "—").toUpperCase();
  const guestName = (booking.travelerName || "—").toUpperCase();
  const guestMobile = booking.travelerMobile || "—";
  const bookedBy = `${companyName || guestName}${
    booking.customerId ? ` (${booking.customerId.slice(-6).toUpperCase()})` : ""
  }`;

  // Locations
  const reportingAddress = booking.fromLocation || "VIJAYAWADA — Andhra Pradesh";
  const dropOffLocation = booking.toLocation || "";

  // Trip Log Details
  const startKm =
    booking.startingKm !== undefined && booking.startingKm !== null
      ? String(booking.startingKm)
      : "";
  const closingKm =
    booking.endingKm !== undefined &&
    booking.endingKm !== null &&
    booking.endingKm > 0
      ? String(booking.endingKm)
      : "";
  const totalKm =
    booking.totalKm !== undefined && booking.totalKm !== null && booking.totalKm > 0
      ? String(booking.totalKm)
      : "";
  const tollsVal = booking.tolls ? `₹ ${booking.tolls}` : "";
  const parkingVal = booking.parking ? `₹ ${booking.parking}` : "";
  const interstateTaxVal = booking.interstateEntryTax
    ? `₹ ${booking.interstateEntryTax}`
    : "";

  // Route / Travelled places
  const tripDetailsText =
    booking.travelledPlaces && booking.travelledPlaces.length > 0
      ? booking.travelledPlaces.join(", ")
      : booking.fromLocation && booking.toLocation
      ? `${booking.fromLocation} — ${booking.toLocation}`
      : booking.fromLocation || "—";

  // Advance
  const customerAdvance = booking.customerAdvance || 0;

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div
      id="trip-sheet-portal-root"
      className="fixed inset-0 z-[999999] overflow-y-auto bg-slate-900/80 backdrop-blur-sm trip-sheet-modal-backdrop flex justify-center p-0 md:p-6 select-text"
      role="dialog"
      aria-modal="true"
    >
      <div className="trip-sheet-dialog-card relative w-full max-w-4xl bg-slate-100 shadow-2xl flex flex-col my-auto overflow-hidden">
        {/* ================================================================= */}
        {/* TOP TOOLBAR (Hidden on print) */}
        {/* ================================================================= */}
        <div className="trip-sheet-appbar sticky top-0 z-20 bg-slate-900 text-white px-4 py-3 md:px-6 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-[#f16623] flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm md:text-base text-white">
                  Duty Slip / Trip Sheet
                </h2>
                <span className="text-[11px] font-mono font-semibold bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded border border-orange-500/30">
                  No: {dutySlipNo}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Booking Ref: {booking.bookingNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#f16623] hover:bg-[#d9531e] text-white text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Trip Sheet</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SCROLLABLE SHEET CANVAS */}
        {/* ================================================================= */}
        <div className="trip-sheet-canvas overflow-y-auto custom-invoice-scrollbar p-3 md:p-8 flex justify-center bg-slate-200/80">
          <div
            id="trip-sheet-printable-sheet"
            className="w-full max-w-[210mm] min-h-[297mm] bg-white text-black shadow-lg p-6 sm:p-8 md:p-10 font-sans text-[12px] leading-normal flex flex-col justify-between box-border border border-black print:border-none print:shadow-none print:p-0 print:m-0"
            style={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
              borderRadius: "0px",
            }}
          >
            <div>
              {/* Top Row: Slip Number */}
              <div className="flex justify-end mb-1">
                <div className="text-[13px] font-normal tracking-tight text-black">
                  No : <span className="font-bold font-mono text-[14px]">{dutySlipNo}</span>
                </div>
              </div>

              {/* Company Header */}
              <div className="text-center mb-2">
                <h1 className="text-xl md:text-2xl font-black tracking-wide uppercase text-black">
                  {entityName}
                </h1>
                <p className="text-[11px] font-normal text-black mt-1">
                  Registered Office: {entityAddress}
                </p>
                <p className="text-[11px] font-normal text-black mt-0.5">
                  Contact No.: {entityContact}
                </p>
              </div>

              {/* Straight Dividing Rule */}
              <div className="border-t-[1.5px] border-black mb-2"></div>

              {/* Centered Document Title */}
              <div className="text-center mb-2.5">
                <h2 className="text-[13px] md:text-[14px] font-bold uppercase tracking-wider text-black">
                  DUTY SLIP / TRIP SHEET
                </h2>
              </div>

              {/* ============================================================= */}
              {/* MAIN DETAILS TABLE (STRAIGHT 100% COLLAPSED BORDERS) */}
              {/* Labels: font-normal. Values: font-bold */}
              {/* ============================================================= */}
              <table
                className="w-full border-collapse border border-black mb-3 text-[11px] md:text-[12px] bg-white text-black"
                style={{
                  borderCollapse: "collapse",
                  borderSpacing: "0px",
                  borderRadius: "0px",
                }}
              >
                <tbody>
                  {/* Row 1 */}
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal text-black w-[20%]">
                      Booking Date
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black w-[30%]">
                      {bookingDateFormatted || "—"}
                    </td>
                    <td className="border border-black px-2 py-1.5 font-normal text-black w-[20%]">
                      Booking Ref No.
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black w-[30%]">
                      {booking.bookingNumber || "—"}
                    </td>
                  </tr>

                  {/* Row 2 */}
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Service City
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {serviceCity}
                    </td>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Duty Slip No.
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold font-mono text-black">
                      {dutySlipNo}
                    </td>
                  </tr>

                  {/* Row 3 */}
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Travel Date
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {travelDateFormatted || "—"}
                    </td>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      DS Close Date
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {closeDateFormatted}
                    </td>
                  </tr>

                  {/* Row 4 (Name of Company spans across 3 columns) */}
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Name of Company
                    </td>
                    <td colSpan={3} className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {companyName}
                    </td>
                  </tr>

                  {/* Row 5 */}
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Guest Name
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {guestName}
                    </td>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Contact No.
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold text-black">
                      {guestMobile}
                    </td>
                  </tr>

                  {/* Row 6 */}
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Booked By
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {bookedBy}
                    </td>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Mobile No.
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold text-black">
                      {guestMobile}
                    </td>
                  </tr>

                  {/* Row 7 */}
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Reporting Time
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {reportingTimeFormatted || "—"}
                    </td>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Reporting Address
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {reportingAddress}
                    </td>
                  </tr>

                  {/* Row 8 */}
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Closing Time
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {closingTimeFormatted}
                    </td>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Drop Off Location
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {dropOffLocation}
                    </td>
                  </tr>

                  {/* Row 9 (Type of Travel spans across 3 columns) */}
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Type of Travel
                    </td>
                    <td colSpan={3} className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {travelType}
                    </td>
                  </tr>

                  {/* Row 10 */}
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Car Type
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {carType}
                    </td>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Car No.
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold font-mono uppercase tracking-wider text-black">
                      {carNo}
                    </td>
                  </tr>

                  {/* Row 11 */}
                  <tr>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Driver Name
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                      {driverName}
                    </td>
                    <td className="border border-black px-2 py-1.5 font-normal text-black">
                      Mobile No.
                    </td>
                    <td className="border border-black px-2 py-1.5 font-bold text-black">
                      {driverMobile}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ============================================================= */}
              {/* TRIP LOG SECTION (STRAIGHT COLLAPSED TABLE) */}
              {/* Labels: font-normal. Values: font-bold */}
              {/* ============================================================= */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-[12px] md:text-[13px] uppercase tracking-wide text-black">
                    TRIP LOG
                  </span>
                  <div className="h-[1.5px] bg-black w-24"></div>
                </div>

                <table
                  className="w-full border-collapse border border-black text-[11px] md:text-[12px] bg-white text-black"
                  style={{
                    borderCollapse: "collapse",
                    borderSpacing: "0px",
                    borderRadius: "0px",
                  }}
                >
                  <thead>
                    <tr>
                      <th className="border border-black py-1.5 px-1 font-normal text-center text-[10px] md:text-[11px] text-black w-[16.66%]">
                        START KM
                      </th>
                      <th className="border border-black py-1.5 px-1 font-normal text-center text-[10px] md:text-[11px] text-black w-[16.66%]">
                        CLOSING KM
                      </th>
                      <th className="border border-black py-1.5 px-1 font-normal text-center text-[10px] md:text-[11px] text-black w-[16.66%]">
                        TOTAL KM
                      </th>
                      <th className="border border-black py-1.5 px-1 font-normal text-center text-[10px] md:text-[11px] text-black w-[16.66%]">
                        TOLLS
                      </th>
                      <th className="border border-black py-1.5 px-1 font-normal text-center text-[10px] md:text-[11px] text-black w-[16.66%]">
                        PARKING
                      </th>
                      <th className="border border-black py-1.5 px-1 font-normal text-center text-[10px] md:text-[11px] text-black w-[16.66%]">
                        INTERSTATE TAX
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ height: "42px" }}>
                      <td className="border border-black py-2 px-1 text-center font-bold font-mono text-[12px] text-black">
                        {startKm}
                      </td>
                      <td className="border border-black py-2 px-1 text-center font-bold font-mono text-[12px] text-black">
                        {closingKm}
                      </td>
                      <td className="border border-black py-2 px-1 text-center font-bold font-mono text-[12px] text-black">
                        {totalKm}
                      </td>
                      <td className="border border-black py-2 px-1 text-center font-bold text-black">
                        {tollsVal}
                      </td>
                      <td className="border border-black py-2 px-1 text-center font-bold text-black">
                        {parkingVal}
                      </td>
                      <td className="border border-black py-2 px-1 text-center font-bold text-black">
                        {interstateTaxVal}
                      </td>
                    </tr>

                    {/* Trip Details */}
                    <tr>
                      <td className="border border-black px-2 py-1.5 font-normal text-black">
                        Trip Details
                      </td>
                      <td colSpan={5} className="border border-black px-2 py-1.5 font-bold uppercase text-black">
                        {tripDetailsText}
                      </td>
                    </tr>

                    {/* Next Day Instructions */}
                    <tr style={{ minHeight: "32px" }}>
                      <td className="border border-black px-2 py-1.5 font-normal text-black">
                        Next Day Instructions
                      </td>
                      <td colSpan={5} className="border border-black px-2 py-1.5 font-normal text-black">
                        {booking.notes || ""}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ============================================================= */}
              {/* ADDITIONAL CHARGES SECTION (STRAIGHT COLLAPSED TABLE) */}
              {/* Labels: font-normal. Values: font-bold */}
              {/* ============================================================= */}
              <div className="mb-4">
                <div className="font-bold text-[12px] md:text-[13px] uppercase tracking-wide mb-1 text-black">
                  ADDITIONAL CHARGES
                </div>

                <table
                  className="w-full border-collapse border border-black text-[11px] md:text-[12px] bg-white text-black"
                  style={{
                    borderCollapse: "collapse",
                    borderSpacing: "0px",
                    borderRadius: "0px",
                  }}
                >
                  <tbody>
                    {/* Advance Row */}
                    <tr>
                      <td className="border border-black px-2 py-1.5 font-normal text-black w-[58%]">
                        CUSTOMER ADVANCE (ONLINE OR CASH)
                      </td>
                      <td className="border border-black px-3 py-1.5 font-bold font-mono text-black w-[42%]">
                        ₹ {customerAdvance.toFixed(2)}
                      </td>
                    </tr>

                    {/* Food Allowance Row */}
                    <tr>
                      <td className="border border-black px-2 py-1.5 font-normal text-black">
                        FOOD ALLOWANCE
                      </td>
                      <td className="border border-black px-3 py-1.5 text-black">
                        <div className="flex items-center gap-6">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block bg-white"
                              style={{
                                width: "13px",
                                height: "13px",
                                border: "1px solid #000000",
                                borderRadius: "0px",
                              }}
                            ></span>
                            <span className="font-normal text-black">Yes</span>
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block bg-white"
                              style={{
                                width: "13px",
                                height: "13px",
                                border: "1px solid #000000",
                                borderRadius: "0px",
                              }}
                            ></span>
                            <span className="font-normal text-black">No</span>
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Tips Row */}
                    <tr>
                      <td className="border border-black px-2 py-1.5 font-normal text-black">
                        TIPS (not included in bill)
                      </td>
                      <td className="border border-black px-3 py-1.5 text-black">
                        <div className="flex items-center gap-6">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block bg-white"
                              style={{
                                width: "13px",
                                height: "13px",
                                border: "1px solid #000000",
                                borderRadius: "0px",
                              }}
                            ></span>
                            <span className="font-normal text-black">Yes</span>
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block bg-white"
                              style={{
                                width: "13px",
                                height: "13px",
                                border: "1px solid #000000",
                                borderRadius: "0px",
                              }}
                            ></span>
                            <span className="font-normal text-black">No</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ============================================================= */}
            {/* FOOTER: TERMS & CONDITIONS + SIGNATURE BOX */}
            {/* ============================================================= */}
            <div className="pt-2">
              <table
                className="w-full border-collapse"
                style={{
                  borderCollapse: "collapse",
                  borderSpacing: "0px",
                  borderRadius: "0px",
                }}
              >
                <tbody>
                  <tr>
                    {/* Terms and Conditions (Left) */}
                    <td
                      className="text-[10px] md:text-[11px] leading-relaxed text-black align-bottom pr-4"
                      style={{ border: "none", width: "65%" }}
                    >
                      <div className="font-bold text-[11px] mb-0.5 text-black">
                        Terms and Conditions
                      </div>
                      <div>1. The vehicle will be charged from garage to garage.</div>
                      <div>
                        2. Closing time, closing kilometres and other trip particulars
                        are to be filled in by the customer.
                      </div>
                      <div>
                        3. The company is not responsible for any articles left in the
                        vehicle.
                      </div>
                    </td>

                    {/* Signature Box (Right) */}
                    <td
                      style={{
                        border: "1px solid #000000",
                        borderRadius: "0px",
                        width: "35%",
                        height: "90px",
                        verticalAlign: "bottom",
                        padding: "6px",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <div
                        className="text-center font-normal text-[11px] text-black pt-1"
                        style={{ borderTop: "1px solid #000000" }}
                      >
                        User&apos;s Signature
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Disclaimer & Generation Timestamp */}
              <div
                className="text-center text-[9px] md:text-[10px] text-slate-600 mt-3 pt-1"
                style={{ borderTop: "1px solid #cccccc" }}
              >
                Internal duty slip for trip coordination — not a tax invoice. Fare
                and tax are billed separately. Generated {generatedTimestamp}.
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* PRINT & SHARP BORDER SPECIFIC STYLES */}
        {/* ================================================================= */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
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

            /* Ensure all tables and borders inside printable sheet are razor-sharp 90 degree corners */
            #trip-sheet-printable-sheet,
            #trip-sheet-printable-sheet * {
              border-radius: 0px !important;
            }

            #trip-sheet-printable-sheet table {
              border-collapse: collapse !important;
              border-spacing: 0px !important;
            }

            #trip-sheet-printable-sheet th,
            #trip-sheet-printable-sheet td {
              border-radius: 0px !important;
            }

            @media print {
              @page {
                size: A4 portrait;
                margin: 0mm;
              }

              body > *:not(#trip-sheet-portal-root) {
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

              #trip-sheet-portal-root {
                display: block !important;
                position: static !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                overflow: visible !important;
              }

              .trip-sheet-modal-backdrop {
                position: static !important;
                background: transparent !important;
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
                overflow: visible !important;
              }

              .trip-sheet-dialog-card {
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

              .trip-sheet-appbar {
                display: none !important;
              }

              .trip-sheet-canvas {
                background: transparent !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
                height: auto !important;
              }

              #trip-sheet-printable-sheet {
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                padding: 12mm 12mm 10mm 12mm !important;
                margin: 0 auto !important;
                width: 100% !important;
                max-width: 100% !important;
                min-height: auto !important;
                background: #ffffff !important;
                box-sizing: border-box !important;
              }

              #trip-sheet-printable-sheet table {
                border-collapse: collapse !important;
                border-spacing: 0px !important;
              }

              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `,
          }}
        />
      </div>
    </div>,
    document.body
  );
}
