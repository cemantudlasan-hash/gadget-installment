"use client";

import { useState } from "react";
import LoginForm from "@/components/login-form";
import Dashboard from "@/components/dashboard";
import { FirebaseProvider } from "@/lib/firebase/context";
import { cn } from "@/lib/utils";

const starryNightBg = {
  backgroundImage: "url('https://storage.googleapis.com/app-prototyper-media/eLKE6t5.jpeg')",
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};

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
          !isLoggedIn && "text-foreground bg-background"
        )}
      >
        {isLoggedIn ? (
          <div 
            className="relative p-4 sm:p-6 overflow-hidden min-h-screen"
            style={starryNightBg}
          >
            <div className="absolute inset-0 bg-black/50" />
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
