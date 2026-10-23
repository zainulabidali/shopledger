/**
 * ShopLedger - Shop Metadata & Tenant Service Interface & Mock Implementation
 */
import { saveDb } from './auth.js';

const STORAGE_KEY_DB = 'shopledger_mock_db';

function getDb() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_DB) || '{}');
}

/**
 * Get shop profile details by ID
 * @param {string} shopId
 */
export async function getShop(shopId) {
  const db = getDb();
  return db.shops ? db.shops[shopId] : null;
}

/**
 * Update shop metadata (name, phone, address, custom categories)
 * @param {string} shopId
 * @param {object} updates
 */
export async function updateShop(shopId, updates) {
  const db = getDb();
  if (!db.shops || !db.shops[shopId]) {
    throw new Error('Shop not found');
  }
  db.shops[shopId] = { ...db.shops[shopId], ...updates };
  saveDb(db);
  return db.shops[shopId];
}

/**
 * Super Admin: List all registered shops
 */
export async function getAllShops() {
  const db = getDb();
  return Object.values(db.shops || {});
}

/**
 * Super Admin: Create a new shop & owner
 */
export async function createShopWithAdmin(shopData, ownerData) {
  const db = getDb();
  const shopId = `shop_${Date.now()}`;
  const ownerUid = `usr_owner_${Date.now()}`;

  const newOwner = {
    uid: ownerUid,
    name: ownerData.name,
    email: ownerData.email,
    phone: ownerData.phone || '',
    role: 'owner',
    shopId,
    active: true,
    createdAt: new Date().toISOString()
  };

  const newShop = {
    shopId,
    name: shopData.name,
    category: shopData.category || 'Retail',
    ownerUid,
    ownerName: ownerData.name,
    phone: ownerData.phone || '',
    address: shopData.address || '',
    active: true,
    createdAt: new Date().toISOString(),
    customCategories: {
      sale: ['Sales Item', 'Services'],
      purchase: ['Wholesale Stock', 'Supplies'],
      expense: ['Shop Rent', 'Electricity', 'Tea / Snacks', 'Petrol', 'Miscellaneous']
    }
  };

  db.users[ownerUid] = newOwner;
  db.shops[shopId] = newShop;
  saveDb(db);

  return { shop: newShop, owner: newOwner };
}

/**
 * Super Admin: Toggle shop status
 */
export async function toggleShopStatus(shopId, active) {
  const db = getDb();
  if (db.shops && db.shops[shopId]) {
    db.shops[shopId].active = active;
    saveDb(db);
  }
}
