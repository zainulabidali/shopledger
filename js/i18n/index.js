/**
 * ShopLedger - i18n & Localization Engine
 */
import en from './en.js';
import ml from './ml.js';

const dictionaries = { en, ml };
const STORAGE_KEY = 'shopledger_locale';

let currentLocale = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) || 'en';
const listeners = new Set();

/**
 * Get translation for a key
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  const dict = dictionaries[currentLocale] || dictionaries.en;
  return dict[key] || dictionaries.en[key] || key;
}

/**
 * Get currently active locale ('en' | 'ml')
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Switch application locale and notify listeners
 * @param {'en' | 'ml'} locale
 */
export function setLocale(locale) {
  if (dictionaries[locale]) {
    currentLocale = locale;
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    listeners.forEach(fn => fn(currentLocale));
  }
}

/**
 * Subscribe to language changes
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export function onLocaleChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Indian Rupee Currency Formatter (₹1,23,456)
 * @param {number} amount
 * @param {boolean} showFraction
 * @returns {string}
 */
export function formatINR(amount, showFraction = false) {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: showFraction ? 2 : 0,
    minimumFractionDigits: showFraction ? 2 : 0
  }).format(val);
}

/**
 * Format timestamp or time string in 12-hour format with lowercase am/pm (e.g. '1:00 am', '1:00 pm', '4:46 pm')
 * Returns 'Time unavailable' fallback for records without timestamps.
 */
export function formatTime12(val) {
  if (!val) return 'Time unavailable';

  if (typeof val === 'string') {
    const trimmed = val.trim();
    const formattedMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (formattedMatch) {
      let h = parseInt(formattedMatch[1], 10);
      const m = formattedMatch[2];
      const ampm = formattedMatch[3].toLowerCase();
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    }

    const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeOnlyMatch) {
      let h = parseInt(timeOnlyMatch[1], 10);
      const m = timeOnlyMatch[2];
      const ampm = h >= 12 ? 'pm' : 'am';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    }
  }

  let d = null;
  if (typeof val === 'object' && val !== null) {
    if (typeof val.toDate === 'function') d = val.toDate();
    else if (val.seconds !== undefined) d = new Date(val.seconds * 1000);
    else if (val instanceof Date) d = val;
  } else if (typeof val === 'string' || typeof val === 'number') {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) d = parsed;
  }

  if (!d || isNaN(d.getTime())) return 'Time unavailable';

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Helper to safely extract and format the transaction time from a tx record
 */
export function getTxTimeFormatted(tx) {
  if (!tx) return 'Time unavailable';
  if (tx.time && typeof tx.time === 'string' && tx.time.trim() !== '') {
    return formatTime12(tx.time);
  }
  if (tx.createdAt) {
    return formatTime12(tx.createdAt);
  }
  return 'Time unavailable';
}
