/**
 * Invoice utility helpers for Tax Invoice generation, numbering series, and amount formatting.
 */

/**
 * Generate next sequential invoice number in the format:
 * INV + YYYY + MM + NN (starts at 01 for each new month/year)
 * Example: INV20261001, INV20261002
 * When month or year changes: INV20261101, INV20270101
 */
export function generateNextInvoiceNumber(
  existingBookings: { invoiceNumber?: string }[] = [],
  targetDate: Date = new Date()
): string {
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, "0");
  const prefix = `INV${year}${month}`;

  let maxSeq = 0;

  for (const b of existingBookings) {
    if (b.invoiceNumber && b.invoiceNumber.startsWith(prefix)) {
      const rest = b.invoiceNumber.slice(prefix.length);
      const parsed = parseInt(rest, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const seqStr = String(nextSeq).padStart(2, "0");
  return `${prefix}${seqStr}`;
}

/**
 * Format a date string (YYYY-MM-DD or ISO) into "28 Sep 2026"
 */
export function formatInvoiceDate(input?: string | Date | null): string {
  if (!input) {
    input = new Date();
  }
  const dateObj = typeof input === "string" ? new Date(input) : input;
  if (isNaN(dateObj.getTime())) {
    return new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return dateObj.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Convert number to words in Indian Currency (INR) format.
 * Example: 7591.50 -> "INR Seven Thousand Five Hundred Ninety One and Fifty Paise rupees only"
 */
export function numberToWordsINR(amount: number): string {
  if (isNaN(amount) || amount === 0) {
    return "INR Zero rupees only";
  }

  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function inWords(num: number): string {
    const n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return "";

    let str = "";
    str += Number(n[1]) !== 0 ? (a[Number(n[1])] || b[Number(n[1][0])] + " " + a[Number(n[1][1])]) + "Crore " : "";
    str += Number(n[2]) !== 0 ? (a[Number(n[2])] || b[Number(n[2][0])] + " " + a[Number(n[2][1])]) + "Lakh " : "";
    str += Number(n[3]) !== 0 ? (a[Number(n[3])] || b[Number(n[3][0])] + " " + a[Number(n[3][1])]) + "Thousand " : "";
    str += Number(n[4]) !== 0 ? (a[Number(n[4])] || b[Number(n[4][0])] + " " + a[Number(n[4][1])]) + "Hundred " : "";
    str += Number(n[5]) !== 0
      ? (str !== "" ? "and " : "") + (a[Number(n[5])] || b[Number(n[5][0])] + " " + a[Number(n[5][1])])
      : "";

    return str.trim();
  }

  const rounded = Math.round(amount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  const rupeesStr = rupees > 0 ? inWords(rupees) : "Zero";
  let result = `INR ${rupeesStr}`;

  if (paise > 0) {
    const paiseStr = inWords(paise);
    result += ` and ${paiseStr}Paise`;
  }

  result += " rupees only";
  // Clean multiple spaces
  return result.replace(/\s+/g, " ");
}

/**
 * State code map for GST determination
 */
export const GST_STATE_CODES: Record<string, string> = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  "Punjab": "03",
  "Chandigarh": "04",
  "Uttarakhand": "05",
  "Haryana": "06",
  "Delhi": "07",
  "Rajasthan": "08",
  "Uttar Pradesh": "09",
  "Bihar": "10",
  "Sikkim": "11",
  "Arunachal Pradesh": "12",
  "Nagaland": "13",
  "Manipur": "14",
  "Mizoram": "15",
  "Tripura": "16",
  "Meghalaya": "17",
  "Assam": "18",
  "West Bengal": "19",
  "Jharkhand": "20",
  "Odisha": "21",
  "Chhattisgarh": "22",
  "Madhya Pradesh": "23",
  "Gujarat": "24",
  "Maharashtra": "27",
  "Andhra Pradesh": "37",
  "Karnataka": "29",
  "Goa": "30",
  "Kerala": "32",
  "Tamil Nadu": "33",
  "Puducherry": "34",
  "Telangana": "36",
  "Ladakh": "38",
};

export function getStateCode(stateName?: string): string {
  if (!stateName) return "37";
  const trimmed = stateName.trim();
  if (GST_STATE_CODES[trimmed]) return GST_STATE_CODES[trimmed];
  const found = Object.entries(GST_STATE_CODES).find(([k]) =>
    k.toLowerCase().includes(trimmed.toLowerCase())
  );
  return found ? found[1] : "37";
}
