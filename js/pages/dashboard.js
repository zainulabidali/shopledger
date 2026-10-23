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

  // Attach period filter clicks
  const filterContainer = document.getElementById('dashboard-period-filter');
  if (filterContainer) {
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
    const isProfitPositive = kpi.netProfit >= 0;

    container.innerHTML = `
      <!-- KPI Metric Cards Grid -->
      <div class="kpi-grid">
        <!-- 1. Total Income -->
        <div class="kpi-card kpi-income">
          <div class="kpi-header">
            <span class="kpi-label">${t('totalIncome')}</span>
            <div class="kpi-icon-wrap">
              <i class="bi bi-arrow-down-left"></i>
            </div>
          </div>
          <div class="kpi-value text-success">${formatINR(kpi.totalIncome)}</div>
          <div class="kpi-subtext">
            <span><i class="bi bi-check-circle-fill text-success"></i> ${kpi.transactionCount} entries</span>
          </div>
        </div>

        <!-- 2. Total Expenses -->
        <div class="kpi-card kpi-expense">
          <div class="kpi-header">
            <span class="kpi-label">${t('totalExpense')}</span>
            <div class="kpi-icon-wrap">
              <i class="bi bi-arrow-up-right"></i>
            </div>
          </div>
          <div class="kpi-value text-danger">${formatINR(kpi.totalExpense)}</div>
          <div class="kpi-subtext">
            <span>Purchases: ${formatINR(kpi.totalPurchase)}</span>
          </div>
        </div>

        <!-- 3. Net Profit & Margin -->
        <div class="kpi-card kpi-profit ${isProfitPositive ? 'profit-positive' : 'profit-negative'}">
          <div class="kpi-header">
            <span class="kpi-label">${t('netProfit')}</span>
            <div class="kpi-icon-wrap">
              <i class="bi ${isProfitPositive ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow'}"></i>
            </div>
          </div>
          <div class="kpi-value ${isProfitPositive ? 'text-success' : 'text-danger'}">
            ${formatINR(kpi.netProfit)}
          </div>
          <div class="kpi-subtext">
            <span class="badge ${isProfitPositive ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill">
              ${kpi.profitMargin}% Margin
            </span>
          </div>
        </div>

        <!-- 4. Cash vs UPI Split -->
        <div class="kpi-card kpi-warning">
          <div class="kpi-header">
            <span class="kpi-label">Cash Transactions</span>
            <div class="kpi-icon-wrap" style="background-color: var(--sl-info-bg); color: var(--sl-info-primary);">
              <i class="bi bi-cash-stack"></i>
            </div>
          </div>
          <div class="kpi-value" style="color: var(--sl-brand-primary);">
            ${formatINR(kpi.cashInHand)}
          </div>
          <div class="kpi-subtext">
            <span>Digital / UPI: ${formatINR(kpi.upiDigital)}</span>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="row g-3 mb-4">
        <!-- 1. Income vs Expense Trend -->
        <div class="col-12 col-lg-8">
          <div class="sl-card h-100">
            <div class="sl-card-header">
              <h6 class="sl-card-title">
                <i class="bi bi-bar-chart-fill text-primary"></i>
                ${t('trendChartTitle')}
              </h6>
              <span class="badge bg-light text-muted border">${data.period.toUpperCase()}</span>
            </div>
            <div style="position: relative; height: 260px; width: 100%;">
              <canvas id="trendChart"></canvas>
            </div>
          </div>
        </div>

        <!-- 2. Expense by Category Breakdown -->
        <div class="col-12 col-lg-4">
          <div class="sl-card h-100">
            <div class="sl-card-header">
              <h6 class="sl-card-title">
                <i class="bi bi-pie-chart-fill text-danger"></i>
                ${t('categoryChartTitle')}
              </h6>
            </div>
            <div style="position: relative; height: 260px; width: 100%;">
              <canvas id="categoryChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render Chart.js
    renderCharts(data.charts, data.categoryTotals);
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

    trendChartInstance = new Chart(trendCanvas, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: 'Income (₹)',
            data: chartData.sales,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderRadius: 6,
            borderSkipped: false
          },
          {
            label: 'Expense (₹)',
            data: chartData.expenses,
            backgroundColor: 'rgba(239, 68, 68, 0.85)',
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } }
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
              callback: (val) => `₹${(val / 1000).toFixed(0)}k`
            }
          }
        }
      }
    });
  }

  // 2. Category Doughnut Chart
  const catCanvas = document.getElementById('categoryChart');
  if (catCanvas) {
    if (categoryChartInstance) categoryChartInstance.destroy();

    const catLabels = Object.keys(categoryTotals);
    const catValues = Object.values(categoryTotals);

    if (catLabels.length === 0) {
      catLabels.push('No Expenses');
      catValues.push(1);
    }

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
