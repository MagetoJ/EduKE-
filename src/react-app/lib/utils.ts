import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function formatClassName(
  gradeName: string, 
  streamName?: string | null, 
  hasMultipleStreams: boolean = true
): string {
  if (!hasMultipleStreams || !streamName) {
    return gradeName; // Output: "Grade 10"
  }
  return `${gradeName} ${streamName}`; // Output: "Grade 10 Mars"
}