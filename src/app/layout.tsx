import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const SITE_URL = "https://xrenes.github.io";
const DESCRIPTION = "Your personal command center: private tasks, weekly planning and money in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "The Butler",
  description: DESCRIPTION,
  applicationName: "The Butler",
  openGraph: { type: "website", title: "The Butler", description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: "The Butler", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#101727",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
