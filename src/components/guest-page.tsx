
"use client";

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Store, Contact, Smartphone, Mail, Phone, Loader2, Tag, ExternalLink, Package, Wallet, Calendar, Repeat, Languages } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { useFirebase } from '@/lib/firebase/context';
import { collection, query, orderBy, addDoc, runTransaction, getDoc, doc, onSnapshot } from 'firebase/firestore';
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
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [inquiryPost, setInquiryPost] = useState<GadgetPost | null>(null);
  const [inquiryForm, setInquiryForm] = useState({
    guestName: '',
    contactNumber: '',
    email: '',
    socialMedia: '',
    message: ''
  });

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    };
    
    setLoading(true);
    const postsRef = collection(db, "gadgetPosts");
    const q = query(postsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as GadgetPost));

      setPosts(currentPosts => {
        return allPosts.map(p => {
          const existingPost = currentPosts.find(cp => cp.id === p.id);
          if (existingPost && existingPost.isTranslated) {
              return {
                  ...p,
                  displayData: existingPost.displayData,
                  translation: existingPost.translation,
                  isTranslated: existingPost.isTranslated,
              };
          }
          return {
            ...p,
            displayData: { name: p.productName, description: p.description || '' },
            isTranslated: false,
          };
        });
      });
      
      setLoading(false);
    }, (e: any) => {
      console.error("Error fetching gadget posts:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch available gadgets.",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, toast]);


  const categories = useMemo(() => {
    const allCategories = posts.map(p => p.category);
    return ['All', ...Array.from(new Set(allCategories))];
  }, [posts]);
  
  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'All') {
      return posts;
    }
    return posts.filter(p => p.category === selectedCategory);
  }, [posts, selectedCategory]);

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
            setPosts(prev => prev.map(p => p.id === postId ? {
                ...p,
                displayData: { name: p.productName, description: p.description || '' },
                isTranslated: false
            } : p));
        } else {
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
        productId: inquiryPost.productNumber,
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
    <div className="dark hero-shapes-bg relative flex flex-col min-h-screen overflow-hidden text-white p-4 sm:p-6 md:p-8">
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
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <header className="relative w-full mb-12">
            <Button
                onClick={onBack}
                variant="ghost"
                className="absolute top-0 left-0 text-slate-300 hover:bg-slate-800/50 hover:text-white"
            >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back
            </Button>
            <div className="text-center pt-16 sm:pt-8">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                Available Gadgets
                </h1>
                <p className="mt-3 text-lg text-slate-400 max-w-2xl mx-auto">Browse our latest products available for cash or installment.</p>
            </div>
        </header>

        <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-5 text-center">Choose a Category</h2>
            <div className="flex flex-wrap justify-center gap-3">
                {categories.map(category => (
                <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                        "rounded-full px-5 py-2 text-base font-medium transition-all duration-300",
                        selectedCategory === category 
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                        : 'border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700/70 hover:border-slate-600'
                    )}
                >
                    {category}
                </button>
                ))}
            </div>
        </div>


        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-slate-800/50 backdrop-blur-md border-white/10 overflow-hidden">
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
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/10">
            <Store className="mx-auto h-16 w-16 text-cyan-400 mb-4" />
            <h2 className="text-3xl font-bold">No Gadgets in this Category</h2>
            <p className="text-slate-300 mt-2">Please select another category or check back later!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
            {filteredPosts.map(post => {
              const isExpanded = expandedDescriptions.includes(post.id);
              return (
              <Card key={post.id} className={cn("bg-slate-800/50 backdrop-blur-sm border border-white/10 overflow-hidden flex flex-col transform hover:-translate-y-1 transition-transform duration-300 shadow-lg hover:shadow-purple-500/10", post.isSold && "opacity-60")}>
                <div className="relative w-full h-56 bg-slate-800 flex items-center justify-center">
                    {post.imageUrl ? (
                        <Image src={post.imageUrl} alt={post.productName} layout="fill" objectFit="cover" className="bg-slate-800" />
                    ) : (
                        <Package className="h-24 w-24 text-slate-600" />
                    )}
                     <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
                        <Badge className={cn("text-white", post.isSold ? "bg-red-600" : "bg-cyan-500")}>
                            {post.isSold ? "Out of Stock" : "In Stock"}
                        </Badge>
                        {post.category && <Badge variant="secondary">{post.category}</Badge>}
                    </div>
                </div>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-slate-100 text-xl break-words">{post.displayData.name}</CardTitle>
                  </div>
                  <p className="text-xs text-slate-400">P/N: {post.productNumber}</p>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                    <Button
                        variant="outline"
                        onClick={() => handleToggleTranslation(post.id)}
                        disabled={translatingId === post.id}
                        className="w-full mb-4 bg-slate-700/50 border-slate-600 hover:bg-slate-700"
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
                  
                  <div className="font-bold text-primary text-xl my-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700 text-center text-cyan-300">
                    Cash Price: ฿{(post.cashPrice || 0).toLocaleString()}
                  </div>
                  
                  {(post.downPayment || 0) > 0 && (
                    <div className="my-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-2 text-sm">
                        <h4 className="font-bold text-slate-200 text-base mb-3">Installment Plan</h4>
                        <p className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-400"><Wallet className="w-4 h-4 text-cyan-400"/> Down Payment</span> <strong>฿{(post.downPayment || 0).toLocaleString()}</strong></p>
                        <p className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-400"><Calendar className="w-4 h-4 text-cyan-400"/> Months to Pay</span> <strong>{post.installmentMonths || 0}</strong></p>
                        <p className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-400"><Repeat className="w-4 h-4 text-cyan-400"/> Monthly Installment</span> <strong>฿{(post.monthlyInstallment || 0).toLocaleString()}</strong></p>
                    </div>
                  )}

                  <div className="space-y-3 text-slate-300 break-all mt-4 border-t border-slate-700 pt-4">
                    <p className="flex items-center gap-2"><Contact className="w-5 h-5 text-cyan-400 flex-shrink-0" /> <strong>Seller:</strong> {post.adminName}</p>
                    <p className="flex items-center gap-2"><Phone className="w-5 h-5 text-cyan-400 flex-shrink-0" /> <strong>Contact:</strong> {post.contactNumber}</p>
                    <p className="flex items-center gap-2"><Mail className="w-5 h-5 text-cyan-400 flex-shrink-0" /> <strong>Socials:</strong> {post.socialMedia}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:opacity-90 transition-opacity" onClick={() => handleInquireNow(post)} disabled={post.isSold}>
                        <Smartphone className="mr-2"/> Inquire Now
                    </Button>
                    {post.externalLink && (
                        <a href={post.externalLink} target="_blank" rel="noopener noreferrer" className="w-full">
                            <Button variant="outline" className="w-full bg-slate-700/50 border-slate-600 hover:bg-slate-700 text-slate-300">
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
        <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Inquire about: {inquiryPost?.productName}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Fill out your details below and the seller will get back to you shortly. (P/N: {inquiryPost?.productNumber})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInquirySubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="guestName" className="text-right text-slate-400">Name *</Label>
                <Input id="guestName" name="guestName" value={inquiryForm.guestName} onChange={handleInquiryChange} className="col-span-3 bg-slate-800 border-slate-600" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contactNumber" className="text-right text-slate-400">Contact # *</Label>
                <Input id="contactNumber" name="contactNumber" value={inquiryForm.contactNumber} onChange={handleInquiryChange} className="col-span-3 bg-slate-800 border-slate-600" />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right text-slate-400">Email</Label>
                <Input id="email" name="email" value={inquiryForm.email} onChange={handleInquiryChange} className="col-span-3 bg-slate-800 border-slate-600" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="socialMedia" className="text-right text-slate-400">Social Media</Label>
                <Input id="socialMedia" name="socialMedia" value={inquiryForm.socialMedia} onChange={handleInquiryChange} className="col-span-3 bg-slate-800 border-slate-600" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="message" className="text-right text-slate-400">Message *</Label>
                <Textarea id="message" name="message" value={inquiryForm.message} onChange={handleInquiryChange} className="col-span-3 bg-slate-800 border-slate-600" placeholder="e.g., Is this still available?"/>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-blue-600 to-purple-600">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : 'Send Inquiry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
