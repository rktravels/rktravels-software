import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { generateInvoicePdf } from "@/lib/invoice-pdf-generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      booking,
      entityData = {},
      companyData = {},
      recipientEmail,
      emailSubject,
      emailMessage,
    } = body;

    if (!recipientEmail || typeof recipientEmail !== "string" || !recipientEmail.includes("@")) {
      return NextResponse.json(
        { error: "A valid recipient email address is required." },
        { status: 400 }
      );
    }

    if (!booking) {
      return NextResponse.json(
        { error: "Booking details are required to generate the invoice." },
        { status: 400 }
      );
    }

    // 1. Generate the exact pixel-perfect PDF attachment matching Image 2
    const pdfBuffer = await generateInvoicePdf({ booking, entityData, companyData });
    const invoiceNo = booking.invoiceNumber || "INV20261102";
    const filename = `Invoice_${invoiceNo}.pdf`;

    const customerName =
      booking.customerName ||
      companyData?.legalName ||
      companyData?.companyName ||
      booking.clientName ||
      "Valued Customer";

    const totalAmt = Number(booking.grossAmount || booking.netAmount || booking.baseFare || 0);

    // 2. Clean Email Body (just the message and invoice attachment notice as requested)
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; padding: 24px 10px; background-color: #f8fafc; margin: 0; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 28px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 16px; border-bottom: 2.5px solid #f16623; padding-bottom: 10px; }
    .trip-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; font-size: 13px; margin: 16px 0; }
    .trip-box table { width: 100%; border-collapse: collapse; }
    .trip-box td { padding: 3px 0; }
    .trip-box td:first-child { color: #64748b; width: 130px; }
    .trip-box td:last-child { font-weight: 700; color: #0f172a; }
    .footer { margin-top: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 14px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">RK TRAVELS &mdash; Tax Invoice</div>
    <p>Dear ${customerName},</p>
    ${
      emailMessage
        ? `<p>${emailMessage.replace(/\n/g, "<br/>")}</p>`
        : `<p>Thank you for traveling with <strong>RK Travels</strong>. Please find attached your official Tax Invoice PDF for Booking <strong>#${booking.bookingNumber || invoiceNo}</strong>.</p>`
    }
    
    <div class="trip-box">
      <table>
        <tr>
          <td>Invoice Number:</td>
          <td>${invoiceNo}</td>
        </tr>
        <tr>
          <td>Booking Ref:</td>
          <td>${booking.bookingNumber || "—"}</td>
        </tr>
        <tr>
          <td>Route:</td>
          <td>${booking.fromLocation || "Start"} &rarr; ${booking.toLocation || "End"}</td>
        </tr>
        <tr>
          <td>Vehicle:</td>
          <td>${booking.vehicleCategory || "Sedan"} (${booking.vehicleRegNumber || "Car"})</td>
        </tr>
        <tr>
          <td>Total Amount:</td>
          <td style="color: #f16623; font-size: 15px;">&#8377; ${totalAmt.toLocaleString("en-IN")}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 12.5px; color: #475569;">
      &bull; The official Tax Invoice PDF (<strong>${filename}</strong>) is attached to this email. You can download and print it for your tax and expense reimbursement records.
    </p>

    <div class="footer">
      Warm regards,<br/>
      <strong style="color: #0f172a;">RK Travels &amp; Tours</strong><br/>
      #39-15-50, Main Road, Opp My Home Apartment, Vijayawada<br/>
      Phone: +91 9948228877 | Email: rktravels.vja@gmail.com
    </div>
  </div>
</body>
</html>
`;

    // 3. Send Email via Nodemailer
    const smtpUser = process.env.SMTP_USER || "rktravels.vja@gmail.com";
    const smtpRawPass = process.env.SMTP_PASS || "bnuc pgag kkao ccsz";
    const smtpPass = smtpRawPass.replace(/\s+/g, "");
    const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser;
    const smtpFromName = process.env.SMTP_FROM_NAME || "RK Travels";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const subject =
      emailSubject ||
      `Tax Invoice #${invoiceNo} for Booking #${booking.bookingNumber || ""} | RK Travels`;

    const mailOptions = {
      from: `"${smtpFromName}" <${smtpFromEmail}>`,
      to: recipientEmail,
      subject,
      html: htmlContent,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      recipient: recipientEmail,
      invoiceNumber: invoiceNo,
    });
  } catch (error: any) {
    console.error("Error sending invoice email:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to deliver invoice email. Please verify SMTP credentials.",
      },
      { status: 500 }
    );
  }
}
