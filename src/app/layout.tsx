import type { Metadata } from "next";
import "./globals.css";

import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://getpointed.app"),
  title: {
    default: "Pointed",
    template: "%s · Pointed",
  },
  applicationName: "Pointed",
  description:
    "Run pointing sessions without sharing your screen. Read Linear tickets, vote privately, and save the agreed estimate.",
  icons: {
    icon: "/pointed-mark.svg",
    shortcut: "/pointed-mark.svg",
  },
  keywords: [
    "pointing poker",
    "planning poker",
    "Linear",
    "story points",
    "open source",
  ],
  openGraph: {
    title: "Pointed · Team estimates for Linear",
    description: "Read Linear tickets on your own screen, vote privately, and save the agreed estimate to Linear.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pointed · Team estimates for Linear",
    description: "Read Linear tickets on your own screen, vote privately, and save the agreed estimate to Linear.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-theme="light"
      data-theme-preference="system"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
