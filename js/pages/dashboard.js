/**
 * ShopLedger - Dashboard View
 * Features:
 * - Filter pills (Today / This Week / Last 15 Days / This Month / Custom)
 * - 4 KPI Cards: Income, Expense, Profit with Margin %, Cash/UPI Split
 * - Chart.js Income vs Expense Trend & Expense Category Doughnut
 * - "Weak Areas & Smart Insights" Panel
 */
import { t, formatINR } from '../i18n/index.js';
import { authService, summaryService } from '../services/index.js';
import { renderKpiSkeleton, renderChartSkeleton } from '../components/skeleton.js';

let activePeriod = 'today'; // Default to today for practical daily shop use
let trendChartInstance = null;
let categoryChartInstance = null;

export async function renderDashboard() {
  const user = await authService.getCurrentUser();
  if (!user) return '';

  const shopId = user.shopId || 'shop_metro_001';

  return `
    <div class="page-container">
      <!-- Page Header & Period Selector -->
      <div class="page-header">
        <div>
          <h2 class="page-title">${t('dashboard')}</h2>
          <p class="page-subtitle">Financial overview for your shop</p>
        </div>

        <div class="d-flex align-items-center gap-2">
          <div class="filter-bar-scroll" id="dashboard-period-filter">
            <button class="filter-pill ${activePeriod === 'today' ? 'active' : ''}" data-period="today">
              ${t('periodToday')}
            </button>
            <button class="filter-pill ${activePeriod === 'week' ? 'active' : ''}" data-period="week">
              ${t('periodThisWeek')}
            </button>
            <button class="filter-pill ${activePeriod === '15days' ? 'active' : ''}" data-period="15days">
              ${t('periodLast15Days')}
            </button>
            <button class="filter-pill ${activePeriod === 'month' ? 'active' : ''}" data-period="month">
              ${t('periodThisMonth')}
            </button>
          </div>

          <a href="#/entry" class="sl-btn sl-btn-primary sl-btn-sm d-none d-sm-inline-flex">
            <i class="bi bi-plus-lg"></i>
            <span>${t('quickEntry')}</span>
          </a>
        </div>
      </div>

      <!-- Dynamic Dashboard Content Container with Skeletons -->
      <div id="dashboard-content">
        ${renderKpiSkeleton()}
        <div class="row g-3">
          <div class="col-12 col-lg-8">
            <div class="sl-card p-3">${renderChartSkeleton()}</div>
          </div>
          <div class="col-12 col-lg-4">
            <div class="sl-card p-3">${renderChartSkeleton()}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function bindDashboardEvents(router) {
  const user = await authService.getCurrentUser();
  if (!user) return;

  const shopId = user.shopId || 'shop_metro_001';

  // Attach period filter clicks (idempotent guard to prevent duplicate listeners)
  const filterContainer = document.getElementById('dashboard-period-filter');
  if (filterContainer && !filterContainer.dataset.bound) {
    filterContainer.dataset.bound = 'true';
    filterContainer.addEventListener('click', async (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;

      filterContainer.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      activePeriod = pill.dataset.period;
      await loadDashboardMetrics(shopId);
    });
  }

  // Initial load
  await loadDashboardMetrics(shopId);
}

async function loadDashboardMetrics(shopId) {
  const container = document.getElementById('dashboard-content');
  if (!container) return;

  try {
    const data = await summaryService.getPeriodAnalytics(shopId, activePeriod);
    const kpi = data.kpi;
    const isFlowPositive = kpi.netCashFlow >= 0;
    const hasTransactions = (kpi.totalTransactions || 0) > 0;
    const hasCategoryData = Object.keys(data.categoryTotals || {}).length > 0;

    container.innerHTML = `
      <!-- KPI Metric Cards Grid (4 Primary Cards) -->
      <div class="kpi-grid">
        <!-- 1. Total Sales -->
        <div class="kpi-card kpi-income">
          <div class="kpi-header">
            <span class="kpi-label">Total Sales</span>
            <div class="kpi-icon-wrap">
              <i class="bi bi-arrow-down-left"></i>
            </div>
          </div>
          <div class="kpi-value text-success">${formatINR(kpi.totalSales)}</div>
          <div class="kpi-count">${kpi.saleCount} ${kpi.saleCount === 1 ? 'sale' : 'sales'}</div>
          <div class="kpi-subtext">Avg: ${formatINR(kpi.averageSales)} / sale</div>
        </div>

        <!-- 2. Total Purchase -->
        <div class="kpi-card kpi-purchase">
          <div class="kpi-header">
            <span class="kpi-label">Total Purchase</span>
            <div class="kpi-icon-wrap">
              <i class="bi bi-box-seam"></i>
            </div>
          </div>
          <div class="kpi-value" style="color: #d97706;">${formatINR(kpi.totalPurchase)}</div>
          <div class="kpi-count">${kpi.purchaseCount} ${kpi.purchaseCount === 1 ? 'purchase' : 'purchases'}</div>
          <div class="kpi-subtext">Avg: ${formatINR(kpi.averagePurchase)} / purchase</div>
        </div>

        <!-- 3. Total Expense -->
        <div class="kpi-card kpi-expense">
          <div class="kpi-header">
            <span class="kpi-label">Total Expense</span>
            <div class="kpi-icon-wrap">
              <i class="bi bi-arrow-up-right"></i>
            </div>
          </div>
          <div class="kpi-value text-danger">${formatINR(kpi.totalExpense)}</div>
          <div class="kpi-count">${kpi.expenseCount} ${kpi.expenseCount === 1 ? 'expense' : 'expenses'}</div>
          <div class="kpi-subtext">Avg: ${formatINR(kpi.averageExpense)} / expense</div>
        </div>

        <!-- 4. Net Cash Flow -->
        <div class="kpi-card kpi-cashflow ${isFlowPositive ? 'flow-positive' : 'flow-negative'}">
          <div class="kpi-header">
            <span class="kpi-label">Net Cash Flow</span>
            <div class="kpi-icon-wrap">
              <i class="bi ${isFlowPositive ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow'}"></i>
            </div>
          </div>
          <div class="kpi-value ${isFlowPositive ? 'text-success' : 'text-danger'}">
            ${formatINR(kpi.netCashFlow)}
          </div>
          <div class="kpi-count">${kpi.totalTransactions} transactions</div>
          <div class="kpi-subtext">Sales − Purchases − Expenses</div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="row g-3 mb-4">
        <!-- 1. Cash Flow Trend Chart -->
        <div class="col-12 col-lg-8">
          <div class="sl-card h-100">
            <div class="sl-card-header d-flex align-items-center justify-content-between">
              <h6 class="sl-card-title mb-0">
                <i class="bi bi-bar-chart-fill text-primary me-1"></i>
                Financial Activity Trend
              </h6>
              <span class="badge bg-light text-muted border">${data.period.toUpperCase()}</span>
            </div>
            <div style="position: relative; height: 260px; width: 100%;" id="trend-chart-container">
              ${hasTransactions ? `
                <canvas id="trendChart"></canvas>
              ` : `
                <div class="d-flex flex-column align-items-center justify-content-center h-100 py-5 text-center text-muted">
                  <i class="bi bi-bar-chart-line fs-2 text-secondary mb-2"></i>
                  <span class="small fw-semibold text-secondary">No transactions in this period</span>
                  <span class="text-muted" style="font-size: 11px;">Add entries from Quick Entry to see live trends</span>
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- 2. Expense & Purchase Category Breakdown -->
        <div class="col-12 col-lg-4">
          <div class="sl-card h-100">
            <div class="sl-card-header">
              <h6 class="sl-card-title mb-0">
                <i class="bi bi-pie-chart-fill text-danger me-1"></i>
                Category Breakdown
              </h6>
            </div>
            <div style="position: relative; height: 260px; width: 100%;" id="category-chart-container">
              ${hasCategoryData ? `
                <canvas id="categoryChart"></canvas>
              ` : `
                <div class="d-flex flex-column align-items-center justify-content-center h-100 py-5 text-center text-muted">
                  <i class="bi bi-pie-chart fs-2 text-secondary mb-2"></i>
                  <span class="small fw-semibold text-secondary">No category expenses</span>
                  <span class="text-muted" style="font-size: 11px;">No purchase or expense records</span>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    // Render Chart.js if data exists
    if (hasTransactions) {
      renderCharts(data.charts, data.categoryTotals);
    }
  } catch (err) {
    console.error('Error rendering dashboard:', err);
    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>Failed to load dashboard metrics.
      </div>
    `;
  }
}

function renderCharts(chartData, categoryTotals) {
  if (typeof Chart === 'undefined') return;

  // 1. Trend Chart
  const trendCanvas = document.getElementById('trendChart');
  if (trendCanvas) {
    if (trendChartInstance) trendChartInstance.destroy();

    const datasets = [
      {
        label: 'Sales (₹)',
        data: chartData.sales || [],
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderRadius: 4,
        borderSkipped: false
      },
      {
        label: 'Purchases (₹)',
        data: chartData.purchases || [],
        backgroundColor: 'rgba(245, 158, 11, 0.85)',
        borderRadius: 4,
        borderSkipped: false
      },
      {
        label: 'Expenses (₹)',
        data: chartData.expenses || [],
        backgroundColor: 'rgba(239, 68, 68, 0.85)',
        borderRadius: 4,
        borderSkipped: false
      }
    ];

    trendChartInstance = new Chart(trendCanvas, {
      type: 'bar',
      data: {
        labels: chartData.labels || [],
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatINR(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: (val) => val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`
            }
          }
        }
      }
    });
  }

  // 2. Category Doughnut Chart
  const catCanvas = document.getElementById('categoryChart');
  if (catCanvas && categoryTotals && Object.keys(categoryTotals).length > 0) {
    if (categoryChartInstance) categoryChartInstance.destroy();

    const catLabels = Object.keys(categoryTotals);
    const catValues = Object.values(categoryTotals);

    const palette = [
      '#ef4444', '#f59e0b', '#6366f1', '#06b6d4', 
      '#ec4899', '#8b5cf6', '#10b981', '#64748b'
    ];

    categoryChartInstance = new Chart(catCanvas, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catValues,
          backgroundColor: palette.slice(0, catLabels.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              font: { family: 'Inter', size: 11 },
              padding: 10
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatINR(ctx.raw)}`
            }
          }
        }
      }
    });
  }
}
