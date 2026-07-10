import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCzSY_pCyrbPMflqNNmRuPJRchVvNtsGT8",
  authDomain: "knotted-reflector-740ks.firebaseapp.com",
  projectId: "knotted-reflector-740ks",
  storageBucket: "knotted-reflector-740ks.firebasestorage.app",
  messagingSenderId: "678772380842",
  appId: "1:678772380842:web:0b5a7356f9556da0d9ecd3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  coins: number;
  unlockedCarIds: string[];
  carUpgrades: Record<string, { engine: number; tires: number; brakes: number; nitro: number }>;
  carCustomizations: Record<string, {
    color: string;
    paintFinish: 'glossy' | 'metallic' | 'matte' | 'pearl';
    rimStyle: 'sports' | 'carbon' | 'deepdish' | 'goldstar';
    spoilerStyle: 'lowprofile' | 'aero' | 'drag' | 'none';
    decalStyle: 'stripes' | 'cyber' | 'flames' | 'none';
  }>;
  bestTimes: Record<string, number>;
  difficulty: 'easy' | 'medium' | 'legend';
  audioEnabled: boolean;
  volume: number;
  friendUids: string[];
  onlineStatus: 'online' | 'offline';
  lastSeen?: any;
}

// Save profile state to Firestore
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function isPermissionError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || String(error)).toLowerCase();
  return msg.includes("permission") || msg.includes("denied") || error.code === "permission-denied";
}

function isOfflineError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || String(error)).toLowerCase();
  return msg.includes("offline") || msg.includes("network") || msg.includes("failed to get document because the client is offline");
}

function handleCatchError(error: any, opType: OperationType, path: string) {
  if (isPermissionError(error)) {
    handleFirestoreError(error, opType, path);
  } else if (isOfflineError(error)) {
    console.warn(`Firestore Offline Warning [${opType} on ${path}]:`, error.message || error);
  } else {
    console.error(`Firestore Error [${opType} on ${path}]:`, error);
  }
}

export async function saveUserProfileToCloud(uid: string, data: Partial<UserProfile>) {
  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, "users", uid);
    await setDoc(userDocRef, {
      ...data,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleCatchError(error, OperationType.WRITE, path);
  }
}

// Get user profile state from Firestore
export async function getUserProfileFromCloud(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleCatchError(error, OperationType.GET, path);
    return null;
  }
}

// Search user by email to add as friend
export async function findUserByEmail(email: string): Promise<{ uid: string; email: string; displayName: string } | null> {
  const path = "users";
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const data = userDoc.data();
      return {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName || data.email.split('@')[0]
      };
    }
    return null;
  } catch (error) {
    handleCatchError(error, OperationType.LIST, path);
    return null;
  }
}

// Fetch user profiles for a list of UIDs (e.g. friends list)
export async function fetchUsersByUids(uids: string[]): Promise<UserProfile[]> {
  if (!uids || uids.length === 0) return [];
  try {
    const profiles: UserProfile[] = [];
    // Fetch individually since friends lists are typically small
    for (const uid of uids) {
      const p = await getUserProfileFromCloud(uid);
      if (p) {
        profiles.push(p);
      }
    }
    return profiles;
  } catch (error) {
    handleCatchError(error, OperationType.LIST, `users_batch`);
    return [];
  }
}

// Update friendship: add friend UID to user's friend list
export async function addFriendToUser(userUid: string, friendUid: string) {
  const path = `users/${userUid}`;
  try {
    const userDocRef = doc(db, "users", userUid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const friendUids: string[] = data.friendUids || [];
      if (!friendUids.includes(friendUid)) {
        const updated = [...friendUids, friendUid];
        await updateDoc(userDocRef, { friendUids: updated });
      }
    }
  } catch (error) {
    handleCatchError(error, OperationType.WRITE, path);
  }
}

// Update friendship: remove friend UID from user's friend list
export async function removeFriendFromUser(userUid: string, friendUid: string) {
  const path = `users/${userUid}`;
  try {
    const userDocRef = doc(db, "users", userUid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const friendUids: string[] = data.friendUids || [];
      const updated = friendUids.filter(id => id !== friendUid);
      await updateDoc(userDocRef, { friendUids: updated });
    }
  } catch (error) {
    handleCatchError(error, OperationType.WRITE, path);
  }
}
