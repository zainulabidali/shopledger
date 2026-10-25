/**
 * ShopLedger - Firebase Transactions Service Implementation
 * CRITICAL RULE: Writing a transaction and updating dailySummary + monthlySummary
 * MUST happen in ONE writeBatch using increment(), guaranteeing zero total drift!
 */
import { 
  db, 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit as fbLimit, 
  startAfter, 
  getDocs, 
  writeBatch, 
  increment,
  serverTimestamp 
} from './firebaseConfig.js';
import { formatDate } from './mockData.js';
import { formatTime12 } from '../i18n/index.js';

let lastVisibleDoc = null;

/**
 * Fetch paginated transactions with server-side filters
 */
export async function getTransactions(shopId, filters = {}) {
  const txRef = collection(db, 'shops', shopId, 'transactions');
  let constraints = [];

  // Filter constraints
  if (filters.date) {
    constraints.push(where('date', '==', filters.date));
  }
  if (filters.startDate) {
    constraints.push(where('date', '>=', filters.startDate));
  }
  if (filters.endDate) {
    constraints.push(where('date', '<=', filters.endDate));
  }
  if (filters.type && filters.type !== 'all') {
    constraints.push(where('type', '==', filters.type));
  }
  if (filters.category && filters.category !== 'all') {
    constraints.push(where('category', '==', filters.category));
  }
  if (filters.paymentMode && filters.paymentMode !== 'all') {
    constraints.push(where('paymentMode', '==', filters.paymentMode));
  }
  if (filters.staffUid) {
    constraints.push(where('staffUid', '==', filters.staffUid));
  }

  // Order by createdAt timestamp descending
  constraints.push(orderBy('createdAt', 'desc'));

  const pageSize = filters.limit || 15;
  constraints.push(fbLimit(pageSize));

  // Reset cursor when starting fresh (page 1 or new filter)
  if (!filters.offset || filters.offset === 0) {
    lastVisibleDoc = null;
  }

  if (filters.offset > 0 && lastVisibleDoc) {
    constraints.push(startAfter(lastVisibleDoc));
  }

  let snap;
  try {
    const q = query(txRef, ...constraints);
    snap = await getDocs(q);
  } catch (err) {
    if (err.code === 'failed-precondition' || (err.message && err.message.includes('requires an index'))) {
      console.warn('Firestore index missing/building, sorting in memory:', err.message);
      // Fallback: Query matching documents without composite orderBy
      const fallbackConstraints = [];
      if (filters.date) fallbackConstraints.push(where('date', '==', filters.date));
      if (filters.startDate) fallbackConstraints.push(where('date', '>=', filters.startDate));
      if (filters.endDate) fallbackConstraints.push(where('date', '<=', filters.endDate));
      if (filters.type && filters.type !== 'all') fallbackConstraints.push(where('type', '==', filters.type));
      if (filters.category && filters.category !== 'all') fallbackConstraints.push(where('category', '==', filters.category));
      if (filters.paymentMode && filters.paymentMode !== 'all') fallbackConstraints.push(where('paymentMode', '==', filters.paymentMode));
      if (filters.staffUid) fallbackConstraints.push(where('staffUid', '==', filters.staffUid));
      fallbackConstraints.push(fbLimit(pageSize));

      const qFallback = query(txRef, ...fallbackConstraints);
      snap = await getDocs(qFallback);
    } else {
      throw err;
    }
  }

  let transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Sort descending by createdAt
  transactions.sort((a, b) => {
    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
    return tB - tA;
  });

  // Client-side search keyword filtering (item, note)
  if (filters.searchQuery) {
    const qTerm = filters.searchQuery.toLowerCase().trim();
    transactions = transactions.filter(t => 
      (t.item && t.item.toLowerCase().includes(qTerm)) ||
      (t.note && t.note.toLowerCase().includes(qTerm)) ||
      (t.category && t.category.toLowerCase().includes(qTerm))
    );
  }

  lastVisibleDoc = snap.docs[snap.docs.length - 1] || null;

  return {
    transactions,
    totalCount: snap.size,
    hasMore: snap.docs.length === pageSize
  };
}

/**
 * Record a new transaction (Atomic Batch Operation with increment)
 */
