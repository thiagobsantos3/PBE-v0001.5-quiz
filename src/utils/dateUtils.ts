/**
 * Date utilities for consistent date handling across the application
 * All dates are handled in London timezone for consistent user experience
 */

/**
 * Parse a YYYY-MM-DD string from the database as a London timezone Date object at midnight
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object representing midnight London time of the given date
 */
export function parseDbDateToUtc(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  // Create a basic date object from the components
  const tempDate = new Date(year, month - 1, day);
  
  // Use getUtcMidnight to properly convert to UTC midnight of that London date
  return getUtcMidnight(tempDate);
}

/**
 * Get a Date object representing midnight of the given date in London timezone
 * @param date - Any Date object
 * @returns New Date object representing midnight London time of the given date
 */
export function getUtcMidnight(date: Date): Date {
  // Get the date components in London timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '1970');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1; // Month is 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  
  // Create UTC date representing midnight of that London date
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/**
 * Format a Date object for display in London timezone
 * @param date - Date object to format
 * @param options - Additional formatting options
 * @returns Formatted date string in London timezone
 */
export function formatDateForDisplay(
  date: Date, 
  options: Intl.DateTimeFormatOptions = {}
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/London',
    ...options
  };
  
  return date.toLocaleDateString('en-GB', defaultOptions);
}

/**
 * Convert a Date object to YYYY-MM-DD string for database storage
 * Uses London timezone for consistent date representation
 * @param date - Date object to convert
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForDb(date: Date): string {
  // Convert to London timezone first, then format
  const londonDateString = date.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  return londonDateString; // en-CA locale gives YYYY-MM-DD format
}

/**
 * Check if two dates represent the same day (ignoring time)
 * Comparison is done in London timezone
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if both dates represent the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  // Compare year, month, and day components directly in London timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts1 = formatter.formatToParts(date1);
  const parts2 = formatter.formatToParts(date2);
  
  const year1 = parts1.find(p => p.type === 'year')?.value;
  const month1 = parts1.find(p => p.type === 'month')?.value;
  const day1 = parts1.find(p => p.type === 'day')?.value;
  
  const year2 = parts2.find(p => p.type === 'year')?.value;
  const month2 = parts2.find(p => p.type === 'month')?.value;
  const day2 = parts2.find(p => p.type === 'day')?.value;
  
  return year1 === year2 && month1 === month2 && day1 === day2;
}

/**
 * Get the Monday of the week containing the given date
 * @param date - Any Date object
 * @returns Date object representing Monday of that week at UTC midnight
 */
export function getMondayOfWeek(date: Date): Date {
  const utcMidnight = getUtcMidnight(date);
  const dayOfWeek = utcMidnight.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days; otherwise go back (dayOfWeek - 1) days
  
  const monday = new Date(utcMidnight);
  monday.setDate(monday.getDate() - daysToSubtract);
  return monday;
}

/**
 * Get the Sunday of the week containing the given date
 * @param date - Any Date object
 * @returns Date object representing Sunday of that week at UTC midnight
 */
export function getSundayOfWeek(date: Date): Date {
  const utcMidnight = getUtcMidnight(date);
  const dayOfWeek = utcMidnight.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  const sunday = new Date(utcMidnight);
  sunday.setDate(sunday.getDate() - dayOfWeek); // Subtract days to get to Sunday
  return sunday;
}

/**
 * Add or subtract days from a date
 * @param date - Base date
 * @param days - Number of days to add (positive) or subtract (negative)
 * @returns New Date object with days added/subtracted
 */
export function addDays(date: Date, days: number): Date {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}