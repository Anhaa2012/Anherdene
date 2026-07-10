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
export async function saveUserProfileToCloud(uid: string, data: Partial<UserProfile>) {
  try {
    const userDocRef = doc(db, "users", uid);
    await setDoc(userDocRef, {
      ...data,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error saving user profile to cloud:", error);
  }
}

// Get user profile state from Firestore
export async function getUserProfileFromCloud(uid: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error loading user profile from cloud:", error);
    return null;
  }
}

// Search user by email to add as friend
export async function findUserByEmail(email: string): Promise<{ uid: string; email: string; displayName: string } | null> {
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
    console.error("Error finding user by email:", error);
    return null;
  }
}

// Fetch user profiles for a list of UIDs (e.g. friends list)
export async function fetchUsersByUids(uids: string[]): Promise<UserProfile[]> {
  if (!uids || uids.length === 0) return [];
  try {
    const profiles: UserProfile[] = [];
    // Firestore in query supports max 10/30 items, so chunk it or fetch individually since friends lists are typically small
    for (const uid of uids) {
      const p = await getUserProfileFromCloud(uid);
      if (p) {
        profiles.push(p);
      }
    }
    return profiles;
  } catch (error) {
    console.error("Error fetching users by uids:", error);
    return [];
  }
}

// Update friendship: add friend UID to user's friend list
export async function addFriendToUser(userUid: string, friendUid: string) {
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
    console.error("Error adding friend:", error);
  }
}

// Update friendship: remove friend UID from user's friend list
export async function removeFriendFromUser(userUid: string, friendUid: string) {
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
    console.error("Error removing friend:", error);
  }
}
