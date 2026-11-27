import puppeteer from "puppeteer-core";
import fs from "fs";

export interface InvoicePdfParams {
  booking: any;
  entityData?: any;
  companyData?: any;
}

function formatInvoiceDate(d?: any): string {
  if (!d) return "17 Nov 2026";
  try {
    let dateObj: Date;
    if (typeof d === "string") {
      dateObj = new Date(d.includes("T") ? d : d + "T00:00:00");
    } else if (d.toDate && typeof d.toDate === "function") {
      dateObj = d.toDate();
    } else {
      dateObj = new Date(d);
    }
    if (isNaN(dateObj.getTime())) return String(d);
    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = dateObj.toLocaleString("en-IN", { month: "short" });
    const year = dateObj.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return String(d);
  }
}

function cleanLocationName(loc?: string): string {
  if (!loc) return "";
  let s = loc.split(" — ")[0].split(" - ")[0].split(",")[0].trim();
  return s || loc.trim();
}

function numberToWordsINR(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded <= 0) return "INR Zero rupees only";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  function convertTwoDigits(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "") + " ";
  }

  function convertGroup(n: number): string {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    str += convertTwoDigits(n);
    return str;
  }

  let crore = Math.floor(rounded / 10000000);
  let remainder = rounded % 10000000;
  let lakh = Math.floor(remainder / 100000);
  remainder %= 100000;
  let thousand = Math.floor(remainder / 1000);
  let rest = remainder % 1000;

  let result = "";
  if (crore > 0) result += convertGroup(crore) + "Crore ";
  if (lakh > 0) result += convertGroup(lakh) + "Lakh ";
  if (thousand > 0) result += convertGroup(thousand) + "Thousand ";
  if (rest > 0) result += convertGroup(rest);

  return "INR " + result.trim() + " rupees only";
}

