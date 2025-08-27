
"use client";

import { useState, useEffect } from "react";
import LoginForm from "@/components/login-form";
import Dashboard from "@/components/dashboard";
import LogoutOverlay from "@/components/logout-overlay";
import { FirebaseProvider } from "@/lib/firebase/context";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON = (
    <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-md space-y-4 p-8">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full mt-4" />
        </div>
    </div>
);

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      setIsLoggedIn(false);
      setIsLoggingOut(false);
    }, 2500); // Match animation duration
  };

  if (!isClient) {
    return SKELETON;
  }

  return (
    <FirebaseProvider>
      <main className={cn("min-h-screen font-sans", isLoggedIn && !isLoggingOut ? "dark dashboard-bg" : "bg-background")}>
        {isLoggingOut && <LogoutOverlay />}
        
        <div style={{ display: isLoggingOut ? 'none' : 'block' }}>
          {isLoggedIn ? (
            <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden p-4 sm:p-6">
              <div className="relative z-10 w-full">
                <Dashboard onLogout={handleLogout} />
              </div>
            </div>
          ) : (
            <LoginForm onLoginSuccess={() => setIsLoggedIn(true)} />
          )}
        </div>
      </main>
    </FirebaseProvider>
  );
}
