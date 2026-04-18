import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge classnames with Tailwind CSS conflict resolution
 * Combines clsx for conditional classes with tailwind-merge for proper precedence
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency values for USD display
 * Examples: 1000 -> "$1,000.00", 1234.56 -> "$1,234.56"
 */
export function formatCurrency(amount, currency = 'USD', locale = 'en-US') {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return `$0.00`;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format large numbers with compact notation
 * Examples: 1000000 -> "1.0M", 45000 -> "45K", 999 -> "999"
 */
export function formatNumber(num, decimals = 1) {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0';
  }

  if (Math.abs(num) === 0) {
    return '0';
  }

  if (Math.abs(num) >= 1_000_000) {
    return (num / 1_000_000).toFixed(decimals).replace(/\.?0+$/, '') + 'M';
  }

  if (Math.abs(num) >= 1_000) {
    return (num / 1_000).toFixed(decimals).replace(/\.?0+$/, '') + 'K';
  }

  if (Math.abs(num) >= 1) {
    return num.toFixed(0);
  }

  return num.toFixed(2);
}

/**
 * Format percentage values
 * Examples: 0.456 -> "45.6%", 0.5 -> "50.0%", 5 -> "500.0%"
 */
export function formatPercent(value, decimals = 1) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }

  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Tier thresholds (based on total CLICKS, not views or conversions)
 * Bronze: 0–4,999 · Silver: 5k–24,999 · Gold: 25k–99,999 · Platinum: 100k+
 */
export const TIER_THRESHOLDS = {
  BRONZE: { min: 0, max: 4999, commission: 0.05, color: 'gray', level: 1 },
  SILVER: { min: 5000, max: 24999, commission: 0.08, color: 'green', level: 2 },
  GOLD: { min: 25000, max: 99999, commission: 0.12, color: 'yellow', level: 3 },
  PLATINUM: { min: 100000, max: Infinity, commission: 0.15, color: 'purple', level: 4 },
};

/**
 * Calculate creator tier based on total CLICKS.
 * Returns { tier, level, minClicks, maxClicks, color, commission } where commission is 0-1.
 * Tiers align with Prisma CreatorTier enum: BRONZE / SILVER / GOLD / PLATINUM.
 */
export function calculateTier(totalClicks) {
  const clicks = typeof totalClicks === 'number' && totalClicks >= 0 ? totalClicks : 0;

  const tierName =
    clicks >= TIER_THRESHOLDS.PLATINUM.min
      ? 'PLATINUM'
      : clicks >= TIER_THRESHOLDS.GOLD.min
        ? 'GOLD'
        : clicks >= TIER_THRESHOLDS.SILVER.min
          ? 'SILVER'
          : 'BRONZE';

  const data = TIER_THRESHOLDS[tierName];

  return {
    tier: tierName,
    level: data.level,
    minClicks: data.min,
    maxClicks: data.max,
    commission: data.commission,
    color: data.color,
    // Back-compat for older callers:
    minConversions: data.min,
    maxConversions: data.max,
  };
}

/**
 * Calculate commission rate based on creator tier.
 * Returns percentage as decimal (0.05 = 5%).
 * BRONZE: 5%, SILVER: 8%, GOLD: 12%, PLATINUM: 15%.
 */
export function calculateCommissionRate(tier) {
  const tierData = typeof tier === 'object' ? tier : calculateTier(tier);
  const key = (tierData.tier || '').toUpperCase();
  return TIER_THRESHOLDS[key]?.commission ?? TIER_THRESHOLDS.BRONZE.commission;
}

/**
 * Get date range for common periods
 * Supported periods: 'last_7_days', 'last_30_days', 'last_90_days', 'last_year', 'today', 'month_to_date'
 * Returns: { startDate: ISO string, endDate: ISO string }
 */
export function getDateRange(period = 'last_30_days') {
  const today = new Date();
  const endDate = new Date(today);
  let startDate = new Date(today);

  // Set end date to end of today
  endDate.setHours(23, 59, 59, 999);

  switch (period) {
    case 'today':
      startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      break;

    case 'last_7_days':
      startDate.setDate(today.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;

    case 'last_30_days':
      startDate.setDate(today.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      break;

    case 'last_90_days':
      startDate.setDate(today.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);
      break;

    case 'last_year':
      startDate.setFullYear(today.getFullYear() - 1);
      startDate.setHours(0, 0, 0, 0);
      break;

    case 'month_to_date':
      startDate = new Date(today);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      break;

    case 'year_to_date':
      startDate = new Date(today.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
      break;

    default:
      // Default to last 30 days
      startDate.setDate(today.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Calculate percentage change between two values
 * Returns percentage as number (-50, 25, 100)
 * Handles division by zero and negative numbers
 */
export function calculatePercentChange(oldValue, newValue) {
  if (typeof oldValue !== 'number' || typeof newValue !== 'number') {
    return 0;
  }

  if (oldValue === 0) {
    return newValue > 0 ? 100 : newValue < 0 ? -100 : 0;
  }

  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

/**
 * Truncate text to specified length with ellipsis
 * Examples: "Hello World" -> "Hello W..." (length 8)
 */
export function truncateText(text, length = 50) {
  if (typeof text !== 'string') {
    return '';
  }

  if (text.length <= length) {
    return text;
  }

  return text.substring(0, length).trim() + '...';
}

/**
 * Convert bytes to human readable format
 * Examples: 1024 -> "1 KB", 1048576 -> "1 MB"
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Slugify a string for URLs
 * Examples: "Hello World!" -> "hello-world", "Café" -> "cafe"
 */
export function slugify(text) {
  if (typeof text !== 'string') {
    return '';
  }

  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Delay execution with promise
 * Usage: await delay(1000) for 1 second delay
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, etc.)
 */
export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map((item) => deepClone(item));
  if (obj instanceof Object) {
    const cloned = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

/**
 * Merge multiple objects (shallow merge, last value wins)
 */
export function mergeObjects(...objects) {
  return objects.reduce((merged, obj) => {
    if (typeof obj === 'object' && obj !== null) {
      Object.assign(merged, obj);
    }
    return merged;
  }, {});
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(condition, timeout = 10000, checkInterval = 100) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (condition()) {
      return true;
    }
    await delay(checkInterval);
  }

  return false;
}

export default {
  cn,
  formatCurrency,
  formatNumber,
  formatPercent,
  calculateTier,
  calculateCommissionRate,
  getDateRange,
  calculatePercentChange,
  truncateText,
  formatBytes,
  slugify,
  delay,
  isEmpty,
  deepClone,
  mergeObjects,
  waitFor,
};
