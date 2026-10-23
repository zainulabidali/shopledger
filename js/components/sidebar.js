/**
 * ShopLedger - Desktop Sidebar Component
 * Role-based clean navigation for Super Admin, Admin, and Staff
 */
import { authService } from '../services/index.js';

export async function renderSidebar(currentHash) {
  const user = await authService.getCurrentUser();
  if (!user) return '';

  const isAdmin = user.role === 'admin' || user.role === 'owner';
  const isStaff = user.role === 'staff';
  const isSuperAdmin = user.role === 'super_admin';

  return `
    <aside class="app-sidebar">
      <a href="${isAdmin ? '#/dashboard' : (isStaff ? '#/my-today' : '#/admin')}" class="sidebar-brand">
        <div class="brand-logo-icon">
          <i class="bi bi-wallet2"></i>
        </div>
        <span>ShopLedger</span>
      </a>

      <nav class="sidebar-nav">
        <div class="sidebar-section-title">Menu</div>

        ${isAdmin ? `
          <a href="#/dashboard" class="sidebar-nav-item ${currentHash === '#/dashboard' ? 'active' : ''}">
            <i class="bi bi-grid-1x2-fill"></i>
            <span>Dashboard</span>
          </a>
        ` : ''}

        ${isStaff ? `
          <a href="#/my-today" class="sidebar-nav-item ${currentHash === '#/my-today' ? 'active' : ''}">
            <i class="bi bi-clock-history"></i>
            <span>My Shift</span>
          </a>
        ` : ''}

        <a href="#/entry" class="sidebar-nav-item ${currentHash === '#/entry' ? 'active' : ''}">
          <i class="bi bi-plus-circle-fill"></i>
          <span>Quick Entry</span>
        </a>

        <a href="#/transactions" class="sidebar-nav-item ${currentHash === '#/transactions' ? 'active' : ''}">
          <i class="bi bi-receipt"></i>
          <span>Transactions</span>
        </a>

        ${isAdmin ? `
          <a href="#/day-close" class="sidebar-nav-item ${currentHash === '#/day-close' ? 'active' : ''}">
            <i class="bi bi-safe-fill"></i>
            <span>Day Close</span>
          </a>

          <a href="#/reports" class="sidebar-nav-item ${currentHash === '#/reports' ? 'active' : ''}">
            <i class="bi bi-bar-chart-line-fill"></i>
            <span>Reports</span>
          </a>

          <div class="sidebar-section-title">Management</div>

          <a href="#/staff" class="sidebar-nav-item ${currentHash === '#/staff' ? 'active' : ''}">
            <i class="bi bi-people-fill"></i>
            <span>Staff</span>
          </a>

          <a href="#/settings" class="sidebar-nav-item ${currentHash === '#/settings' ? 'active' : ''}">
            <i class="bi bi-gear-fill"></i>
            <span>Settings</span>
          </a>
        ` : ''}

        ${isSuperAdmin ? `
          <div class="sidebar-section-title">Platform</div>

          <a href="#/admin" class="sidebar-nav-item ${currentHash === '#/admin' ? 'active' : ''}">
            <i class="bi bi-shield-lock-fill"></i>
            <span>Admin Console</span>
          </a>
        ` : ''}
      </nav>

      <div class="sidebar-footer">
        <div class="small text-muted">ShopLedger v2.0</div>
      </div>
    </aside>
  `;
}
