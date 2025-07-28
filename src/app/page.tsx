"use client";

import { useState } from "react";
import LoginForm from "@/components/login-form";
import Dashboard from "@/components/dashboard";
import { FirebaseProvider } from "@/lib/firebase/context";
import { cn } from "@/lib/utils";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  return (
    <FirebaseProvider>
      <main
        className={cn(
          "min-h-screen font-sans",
          isLoggedIn
            ? "bg-[#0a192f] text-foreground"
            : "text-foreground bg-background"
        )}
      >
        {isLoggedIn ? (
          <div className="relative p-4 sm:p-6 overflow-hidden">
             <div className="absolute inset-0 bg-grid-slate-700/[0.04] bg-[10px_10px] [mask-image:linear-gradient(0deg,#000000,transparent)]"></div>
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0a192f]"></div>
            <div className="relative z-10">
                <Dashboard onLogout={handleLogout} />
            </div>
          </div>
        ) : (
          <LoginForm onLoginSuccess={() => setIsLoggedIn(true)} />
        )}
      </main>
    </FirebaseProvider>
  );
}
