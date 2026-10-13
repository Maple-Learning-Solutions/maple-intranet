import { AuthProvider } from "@/components/providers/AuthProvider";
import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("localhost")
      ? process.env.NEXTAUTH_URL
      : "https://intranet.maplelearningsolutions.com"
  ),
  title: "Maple Intranet | Maple Learning Solutions",
  description: "Stay connected with company news, upcoming events, helpful resources, and learning at Maple Learning Solutions.",
  icons: {
    icon: "/maple-icon.ico",
  },
  openGraph: {
    title: "Maple Intranet | Maple Learning Solutions",
    description: "Stay connected with company news, upcoming events, helpful resources, and learning at Maple Learning Solutions.",
    url: "https://intranet.maplelearningsolutions.com",
    siteName: "Maple Intranet",
    images: [
      {
        url: "/social-preview.png",
        width: 1367,
        height: 738,
        alt: "Welcome to Maple Learning Solutions Intranet",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Maple Intranet | Maple Learning Solutions",
    description: "Stay connected with company news, upcoming events, helpful resources, and learning at Maple Learning Solutions.",
    images: ["/social-preview.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <html
        lang="en"
        className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col" suppressHydrationWarning>
          {children}
          <Toaster position="bottom-right" richColors />
        </body>
      </html>
    </AuthProvider>
  );
}
