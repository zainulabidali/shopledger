/**
 * ShopLedger - i18n & Localization Engine
 */
import en from './en.js';
import ml from './ml.js';

const dictionaries = { en, ml };
const STORAGE_KEY = 'shopledger_locale';

let currentLocale = localStorage.getItem(STORAGE_KEY) || 'en';
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
