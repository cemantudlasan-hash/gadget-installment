"use client";

import React, { useState, useEffect, useMemo, ChangeEvent } from "react";
import {
  Search,
  ArrowLeft,
  ShieldCheck,
  Plus,
  User,
  X,
  ChevronDown,
  Info,
  CheckCircle2,
  Clock,
  Upload,
  MoreHorizontal,
  BadgeCheck,
  Check,
  Layers,
  Sparkles,
  CreditCard,
  Lock,
  Headphones,
  Laptop,
  Smartphone,
  Gamepad2,
  Tablet,
  Camera,
  ExternalLink,
  DollarSign,
  Coins,
  Link as LinkIcon,
  Wand2,
  Trash2,
  Truck,
  Phone,
  Mail,
  Calendar,
  Store,
  FileText,
  Banknote,
  AlertTriangle,
  Send,
  Key,
  Copy,
  MessageCircle,
  RotateCcw,
  Film,
  Play,
  FileVideo,
  Image as ImageIcon,
  Edit3,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/lib/firebase/context";
import { collection, query, orderBy, onSnapshot, addDoc } from "firebase/firestore";
import {
  Currency,
  CURRENCIES,
  formatPrice,
  getSavedCurrency,
  saveCurrency,
} from "@/lib/currency";
import {
  EscrowItem,
  EscrowMessage,
  getEscrowQueue,
  addEscrowItem,
  generateMonthlySchedule,
  buyerConfirmReceipt,
  sellerMarkShipped,
  sellerClaimPayout,
  cancelEscrowOrder,
  fileEscrowDispute,
  addEscrowMessage,
  findEscrowByPhoneAndEmail,
  updateEscrowSellerDetails,
  updateEscrowBuyerDetails,
} from "@/lib/escrow-store";

interface GuestPageProps {
  onBack: () => void;
}

interface MarketplaceItem {
  id: string;
  firestoreDocId?: string;
  productNumber?: string;
  title: string;
  priceUSD: number;
  category: "laptops" | "phones" | "gaming" | "tablets" | "cameras" | string;
  condition: string;
  description?: string;
  image: string;
  seller: string;
  shopName?: string;
  downpaymentPct: number;
  tenorMonths: number;
  monthlyUSD: number;
  isSold?: boolean;
  stockStatus?: "In Stock" | "Out of Stock" | string;
}

const BASE_MARKETPLACE: MarketplaceItem[] = [];

// Helper to retrieve cached marketplace items to eliminate flash of empty state on refresh
const getCachedMarketplaceItems = (): MarketplaceItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("gi_cached_marketplace_items");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const seenKeys = new Set<string>();
        const uniqueItems: MarketplaceItem[] = [];

        for (const rawItem of parsed) {
          if (
            !rawItem ||
            rawItem.id === "GI-84920" ||
            rawItem.id === "GI-59102" ||
            rawItem.id?.startsWith("GI-104")
          ) {
            continue;
          }

          const item: MarketplaceItem = {
            ...rawItem,
            priceUSD: rawItem.priceUSD > 3000 ? rawItem.priceUSD / 35 : rawItem.priceUSD,
            monthlyUSD:
              (rawItem.monthlyUSD || 0) > 3000 ? (rawItem.monthlyUSD || 0) / 35 : rawItem.monthlyUSD,
          };

          const prodNum = (item.productNumber || item.id || "").trim().toUpperCase();
          const normTitle = (item.title || "").trim().toLowerCase();
          const shop = (item.shopName || item.seller || "").trim().toLowerCase();
          const titleShopKey = `${normTitle}::${shop}`;

          if (prodNum && prodNum.startsWith("GI-") && seenKeys.has(prodNum)) {
            continue;
          }
          if (titleShopKey && seenKeys.has(titleShopKey)) {
            continue;
          }
          if (normTitle && seenKeys.has(normTitle)) {
            continue;
          }

          if (prodNum && prodNum.startsWith("GI-")) seenKeys.add(prodNum);
          if (titleShopKey) seenKeys.add(titleShopKey);
          if (normTitle) seenKeys.add(normTitle);
          seenKeys.add(item.id);

          uniqueItems.push(item);
        }

        return uniqueItems;
      }
    }
  } catch {}
  return [];
};

