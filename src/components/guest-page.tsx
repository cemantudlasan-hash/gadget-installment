"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  ShoppingCart,
  User,
  Globe,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Send,
  Sparkles,
  Info,
  ShieldCheck,
  X,
  Trash2,
  Check,
  Plus,
  Phone,
  Contact,
  Mail,
  Wallet,
  Calendar,
  Repeat,
  Package,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { useFirebase } from "@/lib/firebase/context";
import { collection, query, orderBy, addDoc, runTransaction, doc, onSnapshot } from "firebase/firestore";
import type { GadgetPost, Inquiry } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { translateInquiry } from "@/ai/flows/translate-inquiry";
import { translateProductDetails } from "@/ai/flows/translate-product-details";
import { removeWhiteBackgroundFromImage } from "@/lib/image-utils";
import { cn } from "@/lib/utils";

interface GuestPageProps {
  onBack: () => void;
}

function ProductStageImage({ src, alt }: { src: string; alt: string }) {
  const [cleanedSrc, setCleanedSrc] = useState(src);

  useEffect(() => {
    let active = true;
    if (src) {
      removeWhiteBackgroundFromImage(src).then((res) => {
        if (active && res) {
          setCleanedSrc(res);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [src]);

  return (
    <img
      src={cleanedSrc}
      alt={alt}
      className="relative z-10 max-h-40 max-w-[85%] object-contain filter drop-shadow-[0_16px_22px_rgba(0,0,0,0.9)] group-hover:scale-105 group-hover:-translate-y-1 transition-transform duration-300"
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).src = "/images/macbook-pro-16.jpg";
      }}
    />
  );
}

export default function GuestPage({ onBack }: GuestPageProps) {
  const { db } = useFirebase();
  const { toast } = useToast();

  // Pagination configuration (6 items per page)
  const ITEMS_PER_PAGE = 6;
  const [currentPage, setCurrentPage] = useState(1);

  // Real-time Firestore posts with instant cache initialization
  const [posts, setPosts] = useState<GadgetPost[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("cached_gadget_posts");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("cached_gadget_posts");
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch {}
    }
    return true;
  });

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [globalLang, setGlobalLang] = useState<"EN" | "TH">("EN");

  // Reset to page 1 whenever search query or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  // Per-card expanded description state
  const [expandedDescriptions, setExpandedDescriptions] = useState<string[]>([]);

  // Per-card translation state
  const [translatedCards, setTranslatedCards] = useState<Record<string, { titleTh?: string; descTh?: string }>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  // Cleaned transparent images cache
  const [cleanedImages, setCleanedImages] = useState<Record<string, string>>({});

  // Application / Inquiry Modal state
  const [selectedItemForAction, setSelectedItemForAction] = useState<GadgetPost | null>(null);
  const [isWaitlistMode, setIsWaitlistMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    guestName: "",
    contactNumber: "",
    email: "",
    socialMedia: "",
    message: ""
  });

  // Shopping Cart State: dynamic array with add and REMOVE functionality
  const [cart, setCart] = useState<GadgetPost[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // User Profile / Admin Menu
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Real-time Firestore synchronization with Admin System & cache update
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const postsRef = collection(db, "gadgetPosts");
    const q = query(postsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestorePosts = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            title: data.title || data.productName,
            productName: data.productName || data.title,
            partNumber: data.partNumber || data.productNumber,
            productNumber: data.productNumber || data.partNumber,
            stockStatus: data.stockStatus || (data.isSold ? "Out of Stock" : "In Stock"),
            monthlyInstallment: data.monthlyInstallment || data.installmentMonthly,
            installmentMonthly: data.installmentMonthly || data.monthlyInstallment,
          } as GadgetPost;
        });

        setPosts(firestorePosts);
        setLoading(false);

        // Save to sessionStorage for zero-delay instant future loads
        try {
          sessionStorage.setItem("cached_gadget_posts", JSON.stringify(firestorePosts));
        } catch {}

        // Process images with white background removal so they blend onto the 3D dark pedestal
        firestorePosts.forEach(async (item) => {
          const rawUrl = resolveRawImage(item);
          if (rawUrl && !rawUrl.startsWith("/images/")) {
            const cleaned = await removeWhiteBackgroundFromImage(rawUrl);
            setCleanedImages((prev) => ({ ...prev, [item.id]: cleaned }));
          }
        });
      },
      (error) => {
        console.error("Firestore sync error:", error);
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "Could not fetch real-time inventory from Firebase."
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, toast]);

  // Dynamic Categories calculation from real Firestore data
  const categories = useMemo(() => {
    const list = ["All", "Notebook", "Tablet/iPad", "Mobile Phone"];
    posts.forEach((p) => {
      if (p.category && !list.includes(p.category)) {
        list.push(p.category);
      }
    });
    return list;
  }, [posts]);

  // Extract or generate specs array for cards
  const getSpecsForGadget = (item: GadgetPost): string[] => {
    if (item.specs && item.specs.length > 0) return item.specs;
    const desc = item.description || "";
    const name = item.productName || item.title || "";

    const specs: string[] = [];
    const ramMatch = desc.match(/(\d+\s*GB\s*RAM|\d+\s*gb\s*ram)/i) || name.match(/(\d+\s*gb\s*ram)/i);
    const ssdMatch = desc.match(/(\d+\s*(?:GB|TB)\s*(?:SSD|ROM))/i) || name.match(/(\d+\s*(?:gb|tb)\s*(?:ssd|rom))/i);
    const chipMatch = desc.match(/(M1|M2|M3|i7-\w+|GTX\s*\w+|RTX\s*\w+)/i) || name.match(/(M1|M2|M3|i7-\w+)/i);
    const sizeMatch = desc.match(/(\d+(?:\.\d+)?\s*(?:inch|นิ้ว))/i) || name.match(/(\d+(?:\.\d+)?\s*inch)/i);

    if (ramMatch) specs.push(ramMatch[0].toUpperCase());
    if (ssdMatch) specs.push(ssdMatch[0].toUpperCase());
    if (chipMatch) specs.push(chipMatch[0].toUpperCase());
    if (sizeMatch && specs.length < 3) specs.push(sizeMatch[0]);

    if (specs.length === 0) {
      if (item.category === "Notebook") return ["16GB RAM", "512GB SSD", "Intel/M1"];
      if (item.category === "Mobile Phone") return ["128GB ROM", "5G", "OLED"];
      if (item.category?.includes("Tablet")) return ["WiFi", "Liquid Retina", "Apple Pencil"];
      return ["Verified", "Original Box", "Warranty"];
    }
    return specs.slice(0, 3);
  };

  // Helper to resolve fallback or AI images
  const resolveRawImage = (item: GadgetPost): string => {
    if (item.imageUrl && item.imageUrl.trim() !== "") {
      return item.imageUrl;
    }
    const name = (item.productName || item.title || "").toLowerCase();
    if (name.includes("pro 2019") || name.includes("16 inch")) {
      return "/images/macbook-pro-16.jpg";
    }
    if (name.includes("air m1") || name.includes("air 2020")) {
      return "/images/macbook-air-m1.jpg";
    }
    if (name.includes("rog") || name.includes("zephyrus") || name.includes("gaming")) {
      return "/images/asus-rog-zephyrus.jpg";
    }
    return "";
  };

  const getCardImage = (item: GadgetPost): string => {
    return cleanedImages[item.id] || resolveRawImage(item) || "/images/macbook-pro-16.jpg";
  };

  // Toggle description read more
  const toggleDescription = (id: string) => {
    setExpandedDescriptions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Translate toggler per card (translates title and description)
  const toggleTranslate = async (item: GadgetPost) => {
    const id = item.id;
    if (translatedCards[id]?.titleTh) {
      setTranslatedCards((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      return;
    }

    if (item.titleTh) {
      setTranslatedCards((prev) => ({
        ...prev,
        [id]: { titleTh: item.titleTh, descTh: item.description }
      }));
      return;
    }

    // Call Genkit AI translation flow
    setTranslatingId(id);
    try {
      const res = await translateProductDetails({
        productName: item.productName || item.title || "",
        description: item.description || ""
      });
      setTranslatedCards((prev) => ({
        ...prev,
        [id]: { titleTh: res.translatedName, descTh: res.translatedDescription }
      }));
    } catch {
      toast({
        variant: "destructive",
        title: "Translation Notice",
        description: "Could not auto-translate. Showing original specifications."
      });
    } finally {
      setTranslatingId(null);
    }
  };

  // Toggle global language switch
  const handleToggleGlobalLang = () => {
    if (globalLang === "EN") {
      setGlobalLang("TH");
      const newMap: Record<string, { titleTh?: string }> = { ...translatedCards };
      posts.forEach((item) => {
        if (item.titleTh) {
          newMap[item.id] = { titleTh: item.titleTh };
        } else if (item.productName?.toLowerCase().includes("macbook pro 2019")) {
          newMap[item.id] = { titleTh: "แมคบุ๊กโปร 2019 ขนาด 16 นิ้ว แรม 32GB ความจุ 512GB" };
        } else if (item.productName?.toLowerCase().includes("macbook air m1")) {
          newMap[item.id] = { titleTh: "แมคบุ๊กแอร์ M1 2020 แรม 8GB ความจุ 256GB (ผ่อนชำระ)" };
        }
      });
      setTranslatedCards(newMap);
    } else {
      setGlobalLang("EN");
      setTranslatedCards({});
    }
  };

  // Search and Category filtering on live Firestore data
  const filteredGadgets = useMemo(() => {
    return posts.filter((g) => {
      const matchesCat = selectedCategory === "All" || g.category === selectedCategory;
      if (!matchesCat) return false;

      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      const titleMatch = (g.title || g.productName || "").toLowerCase().includes(term);
      const titleThMatch = (g.titleTh || "").toLowerCase().includes(term);
      const pnMatch = (g.partNumber || g.productNumber || "").toLowerCase().includes(term);
      const descMatch = (g.description || "").toLowerCase().includes(term);
      const specMatch = g.specs?.some((s) => s.toLowerCase().includes(term));

      return titleMatch || titleThMatch || pnMatch || descMatch || specMatch;
    });
  }, [posts, selectedCategory, searchQuery]);

  // Pagination calculations (6 items per page)
  const totalPages = Math.ceil(filteredGadgets.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedGadgets = useMemo(() => {
    return filteredGadgets.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredGadgets, startIndex, ITEMS_PER_PAGE]);

  // Cart operations (Add, Remove, Clear)
  const handleAddToCart = (item: GadgetPost) => {
    if (cart.some((c) => c.id === item.id)) {
      toast({
        title: "Already in Cart",
        description: `${item.productName || item.title} is already in your application cart.`
      });
      setCartOpen(true);
      return;
    }
    setCart((prev) => [...prev, item]);
    toast({
      title: "Added to Cart!",
      description: `${item.productName || item.title} added to your installment application cart.`
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
    toast({
      title: "Item Removed",
      description: "Product removed from your cart."
    });
  };

  const handleClearCart = () => {
    setCart([]);
    toast({ title: "Cart Cleared", description: "All items removed from cart." });
  };

  // Open Application Modal
  const handleOpenAction = (item: GadgetPost, isWaitlist: boolean) => {
    setSelectedItemForAction(item);
    setIsWaitlistMode(isWaitlist);
    setInquiryForm({
      guestName: "",
      contactNumber: "",
      email: "",
      socialMedia: "",
      message: isWaitlist
        ? `Hello! I would like to join the waitlist for ${item.productName || item.title} (P/N: ${item.productNumber || item.partNumber}). Please notify me when it's back in stock!`
        : `Hello! I want to apply for installment on ${item.productName || item.title} (P/N: ${item.productNumber || item.partNumber}). Down payment: ฿${(item.downPayment || 0).toLocaleString()}, Monthly rate: ฿${(item.installmentMonthly || item.monthlyInstallment || 0).toLocaleString()}/mo.`
    });
  };

  // Open Application from Cart with all items
  const handleApplyFromCart = () => {
    if (cart.length === 0) return;
    const firstItem = cart[0];
    setSelectedItemForAction(firstItem);
    setIsWaitlistMode(false);
    setCartOpen(false);

    const itemsSummary = cart
      .map(
        (c) =>
          `• ${c.productName || c.title} (P/N: ${c.productNumber || c.partNumber}) - ฿${(c.cashPrice || 0).toLocaleString()} (฿${(c.installmentMonthly || c.monthlyInstallment || 0).toLocaleString()}/mo)`
      )
      .join("\n");

    setInquiryForm({
      guestName: "",
      contactNumber: "",
      email: "",
      socialMedia: "",
      message: `Hello! I would like to apply for the following gadget(s):\n${itemsSummary}\n\nPlease contact me regarding the installment verification.`
    });
  };

  // Submit Inquiry into Firestore (compatible with admin system)
  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAction) return;

    if (!inquiryForm.guestName || !inquiryForm.contactNumber) {
      toast({
        variant: "destructive",
        title: "Required Information",
        description: "Please enter your name and contact phone number."
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (db) {
        const today = new Date().toISOString().split("T")[0];
        const counterRef = doc(db, "inquiryCounters", today);

        const newDailyId = await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          const newCount = (counterDoc.data()?.count || 0) + 1;
          transaction.set(counterRef, { count: newCount });
          return newCount;
        }).catch(() => Math.floor(Math.random() * 1000) + 1);

        let translationResult: { translation?: string; language?: string } = {
          translation: inquiryForm.message,
          language: "en"
        };
        try {
          translationResult = await translateInquiry({ message: inquiryForm.message });
        } catch {
          // graceful fallback
        }

        const newInquiry: Omit<Inquiry, "id"> = {
          dailyInquiryId: newDailyId,
          guestName: inquiryForm.guestName,
          contactNumber: inquiryForm.contactNumber,
          email: inquiryForm.email,
          socialMedia: inquiryForm.socialMedia,
          productName: selectedItemForAction.productName || selectedItemForAction.title || "",
          productId: selectedItemForAction.productNumber || selectedItemForAction.partNumber || "",
          message: inquiryForm.message,
          translation: translationResult.translation,
          detectedLanguage: translationResult.language,
          createdAt: new Date().toISOString(),
          isRead: false
        };

        await addDoc(collection(db, "inquiries"), newInquiry);
      }

      toast({
        title: isWaitlistMode ? "Waitlist Confirmed!" : "Application Submitted!",
        description: "Our admin team has received your request and will contact you directly."
      });

      setSelectedItemForAction(null);
    } catch {
      toast({
        variant: "destructive",
        title: "Application Status",
        description: "Your application details have been recorded. Seller will contact you shortly."
      });
      setSelectedItemForAction(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#04060d] text-slate-100 relative overflow-x-hidden font-sans selection:bg-cyan-400 selection:text-black">
      {/* Ultra-Quality Cyberpunk Stage Background Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Crisp Hi-Res Circuit & Hologram Canvas Layer */}
        <div
          className="absolute inset-0 bg-cover bg-no-repeat transition-all duration-700 brightness-[1.08] contrast-[1.12]"
          style={{
            backgroundImage: "url('/images/cyber-guest-bg.png')",
            backgroundPosition: "center 20%",
          }}
        />

        {/* Ambient Holographic Vignette & Depth Mask for Perfect Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#04060d]/50 via-[#04060d]/20 to-[#04060d]/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,transparent_30%,#04060d_95%)]" />

        {/* Dynamic Center Neon Glow Accent */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-purple-600/10 rounded-full blur-[130px] pointer-events-none" />

        {/* Subtle Cyber Grid Micro-Overlay */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-screen pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.2) 1px, transparent 1px)",
            backgroundSize: "60px 60px"
          }}
        />
      </div>

      {/* Top Navbar - Full Width Edge to Edge */}
      <header className="relative z-30 border-b border-white/10 bg-[#060913]/70 backdrop-blur-md px-6 sm:px-10 lg:px-14 py-4 flex items-center justify-between w-full shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        {/* Brand Logo */}
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-125 transition-all"
            title="Return to selection"
          >
            GADGET<span className="text-cyan-400">//</span>CC
          </button>
        </div>

        {/* Global Search Bar (Center Pill) */}
        <div className="relative flex-1 max-w-xl mx-8 hidden sm:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search gadgets, models, or specs..."
            className="w-full pl-11 pr-4 py-2 rounded-full bg-[#0b101c]/80 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* User Utility Actions */}
        <div className="flex items-center gap-5 text-sm text-slate-300">
          {/* Global Language Toggle */}
          <button
            onClick={handleToggleGlobalLang}
            className="flex items-center gap-1.5 font-mono text-xs font-semibold px-2 py-1 rounded-lg border border-white/5 hover:border-cyan-400/50 hover:text-cyan-400 transition-all"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className={globalLang === "EN" ? "text-cyan-400 font-bold" : "text-slate-400"}>EN</span>
            <span className="text-slate-600">|</span>
            <span className={globalLang === "TH" ? "text-cyan-400 font-bold" : "text-slate-400"}>TH</span>
          </button>

          {/* Cart Icon with Live Notification Badge */}
          <div
            onClick={() => setCartOpen(true)}
            className="relative cursor-pointer text-slate-300 hover:text-cyan-400 transition-colors p-1"
            title="View Cart / Selected Gadgets"
          >
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-cyan-400 text-black font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                {cart.length}
              </span>
            )}
          </div>

          {/* User Profile / Admin Quick Switch */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-cyan-400/40 text-slate-200 transition-all"
              title="Admin & Role Navigation"
            >
              <User className="w-5 h-5 text-cyan-400" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0d1322] border border-cyan-500/30 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-white/5">
                  <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Guest Mode</p>
                  <p className="text-[11px] text-slate-400">Live Inventory Active ({posts.length} items)</p>
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    onBack();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-300 rounded-xl transition-colors mt-1"
                >
                  <ShieldCheck className="w-4 h-4 text-cyan-400" /> Go to Admin Login
                </button>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    onBack();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-400" /> Back to Role Selection
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area - Stretched for Wide Screen Product Postings */}
      <main id="gadgets-section" className="relative z-10 max-w-[1680px] w-full mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 pt-10 pb-28">
        {/* Mobile Search Bar fallback */}
        <div className="block sm:hidden mb-6">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search gadgets, models, or specs..."
              className="w-full pl-11 pr-4 py-2 rounded-full bg-[#0b101c] border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Header Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-9">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
            Available Gadgets
          </h1>
          <p className="mt-3 text-slate-400 text-sm md:text-base">
            Browse our latest products available for cash or installment.
          </p>
        </div>

        {/* Category Pill Filters (Single row pill container) */}
        <div className="flex flex-col items-center gap-3 mb-12">
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
            Choose a Category
          </span>
          <div className="inline-flex items-center justify-center gap-2 bg-[#080d19]/90 p-1.5 rounded-full border border-white/10 backdrop-blur-xl shadow-2xl overflow-x-auto max-w-full">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              const count = cat === "All" ? posts.length : posts.filter((p) => p.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "whitespace-nowrap px-6 py-2 rounded-full text-xs font-bold transition-all duration-300",
                    active
                      ? "bg-[#16d5ec] text-black shadow-[0_0_22px_rgba(22,213,236,0.7)] scale-105"
                      : "text-slate-300 hover:text-white hover:bg-white/5 border border-transparent"
                  )}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid or Loading State */}
        {loading && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <Loader2 className="w-9 h-9 animate-spin text-cyan-400" />
            <p className="text-sm font-mono">Loading inventory...</p>
          </div>
        ) : filteredGadgets.length === 0 ? (
          <div className="text-center py-24 text-slate-400 text-sm rounded-3xl border border-white/5 bg-[#0a101d]/60 backdrop-blur-md max-w-md mx-auto">
            <Info className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
            <p className="font-semibold text-slate-200">No gadgets found in this category.</p>
            <p className="text-xs text-slate-500 mt-1">Try selecting &quot;All&quot; categories or resetting search.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 items-stretch">
            {paginatedGadgets.map((item, index) => {
              const isInStock =
                item.stockStatus?.toLowerCase() === "in stock" ||
                (!item.isSold && item.stockStatus !== "Out of Stock");
              const isTranslated = !!translatedCards[item.id]?.titleTh;
              const specs = getSpecsForGadget(item);
              const displayTitle = isTranslated && translatedCards[item.id]?.titleTh
                ? translatedCards[item.id].titleTh
                : item.productName || item.title;
              const displayDesc = isTranslated && translatedCards[item.id]?.descTh
                ? translatedCards[item.id].descTh
                : item.description;
              const displayPn = item.partNumber || item.productNumber || "N/A";
              const monthlyAmount = item.installmentMonthly || item.monthlyInstallment || 0;
              const cashAmount = item.cashPrice || 0;
              const imgSrc = getCardImage(item);
              const isExpanded = expandedDescriptions.includes(item.id);
              const isFirstFeatured = index === 0;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative rounded-2xl bg-gradient-to-b from-[#0e1424]/90 via-[#0a0f1d]/95 to-[#060a14] p-5 backdrop-blur-2xl transition-all duration-300 flex flex-col justify-between hover:shadow-[0_0_35px_rgba(34,211,238,0.2)]",
                    isFirstFeatured
                      ? "border border-cyan-400/80 shadow-[0_0_30px_rgba(34,211,238,0.25)]"
                      : "border border-white/10 hover:border-cyan-400/50"
                  )}
                >
                  <div>
                    {/* Top Status & Category Bar */}
                    <div className="flex items-center justify-between mb-3">
                      {/* Status Badge */}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border",
                          isInStock
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isInStock ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                          )}
                        />
                        {isInStock ? "In Stock" : "Out of Stock"}
                      </span>

                      {/* Category Badge */}
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono bg-slate-900/80 px-2.5 py-1 rounded-md border border-white/5">
                        {item.category || "Notebook"}
                      </span>
                    </div>

                    {/* 3D Cyber Stage Pedestal Presentation Container */}
                    <div className="relative my-3 flex h-52 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#0c1222] to-[#050811] p-3 border border-white/5">
                      {/* Spotlight Radial Glow */}
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.18)_0%,transparent_70%)]" />

                      {/* 3D Circular Pedestal with illuminated Dual Neon Rings (Purple Outer + Cyan Inner) */}
                      <div className="absolute bottom-3 w-52 h-14 pointer-events-none flex items-center justify-center">
                        {/* 3D Pedestal Body Shadow & Depth */}
                        <div className="absolute inset-x-2 bottom-0 h-6 bg-gradient-to-b from-slate-900/90 to-black rounded-b-[100%] border-b border-white/10 shadow-[0_15px_30px_rgba(0,0,0,0.95)]" />
                        
                        {/* Purple Outer Neon Ring */}
                        <div className="absolute inset-0 rounded-[100%] border-2 border-purple-500/70 shadow-[0_0_22px_rgba(168,85,247,0.8)]" />
                        
                        {/* Cyan Inner Neon Ring */}
                        <div className="absolute inset-1.5 rounded-[100%] border-2 border-cyan-400 shadow-[0_0_26px_rgba(34,211,238,0.95)] bg-cyan-950/30" />
                        
                        {/* Pedestal Top Glossy Reflection */}
                        <div className="absolute inset-3 rounded-[100%] bg-gradient-to-b from-cyan-400/25 via-slate-900/70 to-transparent" />
                      </div>

                      {/* Product Image Floating on 3D Stage with no white box */}
                      {imgSrc ? (
                        <ProductStageImage src={imgSrc} alt={displayTitle || "Gadget"} />
                      ) : (
                        <Package className="relative z-10 h-20 w-20 text-slate-600" />
                      )}
                    </div>

                    {/* Titles & Part Numbers */}
                    <h3 className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition-colors line-clamp-2 min-h-[48px] mt-2">
                      {displayTitle}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-1">
                      P/N: {displayPn}
                    </p>

                    {/* Specs Pills */}
                    <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
                      {specs.map((spec, i) => (
                        <span
                          key={i}
                          className="text-[11px] bg-slate-900/90 text-slate-300 px-2.5 py-0.5 rounded border border-white/5 font-mono"
                        >
                          [{spec}]
                        </span>
                      ))}
                    </div>

                    {/* Translation Button */}
                    <button
                      onClick={() => toggleTranslate(item)}
                      disabled={translatingId === item.id}
                      className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 bg-slate-900/60 hover:bg-slate-800/90 py-1.5 rounded-lg border border-white/5 hover:border-cyan-500/30 transition-all mb-3"
                    >
                      {translatingId === item.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> Translating...
                        </>
                      ) : (
                        <>
                          <Globe className="w-3.5 h-3.5 text-cyan-400" />
                          {isTranslated ? "Show English Original" : "Translate to Thai"}
                        </>
                      )}
                    </button>

                    {/* Full Product Description with Read More / Read Less */}
                    {displayDesc && (
                      <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5 mb-3 text-xs text-slate-300">
                        <p className={cn("transition-all duration-300 whitespace-pre-line", !isExpanded && "line-clamp-2")}>
                          {displayDesc}
                        </p>
                        {displayDesc.length > 80 && (
                          <button
                            type="button"
                            onClick={() => toggleDescription(item.id)}
                            className="text-cyan-400 hover:underline font-semibold mt-1 text-[11px] block"
                          >
                            {isExpanded ? "Read Less" : "Read More"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Detailed Installment Plan (Matching Admin system post) */}
                    {(item.downPayment || 0) > 0 || (item.installmentMonths || 0) > 0 ? (
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 text-xs space-y-1.5 mb-3 font-mono">
                        <div className="flex justify-between items-center text-slate-400">
                          <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-cyan-400" /> Down Payment:</span>
                          <span className="text-slate-200 font-bold">฿{(item.downPayment || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400">
                          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-cyan-400" /> Months to Pay:</span>
                          <span className="text-slate-200 font-bold">{item.installmentMonths || 6} mo</span>
                        </div>
                        <div className="flex justify-between items-center text-cyan-300 border-t border-white/5 pt-1.5">
                          <span className="flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5 text-cyan-400" /> Monthly Rate:</span>
                          <span className="font-bold">฿{monthlyAmount.toLocaleString()} / mo</span>
                        </div>
                      </div>
                    ) : null}

                    {/* Seller Details & Verification */}
                    <div className="text-[11px] text-slate-400 space-y-1 border-t border-white/5 pt-2.5 mb-3">
                      <p className="flex items-center gap-1.5 truncate">
                        <Contact className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="text-slate-500">Seller:</span> {item.adminName || "Ceman Dejamo Tudlasan"}
                      </p>
                      {item.contactNumber && item.contactNumber !== "N/A" && (
                        <p className="flex items-center gap-1.5 truncate">
                          <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="text-slate-500">Contact:</span> {item.contactNumber}
                        </p>
                      )}
                      {item.externalLink && (
                        <a
                          href={item.externalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-cyan-400 hover:underline pt-0.5"
                        >
                          <ExternalLink className="w-3 h-3" /> View Photos Drive
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Pricing Matrix & CTA */}
                  <div className="pt-3 border-t border-white/5 text-center">
                    <div className="mb-3">
                      <div className="text-sm font-bold text-slate-200">
                        Cash Price: <span className="text-cyan-400 font-bold">฿{cashAmount.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Installment: <span className="text-slate-200 font-semibold">฿{monthlyAmount.toLocaleString()} / mo</span>
                      </div>
                    </div>

                    {/* Dynamic Action Buttons: Apply Now / Join Waitlist + Add to Cart */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenAction(item, !isInStock)}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200",
                          isInStock
                            ? "bg-[#0b1c2b] border-2 border-cyan-400 text-cyan-300 hover:bg-cyan-400 hover:text-black shadow-[0_0_20px_rgba(34,211,238,0.45)] active:scale-[0.98]"
                            : "bg-slate-900/80 text-slate-400 border border-white/5 hover:border-white/10 hover:text-white"
                        )}
                      >
                        {isInStock ? "Apply Now" : "Join Waitlist"}
                      </button>

                      <button
                        onClick={() => handleAddToCart(item)}
                        className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 hover:border-cyan-400/50 text-slate-300 hover:text-cyan-400 transition-all"
                        title="Add to Cart for Application"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

            {/* Cyber Pagination Controls (6 items per page) */}
            {totalPages > 1 && (
              <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 pt-6">
                <div className="text-xs text-slate-400 font-mono">
                  Showing <span className="text-cyan-400 font-bold">{startIndex + 1}</span> -{" "}
                  <span className="text-cyan-400 font-bold">
                    {Math.min(startIndex + ITEMS_PER_PAGE, filteredGadgets.length)}
                  </span>{" "}
                  of <span className="text-white font-bold">{filteredGadgets.length}</span> gadgets (Page {currentPage} of {totalPages})
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage((prev) => Math.max(prev - 1, 1));
                      document.getElementById("gadgets-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    disabled={currentPage === 1}
                    className="bg-[#0b101c] border-white/10 text-slate-300 hover:text-white hover:border-cyan-400/50 rounded-xl px-3 h-9 text-xs"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>

                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                      const isActive = pageNum === currentPage;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            setCurrentPage(pageNum);
                            document.getElementById("gadgets-section")?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className={cn(
                            "w-9 h-9 rounded-xl text-xs font-bold transition-all duration-200 font-mono",
                            isActive
                              ? "bg-cyan-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.7)] scale-105"
                              : "bg-[#0b101c] border border-white/10 text-slate-400 hover:text-white hover:border-white/20"
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages));
                      document.getElementById("gadgets-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    disabled={currentPage === totalPages}
                    className="bg-[#0b101c] border-white/10 text-slate-300 hover:text-white hover:border-cyan-400/50 rounded-xl px-3 h-9 text-xs"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Application / Inquiry Modal (Integrated with Firestore Admin System) */}
      <Dialog open={!!selectedItemForAction} onOpenChange={() => setSelectedItemForAction(null)}>
        <DialogContent className="sm:max-w-[480px] bg-[#0c1222] border border-cyan-500/30 text-white rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              {isWaitlistMode ? "Waitlist Reservation" : "Official Installment Application"}
            </div>
            <DialogTitle className="text-xl font-bold text-slate-100 mt-1">
              {selectedItemForAction?.productName || selectedItemForAction?.title}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              P/N: {selectedItemForAction?.productNumber || selectedItemForAction?.partNumber} • Cash: ฿
              {(selectedItemForAction?.cashPrice || 0).toLocaleString()} • Installment: ฿
              {(
                selectedItemForAction?.installmentMonthly ||
                selectedItemForAction?.monthlyInstallment ||
                0
              ).toLocaleString()}
              /mo
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitInquiry} className="space-y-3.5 mt-2">
            <div>
              <Label htmlFor="guestName" className="text-xs text-slate-300">
                Your Full Name *
              </Label>
              <Input
                id="guestName"
                value={inquiryForm.guestName}
                onChange={(e) => setInquiryForm({ ...inquiryForm, guestName: e.target.value })}
                placeholder="e.g. Somchai Prasert"
                className="mt-1 bg-slate-900/80 border-white/10 text-white placeholder-slate-500 rounded-xl focus:border-cyan-400"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="contactNumber" className="text-xs text-slate-300">
                  Phone Number *
                </Label>
                <Input
                  id="contactNumber"
                  value={inquiryForm.contactNumber}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, contactNumber: e.target.value })}
                  placeholder="081-234-5678"
                  className="mt-1 bg-slate-900/80 border-white/10 text-white placeholder-slate-500 rounded-xl focus:border-cyan-400"
                  required
                />
              </div>
              <div>
                <Label htmlFor="socialMedia" className="text-xs text-slate-300">
                  Line ID / Social Media
                </Label>
                <Input
                  id="socialMedia"
                  value={inquiryForm.socialMedia}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, socialMedia: e.target.value })}
                  placeholder="@line_id or Facebook"
                  className="mt-1 bg-slate-900/80 border-white/10 text-white placeholder-slate-500 rounded-xl focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-xs text-slate-300">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={inquiryForm.email}
                onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                placeholder="somchai@example.com"
                className="mt-1 bg-slate-900/80 border-white/10 text-white placeholder-slate-500 rounded-xl focus:border-cyan-400"
              />
            </div>

            <div>
              <Label htmlFor="message" className="text-xs text-slate-300">
                Inquiry Message *
              </Label>
              <Textarea
                id="message"
                value={inquiryForm.message}
                onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                rows={3}
                className="mt-1 bg-slate-900/80 border-white/10 text-white placeholder-slate-500 rounded-xl focus:border-cyan-400 resize-none text-xs"
                required
              />
            </div>

            {/* Seller Contact Preview */}
            <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/5 text-[11px] text-slate-400 space-y-1">
              <p className="text-cyan-400 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Admin Contact
              </p>
              <p>Admin: {selectedItemForAction?.adminName || "Ceman Dejamo Tudlasan"}</p>
              {selectedItemForAction?.externalLink && (
                <a
                  href={selectedItemForAction.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline flex items-center gap-1 pt-1"
                >
                  <ExternalLink className="w-3 h-3" /> View Verified High-Res Photos Drive
                </a>
              )}
            </div>

            <DialogFooter className="pt-2 gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="border-white/10 text-slate-300 rounded-xl">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold rounded-xl hover:brightness-110 shadow-lg shadow-cyan-500/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending to Admin...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> {isWaitlistMode ? "Join Waitlist" : "Submit Application"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Shopping Cart Modal with FULL ADD and REMOVE functionality */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="sm:max-w-[500px] bg-[#0c1222] border border-cyan-500/30 text-white rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider">
                <ShoppingCart className="w-4 h-4" /> Installment Application Cart ({cart.length})
              </div>
              {cart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-[11px] text-rose-400 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear All
                </button>
              )}
            </div>
            <DialogTitle className="text-xl font-bold text-slate-100 mt-1">
              Your Selected Gadgets
            </DialogTitle>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ShoppingCart className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="font-semibold text-slate-200">Your cart is currently empty</p>
              <p className="text-xs text-slate-500 mt-1">
                Browse our available gadgets and click the cart icon on any item to add it here.
              </p>
              <Button
                onClick={() => setCartOpen(false)}
                className="mt-5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs rounded-xl"
              >
                Continue Browsing
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Scrollable list of items with REMOVE button */}
              <div className="max-h-[300px] overflow-y-auto space-y-2.5 pr-1">
                {cart.map((item) => {
                  const itemImg = getCardImage(item);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {itemImg ? (
                          <img
                            src={itemImg}
                            alt={item.productName}
                            className="w-14 h-14 object-contain rounded-xl bg-slate-950 p-1 border border-white/5 shrink-0"
                          />
                        ) : (
                          <Package className="w-14 h-14 p-2 text-slate-600 bg-slate-950 rounded-xl shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-100 truncate">
                            {item.productName || item.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            P/N: {item.productNumber || item.partNumber}
                          </p>
                          <div className="text-cyan-400 font-bold text-xs mt-1">
                            ฿{(item.installmentMonthly || item.monthlyInstallment || 0).toLocaleString()} / mo
                          </div>
                        </div>
                      </div>

                      {/* REMOVE BUTTON */}
                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-all shrink-0"
                        title="Remove this gadget from cart"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Cart Summary */}
              <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-white/5 text-xs space-y-2 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Total Cash Value:</span>
                  <span className="text-slate-100 font-bold">
                    ฿{cart.reduce((sum, i) => sum + (i.cashPrice || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Down Payment:</span>
                  <span className="text-slate-100 font-bold">
                    ฿{cart.reduce((sum, i) => sum + (i.downPayment || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-cyan-400 border-t border-white/5 pt-2 text-sm">
                  <span>Combined Monthly Rate:</span>
                  <span className="font-bold">
                    ฿{cart.reduce((sum, i) => sum + (i.installmentMonthly || i.monthlyInstallment || 0), 0).toLocaleString()} / mo
                  </span>
                </div>
              </div>

              <Button
                onClick={handleApplyFromCart}
                className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold rounded-xl py-3 hover:brightness-110 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
              >
                Proceed to Installment Application ({cart.length} {cart.length === 1 ? "Item" : "Items"})
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
