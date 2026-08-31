import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, letting a caller's utility win over the component's own.
 *
 * Every component in this library takes `className` and ends its class list
 * with `cn(..., className)`, so consumers can override a token binding at the
 * call site without `!important` or wrapper divs.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
