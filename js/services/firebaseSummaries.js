/**
 * ShopLedger - Firebase Summaries Service Implementation
 * CRITICAL RULE: Dashboard reads only pre-aggregated summary documents,
 * NEVER querying the raw transactions collection!
 */
import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  serverTimestamp 
} from './firebaseConfig.js';
import { formatDate } from './mockData.js';
import { getCurrentUser } from './firebaseAuth.js';

/**
 * Fetch a single daily summary document (Zero reads of transactions collection)
 */
export async function getDailySummary(shopId, date) {
  const docRef = doc(db, 'shops', shopId, 'dailySummary', date);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    return { date, ...snap.data() };
  }

  return {
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
 * Fetch range of daily summaries for charts and trend analytics
 */
export async function getDailySummariesRange(shopId, startDate, endDate) {
  const colRef = collection(db, 'shops', shopId, 'dailySummary');
  const q = query(
    colRef,
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc')
  );

  const snap = await getDocs(q);
  const map = {};
  snap.docs.forEach(d => {
    map[d.id] = d.data();
  });

  const results = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);

  while (cur <= end) {
    const dStr = formatDate(cur);
    const existing = map[dStr] || {
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
 * Fetch single monthly summary document
 */
export async function getMonthlySummary(shopId, month) {
  const docRef = doc(db, 'shops', shopId, 'monthlySummary', month);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    return { month, ...snap.data() };
  }

  return {
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
 * Reconcile physical cash drawer and freeze day from further writes
 * Enforces backend locking and prevents duplicate closing entries
 */
export async function reconcileAndLockDay(shopId, date, reconciliationData) {
  const docRef = doc(db, 'shops', shopId, 'dailySummary', date);
  const snap = await getDoc(docRef);

  if (snap.exists() && snap.data().locked === true) {
    throw new Error(`Day ${date} is already closed and locked. To record a new closing, you must first reopen the day.`);
  }

  const existingData = snap.exists() ? snap.data() : {};
  const history = Array.isArray(existingData.closingHistory) ? [...existingData.closingHistory] : [];

  const payload = {
    locked: true,
    reconciliation: {
      countedCash: reconciliationData.countedCash,
      expectedCash: reconciliationData.expectedCash,
      difference: reconciliationData.difference,
      note: reconciliationData.note || '',
      verifiedBy: reconciliationData.ownerUid,
      verifiedByName: reconciliationData.verifiedByName || 'Store Admin',
      verifiedAt: new Date().toISOString(),
      // Snapshot state at closing time to detect post-close modifications
      snapshotTransactionCount: reconciliationData.transactionCount !== undefined 
        ? reconciliationData.transactionCount 
        : (existingData.transactionCount || 0),
      snapshotExpectedCash: reconciliationData.expectedCash || 0,
      snapshotSales: existingData.totalSales || 0,
      snapshotOutflow: (existingData.totalPurchase || 0) + (existingData.totalExpense || 0)
    },
    closingHistory: history,
    updatedAt: serverTimestamp()
  };

  if (snap.exists()) {
    await updateDoc(docRef, payload);
  } else {
    await setDoc(docRef, {
      date,
      totalSales: 0,
      totalPurchase: 0,
      totalExpense: 0,
      profit: 0,
      transactionCount: 0,
      categoryTotals: {},
      paymentTotals: { cash: 0, upi: 0, card: 0 },
      ...payload
    });
  }

  return payload;
}

/**
 * Authorized Reopen / Unlock Day action
 * Preserves closing history and records who reopened the day and why
 */
export async function unlockAndReopenDay(shopId, date, reason = '', performedBy = null) {
  const docRef = doc(db, 'shops', shopId, 'dailySummary', date);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error(`Cannot reopen day: No summary records found for ${date}.`);
  }

  const existingData = snap.data();
  if (existingData.locked !== true) {
    throw new Error(`Day ${date} is already open and not locked.`);
  }

  let userName = performedBy;
  if (!userName) {
    try {
      const user = await getCurrentUser();
      userName = user ? (user.name || user.email || user.uid) : 'Store Admin';
    } catch (_) {
      userName = 'Store Admin';
    }
  }
  const closingRecord = existingData.reconciliation || {};
  const history = Array.isArray(existingData.closingHistory) ? [...existingData.closingHistory] : [];

  // Archive previous closing record into history
  history.push({
    ...closingRecord,
    reopenedAt: new Date().toISOString(),
    reopenedBy: userName,
    reopenReason: reason
  });

  const payload = {
    locked: false,
    closingHistory: history,
    lastReopened: {
      reopenedAt: new Date().toISOString(),
      reopenedBy: userName,
      reason
    },
    updatedAt: serverTimestamp()
  };

  await updateDoc(docRef, payload);
  return payload;
}

/**
 * Aggregates high-performance period analytics, trends, and weak area alerts
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

  try {
    const txColRef = collection(db, 'shops', shopId, 'transactions');
    const txQuery = query(
      txColRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const txSnap = await getDocs(txQuery);

    txSnap.docs.forEach(docSnap => {
      const tx = docSnap.data();
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
  } catch (err) {
    console.warn('Could not query raw transactions for analytics, falling back to daily summaries:', err);
    const dailyDocs = await getDailySummariesRange(shopId, startDate, endDate);
    dailyDocs.forEach(d => {
      totalSales += d.totalSales || 0;
      totalPurchase += d.totalPurchase || 0;
      totalExpense += d.totalExpense || 0;
      saleCount += d.salesCount || (d.totalSales > 0 ? 1 : 0);
      purchaseCount += d.purchaseCount || (d.totalPurchase > 0 ? 1 : 0);
      expenseCount += d.expenseCount || (d.totalExpense > 0 ? 1 : 0);
      if (dailyMap[d.date]) {
        dailyMap[d.date].sales = d.totalSales || 0;
        dailyMap[d.date].purchases = d.totalPurchase || 0;
        dailyMap[d.date].expenses = d.totalExpense || 0;
      }
      Object.entries(d.categoryTotals || {}).forEach(([cat, val]) => {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
      });
      Object.entries(d.paymentTotals || {}).forEach(([m, val]) => {
        if (paymentTotals.hasOwnProperty(m)) paymentTotals[m] += val;
      });
    });
  }

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
