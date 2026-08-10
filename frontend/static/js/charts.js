// Shared Chart.js helpers for the Reports, Charts and Analytics milestone.
// Chart.js is loaded via CDN in index.html and exposes the global `Chart`.

// Palette consistent with the pastel colours used across the app UI.
export const CHART_COLORS = {
  blue: "#90CAF9",
  green: "#A5D6A7",
  orange: "#FFCC80",
  red: "#EF9A9A",
  purple: "#B39DDB",
  pink: "#F48FB1",
};

export const STATUS_COLORS = {
  pending: CHART_COLORS.orange,
  approved: CHART_COLORS.blue,
  open: CHART_COLORS.green,
  closed: CHART_COLORS.red,
  completed: CHART_COLORS.purple,
};

export const DIFFICULTY_COLORS = {
  easy: CHART_COLORS.green,
  moderate: CHART_COLORS.orange,
  hard: CHART_COLORS.red,
};

export const BOOKING_STATUS_COLORS = {
  booked: "#64B5F6",
  cancelled: CHART_COLORS.red,
  completed: CHART_COLORS.purple,
};

/**
 * Create (or replace) a Chart.js instance on the given canvas element.
 * Returns the Chart instance, or null when Chart.js failed to load.
 */
export function renderChart(canvas, config) {
  if (!canvas || typeof Chart === "undefined") return null;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  return new Chart(canvas.getContext("2d"), config);
}

/** Destroy a Chart.js instance (safe to call with null). */
export function destroyChart(chart) {
  if (chart) chart.destroy();
}

/** Turn a 'YYYY-MM' month key into a short label like 'Aug 26'. */
export function formatMonthLabel(key) {
  const d = new Date(`${key}-01T00:00:00`);
  if (isNaN(d)) return key;
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}
