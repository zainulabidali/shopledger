/**
 * ShopLedger - Quick Entry View
 * Touch-optimized for rapid mobile cashier logging:
 * - 3-way Segmented Type Switch (Sale / Purchase / Expense)
 * - Large 32px Amount Box with quick increment chips (+₹50, +₹100, +₹500, +₹1,000, +₹2,000)
 * - Dynamic Category Chips based on active type
 * - Payment Mode Pills (Cash, UPI/GPay, Card)
 * - Item description & optional note
 * - Live "Today's Recent Entries" feed for instant validation
 */
import { t, formatINR, getTxTimeFormatted } from '../i18n/index.js';
import { authService, shopService, txService } from '../services/index.js';
import { showToast } from '../components/toast.js';

let activeType = 'sale'; // 'sale' | 'purchase' | 'expense'
let activeCategory = '';
let activePaymentMode = 'cash';
let currentAmount = 0;

export async function renderQuickEntry() {
  const user = await authService.getCurrentUser();
  if (!user) return '';

  const shopId = user.shopId || 'shop_metro_001';
  const shop = await shopService.getShop(shopId);

  const categoriesByType = (shop && shop.customCategories) ? shop.customCategories : {
    sale: ['Smartphones', 'Accessories', 'Screen Guard / Glass', 'Repair & Service', 'Recharge'],
    purchase: ['Stock / Inventory', 'Spare Parts / Displays', 'Packaging Materials'],
    expense: ['Shop Rent', 'Electricity', 'Staff Salary / Advance', 'Staff Food / Tea', 'Petrol / Delivery', 'Misc Repairs']
  };

  const currentCategories = categoriesByType[activeType] || [];
  if (!activeCategory || !currentCategories.includes(activeCategory)) {
    activeCategory = currentCategories[0] || 'General';
  }

  // Fetch recent entries for today
  const todayStr = new Date().toISOString().split('T')[0];
  const { transactions: todayEntries } = await txService.getTransactions(shopId, {
    date: todayStr,
    limit: 5,
    staffUid: user.role === 'staff' ? user.uid : null
  });

  return `
    <div class="page-container" style="max-width: 640px;">
      <!-- Title -->
      <div class="page-header mb-3">
        <div>
          <h2 class="page-title">${t('quickEntry')}</h2>
          <p class="page-subtitle">${t('tagline')}</p>
        </div>
      </div>

      <!-- Main Entry Card -->
      <div class="sl-card p-3 p-sm-4 mb-4">
        <form id="quick-entry-form">
          <!-- 1. Transaction Type Segmented Switch -->
          <div class="type-segmented-control mb-3">
            <button type="button" class="type-btn type-sale ${activeType === 'sale' ? 'active' : ''}" data-type="sale">
              <i class="bi bi-plus-circle-fill"></i>
              <span>${t('typeSale')}</span>
            </button>
            <button type="button" class="type-btn type-purchase ${activeType === 'purchase' ? 'active' : ''}" data-type="purchase">
              <i class="bi bi-box-seam-fill"></i>
              <span>${t('typePurchase')}</span>
            </button>
            <button type="button" class="type-btn type-expense ${activeType === 'expense' ? 'active' : ''}" data-type="expense">
              <i class="bi bi-dash-circle-fill"></i>
              <span>${t('typeExpense')}</span>
            </button>
          </div>

          <!-- 2. Large Amount Input Box -->
          <div class="amount-display-container">
            <div class="d-flex align-items-center justify-content-center">
              <span class="amount-currency-prefix">₹</span>
              <input type="number" id="entry-amount" class="amount-input-large" placeholder="0" min="1" step="any" inputmode="decimal" aria-label="Transaction amount" autofocus required>
            </div>
          </div>

          <!-- Quick Increment Chips -->
          <div class="quick-increments">
            <button type="button" class="increment-chip" data-add="50" aria-label="Add 50 rupees">+₹50</button>
            <button type="button" class="increment-chip" data-add="100" aria-label="Add 100 rupees">+₹100</button>
            <button type="button" class="increment-chip" data-add="500" aria-label="Add 500 rupees">+₹500</button>
            <button type="button" class="increment-chip" data-add="1000" aria-label="Add 1000 rupees">+₹1k</button>
            <button type="button" class="increment-chip" data-add="2000" aria-label="Add 2000 rupees">+₹2k</button>
            <button type="button" class="increment-chip text-danger" id="btn-amount-clear" aria-label="Clear amount">
              <i class="bi bi-backspace"></i>
            </button>
          </div>

          <!-- 3. Dynamic Category Chips -->
          <div class="mb-3">
            <label class="form-label small fw-bold text-secondary text-uppercase d-flex align-items-center gap-1" style="font-size: 11px;">
              <i class="bi bi-tags-fill text-muted"></i>
              ${t('category')}
            </label>
            <div class="category-chips-grid" id="category-chips-wrap">
              ${currentCategories.map(cat => `
                <button type="button" class="category-chip ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">
                  ${cat}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- 4. Payment Mode Pills -->
          <div class="mb-3">
            <label class="form-label small fw-bold text-secondary text-uppercase d-flex align-items-center gap-1" style="font-size: 11px;">
              <i class="bi bi-wallet-fill text-muted"></i>
              ${t('paymentMode')}
            </label>
            <div class="payment-mode-group">
              <button type="button" class="payment-mode-pill ${activePaymentMode === 'cash' ? 'active' : ''}" data-mode="cash">
                <i class="bi bi-cash-stack"></i>
                <span>${t('cash')}</span>
              </button>
              <button type="button" class="payment-mode-pill ${activePaymentMode === 'upi' ? 'active' : ''}" data-mode="upi">
                <i class="bi bi-qr-code-scan"></i>
                <span>${t('upi')}</span>
              </button>
              <button type="button" class="payment-mode-pill ${activePaymentMode === 'card' ? 'active' : ''}" data-mode="card">
                <i class="bi bi-credit-card"></i>
                <span>${t('card')}</span>
              </button>
            </div>
          </div>

          <!-- 5. Item / Service Name -->
          <div class="mb-3">
            <label for="entry-item" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">
              ${t('itemOrService')}
            </label>
            <div class="input-group">
              <span class="input-group-text bg-white text-muted"><i class="bi bi-card-text"></i></span>
              <input type="text" id="entry-item" class="form-control" placeholder="e.g. Earphone, Tempered Glass, Petrol" required>
            </div>
          </div>

          <!-- 6. Optional Note -->
          <div class="mb-4">
            <label for="entry-note" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">
              ${t('note')}
            </label>
            <input type="text" id="entry-note" class="form-control" placeholder="Optional details (e.g. Bill #120, Google Pay)">
          </div>

          <!-- 7. Save Entry Button -->
          <button type="submit" id="btn-save-entry" class="sl-btn sl-btn-primary sl-btn-block sl-btn-lg">
            <i class="bi bi-check2-circle fs-5"></i>
            <span id="btn-save-label">${t('saveEntry')}</span>
          </button>
        </form>
      </div>

      <!-- Live Recent Entries Feed (Today) -->
      <div class="sl-card p-3">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h6 class="fw-bold mb-0 text-dark small text-uppercase" style="letter-spacing: 0.5px;">
            <i class="bi bi-clock-history me-1 text-primary"></i>
            ${t('recentEntries')}
          </h6>
          <a href="#/transactions" class="text-decoration-none small fw-semibold text-primary">
            View All <i class="bi bi-chevron-right"></i>
          </a>
        </div>

        <div id="recent-entries-feed">
          ${todayEntries.length === 0 ? `
            <div class="text-center py-3 text-muted small">
              No entries recorded yet today. Use the form above to log your first transaction!
            </div>
          ` : `
            <div class="list-group list-group-flush">
              ${todayEntries.map(e => `
                <div class="list-group-item px-0 py-2 d-flex align-items-center justify-content-between">
                  <div class="d-flex align-items-center gap-2">
                    <span class="sl-badge sl-badge-${e.type}">
                      ${e.type}
                    </span>
                    <div>
                      <div class="fw-semibold text-dark small text-truncate" style="max-width: 180px;">${e.item}</div>
                      <div class="text-muted" style="font-size: 11px;">${e.category} • ${e.paymentMode.toUpperCase()}</div>
                    </div>
                  </div>
                  <div class="text-end">
                    <div class="fw-bold ${e.type === 'sale' ? 'text-success' : 'text-danger'} small">
                      ${e.type === 'sale' ? '+' : '-'}${formatINR(e.amount)}
                    </div>
                    <div class="text-muted" style="font-size: 11px;"><i class="bi bi-clock me-1"></i>${getTxTimeFormatted(e)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

export function bindQuickEntryEvents(router) {
  const amountInput = document.getElementById('entry-amount');
  const saveLabel = document.getElementById('btn-save-label');

  function updateSaveLabel() {
    const val = Number(amountInput.value) || 0;
    if (saveLabel) {
      saveLabel.textContent = val > 0 ? `${t('saveEntry')} (${formatINR(val)})` : t('saveEntry');
    }
  }

  if (amountInput) {
    amountInput.addEventListener('input', updateSaveLabel);
  }

  // In-place category chips binder
  function bindCategoryChipEvents() {
    const catChips = document.querySelectorAll('.category-chip');
    catChips.forEach(chip => {
      chip.addEventListener('click', () => {
        catChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeCategory = chip.dataset.category;
      });
    });
  }

  // Type Switchers (Instant in-place update without full-page re-render lag)
  const typeButtons = document.querySelectorAll('.type-btn');
  const catWrap = document.getElementById('category-chips-wrap');
  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeType = btn.dataset.type;

      const categoriesByType = {
        sale: ['Mobile Handset', 'Screen Guard / Glass', 'Back Cover / Case', 'Charger / Cable', 'Earphones / Buds', 'Recharge', 'Repair Service', 'Second Hand Phone', 'General Sale'],
        purchase: ['Wholesale Stock', 'Accessories Bulk', 'Spare Parts', 'Packaging', 'Shop Supplies'],
        expense: ['Shop Rent', 'Electricity', 'Staff Salary / Advance', 'Staff Food / Tea', 'Petrol / Delivery', 'Misc Repairs']
      };

      const cats = categoriesByType[activeType] || [];
      activeCategory = cats[0] || 'General';

      if (catWrap) {
        catWrap.innerHTML = cats.map(cat => `
          <button type="button" class="category-chip ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">
            ${cat}
          </button>
        `).join('');
        bindCategoryChipEvents();
      }
    });
  });

  // Increment Chips
  const incChips = document.querySelectorAll('.increment-chip[data-add]');
  incChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const add = Number(chip.dataset.add) || 0;
      const cur = Number(amountInput.value) || 0;
      amountInput.value = cur + add;
      updateSaveLabel();
    });
  });

  // Clear button
  const clearBtn = document.getElementById('btn-amount-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      amountInput.value = '';
      updateSaveLabel();
      amountInput.focus();
    });
  }

  // Initial category chips binding
  bindCategoryChipEvents();

  // Payment Mode Pills
  const modePills = document.querySelectorAll('.payment-mode-pill');
  modePills.forEach(pill => {
    pill.addEventListener('click', () => {
      modePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activePaymentMode = pill.dataset.mode;
    });
  });

  // Form Submission with duplicate submission protection
  const form = document.getElementById('quick-entry-form');
  const saveBtn = document.getElementById('btn-save-entry');
  let isSubmitting = false;

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmitting) return;

      const amount = Number(amountInput.value);
      const item = document.getElementById('entry-item').value.trim();
      const note = document.getElementById('entry-note').value.trim();

      if (!amount || amount <= 0) {
        showToast('Please enter a valid amount greater than ₹0', 'error');
        amountInput.focus();
        return;
      }

      if (!item) {
        showToast('Please enter an item or service name', 'error');
        return;
      }

      isSubmitting = true;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

      try {
        const user = await authService.getCurrentUser();
        const shopId = user.shopId || 'shop_metro_001';

        await txService.createTransaction(shopId, {
          type: activeType,
          category: activeCategory,
          item,
          amount,
          paymentMode: activePaymentMode,
          staffUid: user.uid,
          staffName: user.name,
          note
        });

        showToast(`Logged ₹${amount.toLocaleString('en-IN')} ${activeType} successfully!`, 'success');

        // Reset form inputs
        amountInput.value = '';
        document.getElementById('entry-item').value = '';
        document.getElementById('entry-note').value = '';
        updateSaveLabel();

        // Refresh UI
        router.refresh();
      } catch (err) {
        showToast(err.message || 'Error recording transaction', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="bi bi-check2-circle fs-5"></i> <span>${t('saveEntry')}</span>`;
      } finally {
        isSubmitting = false;
      }
    });
  }
}
