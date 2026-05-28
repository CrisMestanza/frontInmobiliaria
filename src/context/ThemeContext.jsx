import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";

const THEME_STORAGE_KEY = "geohabita-theme";
const ThemeContext = createContext(null);

const getInitialTheme = () => {
  if (typeof window === "undefined") return "light";
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const applyTheme = (nextTheme) => {
  document.documentElement.setAttribute("data-theme", nextTheme);
  document.body.setAttribute("data-theme", nextTheme);
  document.documentElement.classList.toggle("dark", nextTheme === "dark");
  document.body.classList.toggle("dark", nextTheme === "dark");
  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
};

const animateThemeTransition = (nextTheme, commitTheme) => {
  if (
    typeof document === "undefined" ||
    typeof window === "undefined" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
    typeof document.startViewTransition !== "function"
  ) {
    commitTheme(nextTheme);
    return;
  }

  const transition = document.startViewTransition(() => {
    flushSync(() => {
      commitTheme(nextTheme);
    });
  });

  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: ["inset(0 0 100% 0)", "inset(0)"] },
        {
          pseudoElement: "::view-transition-new(root)",
          duration: 600,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    })
    .catch(() => {
      // Ignore cancelled transitions and keep the theme change.
    });
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme: () => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        animateThemeTransition(nextTheme, setTheme);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
