import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The type scale is numeric (text-11 … text-44), which tailwind-merge cannot tell
 * apart from a colour utility — it would file `text-13` under `text-color` and let
 * it silently drop `text-on-accent` / `text-white`. Teaching it the scale keeps
 * size and colour in separate conflict groups, so both survive a merge.
 */
const FONT_SIZES = ["11", "12", "13", "14", "16", "20", "26", "34", "44"];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Every number in the product is tabular and carries its unit. */
export const num = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
