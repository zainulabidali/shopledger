# ShopLedger - Multi-Shop Daily Accounts Management Web App

**ShopLedger** is a mobile-first, multi-shop daily accounts and cash-flow management web application engineered for small business retailers (mobile shops, groceries, bakeries, pharmacies, supermarkets).

Built with **plain HTML5, CSS3 design tokens, and modular ES6 JavaScript**, utilizing **Bootstrap 5.3 CDN**, **Bootstrap Icons**, **Chart.js**, and the modular **Firebase Web SDK v10+** (Auth + Firestore).

---

## 1. Features Overview

- **Mobile-First UX**: Responsive thumb-zone bottom navigation on mobile devices, collapsible sidebar navigation on desktop.
- **Bilingual UI**: Full localization support for **English** and **Malayalam (മലയാളം)** with instant toggle.
- **Indian Financial Standard**: Curated currency formatting (`₹1,23,456` via `Intl.NumberFormat('en-IN')`).
- **Owner Dashboard**:
  - Filter by *Today*, *This Week*, *Last 15 Days*, *This Month*, or *Custom Range*.
  - 4 Financial KPI Cards (Income, Expense, Net Profit, Profit Margin %, Cash vs UPI Split).
  - Income vs Expense trend bar/line chart and Category Doughnut chart (Chart.js).
  - **Weak Areas & Smart Insights Panel**: Highlights lowest-profit days, negative-profit days, and categories with unusual expense growth (>25% share).
- **Quick Entry**:
  - 3-segment type toggle (`Sale`, `Purchase`, `Expense`).
  - Large 32px touch-friendly amount box with increment chips (`+₹50`, `+₹100`, `+₹500`, `+₹1k`, `+₹2k`).
  - Dynamic category chips, payment pills (`Cash`, `UPI / GPay`, `Card`), and live recent entries feed.
- **Day Close & Cash Reconciliation**:
  - Expected cash calculation ($Cash Sales - Cash Outflows$) vs counted physical cash.
  - Interactive denomination calculator (₹500, ₹200, ₹100, ₹50, ₹20, ₹10).
  - Real-time difference status highlight (Balanced `₹0`, Surplus, Shortage).
  - Day locking mechanism freezing financial entries for the date.
- **Transactions Ledger**:
  - Real-time debounced keyword search, multi-criteria filters, subtotal ribbon.
  - Desktop data table and mobile card feed.
  - Owner-only deletion reversing batch summary totals atomically.
  - Staff restrictions (view only own entries).
  - Clean pagination.
- **Reports & Analytics**:
  - Period breakdowns and category spend shares.
  - Client-side **CSV export** and formal **Print / PDF export** (`css/print.css`).
- **Staff Management**:
  - Roster cards, onboarding modal, and account active/disabled status toggle.
- **Super Admin Console**:
  - Multi-tenant directory, platform volume metrics, tenant suspension, and 1-step shop + owner provisioning.

---

## 2. Scalable Firestore Architecture (1,000+ Shops)

### Atomic Batch Increment Pattern
Writing or deleting a transaction and updating `dailySummary/{yyyy-MM-dd}` and `monthlySummary/{yyyy-MM}` occurs in a single Firestore `writeBatch` using `FieldValue.increment()`. Totals never drift and cannot become inconsistent.

```javascript
const batch = writeBatch(db);
batch.set(txDocRef, txPayload);
batch.set(dailyDocRef, {
  totalSales: increment(salesInc),
  totalExpense: increment(expenseInc),
  profit: increment(profitInc),
  transactionCount: increment(1)
}, { merge: true });
batch.set(monthlyDocRef, { ... }, { merge: true });
await batch.commit();
```

### Zero-Read Dashboard Summaries
The dashboard reads **only** single pre-aggregated summary documents (`dailySummary` or `monthlySummary`), **never** querying raw transaction documents. Even with 50,000 transactions per month, loading the dashboard requires only 1 to 15 document reads.

### No Hot Documents
All financial data is partitioned under individual shop paths:
```
users/{uid}
shops/{shopId}
shops/{shopId}/transactions/{txId}
shops/{shopId}/dailySummary/{yyyy-MM-dd}
shops/{shopId}/monthlySummary/{yyyy-MM}
```

---

## 3. Firebase Setup Guide

### Step 1: Create Firebase Project
1. Open [Firebase Console](https://console.firebase.google.com/) and click **Add Project** (e.g. `shopledger-prod`).
2. Navigate to **Authentication** > **Sign-in method** > Enable **Email/Password**.
3. Navigate to **Firestore Database** > Click **Create Database** > Select **Start in production mode**.

### Step 2: Configure Public Web Credentials
In `js/services/firebaseConfig.js`, replace the placeholder config object with your project credentials:
```javascript
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Step 3: Create the Initial Super Admin Account
Because security rules restrict writing to the `users` collection to super admins only, the first Super Admin must be created manually:
1. In the **Firebase Console**, go to **Authentication** > **Users** > Click **Add User**:
   - Email: `admin@shopledger.app`
   - Password: `YourSecurePassword123!`
   - Copy the generated `User UID` (e.g., `abc123AdminUid`).
2. Go to **Firestore Database** > Click **Start collection**:
   - Collection ID: `users`
   - Document ID: Paste the `User UID` from step 1.
   - Fields:
     ```json
     {
       "uid": "abc123AdminUid",
       "name": "Super Admin Officer",
       "email": "admin@shopledger.app",
       "role": "super_admin",
       "shopId": null,
       "active": true,
       "createdAt": "2026-10-12T10:00:00.000Z"
     }
     ```
3. Sign in to ShopLedger with `admin@shopledger.app` to access the Super Admin Console and provision shops and owners.

---

## 4. Security Rules & Emulator Test Checklist

Deploy rules to Firebase:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### Emulator-Based Test Checklist (`firebase emulators:start`)
1. **Tenant Isolation**:
   - Log in as Owner of `shop_A`. Attempting to read `shops/shop_B/transactions` must fail with `PERMISSION_DENIED`.
2. **Staff Read Restriction**:
   - Log in as Staff user `usr_staff_01` of `shop_A`. Attempting to read transactions logged by `usr_staff_02` must fail.
3. **Staff Write Restriction**:
   - Staff attempting to update or delete any transaction must fail.
   - Staff attempting to create a transaction with an amount $\le 0$ must fail.
   - Staff attempting to create a transaction where `staffUid != auth.uid` must fail.
4. **Day-Lock Enforcement**:
   - When `shops/{shopId}/dailySummary/{date}.locked == true`:
     - Creating a new transaction for `{date}` must fail with `PERMISSION_DENIED`.
     - Updating or deleting an existing transaction for `{date}` must fail.
5. **Super Admin Access**:
   - Super Admin can read and update all shops and users.

---

## 5. Deployment on Firebase Hosting

1. Install Firebase CLI (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```
2. Log in and select project:
   ```bash
   firebase login
   firebase use --add <YOUR_PROJECT_ID>
   ```
3. Deploy the application:
   ```bash
   firebase deploy
   ```
4. Your application will be live at `https://<YOUR_PROJECT_ID>.web.app`.
