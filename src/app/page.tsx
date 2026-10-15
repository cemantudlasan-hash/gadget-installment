
"use client";

import { useState, useEffect } from "react";
import LoginForm from "@/components/login-form";
import Dashboard from "@/components/dashboard";
import LogoutOverlay from "@/components/logout-overlay";
import LoginOverlay from "@/components/login-overlay";
import GuestLoadingOverlay from "@/components/guest-loading-overlay";
import { FirebaseProvider } from "@/lib/firebase/context";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import RoleSelection from "@/components/role-selection";
import GuestPage from "@/components/guest-page";

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
  const [isGuestLoggingIn, setIsGuestLoggingIn] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [userRole, setUserRole] = useState<"admin" | "guest" | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const handleRoleSelect = (role: "admin" | "guest") => {
    setUserRole(role);
    // Instant switch to guest without artificial 1.5s delay
  };

  const handleLoginSuccess = () => {
    setIsLoggingIn(true);
    setTimeout(() => {
      setIsLoggedIn(true);
      setIsLoggingIn(false);
    }, 1500); // Match animation duration
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      setIsLoggedIn(false);
      setIsLoggingOut(false);
      setUserRole(null); // Reset role on logout
    }, 1500); // Match animation duration
  };
  
  const handleBackToRoleSelection = () => {
    setUserRole(null);
  };

  if (!isClient) {
    return SKELETON;
  }
  
  const showDashboard = isLoggedIn && !isLoggingIn && !isLoggingOut && userRole === 'admin';
  
  const renderContent = () => {
    if (showDashboard) {
      return (
         <div className="relative z-10 flex flex-col items-center min-h-screen overflow-y-auto p-4 sm:p-6">
           <Dashboard onLogout={handleLogout} userRole="admin" />
        </div>
      );
    }
    if (!userRole) {
      return <RoleSelection onRoleSelect={handleRoleSelect} />;
    }
    if (userRole === 'admin') {
      return <LoginForm onLoginSuccess={handleLoginSuccess} onBack={handleBackToRoleSelection} />;
    }
    if (userRole === 'guest') {
        return <GuestPage onBack={handleBackToRoleSelection} />;
    }
    return null; 
  };


  return (
    <FirebaseProvider>
      <main className={cn("min-h-screen font-sans", showDashboard ? "dark hero-shapes-bg" : "bg-background")}>
        {isLoggingOut && <LogoutOverlay />}
        {isLoggingIn && <LoginOverlay />}
        {isGuestLoggingIn && <GuestLoadingOverlay />}

        {showDashboard && (
          <ul className="shapes-container">
            <li className="shape-item"></li>
            <li className="shape-item"></li>
            <li className="shape-item"></li>
            <li className="shape-item"></li>
            <li className="shape-item"></li>
            <li className="shape-item"></li>
            <li className="shape-item"></li>
            <li className="shape-item"></li>
            <li className="shape-item"></li>
            <li className="shape-item"></li>
          </ul>
        )}
        
        <div className={cn("transition-opacity duration-500", (isLoggingIn || isLoggingOut || isGuestLoggingIn) ? 'opacity-0' : 'opacity-100')}>
          {renderContent()}
        </div>
      </main>
    </FirebaseProvider>
  );
}
    
