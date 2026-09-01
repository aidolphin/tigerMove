import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TigerMove | Stone vs Wood",
    template: "%s | TigerMove",
  },
  description: "Play TigerMove, a timeless strategy game of position, patience and capture by Quantum Leaf Automation.",
  applicationName: "TigerMove",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TigerMove",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  themeColor: "#183f2b",
  keywords: ["game", "strategy", "board game", "multiplayer", "tigermove"],
  authors: [{ name: "Quantum Leaf Automation" }],
  openGraph: {
    title: "TigerMove | Stone vs Wood",
    description: "A timeless strategy game of position, patience and capture.",
    type: "website",
    siteName: "TigerMove",
  },
  twitter: {
    card: "summary",
    title: "TigerMove | Stone vs Wood",
    description: "A timeless strategy game of position, patience and capture.",
  },
};

export const viewport: Viewport = {
  themeColor: "#183f2b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <link rel="mask-icon" href="/icon.svg" color="#183f2b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TigerMove" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#183f2b" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </head>
      <body>
        <Toaster position="top-center" richColors />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
