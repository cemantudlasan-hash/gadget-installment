
"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesSection from "@/components/sales-section";
import CommissionsSection from "@/components/commissions-section";
import PricingCalculator from "@/components/pricing-calculator";
import RemindersSection from "@/components/reminders-section";
import GadgetPostsSection from "@/components/gadget-posts-section";
import InboxSection from "@/components/inbox-section"; // New Import
import { useFirebase } from "@/lib/firebase/context";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LogOut, Package, Inbox } from "lucide-react";
import { collection, getDocs, orderBy, query, doc, updateDoc, where, onSnapshot } from "firebase/firestore";
import type { Commission, Sale, GadgetPost, Inquiry } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DashboardProps {
  onLogout: () => void;
  userRole: 'admin' | 'guest';
}

export default function Dashboard({ onLogout, userRole }: DashboardProps) {
  const { db, user, loading: userLoading } = useFirebase();
  const { toast } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [gadgetPosts, setGadgetPosts] = useState<GadgetPost[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  const fetchAllData = useCallback(async () => {
    if (!db) return;
    setLoadingData(true);
    try {
      // This function can be expanded to fetch other collections as needed
      const collections = {
        commissions: collection(db, "commissions"),
        sales: collection(db, "sales"),
        gadgetPosts: collection(db, "gadgetPosts"),
      };

      const [commissionsSnapshot, salesSnapshot, postsSnapshot] = await Promise.all([
        getDocs(query(collections.commissions, orderBy("date", "desc"))),
        getDocs(query(collections.sales, orderBy("dateStart", "desc"))),
        getDocs(query(collections.gadgetPosts, orderBy("createdAt", "desc"))),
      ]);
      
      const commissionsData = commissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Commission[];
      const salesData = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(sale => sale.dateStart) as Sale[];
      const postsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GadgetPost[];
      
      setCommissions(commissionsData);
      setSales(salesData);
      setGadgetPosts(postsData);

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
  }, [db, toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (!db) return;
    const inquiriesQuery = query(collection(db, "inquiries"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(inquiriesQuery, (snapshot) => {
        const inquiriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Inquiry[];
        setInquiries(inquiriesData);
        const unread = inquiriesData.filter(inq => !inq.isRead).length;
        setUnreadCount(unread);
    }, (error) => {
        console.error("Error fetching inquiries:", error);
        toast({
            variant: "destructive",
            title: "Inbox Error",
            description: "Could not fetch new inquiries.",
        });
    });

    return () => unsubscribe();
  }, [db, toast]);
  
  const handleUpdateSale = async (saleId: string, updatedData: Partial<Sale>) => {
    if (!db) return;
    if (userRole === 'guest') {
        toast({variant: "destructive", title: "Read-only Access", description: "Guests are not allowed to make changes."});
        return;
    }
    try {
      const saleRef = doc(db, "sales", saleId);
      await updateDoc(saleRef, updatedData);
      fetchAllData();
    } catch (e: any) {
      console.error("Error updating sale:", e);
      toast({
        variant: "destructive",
        title: "Update Error",
        description: `Could not update sale: ${e.message}`,
      });
    }
  };

  const handleUpdateInquiry = async (inquiryId: string, updatedData: Partial<Inquiry>) => {
    if (!db || userRole !== 'admin') return;
    try {
        const inquiryRef = doc(db, "inquiries", inquiryId);
        await updateDoc(inquiryRef, updatedData);
        // No toast needed for marking as read/unread to avoid being noisy
    } catch (e: any) {
        console.error("Error updating inquiry:", e);
        toast({ variant: "destructive", title: "Update Error", description: `Could not update inquiry: ${e.message}` });
    }
  }


  if (userLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 sm:p-8 space-y-8">
        <Skeleton className="h-10 w-1/3 mx-auto" />
        <Skeleton className="h-8 w-1/4 mx-auto" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const getWelcomeMessage = () => {
    if (userRole === 'admin') {
        return "Cirannakorn Tudlasan";
    }
    return "Guest";
  };
  
  const getAvatarFallback = () => {
    if (userRole === 'admin') {
        return "CT";
    }
    return "G";
  }

  return (
    <div className="max-w-7xl mx-auto bg-transparent p-0 w-full">
      <div className="text-center mb-8 relative">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-wider bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">
          Gadget Installment Management
        </h1>
        {user && (
          <div className="flex items-center justify-center gap-3 text-sm text-slate-400 mt-4">
             <Avatar>
              <AvatarImage src={userRole === 'admin' ? "https://images.unsplash.com/photo-1596629040517-2f0b5b853834?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw4fHxiYWJ5JTIwYm95fGVufDB8fHx8MTc1Mzg5Njg3Mnww&ixlib=rb-4.1.0&q=80&w=1080" : ''} alt="User Avatar" data-ai-hint="person user" />
              <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
            </Avatar>
            <span>Logged in as: <span className="bg-cyan-900/50 px-2 py-1 rounded-md text-cyan-300 font-semibold">{getWelcomeMessage()}</span></span>
          </div>
        )}
        <Button onClick={onLogout} variant="outline" size="icon" className="absolute top-0 right-0 bg-transparent border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900">
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Logout</span>
        </Button>
      </div>

      <div className="text-center text-xs text-slate-400 mb-8">
            <p>AI powered @Firebase</p>
            <p>Created and Idea by: Ceman Dejamo Tudlasan</p>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="flex flex-wrap items-center justify-center gap-2 p-2 mb-8 bg-slate-800/60 border border-slate-700 text-cyan-300 rounded-lg">
          <TabsTrigger value="sales" className="py-2 px-4 h-auto text-sm sm:text-base whitespace-normal data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">Sales & Installments</TabsTrigger>
          <TabsTrigger value="commissions" className="py-2 px-4 h-auto text-sm sm:text-base whitespace-normal data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">Commissions & Expenses</TabsTrigger>
          <TabsTrigger value="pricing" className="py-2 px-4 h-auto text-sm sm:text-base whitespace-normal data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">Pricing Calculator</TabsTrigger>
          <TabsTrigger value="reminders" className="py-2 px-4 h-auto text-sm sm:text-base whitespace-normal data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">Reminders</TabsTrigger>
          <TabsTrigger value="gadget-posts" className="py-2 px-4 h-auto text-sm sm:text-base whitespace-normal data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md">
            <Package className="mr-2" /> Gadget Posts
          </TabsTrigger>
          <TabsTrigger value="inbox" className="py-2 px-4 h-auto text-sm sm:text-base whitespace-normal data-[state=active]:bg-cyan-600/80 data-[state=active]:text-cyan-50 data-[state=active]:shadow-md relative">
            <Inbox className="mr-2" /> Inbox
            {unreadCount > 0 && <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">{unreadCount}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesSection sales={sales} loading={loadingData} onDataChange={fetchAllData} onUpdateSale={handleUpdateSale} userRole={userRole} />
        </TabsContent>
        <TabsContent value="commissions">
          <CommissionsSection commissions={commissions} sales={sales} loading={loadingData} onDataChange={fetchAllData} userRole={userRole}/>
        </TabsContent>
        <TabsContent value="pricing">
          <PricingCalculator />
        </TabsContent>
        <TabsContent value="reminders">
          <RemindersSection sales={sales} commissions={commissions} loading={loadingData} onDataChange={fetchAllData} onUpdateSale={handleUpdateSale} userRole={userRole} />
        </TabsContent>
        <TabsContent value="gadget-posts">
          <GadgetPostsSection posts={gadgetPosts} loading={loadingData} onDataChange={fetchAllData} userRole={userRole} />
        </TabsContent>
        <TabsContent value="inbox">
          <InboxSection inquiries={inquiries} loading={loadingData} onUpdateInquiry={handleUpdateInquiry} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
