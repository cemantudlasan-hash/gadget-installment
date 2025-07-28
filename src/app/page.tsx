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
          !isLoggedIn && "text-foreground"
        )}
      >
        {isLoggedIn ? (
          <div 
            className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-cover bg-center bg-no-repeat p-4 sm:p-6"
            style={{ backgroundImage: "url(/background.jpg)" }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <div className="relative z-10 w-full">
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
