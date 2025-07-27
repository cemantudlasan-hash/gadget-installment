"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesSection from "@/components/sales-section";
import CommissionsSection from "@/components/commissions-section";
import PricingCalculator from "@/components/pricing-calculator";
import { useFirebase } from "@/lib/firebase/context";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
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

  return (
    <div className="max-w-7xl mx-auto bg-card rounded-2xl shadow-2xl p-6 sm:p-8 border">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-primary font-headline">
          Gadget Installment Management
        </h1>
        {user && (
          <div className="text-center text-sm text-muted-foreground mt-4 font-mono">
            Logged in as: <span className="bg-primary/10 px-2 py-1 rounded-md text-primary font-semibold">Cirannakorn Tudlasan</span>
          </div>
        )}
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto sm:h-12 mb-8">
          <TabsTrigger value="sales" className="py-3 text-base">Sales & Installments</TabsTrigger>
          <TabsTrigger value="commissions" className="py-3 text-base">Commissions & Expenses</TabsTrigger>
          <TabsTrigger value="pricing" className="py-3 text-base">Pricing Calculator</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesSection />
        </TabsContent>
        <TabsContent value="commissions">
          <CommissionsSection />
        </TabsContent>
        <TabsContent value="pricing">
          <PricingCalculator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