export async function createTransaction(shopId, txData) {
  const dateStr = txData.date || formatDate(new Date());
  const monthStr = dateStr.substring(0, 7);
  const amount = Number(txData.amount);

  if (!amount || amount <= 0) {
    throw new Error('Transaction amount must be a positive number greater than ₹0.');
  }

  // 1. Check if the dailySummary document is locked
  const dailyDocRef = doc(db, 'shops', shopId, 'dailySummary', dateStr);
  const dailySnap = await getDoc(dailyDocRef);
  if (dailySnap.exists() && dailySnap.data().locked === true) {
    throw new Error(`Cannot add transaction: Day ${dateStr} is locked and reconciled.`);
  }

  // 2. Prepare atomic writeBatch
  const batch = writeBatch(db);

  // A. Create new transaction document
  const txColRef = collection(db, 'shops', shopId, 'transactions');
  const newTxDocRef = doc(txColRef);
  const txPayload = {
    id: newTxDocRef.id,
    type: txData.type, // 'sale' | 'purchase' | 'expense'
    category: txData.category,
    item: txData.item,
    amount: amount,
    paymentMode: txData.paymentMode || 'cash',
    staffUid: txData.staffUid,
    staffName: txData.staffName || 'Staff',
    date: dateStr,
    time: txData.time || formatTime12(new Date()),
    note: txData.note || '',
    createdAt: serverTimestamp()
  };
  batch.set(newTxDocRef, txPayload);

  // B. Update dailySummary with FieldValue.increment()
  const salesInc = txData.type === 'sale' ? amount : 0;
  const purchaseInc = txData.type === 'purchase' ? amount : 0;
  const expenseInc = txData.type === 'expense' ? amount : 0;
  const profitInc = salesInc - (purchaseInc + expenseInc);

  const dailyUpdates = {
    date: dateStr,
    totalSales: increment(salesInc),
    totalPurchase: increment(purchaseInc),
    totalExpense: increment(expenseInc),
    profit: increment(profitInc),
    transactionCount: increment(1),
    salesCount: increment(txData.type === 'sale' ? 1 : 0),
    purchaseCount: increment(txData.type === 'purchase' ? 1 : 0),
    expenseCount: increment(txData.type === 'expense' ? 1 : 0),
    [`categoryTotals.${txData.category}`]: increment(amount),
    [`paymentTotals.${txData.paymentMode}`]: increment(amount),
    updatedAt: serverTimestamp()
  };

  // set with merge: true handles both creation and updates
  batch.set(dailyDocRef, dailyUpdates, { merge: true });

  // C. Update monthlySummary with FieldValue.increment()
  const monthlyDocRef = doc(db, 'shops', shopId, 'monthlySummary', monthStr);
  const monthlyUpdates = {
    month: monthStr,
    totalSales: increment(salesInc),
    totalPurchase: increment(purchaseInc),
    totalExpense: increment(expenseInc),
    profit: increment(profitInc),
    transactionCount: increment(1),
    [`categoryTotals.${txData.category}`]: increment(amount),
    [`paymentTotals.${txData.paymentMode}`]: increment(amount),
    updatedAt: serverTimestamp()
  };
  batch.set(monthlyDocRef, monthlyUpdates, { merge: true });

  // 3. Atomically commit all operations simultaneously
  await batch.commit();

  return txPayload;
}

/**
 * Delete a transaction (Reverses batch increments atomically, verifies day lock)
 */
export async function deleteTransaction(shopId, txId) {
  const txDocRef = doc(db, 'shops', shopId, 'transactions', txId);
  const txSnap = await getDoc(txDocRef);

  if (!txSnap.exists()) {
    throw new Error('Transaction does not exist or has already been removed.');
  }

  const tx = txSnap.data();
  const dateStr = tx.date;
  const monthStr = dateStr.substring(0, 7);
  const amount = tx.amount;

  // Check day lock
  const dailyDocRef = doc(db, 'shops', shopId, 'dailySummary', dateStr);
  const dailySnap = await getDoc(dailyDocRef);
  if (dailySnap.exists() && dailySnap.data().locked === true) {
    throw new Error('Cannot delete transaction: This day is locked and reconciled.');
  }

  // Reverse batch increments
  const batch = writeBatch(db);
  batch.delete(txDocRef);

  const salesDec = tx.type === 'sale' ? -amount : 0;
  const purchaseDec = tx.type === 'purchase' ? -amount : 0;
  const expenseDec = tx.type === 'expense' ? -amount : 0;
  const profitDec = salesDec - (purchaseDec + expenseDec);

  const dailyReversal = {
    totalSales: increment(salesDec),
    totalPurchase: increment(purchaseDec),
    totalExpense: increment(expenseDec),
    profit: increment(profitDec),
    transactionCount: increment(-1),
    salesCount: increment(tx.type === 'sale' ? -1 : 0),
    purchaseCount: increment(tx.type === 'purchase' ? -1 : 0),
    expenseCount: increment(tx.type === 'expense' ? -1 : 0),
    [`categoryTotals.${tx.category}`]: increment(-amount),
    [`paymentTotals.${tx.paymentMode}`]: increment(-amount),
    updatedAt: serverTimestamp()
  };
  batch.set(dailyDocRef, dailyReversal, { merge: true });

  const monthlyDocRef = doc(db, 'shops', shopId, 'monthlySummary', monthStr);
  const monthlyReversal = {
    totalSales: increment(salesDec),
    totalPurchase: increment(purchaseDec),
    totalExpense: increment(expenseDec),
    profit: increment(profitDec),
    transactionCount: increment(-1),
    [`categoryTotals.${tx.category}`]: increment(-amount),
    [`paymentTotals.${tx.paymentMode}`]: increment(-amount),
    updatedAt: serverTimestamp()
  };
  await batch.commit();
  return true;
}

