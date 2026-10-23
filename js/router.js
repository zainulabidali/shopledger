/**
 * ShopLedger - Client SPA Router with Role-Based Access Guards
 */
import { authService } from './services/index.js';
import { renderNavbar, bindNavbarEvents } from './components/navbar.js';
import { renderSidebar } from './components/sidebar.js';
import { renderBottomNav } from './components/bottomNav.js';

// Page Views
import { renderLogin, bindLoginEvents } from './pages/login.js';
import { renderInvite, bindInviteEvents } from './pages/invite.js';
import { renderDashboard, bindDashboardEvents } from './pages/dashboard.js';
import { renderQuickEntry, bindQuickEntryEvents } from './pages/quickEntry.js';
import { renderTransactions, bindTransactionsEvents } from './pages/transactions.js';
import { renderDayClose, bindDayCloseEvents } from './pages/dayClose.js';
import { renderReports, bindReportsEvents } from './pages/reports.js';
import { renderStaff, bindStaffEvents } from './pages/staff.js';
import { renderAdmin, bindAdminEvents } from './pages/admin.js';
import { renderSettings, bindSettingsEvents } from './pages/settings.js';
import { renderMyToday, bindMyTodayEvents } from './pages/myToday.js';

export class Router {
  constructor() {
    this.currentHash = window.location.hash || '#/dashboard';
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  init() {
    this.handleRoute();
  }

  navigate(hash) {
    if (window.location.hash === hash) {
      this.handleRoute();
    } else {
      window.location.hash = hash;
    }
  }

  refresh() {
    this.handleRoute();
  }

  async handleRoute() {
    const rawHash = window.location.hash || '#/dashboard';
    const hash = rawHash.split('?')[0];
    this.currentHash = hash;

    const root = document.getElementById('app-root');
    if (!root) return;

    // Handle invitation route before user auth check
    if (hash === '#/invite') {
      root.innerHTML = await renderInvite();
      bindInviteEvents(this);
      window.scrollTo(0, 0);
      return;
    }

    const user = await authService.getCurrentUser();

    // 1. Unauthenticated Guard
    if (!user && hash !== '#/login') {
      window.location.hash = '#/login';
      return;
    }

    // 2. Already Logged In navigating to Login Page
    if (user && hash === '#/login') {
      if (user.role === 'staff') {
        window.location.hash = '#/my-today';
      } else if (user.role === 'super_admin') {
        window.location.hash = '#/admin';
      } else {
        window.location.hash = '#/dashboard';
      }
      return;
    }

    // 3. Render Login View (Fullscreen, no app shell)
    if (hash === '#/login') {
      root.innerHTML = renderLogin();
      bindLoginEvents(this);
      window.scrollTo(0, 0);
      return;
    }

    // 4. Role Guards
    if (user.role === 'staff' && (hash === '#/dashboard' || hash === '#/day-close' || hash === '#/reports' || hash === '#/staff' || hash === '#/admin' || hash === '#/settings')) {
      window.location.hash = '#/my-today';
      return;
    }

    if (user.role !== 'super_admin' && hash === '#/admin') {
      window.location.hash = '#/dashboard';
      return;
    }

    // 5. Render Authenticated App Shell with Header, Sidebar, Bottom Nav
    const [navbarHtml, sidebarHtml, bottomNavHtml] = await Promise.all([
      renderNavbar(),
      renderSidebar(hash),
      renderBottomNav(hash)
    ]);

    let pageHtml = '';
    let bindPageFn = null;

    switch (hash) {
      case '#/dashboard':
        pageHtml = await renderDashboard();
        bindPageFn = bindDashboardEvents;
        break;
      case '#/entry':
        pageHtml = await renderQuickEntry();
        bindPageFn = bindQuickEntryEvents;
        break;
      case '#/transactions':
        pageHtml = await renderTransactions();
        bindPageFn = bindTransactionsEvents;
        break;
      case '#/day-close':
        pageHtml = await renderDayClose();
        bindPageFn = bindDayCloseEvents;
        break;
      case '#/reports':
        pageHtml = await renderReports();
        bindPageFn = bindReportsEvents;
        break;
      case '#/staff':
        pageHtml = await renderStaff();
        bindPageFn = bindStaffEvents;
        break;
      case '#/admin':
        pageHtml = await renderAdmin();
        bindPageFn = bindAdminEvents;
        break;
      case '#/settings':
        pageHtml = await renderSettings();
        bindPageFn = bindSettingsEvents;
        break;
      case '#/my-today':
        pageHtml = await renderMyToday();
        bindPageFn = bindMyTodayEvents;
        break;
      default:
        if (user.role === 'staff') {
          pageHtml = await renderMyToday();
          bindPageFn = bindMyTodayEvents;
        } else if (user.role === 'super_admin') {
          pageHtml = await renderAdmin();
          bindPageFn = bindAdminEvents;
        } else {
          pageHtml = await renderDashboard();
          bindPageFn = bindDashboardEvents;
        }
        break;
    }

    root.innerHTML = `
      ${sidebarHtml}
      <div class="app-main">
        ${navbarHtml}
        <main>
          ${pageHtml}
        </main>
        ${bottomNavHtml}
      </div>
    `;

    bindNavbarEvents(this);
    if (bindPageFn) {
      bindPageFn(this);
    }

    window.scrollTo(0, 0);
  }
}
