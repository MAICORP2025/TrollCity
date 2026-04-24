/**
 * Formats a date or timestamp string into a 12-hour time format (e.g., "04:30 PM").
 * @param date The date object or ISO timestamp string.
 * @returns Formatted time string.
 */
export function format12hr(date: Date | string | number): string {
  if (typeof date === 'string' && date.includes(':') && !date.includes('-') && !date.includes('T')) {
    // Looks like a time-only string (HH:mm:ss)
    date = `1970-01-01T${date}`;
  }
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formats a date or timestamp string into a full date and 12-hour time (e.g., "Jan 16, 2026 04:30 PM").
 */
export function formatFullDateTime12hr(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formats seconds into HH:MM:SS format.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
