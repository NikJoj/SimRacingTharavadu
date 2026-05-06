/* ═══════════════════════════════════════════════════
   UTILITIES - Helper Functions
   ═══════════════════════════════════════════════════ */

/**
 * Format event date range for display
 * @param {string} start - Start date ISO string
 * @param {string} end - End date ISO string
 * @returns {string} Formatted date string
 */
function formatEventDate(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const isSameDay = startDate.toDateString() === endDate.toDateString();

  const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };

  if (isSameDay) {
    return startDate.toLocaleDateString(undefined, dateOptions);
  } else {
    const localStart = startDate.toLocaleDateString(undefined, dateOptions);
    const localEnd = endDate.toLocaleDateString(undefined, dateOptions);
    return `${localStart} – ${localEnd}`;
  }
}

/**
 * Format event time range for display (returns null for all-day events)
 * @param {string} start - Start date ISO string
 * @param {string} end - End date ISO string
 * @returns {string|null} Formatted time string or null
 */
function formatEventTime(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const isAllDay = startDate.getUTCHours() === 0 && startDate.getUTCMinutes() === 0 && startDate.getUTCSeconds() === 0 &&
                   endDate.getUTCHours() === 23 && endDate.getUTCMinutes() === 59 && endDate.getUTCSeconds() === 59;

  if (isAllDay) return null;

  const timeOptions = { hour: '2-digit', minute: '2-digit' };
  const localStartTime = startDate.toLocaleTimeString(undefined, timeOptions);
  const localEndTime = endDate.toLocaleTimeString(undefined, timeOptions);
  return `${localStartTime} – ${localEndTime}`;
}

/**
 * Normalize race name (ensures default value)
 * @param {string} v - Race name value
 * @returns {string} Normalized race name
 */
function normalizeRaceName(v) {
  const s = (v ?? '').toString().trim();
  return s || 'Race 1';
}

// Made with Bob
