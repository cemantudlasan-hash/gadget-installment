
"use client";

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Store, Contact, Smartphone, Mail, Phone } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { useFirebase } from '@/lib/firebase/context';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import type { GadgetPost } from '@/types';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface GuestPageProps {
  onBack: () => void;
}

const BackgroundOrbs = () => (
    <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-50px] left-[-50px] w-72 h-72 bg-purple-500 rounded-full filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-[-20px] right-[20px] w-72 h-72 bg-blue-500 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-50px] left-[20%] w-72 h-72 bg-cyan-500 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-[-20px] right-[-50px] w-72 h-72 bg-pink-500 rounded-full filter blur-3xl opacity-10 animate-blob animation-delay-6000"></div>
    </div>
);

export default function GuestPage({ onBack }: GuestPageProps) {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [posts, setPosts] = useState<GadgetPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const postsRef = collection(db, "gadgetPosts");
      const q = query(postsRef, where("isSold", "==", false), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const postsData = snapshot.docs.map(doc => doc.data() as GadgetPost);
      setPosts(postsData);
    } catch (e: any) {
      console.error("Error fetching gadget posts:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch available gadgets.",
      });
    } finally {
      setLoading(false);
    }
  }, [db, toast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden bg-slate-900 text-white p-4 sm:p-6 md:p-8">
      <BackgroundOrbs />
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div className="text-center flex-grow">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-wider bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">
              Available Gadgets
            </h1>
            <p className="mt-2 text-lg text-slate-300">Browse our latest products available for cash or installment.</p>
          </div>
          <Button
            onClick={onBack}
            variant="outline"
            className="text-lg py-3 px-6 font-semibold bg-transparent hover:bg-slate-700/50 border-slate-600 text-slate-300 rounded-md transition-all duration-300 absolute top-0 left-0"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back
          </Button>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-white/5 backdrop-blur-md border-white/10 overflow-hidden">
                <Skeleton className="h-56 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-white/5 backdrop-blur-md rounded-2xl">
            <Store className="mx-auto h-16 w-16 text-cyan-400 mb-4" />
            <h2 className="text-3xl font-bold">No Gadgets Available</h2>
            <p className="text-slate-300 mt-2">Please check back later for new products!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map(post => (
              <Card key={post.id} className="bg-white/5 backdrop-blur-md border-white/10 overflow-hidden flex flex-col transform hover:-translate-y-2 transition-transform duration-300 shadow-lg hover:shadow-cyan-500/20">
                <div className="relative w-full h-56">
                    <Image src={post.imageUrl} alt={post.productName} layout="fill" objectFit="cover" className="bg-slate-800" />
                    {!post.isSold && <Badge className="absolute top-2 right-2 bg-cyan-500 text-black">Available</Badge>}
                </div>
                <CardHeader>
                  <CardTitle className="text-cyan-300 text-xl">{post.productName}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="space-y-3 text-slate-300">
                    <p className="flex items-center gap-2"><Contact className="w-5 h-5 text-cyan-400" /> <strong>Seller:</strong> {post.adminName}</p>
                    <p className="flex items-center gap-2"><Phone className="w-5 h-5 text-cyan-400" /> <strong>Contact:</strong> {post.contactNumber}</p>
                    <p className="flex items-center gap-2"><Mail className="w-5 h-5 text-cyan-400" /> <strong>Socials:</strong> {post.socialMedia}</p>
                  </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
                        <Smartphone className="mr-2"/> Inquire Now
                    </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animation-delay-6000 { animation-delay: 6s; }
      `}</style>
    </div>
  );
}
