
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
import { LogOut, TerminalSquare } from "lucide-react";
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
       <Tabs defaultValue="sales" className="w-full">
        <header className="relative flex w-full flex-col items-center gap-4 mb-8 sm:flex-row sm:justify-center">
            <div className="flex items-center gap-3 sm:absolute sm:left-0">
                <div className="bg-slate-800/60 border border-slate-700 p-2 rounded-lg">
                    <TerminalSquare className="h-6 w-6 text-cyan-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-200 hidden sm:block">
                    Gadget Management
                </h1>
            </div>

            <div className="flex w-full justify-center">
                 <TabsList className="bg-slate-800/60 border border-slate-700 rounded-lg p-1 flex h-auto w-full flex-col justify-center gap-1 sm:w-auto sm:flex-row sm:gap-0">
                    <TabsTrigger value="sales" className="dashboard-tab w-full px-3 py-1.5 text-sm text-slate-300 transition-all duration-300 sm:w-auto">Sales</TabsTrigger>
                    <TabsTrigger value="commissions" className="dashboard-tab w-full px-3 py-1.5 text-sm text-slate-300 transition-all duration-300 sm:w-auto">Ledger</TabsTrigger>
                    <TabsTrigger value="pricing" className="dashboard-tab w-full px-3 py-1.5 text-sm text-slate-300 transition-all duration-300 sm:w-auto">Calculator</TabsTrigger>
                    <TabsTrigger value="reminders" className="dashboard-tab w-full px-3 py-1.5 text-sm text-slate-300 transition-all duration-300 sm:w-auto">Reminders</TabsTrigger>
                    <TabsTrigger value="gadget-posts" className="dashboard-tab w-full px-3 py-1.5 text-sm text-slate-300 transition-all duration-300 sm:w-auto">Posts</TabsTrigger>
                    <TabsTrigger value="inbox" className="dashboard-tab relative w-full px-3 py-1.5 text-sm text-slate-300 transition-all duration-300 sm:w-auto">
                        Inbox
                        {unreadCount > 0 && <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">{unreadCount}</span>}
                    </TabsTrigger>
                </TabsList>
            </div>

            <Button onClick={onLogout} variant="ghost" size="icon" className="absolute top-0 right-0 text-slate-400 hover:text-white sm:absolute sm:right-0">
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logout</span>
            </Button>
        </header>

        <div className="text-center mb-8">
            {user && (
                <div className="flex items-center justify-center gap-3 text-sm text-slate-400">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={userRole === 'admin' ? "https://images.unsplash.com/photo-1596629040517-2f0b5b853834?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw4fHxiYWJ5JTIwYm95fGVufDB8fHx8MTc1Mzg5Njg3Mnww&ixlib=rb-4.1.0&q=80&w=1080" : ''} alt="User Avatar" data-ai-hint="person user" />
                        <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
                    </Avatar>
                    <span>Logged in as: <span className="bg-cyan-900/50 px-2 py-1 rounded-md text-cyan-300 font-semibold">{getWelcomeMessage()}</span></span>
                </div>
            )}
            <p className="text-xs text-slate-500 mt-2">AI powered @Firebase | Created by: Ceman Dejamo Tudlasan</p>
        </div>
      
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
