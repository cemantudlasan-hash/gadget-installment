
"use client";

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Store, Contact, Smartphone, Mail, Phone, Loader2, Tag, ExternalLink, Package, Wallet, Calendar, Repeat, Languages, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { useFirebase } from '@/lib/firebase/context';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp, runTransaction, getDoc, doc } from 'firebase/firestore';
import type { GadgetPost, Inquiry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { translateInquiry } from '@/ai/flows/translate-inquiry';
import { translateProductDetails, type TranslateProductDetailsOutput } from '@/ai/flows/translate-product-details';
import { cn } from '@/lib/utils';

interface GuestPageProps {
  onBack: () => void;
}

interface DisplayPost extends GadgetPost {
    displayData: {
        name: string;
        description: string;
    };
    translation?: TranslateProductDetailsOutput;
    isTranslated: boolean;
}

export default function GuestPage({ onBack }: GuestPageProps) {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [posts, setPosts] = useState<DisplayPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<string[]>([]);

  const [inquiryPost, setInquiryPost] = useState<GadgetPost | null>(null);
  const [inquiryForm, setInquiryForm] = useState({
    guestName: '',
    contactNumber: '',
    email: '',
    socialMedia: '',
    message: ''
  });

  const fetchPosts = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const postsRef = collection(db, "gadgetPosts");
      const q = query(postsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const allPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as GadgetPost));
      
      setPosts(allPosts.map(p => ({
          ...p,
          displayData: { name: p.productName, description: p.description || ''},
          isTranslated: false,
      })));

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

  const handleInquiryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInquiryForm(prev => ({ ...prev, [name]: value }));
  };

  const handleInquireNow = (post: GadgetPost) => {
    setInquiryPost(post);
  };
  
  const toggleDescription = (postId: string) => {
    setExpandedDescriptions(prev =>
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    );
  };

  const handleToggleTranslation = async (postId: string) => {
    setTranslatingId(postId);
    try {
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) return;

        const post = posts[postIndex];

        if (post.isTranslated) {
            // Switch back to original
            setPosts(prev => prev.map(p => p.id === postId ? {
                ...p,
                displayData: { name: p.productName, description: p.description || '' },
                isTranslated: false
            } : p));
        } else {
            // Get translation (cached or new)
            let translation = post.translation;
            if (!translation) {
                const result = await translateProductDetails({
                    productName: post.productName,
                    description: post.description || ''
                });
                translation = { translatedName: result.translatedName, translatedDescription: result.translatedDescription };
            }

            if (translation) {
                setPosts(prev => prev.map(p => p.id === postId ? {
                    ...p,
                    displayData: { name: translation!.translatedName, description: translation!.translatedDescription },
                    translation,
                    isTranslated: true,
                } : p));
            }
        }
    } catch(err) {
        toast({ variant: 'destructive', title: 'Translation Error', description: 'Could not translate the product details.' });
    } finally {
        setTranslatingId(null);
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !inquiryPost) return;

    if (!inquiryForm.guestName || !inquiryForm.contactNumber || !inquiryForm.message) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill in your name, contact number, and message.' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const counterRef = doc(db, 'inquiryCounters', today);

      const newDailyId = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const newCount = (counterDoc.data()?.count || 0) + 1;
        transaction.set(counterRef, { count: newCount });
        return newCount;
      });

      const translationResult = await translateInquiry({ message: inquiryForm.message });

      const newInquiry: Omit<Inquiry, 'id'> = {
        dailyInquiryId: newDailyId,
        guestName: inquiryForm.guestName,
        contactNumber: inquiryForm.contactNumber,
        email: inquiryForm.email,
        socialMedia: inquiryForm.socialMedia,
        productName: inquiryPost.productName,
        productId: inquiryPost.productNumber, // Use user-defined productNumber
        message: inquiryForm.message,
        translation: translationResult.translation,
        detectedLanguage: translationResult.language,
        createdAt: new Date().toISOString(),
        isRead: false,
      };

      await addDoc(collection(db, 'inquiries'), newInquiry);

      toast({
        title: 'Inquiry Sent!',
        description: 'The seller has been notified. They will contact you shortly.',
      });
      setInquiryPost(null);
      setInquiryForm({ guestName: '', contactNumber: '', email: '', socialMedia: '', message: '' });

    } catch (err: any) {
      console.error('Error submitting inquiry:', err);
      toast({ variant: 'destructive', title: 'Submission Error', description: 'Could not send your inquiry. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="dark dashboard-bg relative flex flex-col min-h-screen overflow-hidden text-white p-4 sm:p-6 md:p-8">
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <header className="relative flex flex-col sm:flex-row justify-between items-center mb-8 pt-16 sm:pt-0">
           <div className="absolute top-0 left-0">
             <Button
                onClick={onBack}
                variant="outline"
                className="text-lg py-3 px-6 font-semibold bg-transparent hover:bg-slate-700/50 border-slate-600 text-slate-300 rounded-md transition-all duration-300"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back
            </Button>
          </div>
          <div className="text-center w-full">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-wider bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">
              Available Gadgets
            </h1>
            <p className="mt-2 text-lg text-slate-300">Browse our latest products available for cash or installment.</p>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
            {posts.map(post => {
              const isExpanded = expandedDescriptions.includes(post.id);
              return (
              <Card key={post.id} className={cn("bg-slate-900/50 backdrop-blur-sm border-purple-500/30 overflow-hidden flex flex-col transform hover:-translate-y-2 transition-transform duration-300 shadow-lg hover:shadow-cyan-500/20", post.isSold && "opacity-60")}>
                <div className="relative w-full h-56 bg-slate-800 flex items-center justify-center">
                    {post.imageUrl ? (
                        <Image src={post.imageUrl} alt={post.productName} layout="fill" objectFit="cover" className="bg-slate-800" />
                    ) : (
                        <Package className="h-24 w-24 text-slate-600" />
                    )}
                    <Badge className={cn("absolute top-2 right-2 z-10", post.isSold ? "bg-red-600 text-white" : "bg-cyan-500 text-black")}>
                        {post.isSold ? "Out of Stock" : "In Stock"}
                    </Badge>
                </div>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-cyan-300 text-xl break-words">{post.displayData.name}</CardTitle>
                  </div>
                  <p className="text-xs text-slate-400">P/N: {post.productNumber}</p>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                    <Button
                        variant="outline"
                        onClick={() => handleToggleTranslation(post.id)}
                        disabled={translatingId === post.id}
                        className="w-full mb-4 bg-black/30 border-purple-400/50 hover:bg-purple-900/50"
                    >
                        {translatingId === post.id ? 
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Translating...</> : 
                            <><Languages className="mr-2 h-4 w-4" /> {post.isTranslated ? 'Show Original' : 'Translate to Thai'}</>
                        }
                    </Button>
                  <div className="flex-grow">
                    <p className={cn("text-slate-300 mb-2 transition-all duration-300", !isExpanded && "line-clamp-3")}>
                        {post.displayData.description}
                    </p>
                     {post.displayData.description && post.displayData.description.length > 100 && (
                        <Button
                            variant="link"
                            className="text-cyan-400 p-0 h-auto"
                            onClick={() => toggleDescription(post.id)}
                        >
                            {isExpanded ? "Read Less" : "Read More"}
                        </Button>
                     )}
                  </div>
                  
                  <div className="font-bold text-primary text-xl my-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                    Cash Price: ฿{(post.cashPrice || 0).toLocaleString()}
                  </div>
                  
                  {(post.downPayment || 0) > 0 && (
                    <div className="my-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2 text-sm">
                        <h4 className="font-bold text-slate-200">Installment Plan</h4>
                        <p className="flex items-center justify-between"><span className="flex items-center gap-2"><Wallet className="w-4 h-4 text-cyan-400"/> Down Payment</span> <strong>฿{(post.downPayment || 0).toLocaleString()}</strong></p>
                        <p className="flex items-center justify-between"><span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-cyan-400"/> Months to Pay</span> <strong>{post.installmentMonths || 0}</strong></p>
                        <p className="flex items-center justify-between"><span className="flex items-center gap-2"><Repeat className="w-4 h-4 text-cyan-400"/> Monthly Installment</span> <strong>฿{(post.monthlyInstallment || 0).toLocaleString()}</strong></p>
                    </div>
                  )}

                  <div className="space-y-3 text-slate-300 break-all mt-4 border-t border-slate-700 pt-4">
                    <p className="flex items-center gap-2"><Contact className="w-5 h-5 text-cyan-400 flex-shrink-0" /> <strong>Seller:</strong> {post.adminName}</p>
                    <p className="flex items-center gap-2"><Phone className="w-5 h-5 text-cyan-400 flex-shrink-0" /> <strong>Contact:</strong> {post.contactNumber}</p>
                    <p className="flex items-center gap-2"><Mail className="w-5 h-5 text-cyan-400 flex-shrink-0" /> <strong>Socials:</strong> {post.socialMedia}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                    <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold" onClick={() => handleInquireNow(post)} disabled={post.isSold}>
                        <Smartphone className="mr-2"/> Inquire Now
                    </Button>
                    {post.externalLink && (
                        <a href={post.externalLink} target="_blank" rel="noopener noreferrer" className="w-full">
                            <Button variant="outline" className="w-full bg-transparent hover:bg-slate-700/50 border-slate-600 text-slate-300">
                                <ExternalLink className="mr-2"/> View Photos
                            </Button>
                        </a>
                    )}
                </CardFooter>
              </Card>
              )
            })}
          </div>
        )}
      </div>

       <Dialog open={!!inquiryPost} onOpenChange={() => setInquiryPost(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Inquire about: {inquiryPost?.productName}</DialogTitle>
            <DialogDescription>
              Fill out your details below and the seller will get back to you shortly. (Product Number: {inquiryPost?.productNumber})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInquirySubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="guestName" className="text-right">Name *</Label>
                <Input id="guestName" name="guestName" value={inquiryForm.guestName} onChange={handleInquiryChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contactNumber" className="text-right">Contact # *</Label>
                <Input id="contactNumber" name="contactNumber" value={inquiryForm.contactNumber} onChange={handleInquiryChange} className="col-span-3" />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Email</Label>
                <Input id="email" name="email" value={inquiryForm.email} onChange={handleInquiryChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="socialMedia" className="text-right">Social Media</Label>
                <Input id="socialMedia" name="socialMedia" value={inquiryForm.socialMedia} onChange={handleInquiryChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="message" className="text-right">Message *</Label>
                <Textarea id="message" name="message" value={inquiryForm.message} onChange={handleInquiryChange} className="col-span-3" placeholder="e.g., Is this still available? What are the installment terms?"/>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : 'Send Inquiry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
