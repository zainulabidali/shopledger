/**
 * ShopLedger - Transactions Service Interface & Mock Implementation
 * Emulates atomic batch write mechanics and lock validation
 */
import { saveDb } from './auth.js';
import { formatDate, formatMonth } from './mockData.js';
import { formatTime12 } from '../i18n/index.js';

const STORAGE_KEY_DB = 'shopledger_mock_db';

function getDb() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_DB) || '{}');
}

/**
 * Fetch transactions with filter and pagination
 * @param {string} shopId
 * @param {object} filters
 */
export async function getTransactions(shopId, filters = {}) {
  const db = getDb();
  let list = (db.transactions || []).filter(tx => tx.shopId === shopId);

  // Filter by single date
  if (filters.date) {
    list = list.filter(tx => tx.date === filters.date);
  }

  // Filter by date range
  if (filters.startDate) {
    list = list.filter(tx => tx.date >= filters.startDate);
  }
  if (filters.endDate) {
    list = list.filter(tx => tx.date <= filters.endDate);
  }

  // Filter by type (sale / purchase / expense)
  if (filters.type && filters.type !== 'all') {
    list = list.filter(tx => tx.type === filters.type);
  }

  // Filter by category
  if (filters.category && filters.category !== 'all') {
    list = list.filter(tx => tx.category === filters.category);
  }

  // Filter by payment mode
  if (filters.paymentMode && filters.paymentMode !== 'all') {
    list = list.filter(tx => tx.paymentMode === filters.paymentMode);
  }

  // Filter by staffUid (for staff users)
  if (filters.staffUid) {
    list = list.filter(tx => tx.staffUid === filters.staffUid);
  }

  // Search query (item, note)
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase().trim();
    list = list.filter(tx => 
      (tx.item && tx.item.toLowerCase().includes(q)) || 
      (tx.note && tx.note.toLowerCase().includes(q)) ||
      (tx.category && tx.category.toLowerCase().includes(q))
    );
  }

  // Sort descending by created timestamp
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalCount = list.length;
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  const paginated = list.slice(offset, offset + limit);

  return {
    transactions: paginated,
    totalCount,
    hasMore: offset + limit < totalCount
  };
}

/**
 * Record a new transaction (Atomic Batch Operation)
 * @param {string} shopId
 * @param {object} txData
 */
