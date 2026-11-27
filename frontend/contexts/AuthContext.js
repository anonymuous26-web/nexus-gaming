
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { auth, db } from "@/firebase";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const AuthContext = createContext(undefined);

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error(
      "useAuth() must be used inside AuthProvider. Check app/layout.js."
    );
  }

  return context;
}

export function AuthProvider({ children }) {
  // Marketplace profile: plain application data for the UI.
  const [currentUser, setCurrentUser] = useState(null);

  // Actual Firebase Auth User. Use this object to obtain ID tokens.
  const [firebaseUser, setFirebaseUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Prevent stale profile-loading requests from overwriting newer auth state.
  const authGeneration = useRef(0);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        const generation = ++authGeneration.current;

        if (!active) return;

        setAuthError(null);
        setFirebaseUser(user ?? null);

        if (!user) {
          setCurrentUser(null);
          setLoading(false);
          return;
        }

        // Immediately make basic account information available.
        // The Firebase User itself stays in firebaseUser.
        setCurrentUser({
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? "Player",
          photoURL: user.photoURL ?? "",
          wishlist: [],
          createdAt: null,
        });

        setLoading(true);

        try {
          const userRef = doc(db, "users", user.uid);
          const userSnapshot = await getDoc(userRef);

          if (
            !active ||
            generation !== authGeneration.current
          ) {
            return;
          }

          const profileData = userSnapshot.exists()
            ? userSnapshot.data()
            : {};

          const profile = {
            uid: user.uid,
            email: user.email ?? "",
            displayName:
              profileData.displayName ??
              user.displayName ??
              "Player",
            photoURL:
              profileData.photoURL ?? user.photoURL ?? "",
            wishlist: Array.isArray(profileData.wishlist)
              ? profileData.wishlist
              : [],
            createdAt: profileData.createdAt ?? null,
          };

          if (!userSnapshot.exists()) {
            await setDoc(userRef, {
              ...profile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            // Update basic profile fields without replacing the wishlist
            // or other unrelated profile data.
            await setDoc(
              userRef,
              {
                email: profile.email,
                displayName: profile.displayName,
                photoURL: profile.photoURL,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }

          if (
            active &&
            generation === authGeneration.current
          ) {
            setCurrentUser(profile);
          }
        } catch (error) {
          console.error("Failed to load user profile:", error);

          if (
            active &&
            generation === authGeneration.current
          ) {
            setAuthError(
              "You are signed in, but your profile could not be loaded. Check your connection and Firestore permissions."
            );

            // Keep the account usable for authentication-dependent
            // operations even if the Firestore profile is unavailable.
            setCurrentUser({
              uid: user.uid,
              email: user.email ?? "",
              displayName: user.displayName ?? "Player",
              photoURL: user.photoURL ?? "",
              wishlist: [],
              createdAt: null,
            });
          }
        } finally {
          if (
            active &&
            generation === authGeneration.current
          ) {
            setLoading(false);
          }
        }
      },
      (error) => {
        console.error(
          "Firebase authentication listener error:",
          error
        );

        if (active) {
          ++authGeneration.current;
          setAuthError(
            error.message || "Authentication failed."
          );
          setFirebaseUser(null);
          setCurrentUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      active = false;
      ++authGeneration.current;
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account",
    });

    try {
      const result = await signInWithPopup(auth, provider);

      // The auth-state listener will populate both context states.
      // Return the real Firebase User to callers that need it.
      return result.user;
    } catch (error) {
      if (error.code !== "auth/popup-closed-by-user") {
        console.error("Google sign-in failed:", error);
        setAuthError(
          error.message || "Google sign-in failed."
        );
      }

      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);

    try {
      await signOut(auth);
      setFirebaseUser(null);
      setCurrentUser(null);
    } catch (error) {
      console.error("Sign-out failed:", error);
      setAuthError(error.message || "Could not sign out.");
      throw error;
    }
  }, []);

  const updateWishlist = useCallback(
    async (gameId) => {
      if (!firebaseUser || !currentUser) {
        throw new Error(
          "Please sign in to manage your wishlist."
        );
      }

      if (
        typeof gameId !== "string" ||
        gameId.trim().length === 0
      ) {
        throw new Error("A valid game ID is required.");
      }

      const userRef = doc(db, "users", firebaseUser.uid);

      try {
        const updatedWishlist = await runTransaction(
          db,
          async (transaction) => {
            const userSnapshot = await transaction.get(userRef);

            if (!userSnapshot.exists()) {
              throw new Error(
                "Your user profile could not be found."
              );
            }

            const userData = userSnapshot.data();
            const existingWishlist = Array.isArray(
              userData.wishlist
            )
              ? userData.wishlist
              : [];

            const nextWishlist = existingWishlist.includes(gameId)
              ? existingWishlist.filter((id) => id !== gameId)
              : [...existingWishlist, gameId];

            transaction.update(userRef, {
              wishlist: nextWishlist,
              updatedAt: serverTimestamp(),
            });

            return nextWishlist;
          }
        );

        setCurrentUser((previousUser) => {
          if (!previousUser) return previousUser;

          return {
            ...previousUser,
            wishlist: updatedWishlist,
          };
        });

        return updatedWishlist;
      } catch (error) {
        console.error("Wishlist update failed:", error);
        throw error;
      }
    },
    [firebaseUser, currentUser]
  );

  // Central helper for requests that need a Firebase ID token.
  const getIdToken = useCallback(
    async (forceRefresh = false) => {
      if (!firebaseUser) {
        throw new Error(
          "Please sign in before continuing."
        );
      }

      return firebaseUser.getIdToken(forceRefresh);
    },
    [firebaseUser]
  );

  const value = useMemo(
    () => ({
      currentUser,
      firebaseUser,
      loading,
      authError,
      loginWithGoogle,
      logout,
      updateWishlist,
      getIdToken,
    }),
    [
      currentUser,
      firebaseUser,
      loading,
      authError,
      loginWithGoogle,
      logout,
      updateWishlist,
      getIdToken,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
