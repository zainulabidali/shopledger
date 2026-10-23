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
 */
export async function reconcileAndLockDay(shopId, date, reconciliationData) {
  const docRef = doc(db, 'shops', shopId, 'dailySummary', date);
  const snap = await getDoc(docRef);

  const payload = {
    locked: true,
    reconciliation: {
      countedCash: reconciliationData.countedCash,
      expectedCash: reconciliationData.expectedCash,
      difference: reconciliationData.difference,
      note: reconciliationData.note || '',
      verifiedBy: reconciliationData.ownerUid,
      verifiedAt: new Date().toISOString()
    },
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

  const dailyDocs = await getDailySummariesRange(shopId, startDate, endDate);

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
    totalSales += doc.totalSales || 0;
    totalPurchase += doc.totalPurchase || 0;
    totalExpense += doc.totalExpense || 0;
    totalTransactions += doc.transactionCount || 0;

    Object.entries(doc.categoryTotals || {}).forEach(([cat, val]) => {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
    });

    Object.entries(doc.paymentTotals || {}).forEach(([mode, val]) => {
      paymentTotals[mode] = (paymentTotals[mode] || 0) + val;
    });

    const shortDate = doc.date.slice(5);
    trendLabels.push(shortDate);
    salesTrend.push(doc.totalSales || 0);
    expenseTrend.push((doc.totalPurchase || 0) + (doc.totalExpense || 0));
    profitTrend.push(doc.profit || 0);

    if (lowestProfitDay === null || doc.profit < lowestProfitDay.profit) {
      lowestProfitDay = { date: doc.date, profit: doc.profit, sales: doc.totalSales, expense: (doc.totalExpense || 0) + (doc.totalPurchase || 0) };
    }

    if (doc.profit < 0) {
      negativeProfitDays.push({ date: doc.date, loss: Math.abs(doc.profit) });
    }
  });

  const overallExpense = totalPurchase + totalExpense;
  const netProfit = totalSales - overallExpense;
  const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0.0';

  // NOTE: paymentTotals.cash aggregates cash from ALL transaction types (sales + purchases + expenses).
  // This is NOT the same as net cash in hand. For an accurate cash drawer balance, see Day Close
  // which reads actual transactions by payment mode. Here we expose the raw totals for reference.
  const cashInHand = paymentTotals.cash;
  const upiDigital = paymentTotals.upi + paymentTotals.card;

  // Weak Areas Detection
  const weakAreas = [];

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

  if (lowestProfitDay && dailyDocs.length > 1 && lowestProfitDay.profit < (netProfit / dailyDocs.length) * 0.5) {
    weakAreas.push({
      type: 'warning',
      icon: 'bi-graph-down-arrow',
      title: `Lowest Profit Day: ${lowestProfitDay.date}`,
      desc: `Generated only ₹${lowestProfitDay.profit.toLocaleString('en-IN')} net profit (Revenue: ₹${lowestProfitDay.sales.toLocaleString('en-IN')}, Outflow: ₹${lowestProfitDay.expense.toLocaleString('en-IN')}).`
    });
  }

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
      cashInHand,
      upiDigital
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
