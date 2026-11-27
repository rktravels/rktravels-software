import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { generateInvoicePdf } from "@/lib/invoice-pdf-generator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      booking,
      entityData,
      companyData,
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

    // 1. Generate Invoice PDF Buffer
    const pdfBuffer = generateInvoicePdf({ booking, entityData, companyData });
    const invoiceNo = booking.invoiceNumber || booking.bookingNumber || `TRIP-${Date.now()}`;
    const filename = `Invoice_${invoiceNo}.pdf`;

    // 2. SMTP Credentials from Environment or Defaults
    const smtpUser = process.env.SMTP_USER || "rktravels.vja@gmail.com";
    const smtpRawPass = process.env.SMTP_PASS || "bnuc pgag kkao ccsz";
    const smtpPass = smtpRawPass.replace(/\s+/g, ""); // Clean spaces from Google App Password
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

    const customerName =
      booking.customerName ||
      companyData?.legalName ||
      companyData?.companyName ||
      booking.clientName ||
      "Valued Customer";

    const subject =
      emailSubject ||
      `Tax Invoice #${invoiceNo} for Booking #${booking.bookingNumber || ""} | RK Travels`;

    const totalAmt = Number(booking.grossAmount || booking.netAmount || booking.baseFare || 0);
    const balanceAmt = Number(booking.balanceAmount ?? totalAmt);

    // 3. Build HTML Email Body
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background: #1e293b; padding: 24px; text-align: left; border-bottom: 3px solid #f16623; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: #f16623; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .content { padding: 24px; }
    .greeting { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .message { font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
    .invoice-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
    .invoice-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .row-label { color: #64748b; }
    .row-value { color: #0f172a; font-weight: 600; text-align: right; }
    .total-row { border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 10px; font-size: 14px; font-weight: 700; }
    .total-value { color: #f16623; font-size: 16px; }
    .attachment-notice { background: #fff7ed; border: 1px solid #ffedd5; border-radius: 6px; padding: 12px 16px; font-size: 12px; color: #9a3412; display: flex; align-items: center; margin-bottom: 20px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>RK TRAVELS &amp; TOURS</h1>
      <p>Official Tax Invoice Dispatch</p>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${customerName},</div>
      <div class="message">
        ${
          emailMessage
            ? `<p>${emailMessage.replace(/\n/g, "<br/>")}</p>`
            : `<p>Thank you for traveling with <strong>RK Travels</strong>. Please find attached the official Tax Invoice for your recent trip booking.</p>`
        }
      </div>

      <div class="invoice-card">
        <div class="invoice-title">Trip &amp; Invoice Highlights</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Invoice Number:</td>
            <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #0f172a;">${invoiceNo}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Booking Reference:</td>
            <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #0f172a;">#${booking.bookingNumber || "—"}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Travel Route:</td>
            <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #0f172a;">${booking.fromLocation || ""} &rarr; ${booking.toLocation || ""}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Vehicle:</td>
            <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #0f172a;">${booking.vehicleCategory || "Sedan"} (${booking.vehicleRegNumber || "Car"})</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Travel Date:</td>
            <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #0f172a;">${booking.startDate || "—"}</td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="padding: 8px 0 4px 0; color: #64748b; font-weight: 700;">Total Invoice Amount:</td>
            <td style="padding: 8px 0 4px 0; font-weight: 700; text-align: right; color: #f16623; font-size: 15px;">&#8377;${totalAmt.toLocaleString("en-IN")}</td>
          </tr>
          ${
            balanceAmt > 0
              ? `<tr>
                  <td style="padding: 2px 0; color: #b45309; font-size: 12px;">Balance Outstanding:</td>
                  <td style="padding: 2px 0; font-weight: 600; text-align: right; color: #b45309; font-size: 12px;">&#8377;${balanceAmt.toLocaleString("en-IN")}</td>
                </tr>`
              : `<tr>
                  <td style="padding: 2px 0; color: #15803d; font-size: 12px;">Payment Status:</td>
                  <td style="padding: 2px 0; font-weight: 600; text-align: right; color: #15803d; font-size: 12px;">Paid In Full</td>
                </tr>`
          }
        </table>
      </div>

      <div class="attachment-notice">
        <span>&bull; The full official PDF Tax Invoice (<strong>${filename}</strong>) is attached to this email. You can download and print it for your tax and expense reimbursement records.</span>
      </div>

      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        For any billing queries or feedback, please contact us at <strong>${smtpUser}</strong> or call <strong>+91 9542224422</strong>.
      </p>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} RK Travels. All rights reserved.<br/>
      Vijayawada, Andhra Pradesh, India.
    </div>
  </div>
</body>
</html>
`;

    // 4. Send Email via Nodemailer
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
