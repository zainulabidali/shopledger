/**
 * ShopLedger - Mobile Bottom Navigation Component
 */
import { authService } from '../services/index.js';

export async function renderBottomNav(currentHash) {
  const user = await authService.getCurrentUser();
  if (!user) return '';

  const isAdmin = user.role === 'admin' || user.role === 'owner';
  const isStaff = user.role === 'staff';
  const isSuperAdmin = user.role === 'super_admin';

  if (isSuperAdmin) {
    return `
      <nav class="mobile-bottom-nav">
        <a href="#/admin" class="bottom-nav-item ${currentHash === '#/admin' ? 'active' : ''}">
          <i class="bi bi-shield-lock-fill"></i>
          <span>Admin</span>
        </a>
      </nav>
    `;
  }

  return `
    <nav class="mobile-bottom-nav">
      ${isAdmin ? `
        <a href="#/dashboard" class="bottom-nav-item ${currentHash === '#/dashboard' ? 'active' : ''}">
          <i class="bi bi-grid-1x2${currentHash === '#/dashboard' ? '-fill' : ''}"></i>
          <span>Dashboard</span>
        </a>
      ` : `
        <a href="#/my-today" class="bottom-nav-item ${currentHash === '#/my-today' ? 'active' : ''}">
          <i class="bi bi-clock-history"></i>
          <span>My Shift</span>
        </a>
      `}

      <a href="#/transactions" class="bottom-nav-item ${currentHash === '#/transactions' ? 'active' : ''}">
        <i class="bi bi-receipt"></i>
        <span>Transactions</span>
      </a>

      <!-- Center Highlight Quick Add Button -->
      <a href="#/entry" class="bottom-nav-item nav-item-highlight ${currentHash === '#/entry' ? 'active' : ''}">
        <div class="highlight-circle">
          <i class="bi bi-plus-lg"></i>
        </div>
        <span>Quick Entry</span>
      </a>

      ${isAdmin ? `
        <a href="#/day-close" class="bottom-nav-item ${currentHash === '#/day-close' ? 'active' : ''}">
          <i class="bi bi-safe${currentHash === '#/day-close' ? '-fill' : ''}"></i>
          <span>Day Close</span>
        </a>

        <a href="#/reports" class="bottom-nav-item ${currentHash === '#/reports' ? 'active' : ''}">
          <i class="bi bi-bar-chart-line${currentHash === '#/reports' ? '-fill' : ''}"></i>
          <span>Reports</span>
        </a>
      ` : ''}
    </nav>
  `;
}
