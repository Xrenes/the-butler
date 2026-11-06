import { type ReactNode, createContext, useContext } from "react";

/** Same palette as the web app: black and charcoal with The Butler's red accent. */
export interface Palette {
  mode: "dark" | "light";
  accent: string;
  accentHi: string;
  bg: string;
  canvas: string;
  surface: string;
  surface2: string;
  well: string;
  line: string;
  fg: string;
  fg2: string;
  fg3: string;
  dotOff: string;
  overlay: string;
  edge: string;
}

export const DARK: Palette = {
  mode: "dark",
  accent: "#D83036",
  accentHi: "#F2575B",
  bg: "#111111",
  canvas: "#1C1C1C",
  surface: "#252525",
  surface2: "#2F2F2F",
  well: "#141414",
  line: "#363636",
  fg: "#FFFFFF",
  fg2: "#A6A6A6",
  fg3: "#6B6B6B",
  dotOff: "#3A3A3A",
  overlay: "rgba(0,0,0,0.6)",
  edge: "rgba(255,255,255,0.07)",
};

export const LIGHT: Palette = {
  mode: "light",
  accent: "#D83036",
  accentHi: "#EF4A50",
  bg: "#E9E9E9",
  canvas: "#F4F4F4",
  surface: "#FFFFFF",
  surface2: "#ECECEC",
  well: "#E3E3E3",
  line: "#DCDCDC",
  fg: "#1C1C1C",
  fg2: "#555555",
  fg3: "#A6A6A6",
  dotOff: "#D9D9D9",
  overlay: "rgba(28,28,28,0.45)",
  edge: "rgba(0,0,0,0.06)",
};

const ThemeContext = createContext<Palette>(DARK);

export function ThemeProvider({ mode, children }: { mode: "dark" | "light"; children: ReactNode }) {
  return <ThemeContext value={mode === "dark" ? DARK : LIGHT}>{children}</ThemeContext>;
}

export function useTheme(): Palette {
  return useContext(ThemeContext);
}

/** Task status colours: green tick (done), yellow circle (on hold), red cross (not done). */
export const STATUS_HEX = { C: "#16A34A", NC: "#DC2626", H: "#EAB308" } as const;
export const STATUS_LABEL = { C: "Completed", NC: "Not completed", H: "On hold" } as const;

/** Black or white text, whichever reads better on the given colour. */
export function readableOn(color: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return "#FFFFFF";
  const value = Number.parseInt(color.slice(1), 16);
  const luminance = (0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255)) / 255;
  return luminance > 0.6 ? "#1C1C1C" : "#FFFFFF";
}
