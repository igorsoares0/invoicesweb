import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Invoice Maker", template: "%s · Invoice Maker" },
  description: "Create a professional invoice, get the PDF and send it to your client in minutes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} h-full`}>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        {/* Top-center keeps toasts clear of the editor actions docked at the bottom right. */}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