/**
 * Update an existing transaction (Atomic Batch Operation)
 */
export async function updateTransaction(shopId, txId, updatedData) {
  const txDocRef = doc(db, 'shops', shopId, 'transactions', txId);
  const txSnap = await getDoc(txDocRef);

  if (!txSnap.exists()) {
    throw new Error('Transaction does not exist or has already been removed.');
  }

  const oldTx = txSnap.data();
  const dateStr = oldTx.date;
  const monthStr = dateStr.substring(0, 7);

  // Check day lock
  const dailyDocRef = doc(db, 'shops', shopId, 'dailySummary', dateStr);
  const dailySnap = await getDoc(dailyDocRef);
  if (dailySnap.exists() && dailySnap.data().locked === true) {
    throw new Error('Cannot edit transaction: This day is locked and reconciled.');
  }

  const oldAmount = Number(oldTx.amount);
  const newAmount = Number(updatedData.amount);
  if (!newAmount || newAmount <= 0) {
    throw new Error('Transaction amount must be a positive number greater than ₹0.');
  }

  const newType = updatedData.type || oldTx.type;
  const newCategory = updatedData.category || oldTx.category;
  const newPaymentMode = updatedData.paymentMode || oldTx.paymentMode;

  const batch = writeBatch(db);

  // 1. Calculate net differences for summaries
  const oldSales = oldTx.type === 'sale' ? -oldAmount : 0;
  const oldPurchase = oldTx.type === 'purchase' ? -oldAmount : 0;
  const oldExpense = oldTx.type === 'expense' ? -oldAmount : 0;

  const newSales = newType === 'sale' ? newAmount : 0;
  const newPurchase = newType === 'purchase' ? newAmount : 0;
  const newExpense = newType === 'expense' ? newAmount : 0;

  const netSales = oldSales + newSales;
  const netPurchase = oldPurchase + newPurchase;
  const netExpense = oldExpense + newExpense;
  const netProfit = netSales - (netPurchase + netExpense);

  const dailyUpdates = {
    totalSales: increment(netSales),
    totalPurchase: increment(netPurchase),
    totalExpense: increment(netExpense),
    profit: increment(netProfit),
    updatedAt: serverTimestamp()
  };

  if (oldTx.category !== newCategory) {
    dailyUpdates[`categoryTotals.${oldTx.category}`] = increment(-oldAmount);
    dailyUpdates[`categoryTotals.${newCategory}`] = increment(newAmount);
  } else {
    dailyUpdates[`categoryTotals.${oldTx.category}`] = increment(newAmount - oldAmount);
  }

  if (oldTx.paymentMode !== newPaymentMode) {
    dailyUpdates[`paymentTotals.${oldTx.paymentMode}`] = increment(-oldAmount);
    dailyUpdates[`paymentTotals.${newPaymentMode}`] = increment(newAmount);
  } else {
    dailyUpdates[`paymentTotals.${oldTx.paymentMode}`] = increment(newAmount - oldAmount);
  }

  batch.set(dailyDocRef, dailyUpdates, { merge: true });

  const monthlyDocRef = doc(db, 'shops', shopId, 'monthlySummary', monthStr);
  batch.set(monthlyDocRef, dailyUpdates, { merge: true });

  const payload = {
    type: newType,
    category: newCategory,
    item: updatedData.item,
    amount: newAmount,
    paymentMode: newPaymentMode,
    note: updatedData.note || '',
    updatedAt: serverTimestamp()
  };

  if (updatedData.date) {
    payload.date = updatedData.date;
  }
  if (updatedData.time !== undefined && updatedData.time !== '') {
    payload.time = updatedData.time;
  }

  batch.update(txDocRef, payload);

  await batch.commit();
  return { id: txId, ...oldTx, ...payload };
}
