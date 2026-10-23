/**
 * ShopLedger - Summaries & Analytics Service Interface & Mock Implementation
 * Crucial: Dashboard only reads summary docs, never the full transaction collection!
 */
import { saveDb } from './auth.js';
import { formatDate, formatMonth } from './mockData.js';

const STORAGE_KEY_DB = 'shopledger_mock_db';

function getDb() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_DB) || '{}');
}

/**
 * Get pre-computed daily summary document
 * @param {string} shopId
 * @param {string} date 'YYYY-MM-DD'
 */
export async function getDailySummary(shopId, date) {
  const db = getDb();
  const summary = db.dailySummaries ? db.dailySummaries[date] : null;
  return summary || {
    date,
    totalSales: 0,
    totalPurchase: 0,
    totalExpense: 0,
    profit: 0,
    transactionCount: 0,
    categoryTotals: {},
    paymentTotals: { cash: 0, upi: 0, card: 0 },
    locked: false,
    reconciliation: null
  };
}

/**
 * Get range of daily summaries for charting and trend calculation
 * @param {string} shopId
 * @param {string} startDate
 * @param {string} endDate
 */
export async function getDailySummariesRange(shopId, startDate, endDate) {
  const db = getDb();
  const allSummaries = db.dailySummaries || {};
  const results = [];

  const cur = new Date(startDate);
  const end = new Date(endDate);

  while (cur <= end) {
    const dStr = formatDate(cur);
    const existing = allSummaries[dStr] || {
      date: dStr,
      totalSales: 0,
      totalPurchase: 0,
      totalExpense: 0,
      profit: 0,
      transactionCount: 0,
      categoryTotals: {},
      paymentTotals: { cash: 0, upi: 0, card: 0 },
      locked: false
    };
    results.push(existing);
    cur.setDate(cur.getDate() + 1);
  }

  return results;
}

/**
 * Get pre-computed monthly summary document
 * @param {string} shopId
 * @param {string} month 'YYYY-MM'
 */
export async function getMonthlySummary(shopId, month) {
  const db = getDb();
  const summary = db.monthlySummaries ? db.monthlySummaries[month] : null;
  return summary || {
    month,
    totalSales: 0,
    totalPurchase: 0,
    totalExpense: 0,
    profit: 0,
    transactionCount: 0,
    categoryTotals: {},
    paymentTotals: { cash: 0, upi: 0, card: 0 }
  };
}

/**
 * Perform Day Close: Reconcile physical cash drawer and lock day
 * @param {string} shopId
 * @param {string} date
 * @param {object} reconciliationData { countedCash, expectedCash, difference, note, ownerUid }
 */
export async function reconcileAndLockDay(shopId, date, reconciliationData) {
  const db = getDb();
  if (!db.dailySummaries) db.dailySummaries = {};
  if (!db.dailySummaries[date]) {
    db.dailySummaries[date] = await getDailySummary(shopId, date);
  }

  const d = db.dailySummaries[date];
  d.locked = true;
  d.reconciliation = {
    countedCash: reconciliationData.countedCash,
    expectedCash: reconciliationData.expectedCash,
    difference: reconciliationData.difference,
    note: reconciliationData.note || '',
    verifiedBy: reconciliationData.ownerUid,
    verifiedAt: new Date().toISOString()
  };

  saveDb(db);
  return d;
}

/**
 * Compute high-performance period analytics, Chart.js datasets & weak areas
 * @param {string} shopId
 * @param {'today'|'week'|'15days'|'month'|'custom'} preset
 * @param {object} customRange { startDate, endDate }
 */