export async function createTransaction(shopId, txData) {
  const db = getDb();
  const dateStr = txData.date || formatDate(new Date());
  const monthStr = dateStr.substring(0, 7);

  // 1. Verify day is not locked
  const daily = db.dailySummaries && db.dailySummaries[dateStr];
  if (daily && daily.locked) {
    throw new Error('This day has been locked and reconciled. No new transactions can be recorded.');
  }

  const txId = `tx_${dateStr.replace(/-/g, '')}_${Date.now().toString().slice(-4)}`;
  const now = new Date();
  const newTx = {
    id: txId,
    shopId,
    type: txData.type, // 'sale' | 'purchase' | 'expense'
    category: txData.category,
    item: txData.item,
    amount: Number(txData.amount),
    paymentMode: txData.paymentMode || 'cash',
    staffUid: txData.staffUid,
    staffName: txData.staffName || 'Staff',
    date: dateStr,
    time: txData.time || formatTime12(now),
    note: txData.note || '',
    createdAt: now.toISOString()
  };

  // 2. Insert into transactions collection
  if (!db.transactions) db.transactions = [];
  db.transactions.push(newTx);

  // 3. Atomically update daily summary container
  if (!db.dailySummaries) db.dailySummaries = {};
  if (!db.dailySummaries[dateStr]) {
    db.dailySummaries[dateStr] = {
      date: dateStr,
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

  const d = db.dailySummaries[dateStr];
  d.transactionCount = (d.transactionCount || 0) + 1;
  d.categoryTotals[newTx.category] = (d.categoryTotals[newTx.category] || 0) + newTx.amount;
  d.paymentTotals[newTx.paymentMode] = (d.paymentTotals[newTx.paymentMode] || 0) + newTx.amount;

  if (newTx.type === 'sale') {
    d.totalSales += newTx.amount;
    d.salesCount = (d.salesCount || 0) + 1;
  } else if (newTx.type === 'purchase') {
    d.totalPurchase += newTx.amount;
    d.purchaseCount = (d.purchaseCount || 0) + 1;
  } else if (newTx.type === 'expense') {
    d.totalExpense += newTx.amount;
    d.expenseCount = (d.expenseCount || 0) + 1;
  }

  d.profit = d.totalSales - (d.totalPurchase + d.totalExpense);

  // 4. Atomically update monthly summary container
  if (!db.monthlySummaries) db.monthlySummaries = {};
  if (!db.monthlySummaries[monthStr]) {
    db.monthlySummaries[monthStr] = {
      month: monthStr,
      totalSales: 0,
      totalPurchase: 0,
      totalExpense: 0,
      profit: 0,
      transactionCount: 0,
      categoryTotals: {},
      paymentTotals: { cash: 0, upi: 0, card: 0 }
    };
  }

  const m = db.monthlySummaries[monthStr];
  m.transactionCount = (m.transactionCount || 0) + 1;
  m.categoryTotals[newTx.category] = (m.categoryTotals[newTx.category] || 0) + newTx.amount;
  m.paymentTotals[newTx.paymentMode] = (m.paymentTotals[newTx.paymentMode] || 0) + newTx.amount;

  if (newTx.type === 'sale') m.totalSales += newTx.amount;
  else if (newTx.type === 'purchase') m.totalPurchase += newTx.amount;
  else if (newTx.type === 'expense') m.totalExpense += newTx.amount;

  m.profit = m.totalSales - (m.totalPurchase + m.totalExpense);

  saveDb(db);
  return newTx;
}

/**
 * Delete a transaction (Owner only, Day must not be locked)
 */
export async function deleteTransaction(shopId, txId) {
  const db = getDb();
  const txIndex = (db.transactions || []).findIndex(t => t.id === txId && t.shopId === shopId);
  if (txIndex === -1) {
    throw new Error('Transaction not found');
  }

  const tx = db.transactions[txIndex];
  const dateStr = tx.date;
  const monthStr = dateStr.substring(0, 7);

  const daily = db.dailySummaries && db.dailySummaries[dateStr];
  if (daily && daily.locked) {
    throw new Error('Cannot delete transaction: this day has already been locked.');
  }

  // Reverse batch counts
  if (daily) {
    daily.transactionCount = Math.max(0, (daily.transactionCount || 1) - 1);
    daily.categoryTotals[tx.category] = Math.max(0, (daily.categoryTotals[tx.category] || tx.amount) - tx.amount);
    daily.paymentTotals[tx.paymentMode] = Math.max(0, (daily.paymentTotals[tx.paymentMode] || tx.amount) - tx.amount);

    if (tx.type === 'sale') {
      daily.totalSales -= tx.amount;
      daily.salesCount = Math.max(0, (daily.salesCount || 1) - 1);
    } else if (tx.type === 'purchase') {
      daily.totalPurchase -= tx.amount;
      daily.purchaseCount = Math.max(0, (daily.purchaseCount || 1) - 1);
    } else if (tx.type === 'expense') {
      daily.totalExpense -= tx.amount;
      daily.expenseCount = Math.max(0, (daily.expenseCount || 1) - 1);
    }

    daily.profit = daily.totalSales - (daily.totalPurchase + daily.totalExpense);
  }

  const monthly = db.monthlySummaries && db.monthlySummaries[monthStr];
  if (monthly) {
    monthly.transactionCount = Math.max(0, (monthly.transactionCount || 1) - 1);
    monthly.categoryTotals[tx.category] = Math.max(0, (monthly.categoryTotals[tx.category] || tx.amount) - tx.amount);
    monthly.paymentTotals[tx.paymentMode] = Math.max(0, (monthly.paymentTotals[tx.paymentMode] || tx.amount) - tx.amount);

    if (tx.type === 'sale') monthly.totalSales -= tx.amount;
    else if (tx.type === 'purchase') monthly.totalPurchase -= tx.amount;
    else if (tx.type === 'expense') monthly.totalExpense -= tx.amount;

    monthly.profit = monthly.totalSales - (monthly.totalPurchase + monthly.totalExpense);
  }

  db.transactions.splice(txIndex, 1);
  saveDb(db);
  return true;
}

/**
 * Update an existing transaction (Owner only, Day must not be locked)
 */
export async function updateTransaction(shopId, txId, updatedData) {
  const db = getDb();
  const txIndex = (db.transactions || []).findIndex(t => t.id === txId && t.shopId === shopId);
  if (txIndex === -1) {
    throw new Error('Transaction not found');
  }

  const oldTx = db.transactions[txIndex];
  const dateStr = oldTx.date;
  const monthStr = dateStr.substring(0, 7);

  const daily = db.dailySummaries && db.dailySummaries[dateStr];
  if (daily && daily.locked) {
    throw new Error('Cannot edit transaction: this day has already been locked.');
  }

  const oldAmount = oldTx.amount;
  const newAmount = Number(updatedData.amount);
  if (!newAmount || newAmount <= 0) {
    throw new Error('Transaction amount must be greater than 0.');
  }

  const newType = updatedData.type || oldTx.type;
  const newCategory = updatedData.category || oldTx.category;
  const newPaymentMode = updatedData.paymentMode || oldTx.paymentMode;

  if (daily) {
    // Reverse old
    daily.categoryTotals[oldTx.category] = Math.max(0, (daily.categoryTotals[oldTx.category] || oldAmount) - oldAmount);
    daily.paymentTotals[oldTx.paymentMode] = Math.max(0, (daily.paymentTotals[oldTx.paymentMode] || oldAmount) - oldAmount);
    if (oldTx.type === 'sale') daily.totalSales -= oldAmount;
    else if (oldTx.type === 'purchase') daily.totalPurchase -= oldAmount;
    else if (oldTx.type === 'expense') daily.totalExpense -= oldAmount;

    // Apply new
    daily.categoryTotals[newCategory] = (daily.categoryTotals[newCategory] || 0) + newAmount;
    daily.paymentTotals[newPaymentMode] = (daily.paymentTotals[newPaymentMode] || 0) + newAmount;
    if (newType === 'sale') daily.totalSales += newAmount;
    else if (newType === 'purchase') daily.totalPurchase += newAmount;
    else if (newType === 'expense') daily.totalExpense += newAmount;

    daily.profit = daily.totalSales - (daily.totalPurchase + daily.totalExpense);
  }

  const monthly = db.monthlySummaries && db.monthlySummaries[monthStr];
  if (monthly) {
    // Reverse old
    monthly.categoryTotals[oldTx.category] = Math.max(0, (monthly.categoryTotals[oldTx.category] || oldAmount) - oldAmount);
    monthly.paymentTotals[oldTx.paymentMode] = Math.max(0, (monthly.paymentTotals[oldTx.paymentMode] || oldAmount) - oldAmount);
    if (oldTx.type === 'sale') monthly.totalSales -= oldAmount;
    else if (oldTx.type === 'purchase') monthly.totalPurchase -= oldAmount;
    else if (oldTx.type === 'expense') monthly.totalExpense -= oldAmount;

    // Apply new
    monthly.categoryTotals[newCategory] = (monthly.categoryTotals[newCategory] || 0) + newAmount;
    monthly.paymentTotals[newPaymentMode] = (monthly.paymentTotals[newPaymentMode] || 0) + newAmount;
    if (newType === 'sale') monthly.totalSales += newAmount;
    else if (newType === 'purchase') monthly.totalPurchase += newAmount;
    else if (newType === 'expense') monthly.totalExpense += newAmount;

    monthly.profit = monthly.totalSales - (monthly.totalPurchase + monthly.totalExpense);
  }

  const updatedTx = {
    ...oldTx,
    type: newType,
    category: newCategory,
    item: updatedData.item,
    amount: newAmount,
    paymentMode: newPaymentMode,
    note: updatedData.note || '',
    updatedAt: new Date().toISOString()
  };

  if (updatedData.date) {
    updatedTx.date = updatedData.date;
  }
  if (updatedData.time !== undefined && updatedData.time !== '') {
    updatedTx.time = updatedData.time;
  }

  db.transactions[txIndex] = updatedTx;
  saveDb(db);
  return updatedTx;
}
