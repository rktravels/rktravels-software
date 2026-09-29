import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { DashboardShell } from "@/components/DashboardShell";

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RK Travels - Management Portal",
  description: "Fleet, Bookings & Operations Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${sora.className} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f8fafc] text-slate-800 antialiased font-sans selection:bg-[#f16623]/20 selection:text-[#f16623]">
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
