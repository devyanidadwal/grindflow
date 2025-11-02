import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx and tailwind-merge for optimal class merging
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts the username (part before @) from an email address
 * @param email - The email address
 * @returns The username part or 'User' if email is invalid
 */
export function getUsernameFromEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return 'User'
  const atIndex = email.indexOf('@')
  if (atIndex === -1) return email // Return as-is if no @ found
  return email.substring(0, atIndex)
}
