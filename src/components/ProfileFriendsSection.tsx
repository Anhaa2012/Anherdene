import React, { useState, useEffect } from "react";
import {
  User,
  Users,
  LogOut,
  LogIn,
  UserPlus,
  Search,
  Trash2,
  Mail,
  Lock,
  Award,
  Clock,
  Flame,
  ShieldAlert,
  Loader,
  Play
} from "lucide-react";
import {
  auth,
  db,
  UserProfile,
  saveUserProfileToCloud,
  getUserProfileFromCloud,
  findUserByEmail,
  addFriendToUser,
  removeFriendFromUser,
  fetchUsersByUids
} from "../firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { motion } from "motion/react";

interface ProfileFriendsSectionProps {
  coins: number;
  unlockedCarIds: string[];
  carUpgrades: any;
  carCustomizations: any;
  bestTimes: Record<string, number>;
  difficulty: "easy" | "medium" | "legend";
  audioEnabled: boolean;
  volume: number;
  onLoadProgression: (progression: {
    coins: number;
    unlockedCarIds: string[];
    carUpgrades: any;
    carCustomizations: any;
    bestTimes: Record<string, number>;
    playerName: string;
    difficulty: "easy" | "medium" | "legend";
    audioEnabled: boolean;
    volume: number;
  }) => void;
  onSelectTrackAndStart: (trackId: string) => void;
}