export async function getPeriodAnalytics(shopId, preset = 'today', customRange = null) {
  const today = new Date();
  let startDate, endDate;

  if (preset === 'today') {
    startDate = formatDate(today);
    endDate = formatDate(today);
  } else if (preset === 'week') {
    const d = new Date(today);
    d.setDate(today.getDate() - 6);
    startDate = formatDate(d);
    endDate = formatDate(today);
  } else if (preset === '15days') {
    const d = new Date(today);
    d.setDate(today.getDate() - 14);
    startDate = formatDate(d);
    endDate = formatDate(today);
  } else if (preset === 'month') {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    startDate = formatDate(d);
    endDate = formatDate(today);
  } else if (preset === 'custom' && customRange) {
    startDate = customRange.startDate;
    endDate = customRange.endDate;
  } else {
    startDate = formatDate(today);
    endDate = formatDate(today);
  }

  const dailyDocs = await getDailySummariesRange(shopId, startDate, endDate);

  // Aggregate Totals
  let totalSales = 0;
  let totalPurchase = 0;
  let totalExpense = 0;
  let totalTransactions = 0;
  const categoryTotals = {};
  const paymentTotals = { cash: 0, upi: 0, card: 0 };

  const trendLabels = [];
  const salesTrend = [];
  const expenseTrend = [];
  const profitTrend = [];

  let lowestProfitDay = null;
  const negativeProfitDays = [];

  dailyDocs.forEach(doc => {
    totalSales += doc.totalSales;
    totalPurchase += doc.totalPurchase;
    totalExpense += doc.totalExpense;
    totalTransactions += doc.transactionCount || 0;

    // Categories
    Object.entries(doc.categoryTotals || {}).forEach(([cat, val]) => {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
    });

    // Payment modes
    Object.entries(doc.paymentTotals || {}).forEach(([mode, val]) => {
      paymentTotals[mode] = (paymentTotals[mode] || 0) + val;
    });

    // Trends
    const shortDate = doc.date.slice(5); // MM-DD
    trendLabels.push(shortDate);
    salesTrend.push(doc.totalSales);
    expenseTrend.push(doc.totalPurchase + doc.totalExpense);
    profitTrend.push(doc.profit);

    // Lowest and negative profit days
    if (lowestProfitDay === null || doc.profit < lowestProfitDay.profit) {
      lowestProfitDay = { date: doc.date, profit: doc.profit, sales: doc.totalSales, expense: doc.totalExpense + doc.totalPurchase };
    }

    if (doc.profit < 0) {
      negativeProfitDays.push({ date: doc.date, loss: Math.abs(doc.profit) });
    }
  });

  const overallExpense = totalPurchase + totalExpense;
  const netProfit = totalSales - overallExpense;
  const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0.0';

  // Weak Areas Detection
  const weakAreas = [];

  // 1. Negative profit detection
  if (negativeProfitDays.length > 0) {
    negativeProfitDays.forEach(np => {
      weakAreas.push({
        type: 'danger',
        icon: 'bi-exclamation-triangle-fill',
        title: `Loss Recorded on ${np.date}`,
        desc: `Expenditure exceeded revenue by ₹${np.loss.toLocaleString('en-IN')}. Inspect purchase invoices or abnormal expenses.`
      });
    });
  }

  // 2. Lowest profit alert
  if (lowestProfitDay && dailyDocs.length > 1 && lowestProfitDay.profit < (netProfit / dailyDocs.length) * 0.5) {
    weakAreas.push({
      type: 'warning',
      icon: 'bi-graph-down-arrow',
      title: `Lowest Profit Day: ${lowestProfitDay.date}`,
      desc: `Generated only ₹${lowestProfitDay.profit.toLocaleString('en-IN')} net profit (Revenue: ₹${lowestProfitDay.sales.toLocaleString('en-IN')}, Outflow: ₹${lowestProfitDay.expense.toLocaleString('en-IN')}).`
    });
  }

  // 3. Category expense surge detection (categories representing > 25% of total expenses)
  Object.entries(categoryTotals).forEach(([cat, val]) => {
    if (overallExpense > 0 && (val / overallExpense) >= 0.25) {
      const pct = ((val / overallExpense) * 100).toFixed(0);
      weakAreas.push({
        type: 'info',
        icon: 'bi-pie-chart-fill',
        title: `High Expense Category: ${cat}`,
        desc: `Accounts for ${pct}% of total period spending (₹${val.toLocaleString('en-IN')}). Consider cost optimization here.`
      });
    }
  });

  return {
    period: preset,
    startDate,
    endDate,
    kpi: {
      totalIncome: totalSales,
      totalExpense: overallExpense,
      totalPurchase,
      totalOperationalExpense: totalExpense,
      netProfit,
      profitMargin,
      transactionCount: totalTransactions,
      cashInHand: paymentTotals.cash,
      upiDigital: paymentTotals.upi + paymentTotals.card
    },
    categoryTotals,
    paymentTotals,
    charts: {
      labels: trendLabels,
      sales: salesTrend,
      expenses: expenseTrend,
      profit: profitTrend
    },
    weakAreas
  };
}
