/**
 * ShopLedger - Shop Settings & Preferences View
 * Features:
 * - Shop Profile editor (Business Name, Phone, Address)
 * - Category Customizer (Add/Delete Sale, Purchase, Expense categories)
 * - Language Preference selector (English / Malayalam)
 */
import { t } from '../i18n/index.js';
import { shopService, authService } from '../services/index.js';
import { showToast } from '../components/toast.js';

let activeCategoryTab = 'sale'; // 'sale' | 'purchase' | 'expense'

export async function renderSettings() {
  const user = await authService.getCurrentUser();
  if (!user) return '';

  const shopId = user.shopId || 'shop_metro_001';
  const shop = await shopService.getShop(shopId) || {
    name: 'Metro Mobiles',
    category: 'Mobile & Accessories',
    phone: '+919876543210',
    address: 'MG Road, Ernakulam',
    customCategories: {
      sale: ['Smartphones', 'Accessories', 'Screen Guard / Glass', 'Repair & Service', 'Recharge'],
      purchase: ['Stock / Inventory', 'Spare Parts / Displays', 'Packaging Materials'],
      expense: ['Shop Rent', 'Electricity', 'Staff Salary / Advance', 'Staff Food / Tea', 'Petrol / Delivery', 'Misc Repairs']
    }
  };

  const cats = shop.customCategories || { sale: [], purchase: [], expense: [] };
  const currentList = cats[activeCategoryTab] || [];

  return `
    <div class="page-container" style="max-width: 800px;">
      <!-- Page Header -->
      <div class="page-header mb-4">
        <div>
          <h2 class="page-title">${t('shopSettingsTitle')}</h2>
          <p class="page-subtitle">Configure business details, category options, and display preferences</p>
        </div>
      </div>


      <!-- 1. Shop Profile Form Card -->
      <div class="sl-card p-4 mb-4">
        <h5 class="fw-bold mb-3 d-flex align-items-center gap-2">
          <i class="bi bi-shop text-primary"></i>
          ${t('shopProfile')}
        </h5>

        <form id="settings-profile-form">
          <div class="row g-3">
            <div class="col-12 col-sm-6">
              <label for="set-shop-name" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">
                ${t('shopName')}
              </label>
              <input type="text" id="set-shop-name" class="form-control" value="${shop.name}" required>
            </div>

            <div class="col-12 col-sm-6">
              <label for="set-shop-cat" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">
                ${t('shopCategory')}
              </label>
              <input type="text" id="set-shop-cat" class="form-control" value="${shop.category || ''}" required>
            </div>

            <div class="col-12 col-sm-6">
              <label for="set-shop-phone" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">
                Business Contact Phone
              </label>
              <input type="tel" id="set-shop-phone" class="form-control" value="${shop.phone || ''}">
            </div>

            <div class="col-12 col-sm-6">
              <label for="set-shop-address" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">
                Shop Address / Location
              </label>
              <input type="text" id="set-shop-address" class="form-control" value="${shop.address || ''}">
            </div>
          </div>

          <div class="mt-4 text-end">
            <button type="submit" id="btn-save-profile" class="sl-btn sl-btn-primary sl-btn-sm rounded-pill px-4">
              <i class="bi bi-check2"></i>
              <span>${t('saveSettings')}</span>
            </button>
          </div>
        </form>
      </div>

      <!-- 3. Custom Categories Manager Card -->
      <div class="sl-card p-4 mb-4">
        <h5 class="fw-bold mb-3 d-flex align-items-center gap-2">
          <i class="bi bi-tags-fill text-primary"></i>
          ${t('categoriesManager')}
        </h5>

        <!-- Category Type Tabs -->
        <div class="filter-bar-scroll mb-3" id="settings-category-tabs">
          <button class="filter-pill ${activeCategoryTab === 'sale' ? 'active' : ''}" data-cat-tab="sale">
            Sale Categories (${cats.sale ? cats.sale.length : 0})
          </button>
          <button class="filter-pill ${activeCategoryTab === 'purchase' ? 'active' : ''}" data-cat-tab="purchase">
            Purchase Categories (${cats.purchase ? cats.purchase.length : 0})
          </button>
          <button class="filter-pill ${activeCategoryTab === 'expense' ? 'active' : ''}" data-cat-tab="expense">
            Expense Categories (${cats.expense ? cats.expense.length : 0})
          </button>
        </div>

        <!-- Add Category Form -->
        <div class="input-group mb-3">
          <input type="text" id="new-category-name" class="form-control" placeholder="Type new category name...">
          <button class="btn btn-outline-primary" type="button" id="btn-add-category">
            <i class="bi bi-plus-lg me-1"></i>${t('addCategory')}
          </button>
        </div>

        <!-- Current Category Chips -->
        <div class="d-flex flex-wrap gap-2" id="settings-category-chips">
          ${currentList.map(item => `
            <span class="badge bg-light text-dark border p-2 px-3 rounded-pill d-inline-flex align-items-center gap-2" style="font-size: 13px;">
              <span>${item}</span>
              <button type="button" class="btn-close btn-close-sm btn-delete-cat" data-name="${item}" aria-label="Remove"></button>
            </span>
          `).join('')}
        </div>
      </div>

    </div>
  `;
}

export function bindSettingsEvents(router) {
  // Profile Form Submit
  const profileForm = document.getElementById('settings-profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = await authService.getCurrentUser();
      const shopId = user.shopId || 'shop_metro_001';

      const name = document.getElementById('set-shop-name').value.trim();
      const category = document.getElementById('set-shop-cat').value.trim();
      const phone = document.getElementById('set-shop-phone').value.trim();
      const address = document.getElementById('set-shop-address').value.trim();

      try {
        await shopService.updateShop(shopId, { name, category, phone, address });
        showToast('Shop profile updated successfully!', 'success');
        router.refresh();
      } catch (err) {
        showToast('Error updating shop: ' + err.message, 'error');
      }
    });
  }

  // Category Tabs
  const catTabs = document.getElementById('settings-category-tabs');
  if (catTabs) {
    catTabs.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;

      activeCategoryTab = pill.dataset.catTab;
      router.refresh();
    });
  }

  // Add Category
  const addCatBtn = document.getElementById('btn-add-category');
  const catInput = document.getElementById('new-category-name');
  if (addCatBtn && catInput) {
    addCatBtn.addEventListener('click', async () => {
      const val = catInput.value.trim();
      if (!val) return;

      const user = await authService.getCurrentUser();
      const shopId = user.shopId || 'shop_metro_001';
      const shop = await shopService.getShop(shopId);

      const cats = shop.customCategories || { sale: [], purchase: [], expense: [] };
      if (!cats[activeCategoryTab].includes(val)) {
        cats[activeCategoryTab].push(val);
        await shopService.updateShop(shopId, { customCategories: cats });
        showToast(`Added "${val}" to ${activeCategoryTab} categories!`, 'success');
        router.refresh();
      } else {
        showToast('Category already exists!', 'warning');
      }
    });
  }

  // Delete Category
  const deleteCatBtns = document.querySelectorAll('.btn-delete-cat');
  deleteCatBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      const user = await authService.getCurrentUser();
      const shopId = user.shopId || 'shop_metro_001';
      const shop = await shopService.getShop(shopId);

      const cats = shop.customCategories || { sale: [], purchase: [], expense: [] };
      cats[activeCategoryTab] = cats[activeCategoryTab].filter(c => c !== name);

      await shopService.updateShop(shopId, { customCategories: cats });
      showToast(`Removed "${name}"`, 'info');
      router.refresh();
    });
  });
}
