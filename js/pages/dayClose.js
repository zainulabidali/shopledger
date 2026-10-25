/**
 * ShopLedger - Day Close & Cash Reconciliation View
 * Features:
 * - Today's financial totals
 * - Expected cash vs counted physical cash
 * - Interactive Denomination Counter (₹500, ₹200, ₹100, ₹50, ₹20, ₹10)
 * - Real-time variance highlight (Balanced / Surplus / Shortage)
 * - Day lock action with validation and freeze mechanics
 */
import { t, formatINR } from '../i18n/index.js';
import { authService, summaryService, txService } from '../services/index.js';
import { showToast } from '../components/toast.js';
import { showConfirmModal } from '../components/modal.js';

let selectedDate = new Date().toISOString().split('T')[0];

export async function renderDayClose() {
  const user = await authService.getCurrentUser();
  if (!user) return '';

  const shopId = user.shopId || 'shop_metro_001';
  const summary = await summaryService.getDailySummary(shopId, selectedDate);

  // Compute expected cash correctly:
  // Cash sales RECEIVED - Cash purchases PAID - Cash expenses PAID
  // paymentTotals.cash accumulates amounts for ALL transaction types that were paid in cash.
  // We need to separate income from outflow.
  // From the summary we have paymentTotals (combined) and totalSales/totalPurchase/totalExpense.
  // Use proportional approach: cashSales = cash * (totalSales / total if total>0)
  // But the most accurate is to fetch today's transactions (they're fetched efficiently).
  const { transactions: todayTxs } = await txService.getTransactions(shopId, {
    date: selectedDate,
    limit: 500
  });
  let cashSales = 0;
  let cashPurchases = 0;
  let cashExpenses = 0;
  todayTxs.forEach(tx => {
    if (tx.paymentMode === 'cash') {
      if (tx.type === 'sale') cashSales += tx.amount;
      else if (tx.type === 'purchase') cashPurchases += tx.amount;
      else if (tx.type === 'expense') cashExpenses += tx.amount;
    }
  });
  const expectedCash = Math.max(0, cashSales - cashPurchases - cashExpenses);

  const isLocked = summary.locked === true;
  const reconciliation = summary.reconciliation || {};
  const canReopen = user.role === 'owner' || user.role === 'admin' || user.role === 'super_admin';

  // Detect whether transactions were added/modified after day was closed
  const wasClosed = isLocked || (summary.closingHistory && summary.closingHistory.length > 0);
  const snapshotCount = reconciliation.snapshotTransactionCount;
  const snapshotCash = reconciliation.snapshotExpectedCash;
  const hasChangedAfterClosing = wasClosed && snapshotCount !== undefined && (
    todayTxs.length !== snapshotCount || Math.abs(expectedCash - (snapshotCash !== undefined ? snapshotCash : expectedCash)) > 0.01
  );

  return `
    <div class="page-container" style="max-width: 760px;">
      <!-- Page Header -->
      <div class="page-header mb-4">
        <div>
          <h2 class="page-title">${t('dayCloseTitle')}</h2>
          <p class="page-subtitle">${t('dayCloseSubtitle')}</p>
        </div>

        <div class="d-flex align-items-center gap-2">
          <input type="date" id="day-close-date-picker" class="form-control form-control-sm" value="${selectedDate}" style="width: 150px; font-weight: 600;">
        </div>
      </div>

      <!-- 1. Day Already Closed Status Banner -->
      ${isLocked ? `
        <div class="alert alert-success border-success-subtle shadow-sm p-3 mb-4 rounded-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div class="d-flex align-items-center gap-3">
            <div class="bg-success-subtle text-success p-2 rounded-circle d-flex align-items-center justify-content-center" style="width: 44px; height: 44px;">
              <i class="bi bi-shield-lock-fill fs-4"></i>
            </div>
            <div>
              <div class="d-flex align-items-center gap-2">
                <h6 class="fw-bold mb-0 text-dark">Day Already Closed & Locked</h6>
                <span class="badge bg-success text-white" style="font-size: 10px; letter-spacing: 0.5px;">CLOSED</span>
              </div>
              <div class="small text-muted mt-1">
                Verified at ${reconciliation.verifiedAt ? new Date(reconciliation.verifiedAt).toLocaleTimeString() : 'End of Day'} by <strong>${reconciliation.verifiedByName || reconciliation.verifiedBy || 'Store Admin'}</strong>.
                Counted: <strong>${formatINR(reconciliation.countedCash)}</strong> | Variance: <strong>${formatINR(reconciliation.difference)}</strong>
              </div>
              ${reconciliation.note ? `<div class="small text-secondary mt-1 fst-italic">"${reconciliation.note}"</div>` : ''}
            </div>
          </div>

          ${canReopen ? `
            <button type="button" id="btn-reopen-day" class="sl-btn sl-btn-outline-danger sl-btn-sm">
              <i class="bi bi-unlock-fill me-1"></i>
              <span>Reopen Day</span>
            </button>
          ` : ''}
        </div>
      ` : ''}

      <!-- 2. Post-Close Change Notification -->
      ${hasChangedAfterClosing ? `
        <div class="alert alert-warning border-warning-subtle shadow-sm p-3 mb-4 rounded-3 d-flex align-items-start gap-3">
          <i class="bi bi-exclamation-triangle-fill fs-3 text-warning"></i>
          <div>
            <div class="fw-bold text-dark">Notice: Records Changed Since Last Closing</div>
            <div class="small text-muted mt-1">
              This date was closed with <strong>${snapshotCount} entries</strong> (Expected Cash: <strong>${formatINR(snapshotCash)}</strong>), but currently has <strong>${todayTxs.length} entries</strong> (Expected Cash: <strong>${formatINR(expectedCash)}</strong>).
            </div>
            <div class="small text-secondary mt-1">
              ${isLocked 
                ? 'To update the closing figures and reconcile new entries, an authorized admin must Reopen Day first.' 
                : 'Transactions were updated while day was reopened. Please verify counted cash and finalize day close.'}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Financial Totals Summary Row -->
      <div class="row g-3 mb-4">
        <div class="col-sm-4">
          <div class="sl-card text-center p-3">
            <div class="small fw-semibold text-muted text-uppercase" style="font-size: 11px;">${t('totalIncome')}</div>
            <div class="fw-bold text-success fs-4 mt-1">${formatINR(summary.totalSales)}</div>
            <div class="small text-muted" style="font-size: 11px;">${todayTxs.filter(t => t.type === 'sale').length} sales entries</div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="sl-card text-center p-3">
            <div class="small fw-semibold text-muted text-uppercase" style="font-size: 11px;">Total Outflow</div>
            <div class="fw-bold text-danger fs-4 mt-1">${formatINR(summary.totalPurchase + summary.totalExpense)}</div>
            <div class="small text-muted" style="font-size: 11px;">Purchases + Expenses</div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="sl-card text-center p-3">
            <div class="small fw-semibold text-muted text-uppercase" style="font-size: 11px;">Net Cash Flow</div>
            <div class="fw-bold ${summary.totalSales - (summary.totalPurchase + summary.totalExpense) >= 0 ? 'text-success' : 'text-danger'} fs-4 mt-1">
              ${formatINR(summary.totalSales - (summary.totalPurchase + summary.totalExpense))}
            </div>
            <div class="small text-muted" style="font-size: 11px;">Total: ${todayTxs.length} entries</div>
          </div>
        </div>
      </div>

      <!-- Historical Closings Accordion if previously reopened -->
      ${summary.closingHistory && summary.closingHistory.length > 0 ? `
        <div class="accordion mb-4" id="historyAccordion">
          <div class="accordion-item border rounded-3 overflow-hidden">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed py-2 small fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#historyCollapse">
                <i class="bi bi-clock-history me-2 text-primary"></i>
                Closing & Audit Log (${summary.closingHistory.length} previous event${summary.closingHistory.length > 1 ? 's' : ''})
              </button>
            </h2>
            <div id="historyCollapse" class="accordion-collapse collapse" data-bs-parent="#historyAccordion">
              <div class="accordion-body bg-light p-3 small">
                <div class="list-group list-group-flush">
                  ${summary.closingHistory.map((h, idx) => `
                    <div class="list-group-item bg-transparent px-0 py-2">
                      <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-semibold text-dark">Closing Record #${idx + 1}</span>
                        <span class="text-muted" style="font-size: 11px;">${h.verifiedAt ? new Date(h.verifiedAt).toLocaleString() : ''}</span>
                      </div>
                      <div class="text-muted mt-1">
                        Counted: ${formatINR(h.countedCash)} | Variance: ${formatINR(h.difference)} | By: ${h.verifiedByName || h.verifiedBy || 'Store Admin'}
                      </div>
                      ${h.reopenedAt ? `
                        <div class="text-danger small mt-1">
                          <i class="bi bi-unlock me-1"></i>Reopened on ${new Date(h.reopenedAt).toLocaleString()} by ${h.reopenedBy || 'Store Admin'}${h.reopenReason ? ` ("${h.reopenReason}")` : ''}
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Cash Reconciliation Card -->
      <div class="sl-card p-4 mb-4">
        <h5 class="fw-bold mb-3 d-flex align-items-center gap-2">
          <i class="bi bi-cash-coin text-primary"></i>
          Cash Drawer Reconciliation
        </h5>

        <div class="p-3 bg-light rounded-3 mb-3">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="small fw-bold text-muted text-uppercase" style="font-size: 11px;">Cash Sales Received</div>
            <div class="fw-semibold text-success">${formatINR(cashSales)}</div>
          </div>
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="small fw-bold text-muted text-uppercase" style="font-size: 11px;">Cash Purchases Paid</div>
            <div class="fw-semibold text-danger">${formatINR(cashPurchases)}</div>
          </div>
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="small fw-bold text-muted text-uppercase" style="font-size: 11px;">Cash Expenses Paid</div>
            <div class="fw-semibold text-danger">${formatINR(cashExpenses)}</div>
          </div>
          <div class="border-top pt-2 mt-1 d-flex align-items-center justify-content-between">
            <div class="small fw-bold text-uppercase" style="font-size: 11px;">${t('expectedCash')}</div>
            <div class="fw-bold fs-5 text-primary" id="val-expected-cash" data-expected="${expectedCash}">${formatINR(expectedCash)}</div>
          </div>
        </div>

        <!-- Counted Cash Input -->
        <div class="mb-4">
          <label for="input-counted-cash" class="form-label small fw-bold text-uppercase text-secondary" style="font-size: 11px;">
            ${t('countedCash')} (₹)
          </label>
          <div class="input-group input-group-lg">
            <span class="input-group-text bg-white fw-bold">₹</span>
            <input type="number" id="input-counted-cash" class="form-control fw-bold fs-3" placeholder="0" value="${reconciliation.countedCash !== undefined ? reconciliation.countedCash : ''}" ${isLocked ? 'disabled' : ''}>
          </div>
        </div>

        <!-- Difference Result Box -->
        <div class="p-3 rounded-3 mb-4" id="difference-indicator-box" style="background-color: var(--sl-income-50); border: 1px solid var(--sl-income-200);">
          <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-shield-check text-success fs-4" id="diff-icon"></i>
              <div>
                <div class="fw-bold small" id="diff-status-label">${t('cashBalanced')}</div>
                <div class="small text-muted" id="diff-sub-label">Physical cash matches account calculations</div>
              </div>
            </div>
            <div class="fw-bold fs-4 text-success" id="diff-amount-display">₹0</div>
          </div>
        </div>

        <!-- Denomination Calculator Accordion -->
        ${!isLocked ? `
          <div class="accordion mb-4" id="denomAccordion">
            <div class="accordion-item border rounded-3 overflow-hidden">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed py-2 small fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#denomCollapse">
                  <i class="bi bi-calculator me-2 text-primary"></i>
                  ${t('denominationCounter')}
                </button>
              </h2>
              <div id="denomCollapse" class="accordion-collapse collapse" data-bs-parent="#denomAccordion">
                <div class="accordion-body bg-light p-3">
                  <div class="row g-2">
                    ${[500, 200, 100, 50, 20, 10].map(denom => `
                      <div class="col-6 col-sm-4">
                        <div class="input-group input-group-sm">
                          <span class="input-group-text bg-white fw-bold" style="width: 58px;">₹${denom}</span>
                          <input type="number" class="form-control denom-input" data-denom="${denom}" placeholder="0" min="0">
                        </div>
                      </div>
                    `).join('')}
                  </div>
                  <div class="text-end mt-2 small text-muted">
                    Total Calculated: <strong id="denom-total-label" class="text-primary">₹0</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Closing Remarks -->
        <div class="mb-4">
          <label for="closing-notes" class="form-label small fw-bold text-uppercase text-secondary" style="font-size: 11px;">
            ${t('closingRemarks')}
          </label>
          <textarea id="closing-notes" class="form-control" rows="2" placeholder="e.g. ₹50 loose coin surplus kept in drawer for tomorrow" ${isLocked ? 'disabled' : ''}>${reconciliation.note || ''}</textarea>
        </div>

        <!-- Lock Button or Disabled Closed Indicator -->
        ${!isLocked ? `
          <button type="button" id="btn-lock-day" class="sl-btn sl-btn-primary sl-btn-block sl-btn-lg">
            <i class="bi bi-lock-fill"></i>
            <span>${t('lockDayBtn')}</span>
          </button>
        ` : `
          <button type="button" class="sl-btn sl-btn-outline sl-btn-block sl-btn-lg" disabled>
            <i class="bi bi-shield-check text-success me-1"></i>
            <span>Day Already Closed & Locked</span>
          </button>
        `}

      </div>
    </div>
  `;
}

export function bindDayCloseEvents(router) {
  const datePicker = document.getElementById('day-close-date-picker');
  if (datePicker) {
    datePicker.addEventListener('change', () => {
      selectedDate = datePicker.value;
      router.refresh();
    });
  }

  const expectedEl = document.getElementById('val-expected-cash');
  const countedInput = document.getElementById('input-counted-cash');
  const expectedVal = expectedEl ? Number(expectedEl.dataset.expected) || 0 : 0;

  function updateDifference(countedVal) {
    const diff = countedVal - expectedVal;
    const box = document.getElementById('difference-indicator-box');
    const icon = document.getElementById('diff-icon');
    const label = document.getElementById('diff-status-label');
    const sub = document.getElementById('diff-sub-label');
    const amountDisp = document.getElementById('diff-amount-display');

    if (!box || !amountDisp) return;

    if (diff === 0) {
      box.style.backgroundColor = 'var(--sl-income-50)';
      box.style.borderColor = 'var(--sl-income-200)';
      icon.className = 'bi bi-shield-check text-success fs-4';
      label.textContent = t('cashBalanced');
      label.className = 'fw-bold small text-success';
      sub.textContent = 'Physical cash matches accounts perfectly.';
      amountDisp.textContent = '₹0';
      amountDisp.className = 'fw-bold fs-4 text-success';
    } else if (diff > 0) {
      box.style.backgroundColor = 'var(--sl-warning-50)';
      box.style.borderColor = 'var(--sl-warning-200)';
      icon.className = 'bi bi-exclamation-circle-fill text-warning fs-4';
      label.textContent = t('cashSurplus');
      label.className = 'fw-bold small text-warning-emphasis';
      sub.textContent = `Surplus of ${formatINR(diff)} detected in cash drawer.`;
      amountDisp.textContent = `+${formatINR(diff)}`;
      amountDisp.className = 'fw-bold fs-4 text-warning-emphasis';
    } else {
      box.style.backgroundColor = 'var(--sl-expense-50)';
      box.style.borderColor = 'var(--sl-expense-200)';
      icon.className = 'bi bi-exclamation-triangle-fill text-danger fs-4';
      label.textContent = t('cashShortage');
      label.className = 'fw-bold small text-danger';
      sub.textContent = `Shortage of ${formatINR(Math.abs(diff))} in drawer. Please investigate missing cash.`;
      amountDisp.textContent = `-${formatINR(Math.abs(diff))}`;
      amountDisp.className = 'fw-bold fs-4 text-danger';
    }
  }

  if (countedInput) {
    countedInput.addEventListener('input', () => {
      const val = Number(countedInput.value) || 0;
      updateDifference(val);
    });

    if (countedInput.value) {
      updateDifference(Number(countedInput.value));
    }
  }

  // Denomination counter inputs
  const denomInputs = document.querySelectorAll('.denom-input');
  denomInputs.forEach(input => {
    input.addEventListener('input', () => {
      let sum = 0;
      denomInputs.forEach(inp => {
        const d = Number(inp.dataset.denom) || 0;
        const count = Number(inp.value) || 0;
        sum += d * count;
      });

      const denomLabel = document.getElementById('denom-total-label');
      if (denomLabel) denomLabel.textContent = formatINR(sum);

      if (countedInput) {
        countedInput.value = sum > 0 ? sum : '';
        updateDifference(sum);
      }
    });
  });

  // Lock Day Button with duplicate submission guard
  const lockBtn = document.getElementById('btn-lock-day');
  let isLocking = false;

  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      if (isLocking) return;

      const counted = Number(countedInput.value);
      if (countedInput.value === '' || isNaN(counted)) {
        showToast('Please enter counted physical cash before locking.', 'warning');
        countedInput.focus();
        return;
      }

      const diff = counted - expectedVal;
      const notes = document.getElementById('closing-notes').value.trim();

      showConfirmModal({
        title: 'Lock & Finalize Day?',
        message: `Are you sure you want to lock records for <strong>${selectedDate}</strong>?<br><br>Counted Cash: <strong>${formatINR(counted)}</strong><br>Difference: <strong>${formatINR(diff)}</strong><br><br><span class="text-danger small"><i class="bi bi-info-circle me-1"></i>Once locked, no further transactions can be added, edited, or removed for this date.</span>`,
        confirmText: 'Yes, Lock Day',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          if (isLocking) return;
          isLocking = true;
          lockBtn.disabled = true;
          lockBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Locking Day...';

          try {
            const user = await authService.getCurrentUser();
            const shopId = user.shopId || 'shop_metro_001';

            await summaryService.reconcileAndLockDay(shopId, selectedDate, {
              countedCash: counted,
              expectedCash: expectedVal,
              difference: diff,
              note: notes,
              ownerUid: user.uid,
              verifiedByName: user.name || user.email || 'Store Owner'
            });

            showToast(`Day ${selectedDate} closed and locked successfully!`, 'success');
            router.refresh();
          } catch (err) {
            showToast(err.message || 'Error locking day', 'error');
            lockBtn.disabled = false;
            lockBtn.innerHTML = `<i class="bi bi-lock-fill"></i> <span>${t('lockDayBtn')}</span>`;
          } finally {
            isLocking = false;
          }
        }
      });
    });
  }

  // Reopen Day Button for Authorized Owners / Admins
  const reopenBtn = document.getElementById('btn-reopen-day');
  if (reopenBtn) {
    reopenBtn.addEventListener('click', () => {
      showConfirmModal({
        title: 'Reopen Day for Corrections?',
        message: `Are you sure you want to reopen records for <strong>${selectedDate}</strong>?<br><br>This will unlock the day so necessary transaction corrections can be made.<br><br><span class="text-muted small"><i class="bi bi-shield-check me-1"></i>Previous closing records are preserved in the audit log.</span>`,
        confirmText: 'Yes, Reopen Day',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          reopenBtn.disabled = true;
          reopenBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Reopening...';

          try {
            const user = await authService.getCurrentUser();
            const shopId = user ? (user.shopId || 'shop_metro_001') : 'shop_metro_001';
            const userName = user ? (user.name || user.email || 'Store Admin') : 'Store Admin';

            await summaryService.unlockAndReopenDay(shopId, selectedDate, 'Corrections required', userName);
            showToast(`Day ${selectedDate} has been reopened for corrections.`, 'info');
            router.refresh();
          } catch (err) {
            showToast(err.message || 'Error reopening day', 'error');
            reopenBtn.disabled = false;
            reopenBtn.innerHTML = '<i class="bi bi-unlock-fill me-1"></i> <span>Reopen Day</span>';
          }
        }
      });
    });
  }
}
