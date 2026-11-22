import type { Metadata } from "next";
import Script from "next/script"; // ✅ Added
import "./globals.css";

// ✅ Professional Metadata — updated with your viewport
export const metadata: Metadata = {
  title: "RYDNOW | Delivery Made Simple",
  description: "Fast, reliable delivery across Ghana",
  keywords: ["delivery", "courier", "Ghana", "logistics", "RYDNOW", "same-day"],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased">
        <div className="flex flex-col min-h-screen">
          {/* Main content — fills available space */}
          <main className="flex-1">
            {children}
          </main>
        </div>

        {/* ✅ Script moved OUT of <head> — uses Next.js Script component */}
        <Script
          src="https://cdn.tailwindcss.com"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
