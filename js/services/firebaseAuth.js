/**
 * ShopLedger - Firebase Authentication Service Implementation
 * Supports Email/Password authentication, secure role resolution from Firestore /users/{uid},
 * Staff invitation workflows, and Super Admin user management.
 */
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged as fbOnAuthStateChanged,
  createUserWithEmailAndPassword,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  getSecondaryAuth 
} from './firebaseConfig.js';

let cachedUser = null;
const listeners = new Set();

/**
 * Initialize Firebase Auth listener and resolve profile from /users/{uid}
 */
if (auth) {
  fbOnAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.active === false) {
            await signOut(auth);
            cachedUser = null;
            throw new Error('This account has been deactivated. Please contact your administrator.');
          }
          cachedUser = { uid: fbUser.uid, email: fbUser.email, ...data };
        } else {
          cachedUser = null;
        }
      } catch (err) {
        console.error('Error fetching user profile from Firestore:', err);
        cachedUser = null;
      }
    } else {
      cachedUser = null;
    }

    listeners.forEach(fn => fn(cachedUser));
  });
}

export async function getCurrentUser() {
  return cachedUser;
}

export function onAuthStateChanged(callback) {
  listeners.add(callback);
  callback(cachedUser);
  return () => listeners.delete(callback);
}

/**
 * Email / Password Authentication
 */
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const userDoc = await getDoc(doc(db, 'users', cred.user.uid));

  if (!userDoc.exists()) {
    await signOut(auth);
    throw new Error('User profile record not found in database. Contact administrator.');
  }

  const data = userDoc.data();
  if (data.active === false) {
    await signOut(auth);
    throw new Error('This account has been deactivated by the administrator.');
  }

  cachedUser = { uid: cred.user.uid, email: cred.user.email, ...data };
  listeners.forEach(fn => fn(cachedUser));
  return cachedUser;
}

/**
 * Sign out
 */
export async function logout() {
  await signOut(auth);
  cachedUser = null;
  listeners.forEach(fn => fn(null));
}

/**
 * Create a Staff invitation link
 * @param {string} shopId
 * @param {object} param1 { name, email }
 */
export async function createInvitation(shopId, { name, email }) {
  const token = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '');
  const shopSnap = await getDoc(doc(db, 'shops', shopId));
  const shopName = shopSnap.exists() ? (shopSnap.data().name || 'Shop') : 'Shop';

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

  await setDoc(doc(db, 'invitations', token), invitation);
  return invitation;
}

/**
 * Fetch and validate an invitation by token
 * @param {string} token
 */
export async function getInvitation(token) {
  if (!token) return null;
  const snap = await getDoc(doc(db, 'invitations', token));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.status !== 'pending') return null;
  return data;
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

  // Create Firebase Auth user
  const cred = await createUserWithEmailAndPassword(auth, invite.email, password);
  const uid = cred.user.uid;

  const profile = {
    uid,
    name: invite.name,
    email: invite.email,
    phone: '',
    role: 'staff',
    shopId: invite.shopId,
    active: true,
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, 'users', uid), profile);
  await updateDoc(doc(db, 'invitations', token), { 
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    acceptedByUid: uid
  });

  cachedUser = profile;
  listeners.forEach(fn => fn(cachedUser));
  return cachedUser;
}

/**
 * Retrieve pending staff invitations for a shop
 * @param {string} shopId
 */
export async function getPendingInvitations(shopId) {
  const q = query(
    collection(db, 'invitations'),
    where('shopId', '==', shopId),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

/**
 * Super Admin: Provision new Admin user account
 * Uses secondary app so active Super Admin session remains untouched
 */
export async function createAdminUser(shopId, adminData) {
  const { secondaryApp, secondaryAuth } = getSecondaryAuth();

  try {
    const password = adminData.password || 'Admin@123';
    const cred = await createUserWithEmailAndPassword(secondaryAuth, adminData.email.trim(), password);
    const newUid = cred.user.uid;

    const adminProfile = {
      uid: newUid,
      name: adminData.name.trim(),
      email: adminData.email.trim().toLowerCase(),
      phone: adminData.phone || '',
      role: 'admin',
      shopId: shopId,
      active: true,
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, 'users', newUid), adminProfile);
    await signOut(secondaryAuth);
    return adminProfile;
  } finally {
    if (secondaryApp && secondaryApp.delete) {
      await secondaryApp.delete();
    }
  }
}

export const createOwnerUser = createAdminUser;

/**
 * Super Admin: List all Admin accounts
 */
export async function getAllAdmins() {
  const q = query(
    collection(db, 'users'),
    where('role', 'in', ['admin', 'owner'])
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

/**
 * Toggle user active/deactivated status
 */
export async function toggleUserStatus(uid, active) {
  await updateDoc(doc(db, 'users', uid), { active });
}

/**
 * Retrieve all staff members for a shop
 */
export async function getStaffUsers(shopId) {
  const q = query(
    collection(db, 'users'),
    where('shopId', '==', shopId),
    where('role', '==', 'staff')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}
