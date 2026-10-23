/**
 * ShopLedger - Reports & Analytics View
 * Features:
 * - Date range selection (This Month, Last Month, Last 30 Days, Custom)
 * - Period aggregates & margin analytics
 * - Category-wise breakdown table with percentage share
 * - Payment mode distribution
 * - One-click Export CSV (client-side data URL generator)
 * - Print / PDF-friendly formatting
 */
import { t, formatINR } from '../i18n/index.js';
import { authService, summaryService, txService } from '../services/index.js';
import { showToast } from '../components/toast.js';

let reportPeriod = 'month';
let customRange = {
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0]
};

export async function renderReports() {
  const user = await authService.getCurrentUser();
  if (!user) return '';

  const shopId = user.shopId || 'shop_metro_001';
  const analytics = await summaryService.getPeriodAnalytics(shopId, reportPeriod, customRange);
  const kpi = analytics.kpi;

  // Category breakdown list
  const catEntries = Object.entries(analytics.categoryTotals).map(([name, amount]) => {
    const pct = kpi.totalExpense > 0 ? ((amount / kpi.totalExpense) * 100).toFixed(1) : '0.0';
    return { name, amount, pct };
  }).sort((a, b) => b.amount - a.amount);

  return `
    <div class="page-container">
      <!-- Print-Only Accounting Header -->
      <div class="print-only-header">
        <h2>ShopLedger - Periodic Financial Statement</h2>
        <p>Period: ${analytics.startDate} to ${analytics.endDate} | Generated on: ${new Date().toLocaleDateString()}</p>
      </div>

      <!-- Page Header & Action Toolbar -->
      <div class="page-header mb-4">
        <div>
          <h2 class="page-title">${t('reportsTitle')}</h2>
          <p class="page-subtitle">${t('reportsSubtitle')}</p>
        </div>

        <div class="d-flex align-items-center gap-2">
          <button type="button" id="btn-export-csv" class="sl-btn sl-btn-outline sl-btn-sm">
            <i class="bi bi-file-earmark-spreadsheet text-success"></i>
            <span>${t('exportCSV')}</span>
          </button>
          <button type="button" id="btn-print-report" class="sl-btn sl-btn-primary sl-btn-sm">
            <i class="bi bi-printer"></i>
            <span>${t('printReport')}</span>
          </button>
        </div>
      </div>

      <!-- Date Range Selector Bar -->
      <div class="sl-card p-3 mb-4">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div class="filter-bar-scroll" id="report-period-preset">
            <button class="filter-pill ${reportPeriod === 'month' ? 'active' : ''}" data-preset="month">
              This Month
            </button>
            <button class="filter-pill ${reportPeriod === '15days' ? 'active' : ''}" data-preset="15days">
              Last 15 Days
            </button>
            <button class="filter-pill ${reportPeriod === 'week' ? 'active' : ''}" data-preset="week">
              Last 7 Days
            </button>
            <button class="filter-pill ${reportPeriod === 'custom' ? 'active' : ''}" data-preset="custom">
              Custom Range
            </button>
          </div>

          <div class="d-flex align-items-center gap-2 ${reportPeriod !== 'custom' ? 'd-none' : ''}" id="custom-range-inputs">
            <input type="date" id="rep-start-date" class="form-control form-control-sm" value="${customRange.startDate}">
            <span class="text-muted small">to</span>
            <input type="date" id="rep-end-date" class="form-control form-control-sm" value="${customRange.endDate}">
            <button class="btn btn-sm btn-primary" id="btn-apply-custom-range">Apply</button>
          </div>
        </div>
      </div>

      <!-- Financial Period KPI Summary Grid -->
      <div class="kpi-grid mb-4">
        <div class="kpi-card kpi-income">
          <div class="kpi-header">
            <span class="kpi-label">${t('totalIncome')}</span>
            <i class="bi bi-arrow-down-left text-success"></i>
          </div>
          <div class="kpi-value text-success">${formatINR(kpi.totalIncome)}</div>
          <div class="kpi-subtext">Sales Revenue</div>
        </div>

        <div class="kpi-card kpi-expense">
          <div class="kpi-header">
            <span class="kpi-label">${t('totalExpense')}</span>
            <i class="bi bi-arrow-up-right text-danger"></i>
          </div>
          <div class="kpi-value text-danger">${formatINR(kpi.totalExpense)}</div>
          <div class="kpi-subtext">Stock: ${formatINR(kpi.totalPurchase)} | Ops: ${formatINR(kpi.totalOperationalExpense)}</div>
        </div>

        <div class="kpi-card kpi-profit ${kpi.netProfit >= 0 ? 'profit-positive' : 'profit-negative'}">
          <div class="kpi-header">
            <span class="kpi-label">${t('netProfit')}</span>
            <i class="bi ${kpi.netProfit >= 0 ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow'}"></i>
          </div>
          <div class="kpi-value ${kpi.netProfit >= 0 ? 'text-success' : 'text-danger'}">
            ${formatINR(kpi.netProfit)}
          </div>
          <div class="kpi-subtext">Margin: ${kpi.profitMargin}%</div>
        </div>

        <div class="kpi-card kpi-warning">
          <div class="kpi-header">
            <span class="kpi-label">Cash vs UPI</span>
            <i class="bi bi-wallet2 text-primary"></i>
          </div>
          <div class="kpi-value fs-5">
            ${formatINR(kpi.cashInHand)} <span class="text-muted fs-6">Cash</span>
          </div>
          <div class="kpi-subtext">Digital / UPI: ${formatINR(kpi.upiDigital)}</div>
        </div>
      </div>

      <!-- Category Breakdown Table -->
      <div class="sl-card p-0 mb-4 overflow-hidden">
        <div class="p-3 bg-light border-bottom">
          <h6 class="fw-bold mb-0 text-dark">
            <i class="bi bi-pie-chart me-2 text-danger"></i>
            ${t('categoryBreakdown')}
          </h6>
        </div>

        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light small text-uppercase text-secondary" style="font-size: 11px;">
              <tr>
                <th class="ps-3 py-3">Category Name</th>
                <th>Expense Outflow</th>
                <th style="width: 200px;">Share of Spend</th>
                <th class="text-end pe-3" style="width: 100px;">Share %</th>
              </tr>
            </thead>
            <tbody>
              ${catEntries.length === 0 ? `
                <tr><td colspan="4" class="text-center py-4 text-muted">No expenses recorded for this period.</td></tr>
              ` : catEntries.map(c => `
                <tr>
                  <td class="ps-3 fw-bold small text-dark">${c.name}</td>
                  <td class="fw-semibold text-danger small">${formatINR(c.amount)}</td>
                  <td>
                    <div class="progress" style="height: 6px;">
                      <div class="progress-bar bg-danger" role="progressbar" style="width: ${c.pct}%;" aria-valuenow="${c.pct}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                  </td>
                  <td class="text-end pe-3 fw-bold small text-secondary">${c.pct}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Payment Mode Breakdown Table -->
      <div class="sl-card p-0 mb-4 overflow-hidden">
        <div class="p-3 bg-light border-bottom">
          <h6 class="fw-bold mb-0 text-dark">
            <i class="bi bi-credit-card me-2 text-primary"></i>
            ${t('paymentBreakdown')}
          </h6>
        </div>

        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light small text-uppercase text-secondary" style="font-size: 11px;">
              <tr>
                <th class="ps-3 py-3">Payment Channel</th>
                <th class="text-end pe-3">Volume Collected</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="ps-3 small fw-semibold"><i class="bi bi-cash-stack text-success me-2"></i>Physical Cash (In-Hand)</td>
                <td class="text-end pe-3 fw-bold small text-dark">${formatINR(analytics.paymentTotals.cash)}</td>
              </tr>
              <tr>
                <td class="ps-3 small fw-semibold"><i class="bi bi-qr-code-scan text-info me-2"></i>UPI / Digital (GPay / PhonePe)</td>
                <td class="text-end pe-3 fw-bold small text-dark">${formatINR(analytics.paymentTotals.upi)}</td>
              </tr>
              <tr>
                <td class="ps-3 small fw-semibold"><i class="bi bi-credit-card text-primary me-2"></i>Card Swipe / POS</td>
                <td class="text-end pe-3 fw-bold small text-dark">${formatINR(analytics.paymentTotals.card)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

export function bindReportsEvents(router) {
  // Preset buttons
  const presetContainer = document.getElementById('report-period-preset');
  const customInputs = document.getElementById('custom-range-inputs');

  if (presetContainer) {
    presetContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;

      reportPeriod = pill.dataset.preset;
      if (reportPeriod === 'custom') {
        if (customInputs) customInputs.classList.remove('d-none');
      } else {
        if (customInputs) customInputs.classList.add('d-none');
        router.refresh();
      }
    });
  }

  // Apply custom range
  const applyCustomBtn = document.getElementById('btn-apply-custom-range');
  if (applyCustomBtn) {
    applyCustomBtn.addEventListener('click', () => {
      customRange.startDate = document.getElementById('rep-start-date').value;
      customRange.endDate = document.getElementById('rep-end-date').value;
      router.refresh();
    });
  }

  // Print button
  const printBtn = document.getElementById('btn-print-report');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // Export CSV
  const csvBtn = document.getElementById('btn-export-csv');
  if (csvBtn) {
    csvBtn.addEventListener('click', async () => {
      try {
        const user = await authService.getCurrentUser();
        const shopId = user.shopId || 'shop_metro_001';

        const { transactions } = await txService.getTransactions(shopId, {
          startDate: customRange.startDate,
          endDate: customRange.endDate,
          limit: 1000
        });

        if (transactions.length === 0) {
          showToast('No transaction data to export for this period', 'warning');
          return;
        }

        // Generate CSV content
        const headers = ['ID', 'Date', 'Type', 'Category', 'Item', 'Amount', 'PaymentMode', 'StaffName', 'Note'];
        const rows = transactions.map(t => [
          t.id,
          t.date,
          t.type,
          `"${(t.category || '').replace(/"/g, '""')}"`,
          `"${(t.item || '').replace(/"/g, '""')}"`,
          t.amount,
          t.paymentMode,
          `"${(t.staffName || '').replace(/"/g, '""')}"`,
          `"${(t.note || '').replace(/"/g, '""')}"`
        ]);

        const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `ShopLedger_Report_${customRange.startDate}_to_${customRange.endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('CSV Report downloaded successfully!', 'success');
      } catch (err) {
        showToast('Error exporting CSV: ' + err.message, 'error');
      }
    });
  }
}
