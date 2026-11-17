"use client";

import { useState, useEffect } from "react";
import LoginForm from "@/components/login-form";
import Dashboard from "@/components/dashboard";
import LogoutOverlay from "@/components/logout-overlay";
import LoginOverlay from "@/components/login-overlay";
import GuestLoadingOverlay from "@/components/guest-loading-overlay";
import { FirebaseProvider } from "@/lib/firebase/context";
import { cn } from "@/lib/utils";
import RoleSelection from "@/components/role-selection";
import GuestPage from "@/components/guest-page";

export default function HomePageClient() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isGuestLoggingIn, setIsGuestLoggingIn] = useState(false);
  const [userRole, setUserRole] = useState<"admin" | "guest" | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    try {
      const saved = localStorage.getItem("gi_current_role");
      if (saved === "admin" || saved === "guest") {
        setUserRole(saved);
      }
    } catch {}
  }, []);

  const handleRoleSelect = (role: "admin" | "guest") => {
    if (role === "guest") {
      setIsGuestLoggingIn(true);
      setTimeout(() => {
        setUserRole("guest");
        setIsGuestLoggingIn(false);
        if (typeof window !== "undefined") {
          localStorage.setItem("gi_current_role", "guest");
        }
      }, 700);
      return;
    }
    setUserRole(role);
    if (typeof window !== "undefined") {
      localStorage.setItem("gi_current_role", role);
    }
  };

  const handleLoginSuccess = () => {
    setIsLoggingIn(true);
    setTimeout(() => {
      setIsLoggedIn(true);
      setIsLoggingIn(false);
    }, 1500);
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem("gi_current_role");
    }
    setTimeout(() => {
      setIsLoggedIn(false);
      setIsLoggingOut(false);
      setUserRole(null);
    }, 1500);
  };

  const handleBackToRoleSelection = () => {
    setUserRole(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("gi_current_role");
    }
  };

  const showDashboard = isLoggedIn && !isLoggingIn && !isLoggingOut && userRole === "admin";

  const renderContent = () => {
    if (!hasMounted) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[#090D16]" suppressHydrationWarning>
          <div className="w-12 h-12 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        </div>
      );
    }
    if (showDashboard) {
      return (
        <div className="relative z-10 flex flex-col items-stretch min-h-screen overflow-y-auto p-2 sm:p-4 md:p-6 xl:p-8 w-full" suppressHydrationWarning>
          <Dashboard onLogout={handleLogout} userRole="admin" />
        </div>
      );
    }
    if (!userRole) {
      return <RoleSelection onRoleSelect={handleRoleSelect} />;
    }
    if (userRole === "admin") {
      return <LoginForm onLoginSuccess={handleLoginSuccess} onBack={handleBackToRoleSelection} />;
    }
    if (userRole === "guest") {
      return <GuestPage onBack={handleBackToRoleSelection} />;
    }
    return null;
  };

  return (
    <FirebaseProvider>
      <main
        className={cn(
          "min-h-screen font-sans",
          showDashboard ? "dark hero-shapes-bg" : "bg-background"
        )}
        suppressHydrationWarning
      >
        {isLoggingOut && <LogoutOverlay />}
        {isLoggingIn && <LoginOverlay />}
        {isGuestLoggingIn && <GuestLoadingOverlay />}

        {showDashboard && (
          <ul className="shapes-container" suppressHydrationWarning>
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

        <div
          className={cn(
            "transition-opacity duration-500",
            isLoggingIn || isLoggingOut || isGuestLoggingIn ? "opacity-0" : "opacity-100"
          )}
          suppressHydrationWarning
        >
          {renderContent()}
        </div>
      </main>
    </FirebaseProvider>
  );
}
