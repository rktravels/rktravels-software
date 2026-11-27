import { jsPDF } from "jspdf";

export interface InvoicePdfParams {
  booking: any;
  entityData?: any;
  companyData?: any;
}

// Convert numbers to Indian Rupees in words
function numberToWordsINR(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded <= 0) return "Zero Rupees Only";

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

  return result.trim() + " Rupees Only";
}

export function generateInvoicePdf({
  booking,
  entityData = {},
  companyData = {},
}: InvoicePdfParams): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Supplier info
  const supplierName =
    entityData?.legalName ||
    entityData?.entityName ||
    booking.entityName ||
    "ARUNA CABS";
  const supplierAddress =
    entityData?.addressLine1 ||
    entityData?.address ||
    "# 29-13-56, NEAR INDIAN BANK, KALESWARAO ROAD, SURYARAOPET, VIJAYAWADA - 520002";
  const supplierEmail =
    entityData?.emailForPrint || entityData?.email || "rktravels.vja@gmail.com";
  const supplierPhone =
    entityData?.phoneForPrint || entityData?.mobileNumber || entityData?.phone || "9542224422";
  const supplierGstin = entityData?.gstin || entityData?.panGstin || "37CTTPN7411C1ZG";
  const supplierState = entityData?.supplierState || "Andhra Pradesh (37)";

  // Customer / Bill To
  const customerName =
    booking.customerName ||
    companyData?.legalName ||
    companyData?.companyName ||
    companyData?.name ||
    booking.clientName ||
    "Direct Customer";
  const customerAddress =
    companyData?.billingAddress ||
    companyData?.address ||
    booking.pickupAddress ||
    booking.fromLocation ||
    "Vijayawada, Andhra Pradesh";
  const customerGstin =
    companyData?.gstin ||
    (booking.clientType === "Individual Customer" ? "Unregistered" : "08AAMFH6950L1ZR");
  const customerMobile =
    booking.travelerMobile || companyData?.mobile || companyData?.phone || "";

  // Invoice numbers
  const invoiceNo = booking.invoiceNumber || `PROV-${booking.bookingNumber || Date.now()}`;
  const invoiceDate = booking.invoiceDate || booking.startDate || new Date().toISOString().split("T")[0];
  const bookingRef = booking.bookingNumber || "—";

  // --- 1. Top Header Banner ---
  doc.setFillColor(241, 102, 35); // Brand orange
  doc.rect(margin, y, contentWidth, 3, "F");
  y += 6;

  // Supplier Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(24, 30, 42);
  doc.text(supplierName, margin, y);

  // TAX INVOICE title on the right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(241, 102, 35);
  doc.text("TAX INVOICE", pageWidth - margin, y, { align: "right" });
  y += 5;

  // Supplier Address & Contact
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(70, 75, 85);
  const splitAddr = doc.splitTextToSize(supplierAddress, 110);
  doc.text(splitAddr, margin, y);

  // Right metadata (Invoice #, Date, Ref)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text(`Invoice No: ${invoiceNo}`, pageWidth - margin, y, { align: "right" });
  doc.text(`Invoice Date: ${invoiceDate}`, pageWidth - margin, y + 4, { align: "right" });
  doc.text(`Booking Ref: #${bookingRef}`, pageWidth - margin, y + 8, { align: "right" });

  y += Math.max(splitAddr.length * 4, 12);
  doc.text(`GSTIN: ${supplierGstin} | State: ${supplierState}`, margin, y);
  doc.text(`Phone: ${supplierPhone} | Email: ${supplierEmail}`, margin, y + 4);
  y += 8;

  // Divider line
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // --- 2. Bill To & Trip Summary Cards ---
  const boxHeight = 28;
  const colWidth = (contentWidth - 4) / 2;

  // Box 1: Billed To
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, colWidth, boxHeight, 1.5, 1.5, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, colWidth, boxHeight, 1.5, 1.5, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 125);
  doc.text("BILLED TO / CUSTOMER DETAILS", margin + 3, y + 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 25, 35);
  doc.text(customerName, margin + 3, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 85, 95);
  const custAddrTrunc = customerAddress.length > 55 ? customerAddress.substring(0, 52) + "..." : customerAddress;
  doc.text(custAddrTrunc, margin + 3, y + 13.5);
  doc.text(`GSTIN: ${customerGstin}`, margin + 3, y + 18);
  if (customerMobile) {
    doc.text(`Phone: ${customerMobile}`, margin + 3, y + 22.5);
  }

  // Box 2: Trip & Vehicle Particulars
  const box2X = margin + colWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(box2X, y, colWidth, boxHeight, 1.5, 1.5, "F");
  doc.roundedRect(box2X, y, colWidth, boxHeight, 1.5, 1.5, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 125);
  doc.text("TRIP & VEHICLE PARTICULARS", box2X + 3, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(40, 45, 55);

  const vehicleStr = `${booking.vehicleCategory || "Sedan"} (${booking.vehicleRegNumber || "Car"})`;
  doc.text(`Vehicle: ${vehicleStr}`, box2X + 3, y + 9);

  const routeStr = `${booking.fromLocation || "Start"} -> ${booking.toLocation || "End"}`;
  const routeTrunc = routeStr.length > 40 ? routeStr.substring(0, 38) + "..." : routeStr;
  doc.text(`Route: ${routeTrunc}`, box2X + 3, y + 13.5);

  const driverStr = booking.driverName ? `${booking.driverName} (${booking.driverMobile || ""})` : "Assigned Driver";
  doc.text(`Driver: ${driverStr}`, box2X + 3, y + 18);

  const kmHoursStr = `${booking.totalKm || 0} KMs | ${booking.totalHours || 0} Hours`;
  doc.text(`Metrics: ${kmHoursStr}`, box2X + 3, y + 22.5);

  y += boxHeight + 5;

  // --- 3. Particulars Line Items Table ---
  // Table Header
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(margin, y, contentWidth, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  const colSNo = margin + 3;
  const colDesc = margin + 14;
  const colQty = margin + 115;
  const colRate = margin + 140;
  const colAmt = pageWidth - margin - 3;

  doc.text("#", colSNo, y + 4.8);
  doc.text("DESCRIPTION / SERVICE PARTICULARS", colDesc, y + 4.8);
  doc.text("QTY", colQty, y + 4.8, { align: "center" });
  doc.text("RATE (₹)", colRate, y + 4.8, { align: "right" });
  doc.text("AMOUNT (₹)", colAmt, y + 4.8, { align: "right" });

  y += 7;

  // Line items extraction
  const items: { num: number; desc: string; qty: number; rate: number; amount: number }[] = [];
  let itemIdx = 1;

  // Base Package Fare
  const baseFare = Number(booking.baseFare ?? booking.netAmount ?? booking.grossAmount ?? 0);
  const pkgDesc = booking.tariffPackageName
    ? `${booking.tariffType || "Hire"} - ${booking.tariffPackageName}`
    : `${booking.tariffType || "Trip Hire Fare"}`;
  items.push({
    num: itemIdx++,
    desc: pkgDesc,
    qty: 1,
    rate: baseFare,
    amount: baseFare,
  });

  // Extra KM
  const extraKm = Number(booking.extraKm || 0);
  const extraKmRate = Number(booking.extraKmRate || 0);
  const extraKmCost = Number(booking.extraKmCharge || extraKm * extraKmRate || 0);
  if (extraKmCost > 0) {
    items.push({
      num: itemIdx++,
      desc: `Extra Distance (${extraKm} KMs @ ₹${extraKmRate}/KM)`,
      qty: extraKm,
      rate: extraKmRate,
      amount: extraKmCost,
    });
  }

  // Extra Hours
  const extraHours = Number(booking.extraHours || 0);
  const extraHourRate = Number(booking.extraHourRate || 0);
  const extraHoursCost = Number(booking.extraHourCharge || extraHours * extraHourRate || 0);
  if (extraHoursCost > 0) {
    items.push({
      num: itemIdx++,
      desc: `Extra Hours (${extraHours} Hrs @ ₹${extraHourRate}/Hr)`,
      qty: extraHours,
      rate: extraHourRate,
      amount: extraHoursCost,
    });
  }

  // Toll Charges
  const toll = Number(booking.tollCharge || booking.tollFee || 0);
  if (toll > 0) {
    items.push({
      num: itemIdx++,
      desc: "Toll & Fastag Charges",
      qty: 1,
      rate: toll,
      amount: toll,
    });
  }

  // Parking Charges
  const parking = Number(booking.parkingCharge || booking.parkingFee || 0);
  if (parking > 0) {
    items.push({
      num: itemIdx++,
      desc: "Parking Charges",
      qty: 1,
      rate: parking,
      amount: parking,
    });
  }

  // Driver Allowance / Night Charges
  const nightCharge = Number(booking.nightCharge || 0);
  if (nightCharge > 0) {
    items.push({
      num: itemIdx++,
      desc: "Driver Night Shift Allowance",
      qty: 1,
      rate: nightCharge,
      amount: nightCharge,
    });
  }

  // Driver Day Allowance
  const dayAllowance = Number(booking.driverBatta || booking.dayAllowance || 0);
  if (dayAllowance > 0) {
    items.push({
      num: itemIdx++,
      desc: "Driver Daily Allowance / Batta",
      qty: 1,
      rate: dayAllowance,
      amount: dayAllowance,
    });
  }

  // State Tax / Permit
  const stateTax = Number(booking.stateTax || booking.permitCharge || 0);
  if (stateTax > 0) {
    items.push({
      num: itemIdx++,
      desc: "Interstate Border Tax / Permit",
      qty: 1,
      rate: stateTax,
      amount: stateTax,
    });
  }

  // Render Table Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(252, 252, 253);
      doc.rect(margin, y, contentWidth, 6.5, "F");
    }

    doc.setTextColor(30, 41, 59);
    doc.text(String(item.num), colSNo, y + 4.5);
    doc.text(item.desc, colDesc, y + 4.5);
    doc.text(String(item.qty), colQty, y + 4.5, { align: "center" });
    doc.text(`₹${item.rate.toLocaleString("en-IN")}`, colRate, y + 4.5, { align: "right" });
    doc.text(`₹${item.amount.toLocaleString("en-IN")}`, colAmt, y + 4.5, { align: "right" });

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 6.5, pageWidth - margin, y + 6.5);
    y += 6.5;
  });

  // Calculate Grand Totals
  const totalAmount = items.reduce((sum, it) => sum + it.amount, 0);
  const advancePaid = Number(booking.customerAdvance || booking.receivedAmount || 0);
  const balanceDue = Math.max(0, totalAmount - advancePaid);

  y += 2;

  // --- 4. Totals Summary & Words Box ---
  const summaryBoxY = y;
  const leftBoxWidth = 115;
  const rightBoxWidth = contentWidth - leftBoxWidth - 4;
  const rightBoxX = margin + leftBoxWidth + 4;

  // Left side: Amount in Words & Bank details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL AMOUNT IN WORDS", margin, y + 3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(241, 102, 35);
  const wordsStr = numberToWordsINR(totalAmount);
  const splitWords = doc.splitTextToSize(wordsStr, leftBoxWidth);
  doc.text(splitWords, margin, y + 7.5);

  const bankY = y + 7.5 + splitWords.length * 4 + 2;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, bankY, leftBoxWidth, 23, 1.5, 1.5, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, bankY, leftBoxWidth, 23, 1.5, 1.5, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("BANK ACCOUNT PAYMENT DETAILS", margin + 3, bankY + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Account Name: ${supplierName}`, margin + 3, bankY + 8.5);
  doc.text("Bank Name: HDFC Bank / ICICI Bank", margin + 3, bankY + 12.5);
  doc.text("Account No: 50200049281729", margin + 3, bankY + 16.5);
  doc.text("IFSC Code: HDFC0000123 | Branch: Suryaraopet, Vijayawada", margin + 3, bankY + 20.5);

  // Right side: Financial Summary Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightBoxX, summaryBoxY, rightBoxWidth, 36, 1.5, 1.5, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightBoxX, summaryBoxY, rightBoxWidth, 36, 1.5, 1.5, "S");

  let rY = summaryBoxY + 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Gross Total:", rightBoxX + 4, rY);
  doc.text(`₹${totalAmount.toLocaleString("en-IN")}`, rightBoxX + rightBoxWidth - 4, rY, { align: "right" });

  rY += 6;
  doc.text("Advance Received:", rightBoxX + 4, rY);
  doc.text(`- ₹${advancePaid.toLocaleString("en-IN")}`, rightBoxX + rightBoxWidth - 4, rY, { align: "right" });

  rY += 6;
  doc.setDrawColor(203, 213, 225);
  doc.line(rightBoxX + 4, rY, rightBoxX + rightBoxWidth - 4, rY);

  rY += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(241, 102, 35);
  doc.text("Balance Payable:", rightBoxX + 4, rY);
  doc.text(`₹${balanceDue.toLocaleString("en-IN")}`, rightBoxX + rightBoxWidth - 4, rY, { align: "right" });

  rY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const payStatusStr = balanceDue <= 0 ? "Status: PAID IN FULL" : `Status: DUE (₹${balanceDue.toLocaleString("en-IN")})`;
  doc.text(payStatusStr, rightBoxX + 4, rY);

  // --- 5. Terms & Signatory Section ---
  y = bankY + 27;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Terms & Conditions:", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("1. Vehicle is charged from garage to garage.", margin, y + 3.5);
  doc.text("2. Tolls, parking, and interstate permit fees are to be borne by the customer.", margin, y + 7);
  doc.text("3. This is an official trip coordination invoice generated by RK Travels.", margin, y + 10.5);

  // Authorized Signatory
  const sigX = pageWidth - margin - 50;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`For ${supplierName}`, sigX, y + 3);

  doc.setDrawColor(148, 163, 184);
  doc.line(sigX, y + 14, pageWidth - margin, y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Authorized Signatory", sigX + 6, y + 18);

  // Bottom footer branding
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated on ${new Date().toLocaleString("en-IN")} · RK Travels Booking Management Software`,
    pageWidth / 2,
    290,
    { align: "center" }
  );

  return Buffer.from(doc.output("arraybuffer"));
}
