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
 * Prevents duplicate closes and records historical closing snapshots
 * @param {string} shopId
 * @param {string} date
 * @param {object} reconciliationData { countedCash, expectedCash, difference, note, ownerUid }
 */
export async function reconcileAndLockDay(shopId, date, reconciliationData) {
  const db = getDb();
  if (!db.dailySummaries) db.dailySummaries = {};

  if (db.dailySummaries[date] && db.dailySummaries[date].locked === true) {
    throw new Error(`Day ${date} is already closed and locked. To record a new closing, you must first reopen the day.`);
  }

  if (!db.dailySummaries[date]) {
    db.dailySummaries[date] = await getDailySummary(shopId, date);
  }

  const d = db.dailySummaries[date];
  const history = Array.isArray(d.closingHistory) ? [...d.closingHistory] : [];

  d.locked = true;
  d.closingHistory = history;
  d.reconciliation = {
    countedCash: reconciliationData.countedCash,
    expectedCash: reconciliationData.expectedCash,
    difference: reconciliationData.difference,
    note: reconciliationData.note || '',
    verifiedBy: reconciliationData.ownerUid,
    verifiedByName: reconciliationData.verifiedByName || 'Store Admin',
    verifiedAt: new Date().toISOString(),
    snapshotTransactionCount: reconciliationData.transactionCount !== undefined 
      ? reconciliationData.transactionCount 
      : (d.transactionCount || 0),
    snapshotExpectedCash: reconciliationData.expectedCash || 0,
    snapshotSales: d.totalSales || 0,
    snapshotOutflow: (d.totalPurchase || 0) + (d.totalExpense || 0)
  };

  saveDb(db);
  return d;
}

/**
 * Authorized Reopen / Unlock Day action for mock/localStorage service
 */
export async function unlockAndReopenDay(shopId, date, reason = '', performedBy = 'Store Admin') {
  const db = getDb();
  if (!db.dailySummaries || !db.dailySummaries[date] || db.dailySummaries[date].locked !== true) {
    throw new Error(`Day ${date} is already open and not locked.`);
  }

  const d = db.dailySummaries[date];
  const closingRecord = d.reconciliation || {};
  const history = Array.isArray(d.closingHistory) ? [...d.closingHistory] : [];

  history.push({
    ...closingRecord,
    reopenedAt: new Date().toISOString(),
    reopenedBy: performedBy || 'Store Admin',
    reopenReason: reason
  });

  d.locked = false;
  d.closingHistory = history;
  d.lastReopened = {
    reopenedAt: new Date().toISOString(),
    reopenedBy: performedBy || 'Store Admin',
    reason
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

  const db = getDb();
  const txList = (db.transactions || []).filter(tx => 
    (!shopId || tx.shopId === shopId) && tx.date >= startDate && tx.date <= endDate
  );

  // Pre-populate daily trend slots for selected period
  const dailyMap = {};
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    const dStr = formatDate(cur);
    dailyMap[dStr] = { sales: 0, purchases: 0, expenses: 0 };
    cur.setDate(cur.getDate() + 1);
  }

  let totalSales = 0;
  let saleCount = 0;
  let totalPurchase = 0;
  let purchaseCount = 0;
  let totalExpense = 0;
  let expenseCount = 0;
  const categoryTotals = {};
  const paymentTotals = { cash: 0, upi: 0, card: 0 };

  txList.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'sale') {
      totalSales += amt;
      saleCount += 1;
      if (dailyMap[tx.date]) dailyMap[tx.date].sales += amt;
    } else if (tx.type === 'purchase') {
      totalPurchase += amt;
      purchaseCount += 1;
      if (dailyMap[tx.date]) dailyMap[tx.date].purchases += amt;
      if (tx.category) {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + amt;
      }
    } else if (tx.type === 'expense') {
      totalExpense += amt;
      expenseCount += 1;
      if (dailyMap[tx.date]) dailyMap[tx.date].expenses += amt;
      if (tx.category) {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + amt;
      }
    }

    if (tx.paymentMode && paymentTotals.hasOwnProperty(tx.paymentMode)) {
      paymentTotals[tx.paymentMode] += amt;
    }
  });

  const averageSales = saleCount > 0 ? Math.round((totalSales / saleCount) * 100) / 100 : 0;
  const averagePurchase = purchaseCount > 0 ? Math.round((totalPurchase / purchaseCount) * 100) / 100 : 0;
  const averageExpense = expenseCount > 0 ? Math.round((totalExpense / expenseCount) * 100) / 100 : 0;
  const netCashFlow = totalSales - totalPurchase - totalExpense;
  const totalTransactions = saleCount + purchaseCount + expenseCount;
  const overallOutflow = totalPurchase + totalExpense;

  const trendLabels = Object.keys(dailyMap).map(d => d.slice(5)); // MM-DD
  const salesTrend = Object.values(dailyMap).map(d => d.sales);
  const purchasesTrend = Object.values(dailyMap).map(d => d.purchases);
  const expensesTrend = Object.values(dailyMap).map(d => d.expenses);

  return {
    period: preset,
    startDate,
    endDate,
    kpi: {
      totalSales,
      saleCount,
      averageSales,
      totalPurchase,
      purchaseCount,
      averagePurchase,
      totalExpense,
      expenseCount,
      averageExpense,
      netCashFlow,
      totalTransactions,
      // Backward-compatibility aliases
      totalIncome: totalSales,
      totalExpense: overallOutflow,
      totalOperationalExpense: totalExpense,
      netProfit: netCashFlow,
      profitMargin: totalSales > 0 ? ((netCashFlow / totalSales) * 100).toFixed(1) : '0.0',
      transactionCount: totalTransactions,
      cashInHand: paymentTotals.cash,
      upiDigital: paymentTotals.upi + paymentTotals.card
    },
    categoryTotals,
    paymentTotals,
    charts: {
      labels: trendLabels,
      sales: salesTrend,
      purchases: purchasesTrend,
      expenses: expensesTrend
    },
    weakAreas: []
  };
}
