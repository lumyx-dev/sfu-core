"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-sm border border-hairline text-muted hover:bg-hover hover:text-strong"
    >
      {mounted ? isDark ? <Sun size={15} /> : <Moon size={15} /> : <span className="h-[15px] w-[15px]" />}
    </button>
  );
}
