
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "./config";

interface FirebaseContextType {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  storage: FirebaseStorage | null;
  user: User | null;
  loading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<FirebaseApp | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [storage, setStorage] = useState<FirebaseStorage | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apps = getApps();
    const firebaseApp = apps.length ? apps[0] : initializeApp(firebaseConfig);
    const firebaseAuth = getAuth(firebaseApp);
    const firestoreDb = getFirestore(firebaseApp);
    const firebaseStorage = getStorage(firebaseApp);

    setApp(firebaseApp);
    setAuth(firebaseAuth);
    setDb(firestoreDb);
    setStorage(firebaseStorage);
    setLoading(false); // Allow components to render immediately with app/db instances

    signInAnonymously(firebaseAuth).catch((error) => {
      console.error("Anonymous sign-in error", error);
    });

    const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
      // User state is now managed separately from the main loading state
    });

    return () => unsubscribe();
  }, []);

  const value = { app, auth, db, storage, user, loading };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = (): FirebaseContextType => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
};
