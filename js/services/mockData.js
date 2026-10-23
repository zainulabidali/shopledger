/**
 * ShopLedger - Mock Data Generator
 * Provides realistic multi-shop, multi-role seeds with pre-aggregated summaries
 */

// Format date helper: YYYY-MM-DD
export function formatDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatMonth(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function generateInitialMockDatabase() {
  const today = new Date();
  const todayStr = formatDate(today);
  const currentMonthStr = formatMonth(today);

  // Default Users
  const users = {
    'usr_admin_01': {
      uid: 'usr_admin_01',
      name: 'Super Admin Officer',
      email: 'admin@shopledger.app',
      role: 'super_admin',
      shopId: null,
      active: true,
      phone: '+919999900000'
    },
    'usr_owner_01': {
      uid: 'usr_owner_01',
      name: 'Rahul Krishnan',
      email: 'rahul@metromobiles.in',
      role: 'owner',
      shopId: 'shop_metro_001',
      active: true,
      phone: '+919876543210'
    },
    'usr_staff_01': {
      uid: 'usr_staff_01',
      name: 'Anand M',
      email: 'anand@metromobiles.in',
      role: 'staff',
      shopId: 'shop_metro_001',
      active: true,
      phone: '+919876543211'
    },
    'usr_staff_02': {
      uid: 'usr_staff_02',
      name: 'Suresh Kumar',
      email: 'suresh@metromobiles.in',
      role: 'staff',
      shopId: 'shop_metro_001',
      active: true,
      phone: '+919876543212'
    }
  };

  // Default Shops
  const shops = {
    'shop_metro_001': {
      shopId: 'shop_metro_001',
      name: 'Metro Mobiles & Electronics',
      category: 'Mobile & Accessories',
      ownerUid: 'usr_owner_01',
      ownerName: 'Rahul Krishnan',
      phone: '+919876543210',
      address: 'MG Road, Ernakulam, Kerala',
      active: true,
      createdAt: '2026-01-10T10:00:00.000Z',
      customCategories: {
        sale: ['Smartphones', 'Accessories', 'Screen Guard / Glass', 'Repair & Service', 'Recharge'],
        purchase: ['Stock / Inventory', 'Spare Parts / Displays', 'Packaging Materials'],
        expense: ['Shop Rent', 'Electricity', 'Staff Salary / Advance', 'Staff Food / Tea', 'Petrol / Delivery', 'Misc Repairs']
      }
    },
    'shop_malabar_002': {
      shopId: 'shop_malabar_002',
      name: 'Malabar Fresh Groceries',
      category: 'Grocery & Spices',
      ownerUid: 'usr_owner_02',
      ownerName: 'Kareem Haji',
      phone: '+919847012345',
      address: 'SM Street, Kozhikode, Kerala',
      active: true,
      createdAt: '2026-02-01T10:00:00.000Z',
      customCategories: {
        sale: ['Vegetables', 'Groceries', 'Dairy & Milk', 'Spices'],
        purchase: ['Market Wholesale Stock', 'Packaging'],
        expense: ['Shop Rent', 'Vehicle Petrol', 'Staff Tea', 'Electric Bill']
      }
    }
  };

  // Seed Transactions for past 15 days for shop_metro_001
  const transactions = [];
  const dailySummaries = {};
  const monthlySummaries = {};

  // Helper to ensure daily summary container
  function getOrCreateDaily(dateStr) {
    if (!dailySummaries[dateStr]) {
      dailySummaries[dateStr] = {
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
    return dailySummaries[dateStr];
  }

  // Helper to ensure monthly summary container
  function getOrCreateMonthly(monthStr) {
    if (!monthlySummaries[monthStr]) {
      monthlySummaries[monthStr] = {
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
    return monthlySummaries[monthStr];
  }

  // Sample items matrix
  const salesItems = [
    { item: 'iPhone 13 Tempered Glass', cat: 'Screen Guard / Glass', amt: 299, mode: 'upi' },
    { item: 'Boat Rockerz 255 Neckband', cat: 'Accessories', amt: 1299, mode: 'cash' },
    { item: 'Samsung 25W Type-C Charger', cat: 'Accessories', amt: 1450, mode: 'upi' },
    { item: 'Redmi Note 12 Display Repair', cat: 'Repair & Service', amt: 2800, mode: 'cash' },
    { item: 'OnePlus Nord CE 3 Lite', cat: 'Smartphones', amt: 19999, mode: 'card' },
    { item: 'AirPods Silicone Case', cat: 'Accessories', amt: 199, mode: 'cash' },
    { item: 'Mic Replacement & Clean', cat: 'Repair & Service', amt: 450, mode: 'upi' },
    { item: 'Jio 299 Monthly Recharge', cat: 'Recharge', amt: 299, mode: 'upi' }
  ];

  const purchaseItems = [
    { item: 'Tempered Glass Stock (50 pcs)', cat: 'Stock / Inventory', amt: 2500, mode: 'upi' },
    { item: 'AMOLED Replacement Displays', cat: 'Spare Parts / Displays', amt: 8500, mode: 'upi' },
    { item: 'Charging Cables Lot', cat: 'Stock / Inventory', amt: 3200, mode: 'cash' }
  ];

  const expenseItems = [
    { item: 'Delivery Petrol Allowance', cat: 'Petrol / Delivery', amt: 350, mode: 'cash' },
    { item: 'Evening Tea & Snacks', cat: 'Staff Food / Tea', amt: 120, mode: 'cash' },
    { item: 'Shop Daily Cleaning Supplies', cat: 'Misc Repairs', amt: 180, mode: 'cash' },
    { item: 'Staff Weekly Advance', cat: 'Staff Salary / Advance', amt: 2000, mode: 'upi' }
  ];

  // Generate 15 days backwards
  let txCounter = 1;
  for (let i = 14; i >= 0; i--) {
    const curDate = new Date();
    curDate.setDate(today.getDate() - i);
    const curDateStr = formatDate(curDate);
    const curMonthStr = formatMonth(curDate);

    const daily = getOrCreateDaily(curDateStr);
    const monthly = getOrCreateMonthly(curMonthStr);

    // Days with special simulated conditions
    // Day i=7 (a week ago): heavy expense day / negative profit
    // Day i=3: high sales day
    // Day i=0 (Today): active open day

    let daySalesCount = (i === 0) ? 5 : (i === 7) ? 2 : (i === 3) ? 7 : 4;
    let dayPurchasesCount = (i === 7) ? 2 : (i % 3 === 0) ? 1 : 0;
    let dayExpensesCount = (i === 7) ? 3 : (i % 2 === 0) ? 2 : 1;

    // Generate Sales
    for (let s = 0; s < daySalesCount; s++) {
      const template = salesItems[(s + i) % salesItems.length];
      const tx = {
        id: `tx_${curDateStr.replace(/-/g, '')}_${String(txCounter++).padStart(4, '0')}`,
        shopId: 'shop_metro_001',
        type: 'sale',
        category: template.cat,
        item: template.item,
        amount: template.amt,
        paymentMode: template.mode,
        staffUid: (s % 2 === 0) ? 'usr_staff_01' : 'usr_owner_01',
        staffName: (s % 2 === 0) ? 'Anand M' : 'Rahul Krishnan',
        date: curDateStr,
        note: (s === 0) ? 'Customer billed at front counter' : '',
        createdAt: `${curDateStr}T${String(10 + s).padStart(2, '0')}:15:00.000Z`
      };
      transactions.push(tx);

      daily.totalSales += tx.amount;
      daily.transactionCount += 1;
      daily.categoryTotals[tx.category] = (daily.categoryTotals[tx.category] || 0) + tx.amount;
      daily.paymentTotals[tx.paymentMode] = (daily.paymentTotals[tx.paymentMode] || 0) + tx.amount;

      monthly.totalSales += tx.amount;
      monthly.transactionCount += 1;
      monthly.categoryTotals[tx.category] = (monthly.categoryTotals[tx.category] || 0) + tx.amount;
      monthly.paymentTotals[tx.paymentMode] = (monthly.paymentTotals[tx.paymentMode] || 0) + tx.amount;
    }

    // Generate Purchases
    for (let p = 0; p < dayPurchasesCount; p++) {
      const template = purchaseItems[(p + i) % purchaseItems.length];
      const tx = {
        id: `tx_${curDateStr.replace(/-/g, '')}_${String(txCounter++).padStart(4, '0')}`,
        shopId: 'shop_metro_001',
        type: 'purchase',
        category: template.cat,
        item: template.item,
        amount: template.amt,
        paymentMode: template.mode,
        staffUid: 'usr_owner_01',
        staffName: 'Rahul Krishnan',
        date: curDateStr,
        note: 'Supplier invoice received',
        createdAt: `${curDateStr}T14:30:00.000Z`
      };
      transactions.push(tx);

      daily.totalPurchase += tx.amount;
      daily.transactionCount += 1;
      daily.categoryTotals[tx.category] = (daily.categoryTotals[tx.category] || 0) + tx.amount;
      daily.paymentTotals[tx.paymentMode] = (daily.paymentTotals[tx.paymentMode] || 0) + tx.amount;

      monthly.totalPurchase += tx.amount;
      monthly.transactionCount += 1;
      monthly.categoryTotals[tx.category] = (monthly.categoryTotals[tx.category] || 0) + tx.amount;
      monthly.paymentTotals[tx.paymentMode] = (monthly.paymentTotals[tx.paymentMode] || 0) + tx.amount;
    }

    // Generate Expenses
    for (let e = 0; e < dayExpensesCount; e++) {
      const template = expenseItems[(e + i) % expenseItems.length];
      // Intentionally surge petrol expense on day 4 & 5 to trigger "Weak Area" detection!
      const amt = (template.cat.includes('Petrol') && i < 6) ? template.amt * 2.2 : template.amt;
      const tx = {
        id: `tx_${curDateStr.replace(/-/g, '')}_${String(txCounter++).padStart(4, '0')}`,
        shopId: 'shop_metro_001',
        type: 'expense',
        category: template.cat,
        item: template.item,
        amount: Math.round(amt),
        paymentMode: template.mode,
        staffUid: 'usr_staff_01',
        staffName: 'Anand M',
        date: curDateStr,
        note: '',
        createdAt: `${curDateStr}T17:45:00.000Z`
      };
      transactions.push(tx);

      daily.totalExpense += tx.amount;
      daily.transactionCount += 1;
      daily.categoryTotals[tx.category] = (daily.categoryTotals[tx.category] || 0) + tx.amount;
      daily.paymentTotals[tx.paymentMode] = (daily.paymentTotals[tx.paymentMode] || 0) + tx.amount;

      monthly.totalExpense += tx.amount;
      monthly.transactionCount += 1;
      monthly.categoryTotals[tx.category] = (monthly.categoryTotals[tx.category] || 0) + tx.amount;
      monthly.paymentTotals[tx.paymentMode] = (monthly.paymentTotals[tx.paymentMode] || 0) + tx.amount;
    }

    daily.profit = daily.totalSales - (daily.totalPurchase + daily.totalExpense);
    monthly.profit = monthly.totalSales - (monthly.totalPurchase + monthly.totalExpense);

    // Lock past days except today and yesterday
    if (i > 1) {
      daily.locked = true;
      daily.reconciliation = {
        expectedCash: daily.paymentTotals.cash,
        countedCash: daily.paymentTotals.cash,
        difference: 0,
        verifiedBy: 'usr_owner_01',
        verifiedAt: `${curDateStr}T21:30:00.000Z`
      };
    }
  }

  return {
    users,
    shops,
    transactions,
    dailySummaries,
    monthlySummaries
  };
}
