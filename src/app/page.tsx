"use client";

import { useState } from "react";
import LoginForm from "@/components/login-form";
import Dashboard from "@/components/dashboard";
import { FirebaseProvider } from "@/lib/firebase/context";
import { cn } from "@/lib/utils";

const starryNightBg = {
  backgroundImage: "url('https://storage.googleapis.com/app-prototyper-media/yH7eA9y.jpeg')",
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
        style={isLoggedIn ? starryNightBg : {}}
      >
        {isLoggedIn ? (
          <div className="relative p-4 sm:p-6 overflow-hidden bg-black/50 min-h-screen">
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
