
"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesSection from "@/components/sales-section";
import CommissionsSection from "@/components/commissions-section";
import PricingCalculator from "@/components/pricing-calculator";
import RemindersSection from "@/components/reminders-section";
import { useFirebase } from "@/lib/firebase/context";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import type { Commission, Sale } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const { db, user, loading: userLoading } = useFirebase();
  const { toast } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchAllData = useCallback(async () => {
    if (!db || !user) return;
    setLoadingData(true);
    try {
      // Fetch commissions
      const commissionsCollectionRef = collection(db, "commissions");
      const q = query(commissionsCollectionRef, orderBy("date", "desc"));
      const commissionsSnapshot = await getDocs(q);
      const commissionsData: Commission[] = commissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Commission[];
      setCommissions(commissionsData);

      // Fetch sales
      const salesCollectionRef = collection(db, "sales");
      const salesQuery = query(salesCollectionRef, orderBy("dateStart", "desc"));
      const salesSnapshot = await getDocs(salesQuery);
      let salesData = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[];
      salesData = salesData.filter(sale => sale.dateStart);
      
      setSales(salesData);

    } catch (err: any) {
      console.error("Error fetching data:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load data. Details: ${err.message}`,
        duration: 9000,
      });
    } finally {
      setLoadingData(false);
    }
  }, [db, user, toast]);

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, fetchAllData]);

  if (userLoading) {
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
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-wider bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">
          Gadget Installment Management
        </h1>
        {user && (
          <div className="flex items-center justify-center gap-3 text-sm text-slate-400 mt-4">
             <Avatar>
              <AvatarImage src="https://images.unsplash.com/photo-1596629040517-2f0b5b853834?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw4fHxiYWJ5JTIwYm95fGVufDB8fHx8MTc1Mzg5Njg3Mnww&ixlib=rb-4.1.0&q=80&w=1080" alt="User Avatar" data-ai-hint="person user" />
              <AvatarFallback>CT</AvatarFallback>
            </Avatar>
            <span>Logged in as: <span className="bg-cyan-900/50 px-2 py-1 rounded-md text-cyan-300 font-semibold">Cirannakorn Tudlasan</span></span>
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
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-4 h-auto sm:h-12 mb-8 bg-slate-800/60 border border-slate-700 text-cyan-300">
          <TabsTrigger value="sales" className="py-3 text-base data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">Sales & Installments</TabsTrigger>
          <TabsTrigger value="commissions" className="py-3 text-base data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">Commissions & Expenses</TabsTrigger>
          <TabsTrigger value="pricing" className="py-3 text-base data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">Pricing Calculator</TabsTrigger>
          <TabsTrigger value="reminders" className="py-3 text-base data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">Reminders</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
            <div className={futuristicBgClasses}>
                <div className="relative z-10">
                    <SalesSection sales={sales} loading={loadingData} onDataChange={fetchAllData} />
                </div>
            </div>
        </TabsContent>
        <TabsContent value="commissions">
             <div className={futuristicBgClasses}>
                <div className="relative z-10">
                    <CommissionsSection commissions={commissions} sales={sales} loading={loadingData} onDataChange={fetchAllData} />
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
        <TabsContent value="reminders">
            <div className={futuristicBgClasses}>
                <div className="relative z-10">
                    <RemindersSection sales={sales} loading={loadingData} />
                </div>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
