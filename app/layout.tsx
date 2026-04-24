import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "@/components/providers";

export const dynamic = "force-dynamic";

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: "Movie Gen Alpha",
  description:
    "Professional AI creative tools: image generation, video creation, and the Prompt Multiplier framework.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Movie Gen Alpha",
    description:
      "Professional AI creative tools for image generation, video creation, and prompt engineering.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js" />
      </head>
      <body
        className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <style
          dangerouslySetInnerHTML={{
            __html: "[data-hydration-error] { display: none !important; }",
          }}
        />
        <Providers>
          <SiteHeader />
          <main className="min-h-screen">{children}</main>
        </Providers>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
