/**
 * ShopLedger - Authentication Service Interface & Local / Mock Implementation
 */
import { generateInitialMockDatabase } from './mockData.js';

const STORAGE_KEY_AUTH = 'shopledger_auth_user';
const STORAGE_KEY_DB = 'shopledger_mock_db';

// Initialize mock DB from localStorage or seeds
function getDb() {
  const stored = localStorage.getItem(STORAGE_KEY_DB);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.warn('Resetting corrupt DB', e);
    }
  }
  const initial = generateInitialMockDatabase();
  localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(initial));
  return initial;
}

export function saveDb(db) {
  localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(db));
}

let currentUser = null;
const authListeners = new Set();

// Restore session (strictly requires prior authentication; no auto-demo login)
try {
  const savedUser = localStorage.getItem(STORAGE_KEY_AUTH);
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
  } else {
    currentUser = null;
  }
} catch (e) {
  currentUser = null;
}

function notifyAuth() {
  authListeners.forEach(fn => fn(currentUser));
}

/**
 * Get currently authenticated user profile
 * @returns {object|null}
 */
export async function getCurrentUser() {
  return currentUser;
}

/**
 * Listen to auth state transitions
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export function onAuthStateChanged(callback) {
  authListeners.add(callback);
  callback(currentUser);
  return () => authListeners.delete(callback);
}

/**
 * Sign in with email and password
 * @param {string} email
 * @param {string} password
 */
export async function login(email, password) {
  const db = getDb();
  const cleanEmail = email.trim().toLowerCase();

  const found = Object.values(db.users || {}).find(
    u => u.email && u.email.toLowerCase() === cleanEmail
  );

  if (!found) {
    throw new Error('Invalid email or password.');
  }

  if (found.active === false) {
    throw new Error('This account has been deactivated. Please contact your administrator.');
  }

  currentUser = found;
  localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(currentUser));
  notifyAuth();
  return currentUser;
}

/**
 * Sign out current user
 */
export async function logout() {
  currentUser = null;
  localStorage.removeItem(STORAGE_KEY_AUTH);
  notifyAuth();
}

/**
 * Create a Staff invitation link
 * @param {string} shopId
 * @param {object} param1 { name, email }
 */
export async function createInvitation(shopId, { name, email }) {
  const db = getDb();
  if (!db.invitations) db.invitations = {};

  const token = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '');
  const shop = db.shops ? db.shops[shopId] : null;
  const shopName = shop ? shop.name : 'Shop';

  const invitation = {
    token,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    shopId,
    shopName,
    role: 'staff',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.invitations[token] = invitation;
  saveDb(db);
  return invitation;
}

/**
 * Fetch and validate an invitation by token
 * @param {string} token
 */
export async function getInvitation(token) {
  if (!token) return null;
  const db = getDb();
  const invite = db.invitations ? db.invitations[token] : null;
  if (!invite || invite.status !== 'pending') return null;
  return invite;
}

/**
 * Accept staff invitation and provision new account
 * @param {string} token
 * @param {string} password
 */
export async function acceptInvitation(token, password) {
  const invite = await getInvitation(token);
  if (!invite) {
    throw new Error('This invitation link is invalid, expired, or has already been used.');
  }

  const db = getDb();
  const uid = `usr_staff_${Date.now()}`;
  const newUser = {
    uid,
    name: invite.name,
    email: invite.email,
    phone: '',
    role: 'staff',
    shopId: invite.shopId,
    active: true,
    createdAt: new Date().toISOString()
  };

  if (!db.users) db.users = {};
  db.users[uid] = newUser;
  db.invitations[token].status = 'accepted';
  db.invitations[token].acceptedAt = new Date().toISOString();
  db.invitations[token].acceptedByUid = uid;
  saveDb(db);

  currentUser = newUser;
  localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(currentUser));
  notifyAuth();
  return currentUser;
}

/**
 * Retrieve pending staff invitations for a shop
 * @param {string} shopId
 */
export async function getPendingInvitations(shopId) {
  const db = getDb();
  return Object.values(db.invitations || {}).filter(
    inv => inv.shopId === shopId && inv.status === 'pending'
  );
}

/**
 * Super Admin: Create new Admin account assigned to a shop
 * @param {string} shopId
 * @param {object} adminData { name, email, phone, password }
 */
export async function createAdminUser(shopId, adminData) {
  const db = getDb();
  const uid = `usr_admin_${Date.now()}`;
  const newAdmin = {
    uid,
    name: adminData.name.trim(),
    email: adminData.email.trim().toLowerCase(),
    phone: adminData.phone || '',
    role: 'admin',
    shopId,
    active: true,
    createdAt: new Date().toISOString()
  };

  if (!db.users) db.users = {};
  db.users[uid] = newAdmin;
  saveDb(db);
  return newAdmin;
}

export const createOwnerUser = createAdminUser;

/**
 * Super Admin: List all Admin accounts
 */
export async function getAllAdmins() {
  const db = getDb();
  return Object.values(db.users || {}).filter(
    u => u.role === 'admin' || u.role === 'owner'
  );
}

/**
 * Toggle user active/deactivated status
 * @param {string} uid
 * @param {boolean} active
 */
export async function toggleUserStatus(uid, active) {
  const db = getDb();
  if (db.users && db.users[uid]) {
    db.users[uid].active = active;
    saveDb(db);
  }
}

/**
 * Retrieve all staff members for a shop
 * @param {string} shopId
 */
export async function getStaffUsers(shopId) {
  const db = getDb();
  return Object.values(db.users || {}).filter(
    u => u.shopId === shopId && u.role === 'staff'
  );
}