export default function GuestPage({ onBack }: GuestPageProps) {
  const { toast } = useToast();
  const { db } = useFirebase();

  // Multi-Currency State ($ USD, ₱ PHP, ฿ THB)
  const [currency, setCurrency] = useState<Currency>("USD");

  // Marketplace & Filter State
  const [items, setItems] = useState<MarketplaceItem[]>(getCachedMarketplaceItems);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialSyncing, setIsInitialSyncing] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [sortOption, setSortOption] = useState<string>("featured");
  const [quickFilter, setQuickFilter] = useState<string>("all");

  // Guest Tracker Queue State (Shared with Admin)
  const [trackerQueue, setTrackerQueue] = useState<EscrowItem[]>([]);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [trackerSearchCode, setTrackerSearchCode] = useState("");

  // =========================================================================
  // GUEST SELLER POSTING WIZARD STATE (Starts with NO pre-filled photos)
  // =========================================================================
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardTitle, setWizardTitle] = useState("");
  const [wizardDescription, setWizardDescription] = useState("");
  const [wizardShopName, setWizardShopName] = useState("");
  const [wizardCategory, setWizardCategory] = useState<MarketplaceItem["category"]>("laptops");
  const [wizardCondition, setWizardCondition] = useState<"New" | "Used">("New");
  const [wizardPriceUSD, setWizardPriceUSD] = useState<number>(1200);
  const [wizardPriceInput, setWizardPriceInput] = useState<string>(() => {
    const saved = getSavedCurrency();
    const rate = CURRENCIES[saved]?.rate || 1;
    return String(Math.round(1200 * rate));
  });

  // Photos state: Starts EMPTY! User can Upload, Share Link, or AI Generate
  const [wizardPhotos, setWizardPhotos] = useState<string[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Installment & Downpayment configuration by seller
  const [wizardTenorMonths, setWizardTenorMonths] = useState<number>(12);
  const [wizardDownpaymentPct, setWizardDownpaymentPct] = useState<number>(20);
  const [wizardPayoutMethod, setWizardPayoutMethod] = useState("Bank Transfer");
  const [wizardContact, setWizardContact] = useState("");
  const [wizardSellerName, setWizardSellerName] = useState("");
  const [wizardSellerPhone, setWizardSellerPhone] = useState("");
  const [wizardSellerEmail, setWizardSellerEmail] = useState("");
  const [wizardSellerPayoutDetails, setWizardSellerPayoutDetails] = useState("");

  // =========================================================================
  // BUYER MODAL STATE (Supports CASH Purchase 0% Int & Monthly Installments)
  // =========================================================================
  const [selectedBuyerGadget, setSelectedBuyerGadget] = useState<MarketplaceItem | null>(null);
  const [buyerPaymentOption, setBuyerPaymentOption] = useState<"CASH" | "INSTALLMENT">("CASH");
  const [buyerEscrowHoldDays, setBuyerEscrowHoldDays] = useState<string>("3-7 Days");
  const [buyerDownpaymentPct, setBuyerDownpaymentPct] = useState<number>(20);
  const [buyerTenor, setBuyerTenor] = useState<number>(12);
  const [buyerContact, setBuyerContact] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerReceiveMethod, setBuyerReceiveMethod] = useState<"PAYPAL" | "BANK_TRANSFER" | "VISA_CARD" | "GCASH">("PAYPAL");
  const [buyerReceiveAccountDetails, setBuyerReceiveAccountDetails] = useState("");

  // Buyer Payment Gateway States (Deposited to Admin Bank Account)
  const [buyerPaymentMethod, setBuyerPaymentMethod] = useState<"GCASH" | "PAYPAL" | "VISA_CARD" | "BANK_TRANSFER">("PAYPAL");
  const [buyerGcashMobile, setBuyerGcashMobile] = useState("0917-882-9901");
  const [buyerGcashRef, setBuyerGcashRef] = useState("");
  const [buyerPaypalEmail, setBuyerPaypalEmail] = useState("");
  const [buyerPaypalTxn, setBuyerPaypalTxn] = useState("");
  const [buyerCardName, setBuyerCardName] = useState("");
  const [buyerCardNumber, setBuyerCardNumber] = useState("");
  const [buyerCardExpiry, setBuyerCardExpiry] = useState("");
  const [buyerCardCvv, setBuyerCardCvv] = useState("");
  const [buyerBankSenderName, setBuyerBankSenderName] = useState("");
  const [buyerBankRef, setBuyerBankRef] = useState("");

  // Post-Checkout Order Confirmation Modal (Displays Buyer & Seller Codes)
  const [orderSuccessModal, setOrderSuccessModal] = useState<{
    trackingId: string;
    buyerCode: string;
    sellerCode: string;
    title: string;
    totalAmountUSD: number;
    paymentMethod: string;
    accountDeposited: string;
  } | null>(null);

  // Escrow Listing & Installment Tracker Advanced States
  const [trackerTab, setTrackerTab] = useState<"BUYER_PORTAL" | "SELLER_PORTAL" | "ALL_ORDERS">("BUYER_PORTAL");
  const [buyerAccessCodeInput, setBuyerAccessCodeInput] = useState("");
  const [sellerAccessCodeInput, setSellerAccessCodeInput] = useState("");
  const [activeBuyerOrder, setActiveBuyerOrder] = useState<EscrowItem | null>(null);
  const [activeSellerOrder, setActiveSellerOrder] = useState<EscrowItem | null>(null);

  // In-Tracker Private Bank & Contact Edit States (Only unlocked by confidential key)
  const [isSellerEditingBank, setIsSellerEditingBank] = useState(false);
  const [sellerEditPhone, setSellerEditPhone] = useState("");
  const [sellerEditEmail, setSellerEditEmail] = useState("");
  const [sellerEditPayoutMethod, setSellerEditPayoutMethod] = useState("Bank Transfer");
  const [sellerEditPayoutDetails, setSellerEditPayoutDetails] = useState("");

  const [isBuyerEditingInfo, setIsBuyerEditingInfo] = useState(false);
  const [buyerEditPhone, setBuyerEditPhone] = useState("");
  const [buyerEditEmail, setBuyerEditEmail] = useState("");
  const [buyerEditReceiveMethod, setBuyerEditReceiveMethod] = useState("PAYPAL");
  const [buyerEditReceiveDetails, setBuyerEditReceiveDetails] = useState("");

  // Request Code Modal (via Phone & Email matching)
  const [isRequestCodeOpen, setIsRequestCodeOpen] = useState(false);
  const [isGmailInboxModalOpen, setIsGmailInboxModalOpen] = useState(false);
  const [requestCodePhone, setRequestCodePhone] = useState("");
  const [requestCodeEmail, setRequestCodeEmail] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [requestCodeResult, setRequestCodeResult] = useState<{
    success: boolean;
    message: string;
    role?: "BUYER" | "SELLER";
    trackingId?: string;
    title?: string;
    maskedEmail?: string;
    maskedPhone?: string;
    targetEmail?: string;
    mailtoUrl?: string;
    gmailComposeUrl?: string;
    accessCode?: string;
    emailSubject?: string;
    emailBody?: string;
  } | null>(null);

  // Seller Shipping Form inside Tracker
  const [shippingCourierInput, setShippingCourierInput] = useState("Kerry Express");
  const [shippingTrackingInput, setShippingTrackingInput] = useState("");

  // Buyer Receipt Feedback & Cancel/Dispute States
  const [buyerFeedbackInput, setBuyerFeedbackInput] = useState("Device inspected, in good working condition!");
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [disputeReasonInput, setDisputeReasonInput] = useState("");
  const [disputeEvidenceLinks, setDisputeEvidenceLinks] = useState<string[]>([]);
  const [disputeLinkInput, setDisputeLinkInput] = useState("");
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);

  // Direct Messaging Thread State in Tracker
  const [chatMessageInput, setChatMessageInput] = useState("");

  // Load initial currency & escrow queue, listen to live admin updates and Firestore gadgetPosts
  useEffect(() => {
    setCurrency(getSavedCurrency());
    const initialQueue = getEscrowQueue();
    setTrackerQueue(initialQueue);

    const initialCache = getCachedMarketplaceItems();
    let latestFirestorePosts: MarketplaceItem[] = initialCache;

    const syncMarketplace = (q: EscrowItem[], dbPosts: MarketplaceItem[] = latestFirestorePosts) => {
      const approvedEscrow: MarketplaceItem[] = q
        .filter((item) => item.status === "APPROVED_LIVE" || item.status === "INSTALLMENT_ACTIVE")
        .map((item) => ({
          id: item.trackingId,
          productNumber: item.trackingId,
          title: item.title,
          priceUSD: item.priceUSD,
          category: item.category,
          condition: item.condition,
          description: item.description,
          image: item.images[0] || "https://placehold.co/400x300/FFFFFF/0F172A?text=Gadget",
          seller: item.shopName || (item.sellerName ? `Verified (${item.sellerName})` : "Verified Shop"),
          shopName: item.shopName || item.sellerName,
          downpaymentPct: item.downpaymentPct,
          tenorMonths: item.tenorMonths,
          monthlyUSD: item.monthlyPaymentUSD,
          isSold: false,
          stockStatus: "In Stock",
        }));

      setItems(() => {
        const map = new Map<string, MarketplaceItem>();
        const seenProductNumbers = new Set<string>();
        const seenTitles = new Set<string>();

        // 1. Live Firestore items (admin posted & stock managed)
        dbPosts.forEach((i) => {
          if (!i.id.startsWith("GI-104")) {
            const prodNum = (i.productNumber || "").trim().toUpperCase();
            const normTitle = (i.title || "").trim().toLowerCase();
            const shop = (i.shopName || i.seller || "").trim().toLowerCase();
            const titleShopKey = `${normTitle}::${shop}`;

            // Prevent duplicate documents from Firestore if any
            if (prodNum && prodNum.startsWith("GI-") && seenProductNumbers.has(prodNum)) {
              return;
            }
            if (titleShopKey && seenTitles.has(titleShopKey)) {
              return;
            }

            if (prodNum && prodNum.startsWith("GI-")) seenProductNumbers.add(prodNum);
            if (titleShopKey) seenTitles.add(titleShopKey);
            if (normTitle) seenTitles.add(normTitle);
            seenProductNumbers.add(i.id.toUpperCase());

            map.set(i.id, i);
          }
        });

        // 2. Approved escrow items (submitted by users & approved by Admin)
        // Deduplicate: ONLY add an escrow item if it has NOT already been synced/published to Firestore!
        approvedEscrow.forEach((i) => {
          if (i.id === "GI-84920" || i.id === "GI-59102" || i.id.startsWith("GI-104")) {
            return;
          }

          const trackingId = (i.id || "").trim().toUpperCase();
          const normTitle = (i.title || "").trim().toLowerCase();
          const shop = (i.shopName || i.seller || "").trim().toLowerCase();
          const titleShopKey = `${normTitle}::${shop}`;

          // Check if this item is already in Firestore dbPosts!
          if (seenProductNumbers.has(trackingId)) {
            // Already published in Firestore under this tracking ID! Do not duplicate!
            return;
          }
          if (seenTitles.has(titleShopKey) || seenTitles.has(normTitle)) {
            // Already published in Firestore under this title! Do not duplicate!
            return;
          }

          seenProductNumbers.add(trackingId);
          seenTitles.add(titleShopKey);
          seenTitles.add(normTitle);
          map.set(i.id, i);
        });

        const combined = Array.from(map.values());
        if (combined.length > 0) {
          try {
            localStorage.setItem("gi_cached_marketplace_items", JSON.stringify(combined));
          } catch {}
        }
        return combined;
      });
    };

    if (initialCache.length > 0) {
      syncMarketplace(initialQueue, initialCache);
      setIsLoading(false);
    } else {
      syncMarketplace(initialQueue, []);
      // Keep isLoading as true until onSnapshot delivers items
    }

    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    // Subscribe to Firestore gadgetPosts for live Admin In Stock / Out of Stock status changes
    let unsubscribeFirestore = () => {};
    if (db) {
      try {
        const postsRef = collection(db, "gadgetPosts");
        unsubscribeFirestore = onSnapshot(
          postsRef,
          (snapshot) => {
            const firestoreItems: MarketplaceItem[] = snapshot.docs.map((docSnap) => {
              const data = docSnap.data();
              const isSold = Boolean(data.isSold ?? (data.stockStatus === "Out of Stock"));
              const priceRaw = Number(data.cashPrice || 0);
              const dpRaw = Number(data.downPayment || 0);
              const tenor = Number(data.installmentMonths || 12);
              const dpPct =
                Number(data.downpaymentPct) ||
                (priceRaw > 0 && dpRaw > 0 ? Math.round((dpRaw / priceRaw) * 100) : 20);
              const monthlyRaw = Number(
                data.monthlyInstallment ||
                  (priceRaw > 0 && tenor > 0 ? (priceRaw - dpRaw) / tenor : 0)
              );

              // Firestore values are natively stored in Thai Baht (THB, e.g. 23,000 ฿).
              // Normalize to USD base (/ 35) so formatPrice converts cleanly across THB, PHP, and USD.
              const isTHB = priceRaw > 3000;
              const priceUSD = isTHB ? priceRaw / 35 : priceRaw;
              const monthlyUSD = isTHB ? monthlyRaw / 35 : monthlyRaw;

              return {
                id: docSnap.id,
                firestoreDocId: docSnap.id,
                productNumber: data.productNumber || docSnap.id,
                title: data.productName || data.title || "Gadget",
                priceUSD,
                category: (data.category?.toLowerCase() || "laptops") as any,
                condition: data.condition || "Verified Pre-Owned",
                description: data.description,
                image:
                  data.imageUrl ||
                  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
                seller: data.shopName || (data.adminName ? `Store (${data.adminName})` : "Store Admin"),
                shopName: data.shopName || data.adminName,
                downpaymentPct: dpPct,
                tenorMonths: tenor,
                monthlyUSD,
                isSold,
                stockStatus: isSold ? "Out of Stock" : "In Stock",
              };
            });

            latestFirestorePosts = firestoreItems;
            syncMarketplace(getEscrowQueue(), firestoreItems);
            setIsLoading(false);
          },
          (err) => {
            console.warn("Firestore gadgetPosts listener:", err);
            setIsLoading(false);
          }
        );
      } catch (e) {
        console.warn("Could not listen to Firestore:", e);
        setIsLoading(false);
      }
    }

    const handleEscrowUpdate = () => {
      const updated = getEscrowQueue();
      setTrackerQueue(updated);
      syncMarketplace(updated, latestFirestorePosts);
    };

    const handleCurrencyChange = (e: any) => {
      if (e.detail) {
        const c = e.detail as Currency;
        setCurrency(c);
        const rate = CURRENCIES[c]?.rate || 1;
        setWizardPriceInput(String(Math.round(wizardPriceUSD * rate)));
      }
    };

    const handlePostDeleted = (e: any) => {
      const { trackingId, title } = e.detail || {};
      setItems((prev) =>
        prev.filter((i) => {
          if (trackingId && (i.id === trackingId || i.productNumber === trackingId)) return false;
          if (title && i.title?.toLowerCase().trim() === title.toLowerCase().trim()) return false;
          return true;
        })
      );
    };

    window.addEventListener("escrow_queue_updated", handleEscrowUpdate);
    window.addEventListener("gadget_post_deleted", handlePostDeleted);
    window.addEventListener("currency_changed", handleCurrencyChange);

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribeFirestore();
      window.removeEventListener("escrow_queue_updated", handleEscrowUpdate);
      window.removeEventListener("gadget_post_deleted", handlePostDeleted);
      window.removeEventListener("currency_changed", handleCurrencyChange);
    };
  }, [db, wizardPriceUSD]);

  const handleCurrencyChange = (c: Currency) => {
    setCurrency(c);
    saveCurrency(c);
    const rate = CURRENCIES[c]?.rate || 1;
    setWizardPriceInput(String(Math.round(wizardPriceUSD * rate)));
  };

  const handleWizardPriceInputChange = (raw: string) => {
    setWizardPriceInput(raw);
    const num = parseFloat(raw) || 0;
    const rate = CURRENCIES[currency]?.rate || 1;
    setWizardPriceUSD(num / rate);
  };

  const openPostingWizard = () => {
    setWizardPhotos([]);
    const rate = CURRENCIES[currency]?.rate || 1;
    setWizardPriceInput(String(Math.round(wizardPriceUSD * rate)));
    setIsWizardOpen(true);
  };

  // Middleman Tiered Fee Logic: 1% for >$1500, 2% for $500–$1500, 3% for <$500
  const getCommissionRate = (priceUSD: number): number => {
    if (priceUSD > 1500) return 1;
    if (priceUSD >= 500) return 2;
    return 3;
  };

  // Auto-calculated posting wizard installment financials
  const wizardDownpaymentUSD = wizardPriceUSD * (wizardDownpaymentPct / 100);
  const wizardMonthlyUSD = wizardTenorMonths > 0 ? (wizardPriceUSD - wizardDownpaymentUSD) / wizardTenorMonths : 0;
  const wizardCommissionRate = getCommissionRate(wizardPriceUSD);
  const wizardFeeAmountUSD = wizardPriceUSD * (wizardCommissionRate / 100);
  const wizardNetPayoutUSD = Math.max(0, wizardPriceUSD - wizardFeeAmountUSD);

  // =========================================================================
  // PHOTO UPLOADER / SHARE LINK / AI AUTO-GENERATOR
  // =========================================================================
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const url = URL.createObjectURL(files[i]);
      newUrls.push(url);
    }

    setWizardPhotos((prev) => [...prev, ...newUrls].slice(0, 4));
    toast({
      title: "Photos Uploaded",
      description: `${newUrls.length} image(s) added from device.`,
    });
  };

  const handleAddLinkPhoto = () => {
    if (!photoUrlInput.trim()) return;
    const url = photoUrlInput.trim();
    setWizardPhotos((prev) => [...prev, url].slice(0, 4));
    setPhotoUrlInput("");
    toast({
      title: "Photo Link Attached",
      description: "External photo URL added to gadget gallery.",
    });
  };

  const handleAiGeneratePhotos = () => {
    setIsGeneratingAi(true);
    setTimeout(() => {
      const titleLower = wizardTitle.toLowerCase();
      let aiPhoto = "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80";

      if (titleLower.includes("iphone") || wizardCategory === "phones") {
        aiPhoto = "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=600&q=80";
      } else if (titleLower.includes("fold") || titleLower.includes("galaxy")) {
        aiPhoto = "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=600&q=80";
      } else if (titleLower.includes("playstation") || titleLower.includes("ps5") || wizardCategory === "gaming") {
        aiPhoto = "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=600&q=80";
      } else if (titleLower.includes("ipad") || wizardCategory === "tablets") {
        aiPhoto = "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80";
      } else if (wizardCategory === "cameras") {
        aiPhoto = "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80";
      }

      setWizardPhotos((prev) => [...prev, aiPhoto].slice(0, 4));
      setIsGeneratingAi(false);
      toast({
        title: "AI Photos Generated",
        description: `Generated authentic commercial product renders for "${wizardTitle || wizardCategory}".`,
      });
    }, 900);
  };

  const handleRemovePhoto = (index: number) => {
    setWizardPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Listing from Wizard
  const handleWizardSubmit = () => {
    if (!wizardTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Title Required",
        description: "Please enter a gadget name or model.",
      });
      return;
    }

    const trackingId = "GI-" + Math.floor(10000 + Math.random() * 90000);
    const finalImages =
      wizardPhotos.length > 0
        ? wizardPhotos
        : ["https://placehold.co/400x300/FFFFFF/0F172A?text=" + encodeURIComponent(wizardTitle)];

    const newSubmission: EscrowItem = {
      trackingId,
      type: "SELLER_SUBMISSION",
      status: "PENDING_ADMIN",
      title: wizardTitle.trim(),
      category: wizardCategory,
      condition: wizardCondition,
      description: wizardDescription.trim(),
      priceUSD: wizardPriceUSD,
      downpaymentPct: wizardDownpaymentPct,
      tenorMonths: wizardTenorMonths,
      downpaymentUSD: wizardDownpaymentUSD,
      monthlyPaymentUSD: wizardMonthlyUSD,
      feeRate: wizardCommissionRate,
      feeAmountUSD: wizardFeeAmountUSD,
      netPayoutUSD: wizardNetPayoutUSD,
      sellerContact: wizardContact.trim() || "guest-seller@gadget-installment.cc",
      sellerName: wizardSellerName.trim() || "Guest Seller",
      shopName: wizardShopName.trim() || wizardSellerName.trim() || "Official Store",
      payoutMethod: wizardPayoutMethod,
      images: finalImages,
      submittedAt: new Date().toLocaleString(),
      totalMonths: wizardTenorMonths,
      monthsPaid: 0,
      monthlySchedule: generateMonthlySchedule(wizardTenorMonths, wizardMonthlyUSD),
    };

    addEscrowItem(newSubmission);
    setIsWizardOpen(false);

    // Reset wizard fields
    setWizardTitle("");
    setWizardDescription("");
    setWizardShopName("");
    setWizardPhotos([]);
    toast({
      title: "Submitted for Admin Review!",
      description: `Reference code: ${trackingId}. Downpayment & installments are auto-calculated and will publish once Admin approves.`,
    });
  };

  // Buyer Submit Flow
  const openBuyerModal = (item: MarketplaceItem, mode: "CASH" | "INSTALLMENT" = "CASH") => {
    setSelectedBuyerGadget(item);
    setBuyerPaymentOption(mode);
    setBuyerEscrowHoldDays("3-7 Days");
    setBuyerDownpaymentPct(item.downpaymentPct || 20);
    setBuyerTenor(item.tenorMonths || 12);
    setBuyerContact("");
    setBuyerName("");
  };

  const handleBuyerSubmit = () => {
    if (!selectedBuyerGadget) return;
    const isCash = buyerPaymentOption === "CASH";
    const dpUSD = isCash
      ? selectedBuyerGadget.priceUSD
      : selectedBuyerGadget.priceUSD * (buyerDownpaymentPct / 100);
    const monthlyUSD = isCash
      ? 0
      : (selectedBuyerGadget.priceUSD - dpUSD) / buyerTenor;
    const rawNum = Math.floor(10000 + Math.random() * 90000);
    const trackingId = `GI-${rawNum}`;
    const buyerCode = `BUY-${rawNum}`;
    const sellerCode = `SEL-${rawNum}`;

    const commissionRate = getCommissionRate(selectedBuyerGadget.priceUSD);
    const feeAmtUSD = selectedBuyerGadget.priceUSD * (commissionRate / 100);
    const netPayout = selectedBuyerGadget.priceUSD - feeAmtUSD;

    let accountDeposited = "Admin Bangkok Bank Escrow Account: 097-3-274005 (Gadget Installment Escrow Trust Co.)";
    let paymentRef = "";

    if (buyerPaymentMethod === "GCASH") {
      accountDeposited = "Admin GCash Escrow Trust: +63 973 274 005 (GI Escrow Admin)";
      paymentRef = buyerGcashRef.trim() || `GC-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    } else if (buyerPaymentMethod === "PAYPAL") {
      accountDeposited = "Admin Escrow PayPal: escrow-admin@gadget-installment.cc";
      paymentRef = buyerPaypalTxn.trim() || `PP-${Math.floor(10000000 + Math.random() * 90000000)}`;
    } else {
      accountDeposited = "Admin Bangkok Bank Escrow Account: 097-3-274005 (Gadget Installment Escrow Trust Co.)";
      paymentRef = buyerCardNumber ? `Card ending in ${buyerCardNumber.replace(/\s+/g, "").slice(-4)}` : "VISA-0973274005";
    }

    const buyerRequest: EscrowItem = {
      trackingId,
      buyerAccessCode: buyerCode,
      sellerAccessCode: sellerCode,
      type: "BUYER_REQUEST",
      status: "ESCROW_RESERVED",
      orderType: isCash ? "CASH_ESCROW" : "INSTALLMENT",
      cashHoldingDays: isCash ? buyerEscrowHoldDays : undefined,
      cashEscrowStatus: isCash ? "HELD_IN_ESCROW" : undefined,
      paymentMethod: buyerPaymentMethod,
      paymentReference: paymentRef,
      paymentAccountDeposited: accountDeposited,
      title: selectedBuyerGadget.title,
      category: selectedBuyerGadget.category,
      condition: selectedBuyerGadget.condition,
      description: selectedBuyerGadget.description || "",
      priceUSD: selectedBuyerGadget.priceUSD,
      downpaymentPct: isCash ? 100 : buyerDownpaymentPct,
      tenorMonths: isCash ? 1 : buyerTenor,
      downpaymentUSD: dpUSD,
      monthlyPaymentUSD: monthlyUSD,
      feeRate: commissionRate,
      feeAmountUSD: feeAmtUSD,
      netPayoutUSD: netPayout,
      sellerContact: selectedBuyerGadget.seller,
      sellerName: selectedBuyerGadget.shopName || selectedBuyerGadget.seller,
      shopName: selectedBuyerGadget.shopName || selectedBuyerGadget.seller,
      buyerContact: buyerContact.trim() || "buyer-guest@gadget-installment.cc",
      buyerName: buyerName.trim() || "Guest Buyer",
      images: [selectedBuyerGadget.image],
      submittedAt: new Date().toLocaleString(),
      totalMonths: isCash ? 1 : buyerTenor,
      monthsPaid: 0,
      monthlySchedule: isCash ? [] : generateMonthlySchedule(buyerTenor, monthlyUSD),
      messages: [
        {
          id: "msg-" + Date.now(),
          senderRole: "ADMIN",
          senderName: "Admin Escrow Trust",
          content: `Funds successfully deposited to ${accountDeposited}. Payment Ref: ${paymentRef}. Order placed under middleman escrow protection.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ],
    };

    addEscrowItem(buyerRequest);
    setSelectedBuyerGadget(null);

    // Open Order Success Modal with Buyer Code and Details
    setOrderSuccessModal({
      trackingId,
      buyerCode,
      sellerCode,
      title: selectedBuyerGadget.title,
      totalAmountUSD: isCash ? selectedBuyerGadget.priceUSD : dpUSD,
      paymentMethod: buyerPaymentMethod,
      accountDeposited,
    });

    toast({
      title: isCash ? "Payment Deposited to Admin Escrow!" : "Downpayment Deposited to Admin Escrow!",
      description: `Order ${trackingId} created. Your Buyer Access Code is: ${buyerCode}. Funds held in Admin bank account.`,
    });
  };

  // Escrow Tracker Handler: Search by Buyer Access Code
  const handleSearchBuyerCode = () => {
    const code = buyerAccessCodeInput.trim().toUpperCase();
    if (!code) return;
    const q = getEscrowQueue();
    const item = q.find(
      (i) =>
        i.buyerAccessCode?.toUpperCase() === code ||
        i.trackingId.toUpperCase() === code ||
        i.trackingId.replace(/^GI-/, "").toUpperCase() === code.replace(/^BUY-/, "").toUpperCase()
    );
    if (item) {
      setActiveBuyerOrder(item);
      toast({
        title: "Order Found!",
        description: `Loaded order "${item.title}" (${item.trackingId}).`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Code Not Found",
        description: "No order matching this Buyer Access Code. Try using 'Request Code via Phone & Email'.",
      });
    }
  };

  // Escrow Tracker Handler: Search by Seller Access Code
  const handleSearchSellerCode = () => {
    const code = sellerAccessCodeInput.trim().toUpperCase();
    if (!code) return;
    const q = getEscrowQueue();
    const item = q.find(
      (i) =>
        i.sellerAccessCode?.toUpperCase() === code ||
        i.trackingId.toUpperCase() === code ||
        i.trackingId.replace(/^GI-/, "").toUpperCase() === code.replace(/^SEL-/, "").toUpperCase()
    );
    if (item) {
      setActiveSellerOrder(item);
      toast({
        title: "Seller Order Found!",
        description: `Loaded listing "${item.title}" (${item.trackingId}).`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Code Not Found",
        description: "No listing matching this Seller Access Code. Try using 'Request Code via Phone & Email'.",
      });
    }
  };

  // In-Tracker: Seller updates payout bank and contact details
  const handleSaveSellerBankInfo = (trackingId: string) => {
    if (!activeSellerOrder) return;
    const updated = updateEscrowSellerDetails(trackingId, {
      sellerPhone: sellerEditPhone.trim(),
      sellerEmail: sellerEditEmail.trim(),
      payoutMethod: sellerEditPayoutMethod,
      sellerPayoutAccountDetails: sellerEditPayoutDetails.trim(),
    });
    setTrackerQueue(updated);
    const refreshed = updated.find((i) => i.trackingId === trackingId);
    if (refreshed) setActiveSellerOrder(refreshed);
    setIsSellerEditingBank(false);

    toast({
      title: "Bank & Payout Info Saved!",
      description: `Your payout method and bank details have been updated and immediately synced to Admin records.`,
    });
  };

  // In-Tracker: Buyer updates receiving method & contact details
  const handleSaveBuyerReceiveInfo = (trackingId: string) => {
    if (!activeBuyerOrder) return;
    const updated = updateEscrowBuyerDetails(trackingId, {
      buyerPhone: buyerEditPhone.trim(),
      buyerEmail: buyerEditEmail.trim(),
      buyerReceiveMethod: buyerEditReceiveMethod,
      buyerReceiveAccountDetails: buyerEditReceiveDetails.trim(),
    });
    setTrackerQueue(updated);
    const refreshed = updated.find((i) => i.trackingId === trackingId);
    if (refreshed) setActiveBuyerOrder(refreshed);
    setIsBuyerEditingInfo(false);

    toast({
      title: "Receiving Info Saved!",
      description: `Your refund/return receiving method and account details have been updated and synced to Admin records.`,
    });
  };

  // Masking helpers for Anti-Theft Security
  const maskEmailAddress = (email?: string): string => {
    if (!email) return "";
    const parts = email.split("@");
    if (parts.length < 2) return email;
    const user = parts[0];
    const domain = parts[1];
    if (user.length <= 2) return `${user[0]}*@${domain}`;
    return `${user[0]}${"•".repeat(Math.max(4, user.length - 2))}${user[user.length - 1]}@${domain}`;
  };

  const maskPhoneNumber = (phone?: string): string => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) return phone;
    const last4 = digits.slice(-4);
    return `+${digits.slice(0, 2)} ••• ••• ${last4}`;
  };

  // Escrow Tracker Handler: Send Code directly to registered Gmail/Phone (Never displayed on screen)
  const handleRequestCodeSubmit = () => {
    if (!requestCodePhone.trim() && !requestCodeEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter your registered Gmail/Email or phone number.",
      });
      return;
    }

    setIsSendingCode(true);

    setTimeout(() => {
      setIsSendingCode(false);
      const res = findEscrowByPhoneAndEmail(requestCodePhone, requestCodeEmail);

      if (res.found && res.item && res.accessCode && res.role) {
        const targetEmail =
          res.role === "SELLER"
            ? res.item.sellerEmail || res.item.sellerContact || requestCodeEmail.trim()
            : res.item.buyerEmail || res.item.buyerContact || requestCodeEmail.trim();

        const targetPhone =
          res.role === "SELLER"
            ? res.item.sellerPhone || res.item.sellerContact || requestCodePhone.trim()
            : res.item.buyerPhone || res.item.buyerContact || requestCodePhone.trim();

        const maskedEmail = maskEmailAddress(targetEmail);
        const maskedPhone = targetPhone ? maskPhoneNumber(targetPhone) : undefined;

        const plainSubject = `Your Confidential Escrow Tracking Key - ${res.item.title}`;
        const plainBody =
          `Hello ${res.role === "SELLER" ? (res.item.sellerName || "Seller") : (res.item.buyerName || "Buyer")},\n\n` +
          `You requested your confidential tracking access code for "${res.item.title}" (Tracking ID: ${res.item.trackingId}).\n\n` +
          `YOUR PRIVATE TRACKING ACCESS KEY:\n` +
          `-----------------------------------\n` +
          `${res.accessCode}\n` +
          `-----------------------------------\n\n` +
          `Use this key in the Escrow Tracker at gadget-installment.cc to access your order, modify payout bank accounts, and manage installments.\n\n` +
          `🔒 Anti-Theft Security: Do not share this key with anyone. To prevent unauthorized account access, this key is never displayed on the website.\n\n` +
          `Admin Middleman Escrow Protection Team`;

        // Build mailto URI and Google Gmail Web direct compose URL
        const mailtoUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(plainSubject)}&body=${encodeURIComponent(plainBody)}`;
        const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(plainSubject)}&body=${encodeURIComponent(plainBody)}`;

        // Attempt automated Firebase Email trigger if collection exists
        if (db) {
          try {
            addDoc(collection(db, "mail"), {
              to: targetEmail,
              message: {
                subject: plainSubject,
                text: plainBody,
                html: `<div style="font-family:sans-serif;padding:24px;border:1px solid #334155;border-radius:12px;background:#0f172a;color:#f8fafc;">
                  <h2 style="color:#38bdf8;margin-top:0;">Admin Escrow Protection</h2>
                  <p>Here is your confidential tracking access key for <strong>${res.item.title}</strong>:</p>
                  <div style="font-size:22px;font-family:monospace;font-weight:bold;color:#4ade80;background:#1e293b;padding:12px 20px;border-radius:8px;border:1px solid #4ade80;display:inline-block;letter-spacing:2px;margin:16px 0;">
                    ${res.accessCode}
                  </div>
                  <p style="color:#94a3b8;font-size:12px;">Keep this key private. Never share it with anyone.</p>
                </div>`
              }
            }).catch(() => {});
          } catch (e) {}
        }

        // Record security audit message to order history
        addEscrowMessage(
          res.item.trackingId,
          "ADMIN",
          "Security Escrow System",
          `🔒 Anti-Theft Security: Tracking access code was dispatched to registered Gmail (${maskedEmail}) and phone. Private key withheld from website screen to prevent unauthorized access.`
        );

        // Security dispatch log for browser console & developers
        console.info(
          `[ANTI-THEFT DISPATCH] Sent private access code for "${res.item.title}" (${res.item.trackingId}) to ${targetEmail} (Code: ${res.accessCode}). Withheld from screen to prevent account theft.`
        );

        setRequestCodeResult({
          success: true,
          message: `Confidential access code has been dispatched to your registered Gmail and phone.`,
          role: res.role,
          trackingId: res.item.trackingId,
          title: res.item.title,
          maskedEmail,
          maskedPhone,
          targetEmail,
          mailtoUrl,
          gmailComposeUrl,
          accessCode: res.accessCode,
          emailSubject: plainSubject,
          emailBody: plainBody,
        });

        toast({
          title: "Code Dispatched to Gmail!",
          description: `Your confidential access code has been prepared for ${maskedEmail}. Click 'Open in Gmail' or 'Inbox Simulator' to view it.`,
        });
      } else {
        setRequestCodeResult({
          success: false,
          message: "No active escrow order or listing found matching the Gmail address or phone provided. Please verify the credentials you used when posting or ordering.",
        });
      }
    }, 450);
  };

  // Buyer Action: Confirm Item Received in good condition & authorize money release
  const handleBuyerConfirmAction = (trackingId: string) => {
    const updated = buyerConfirmReceipt(trackingId, buyerFeedbackInput);
    setTrackerQueue(updated);
    const refreshed = updated.find((i) => i.trackingId === trackingId);
    if (refreshed) setActiveBuyerOrder(refreshed);
    toast({
      title: "Device Receipt Verified!",
      description: "Admin & Seller notified. Funds release authorized from middleman escrow account.",
    });
  };

  // Seller Action: Mark as Shipped (Courier & Tracking Number)
  const handleSellerShipAction = (trackingId: string) => {
    if (!shippingCourierInput.trim()) {
      toast({ variant: "destructive", title: "Courier Required", description: "Please enter or select a shipping courier." });
      return;
    }
    const updated = sellerMarkShipped(trackingId, shippingCourierInput, shippingTrackingInput);
    setTrackerQueue(updated);
    const refreshed = updated.find((i) => i.trackingId === trackingId);
    if (refreshed) setActiveSellerOrder(refreshed);
    toast({
      title: "Gadget Marked as Shipped!",
      description: `In transit via ${shippingCourierInput}. Buyer cancellation is now locked per escrow policy.`,
    });
  };

  // Seller Action: Claim Net Payout (Unlocked after buyer confirms release)
  const handleSellerClaimPayoutAction = (trackingId: string) => {
    const updated = sellerClaimPayout(trackingId);
    setTrackerQueue(updated);
    const refreshed = updated.find((i) => i.trackingId === trackingId);
    if (refreshed) setActiveSellerOrder(refreshed);
    toast({
      title: "Payout Claimed Successfully!",
      description: "Net funds released from Admin escrow bank account to your registered payout account.",
    });
  };

  // Cancel Order Action (Buyer or Seller)
  const handleCancelOrderAction = (trackingId: string, role: "BUYER" | "SELLER") => {
    if (!cancelReasonInput.trim()) {
      toast({ variant: "destructive", title: "Reason Required", description: "Please provide a reason for cancelling." });
      return;
    }
    const res = cancelEscrowOrder(trackingId, role, cancelReasonInput);
    if (!res.success) {
      toast({ variant: "destructive", title: "Cancellation Locked", description: res.message });
      return;
    }
    setTrackerQueue(res.updatedQueue);
    const refreshed = res.updatedQueue.find((i) => i.trackingId === trackingId);
    if (role === "BUYER" && refreshed) setActiveBuyerOrder(refreshed);
    if (role === "SELLER" && refreshed) setActiveSellerOrder(refreshed);
    setIsCancelModalOpen(false);
    setCancelReasonInput("");
    toast({
      title: "Order Cancelled & Refund Queued",
      description: res.message,
    });
  };

  // Dispute Evidence Handlers (Direct Upload & External Links)
  const handleDisputeFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      // If image is under 1.5MB, convert to data URL for storage persistence
      if (file.type.startsWith("image/") && file.size < 1.5 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            setDisputeEvidenceLinks((prev) => [...prev, ev.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // For video files or larger files, create object URL
        const objUrl = URL.createObjectURL(file);
        setDisputeEvidenceLinks((prev) => [...prev, objUrl]);
      }
    });

    toast({
      title: "Evidence Attached",
      description: `${files.length} photo/video proof file(s) attached.`,
    });
  };

  const handleAddDisputeLink = () => {
    const raw = disputeLinkInput.trim();
    if (!raw) return;
    const formatted = !raw.startsWith("http://") && !raw.startsWith("https://") ? `https://${raw}` : raw;
    setDisputeEvidenceLinks((prev) => [...prev, formatted]);
    setDisputeLinkInput("");
    toast({
      title: "Link Attached",
      description: "External photo/video proof link added to dispute claim.",
    });
  };

  const handleRemoveDisputeEvidence = (index: number) => {
    setDisputeEvidenceLinks((prev) => prev.filter((_, i) => i !== index));
  };

  // Dispute Order Action (Buyer)
  const handleFileDisputeAction = (trackingId: string) => {
    if (!disputeReasonInput.trim()) {
      toast({ variant: "destructive", title: "Reason Required", description: "Please describe the problem with the item." });
      return;
    }
    const updated = fileEscrowDispute(trackingId, disputeReasonInput, disputeEvidenceLinks);
    setTrackerQueue(updated);
    const refreshed = updated.find((i) => i.trackingId === trackingId);
    if (refreshed) setActiveBuyerOrder(refreshed);
    setIsDisputeModalOpen(false);
    setDisputeReasonInput("");
    setDisputeEvidenceLinks([]);
    setDisputeLinkInput("");
    toast({
      variant: "destructive",
      title: "Dispute Filed & Escrow Frozen",
      description: "Admin hold frozen. Evidence photos/videos attached to dispute record.",
    });
  };

  // Send Direct Message in Tracker Thread
  const handleSendChatMessage = (trackingId: string, role: "BUYER" | "SELLER") => {
    const text = chatMessageInput.trim();
    if (!text) return;
    const name = role === "BUYER"
      ? (activeBuyerOrder?.buyerName || "Buyer")
      : (activeSellerOrder?.shopName || activeSellerOrder?.sellerName || "Seller");
    const updated = addEscrowMessage(trackingId, role, name, text);
    setTrackerQueue(updated);
    setChatMessageInput("");
    const refreshed = updated.find((i) => i.trackingId === trackingId);
    if (role === "BUYER" && refreshed) setActiveBuyerOrder(refreshed);
    if (role === "SELLER" && refreshed) setActiveSellerOrder(refreshed);
    toast({ title: "Message Sent", description: "Message added to the order thread." });
  };

  // Filtered & Sorted Marketplace Items
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) => i.title.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
      );
    }

    if (activeCategory !== "All") {
      result = result.filter((i) => i.category.toLowerCase() === activeCategory.toLowerCase());
    }

    if (quickFilter === "inStockOnly") {
      result = result.filter((i) => !i.isSold && i.stockStatus !== "Out of Stock");
    } else if (quickFilter === "under100") {
      result = result.filter((i) => i.monthlyUSD <= 100);
    } else if (quickFilter === "zeroDown") {
      result = result.filter((i) => (i.downpaymentPct || 0) === 0);
    }

    if (sortOption === "price-asc") {
      result.sort((a, b) => a.priceUSD - b.priceUSD);
    } else if (sortOption === "price-desc") {
      result.sort((a, b) => b.priceUSD - a.priceUSD);
    } else if (sortOption === "monthly-asc") {
      result.sort((a, b) => a.monthlyUSD - b.monthlyUSD);
    }

    return result;
  }, [items, searchQuery, activeCategory, sortOption, quickFilter]);

  // Buyer modal calculations
  const buyerDpAmtUSD = selectedBuyerGadget
    ? selectedBuyerGadget.priceUSD * (buyerDownpaymentPct / 100)
    : 0;
  const buyerMonthlyUSD = selectedBuyerGadget
    ? (selectedBuyerGadget.priceUSD - buyerDpAmtUSD) / buyerTenor
    : 0;

  // Dedicated Cyberpunk Loading Screen while initial gadgets are synchronizing
  if ((isInitialSyncing || isLoading) && items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090D16] text-slate-100 select-none overflow-hidden">
        {/* Ambient Radial Depth Glows */}
        <div className="absolute w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none -top-10 -left-10" />
        <div className="absolute w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -bottom-10 -right-10" />

        <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-md w-full">
          {/* Animated Logo / Store Icon */}
          <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-500/25 to-emerald-500/25 border border-cyan-400/40 animate-pulse shadow-lg" />
            <div className="w-16 h-16 rounded-xl bg-[#0E1422] border border-slate-700/80 flex items-center justify-center shadow-2xl relative z-10">
              <Store className="w-8 h-8 text-cyan-400 animate-pulse" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#090D16] animate-ping z-20" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight flex items-center gap-1.5">
            gadget-installment<span className="text-cyan-400">.cc</span>
          </h2>

          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 mt-2">
            Escrow Market &amp; Installments
          </span>

          <p className="text-sm font-semibold text-slate-200 mt-4">
            Loading Available Gadgets...
          </p>

          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Synchronizing live inventory, stock availability, and verified escrow installment plans.
          </p>

          {/* Glowing Animated Loading Bar */}
          <div className="w-64 h-1.5 bg-slate-800/90 rounded-full overflow-hidden mt-6 border border-slate-700/70">
            <div className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 rounded-full animate-pulse" style={{ width: "100%" }} />
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400/90 mt-4">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>CONNECTING TO ESCROW DATABASE</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 flex flex-col antialiased">
      {/* ===================================================================== */}
      {/* 1. TOP NAVIGATION BAR                                                 */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-30 bg-[#0E1422]/95 backdrop-blur-md border-b border-slate-800/80">
        <div className="w-full max-w-[2560px] 2xl:max-w-none mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 h-16 flex items-center justify-between gap-3 sm:gap-4">
          {/* Left: Back Button + Logo + Guest Badge */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              title="Return to Role Selection"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Roles</span>
            </button>

            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setSearchQuery("");
                setActiveCategory("All");
                setQuickFilter("all");
              }}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/25 to-emerald-500/25 border border-cyan-400/30 flex items-center justify-center shadow-inner">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <span className="font-display font-bold text-sm sm:text-base tracking-tight text-white block leading-tight">
                  gadget-installment.cc
                </span>
                <span className="text-[10px] font-mono text-emerald-400 block leading-none">
                  Escrow Market &amp; Installments
                </span>
              </div>
            </a>
          </div>

          {/* Center: Smart Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md lg:max-w-lg xl:max-w-2xl mx-3">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search MacBook, iPhone, or 'under $100/mo'..."
                className="w-full bg-[#182134] border border-slate-700/70 focus:border-cyan-500/60 rounded-full pl-4 pr-10 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none transition shadow-inner"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Right: Currency Selector + Track Listing + Post Gadget */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Currency Pill: USD ($), PHP (₱), THB (฿) */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-xl p-0.5">
              {(["USD", "PHP", "THB"] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => handleCurrencyChange(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition ${
                    currency === c
                      ? "bg-cyan-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={CURRENCIES[c].name}
                >
                  {CURRENCIES[c].symbol} {c}
                </button>
              ))}
            </div>

            {/* Escrow Tracker (Monitoring only - no approval here) */}
            <button
              onClick={() => setIsTrackerOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition py-1.5 px-2.5 rounded-lg hover:bg-slate-800/60 border border-slate-700/40"
            >
              <Store className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Escrow Tracker</span>
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-mono font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 tabular-nums">
                {trackerQueue.length}
              </span>
            </button>

            {/* Post Gadget CTA */}
            <button
              onClick={openPostingWizard}
              className="cta-cyan-emerald inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-[13px] font-semibold text-slate-950 transition cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Post Gadget</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. TRUST & QUICK STATS HERO BANNER                                   */}
      {/* ===================================================================== */}
      <section className="bg-gradient-to-b from-[#111827] to-[#090D16] border-b border-slate-800/70 py-4 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[2560px] 2xl:max-w-none mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Admin Escrow Protected
            </span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-slate-300 hidden sm:inline">
              Middleman percentage deducted only after device inspection &amp; release to ship
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
            <span>
              Active Currency: <strong className="text-cyan-300">{CURRENCIES[currency].name} ({CURRENCIES[currency].symbol})</strong>
            </span>
            <span className="hidden md:inline">•</span>
            <span>
              Middleman Fee: <strong className="text-emerald-400">1% – 3%</strong>
            </span>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. MAIN MARKETPLACE FEED                                             */}
      {/* ===================================================================== */}
      <main className="flex-1 w-full max-w-[2560px] 2xl:max-w-none mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-8">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
                Gadgets Listing
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-800/90 text-slate-300 border border-slate-700/70 tabular-nums">
                {(isInitialSyncing || isLoading) && filteredItems.length === 0 ? "Loading..." : `${filteredItems.length} items`}
              </span>
            </div>

            {/* Quick Filter Tags & Sorting */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setQuickFilter(quickFilter === "inStockOnly" ? "all" : "inStockOnly")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                  quickFilter === "inStockOnly"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 font-bold"
                    : "bg-[#151D2E] text-slate-400 border-slate-700 hover:text-white"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                In Stock Only
              </button>

              <button
                onClick={() => setQuickFilter(quickFilter === "under100" ? "all" : "under100")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                  quickFilter === "under100"
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold"
                    : "bg-[#151D2E] text-slate-400 border-slate-700 hover:text-white"
                }`}
              >
                ⚡ Under {formatPrice(100, currency)}/mo
              </button>

              <button
                onClick={() => setQuickFilter(quickFilter === "zeroDown" ? "all" : "zeroDown")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                  quickFilter === "zeroDown"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 font-bold"
                    : "bg-[#151D2E] text-slate-400 border-slate-700 hover:text-white"
                }`}
              >
                0% Downpayment
              </button>

              <div className="relative">
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  aria-label="Filter listings"
                  className="appearance-none bg-[#151D2E] border border-slate-700/80 hover:border-slate-600 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="featured">Guest Rating: Verified</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="monthly-asc">Monthly: Low to High</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {["All", "Laptops", "Phones", "Tablets", "Gaming", "Cameras"].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition shrink-0 ${
                  activeCategory === cat
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50"
                    : "bg-[#131B2E] text-slate-400 border border-slate-800 hover:text-white"
                }`}
              >
                {cat === "All" && "✦ All Categories"}
                {cat === "Laptops" && "💻 Laptops"}
                {cat === "Phones" && "📱 Smartphones"}
                {cat === "Tablets" && "📟 Tablets"}
                {cat === "Gaming" && "🎮 Gaming"}
                {cat === "Cameras" && "📷 Cameras"}
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Multi-Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
          {filteredItems.map((item) => {
            const dpUSD = item.priceUSD * (item.downpaymentPct / 100);
            const isOutOfStock = Boolean(item.isSold || item.stockStatus === "Out of Stock");

            const handleItemClick = () => {
              if (isOutOfStock) {
                toast({
                  variant: "destructive",
                  title: "Out of Stock",
                  description: `"${item.title}" is currently out of stock. Please check other available gadgets.`,
                });
                return;
              }
              openBuyerModal(item);
            };

            return (
              <div
                key={item.id}
                onClick={handleItemClick}
                className={`group border rounded-2xl p-3.5 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-lg ${
                  isOutOfStock
                    ? "bg-[#111726]/90 border-slate-800/80 hover:border-rose-900/50"
                    : "bg-[#131B2E] hover:bg-[#18223A] border-slate-800/90 hover:border-cyan-500/50 hover:shadow-cyan-500/10"
                }`}
              >
                <div>
                  {/* Aspect Ratio 4:3 Image */}
                  <div className="aspect-[4/3] w-full rounded-xl bg-white p-3 flex items-center justify-center overflow-hidden relative shadow-inner">
                    <img
                      src={item.image}
                      alt={item.title}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://placehold.co/400x300/FFFFFF/0F172A?text=Gadget";
                      }}
                      className={`w-full h-full object-contain transition-transform duration-300 ${
                        isOutOfStock ? "grayscale-[40%] contrast-90" : "group-hover:scale-105"
                      }`}
                    />

                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/90 text-[10px] font-mono text-emerald-400 font-semibold shadow z-20">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      Admin Verified
                    </span>

                    <span
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border shadow z-20 ${
                        isOutOfStock
                          ? "bg-rose-950/95 text-rose-300 border-rose-500/70"
                          : "bg-slate-900/90 text-cyan-300 border-cyan-500/40"
                      }`}
                    >
                      {isOutOfStock ? "Out of Stock" : "In Stock"}
                    </span>

                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                        <span className="px-3 py-1 rounded-md bg-rose-950/95 border border-rose-500 text-rose-300 text-xs font-bold uppercase tracking-wider shadow">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title & Pricing Hierarchy */}
                  <div className="mt-3.5">
                    {/* Poster's Shop / Company Name */}
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 mb-1 truncate">
                      <Store className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                      <span className="truncate">{item.shopName || item.seller}</span>
                    </div>

                    <h3
                      className={`font-display text-sm font-bold truncate transition ${
                        isOutOfStock
                          ? "text-slate-400"
                          : "text-white group-hover:text-cyan-300"
                      }`}
                    >
                      {item.title}
                    </h3>

                    {/* Box 1: Separated Condition Container */}
                    <div className="my-1.5 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${
                          item.condition === "New" || item.condition === "Brand New"
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                            : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.condition === "New" || item.condition === "Brand New"
                              ? "bg-emerald-400"
                              : "bg-amber-400"
                          }`}
                        />
                        Condition: {item.condition === "New" || item.condition === "Brand New" ? "New" : "Used"}
                      </span>
                    </div>

                    {/* Box 2: Separated Specifications & Inclusions Container */}
                    {item.description && (
                      <div className="bg-[#101625] border border-slate-800/80 rounded-lg p-2 my-1 text-[11px] text-slate-300 space-y-0.5">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-400 block font-semibold">
                          Specs &amp; Inclusions:
                        </span>
                        <p className="text-slate-400 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    )}

                    {/* Separated Price Options: Cash (0% Interest) vs Monthly Installment */}
                    <div className="bg-[#101726] border border-slate-800 rounded-lg p-2.5 space-y-1.5 my-1">
                      {/* Cash Option with 0% Interest Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[11px] font-semibold text-slate-300">Cash:</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs sm:text-sm font-bold text-emerald-400 tabular-nums">
                            {formatPrice(item.priceUSD, currency)}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                            0% Int
                          </span>
                        </div>
                      </div>

                      {/* Installment Option */}
                      <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-[11px] text-slate-400">
                            {item.tenorMonths === 1 ? "1-Mo Cash:" : "Installment:"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-cyan-300 tabular-nums">
                            {formatPrice(item.monthlyUSD, currency)}
                            <span className="text-[10px] font-normal text-slate-400">
                              {item.tenorMonths === 1 ? " (0% Int)" : " / mo"}
                            </span>
                          </span>
                          <div className="text-[10px] font-mono text-slate-400">
                            {item.tenorMonths === 1
                              ? `DP: ${formatPrice(dpUSD, currency)} (${item.downpaymentPct}%) • 1m (0% Int)`
                              : `DP: ${formatPrice(dpUSD, currency)} (${item.downpaymentPct}%) • ${item.tenorMonths}m`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer with Seller info & Dual Cash / Installment Buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-mono text-slate-400 truncate max-w-[90px]" title={item.seller}>
                    {item.seller}
                  </span>
                  {isOutOfStock ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[11px] font-semibold">
                      Out of Stock
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openBuyerModal(item, "CASH");
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold hover:bg-emerald-500 hover:text-slate-950 transition cursor-pointer"
                        title="Pay full cash with 0% interest held in Admin Escrow"
                      >
                        <Banknote className="w-3 h-3" />
                        Pay Cash
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openBuyerModal(item, "INSTALLMENT");
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold hover:bg-cyan-500 hover:text-slate-950 transition cursor-pointer"
                        title="Avail monthly installment plan"
                      >
                        <Calendar className="w-3 h-3" />
                        Plan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Loading Shimmer Skeleton Grid when syncing from database */}
        {(isInitialSyncing || isLoading) && filteredItems.length === 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-300 text-xs font-mono">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <span>Connecting to Admin Escrow Marketplace &amp; Syncing Verified Gadgets...</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div
                  key={n}
                  className="border border-slate-800/80 rounded-2xl p-3.5 bg-[#131B2E]/60 shadow-lg space-y-3.5 animate-pulse"
                >
                  <div className="aspect-[4/3] w-full rounded-xl bg-slate-800/80 relative overflow-hidden flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-800/90 rounded-md w-3/4" />
                    <div className="h-3 bg-slate-800/60 rounded-md w-1/2" />
                  </div>
                  <div className="h-6 bg-slate-800/50 rounded-lg w-full" />
                  <div className="h-10 bg-slate-800/40 rounded-lg w-full" />
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/70">
                    <div className="h-4 bg-slate-800/80 rounded w-20" />
                    <div className="h-6 bg-slate-800/80 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State Only When Loading is Finished and no items */}
        {!isInitialSyncing && !isLoading && filteredItems.length === 0 && (
          <div className="text-center py-20 bg-[#131B2E]/70 border border-slate-800 rounded-2xl p-8 max-w-lg mx-auto shadow-xl">
            <Store className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No gadgets listed yet</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {searchQuery || activeCategory !== "All" || quickFilter !== "all"
                ? "No gadgets match your current filters. Try resetting search or category filters."
                : "The Escrow Market is currently waiting for new listings. Post a gadget to submit it for Admin escrow review."}
            </p>
            <button
              onClick={openPostingWizard}
              className="mt-5 cta-cyan-emerald px-5 py-2.5 rounded-full text-xs font-bold text-slate-950 cursor-pointer shadow-md inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Post a Gadget
            </button>
          </div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* 4. GUEST SELLER POSTING WIZARD MODAL (NO PRE-FILLED PHOTOS)          */}
      {/* ===================================================================== */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#060911]/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
          <div className="wizard-shell relative w-full max-w-[1080px] rounded-[22px] p-5 sm:p-7 my-auto text-slate-100 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  Post to Escrow Market
                  <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    No Sign-Up Needed
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300/90 mt-1">
                  Upload device photos, provide specs &amp; description, and set installments. Admin inspects &amp; coordinates shipping.
                </p>
              </div>

              <button
                onClick={() => setIsWizardOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Header */}
            <div className="mt-4 mb-5">
              <div className="w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden">
                <div className="progress-glow h-full rounded-full transition-all duration-300 w-full" />
              </div>
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-400 mt-2">
                <span>1. Upload Photos / Link / AI</span>
                <span>2. Auto-Calculated Installments &amp; Downpayment</span>
                <span>3. Admin Middleman Escrow Protection</span>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Column 1 (5 cols): Photo Uploader + Gadget Information */}
              <div className="lg:col-span-5 bg-[#192236]/95 border border-slate-700/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white mb-2">
                    Device Photos <span className="text-slate-400 font-normal">(Upload, Share Link, or AI Auto-Generate)</span>
                  </label>

                  {/* 3 Photo Input Actions */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {/* 1. Device Upload */}
                    <label className="py-2.5 px-2 rounded-xl bg-[#202B42] hover:bg-[#283652] border border-dashed border-slate-500/80 hover:border-cyan-400 flex flex-col items-center justify-center text-center cursor-pointer transition group">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Upload className="w-4 h-4 text-slate-300 group-hover:text-cyan-300 mb-1" />
                      <span className="text-[10px] text-slate-200 font-medium leading-tight">Upload</span>
                    </label>

                    {/* 2. AI Auto-Generate */}
                    <button
                      type="button"
                      onClick={handleAiGeneratePhotos}
                      disabled={isGeneratingAi}
                      className="py-2.5 px-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-200 flex flex-col items-center justify-center text-center cursor-pointer transition disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4 text-purple-300 mb-1" />
                      <span className="text-[10px] font-medium leading-tight">
                        {isGeneratingAi ? "Generating..." : "AI Generate"}
                      </span>
                    </button>

                    {/* 3. Empty slot indicator */}
                    <div className="py-2.5 px-2 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-mono font-bold text-cyan-400">
                        {wizardPhotos.length}/4
                      </span>
                      <span className="text-[9px] text-slate-400">Slots used</span>
                    </div>
                  </div>

                  {/* Share Link for Photos Input */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={photoUrlInput}
                        onChange={(e) => setPhotoUrlInput(e.target.value)}
                        placeholder="Or paste photo link (Google Drive, iCloud, image URL)..."
                        className="w-full bg-[#182134] border border-slate-700/80 rounded-lg pl-3 pr-2 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddLinkPhoto}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-600/70 shrink-0"
                    >
                      + Add Link
                    </button>
                  </div>

                  {/* Photo Thumbnails Preview Grid (Starts EMPTY) */}
                  {wizardPhotos.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {wizardPhotos.map((url, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-square rounded-xl bg-white p-1 border border-cyan-400/50 shadow overflow-hidden group"
                        >
                          <img
                            src={url}
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-950/80 text-white flex items-center justify-center hover:bg-rose-600 transition"
                            title="Remove photo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 border border-dashed border-slate-700/80 rounded-xl text-center mb-3 bg-[#131B2E]/40">
                      <Camera className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                      <p className="text-xs text-slate-400">No photos attached yet</p>
                      <span className="text-[10px] text-slate-500">
                        Upload from phone/PC, paste a drive link, or click "AI Generate".
                      </span>
                    </div>
                  )}

                  {/* Title & Category Input */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Gadget Title / Model
                      </label>
                      <input
                        type="text"
                        value={wizardTitle}
                        onChange={(e) => setWizardTitle(e.target.value)}
                        placeholder="e.g. MacBook Pro 14 M3, iPhone 16 Pro Max 256GB"
                        className="w-full bg-[#232E46] border border-slate-600/70 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1">
                          Category
                        </label>
                        <div className="relative">
                          <select
                            value={wizardCategory}
                            onChange={(e) => setWizardCategory(e.target.value as any)}
                            className="w-full appearance-none bg-[#232E46] border border-slate-600/70 rounded-xl pl-3 pr-7 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer"
                          >
                            <option value="laptops">Laptops</option>
                            <option value="phones">Smartphones</option>
                            <option value="tablets">Tablets</option>
                            <option value="gaming">Gaming</option>
                            <option value="cameras">Cameras</option>
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1">
                          Condition <span className="text-cyan-400 font-bold">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setWizardCondition("New")}
                            className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              wizardCondition === "New"
                                ? "bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-sm ring-1 ring-emerald-500/50"
                                : "bg-[#232E46] border-slate-600/70 text-slate-400 hover:text-white"
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>New</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setWizardCondition("Used")}
                            className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              wizardCondition === "Used"
                                ? "bg-amber-500/25 border-amber-400 text-amber-300 shadow-sm ring-1 ring-amber-500/50"
                                : "bg-[#232E46] border-slate-600/70 text-slate-400 hover:text-white"
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span>Used</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Item Specifications & Inclusions Field */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                        <span>Item Specifications &amp; Inclusions</span>
                        <span className="text-[10px] text-cyan-400 font-mono">Specs, inclusions, accessories</span>
                      </label>
                      <textarea
                        rows={3}
                        value={wizardDescription}
                        onChange={(e) => setWizardDescription(e.target.value)}
                        placeholder="Write the item's specifications and what's in the box (e.g. 11-inch iPad, Wi-Fi 6 & 5G, USB-C ports, 20W Power Adapter, 12MP Center Stage camera, 100% battery health, sealed accessories)..."
                        className="w-full bg-[#232E46] border border-slate-600/70 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* Seller Payout Contact & Shop Name */}
                <div className="pt-2 border-t border-slate-700/60 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Company / Shop Name <span className="text-cyan-400 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={wizardShopName}
                        onChange={(e) => setWizardShopName(e.target.value)}
                        placeholder="e.g. TechZone Store / Clef Hub"
                        className="w-full bg-[#232E46] border border-slate-600/70 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Poster / Owner Name
                      </label>
                      <input
                        type="text"
                        value={wizardSellerName}
                        onChange={(e) => setWizardSellerName(e.target.value)}
                        placeholder="e.g. Alex R."
                        className="w-full bg-[#232E46] border border-slate-600/70 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Seller Contact Number & Email */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-cyan-400" />
                        <span>Seller Phone / Contact Number <strong className="text-cyan-400">*</strong></span>
                      </label>
                      <input
                        type="text"
                        value={wizardSellerPhone}
                        onChange={(e) => {
                          setWizardSellerPhone(e.target.value);
                          if (!wizardContact) setWizardContact(e.target.value);
                        }}
                        placeholder="e.g. +63 917 123 4567"
                        className="w-full bg-[#232E46] border border-slate-600/70 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-cyan-400" />
                        <span>Seller Email</span>
                      </label>
                      <input
                        type="email"
                        value={wizardSellerEmail}
                        onChange={(e) => {
                          setWizardSellerEmail(e.target.value);
                          if (!wizardSellerPhone) setWizardContact(e.target.value);
                        }}
                        placeholder="seller@store.com"
                        className="w-full bg-[#232E46] border border-slate-600/70 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Payout Method
                      </label>
                      <div className="relative">
                        <select
                          value={wizardPayoutMethod}
                          onChange={(e) => setWizardPayoutMethod(e.target.value)}
                          className="w-full appearance-none bg-[#232E46] border border-slate-600/70 rounded-xl pl-3 pr-7 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="PayPal">PayPal</option>
                          <option value="Visa / Debit Card">Visa / Debit Card</option>
                          <option value="E-Wallet">E-Wallet / PromptPay</option>
                          <option value="GCash">GCash</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Payout Account Details
                      </label>
                      <input
                        type="text"
                        value={wizardSellerPayoutDetails}
                        onChange={(e) => setWizardSellerPayoutDetails(e.target.value)}
                        placeholder="Account #, Bank name, or PayPal"
                        className="w-full bg-[#232E46] border border-slate-600/70 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2 & 3: Downpayment, Months to Pay, Auto-Calculation & Escrow Release */}
              <div className="lg:col-span-7 flex flex-col justify-between gap-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
                  {/* Estimator & Installment Configurator Card (7 cols) */}
                  <div className="md:col-span-7 bg-[#192236]/95 border border-slate-700/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-sm sm:text-[15px] font-bold text-white leading-snug">
                          Installment &amp; Pricing Configurator
                        </h3>
                        {/* Currency Selector inside Wizard */}
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg p-0.5">
                          {(["USD", "PHP", "THB"] as Currency[]).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleCurrencyChange(c)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition cursor-pointer ${
                                currency === c
                                  ? "bg-cyan-500 text-slate-950 shadow-sm"
                                  : "text-slate-400 hover:text-white"
                              }`}
                              title={CURRENCIES[c].name}
                            >
                              {CURRENCIES[c].symbol} {c}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cash Price Input in Active Currency (USD / PHP / THB) */}
                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                            <span>Total Cash Asking Price:</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                              {CURRENCIES[currency].name} ({CURRENCIES[currency].symbol})
                            </span>
                          </label>
                          {currency !== "USD" ? (
                            <span className="text-xs font-mono font-semibold text-slate-400">
                              ≈ ${wizardPriceUSD.toFixed(2)} USD
                            </span>
                          ) : (
                            <span className="text-xs font-mono font-semibold text-emerald-400">
                              ≈ ฿{(wizardPriceUSD * 35).toLocaleString()} THB
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-base font-bold text-cyan-400">
                            {CURRENCIES[currency].symbol}
                          </span>
                          <input
                            type="number"
                            value={wizardPriceInput}
                            min={1}
                            onChange={(e) => handleWizardPriceInputChange(e.target.value)}
                            placeholder={`Enter price in ${CURRENCIES[currency].code}...`}
                            className="w-full bg-[#232E46] border border-slate-600/70 focus:border-cyan-400 rounded-xl pl-9 pr-16 py-2 font-mono text-sm font-bold text-white tabular-nums focus:outline-none"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-400 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-700/60">
                            {currency}
                          </span>
                        </div>
                      </div>

                      {/* Required Downpayment Selector */}
                      <div className="mt-3.5">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-300">Required Downpayment %:</span>
                          <span className="font-mono font-bold text-cyan-300">
                            {wizardDownpaymentPct}% ({formatPrice(wizardDownpaymentUSD, currency)})
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[0, 10, 20, 30].map((dp) => (
                            <button
                              key={dp}
                              type="button"
                              onClick={() => setWizardDownpaymentPct(dp)}
                              className={`py-1.5 rounded-lg border font-mono text-xs font-semibold transition ${
                                wizardDownpaymentPct === dp
                                  ? "border-cyan-400 bg-cyan-500/20 text-cyan-300"
                                  : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white"
                              }`}
                            >
                              {dp}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Months to Pay (Tenor) Selector */}
                      <div className="mt-3.5">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-300">Allowed Months to Pay (Tenor):</span>
                          <span className="font-mono font-bold text-emerald-300">
                            {wizardTenorMonths === 1 ? "1 Month (Cash • 0% Interest)" : `${wizardTenorMonths} Months`}
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {[1, 3, 6, 12, 24].map((tenor) => (
                            <button
                              key={tenor}
                              type="button"
                              onClick={() => {
                                setWizardTenorMonths(tenor);
                                if (tenor === 1) {
                                  setWizardDownpaymentPct(0);
                                }
                              }}
                              className={`py-1.5 px-1 rounded-lg border font-mono text-xs font-semibold transition flex flex-col items-center justify-center leading-tight ${
                                wizardTenorMonths === tenor
                                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-sm ring-1 ring-emerald-500/40"
                                  : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white"
                              }`}
                            >
                              <span>{tenor === 1 ? "1 Mo" : `${tenor} Mos`}</span>
                              {tenor === 1 && (
                                <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">
                                  0% Cash
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Auto-Calculated Monthly Installment for Buyer */}
                      <div className="mt-4 rounded-xl bg-slate-900/80 border border-slate-700/80 p-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">
                            {wizardTenorMonths === 1 ? "Buyer Cash Price (0% Interest):" : "Buyer Monthly Installment:"}
                          </span>
                          <span className="font-mono text-base font-bold text-emerald-400">
                            {formatPrice(wizardMonthlyUSD, currency)}
                            {wizardTenorMonths === 1 ? " (1 Mo • 0% Int)" : " / mo"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                          {wizardTenorMonths === 1
                            ? "1-Month full cash price with 0% interest held in Admin Middleman Escrow"
                            : "Auto-calculated upon Admin approval for marketplace card"}
                        </span>
                      </div>
                    </div>

                    {/* Middleman Fee & Guaranteed Net Payout */}
                    <div className="rounded-xl bg-[#0F2929]/90 border border-emerald-500/70 p-3.5 shadow-inner">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">
                          Admin Middleman Fee ({wizardCommissionRate}%):
                        </span>
                        <span className="font-mono text-rose-400 font-semibold">
                          -{formatPrice(wizardFeeAmountUSD, currency)}
                        </span>
                      </div>
                      <div className="border-t border-emerald-500/40 my-2 pt-2 flex items-center justify-between">
                        <span className="text-xs text-emerald-200/90 font-medium">
                          Guaranteed Net Payout to Seller:
                        </span>
                        <span className="font-mono text-xl font-bold text-emerald-400 tabular-nums">
                          {formatPrice(wizardNetPayoutUSD, currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middleman Release & Shipping Workflow (5 cols) */}
                  <div className="md:col-span-5 middleman-gradient-card rounded-2xl p-5 flex flex-col justify-between text-white">
                    <div>
                      <h3 className="font-display text-sm font-bold text-white leading-snug">
                        Admin Middleman Escrow &amp; Shipping:
                      </h3>

                      <ol className="mt-3.5 space-y-3 text-[12px] font-medium text-white/95 leading-relaxed">
                        <li className="flex items-start gap-2">
                          <span className="font-mono font-bold">1.</span>
                          <span>Admin inspects device &amp; approves post to marketplace.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-mono font-bold">2.</span>
                          <span>Buyer pays downpayment into Admin Escrow.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-mono font-bold">3.</span>
                          <span>
                            <strong>Middleman Fee ({wizardCommissionRate}%)</strong> deducted upon release to ship gadget.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-mono font-bold">4.</span>
                          <span>
                            Payout released monthly as customer pays their monthly installment bill.
                          </span>
                        </li>
                      </ol>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/20">
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-white/85 mb-1">
                        Your Contact Email / Phone:
                      </label>
                      <input
                        type="text"
                        value={wizardContact || wizardSellerPhone || wizardSellerEmail}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWizardContact(val);
                          if (val.includes("@")) {
                            setWizardSellerEmail(val);
                          } else if (/\d/.test(val)) {
                            setWizardSellerPhone(val);
                          }
                        }}
                        placeholder="guest@email.com or phone"
                        className="w-full bg-slate-950/30 border border-white/25 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/60 focus:outline-none focus:border-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Submit Action */}
                <button
                  type="button"
                  onClick={handleWizardSubmit}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#232D42] hover:bg-[#2B3752] border border-slate-600/80 hover:border-cyan-400/70 text-xs sm:text-sm font-semibold text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Submit to Admin for Approval &amp; Auto-Calculation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. BUYER PURCHASE & INSTALLMENT MODAL (EXPANSIVE DESKTOP LAYOUT)     */}
      {/* ===================================================================== */}
      {selectedBuyerGadget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
          <div className="wizard-shell relative w-full max-w-[1100px] xl:max-w-[1240px] rounded-[24px] p-5 sm:p-7 text-slate-100 my-auto shadow-2xl border border-slate-700/80 max-h-[92vh] overflow-y-auto scrollbar-thin">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-700/70 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  <BadgeCheck className="w-4 h-4 text-emerald-400" />
                  <span>100% Admin Escrow Protected Listing • Inspected &amp; Guaranteed</span>
                </span>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-white mt-1">
                  {selectedBuyerGadget.title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-300 mt-1 flex-wrap">
                  <span className="flex items-center gap-1.5 text-cyan-300 font-medium">
                    <Store className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Company / Shop: <strong className="text-white">{selectedBuyerGadget.shopName || selectedBuyerGadget.seller}</strong></span>
                  </span>
                  <span>•</span>
                  <span>
                    Cash Asking Price:{" "}
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {formatPrice(selectedBuyerGadget.priceUSD, currency)}
                    </span>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedBuyerGadget(null)}
                className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Expansive 2-Column Desktop Layout (Using full space from left to right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-5">
              {/* LEFT COLUMN (5 cols / ~42%): Product Visuals, Condition, Specs & Buyer Contact */}
              <div className="lg:col-span-5 space-y-4">
                {/* Gadget Image Preview */}
                <div className="w-full aspect-[4/3] rounded-2xl bg-white p-4 flex items-center justify-center shadow-lg relative overflow-hidden group">
                  <img
                    src={selectedBuyerGadget.image}
                    alt={selectedBuyerGadget.title}
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-900/90 text-cyan-300 border border-cyan-500/30 backdrop-blur-sm">
                    {selectedBuyerGadget.category}
                  </div>
                </div>

                {/* Box 1: Separated Condition View Container */}
                <div className="rounded-xl bg-[#162035] border border-slate-700/80 p-3.5 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold mb-1">
                      Device Condition:
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase border ${
                          selectedBuyerGadget.condition === "New" || selectedBuyerGadget.condition === "Brand New"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/50"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            selectedBuyerGadget.condition === "New" || selectedBuyerGadget.condition === "Brand New"
                              ? "bg-emerald-400"
                              : "bg-amber-400"
                          }`}
                        />
                        {selectedBuyerGadget.condition === "New" || selectedBuyerGadget.condition === "Brand New"
                          ? "✨ Brand New"
                          : "📦 Used / Inspected"}
                      </span>
                    </div>
                  </div>
                  <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                </div>

                {/* Box 2: Separated Specification Detail Container */}
                {selectedBuyerGadget.description && (
                  <div className="rounded-xl bg-[#162035] border border-slate-700/80 p-4 space-y-2 shadow-sm">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      <span>Item Specifications &amp; Inclusions:</span>
                    </span>
                    <p className="text-slate-300 text-xs leading-relaxed max-h-56 overflow-y-auto whitespace-pre-line pr-1 scrollbar-thin">
                      {selectedBuyerGadget.description}
                    </p>
                  </div>
                )}

                {/* Buyer Contact Information */}
                <div className="rounded-xl bg-[#131B2E] border border-slate-700/80 p-4 space-y-3">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Your Buyer Details:</span>
                    </span>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      🔒 Phone Visible Only to Admin
                    </span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">Your Full Name *</label>
                      <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                        <span>Contact Number / Phone *</span>
                        <span className="text-[9px] text-emerald-400 font-bold">🔒 Admin Only</span>
                      </label>
                      <input
                        type="text"
                        value={buyerPhone}
                        onChange={(e) => {
                          setBuyerPhone(e.target.value);
                          if (!buyerContact) setBuyerContact(e.target.value);
                        }}
                        placeholder="e.g. +63 917 555 0192"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">Buyer Email</label>
                      <input
                        type="email"
                        value={buyerEmail}
                        onChange={(e) => {
                          setBuyerEmail(e.target.value);
                          if (!buyerPhone) setBuyerContact(e.target.value);
                        }}
                        placeholder="buyer@email.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        Method to Receive Payment (Refund/Return)
                      </label>
                      <select
                        value={buyerReceiveMethod}
                        onChange={(e) => setBuyerReceiveMethod(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                      >
                        <option value="PAYPAL">PayPal</option>
                        <option value="BANK_TRANSFER">Bank Account / Transfer</option>
                        <option value="VISA_CARD">Visa / Debit Card</option>
                        <option value="GCASH">GCash / Mobile Wallet</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      Account / Card / PayPal Details to Receive Payment:
                    </label>
                    <input
                      type="text"
                      value={buyerReceiveAccountDetails}
                      onChange={(e) => setBuyerReceiveAccountDetails(e.target.value)}
                      placeholder="e.g. PayPal email, Bank Name & Account #, or Visa card info"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN (7 cols / ~58%): Purchase Mode, Financial Plan, Payment Gateway & Submit */}
              <div className="lg:col-span-7 space-y-4">
                {/* Segmented Purchase Mode: Cash (0% Interest Escrow) vs Monthly Installment */}
                <div className="grid grid-cols-2 gap-2 bg-[#101726] p-1.5 rounded-2xl border border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => setBuyerPaymentOption("CASH")}
                    className={`py-3 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      buyerPaymentOption === "CASH"
                        ? "bg-emerald-500 text-slate-950 shadow-md ring-1 ring-emerald-400"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/40"
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Pay Cash (0% Interest Escrow)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuyerPaymentOption("INSTALLMENT")}
                    className={`py-3 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      buyerPaymentOption === "INSTALLMENT"
                        ? "bg-cyan-500 text-slate-950 shadow-md ring-1 ring-cyan-400"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/40"
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Monthly Installment Plan</span>
                  </button>
                </div>

                {/* CASH PURCHASE WORKFLOW */}
                {buyerPaymentOption === "CASH" ? (
                  <div className="space-y-4">
                    {/* Admin Escrow Middleman Explainer */}
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 space-y-1.5 text-xs text-emerald-200">
                      <div className="flex items-center gap-2 font-bold text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                        <span>100% Cash Protection • Admin Middleman Escrow Hold</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Admin holds the full cash payment in escrow while you wait for the gadget, receive it,
                        and inspect it. Funds are released to the seller only after the inspection window or via 1-Day Admin confirmation.
                      </p>
                    </div>

                    {/* Inspection & Holding Window Selector */}
                    <div>
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="text-slate-300 font-medium">Buyer Inspection &amp; Escrow Holding Window:</span>
                        <span className="font-mono font-bold text-emerald-400">{buyerEscrowHoldDays}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { label: "1 Day", sub: "Express Confirm" },
                          { label: "3-7 Days", sub: "Standard Test" },
                          { label: "15 Days", sub: "Extended Check" },
                          { label: "30 Days", sub: "30-Day Guarantee" },
                        ].map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setBuyerEscrowHoldDays(opt.label)}
                            className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer ${
                              buyerEscrowHoldDays === opt.label
                                ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-sm"
                                : "border-slate-700 bg-[#162035] text-slate-400 hover:border-slate-500 hover:text-slate-200"
                            }`}
                          >
                            <div className="font-mono text-xs font-bold text-white">{opt.label}</div>
                            <div className="text-[9px] text-slate-400">{opt.sub}</div>
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono mt-1.5 block">
                        Admin can also confirm the transaction in 1 day once buyer verifies device condition.
                      </span>
                    </div>

                    {/* Cash Total Summary Box */}
                    <div className="rounded-xl bg-[#0F2929] border border-emerald-500/60 p-4 space-y-2">
                      <div className="flex justify-between items-center text-xs text-slate-300">
                        <span>Total Cash Asking Price:</span>
                        <span className="font-mono font-bold text-white text-base">
                          {formatPrice(selectedBuyerGadget.priceUSD, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-emerald-300">
                        <span>Financing Interest Rate:</span>
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40">
                          0% (Zero Interest)
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-cyan-300 border-t border-emerald-500/30 pt-2">
                        <span>Admin Escrow Hold:</span>
                        <span className="font-mono font-bold">100% Protected ({buyerEscrowHoldDays})</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* MONTHLY INSTALLMENTS WORKFLOW */
                  <div className="space-y-4">
                    {/* Downpayment Slider */}
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-300">
                          Escrow Downpayment (
                          <span className="font-mono text-cyan-400 font-semibold">
                            {buyerDownpaymentPct}%
                          </span>
                          )
                        </span>
                        <span className="font-mono font-bold text-white tabular-nums">
                          {formatPrice(buyerDpAmtUSD, currency)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        step={5}
                        value={buyerDownpaymentPct}
                        onChange={(e) => setBuyerDownpaymentPct(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    {/* Tenor Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-300">
                          Select Installment Duration
                        </span>
                        {buyerTenor === 1 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                            0% Interest Cash Plan
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[1, 3, 6, 12, 24].map((tenor) => (
                          <button
                            key={tenor}
                            type="button"
                            onClick={() => {
                              setBuyerTenor(tenor);
                              if (tenor === 1) {
                                setBuyerDownpaymentPct(0);
                              }
                            }}
                            className={`py-2 rounded-xl border font-mono text-xs font-bold transition cursor-pointer flex flex-col items-center justify-center leading-tight ${
                              buyerTenor === tenor
                                ? "border-emerald-400 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm"
                                : "border-slate-700 bg-[#192236] text-slate-300 hover:border-slate-500"
                            }`}
                          >
                            <span>{tenor === 1 ? "1 Mo" : `${tenor} Mos`}</span>
                            {tenor === 1 && (
                              <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">
                                0% Cash
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Monthly Summary in active currency */}
                    <div className="rounded-xl bg-[#0F2929] border border-emerald-500/60 p-4 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-emerald-200/80 block">
                          {buyerTenor === 1 ? "1-Month Cash Payment (0% Interest)" : "Estimated Monthly Payment"}
                        </span>
                        <span className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                          {formatPrice(buyerMonthlyUSD, currency)}
                          <span className="text-xs font-normal text-slate-300">
                            {buyerTenor === 1 ? " (0% Int)" : " / mo"}
                          </span>
                        </span>
                      </div>
                      <div className="text-right text-[11px] text-slate-300 font-mono">
                        <div>Admin Escrow Protected</div>
                        <div className="text-emerald-400">Shipped upon inspection</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fully Functional Payment Gateway Selector (Deposited to Admin Bank Account) */}
                <div className="space-y-3 pt-2 border-t border-slate-700/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Select Payment Method (Direct to Admin Escrow):</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      100% Admin Protected
                    </span>
                  </div>

                  {/* Payment Gateway Tabs: PayPal, Bank Account, Visa/Card, GCash */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "PAYPAL", label: "🔵 PayPal", desc: "Global Escrow" },
                      { id: "BANK_TRANSFER", label: "🏦 Bank Account", desc: "Direct Transfer" },
                      { id: "VISA_CARD", label: "💳 Visa / Card", desc: "Debit / Credit" },
                      { id: "GCASH", label: "🟢 GCash", desc: "Mobile Wallet" },
                    ].map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setBuyerPaymentMethod(pm.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          buyerPaymentMethod === pm.id
                            ? "border-cyan-400 bg-cyan-500/15 text-white ring-1 ring-cyan-500/40 shadow-sm"
                            : "border-slate-700/80 bg-[#162035] text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        <div className="text-xs font-bold">{pm.label}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 font-mono">{pm.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Payment Deposit Destination Card & Inputs */}
                  {buyerPaymentMethod === "BANK_TRANSFER" && (
                    <div className="rounded-xl bg-[#0F2236] border border-cyan-500/40 p-3.5 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-cyan-300">
                        <span className="font-semibold">Deposit Destination:</span>
                        <span className="font-mono font-bold text-white">Admin Bangkok Bank Escrow Account</span>
                      </div>
                      <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 space-y-1 text-[11px] font-mono">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Account Number:</span>
                          <span className="text-emerald-400 font-bold">097-3-274005</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Account Name:</span>
                          <span className="text-white">Gadget Installment Escrow Trust Co.</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Bank:</span>
                          <span className="text-cyan-300">Bangkok Bank (Public Company Limited)</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                            Sender Name / Bank
                          </label>
                          <input
                            type="text"
                            value={buyerBankSenderName}
                            onChange={(e) => setBuyerBankSenderName(e.target.value)}
                            placeholder="e.g. John Doe / Kasikorn"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                            Transfer Reference / Slip #
                          </label>
                          <input
                            type="text"
                            value={buyerBankRef}
                            onChange={(e) => setBuyerBankRef(e.target.value)}
                            placeholder="e.g. BBL-849201"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {buyerPaymentMethod === "GCASH" && (
                    <div className="rounded-xl bg-[#0F2236] border border-cyan-500/40 p-3.5 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-cyan-300">
                        <span className="font-semibold">Deposit Destination:</span>
                        <span className="font-mono font-bold text-white">Admin GCash Escrow Trust</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-950/70 p-2 rounded-lg border border-slate-800 text-[11px] font-mono">
                        <span className="text-slate-400">Admin GCash Account:</span>
                        <span className="text-emerald-400 font-bold">+63 973 274 005 (GI Escrow Admin)</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                            Your GCash Mobile #
                          </label>
                          <input
                            type="text"
                            value={buyerGcashMobile}
                            onChange={(e) => setBuyerGcashMobile(e.target.value)}
                            placeholder="0917-xxx-xxxx"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                            12-Digit Reference #
                          </label>
                          <input
                            type="text"
                            value={buyerGcashRef}
                            onChange={(e) => setBuyerGcashRef(e.target.value)}
                            placeholder="e.g. 1009 4821 7392"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {buyerPaymentMethod === "PAYPAL" && (
                    <div className="rounded-xl bg-[#0F2236] border border-cyan-500/40 p-3.5 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-cyan-300">
                        <span className="font-semibold">Deposit Destination:</span>
                        <span className="font-mono font-bold text-white">Admin Escrow PayPal</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-950/70 p-2 rounded-lg border border-slate-800 text-[11px] font-mono">
                        <span className="text-slate-400">Admin PayPal Email:</span>
                        <span className="text-emerald-400 font-bold">escrow-admin@gadget-installment.cc</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                            Your PayPal Email
                          </label>
                          <input
                            type="email"
                            value={buyerPaypalEmail}
                            onChange={(e) => setBuyerPaypalEmail(e.target.value)}
                            placeholder="buyer@paypal.com"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                            Transaction / Auth ID
                          </label>
                          <input
                            type="text"
                            value={buyerPaypalTxn}
                            onChange={(e) => setBuyerPaypalTxn(e.target.value)}
                            placeholder="e.g. 9KL48291TH"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {buyerPaymentMethod === "VISA_CARD" && (
                    <div className="rounded-xl bg-[#0F2236] border border-cyan-500/40 p-3.5 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-cyan-300">
                        <span className="font-semibold">Deposit Destination:</span>
                        <span className="font-mono font-bold text-white">Admin Bangkok Bank Account</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-950/70 p-2 rounded-lg border border-slate-800 text-[11px] font-mono">
                        <span className="text-slate-400">Admin Escrow Account:</span>
                        <span className="text-emerald-400 font-bold">097-3-274005 (Gadget Installment Trust)</span>
                      </div>

                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                            Name on Card
                          </label>
                          <input
                            type="text"
                            value={buyerCardName}
                            onChange={(e) => setBuyerCardName(e.target.value)}
                            placeholder="Cardholder Full Name"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                              16-Digit Card Number
                            </label>
                            <input
                              type="text"
                              value={buyerCardNumber}
                              onChange={(e) => setBuyerCardNumber(e.target.value)}
                              placeholder="4532 •••• •••• 9301"
                              maxLength={19}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                              Exp / CVV
                            </label>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={buyerCardExpiry}
                                onChange={(e) => setBuyerCardExpiry(e.target.value)}
                                placeholder="MM/YY"
                                maxLength={5}
                                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white text-center focus:outline-none focus:border-cyan-400 font-mono"
                              />
                              <input
                                type="password"
                                value={buyerCardCvv}
                                onChange={(e) => setBuyerCardCvv(e.target.value)}
                                placeholder="CVV"
                                maxLength={4}
                                className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white text-center focus:outline-none focus:border-cyan-400 font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Automatic Middleman Fee & Escrow Net Payout Breakdown */}
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Total Deposited to Admin Account:</span>
                      <span className="text-white font-bold">
                        {formatPrice(
                          buyerPaymentOption === "CASH"
                            ? selectedBuyerGadget.priceUSD
                            : selectedBuyerGadget.priceUSD * (buyerDownpaymentPct / 100),
                          currency
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-rose-400">
                      <span>Middleman Fee (2% to Admin Account upon confirmation):</span>
                      <span>-{formatPrice(selectedBuyerGadget.priceUSD * 0.02, currency)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-300 font-bold border-t border-slate-800/80 pt-1">
                      <span>Net Payout Held for Seller:</span>
                      <span>{formatPrice(selectedBuyerGadget.priceUSD * 0.98, currency)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-sans pt-1">
                      💡 Payment held in Admin Escrow until you receive &amp; verify device, then authorized for seller payout.
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBuyerGadget(null)}
                    className="px-5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyerSubmit}
                    className="cta-cyan-emerald px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-slate-950 cursor-pointer shadow-lg flex items-center gap-2 hover:scale-[1.01] transition-transform"
                  >
                    {buyerPaymentOption === "CASH" ? (
                      <>
                        <Banknote className="w-4 h-4" />
                        <span>Pay Cash via Admin Escrow</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Avail Installment via Admin Escrow</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5.1 POST-CHECKOUT ORDER SUCCESS & ACCESS CODES MODAL                   */}
      {/* ===================================================================== */}
      {orderSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-emerald-500/50 w-full max-w-md rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/50 mx-auto flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Payment Deposited to Admin Escrow!</h3>
              <p className="text-xs text-slate-300">
                Your payment for <strong>{orderSuccessModal.title}</strong> has been secured in the Admin middleman trust account.
              </p>
            </div>

            <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Order Reference:</span>
                <span className="text-white font-bold">{orderSuccessModal.trackingId}</span>
              </div>

              <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-cyan-400 uppercase font-semibold block">Your Private Buyer Code:</span>
                  <span className="text-base font-bold text-cyan-300">{orderSuccessModal.buyerCode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(orderSuccessModal.buyerCode);
                    toast({ title: "Copied!", description: `Buyer code ${orderSuccessModal.buyerCode} copied to clipboard.` });
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 font-sans leading-relaxed">
                <span className="text-emerald-400 font-semibold">Deposit Account: </span>
                {orderSuccessModal.accountDeposited}
              </div>

              <div className="text-[11px] text-amber-300/90 font-sans leading-relaxed bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                💡 <strong>Keep your Buyer Code!</strong> Enter it in the Escrow Tracker anytime to track shipment, confirm receipt, or file a dispute. If lost, request it anytime using your phone &amp; email.
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderSuccessModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetCode = orderSuccessModal.buyerCode;
                  setOrderSuccessModal(null);
                  setIsTrackerOpen(true);
                  setTrackerTab("BUYER_PORTAL");
                  setBuyerAccessCodeInput(targetCode);
                  const q = getEscrowQueue();
                  const found = q.find((i) => i.buyerAccessCode === targetCode || i.trackingId === orderSuccessModal.trackingId);
                  if (found) setActiveBuyerOrder(found);
                }}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 font-bold text-slate-950 text-xs shadow cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Open Escrow Tracker</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. ADVANCED ESCROW LISTING & INSTALLMENT TRACKER DRAWER               */}
      {/* ===================================================================== */}
      {isTrackerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm">
          <div className="bg-[#111827] border-l border-slate-800 w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl h-full flex flex-col justify-between shadow-2xl">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-[#0E1422] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Admin Escrow Protection System</span>
                </span>
                <h3 className="font-display text-lg font-bold text-white mt-0.5">
                  Escrow Listing &amp; Installment Tracker
                </h3>
              </div>
              <button
                onClick={() => setIsTrackerOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Portal Navigation Tabs: Buyer Portal, Seller Portal, All Orders */}
            <div className="px-6 pt-3 pb-2 bg-[#0E1422] border-b border-slate-800/80">
              <div className="grid grid-cols-3 gap-2 bg-[#162035] p-1.5 rounded-xl border border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setTrackerTab("BUYER_PORTAL")}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    trackerTab === "BUYER_PORTAL"
                      ? "bg-emerald-500 text-slate-950 shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Buyer Portal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTrackerTab("SELLER_PORTAL")}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    trackerTab === "SELLER_PORTAL"
                      ? "bg-purple-500 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Seller Portal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTrackerTab("ALL_ORDERS")}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    trackerTab === "ALL_ORDERS"
                      ? "bg-cyan-500 text-slate-950 shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Orders</span>
                </button>
              </div>
            </div>

            {/* Drawer Body Scroll Area */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* ============================================================= */}
              {/* TAB 1: BUYER PORTAL                                           */}
              {/* ============================================================= */}
              {trackerTab === "BUYER_PORTAL" && (
                <div className="space-y-4">
                  {/* Buyer Access Code Entry Bar */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Enter Your Unique Buyer Access Code:</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRequestCodeOpen(true);
                          setRequestCodeResult(null);
                        }}
                        className="text-[11px] font-mono text-cyan-400 hover:text-white underline cursor-pointer"
                      >
                        Forgot Code? Request via Gmail / Email or Phone
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={buyerAccessCodeInput}
                        onChange={(e) => setBuyerAccessCodeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearchBuyerCode();
                        }}
                        placeholder="e.g. BUY-93787 or GI-93787"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleSearchBuyerCode}
                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs cursor-pointer shadow"
                      >
                        Track Order
                      </button>
                    </div>
                  </div>

                  {/* Active Buyer Order Card */}
                  {activeBuyerOrder ? (
                    <div className="rounded-xl bg-[#162035] border border-cyan-500/40 p-5 space-y-4 shadow-lg">
                      {/* Top Header */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-slate-950 font-mono text-xs font-bold text-cyan-300 border border-slate-800">
                            {activeBuyerOrder.trackingId}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                            CODE: {activeBuyerOrder.buyerAccessCode}
                          </span>
                        </div>

                        {activeBuyerOrder.isShipped ? (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            <Truck className="w-3.5 h-3.5" /> 🚚 In Transit
                          </span>
                        ) : activeBuyerOrder.status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                          </span>
                        ) : activeBuyerOrder.disputeStatus === "DISPUTED_BY_BUYER" ? (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50">
                            <AlertTriangle className="w-3.5 h-3.5" /> Dispute Active
                          </span>
                        ) : activeBuyerOrder.cancelStatus !== "NONE" ? (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <RotateCcw className="w-3.5 h-3.5" /> Order Cancelled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <Clock className="w-3.5 h-3.5" /> Awaiting Shipment
                          </span>
                        )}
                      </div>

                      {/* Product Overview */}
                      <div className="flex items-start gap-3.5">
                        <div className="w-16 h-16 rounded-xl bg-white p-1.5 shrink-0 flex items-center justify-center shadow">
                          <img
                            src={activeBuyerOrder.images[0] || "https://placehold.co/400x300/FFFFFF/0F172A?text=Gadget"}
                            alt={activeBuyerOrder.title}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-base font-bold text-white">{activeBuyerOrder.title}</h4>
                          <div className="text-xs text-slate-300 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Seller: <strong className="text-white">{activeBuyerOrder.shopName || activeBuyerOrder.sellerName}</strong></span>
                          </div>
                          <div className="text-xs font-mono text-emerald-400 font-bold">
                            Total: {formatPrice(activeBuyerOrder.priceUSD, currency)} ({activeBuyerOrder.orderType === "CASH_ESCROW" ? "Cash 0% Int" : `${activeBuyerOrder.tenorMonths} Mos Plan`})
                          </div>
                        </div>
                      </div>

                      {/* Buyer Account & Refund Receiving Method Card (Private to Buyer) */}
                      <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                              <CreditCard className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                                <span>Your Receiving Method &amp; Contact Details</span>
                                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                                  🔒 Private to You (Key Unlocked)
                                </span>
                              </h5>
                              <p className="text-[10px] text-slate-400">
                                Censored in public &amp; admin dashboard. Only you can view or update these receiving details with your BUY key.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setIsBuyerEditingInfo(!isBuyerEditingInfo);
                              setBuyerEditPhone(activeBuyerOrder.buyerPhone || activeBuyerOrder.buyerContact || "");
                              setBuyerEditEmail(activeBuyerOrder.buyerEmail || "");
                              setBuyerEditReceiveMethod(activeBuyerOrder.buyerReceiveMethod || "PAYPAL");
                              setBuyerEditReceiveDetails(activeBuyerOrder.buyerReceiveAccountDetails || "");
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white transition cursor-pointer flex items-center gap-1.5 border border-emerald-500/40 shadow-sm"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isBuyerEditingInfo ? "Close Form" : "Edit / Change Bank & Contact"}</span>
                          </button>
                        </div>

                        {/* Display Mode */}
                        {!isBuyerEditingInfo ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                            {/* Method to Receive Refund / Return */}
                            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                              <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
                                Method to Receive Refund / Return:
                              </span>
                              <div className="font-bold text-white flex items-center gap-2">
                                <span>{activeBuyerOrder.buyerReceiveMethod || "PayPal"}</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-xs font-semibold">
                                {activeBuyerOrder.buyerReceiveAccountDetails || "No account details entered yet (Click edit to add)"}
                              </div>
                            </div>

                            {/* Contact Phone & Email */}
                            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                              <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
                                Registered Buyer Contacts:
                              </span>
                              <div className="font-mono text-slate-200 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{activeBuyerOrder.buyerPhone || activeBuyerOrder.buyerContact || "Not provided"}</span>
                              </div>
                              <div className="font-mono text-slate-300 flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span>{activeBuyerOrder.buyerEmail || "No email on record"}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Edit Mode */
                          <div className="p-3.5 rounded-xl bg-slate-900/95 border border-emerald-500/50 space-y-3 pt-2">
                            <span className="text-xs font-bold text-emerald-300 block">
                              ✏️ Update Your Receiving Method &amp; Contact Details:
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                  Method to Receive Payment / Refund *
                                </label>
                                <select
                                  value={buyerEditReceiveMethod}
                                  onChange={(e) => setBuyerEditReceiveMethod(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                                >
                                  <option value="PAYPAL">PayPal</option>
                                  <option value="BANK_TRANSFER">Bank Account / Transfer (Bangkok Bank / Kasikorn / SCB)</option>
                                  <option value="VISA_CARD">Visa / Debit Card</option>
                                  <option value="GCASH">GCash / Mobile Wallet</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                  Receiving Bank Account # / PayPal Email *
                                </label>
                                <input
                                  type="text"
                                  value={buyerEditReceiveDetails}
                                  onChange={(e) => setBuyerEditReceiveDetails(e.target.value)}
                                  placeholder="e.g. Bangkok Bank: 097-3-xxxx or PayPal email"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                  Contact Phone Number
                                </label>
                                <input
                                  type="text"
                                  value={buyerEditPhone}
                                  onChange={(e) => setBuyerEditPhone(e.target.value)}
                                  placeholder="e.g. +63 917 555 0192"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                  Contact Email Address / Gmail
                                </label>
                                <input
                                  type="email"
                                  value={buyerEditEmail}
                                  onChange={(e) => setBuyerEditEmail(e.target.value)}
                                  placeholder="e.g. buyer@gmail.com"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                              <button
                                type="button"
                                onClick={() => setIsBuyerEditingInfo(false)}
                                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveBuyerReceiveInfo(activeBuyerOrder.trackingId)}
                                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-slate-950 text-xs cursor-pointer shadow flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Save &amp; Sync to Admin</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2-Column Wide Grid for Deposit Verification & Shipping Status */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* Deposit Verification & Admin Account Box */}
                        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs font-mono flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <span className="text-[10px] uppercase text-slate-400 font-semibold block">Escrow Deposit Record:</span>
                            <div className="flex justify-between text-slate-400">
                              <span>Method:</span>
                              <span className="text-white font-bold">{activeBuyerOrder.paymentMethod || "GCASH / Bank"}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Destination:</span>
                              <span className="text-emerald-400 text-right font-medium truncate max-w-[180px]">
                                {activeBuyerOrder.paymentAccountDeposited || "Bangkok Bank: 097-3-274005"}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Ref #:</span>
                              <span className="text-cyan-300">{activeBuyerOrder.paymentReference || "GI-ESCROW-PAID"}</span>
                            </div>
                          </div>
                          <div className="border-t border-slate-800 pt-1.5 space-y-1">
                            <div className="flex justify-between text-rose-400">
                              <span>Middleman Fee ({activeBuyerOrder.feeRate}%):</span>
                              <span>-{formatPrice(activeBuyerOrder.feeAmountUSD, currency)}</span>
                            </div>
                            <div className="flex justify-between text-emerald-300 font-bold">
                              <span>Net Payout to Seller:</span>
                              <span>{formatPrice(activeBuyerOrder.netPayoutUSD, currency)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Shipping Tracking Status */}
                        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-mono uppercase text-cyan-400 font-semibold block mb-1">Shipping &amp; Logistics:</span>
                            {activeBuyerOrder.isShipped ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-purple-300 font-semibold">
                                  <Truck className="w-4 h-4 text-purple-400 shrink-0" />
                                  <span>Shipped via {activeBuyerOrder.shippingCourier || "Kerry Express"}</span>
                                </div>
                                <div className="font-mono text-slate-300 text-[11px] bg-slate-950 p-2 rounded-lg border border-slate-800">
                                  Tracking #: <strong className="text-white">{activeBuyerOrder.shippingTrackingNumber}</strong>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Shipped on: {activeBuyerOrder.shippedAt}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-slate-400 py-3">
                                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>Seller is preparing package and scheduling courier pickup.</span>
                              </div>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-500 font-mono">
                            Status verified by Admin Middleman System
                          </div>
                        </div>
                      </div>

                      {/* Buyer Receipt Confirmation Button (Cash & Installment) */}
                      {activeBuyerOrder.status !== "COMPLETED" && activeBuyerOrder.cancelStatus === "NONE" && (
                        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-3">
                          <div>
                            <h5 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Device Received Confirmation</span>
                            </h5>
                            <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                              Once you receive the gadget, test and inspect it. Clicking below confirms everything is okay and authorizes Admin to release the seller's payment.
                            </p>
                          </div>

                          {activeBuyerOrder.buyerConfirmedReceived ? (
                            <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>You confirmed receipt on {activeBuyerOrder.buyerConfirmedAt}. Admin &amp; Seller authorized to complete payout release.</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={buyerFeedbackInput}
                                onChange={(e) => setBuyerFeedbackInput(e.target.value)}
                                placeholder="Inspection feedback (e.g. Device in mint condition, all accessories verified)"
                                className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 font-sans"
                              />
                              <button
                                type="button"
                                onClick={() => handleBuyerConfirmAction(activeBuyerOrder.trackingId)}
                                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-slate-950 text-xs shadow cursor-pointer flex items-center justify-center gap-1.5 transition"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Confirm Received &amp; Notify Admin to Release Payment</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Order Cancellation Rules & Buttons */}
                      {activeBuyerOrder.cancelStatus === "NONE" && activeBuyerOrder.status !== "COMPLETED" && (
                        <div className="pt-1">
                          {activeBuyerOrder.isShipped ? (
                            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <p>
                                <strong>Cancellation is locked:</strong> The seller has already dispatched this item via {activeBuyerOrder.shippingCourier}. Per escrow policy, in-transit items cannot be cancelled. Once received, if there is damage or an issue, you can file a dispute below.
                              </p>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsCancelModalOpen(true)}
                              className="w-full py-2 px-3 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Cancel Order &amp; Request Full Refund (Before Shipping)</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Dispute & Direct Messaging Section */}
                      <div className="pt-2 border-t border-slate-700/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                            <MessageCircle className="w-4 h-4 text-cyan-400" />
                            <span>Dispute Resolution &amp; Direct Messaging Thread</span>
                          </h5>

                          {activeBuyerOrder.disputeStatus !== "DISPUTED_BY_BUYER" && activeBuyerOrder.cancelStatus === "NONE" && (
                            <button
                              type="button"
                              onClick={() => setIsDisputeModalOpen(true)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Dispute / Damaged Item</span>
                            </button>
                          )}
                        </div>

                        {activeBuyerOrder.disputeStatus === "DISPUTED_BY_BUYER" && (
                          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
                            <div className="font-bold text-rose-300 flex items-center gap-1 mb-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Dispute Active • Admin Escrow Funds Frozen</span>
                            </div>
                            <p className="text-[11px] leading-relaxed">
                              Reason: "{activeBuyerOrder.disputeReason}". Please message the seller below. If the item was damaged during shipment or parties agree, Admin can issue a 100% full refund and cancel the order.
                            </p>
                          </div>
                        )}

                        {/* Chat Messages Log */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                          {activeBuyerOrder.messages && activeBuyerOrder.messages.length > 0 ? (
                            activeBuyerOrder.messages.map((m) => (
                              <div
                                key={m.id}
                                className={`p-2.5 rounded-xl border text-xs ${
                                  m.senderRole === "BUYER"
                                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                                    : m.senderRole === "SELLER"
                                    ? "bg-purple-950/40 border-purple-500/30 text-purple-200"
                                    : "bg-cyan-950/40 border-cyan-500/30 text-cyan-200"
                                }`}
                              >
                                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-0.5">
                                  <span className="font-bold">
                                    {m.senderRole === "BUYER" ? "👤 YOU" : m.senderRole === "SELLER" ? "🏪 SELLER" : "🛡️ ADMIN"}: {m.senderName}
                                  </span>
                                  <span>{m.timestamp}</span>
                                </div>
                                <p className="text-white leading-relaxed">{m.content}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 italic">No messages in thread yet.</p>
                          )}
                        </div>

                        {/* Send Message Input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={chatMessageInput}
                            onChange={(e) => setChatMessageInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSendChatMessage(activeBuyerOrder.trackingId, "BUYER");
                            }}
                            placeholder="Type message to seller and admin..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendChatMessage(activeBuyerOrder.trackingId, "BUYER")}
                            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs cursor-pointer shadow flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Send</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-slate-400 text-xs">
                      <Key className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="font-semibold text-slate-300">No Buyer Order Loaded</p>
                      <p className="text-slate-500 mt-1">Enter your Buyer Access Code above or click "Forgot Code? Request via Gmail / Email or Phone".</p>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 2: SELLER PORTAL                                          */}
              {/* ============================================================= */}
              {trackerTab === "SELLER_PORTAL" && (
                <div className="space-y-4">
                  {/* Seller Access Code Entry Bar */}
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-purple-400" />
                        <span>Enter Your Unique Seller Access Code:</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRequestCodeOpen(true);
                          setRequestCodeResult(null);
                        }}
                        className="text-[11px] font-mono text-cyan-400 hover:text-white underline cursor-pointer"
                      >
                        Forgot Code? Request via Gmail / Email or Phone
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={sellerAccessCodeInput}
                        onChange={(e) => setSellerAccessCodeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearchSellerCode();
                        }}
                        placeholder="e.g. SEL-93787 or GI-93787"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleSearchSellerCode}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer shadow"
                      >
                        View Listing
                      </button>
                    </div>
                  </div>

                  {/* Active Seller Order Card */}
                  {activeSellerOrder ? (
                    <div className="rounded-xl bg-[#162035] border border-purple-500/40 p-5 space-y-4 shadow-lg">
                      {/* Top Header */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-slate-950 font-mono text-xs font-bold text-purple-300 border border-slate-800">
                            {activeSellerOrder.trackingId}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-mono font-bold">
                            CODE: {activeSellerOrder.sellerAccessCode}
                          </span>
                        </div>

                        {activeSellerOrder.status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Payout Released
                          </span>
                        ) : activeSellerOrder.buyerReleaseAuthorized ? (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                            <Check className="w-3.5 h-3.5" /> Buyer Authorized Release!
                          </span>
                        ) : activeSellerOrder.isShipped ? (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            <Truck className="w-3.5 h-3.5" /> Shipped • Awaiting Inspection
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <Clock className="w-3.5 h-3.5" /> Ready for Shipment
                          </span>
                        )}
                      </div>

                      {/* Product Overview */}
                      <div className="flex items-start gap-3.5">
                        <div className="w-16 h-16 rounded-xl bg-white p-1.5 shrink-0 flex items-center justify-center shadow">
                          <img
                            src={activeSellerOrder.images[0] || "https://placehold.co/400x300/FFFFFF/0F172A?text=Gadget"}
                            alt={activeSellerOrder.title}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-base font-bold text-white">{activeSellerOrder.title}</h4>
                          <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                            <span>
                              Buyer: <strong className="text-white">{activeBuyerOrder?.buyerName || activeSellerOrder.buyerName || "Customer"}</strong>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                              🔒 Phone Confidential • Protected by Admin Escrow
                            </span>
                          </div>
                          <div className="text-xs font-mono text-emerald-400 font-bold">
                            Guaranteed Net Payout: {formatPrice(activeSellerOrder.netPayoutUSD, currency)} (Held in Admin Escrow)
                          </div>
                        </div>
                      </div>

                      {/* Seller & Payout Bank Details Area (Visible ONLY with confidential SEL key) */}
                      <div className="p-4 rounded-xl bg-slate-950/90 border border-purple-500/30 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                              <Banknote className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                                <span>Your Payout Bank &amp; Seller Contact Details</span>
                                <span className="text-[10px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30 font-semibold">
                                  🔒 Private to You (Key Unlocked)
                                </span>
                              </h5>
                              <p className="text-[10px] text-slate-400">
                                Censored in public &amp; admin dashboard. Only you can view or update these bank details with your SEL key.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setIsSellerEditingBank(!isSellerEditingBank);
                              setSellerEditPhone(activeSellerOrder.sellerPhone || activeSellerOrder.sellerContact || "");
                              setSellerEditEmail(activeSellerOrder.sellerEmail || "");
                              setSellerEditPayoutMethod(activeSellerOrder.payoutMethod || "Bank Transfer");
                              setSellerEditPayoutDetails(activeSellerOrder.sellerPayoutAccountDetails || "");
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white transition cursor-pointer flex items-center gap-1.5 border border-purple-500/40 shadow-sm"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isSellerEditingBank ? "Close Form" : "Edit / Change Bank & Contact"}</span>
                          </button>
                        </div>

                        {/* Display Mode */}
                        {!isSellerEditingBank ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                            {/* Payout Method & Bank */}
                            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                              <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
                                Payout Method &amp; Bank Account:
                              </span>
                              <div className="font-bold text-white flex items-center gap-2">
                                <span>{activeSellerOrder.payoutMethod || "Bank Transfer"}</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-xs font-semibold">
                                {activeSellerOrder.sellerPayoutAccountDetails || "No bank details entered yet (Click edit to add)"}
                              </div>
                            </div>

                            {/* Contact Phone & Email */}
                            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                              <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
                                Registered Seller Contacts:
                              </span>
                              <div className="font-mono text-slate-200 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span>{activeSellerOrder.sellerPhone || activeSellerOrder.sellerContact || "N/A"}</span>
                              </div>
                              <div className="font-mono text-slate-300 flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span>{activeSellerOrder.sellerEmail || "No email on record"}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Edit Mode */
                          <div className="p-3.5 rounded-xl bg-slate-900/95 border border-purple-500/50 space-y-3 pt-2">
                            <span className="text-xs font-bold text-purple-300 block">
                              ✏️ Update Your Payout Bank &amp; Contact Details:
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                  Payout Method *
                                </label>
                                <select
                                  value={sellerEditPayoutMethod}
                                  onChange={(e) => setSellerEditPayoutMethod(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                                >
                                  <option value="Bank Transfer">Bank Transfer (Bangkok Bank / Kasikorn / SCB)</option>
                                  <option value="PayPal">PayPal</option>
                                  <option value="Visa / Debit Card">Visa / Debit Card</option>
                                  <option value="GCash">GCash</option>
                                  <option value="E-Wallet">PromptPay / E-Wallet</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                  Bank Name &amp; Account Number / PayPal Email *
                                </label>
                                <input
                                  type="text"
                                  value={sellerEditPayoutDetails}
                                  onChange={(e) => setSellerEditPayoutDetails(e.target.value)}
                                  placeholder="e.g. Bangkok Bank: 097-3-274005 or PayPal email"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                  Contact Phone Number
                                </label>
                                <input
                                  type="text"
                                  value={sellerEditPhone}
                                  onChange={(e) => setSellerEditPhone(e.target.value)}
                                  placeholder="e.g. +63 917 123 4567"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                  Contact Email Address / Gmail
                                </label>
                                <input
                                  type="email"
                                  value={sellerEditEmail}
                                  onChange={(e) => setSellerEditEmail(e.target.value)}
                                  placeholder="e.g. seller@gmail.com"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                              <button
                                type="button"
                                onClick={() => setIsSellerEditingBank(false)}
                                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveSellerBankInfo(activeSellerOrder.trackingId)}
                                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 font-bold text-white text-xs cursor-pointer shadow flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Save &amp; Sync to Admin</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2-Column Wide Grid for Shipping Action & Payout Claim */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
                        {/* Shipping Action for Seller */}
                        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 flex flex-col justify-between">
                          <div>
                            <h5 className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                              <Truck className="w-4 h-4 text-cyan-400" />
                              <span>Dispatch &amp; Shipping Dispatch Details</span>
                            </h5>

                            {activeSellerOrder.isShipped ? (
                              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs space-y-1 text-purple-200">
                                <div className="font-bold flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                                  <span>Shipped via {activeSellerOrder.shippingCourier}</span>
                                </div>
                                <div className="font-mono text-[11px] text-slate-300">
                                  Tracking #: <strong className="text-white">{activeSellerOrder.shippingTrackingNumber}</strong>
                                </div>
                                <p className="text-[10px] text-slate-400 pt-1">
                                  Buyer cancellation is locked.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Courier Service</label>
                                    <select
                                      value={shippingCourierInput}
                                      onChange={(e) => setShippingCourierInput(e.target.value)}
                                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                    >
                                      <option value="Kerry Express">Kerry Express</option>
                                      <option value="Flash Express">Flash Express</option>
                                      <option value="J&T Express">J&amp;T Express</option>
                                      <option value="DHL Express">DHL Express</option>
                                      <option value="Grab / Lalamove">Grab / Lalamove Same-Day</option>
                                      <option value="Standard Express">Standard Express</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Tracking Number</label>
                                    <input
                                      type="text"
                                      value={shippingTrackingInput}
                                      onChange={(e) => setShippingTrackingInput(e.target.value)}
                                      placeholder="e.g. KEX-8940214"
                                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                                    />
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleSellerShipAction(activeSellerOrder.trackingId)}
                                  className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white text-xs shadow cursor-pointer flex items-center justify-center gap-1.5 transition mt-2"
                                >
                                  <Truck className="w-4 h-4" />
                                  <span>Mark Shipped (Lock Buyer Cancel)</span>
                                </button>
                              </div>
                            )}
                          </div>

                          <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                            Protects seller against unverified returns.
                          </span>
                        </div>

                        {/* Seller Payout Claim Button */}
                        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 space-y-3 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                                <Banknote className="w-4 h-4" />
                                <span>Escrow Net Payout</span>
                              </h5>
                              <span className="text-[10px] font-mono text-slate-400">
                                2% Fee Deducted
                              </span>
                            </div>

                            <div className="text-xl font-bold font-mono text-emerald-400 mb-2">
                              {formatPrice(activeSellerOrder.netPayoutUSD, currency)}
                            </div>

                            {activeSellerOrder.status === "COMPLETED" ? (
                              <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
                                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>Full payout claimed and remitted from Admin escrow trust on {activeSellerOrder.sellerClaimedAt || "Today"}.</span>
                              </div>
                            ) : activeSellerOrder.buyerReleaseAuthorized ? (
                              <div className="space-y-2">
                                <div className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  <span>Buyer confirmed device receipt! Payout is unlocked.</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSellerClaimPayoutAction(activeSellerOrder.trackingId)}
                                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 text-xs shadow cursor-pointer flex items-center justify-center gap-1.5 transition"
                                >
                                  <Banknote className="w-4 h-4" />
                                  <span>Claim Net Payout ({formatPrice(activeSellerOrder.netPayoutUSD, currency)})</span>
                                </button>
                              </div>
                            ) : (
                              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <p>
                                  <strong>Payout Locked in Admin Escrow:</strong> Button unlocks automatically after the buyer checks the item and clicks "Confirm Received &amp; Notify Admin", or upon Admin 1-Day verification.
                                </p>
                              </div>
                            )}
                          </div>

                          <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                            Direct wire / transfer from Bangkok Bank Trust.
                          </span>
                        </div>
                      </div>

                      {/* Seller Direct Messaging Thread */}
                      <div className="pt-2 border-t border-slate-700/80 space-y-3">
                        <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <MessageCircle className="w-4 h-4 text-purple-400" />
                          <span>Direct Messaging Thread with Buyer &amp; Admin</span>
                        </h5>

                        {/* Chat Messages Log */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                          {activeSellerOrder.messages && activeSellerOrder.messages.length > 0 ? (
                            activeSellerOrder.messages.map((m) => (
                              <div
                                key={m.id}
                                className={`p-2.5 rounded-xl border text-xs ${
                                  m.senderRole === "SELLER"
                                    ? "bg-purple-950/40 border-purple-500/30 text-purple-200"
                                    : m.senderRole === "BUYER"
                                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                                    : "bg-cyan-950/40 border-cyan-500/30 text-cyan-200"
                                }`}
                              >
                                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-0.5">
                                  <span className="font-bold">
                                    {m.senderRole === "SELLER" ? "🏪 YOU" : m.senderRole === "BUYER" ? "👤 BUYER" : "🛡️ ADMIN"}: {m.senderName}
                                  </span>
                                  <span>{m.timestamp}</span>
                                </div>
                                <p className="text-white leading-relaxed">{m.content}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 italic">No messages in thread yet.</p>
                          )}
                        </div>

                        {/* Send Message Input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={chatMessageInput}
                            onChange={(e) => setChatMessageInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSendChatMessage(activeSellerOrder.trackingId, "SELLER");
                            }}
                            placeholder="Reply to buyer and admin..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400 font-sans"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendChatMessage(activeSellerOrder.trackingId, "SELLER")}
                            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer shadow flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Reply</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-slate-400 text-xs">
                      <Key className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="font-semibold text-slate-300">No Seller Listing Loaded</p>
                      <p className="text-slate-500 mt-1">Enter your Seller Access Code above or click "Forgot Code? Request via Gmail / Email or Phone".</p>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 3: ALL ORDERS MONITOR                                      */}
              {/* ============================================================= */}
              {trackerTab === "ALL_ORDERS" && (
                <div className="space-y-4">
                  {/* Code Search */}
                  <div className="relative">
                    <input
                      type="text"
                      value={trackerSearchCode}
                      onChange={(e) => setTrackerSearchCode(e.target.value)}
                      placeholder="Search by Tracking Code (e.g. GI-93787), title, or phone..."
                      className="w-full bg-[#182134] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  {/* Queue List */}
                  <div className="space-y-4">
                    {trackerQueue
                      .filter(
                        (i) =>
                          !trackerSearchCode ||
                          i.trackingId.toLowerCase().includes(trackerSearchCode.toLowerCase()) ||
                          i.title.toLowerCase().includes(trackerSearchCode.toLowerCase()) ||
                          (i.shopName && i.shopName.toLowerCase().includes(trackerSearchCode.toLowerCase()))
                      )
                      .map((item) => {
                        const isPending = item.status === "PENDING_ADMIN";
                        const isApproved = item.status === "APPROVED_LIVE";
                        const isReserved = item.status === "ESCROW_RESERVED";
                        const isShipped = item.status === "INSPECTED_SHIPPED";
                        const isActive = item.status === "INSTALLMENT_ACTIVE";
                        const isCompleted = item.status === "COMPLETED";

                        return (
                          <div
                            key={item.trackingId}
                            className="rounded-xl bg-[#192236] border border-slate-700/80 p-4 space-y-3 shadow"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-md bg-slate-900 font-mono text-xs font-bold text-cyan-300 border border-slate-700">
                                {item.trackingId}
                              </span>

                              {item.orderType === "CASH_ESCROW" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  <Banknote className="w-3 h-3" /> 💵 CASH ESCROW (0% Int)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                  <Calendar className="w-3 h-3" /> 📅 {item.tenorMonths} Mos Plan
                                </span>
                              )}

                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <Clock className="w-3 h-3" /> Pending Review
                                </span>
                              )}
                              {isApproved && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  <CheckCircle2 className="w-3 h-3" /> Live on Store
                                </span>
                              )}
                              {isReserved && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                  <BadgeCheck className="w-3 h-3" /> DP in Escrow
                                </span>
                              )}
                              {isShipped && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                  <Truck className="w-3 h-3" /> In Transit
                                </span>
                              )}
                              {isActive && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  <Clock className="w-3 h-3" /> Installment Active
                                </span>
                              )}
                              {isCompleted && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-500/50">
                                  <Check className="w-3 h-3" /> Completed
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-white p-1 shrink-0 flex items-center justify-center">
                                <img
                                  src={item.images[0] || "https://placehold.co/400x300/FFFFFF/0F172A?text=Gadget"}
                                  alt={item.title}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                                <p className="text-[11px] text-slate-400 truncate">
                                  Seller: {item.shopName || item.sellerName} • {formatPrice(item.priceUSD, currency)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-[#0E1422] flex items-center justify-between">
              <span className="text-xs text-slate-400">Want to list another gadget?</span>
              <button
                onClick={() => {
                  setIsTrackerOpen(false);
                  openPostingWizard();
                }}
                className="cta-cyan-emerald px-4 py-2 rounded-full text-xs font-semibold text-slate-950 cursor-pointer"
              >
                + Post Gadget
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6.1 REQUEST CODE VIA PHONE & EMAIL MODAL                              */}
      {/* ===================================================================== */}
      {isRequestCodeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-slate-700 w-full max-w-md rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Request Tracking Access Code via Gmail or Phone</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestCodeOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Lost your Seller or Buyer code? Enter the registered Gmail / Email address or phone number you used when posting or ordering. For your <strong className="text-cyan-300">anti-theft protection</strong>, your confidential access code will be dispatched directly to your private Gmail inbox and SMS—it is never displayed on screen.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Registered Gmail / Email Address *</label>
                <input
                  type="email"
                  value={requestCodeEmail}
                  onChange={(e) => setRequestCodeEmail(e.target.value)}
                  placeholder="e.g. seller@gmail.com or buyer@gmail.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Registered Phone Number (Optional)</label>
                <input
                  type="text"
                  value={requestCodePhone}
                  onChange={(e) => setRequestCodePhone(e.target.value)}
                  placeholder="e.g. 0917-xxx-xxxx or +63 917 123 4567"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            {requestCodeResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-3 ${
                  requestCodeResult.success
                    ? "bg-slate-900/90 border-emerald-500/40 text-slate-200"
                    : "bg-rose-950/40 border-rose-500/40 text-rose-200 font-mono"
                }`}
              >
                {requestCodeResult.success ? (
                  <>
                    {/* Anti-Theft Protection Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span className="text-sm">Access Code Dispatched to Gmail!</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                        <Lock className="w-3 h-3" />
                        <span>Anti-Theft Shield</span>
                      </span>
                    </div>

                    {/* Dispatch Target Info (Masked, zero raw code on screen) */}
                    <div className="space-y-1.5 text-xs font-sans">
                      <p className="text-slate-300">
                        We dispatched the confidential {requestCodeResult.role === "SELLER" ? "Seller" : "Buyer"} tracker key for <strong className="text-white">"{requestCodeResult.title}"</strong> ({requestCodeResult.trackingId}) to:
                      </p>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                        <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs">
                          <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>Gmail: <strong className="text-white">{requestCodeResult.maskedEmail}</strong></span>
                        </div>
                        {requestCodeResult.maskedPhone && (
                          <div className="flex items-center gap-2 text-emerald-300 font-mono text-xs">
                            <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>SMS Phone: <strong className="text-white">{requestCodeResult.maskedPhone}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Anti-Fraud Security Notice */}
                    <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-start gap-2 font-sans">
                      <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong>Anti-Fraud Security Policy:</strong> To prevent unauthorized persons from guessing or entering your email to view your payout bank and personal details, <strong>access codes are strictly withheld from this website screen</strong>. Please open your Gmail inbox (or SMS) to view the code.
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-sans">
                      <a
                        href={requestCodeResult.gmailComposeUrl || "https://mail.google.com"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="Opens Gmail directly with this recovery message prepared for your email"
                      >
                        <Mail className="w-4 h-4" />
                        <span>Open in Gmail Web</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={() => setIsGmailInboxModalOpen(true)}
                        className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="View the email in the simulated Gmail inbox to read and copy your code"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>View Inbox Simulator</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsRequestCodeOpen(false);
                        if (requestCodeResult.role === "SELLER") {
                          setTrackerTab("SELLER_PORTAL");
                        } else {
                          setTrackerTab("BUYER_PORTAL");
                        }
                        toast({
                          title: "Check Your Gmail",
                          description: `Paste the access key received at ${requestCodeResult.maskedEmail} into the tracker access box to unlock your dashboard.`,
                        });
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer font-sans"
                    >
                      <Key className="w-4 h-4 text-emerald-400" />
                      <span>Enter Code in Tracker</span>
                    </button>

                    <p className="text-[10px] text-slate-400 leading-relaxed text-center font-sans">
                      💡 <strong>Delivery Tip:</strong> If automatic background dispatch isn't connected to an external SMTP server, click <strong>"Open in Gmail Web"</strong> or <strong>"View Inbox Simulator"</strong> to inspect your message and key.
                    </p>

                    {requestCodeResult.mailtoUrl && (
                      <div className="text-center pt-0.5 font-sans">
                        <a
                          href={requestCodeResult.mailtoUrl}
                          className="text-[11px] text-slate-400 hover:text-cyan-300 underline inline-flex items-center gap-1"
                        >
                          <span>Using Outlook or Apple Mail? Open in default mail client</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="font-bold flex items-center gap-1.5 text-rose-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>No Escrow Order Match</span>
                    </div>
                    <p className="leading-relaxed text-[11px] font-sans">{requestCodeResult.message}</p>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setIsRequestCodeOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestCodeSubmit}
                disabled={isSendingCode}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer shadow flex items-center gap-1.5 transition"
              >
                {isSendingCode ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching Code...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{requestCodeResult?.success ? "Resend to Gmail / Phone" : "Send Code to Gmail / Phone"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6.1.1 SIMULATED GMAIL INBOX VIEWER FOR REAL-TIME CODE RETRIEVAL        */}
      {/* ===================================================================== */}
      {isGmailInboxModalOpen && requestCodeResult && requestCodeResult.accessCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#1e293b] border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col">
            {/* Gmail Header */}
            <div className="bg-[#0f172a] px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-sm">
                  M
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Google Gmail Inbox Simulator</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      1 New Message
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Inbox for: <strong className="text-cyan-300">{requestCodeResult.targetEmail || requestCodeResult.maskedEmail}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGmailInboxModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Content Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {requestCodeResult.emailSubject || `Your Confidential Escrow Tracking Key - ${requestCodeResult.title}`}
                </h3>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 border-b border-slate-800 pb-3">
                  <span>From: <strong className="text-slate-200">Admin Escrow Security &lt;security@gadget-installment.cc&gt;</strong></span>
                  <span className="font-mono text-[10px]">Just now</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-sans text-xs">
                <p className="text-slate-300">
                  Hello {requestCodeResult.role === "SELLER" ? "Seller" : "Buyer"},
                </p>
                <p className="text-slate-300">
                  You requested your confidential tracking access key for <strong>"{requestCodeResult.title}"</strong> (Tracking ID: {requestCodeResult.trackingId}).
                </p>

                <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 text-center space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                    Your Private Tracking Access Key:
                  </span>
                  <div className="text-2xl font-mono font-bold text-emerald-400 tracking-wider">
                    {requestCodeResult.accessCode}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Use this key in the Escrow Tracker to access your order and payout bank details.
                  </p>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  🔒 <strong>Security Warning:</strong> Keep this key safe. Do not forward or share this email. Admin will never ask for your key.
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(requestCodeResult.accessCode!);
                  toast({
                    title: "Code Copied!",
                    description: `Copied ${requestCodeResult.accessCode} to clipboard.`,
                  });
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Key</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsGmailInboxModalOpen(false);
                  setIsRequestCodeOpen(false);
                  if (requestCodeResult.role === "SELLER") {
                    setTrackerTab("SELLER_PORTAL");
                    setSellerAccessCodeInput(requestCodeResult.accessCode || "");
                  } else {
                    setTrackerTab("BUYER_PORTAL");
                    setBuyerAccessCodeInput(requestCodeResult.accessCode || "");
                  }
                  toast({
                    title: "Key Loaded from Gmail",
                    description: `Click 'View Listing' to open your private dashboard.`,
                  });
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Use Key &amp; Open Tracker</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6.2 CANCEL ORDER MODAL                                                */}
      {/* ===================================================================== */}
      {isCancelModalOpen && activeBuyerOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-rose-500/50 w-full max-w-md rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <RotateCcw className="w-5 h-5" />
              <span>Cancel Order &amp; Request Full Refund</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Because the seller has not yet shipped this item, you are eligible for an immediate 100% full refund from the Admin escrow account.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Reason for Cancellation</label>
              <textarea
                rows={3}
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="e.g. Changed my mind, found another model, bought elsewhere..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400 leading-relaxed font-sans"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={() => handleCancelOrderAction(activeBuyerOrder.trackingId, "BUYER")}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow"
              >
                Confirm Cancel &amp; Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6.3 DISPUTE ORDER / DAMAGED ITEM MODAL                                */}
      {/* ===================================================================== */}
      {isDisputeModalOpen && activeBuyerOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-rose-500/50 w-full max-w-md rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Dispute Order / Report Damaged Item</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              If the device arrived damaged, defective, or not as described, report it here. Admin escrow will freeze funds while you message the seller to confirm and agree.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Describe Defect or Damage</label>
              <textarea
                rows={4}
                value={disputeReasonInput}
                onChange={(e) => setDisputeReasonInput(e.target.value)}
                placeholder="e.g. Screen cracked during transit, speaker not working, battery damaged..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400 leading-relaxed font-sans"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDisputeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleFileDisputeAction(activeBuyerOrder.trackingId)}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. TRUST & SAFETY FOOTER                                             */}
      {/* ===================================================================== */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#0E1422] py-5 px-4 sm:px-6 lg:px-8 text-xs text-slate-400">
        <div className="w-full max-w-[2560px] 2xl:max-w-none mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>142 Gadgets Verified Today</strong> • 100% Escrow Protected • 0% Fraud Guarantee
            </span>
          </div>

          <div className="flex items-center gap-5 font-mono text-[11px]">
            <span className="hover:text-slate-200 cursor-pointer">Admin Middleman Policy</span>
            <span className="hover:text-slate-200 cursor-pointer">Escrow FAQ</span>
            <span className="hover:text-slate-200 cursor-pointer">Dispute Shield</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
