import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isAuthRoute = (pathname: string) => {
  return pathname.startsWith('/auth') || pathname.startsWith('/callback') || pathname.startsWith('/profile/setup');
};

export function formatCompactNumber(number: number) {
  if (number < 1000) {
    return number.toString();
  }
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(number);
}
