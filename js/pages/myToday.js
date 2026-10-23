/**
 * ShopLedger - Staff Shift Today View (#/my-today)
 * Dedicated view for counter staff to audit their own shift entries and totals
 */
import { t, formatINR } from '../i18n/index.js';
import { authService, txService } from '../services/index.js';

export async function renderMyToday() {
  const user = await authService.getCurrentUser();
  if (!user) return '';

  const shopId = user.shopId || 'shop_metro_001';
  const todayStr = new Date().toISOString().split('T')[0];

  const { transactions } = await txService.getTransactions(shopId, {
    date: todayStr,
    staffUid: user.uid,
    limit: 100
  });

  let myTotalSales = 0;
  let myTotalExpenses = 0;
  let myCash = 0;
  let myUPI = 0;

  transactions.forEach(t => {
    if (t.type === 'sale') myTotalSales += t.amount;
    else myTotalExpenses += t.amount;

    if (t.paymentMode === 'cash') myCash += t.amount;
    else myUPI += t.amount;
  });

  return `
    <div class="page-container" style="max-width: 680px;">
      <!-- Page Header -->
      <div class="page-header mb-3">
        <div>
          <h2 class="page-title">${t('myShift')}</h2>
          <p class="page-subtitle">Your personal billing activity for today (${todayStr})</p>
        </div>

        <a href="#/entry" class="sl-btn sl-btn-primary sl-btn-sm">
          <i class="bi bi-plus-lg"></i>
          <span>${t('quickEntry')}</span>
        </a>
      </div>

      <!-- Shift Metrics -->
      <div class="row g-2 mb-3">
        <div class="col-6">
          <div class="sl-card p-3 text-center">
            <span class="small fw-semibold text-muted text-uppercase" style="font-size: 11px;">Sales Billed</span>
            <div class="fw-bold text-success fs-4 mt-1">${formatINR(myTotalSales)}</div>
            <span class="small text-muted" style="font-size: 11px;">${transactions.length} entries</span>
          </div>
        </div>
        <div class="col-6">
          <div class="sl-card p-3 text-center">
            <span class="small fw-semibold text-muted text-uppercase" style="font-size: 11px;">Cash Collected</span>
            <div class="fw-bold text-primary fs-4 mt-1">${formatINR(myCash)}</div>
            <span class="small text-muted" style="font-size: 11px;">UPI: ${formatINR(myUPI)}</span>
          </div>
        </div>
      </div>

      <!-- Shift Entries Feed -->
      <div class="sl-card p-0 mb-4 overflow-hidden">
        <div class="p-3 bg-light border-bottom d-flex align-items-center justify-content-between">
          <h6 class="fw-bold mb-0 text-dark small text-uppercase">
            <i class="bi bi-list-check me-2 text-primary"></i>Shift Transaction Log
          </h6>
          <span class="badge bg-white text-muted border">${transactions.length} Records</span>
        </div>

        ${transactions.length === 0 ? `
          <div class="empty-state-box py-4">
            <i class="bi bi-journal-plus empty-state-icon fs-1"></i>
            <div class="empty-state-title">No entries logged by you yet today</div>
            <div class="empty-state-desc mb-3">Any sales or expenses you record will appear here for shift verification.</div>
            <a href="#/entry" class="sl-btn sl-btn-primary sl-btn-sm">
              <i class="bi bi-plus-lg"></i> Record First Sale
            </a>
          </div>
        ` : `
          <div class="list-group list-group-flush">
            ${transactions.map(t => `
              <div class="list-group-item p-3 d-flex align-items-center justify-content-between">
                <div>
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <span class="sl-badge sl-badge-${t.type}">${t.type}</span>
                    <span class="sl-badge sl-badge-mode">${t.paymentMode}</span>
                  </div>
                  <div class="fw-bold text-dark small">${t.item}</div>
                  <div class="text-muted" style="font-size: 11px;">${t.category} • ${t.createdAt?.toDate ? t.createdAt.toDate().toTimeString().slice(0, 5) : (typeof t.createdAt === 'string' ? t.createdAt.slice(11, 16) : '')}</div>
                  ${t.note ? `<div class="text-muted" style="font-size: 11px;">Note: ${t.note}</div>` : ''}
                </div>
                <div class="text-end">
                  <div class="fw-bold fs-6 ${t.type === 'sale' ? 'text-success' : 'text-danger'}">
                    ${t.type === 'sale' ? '+' : '-'}${formatINR(t.amount)}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

export function bindMyTodayEvents(router) {
  // Read-only shift log
}
