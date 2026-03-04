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
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Sidebar imports from playground/layout.tsx
import { useState, useEffect, useRef } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/app/playground/layout';

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <ThemeProvider>
          <TooltipProvider>
            {/* Mount sidebar layout at root */}
            <SidebarRoot>{children}</SidebarRoot>
          </TooltipProvider>
        </ThemeProvider>
// SidebarRoot merges playground sidebar layout logic for root
function SidebarRoot({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  return (
    <div
      data-sidebar-open={String(open)}
      data-sidebar-init={String(mounted.current)}
      className='flex w-full min-h-svh'
      style={{ '--sidebar-width': `352px` } as React.CSSProperties}
    >
      <SidebarProvider open={open} onOpenChange={setOpen} style={{ display: 'contents' } as React.CSSProperties}>
        <AppSidebar />
        <main className='flex-1 min-w-0 overflow-hidden'>{children}</main>
      </SidebarProvider>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <ThemeProvider>
          <TooltipProvider>
            <SidebarRoot>{children}</SidebarRoot>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
