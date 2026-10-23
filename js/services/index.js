/**
 * ShopLedger - Unified Services Facade
 * Seamlessly selects Firebase implementation when configured,
 * or mock implementation for offline demo evaluation.
 */
import { isConfigured } from './firebaseConfig.js';

// Firebase Services
import * as fbAuth from './firebaseAuth.js';
import * as fbShops from './firebaseShops.js';
import * as fbTx from './firebaseTransactions.js';
import * as fbSummaries from './firebaseSummaries.js';

// Mock Services
import * as mockAuth from './auth.js';
import * as mockShops from './shops.js';
import * as mockTx from './transactions.js';
import * as mockSummaries from './summaries.js';

// Toggle between Firebase and Mock (defaults to Firebase if configured, else Mock)
const FORCE_FIREBASE = localStorage.getItem('shopledger_use_firebase') === 'true';
const useFirebase = isConfigured || FORCE_FIREBASE;

export const authService = useFirebase ? fbAuth : mockAuth;
export const shopService = useFirebase ? fbShops : mockShops;
export const txService = useFirebase ? fbTx : mockTx;
export const summaryService = useFirebase ? fbSummaries : mockSummaries;

export const isFirebaseActive = useFirebase;
