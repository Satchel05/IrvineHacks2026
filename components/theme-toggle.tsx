"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./theme-provider";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <SidebarMenuButton onClick={toggleTheme} className="h-12 py-3">
      <div className="relative w-4 h-5">
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div
              key="sun"
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <Sun className="w-5 h-5 text-amber-400 ml-1 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ rotate: 90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <Moon className="w-5 h-5 text-indigo-400 ml-1 drop-shadow-[0_0_6px_rgba(129,140,248,0.8)]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
        className="text-sm m-4"
    key={isDark ? "light" : "dark"}
    initial={{ opacity: 0, x: -6 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 6 }}
    transition={{ duration: 0.25, ease: "easeOut" }}
  >
    {isDark ? "Light Mode" : "Dark Mode"}
  </motion.span>
      </AnimatePresence>
    </SidebarMenuButton>
  );
}
