import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "doroTheme";

export const loadTheme = (): Theme => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
};

const systemPrefersDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

// Keep in sync with the inline script in index.html, which applies the
// class before first paint to avoid a flash of the wrong theme.
export const applyTheme = (theme: Theme) => {
  const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
  // Match the browser chrome (macOS wrapper, PWA title bar) to the app
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0a0a0a" : "#ffffff");
};

export default function useTheme() {
  const [theme, setTheme] = useState<Theme>(loadTheme);

  useEffect(() => {
    if (theme === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, theme);
    }
    applyTheme(theme);
  }, [theme]);

  // Follow OS-level changes while in system mode
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const cycleTheme = () =>
    setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));

  return { theme, setTheme, cycleTheme };
}
