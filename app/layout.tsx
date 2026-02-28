/**
 * app/layout.tsx — Root layout for the entire application.
 *
 * Sets up:
 *  - Google Fonts (Geist Sans + Geist Mono) via next/font
 *  - Global CSS (Tailwind + custom styles)
 *  - shadcn TooltipProvider (required by any tooltip components)
 *  - HTML metadata (title, description)
 *
 * HOW TO EDIT:
 *  - To change fonts, update the `Geist` / `Geist_Mono` imports and variables.
 *  - To add global providers (e.g. theme, auth), wrap `children` here.
 *  - To change the page title or description, edit `metadata`.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

/* Load Geist fonts and assign them to CSS custom properties */
const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** Page metadata — shown in browser tab and search engines. */
export const metadata: Metadata = {
  title: "Postgres MCP LLM",
  description: "Natural-language SQL playground powered by MCP + Claude",
};

/**
 * Root layout. Every page in the app is rendered inside this component.
 * The `antialiased` class enables font smoothing across browsers.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
