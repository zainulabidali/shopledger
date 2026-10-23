/**
 * ShopLedger - Transactions Ledger View
 * Features:
 * - Search by keyword (item, category, note)
 * - Multi-criteria filters (Type, Category, Payment Mode, Date)
 * - Dynamic subtotal summary
 * - Three-dot (⋮) action menu (Edit, Delete) with role-based permissions
 * - Modal prefilled for editing existing transaction
 * - Delete confirmation modal
 * - Immediate refresh of list & totals
 * - Staff access restrictions (read own entries only)
 * - Responsive table (desktop) / card feed (mobile)
 * - Pagination
 */
import { t, formatINR } from '../i18n/index.js';
import { authService, shopService, txService } from '../services/index.js';
import { showToast } from '../components/toast.js';
import { showConfirmModal } from '../components/modal.js';

let filterState = {
  searchQuery: '',
  type: 'all',
  category: 'all',
  paymentMode: 'all',
  date: '',
  page: 1,
  limit: 15
};

// In-memory cache of current rendered transactions for fast modal prefill
const loadedTxMap = new Map();

export async function renderTransactions() {
  const user = await authService.getCurrentUser();
  if (!user) return '';

  const shopId = user.shopId || 'shop_metro_001';
  const shop = await shopService.getShop(shopId);

  // Compile full category list
  const allCats = new Set();
  if (shop && shop.customCategories) {
    Object.values(shop.customCategories).forEach(arr => arr.forEach(c => allCats.add(c)));
  }

  // Calculate offset
  const offset = (filterState.page - 1) * filterState.limit;

  const { transactions: list, totalCount, hasMore } = await txService.getTransactions(shopId, {
    ...filterState,
    offset,
    staffUid: user.role === 'staff' ? user.uid : null
  });

  // Cache for fast modal lookup
  loadedTxMap.clear();
  list.forEach(tx => loadedTxMap.set(tx.id, tx));

  // Calculate subtotals for filtered view
  let subtotalIncome = 0;
  let subtotalExpense = 0;
  list.forEach(tx => {
    if (tx.type === 'sale') subtotalIncome += tx.amount;
    else subtotalExpense += tx.amount;
  });

  const isAuthorized = user.role === 'admin' || user.role === 'owner' || user.role === 'super_admin';

  return `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header mb-3">
        <div>
          <h2 class="page-title">${t('transactions')}</h2>
          <p class="page-subtitle">${user.role === 'staff' ? "Showing your shift entries" : "Complete shop financial audit log"}</p>
        </div>

        <a href="#/entry" class="sl-btn sl-btn-primary sl-btn-sm">
          <i class="bi bi-plus-lg"></i>
          <span>${t('quickEntry')}</span>
        </a>
      </div>

      <!-- Filters & Search Toolbar Card -->
      <div class="sl-card p-3 mb-3">
        <div class="row g-2 align-items-center">
          <!-- Search Input -->
          <div class="col-12 col-md-4">
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-white text-muted"><i class="bi bi-search"></i></span>
              <input type="text" id="tx-search-input" class="form-control" placeholder="${t('searchPlaceholder')}" value="${filterState.searchQuery}" aria-label="Search ledger transactions">
              ${filterState.searchQuery ? `
                <button class="btn btn-outline-secondary" type="button" id="btn-clear-search" aria-label="Clear search input"><i class="bi bi-x"></i></button>
              ` : ''}
            </div>
          </div>

          <!-- Type Filter -->
          <div class="col-6 col-md-2">
            <select id="tx-type-filter" class="form-select form-select-sm">
              <option value="all" ${filterState.type === 'all' ? 'selected' : ''}>${t('allTypes')}</option>
              <option value="sale" ${filterState.type === 'sale' ? 'selected' : ''}>${t('typeSale')}</option>
              <option value="purchase" ${filterState.type === 'purchase' ? 'selected' : ''}>${t('typePurchase')}</option>
              <option value="expense" ${filterState.type === 'expense' ? 'selected' : ''}>${t('typeExpense')}</option>
            </select>
          </div>

          <!-- Category Filter -->
          <div class="col-6 col-md-3">
            <select id="tx-cat-filter" class="form-select form-select-sm">
              <option value="all" ${filterState.category === 'all' ? 'selected' : ''}>${t('allCategories')}</option>
              ${Array.from(allCats).map(cat => `
                <option value="${cat}" ${filterState.category === cat ? 'selected' : ''}>${cat}</option>
              `).join('')}
            </select>
          </div>

          <!-- Payment Mode Filter -->
          <div class="col-6 col-md-2">
            <select id="tx-mode-filter" class="form-select form-select-sm">
              <option value="all" ${filterState.paymentMode === 'all' ? 'selected' : ''}>${t('allPayments')}</option>
              <option value="cash" ${filterState.paymentMode === 'cash' ? 'selected' : ''}>${t('cash')}</option>
              <option value="upi" ${filterState.paymentMode === 'upi' ? 'selected' : ''}>${t('upi')}</option>
              <option value="card" ${filterState.paymentMode === 'card' ? 'selected' : ''}>${t('card')}</option>
            </select>
          </div>

          <!-- Single Date Filter -->
          <div class="col-6 col-md-1">
            <input type="date" id="tx-date-filter" class="form-control form-control-sm" value="${filterState.date}">
          </div>
        </div>
      </div>

      <!-- Filtered Summary Ribbon -->
      <div class="d-flex flex-wrap align-items-center justify-content-between p-2 px-3 mb-3 bg-white rounded-3 border small">
        <div class="d-flex align-items-center gap-3">
          <span class="text-muted">Filtered Records: <strong>${totalCount}</strong></span>
          <span class="text-success"><i class="bi bi-arrow-down-left"></i> Income: <strong>${formatINR(subtotalIncome)}</strong></span>
          <span class="text-danger"><i class="bi bi-arrow-up-right"></i> Outflow: <strong>${formatINR(subtotalExpense)}</strong></span>
        </div>
        <div class="text-muted mt-1 mt-sm-0">
          Page <strong>${filterState.page}</strong> of ${Math.max(1, Math.ceil(totalCount / filterState.limit))}
        </div>
      </div>

      <!-- Main Ledger Table / Cards Container -->
      <div class="sl-card p-0 mb-4 border">
        ${list.length === 0 ? `
          <div class="empty-state-box">
            <i class="bi bi-inbox empty-state-icon"></i>
            <div class="empty-state-title">${t('noTransactions')}</div>
            <div class="empty-state-desc">Try clearing filters or search keywords to view other records.</div>
          </div>
        ` : `
          <!-- Desktop Data Table View (d-none d-md-block) -->
          <div class="table-responsive d-none d-md-block" style="min-height: 180px;">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light small text-uppercase text-secondary" style="font-size: 11px;">
                <tr>
                  <th class="ps-3 py-3" style="width: 110px;">${t('date')}</th>
                  <th style="width: 90px;">Type</th>
                  <th>${t('item')}</th>
                  <th>${t('category')}</th>
                  <th style="width: 90px;">Mode</th>
                  <th>${t('loggedBy')}</th>
                  <th class="text-end" style="width: 130px;">${t('amount')}</th>
                  ${isAuthorized ? `<th class="text-end pe-3" style="width: 50px;"></th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${list.map(tx => `
                  <tr>
                    <td class="ps-3 fw-semibold small text-secondary">${tx.date}</td>
                    <td>
                      <span class="sl-badge sl-badge-${tx.type}">${tx.type}</span>
                    </td>
                    <td>
                      <div class="fw-bold text-dark small">${tx.item}</div>
                      ${tx.note ? `<div class="text-muted small" style="font-size: 11px;"><i class="bi bi-chat-left-dots me-1"></i>${tx.note}</div>` : ''}
                    </td>
                    <td class="small text-secondary">${tx.category}</td>
                    <td>
                      <span class="sl-badge sl-badge-mode">${tx.paymentMode}</span>
                    </td>
                    <td class="small text-muted">${tx.staffName || 'Staff'}</td>
                    <td class="text-end fw-bold ${tx.type === 'sale' ? 'text-success' : 'text-danger'}">
                      ${tx.type === 'sale' ? '+' : '-'}${formatINR(tx.amount)}
                    </td>
                    ${isAuthorized ? `
                      <td class="text-end pe-3">
                        <div class="dropdown">
                          <button class="btn btn-sm btn-light border-0 rounded-circle text-muted" type="button" data-bs-toggle="dropdown" data-bs-boundary="viewport" aria-expanded="false" style="width: 32px; height: 32px;" title="Actions">
                            <i class="bi bi-three-dots-vertical"></i>
                          </button>
                          <ul class="dropdown-menu dropdown-menu-end shadow border py-1" style="min-width: 130px; z-index: 1050;">
                            <li>
                              <button class="dropdown-item py-1 small btn-edit-tx" data-id="${tx.id}">
                                <i class="bi bi-pencil me-2 text-primary"></i>Edit
                              </button>
                            </li>
                            <li>
                              <button class="dropdown-item py-1 small text-danger btn-delete-tx" data-id="${tx.id}">
                                <i class="bi bi-trash3 me-2"></i>Delete
                              </button>
                            </li>
                          </ul>
                        </div>
                      </td>
                    ` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile Card List View (d-md-none) -->
          <div class="d-md-none list-group list-group-flush">
            ${list.map(tx => `
              <div class="list-group-item p-3">
                <div class="d-flex align-items-center justify-content-between mb-1">
                  <div class="d-flex align-items-center gap-2">
                    <span class="sl-badge sl-badge-${tx.type}">${tx.type}</span>
                    <span class="sl-badge sl-badge-mode">${tx.paymentMode}</span>
                  </div>
                  <div class="d-flex align-items-center gap-1">
                    <div class="fw-bold fs-6 ${tx.type === 'sale' ? 'text-success' : 'text-danger'}">
                      ${tx.type === 'sale' ? '+' : '-'}${formatINR(tx.amount)}
                    </div>
                    ${isAuthorized ? `
                      <div class="dropdown">
                        <button class="btn btn-sm btn-light border-0 rounded-circle text-muted p-0" type="button" data-bs-toggle="dropdown" data-bs-boundary="viewport" aria-expanded="false" style="width: 28px; height: 28px;" title="Actions">
                          <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end shadow border py-1" style="min-width: 130px; z-index: 1050;">
                          <li>
                            <button class="dropdown-item py-1 small btn-edit-tx" data-id="${tx.id}">
                              <i class="bi bi-pencil me-2 text-primary"></i>Edit
                            </button>
                          </li>
                          <li>
                            <button class="dropdown-item py-1 small text-danger btn-delete-tx" data-id="${tx.id}">
                              <i class="bi bi-trash3 me-2"></i>Delete
                            </button>
                          </li>
                        </ul>
                      </div>
                    ` : ''}
                  </div>
                </div>

                <div class="fw-bold text-dark mb-1">${tx.item}</div>

                <div class="d-flex align-items-center justify-content-between small text-muted">
                  <div>
                    <span>${tx.category}</span>
                    <span>• ${tx.date}</span>
                  </div>
                  <div class="small">${tx.staffName || 'Staff'}</div>
                </div>
                ${tx.note ? `<div class="text-muted mt-1 small" style="font-size: 11px;">Note: ${tx.note}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Pagination Footer -->
      <div class="d-flex align-items-center justify-content-between">
        <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" id="btn-prev-page" ${filterState.page <= 1 ? 'disabled' : ''}>
          <i class="bi bi-chevron-left me-1"></i>${t('previous')}
        </button>

        <span class="small text-muted">
          Showing ${offset + 1} to ${Math.min(offset + filterState.limit, totalCount)} of ${totalCount}
        </span>

        <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" id="btn-next-page" ${!hasMore ? 'disabled' : ''}>
          ${t('next')}<i class="bi bi-chevron-right ms-1"></i>
        </button>
      </div>

      <!-- Edit Transaction Modal -->
      <div class="modal fade" id="editTxModal" tabindex="-1" aria-labelledby="editTxModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow" style="border-radius: 16px;">
            <div class="modal-header border-bottom-0 pb-0">
              <h5 class="modal-title fw-bold" id="editTxModalLabel">
                <i class="bi bi-pencil-square text-primary me-2"></i>Edit Transaction
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <form id="edit-tx-form">
              <input type="hidden" id="edit-tx-id">
              <div class="modal-body py-3">
                <div class="row g-2 mb-3">
                  <div class="col-6">
                    <label class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">Type</label>
                    <select id="edit-tx-type" class="form-select" required>
                      <option value="sale">Sale</option>
                      <option value="purchase">Purchase</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>
                  <div class="col-6">
                    <label class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">Payment Mode</label>
                    <select id="edit-tx-mode" class="form-select" required>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI / Digital</option>
                      <option value="card">Card</option>
                    </select>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">Item Description</label>
                  <input type="text" id="edit-tx-item" class="form-control" placeholder="Item name or service" required>
                </div>

                <div class="row g-2 mb-3">
                  <div class="col-6">
                    <label class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">Category</label>
                    <select id="edit-tx-cat" class="form-select" required>
                      ${Array.from(allCats).map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-6">
                    <label class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">Amount (₹)</label>
                    <input type="number" id="edit-tx-amount" class="form-control" min="1" step="any" placeholder="0" required>
                  </div>
                </div>

                <div class="mb-2">
                  <label class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">Note (Optional)</label>
                  <input type="text" id="edit-tx-note" class="form-control" placeholder="Optional notes">
                </div>
              </div>
              <div class="modal-footer border-top-0 pt-0">
                <button type="button" class="btn btn-outline-secondary rounded-pill px-3" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" id="btn-save-edit-tx" class="sl-btn sl-btn-primary sl-btn-sm rounded-pill px-4">
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

    </div>
  `;
}

export function bindTransactionsEvents(router) {
  // Search input
  const searchInput = document.getElementById('tx-search-input');
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        filterState.searchQuery = searchInput.value.trim();
        filterState.page = 1;
        router.refresh();
      }, 300);
    });
  }

  const clearSearchBtn = document.getElementById('btn-clear-search');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      filterState.searchQuery = '';
      filterState.page = 1;
      router.refresh();
    });
  }

  // Type filter
  const typeFilter = document.getElementById('tx-type-filter');
  if (typeFilter) {
    typeFilter.addEventListener('change', () => {
      filterState.type = typeFilter.value;
      filterState.page = 1;
      router.refresh();
    });
  }

  // Category filter
  const catFilter = document.getElementById('tx-cat-filter');
  if (catFilter) {
    catFilter.addEventListener('change', () => {
      filterState.category = catFilter.value;
      filterState.page = 1;
      router.refresh();
    });
  }

  // Payment mode filter
  const modeFilter = document.getElementById('tx-mode-filter');
  if (modeFilter) {
    modeFilter.addEventListener('change', () => {
      filterState.paymentMode = modeFilter.value;
      filterState.page = 1;
      router.refresh();
    });
  }

  // Date filter
  const dateFilter = document.getElementById('tx-date-filter');
  if (dateFilter) {
    dateFilter.addEventListener('change', () => {
      filterState.date = dateFilter.value;
      filterState.page = 1;
      router.refresh();
    });
  }

  // Pagination Prev / Next
  const prevBtn = document.getElementById('btn-prev-page');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (filterState.page > 1) {
        filterState.page--;
        router.refresh();
      }
    });
  }

  const nextBtn = document.getElementById('btn-next-page');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      filterState.page++;
      router.refresh();
    });
  }

  // Edit transaction action: open modal prefilled with existing data
  const editButtons = document.querySelectorAll('.btn-edit-tx');
  editButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const txId = btn.dataset.id;
      const tx = loadedTxMap.get(txId);
      if (!tx) return;

      document.getElementById('edit-tx-id').value = tx.id;
      document.getElementById('edit-tx-type').value = tx.type;
      document.getElementById('edit-tx-mode').value = tx.paymentMode || 'cash';
      document.getElementById('edit-tx-item').value = tx.item || '';
      document.getElementById('edit-tx-cat').value = tx.category || '';
      document.getElementById('edit-tx-amount').value = tx.amount || '';
      document.getElementById('edit-tx-note').value = tx.note || '';

      const modalEl = document.getElementById('editTxModal');
      if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }
    });
  });

  // Edit transaction form submit
  const editForm = document.getElementById('edit-tx-form');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-tx-id').value;
      const type = document.getElementById('edit-tx-type').value;
      const paymentMode = document.getElementById('edit-tx-mode').value;
      const item = document.getElementById('edit-tx-item').value.trim();
      const category = document.getElementById('edit-tx-cat').value;
      const amount = Number(document.getElementById('edit-tx-amount').value);
      const note = document.getElementById('edit-tx-note').value.trim();

      const submitBtn = document.getElementById('btn-save-edit-tx');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';

      try {
        const user = await authService.getCurrentUser();
        const shopId = user.shopId || 'shop_metro_001';

        await txService.updateTransaction(shopId, id, {
          type,
          paymentMode,
          item,
          category,
          amount,
          note
        });

        const modalEl = document.getElementById('editTxModal');
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
          const modal = window.bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }

        showToast('Transaction updated successfully', 'success');
        router.refresh();
      } catch (err) {
        showToast(err.message || 'Error updating transaction', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Save Changes</span>';
      }
    });
  }

  // Delete transaction action with confirmation dialog
  const deleteButtons = document.querySelectorAll('.btn-delete-tx');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const txId = btn.dataset.id;
      const tx = loadedTxMap.get(txId);
      const itemDesc = tx ? `"${tx.item}" (₹${tx.amount})` : 'this transaction';

      showConfirmModal({
        title: 'Delete Transaction',
        message: `Are you sure you want to permanently delete ${itemDesc}? This will reverse the amount from today's ledger.`,
        confirmText: 'Delete',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          try {
            const user = await authService.getCurrentUser();
            const shopId = user.shopId || 'shop_metro_001';

            await txService.deleteTransaction(shopId, txId);
            showToast('Transaction deleted successfully', 'success');
            router.refresh();
          } catch (err) {
            showToast(err.message || 'Error deleting transaction', 'error');
          }
        }
      });
    });
  });
}
