
"use client";

import { useState, useEffect } from "react";
import LoginForm from "@/components/login-form";
import Dashboard from "@/components/dashboard";
import LogoutOverlay from "@/components/logout-overlay";
import LoginOverlay from "@/components/login-overlay";
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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggingIn(true);
    setTimeout(() => {
      setIsLoggedIn(true);
      setIsLoggingIn(false);
    }, 2500); // Match animation duration
  };

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
  
  const showDashboard = isLoggedIn && !isLoggingIn && !isLoggingOut;
  const showLogin = !isLoggedIn && !isLoggingIn && !isLoggingOut;

  return (
    <FirebaseProvider>
      <main className={cn("min-h-screen font-sans", showDashboard ? "dark dashboard-bg" : "bg-background")}>
        {isLoggingOut && <LogoutOverlay />}
        {isLoggingIn && <LoginOverlay />}
        
        <div style={{ display: isLoggingIn || isLoggingOut ? 'none' : 'block' }}>
          {showDashboard ? (
            <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden p-4 sm:p-6">
              <div className="relative z-10 w-full">
                <Dashboard onLogout={handleLogout} />
              </div>
            </div>
          ) : (
             <LoginForm onLoginSuccess={handleLoginSuccess} />
          )}
        </div>
      </main>
    </FirebaseProvider>
  );
}
