/**
 * ShopLedger - Application Bootstrap
 */
import { Router } from './router.js';
import { onLocaleChange } from './i18n/index.js';

document.addEventListener('DOMContentLoaded', () => {
  const router = new Router();
  router.init();

  // Re-render when language changes
  onLocaleChange(() => {
    router.refresh();
  });

  // Global uncaught error handler
  window.addEventListener('error', (event) => {
    console.error('ShopLedger Error:', event.error);
  });
});
