"use client";

import { useState } from "react";
import LoginForm from "@/components/login-form";
import Dashboard from "@/components/dashboard";
import { FirebaseProvider } from "@/lib/firebase/context";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <FirebaseProvider>
      <main className="min-h-screen font-sans text-foreground p-4 sm:p-6 bg-background">
        {isLoggedIn ? (
          <Dashboard />
        ) : (
          <LoginForm onLoginSuccess={() => setIsLoggedIn(true)} />
        )}
      </main>
    </FirebaseProvider>
  );
}
