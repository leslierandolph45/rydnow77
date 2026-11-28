import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rydnow.app";
const TITLE = "RYDNOW — Rides, Delivery & Waste Collection";
const DESCRIPTION =
  "Book an Okada ride, send a parcel or schedule waste collection across Ghana. Fast, trusted and tracked live.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "RYDNOW",
  title: { default: TITLE, template: "%s | RYDNOW" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "RYDNOW",
    locale: "en_GH",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  appleWebApp: { capable: true, title: "RYDNOW", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#1E3FCE",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontSans.variable}>
      <body className="touch-manipulation overscroll-y-none bg-gray-100 font-sans text-gray-900">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>

        {/* Phone-sized app shell */}
        <div
          id="main-content"
          className="relative mx-auto min-h-screen min-h-dvh w-full max-w-md overflow-x-hidden bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] shadow-2xl"
        >
          {children}
        </div>
      </body>
    </html>
  );
}
