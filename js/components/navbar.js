/**
 * ShopLedger - Top Navigation Bar Component
 * Clean header showing Shop Name, Role Badge, and User Profile with Logout.
 * No demo shortcuts, no language switcher.
 */
import { authService, shopService } from '../services/index.js';
import { showToast } from './toast.js';

export async function renderNavbar() {
  const user = await authService.getCurrentUser();
  if (!user) return '';

  let shopName = 'ShopLedger';
  if (user.shopId) {
    const shop = await shopService.getShop(user.shopId);
    if (shop) shopName = shop.name;
  } else if (user.role === 'super_admin') {
    shopName = 'ShopLedger Global Admin';
  }

  const roleLabels = {
    owner: 'Admin',
    admin: 'Admin',
    staff: 'Staff',
    super_admin: 'Super Admin'
  };

  const roleBadges = {
    owner: 'bg-primary-subtle text-primary border border-primary-subtle',
    admin: 'bg-primary-subtle text-primary border border-primary-subtle',
    staff: 'bg-success-subtle text-success border border-success-subtle',
    super_admin: 'bg-dark-subtle text-dark border border-dark-subtle'
  };

  const isAdmin = user.role === 'admin' || user.role === 'owner';

  return `
    <header class="app-header">
      <div class="app-header-left">
        <a href="${isAdmin ? '#/dashboard' : (user.role === 'staff' ? '#/my-today' : '#/admin')}" class="d-lg-none text-decoration-none d-flex align-items-center me-1">
          <div class="brand-logo-icon" style="width:34px;height:34px;border-radius:8px;background:var(--sl-brand-primary);display:flex;align-items:center;justify-content:center;color:#fff;">
            <i class="bi bi-wallet2"></i>
          </div>
        </a>
        <div class="shop-title-badge">
          <span class="shop-name fw-bold" title="${shopName}">${shopName}</span>
          <span class="user-role-pill ${roleBadges[user.role] || ''}">
            ${roleLabels[user.role] || user.role}
          </span>
        </div>
      </div>

      <div class="app-header-right">
        <!-- User Profile Dropdown -->
        <div class="dropdown">
          <button class="btn btn-sm p-0 rounded-circle border-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <div class="user-avatar" style="width: 36px; height: 36px; border-radius: 50%; background-color: var(--sl-brand-100); color: var(--sl-brand-primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">
              ${user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-sm border py-2" style="border-radius: 12px; min-width: 200px;">
            <li class="px-3 py-2 border-bottom">
              <div class="fw-bold text-dark text-truncate">${user.name || 'User'}</div>
              <div class="text-muted small text-truncate">${user.email}</div>
            </li>
            ${isAdmin ? `
              <li><a class="dropdown-item py-2" href="#/settings"><i class="bi bi-gear me-2"></i>Settings</a></li>
            ` : ''}
            <li><hr class="dropdown-divider my-1"></li>
            <li>
              <button class="dropdown-item py-2 text-danger" id="nav-logout-btn">
                <i class="bi bi-box-arrow-right me-2"></i>Sign Out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  `;
}

export function bindNavbarEvents(router) {
  const logoutBtn = document.getElementById('nav-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await authService.logout();
      showToast('Signed out successfully.', 'info');
      router.navigate('#/login');
    });
  }
}