export function buildInvoiceHtml({
  booking,
  entityData = {},
  companyData = {},
}: InvoicePdfParams): string {
  const supplierName =
    entityData?.legalName ||
    entityData?.entityName ||
    booking.entityName ||
    "RK TRAVELS";
  const supplierAddress =
    entityData?.addressLine1 ||
    entityData?.address ||
    "#39-15-50,MAIN ROAD,OPP MY HOME APARTMENT";
  const supplierEmail =
    entityData?.emailForPrint || entityData?.email || "rktravels.vja@gmail.com";
  const supplierPhone =
    entityData?.phoneForPrint ||
    entityData?.mobileNumber ||
    entityData?.phone ||
    "9948228877";

  const billToName =
    companyData?.legalName ||
    companyData?.name ||
    booking.customerName ||
    "TESTIUNG COMPANY";
  const billToAddress =
    companyData?.address ||
    (companyData?.addressLine1
      ? `${companyData.addressLine1}, ${companyData.city || ""}, ${companyData.pinCode || ""}`
      : "FLAT NO.102,UMMED CASA BLANCA APPARTMENT,DEVI NAGAR MODE, METRO PILLAR 73,NEW SANGANER ROAD, JAIPUR, 302019");

  const travelerName = booking.travelerName || booking.customerName || "rk travels";
  const travelerMobile = booking.travelerMobile || companyData?.phone || companyData?.mobile || "9856985698";

  const billNo = booking.invoiceNumber || "INV20261102";
  const invoiceDateStr = formatInvoiceDate(booking.invoiceDate || booking.startDate || new Date());
  const bookingNumber = booking.bookingNumber || "BK-202611-17-7525";

  const vehicleDisplay = booking.vehicleRegNumber || booking.vehicleCategory || "AP16FB5115";
  const dutyPeriodStr = `${formatInvoiceDate(booking.startDate)} · ${
    booking.startTime || "09:00"
  } → ${booking.endTime || "09:30"}`;

  const startKm = booking.startingKm ?? 500;
  const totalKm = booking.totalKm || (booking.endingKm ? Math.max(0, booking.endingKm - startKm) : 1000);
  const endKm = booking.endingKm ?? (startKm + totalKm);
  const totalHours = booking.totalHours || 13;
  const totalDays = booking.totalDays || 1;

  // Travelled points
  const travelledPoints: string[] = [];
  if (booking.fromLocation) {
    const f = cleanLocationName(booking.fromLocation);
    if (f) travelledPoints.push(f);
  }
  if (booking.travelledPlaces && booking.travelledPlaces.length > 0) {
    booking.travelledPlaces.forEach((p: string) => {
      const cp = cleanLocationName(p);
      if (cp && !travelledPoints.includes(cp)) travelledPoints.push(cp);
    });
  }
  if (booking.toLocation) {
    const t = cleanLocationName(booking.toLocation);
    if (t && !travelledPoints.includes(t)) travelledPoints.push(t);
  }
  if (travelledPoints.length === 0) {
    travelledPoints.push("Adilabad", "Agatti Island", "Aizawl", "Adoni");
  }

  const defaultBank =
    entityData?.bankAccounts?.find((b: any) => b.isDefault) ||
    entityData?.bankAccounts?.[0] || {
      bankName: "INDIAN BANK",
      accountHolderName: supplierName,
      accountNumber: "6755529918",
      ifscCode: "IDIB000S142",
    };

  const effectiveUpiId =
    defaultBank?.upiId ||
    defaultBank?.upi ||
    entityData?.upiId ||
    entityData?.upi ||
    "9948228877@upi";

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(
    `upi://pay?pa=${effectiveUpiId}&pn=${encodeURIComponent(supplierName)}&cu=INR`
  )}`;

  // Particulars items calculation
  interface ParticularItem {
    num: number;
    description: string;
    qty: number;
    rate: number;
    amount: number;
  }
  const items: ParticularItem[] = [];
  let itemCounter = 1;

  const baseFare = booking.baseFare || 2000;
  let baseDesc = `${booking.tariffType || "Local"}`;
  if (booking.tariffPackageName) {
    baseDesc += ` (${booking.tariffPackageName})`;
  } else if (booking.tariffType === "Local" || !booking.tariffType) {
    baseDesc += " (8 HOURS 80 KM)";
  }
  items.push({
    num: itemCounter++,
    description: baseDesc,
    qty: 1,
    rate: baseFare,
    amount: baseFare,
  });

  if (booking.extraHoursCost && booking.extraHoursCost > 0) {
    const rate = booking.extraHoursRate || 100;
    const hours = Math.round(booking.extraHoursCost / rate);
    items.push({
      num: itemCounter++,
      description: `Extra Hours (${hours}h × ₹${rate})`,
      qty: 1,
      rate: booking.extraHoursCost,
      amount: booking.extraHoursCost,
    });
  }

  if (booking.extraKmCost && booking.extraKmCost > 0) {
    const rate = booking.extraKmRate || 15;
    const km = Math.round(booking.extraKmCost / rate);
    items.push({
      num: itemCounter++,
      description: `Extra KM (${km}km × ₹${rate})`,
      qty: 1,
      rate: booking.extraKmCost,
      amount: booking.extraKmCost,
    });
  }

  if (booking.driverBataCost && booking.driverBataCost > 0) {
    items.push({
      num: itemCounter++,
      description: "Driver Bata",
      qty: 1,
      rate: booking.driverBataCost,
      amount: booking.driverBataCost,
    });
  }

  if (booking.nightHaltCost && booking.nightHaltCost > 0) {
    items.push({
      num: itemCounter++,
      description: "Night Halt",
      qty: 1,
      rate: booking.nightHaltCost,
      amount: booking.nightHaltCost,
    });
  }

  if (booking.tolls && booking.tolls > 0) {
    items.push({
      num: itemCounter++,
      description: "Tolls",
      qty: 1,
      rate: booking.tolls,
      amount: booking.tolls,
    });
  }

  if (booking.parking && booking.parking > 0) {
    items.push({
      num: itemCounter++,
      description: "Parking",
      qty: 1,
      rate: booking.parking,
      amount: booking.parking,
    });
  }

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

  const totalInvoiceAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const advancePaid = booking.customerAdvance || booking.receivedAmount || 0;
  const balancePayable = Math.max(0, totalInvoiceAmount - advancePaid);
  const amountInWords = numberToWordsINR(totalInvoiceAmount);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${billNo}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 30px 38px;
      font-size: 12px;
      line-height: 1.4;
    }
    .sheet {
      max-width: 720px;
      margin: 0 auto;
      background: #ffffff;
    }
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .supplier-name {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: #000000;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .supplier-address {
      font-size: 10.5px;
      color: #475569;
      margin-top: 4px;
      line-height: 1.35;
    }
    .supplier-contact {
      font-size: 10.5px;
      color: #475569;
      margin-top: 2px;
    }
    .invoice-title {
      font-size: 26px;
      font-weight: 800;
      color: #f16623;
      text-transform: uppercase;
      text-align: right;
      letter-spacing: -0.5px;
      line-height: 1;
    }
    .meta-row {
      text-align: right;
      font-size: 11.5px;
      margin-top: 4px;
    }
    .meta-label {
      color: #64748b;
      margin-right: 8px;
    }
    .meta-val {
      font-weight: 700;
      color: #0f172a;
    }
    /* Divider */
    .hr-main {
      border: none;
      border-top: 1.8px solid #000000;
      margin: 14px 0 16px 0;
    }
    /* Two Cards Side by Side */
    .cards-row {
      display: flex;
      gap: 14px;
      margin-bottom: 12px;
    }
    .card {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 12px;
      background: #ffffff;
    }
    .card-title {
      font-size: 9.5px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .bill-name {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      margin-top: 3px;
    }
    .bill-address {
      font-size: 10.5px;
      color: #475569;
      margin-top: 3px;
      line-height: 1.35;
      min-height: 34px;
    }
    .bill-meta {
      border-top: 1px solid #f1f5f9;
      margin-top: 10px;
      padding-top: 6px;
      font-size: 10.5px;
    }
    .flex-between {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .trip-header {
      font-size: 9.5px;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .veh-duty {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .sub-lbl {
      font-size: 8.5px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .veh-val {
      font-size: 12.5px;
      font-weight: 800;
      color: #0f172a;
      font-family: monospace;
    }
    .duty-val {
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .badges-row {
      display: flex;
      gap: 6px;
      margin-bottom: 6px;
    }
    .badge {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      padding: 4px 2px;
      text-align: center;
    }
    .badge-num {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      font-family: monospace;
    }
    .badge-lbl {
      font-size: 7.5px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .odometer {
      font-size: 9.5px;
      color: #64748b;
      text-align: center;
      font-family: monospace;
    }
    /* Travelled Places */
    .travelled-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 14px;
    }
    .pill {
      display: inline-block;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      color: #0f172a;
      margin-right: 4px;
      margin-bottom: 3px;
    }
    .arrow {
      color: #94a3b8;
      font-weight: bold;
      margin-right: 4px;
    }
    /* Table of Particulars */
    .table-box {
      border-top: 1.8px solid #000000;
      border-bottom: 1.8px solid #000000;
      margin-bottom: 12px;
    }
    table.particulars {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }
    table.particulars th {
      border-bottom: 1px solid #cbd5e1;
      padding: 7px 8px;
      font-size: 9.5px;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
    }
    table.particulars td {
      padding: 6.5px 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    /* Amount & Total */
    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
      gap: 16px;
    }
    .words-box {
      flex: 1;
    }
    .words-val {
      font-size: 11.5px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 3px;
      line-height: 1.35;
    }
    .total-box {
      width: 240px;
    }
    .total-bar {
      border-top: 1.8px solid #000000;
      border-bottom: 1.8px solid #000000;
      padding: 6px 0;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .total-lbl {
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      color: #0f172a;
    }
    .total-amt {
      font-size: 17px;
      font-weight: 900;
      color: #0f172a;
      font-family: monospace;
    }
    /* Bank & Signature */
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 10px;
      gap: 16px;
    }
    .bank-card {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 10px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .bank-info table {
      border-collapse: collapse;
      font-size: 10.5px;
    }
    .bank-info td {
      padding: 1px 0;
    }
    .bank-info td:first-child {
      color: #64748b;
      width: 50px;
    }
    .bank-info td:last-child {
      font-weight: 700;
      color: #0f172a;
    }
    .qr-container {
      text-align: center;
      padding-left: 10px;
    }
    .qr-img {
      width: 78px;
      height: 78px;
      display: block;
      margin: 0 auto;
    }
    .qr-lbl {
      font-size: 8px;
      font-weight: 700;
      color: #64748b;
      margin-top: 2px;
      letter-spacing: 0.5px;
    }
    .sig-col {
      width: 200px;
      text-align: center;
    }
    .for-supplier {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .stamp-container {
      height: 70px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      padding-top: 4px;
      font-size: 10.5px;
      font-weight: 700;
      color: #475569;
    }
    .disclaimer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #f1f5f9;
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    
    <!-- 1. Header -->
    <div class="header">
      <div>
        <div class="supplier-name">${supplierName}</div>
        <div class="supplier-address">${supplierAddress}</div>
        <div class="supplier-contact">${supplierEmail}&nbsp;&middot;&nbsp;${supplierPhone}</div>
      </div>
      <div>
        <div class="invoice-title">INVOICE</div>
        <div class="meta-row"><span class="meta-label">Bill No</span><span class="meta-val">${billNo}</span></div>
        <div class="meta-row"><span class="meta-label">Date</span><span class="meta-val">${invoiceDateStr}</span></div>
        <div class="meta-row"><span class="meta-label">Booking</span><span class="meta-val" style="font-family: monospace;">${bookingNumber}</span></div>
      </div>
    </div>

    <hr class="hr-main" />

    <!-- 2. Side-by-Side Cards -->
    <div class="cards-row">
      <!-- BILL TO -->
      <div class="card">
        <div class="card-title">BILL TO</div>
        <div class="bill-name">${billToName}</div>
        <div class="bill-address">${billToAddress}</div>
        <div class="bill-meta">
          <div class="flex-between">
            <span style="color:#64748b;">Traveler Name</span>
            <strong style="color:#0f172a;">${travelerName}</strong>
          </div>
          ${
            travelerMobile
              ? `<div class="flex-between" style="margin-top:2px;">
                  <span style="color:#64748b;">Contact No</span>
                  <strong style="color:#0f172a; font-family: monospace;">${travelerMobile}</strong>
                </div>`
              : ""
          }
        </div>
      </div>

      <!-- TRIP DETAILS -->
      <div class="card">
        <div class="trip-header">TRIP DETAILS</div>
        <div class="veh-duty">
          <div>
            <div class="sub-lbl">VEHICLE</div>
            <div class="veh-val">${vehicleDisplay}</div>
          </div>
          <div>
            <div class="sub-lbl">DUTY PERIOD</div>
            <div class="duty-val">${dutyPeriodStr}</div>
          </div>
        </div>

        <div class="badges-row">
          <div class="badge">
            <div class="badge-num">${totalKm}</div>
            <div class="badge-lbl">TOTAL KM</div>
          </div>
          <div class="badge">
            <div class="badge-num">${totalHours}</div>
            <div class="badge-lbl">HOURS</div>
          </div>
          <div class="badge">
            <div class="badge-num">${totalDays}</div>
            <div class="badge-lbl">DAY</div>
          </div>
        </div>

        <div class="odometer">Odometer ${startKm} – ${endKm}</div>
      </div>
    </div>

    <!-- 2b. Travelled Places -->
    <div class="travelled-box">
      <div class="card-title" style="color:#334155; margin-bottom: 5px;">TRAVELLED PLACES</div>
      <div>
        ${travelledPoints
          .map(
            (pt, idx) =>
              `${idx > 0 ? '<span class="arrow">&rarr;</span>' : ""}<span class="pill">${pt}</span>`
          )
          .join("")}
      </div>
    </div>

    <!-- 3. Particulars Table -->
    <div class="table-box">
      <table class="particulars">
        <thead>
          <tr>
            <th style="width: 32px; text-align: center;">#</th>
            <th style="text-align: left;">PARTICULARS</th>
            <th style="width: 50px; text-align: center;">QTY</th>
            <th style="width: 110px; text-align: right;">RATE (₹)</th>
            <th style="width: 120px; text-align: right;">AMOUNT (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
          <tr>
            <td style="text-align: center; color: #64748b; font-family: monospace;">${it.num}</td>
            <td style="font-weight: 600; color: #0f172a;">${it.description}</td>
            <td style="text-align: center; color: #334155; font-family: monospace;">${it.qty}</td>
            <td style="text-align: right; color: #334155; font-family: monospace;">${it.rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="text-align: right; font-weight: 700; color: #0f172a; font-family: monospace;">${it.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <!-- 4. Amount in Words & Total -->
    <div class="totals-row">
      <div class="words-box">
        <div class="card-title">AMOUNT IN WORDS</div>
        <div class="words-val">${amountInWords}</div>
      </div>
      <div class="total-box">
        <div class="total-bar">
          <span class="total-lbl">TOTAL</span>
          <span class="total-amt">₹ ${totalInvoiceAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        ${
          advancePaid > 0
            ? `<div style="font-size: 11px; margin-top: 5px;">
                <div style="display:flex; justify-content:space-between; color:#059669;">
                  <span>Less: Advance Received</span>
                  <span style="font-family: monospace;">&minus; ₹${advancePaid.toLocaleString("en-IN")}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-weight:800; color:#0f172a; border-top:1px solid #e2e8f0; margin-top:3px; padding-top:3px;">
                  <span>Net Balance Payable</span>
                  <span style="color:#f16623; font-family: monospace;">₹${balancePayable.toLocaleString("en-IN")}</span>
                </div>
              </div>`
            : ""
        }
      </div>
    </div>

    <!-- 5. Bank Details & Signature -->
    <div class="footer-row">
      <div class="bank-card">
        <div class="bank-info">
          <div class="card-title" style="margin-bottom: 5px;">BANK ACCOUNT DETAILS</div>
          <table>
            <tr><td>Bank</td><td>${defaultBank.bankName || "INDIAN BANK"}</td></tr>
            <tr><td>Name</td><td>${defaultBank.accountHolderName || supplierName}</td></tr>
            <tr><td>A/C No</td><td style="font-family: monospace; letter-spacing: 0.5px;">${defaultBank.accountNumber || "6755529918"}</td></tr>
            <tr><td>IFSC</td><td style="font-family: monospace;">${defaultBank.ifscCode || "IDIB000S142"}</td></tr>
            <tr><td>UPI ID</td><td style="color:#f16623; font-family: monospace;">${effectiveUpiId}</td></tr>
          </table>
        </div>
        <div class="qr-container">
          <img src="${qrImageUrl}" alt="Payment QR" class="qr-img" />
          <div class="qr-lbl">SCAN &amp; PAY</div>
        </div>
      </div>

      <div class="sig-col">
        <div class="for-supplier">For ${supplierName}</div>
        <div class="stamp-container">
          <!-- Circular Blue Stamp Seal -->
          <svg width="70" height="70" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="#1d4ed8" stroke-width="2.5" />
            <circle cx="50" cy="50" r="41" fill="none" stroke="#1d4ed8" stroke-width="1.2" />
            <path id="curveTop" d="M 18,50 A 32,32 0 0,1 82,50" fill="none" />
            <path id="curveBottom" d="M 82,50 A 32,32 0 0,1 18,50" fill="none" />
            <text font-family="Arial, sans-serif" font-size="8.5" font-weight="900" fill="#1d4ed8" letter-spacing="1.2">
              <textPath href="#curveTop" startOffset="50%" text-anchor="middle">RK TRAVELS</textPath>
            </text>
            <text font-family="Arial, sans-serif" font-size="7.5" font-weight="900" fill="#1d4ed8" letter-spacing="1.2">
              <textPath href="#curveBottom" startOffset="50%" text-anchor="middle">VIJAYAWADA</textPath>
            </text>
            <path d="M 28 54 Q 38 42, 52 46 T 72 48 M 42 38 Q 48 58, 54 62 Q 60 52, 68 56" fill="none" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" />
            <circle cx="20" cy="50" r="1.5" fill="#1d4ed8" />
            <circle cx="80" cy="50" r="1.5" fill="#1d4ed8" />
          </svg>
        </div>
        <div class="sig-line">Authorised Signatory</div>
      </div>
    </div>

    <!-- 6. Disclaimer -->
    <div class="disclaimer">
      NOTE : THIS IS A SYSTEM GENERATED REPORT AND DOES NOT REQUIRE ANY SIGNATURE.
    </div>

  </div>
</body>
</html>`;
}

export async function generateInvoicePdf(params: InvoicePdfParams): Promise<Buffer> {
  const html = buildInvoiceHtml(params);

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const execPath = fs.existsSync(chromePath) ? chromePath : edgePath;

  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "8mm",
        bottom: "8mm",
        left: "8mm",
        right: "8mm",
      },
    });
    return Buffer.from(pdfUint8Array);
  } finally {
    await browser.close();
  }
}
