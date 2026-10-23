/**
 * ShopLedger - Firebase Shops Service Implementation
 * Manages shop tenants, custom category configurations, and multi-tenant provisioning
 */
import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs,
  serverTimestamp 
} from './firebaseConfig.js';
import { createOwnerUser } from './firebaseAuth.js';

export async function getShop(shopId) {
  const shopDocRef = doc(db, 'shops', shopId);
  const snap = await getDoc(shopDocRef);
  return snap.exists() ? { shopId, ...snap.data() } : null;
}

export async function updateShop(shopId, updates) {
  const shopDocRef = doc(db, 'shops', shopId);
  await updateDoc(shopDocRef, { ...updates, updatedAt: serverTimestamp() });
  const updatedSnap = await getDoc(shopDocRef);
  return { shopId, ...updatedSnap.data() };
}

export async function getAllShops() {
  const colRef = collection(db, 'shops');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ shopId: d.id, ...d.data() }));
}

/**
 * Super Admin: Provision new shop and owner user
 */
export async function createShopWithAdmin(shopData, ownerData) {
  const shopColRef = collection(db, 'shops');
  const newShopDocRef = doc(shopColRef);
  const shopId = newShopDocRef.id;

  // 1. Provision owner user account via secondary app
  const ownerProfile = await createOwnerUser(shopId, ownerData);

  // 2. Create shop tenant entity in primary firestore database
  const shopPayload = {
    shopId,
    name: shopData.name,
    category: shopData.category || 'Retail',
    address: shopData.address || '',
    ownerUid: ownerProfile.uid,
    ownerName: ownerData.name,
    phone: ownerData.phone || '',
    active: true,
    createdAt: serverTimestamp(),
    customCategories: {
      sale: ['Sales Item', 'Services'],
      purchase: ['Wholesale Stock', 'Supplies'],
      expense: ['Shop Rent', 'Electricity', 'Tea / Snacks', 'Petrol', 'Miscellaneous']
    }
  };

  await setDoc(newShopDocRef, shopPayload);

  return { shop: shopPayload, owner: ownerProfile };
}

export async function toggleShopStatus(shopId, active) {
  await updateDoc(doc(db, 'shops', shopId), { active });
}
