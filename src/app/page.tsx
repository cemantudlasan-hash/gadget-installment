
"use client";

import { useState, useEffect } from "react";
import LoginForm from "@/components/login-form";
import Dashboard from "@/components/dashboard";
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after the initial render.
    setIsClient(true);
  }, []);

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  // During server-side rendering and the initial client-side render,
  // isClient will be false, so we render a static skeleton.
  // This ensures the server and client have the same initial output.
  if (!isClient) {
    return SKELETON;
  }

  return (
    <FirebaseProvider>
        <main className={cn("min-h-screen font-sans", isLoggedIn ? "dark dashboard-bg" : "bg-background")}>
          {isLoggedIn ? (
            <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden p-4 sm:p-6">
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
