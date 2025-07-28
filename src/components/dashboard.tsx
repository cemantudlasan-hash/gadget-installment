
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesSection from "@/components/sales-section";
import CommissionsSection from "@/components/commissions-section";
import PricingCalculator from "@/components/pricing-calculator";
import { useFirebase } from "@/lib/firebase/context";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const { user, loading } = useFirebase();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto bg-card rounded-2xl shadow-2xl p-6 sm:p-8 border space-y-8">
        <Skeleton className="h-10 w-1/3 mx-auto" />
        <Skeleton className="h-8 w-1/4 mx-auto" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const futuristicBgClasses = "relative overflow-hidden bg-transparent font-sans p-0 rounded-2xl";

  return (
    <div className="max-w-7xl mx-auto bg-transparent p-0">
      <div className="text-center mb-8 relative">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-cyan-300">
          Gadget Installment Management
        </h1>
        {user && (
          <div className="text-center text-sm text-slate-400 mt-4">
            Logged in as: <span className="bg-cyan-900/50 px-2 py-1 rounded-md text-cyan-300 font-semibold">Cirannakorn Tudlasan</span>
          </div>
        )}
        <Button onClick={onLogout} variant="outline" size="icon" className="absolute top-0 right-0 bg-transparent border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900">
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Logout</span>
        </Button>
      </div>

      <div className="text-center text-xs text-slate-500 mb-8">
            <p>AI powered @Firebase</p>
            <p>Created and Idea by: Ceman Dejamo Tudlasan</p>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto sm:h-12 mb-8 bg-slate-800/60 border border-slate-700 text-cyan-300">
          <TabsTrigger value="sales" className="py-3 text-base data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">Sales & Installments</TabsTrigger>
          <TabsTrigger value="commissions" className="py-3 text-base data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">Commissions & Expenses</TabsTrigger>
          <TabsTrigger value="pricing" className="py-3 text-base data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">Pricing Calculator</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
            <div className={futuristicBgClasses}>
                <div className="relative z-10">
                    <SalesSection />
                </div>
            </div>
        </TabsContent>
        <TabsContent value="commissions">
             <div className={futuristicBgClasses}>
                <div className="relative z-10">
                    <CommissionsSection />
                </div>
            </div>
        </TabsContent>
        <TabsContent value="pricing">
            <div className={futuristicBgClasses}>
                <div className="relative z-10">
                    <PricingCalculator />
                </div>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