export default function ProfileFriendsSection({
  coins,
  unlockedCarIds,
  carUpgrades,
  carCustomizations,
  bestTimes,
  difficulty,
  audioEnabled,
  volume,
  onLoadProgression,
  onSelectTrackAndStart
}: ProfileFriendsSectionProps) {
  // Auth state
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");

  // Friends state
  const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState<boolean>(false);
  const [searchEmail, setSearchEmail] = useState<string>("");
  const [searchResult, setSearchResult] = useState<{ uid: string; email: string; displayName: string } | null>(null);
  const [searchError, setSearchError] = useState<string>("");
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [friendActionLoading, setFriendActionLoading] = useState<boolean>(false);

  // Tracks list for display
  const trackNames: Record<string, string> = {
    track_city: "Neon Gridway",
    track_desert: "Canyon Dune",
    track_mountain: "Alpine Drift",
    track_volcano: "Volcano Hairpins",
    track_cosmic: "Cosmic Hyperway"
  };

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      setUser(firebaseUser);
      setAuthError("");

      if (firebaseUser) {
        // Logged in! Fetch cloud profile
        try {
          let profile = await getUserProfileFromCloud(firebaseUser.uid);
          if (profile) {
            // Load loaded values back to App state
            onLoadProgression({
              coins: profile.coins ?? coins,
              unlockedCarIds: profile.unlockedCarIds ?? unlockedCarIds,
              carUpgrades: profile.carUpgrades ?? carUpgrades,
              carCustomizations: profile.carCustomizations ?? carCustomizations,
              bestTimes: profile.bestTimes ?? bestTimes,
              playerName: profile.displayName || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Racer",
              difficulty: profile.difficulty ?? difficulty,
              audioEnabled: profile.audioEnabled ?? audioEnabled,
              volume: profile.volume ?? volume
            });

            // Set user online
            await saveUserProfileToCloud(firebaseUser.uid, {
              onlineStatus: "online"
            });
          } else {
            // No cloud profile exists yet (first sign-in). Save local progress to Cloud!
            const newName = firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Racer";
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: newName,
              coins,
              unlockedCarIds,
              carUpgrades,
              carCustomizations,
              bestTimes,
              difficulty,
              audioEnabled,
              volume,
              friendUids: [],
              onlineStatus: "online"
            };
            await saveUserProfileToCloud(firebaseUser.uid, newProfile);
          }

          // Fetch friends list
          await refreshFriendsList(firebaseUser.uid);
        } catch (err) {
          console.error("Error loading profile on auth change:", err);
        }
      } else {
        // Logged out
        setFriendProfiles([]);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update status to offline on tab close or navigation away
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (auth.currentUser) {
        // Set offline status on exit
        const userDocRef = db ? saveUserProfileToCloud(auth.currentUser.uid, { onlineStatus: "offline" }) : null;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const refreshFriendsList = async (uid: string) => {
    setFriendsLoading(true);
    try {
      const profile = await getUserProfileFromCloud(uid);
      if (profile && profile.friendUids && profile.friendUids.length > 0) {
        const list = await fetchUsersByUids(profile.friendUids);
        setFriendProfiles(list);
      } else {
        setFriendProfiles([]);
      }
    } catch (err) {
      console.error("Error refreshing friends list:", err);
    }
    setFriendsLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setAuthError("Email and password are required.");
      setAuthLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Sign Up
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        const firebaseUser = userCredential.user;
        
        const cleanName = displayName.trim() || trimmedEmail.split("@")[0];
        await updateProfile(firebaseUser, { displayName: cleanName });

        // Initialize user record
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: trimmedEmail,
          displayName: cleanName,
          coins,
          unlockedCarIds,
          carUpgrades,
          carCustomizations,
          bestTimes,
          difficulty,
          audioEnabled,
          volume,
          friendUids: [],
          onlineStatus: "online"
        };
        await saveUserProfileToCloud(firebaseUser.uid, newProfile);

        // Also save playerName to localStorage
        localStorage.setItem("race_player_name", cleanName);
      } else {
        // Sign In
        const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const firebaseUser = userCredential.user;

        // Fetch their profile and update display name locally
        const profile = await getUserProfileFromCloud(firebaseUser.uid);
        const cleanName = profile?.displayName || firebaseUser.displayName || trimmedEmail.split("@")[0];
        localStorage.setItem("race_player_name", cleanName);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === "auth/email-already-in-use") {
        setAuthError("Энэ имэйл хаяг аль хэдийн бүртгэгдсэн байна.");
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setAuthError("Имэйл эсвэл нууц үг буруу байна.");
      } else if (err.code === "auth/weak-password") {
        setAuthError("Нууц үг сул байна. Доод тал нь 6 тэмдэгт оруулна уу.");
      } else if (err.code === "auth/operation-not-allowed") {
        setAuthError("Имэйл/нууц үгээр нэвтрэх хараахан идэвхжээгүй байна. Та доорх 'Google-ээр нэвтрэх' товчийг ашиглан шууд нэвтрэх боломжтой!");
      } else {
        setAuthError(err.message || "Алдаа гарлаа. Дахин оролдоно уу.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;
      const cleanName = firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Racer";
      localStorage.setItem("race_player_name", cleanName);
    } catch (err: any) {
      console.error("Google Auth error:", err);
      if (err.code === "auth/popup-blocked") {
        setAuthError("Нэвтрэх цонх хаагдсан байна. Хөтчийнхөө 'Pop-up blocker' тохиргоог шалгана уу.");
      } else {
        setAuthError(err.message || "Google-ээр нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await saveUserProfileToCloud(user.uid, { onlineStatus: "offline" });
        await signOut(auth);
      } catch (err) {
        console.error("Logout error:", err);
      }
    }
  };

  const handleSearchFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError("");
    setSearchResult(null);
    setSearchLoading(true);

    const trimmedEmail = searchEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setSearchError("Имэйл хаяг оруулна уу.");
      setSearchLoading(false);
      return;
    }

    if (user && trimmedEmail === user.email?.toLowerCase()) {
      setSearchError("Өөрийгөө найзаар нэмэх боломжгүй.");
      setSearchLoading(false);
      return;
    }

    try {
      const found = await findUserByEmail(trimmedEmail);
      if (found) {
        setSearchResult(found);
      } else {
        setSearchError("Хэрэглэгч олдсонгүй.");
      }
    } catch (err) {
      setSearchError("Хайлт хийхэд алдаа гарлаа.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddFriend = async (friendUid: string) => {
    if (!user) return;
    setFriendActionLoading(true);
    try {
      // Add friend UID to current user's friend list
      await addFriendToUser(user.uid, friendUid);
      
      // Also add current user UID to friend's list to make it mutual and fun!
      await addFriendToUser(friendUid, user.uid);

      setSearchEmail("");
      setSearchResult(null);
      await refreshFriendsList(user.uid);
    } catch (err) {
      console.error("Error adding friend:", err);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleRemoveFriend = async (friendUid: string) => {
    if (!user) return;
    setFriendActionLoading(true);
    try {
      await removeFriendFromUser(user.uid, friendUid);
      // Remove from mutual as well
      await removeFriendFromUser(friendUid, user.uid);
      
      await refreshFriendsList(user.uid);
    } catch (err) {
      console.error("Error removing friend:", err);
    } finally {
      setFriendActionLoading(false);
    }
  };

  // Convert milliseconds to readable lap time
  const formatTime = (timeMs: number) => {
    if (!timeMs) return "--:--.--";
    const totalSeconds = timeMs / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto w-full text-slate-200 py-4" id="profile-friends-center">
      {/* LEFT PANEL: AUTHENTICATION OR PROFILE GENERAL INFO */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        {authLoading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[350px]">
            <Loader className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
            <p className="text-slate-400 text-sm">Уншиж байна...</p>
          </div>
        ) : !user ? (
          /* AUTH FORM (SIGN IN / SIGN UP) */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden"
          >
            {/* Ambient indicator */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-emerald-500 via-emerald-400 to-cyan-500" />
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                  {isSignUp ? "Бүртгүүлэх" : "Нэвтрэх"}
                </h2>
                <p className="text-xs text-slate-500 font-medium">Apex Overload Driver Profile</p>
              </div>
            </div>

            {authError && (
              <div className="bg-red-950/40 border border-red-900/60 text-red-300 rounded-xl p-3.5 text-xs mb-4 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {isSignUp && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Жолоочийн нэр</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display Name (e.g. SpeedRacer)"
                      maxLength={16}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-all font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Имэйл хаяг</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="racer@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Нууц үг</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/10 active:scale-98 uppercase tracking-wider text-xs flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                {isSignUp ? "Бүртгэл Үүсгэх" : "Нэвтрэх"}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800/60"></div>
                <span className="flex-shrink mx-3 text-slate-500 text-[10px] uppercase tracking-widest font-black">Эсвэл</span>
                <div className="flex-grow border-t border-slate-800/60"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-black py-3 rounded-xl transition-all cursor-pointer shadow-md active:scale-98 uppercase tracking-wider text-xs flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                Google-ээр нэвтрэх
              </button>
            </form>

            <div className="mt-6 text-center border-t border-slate-800/80 pt-4">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError("");
                }}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-all"
              >
                {isSignUp ? "Аль хэдийн бүртгэлтэй юу? Нэвтрэх" : "Шинэ хэрэглэгч үү? Бүртгүүлэх"}
              </button>
            </div>
          </motion.div>
        ) : (
          /* LOGGED IN USER PROFILE DETAIL CARD */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden"
          >
            {/* Ambient indicator */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-emerald-500 via-teal-400 to-cyan-500" />

            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/5">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white leading-tight uppercase">
                    {user.displayName || "Racer"}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium tracking-wide truncate max-w-[180px]">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-800/80 transition-all cursor-pointer active:scale-95"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Account Quick Stats */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 space-y-3.5 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">Хэрэглэгчийн ID</span>
                <span className="font-mono text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                  {user.uid.slice(0, 10)}...
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-slate-900 pt-3">
                <span className="text-slate-400 font-bold">Нийт Зоос (Coins)</span>
                <span className="font-mono text-sm font-black text-amber-400">{coins}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-slate-900 pt-3">
                <span className="text-slate-400 font-bold">Нээсэн Машинууд</span>
                <span className="font-mono text-sm font-black text-teal-400">{unlockedCarIds.length} / 7</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/40 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2.5">
              <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <p>
                Таны тоглоомын амжилт болон тохиргоонууд Firebase Firestore үүлэн санд найдвартай хадгалагдаж байна. Дараа өөр төхөөрөмжөөс ороход таны мэдээлэл яг гарсан үеийнхээрээ сэргэх болно.
              </p>
            </div>
          </motion.div>
        )}

        {/* BEST RECORDS WIDGET */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-emerald-400 animate-pulse" /> Миний шилдэг хугацаанууд
          </h3>
          <div className="space-y-3">
            {Object.entries(trackNames).map(([trackId, trackName]) => {
              const recordTime = bestTimes[trackId];
              return (
                <div
                  key={trackId}
                  className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-slate-800/50 hover:border-slate-800 transition-all text-xs"
                >
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {trackName}
                  </span>
                  <span className={`font-mono font-bold ${recordTime ? "text-emerald-400" : "text-slate-600"}`}>
                    {recordTime ? formatTime(recordTime) : "Амжилт байхгүй"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: FRIENDS MANAGEMENT & LIST */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        {!user ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[350px]">
            <Users className="w-12 h-12 text-slate-600 mb-4" />
            <h3 className="text-base font-bold text-slate-300 uppercase tracking-tight">Найзын систем</h3>
            <p className="text-slate-500 text-xs mt-1.5 max-w-sm leading-relaxed mx-auto">
              Бусад тоглогчдоо найзаар нэмэх, тэдний хамгийн сайн цаг хугацаануудыг харах, амжилтыг нь эвдэхээр уралдахын тулд эхлээд системд бүртгүүлж, нэвтэрнэ үү.
            </p>
          </div>
        ) : (
          /* FRIENDS SYSTEM INSIDE USER SESSION */
          <>
            {/* ADD FRIEND BOX */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md relative overflow-hidden">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-emerald-400" /> Шинэ найз нэмэх
              </h3>
              <p className="text-slate-500 text-xs mb-4">
                Найзынхаа бүртгэлтэй имэйл хаягийг хайж олоод найзаар нэмээрэй.
              </p>

              <form onSubmit={handleSearchFriend} className="flex gap-2.5 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="Найзын имэйл хаяг (e.g. bold@example.com)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-slate-800 disabled:text-slate-600"
                >
                  {searchLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Хайх
                </button>
              </form>

              {searchError && (
                <div className="text-red-400 text-xs font-semibold bg-red-950/20 border border-red-900/30 p-2.5 rounded-xl">
                  {searchError}
                </div>
              )}

              {searchResult && (
                <div className="flex items-center justify-between p-4 bg-emerald-950/10 border border-emerald-900/30 rounded-xl mt-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                      {searchResult.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-200">{searchResult.displayName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{searchResult.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddFriend(searchResult.uid)}
                    disabled={friendActionLoading}
                    className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black rounded-lg transition-all cursor-pointer active:scale-95 disabled:bg-slate-800 disabled:text-slate-600"
                  >
                    Найз нэмэх
                  </button>
                </div>
              )}
            </div>

            {/* FRIENDS LIST CONTAINER */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex-1 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" /> Миний найзууд ({friendProfiles.length})
                </h3>
                <button
                  onClick={() => user && refreshFriendsList(user.uid)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-all bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg"
                >
                  Шинэчлэх
                </button>
              </div>

              {friendsLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12">
                  <Loader className="w-7 h-7 text-emerald-400 animate-spin mb-3" />
                  <p className="text-slate-500 text-xs font-medium">Найзуудын жагсаалтыг уншиж байна...</p>
                </div>
              ) : friendProfiles.length === 0 ? (
                <div className="flex-1 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-12 text-center text-slate-600">
                  <Users className="w-10 h-10 mb-3 text-slate-700" />
                  <p className="text-xs font-bold text-slate-500">Найзуудын жагсаалт хоосон байна</p>
                  <p className="text-[11px] max-w-xs mt-1 leading-relaxed">
                    Дээрх имэйл хаягаар хайх хэсэгт найзуудынхаа бүртгэлтэй хаягийг оруулан нэмж, тэдний амжилтуудыг хараарай!
                  </p>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto max-h-[450px] pr-1">
                  {friendProfiles.map((friend) => (
                    <div
                      key={friend.uid}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3.5 hover:border-slate-700/60 transition-all"
                    >
                      {/* Friend profile details */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-black text-xs uppercase shadow-inner">
                              {friend.displayName ? friend.displayName.slice(0, 2) : "RC"}
                            </div>
                            {/* Online badge */}
                            <span
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                                friend.onlineStatus === "online" ? "bg-emerald-500 shadow shadow-emerald-500/50" : "bg-slate-500"
                              }`}
                              title={friend.onlineStatus === "online" ? "Онлайн" : "Офлайн"}
                            />
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                              {friend.displayName}
                              {friend.onlineStatus === "online" && (
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-900/60 px-1.5 py-0.2 rounded-md">
                                  ONLINE
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">{friend.email}</div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveFriend(friend.uid)}
                          disabled={friendActionLoading}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                          title="Найзаас хасах"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Best record comparisons */}
                      <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/50 text-[10px]">
                        <span className="font-bold text-slate-400 block mb-2 uppercase tracking-widest text-[9px]">
                          🏆 Найзын шилдэг амжилтууд
                        </span>
                        <div className="grid grid-cols-2 gap-2 font-mono">
                          {Object.entries(trackNames).map(([trackId, trackName]) => {
                            const friendTime = friend.bestTimes ? friend.bestTimes[trackId] : 0;
                            const myTime = bestTimes[trackId] || 0;
                            const isFriendBetter = friendTime && (!myTime || friendTime < myTime);

                            return (
                              <div
                                key={trackId}
                                className="flex flex-col gap-0.5 bg-slate-950/60 p-2 rounded border border-slate-900"
                              >
                                <span className="text-[8px] text-slate-500 font-sans font-medium truncate">
                                  {trackName}
                                </span>
                                <div className="flex items-center justify-between mt-1">
                                  <span className={`font-semibold ${friendTime ? "text-slate-300" : "text-slate-600"}`}>
                                    {friendTime ? formatTime(friendTime) : "--:--"}
                                  </span>
                                  {friendTime > 0 && (
                                    <button
                                      onClick={() => onSelectTrackAndStart(trackId)}
                                      className="p-1 rounded bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 transition-all cursor-pointer"
                                      title="Найзын амжилтыг эвдэхээр уралдах"
                                    >
                                      <Play className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Inline custom CheckCircle svg replacement as a safety fallback
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
