/**
 * ShopLedger - Skeleton Loader Component
 * Renders animated shimmer placeholders for KPI metrics, cards, and tables
 */

export function renderKpiSkeleton() {
  return `
    <div class="kpi-grid">
      ${[1, 2, 3, 4].map(() => `
        <div class="kpi-card p-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="skeleton" style="width: 70px; height: 14px;"></div>
            <div class="skeleton rounded-circle" style="width: 28px; height: 28px;"></div>
          </div>
          <div class="skeleton mb-2" style="width: 110px; height: 28px;"></div>
          <div class="skeleton" style="width: 85px; height: 12px;"></div>
        </div>
      `).join('')}
    </div>
  `;
}

export function renderTableSkeleton(rows = 5) {
  return `
    <div class="p-3">
      ${Array.from({ length: rows }).map(() => `
        <div class="d-flex align-items-center justify-content-between py-2 border-bottom">
          <div class="d-flex align-items-center gap-3">
            <div class="skeleton rounded-circle" style="width: 32px; height: 32px;"></div>
            <div>
              <div class="skeleton mb-1" style="width: 140px; height: 14px;"></div>
              <div class="skeleton" style="width: 90px; height: 11px;"></div>
            </div>
          </div>
          <div class="skeleton" style="width: 70px; height: 18px;"></div>
        </div>
      `).join('')}
    </div>
  `;
}

export function renderChartSkeleton() {
  return `
    <div class="d-flex flex-column justify-content-center align-items-center" style="height: 240px;">
      <div class="skeleton w-100 h-75 mb-3 rounded-3"></div>
      <div class="d-flex gap-3">
        <div class="skeleton" style="width: 80px; height: 12px;"></div>
        <div class="skeleton" style="width: 80px; height: 12px;"></div>
      </div>
    </div>
  `;
}
