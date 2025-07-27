"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesSection from "@/components/sales-section";
import CommissionsSection from "@/components/commissions-section";
import PricingCalculator from "@/components/pricing-calculator";
import { useFirebase } from "@/lib/firebase/context";

export default function Dashboard() {
  const { user } = useFirebase();

  return (
    <div className="max-w-7xl mx-auto bg-card rounded-2xl shadow-2xl p-6 sm:p-8 border">
      <div className="text-center mb-8">
        <p className="text-sm text-muted-foreground mb-1">
          Created and Idea by: <span className="font-semibold text-primary">Ceman Dejamo Tudlasan</span>, Powered By AI.
        </p>
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
