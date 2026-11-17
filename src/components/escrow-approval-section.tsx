"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  ExternalLink,
  DollarSign,
  User,
  ArrowUpRight,
  AlertCircle,
  FileText,
  BadgeCheck,
  Percent,
  Truck,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  ChevronDown,
  Check,
  MessageSquare,
  Lock,
  Store,
  Banknote,
  RotateCcw,
  Edit3,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Send,
  X,
  Camera,
  Film,
  Play,
  Link as LinkIcon,
  CreditCard,
  Wallet,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  EscrowItem,
  getEscrowQueue,
  updateEscrowStatus,
  recordMonthlyPayment,
  confirmCashEscrowRelease,
  editEscrowItem,
  deleteEscrowItem,
  adminRefundAndCancel,
  addEscrowMessage,
  updateEscrowPaymentDetails,
  deleteEscrowPaymentDetails,
} from "@/lib/escrow-store";
import {
  Currency,
  CURRENCIES,
  formatPrice,
  getSavedCurrency,
  saveCurrency,
} from "@/lib/currency";

export default function EscrowApprovalSection() {
  const { toast } = useToast();
  const { db } = useFirebase();
  const [queue, setQueue] = useState<EscrowItem[]>([]);
  const [searchCode, setSearchCode] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [expandedPaymentOrderId, setExpandedPaymentOrderId] = useState<string | null>(null);

  // Admin Edit & Listings Sync State
  const [editingItem, setEditingItem] = useState<EscrowItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    priceUSD: 0,
    downpaymentPct: 0,
    tenorMonths: 12,
    condition: "Mint 99%",
    shopName: "",
    sellerName: "",
    sellerContact: "",
    description: "",
  });

  // Admin Payment & Receiving Methods Management State
  const [editingPaymentItem, setEditingPaymentItem] = useState<EscrowItem | null>(null);
  const [paymentEditForm, setPaymentEditForm] = useState({
    paymentMethod: "PAYPAL",
    paymentReference: "",
    paymentAccountDeposited: "",
    paymentAmountUSD: 0,
    paymentStatus: "VERIFIED_IN_ESCROW",
    paymentNotes: "",
    buyerReceiveMethod: "PAYPAL",
    buyerReceiveAccountDetails: "",
    sellerPayoutAccountDetails: "",
    payoutMethod: "Bank Transfer",
  });

  // Sensitive bank details censorship / masking state in Admin Dashboard
  const [unmaskedSensitives, setUnmaskedSensitives] = useState<Record<string, boolean>>({});

  const toggleUnmaskSensitive = (key: string) => {
    setUnmaskedSensitives((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const maskBankOrAccount = (val?: string, fieldKey?: string): string => {
    if (!val || !val.trim()) return "Details pending";
    if (fieldKey && unmaskedSensitives[fieldKey]) return val;

    // Mask bank accounts e.g. "Bangkok Bank: 097-3-274005" -> "Bangkok Bank: •••• •••• 4005"
    const digits = val.replace(/\D/g, "");
    if (digits.length >= 4) {
      const last4 = digits.slice(-4);
      const textPrefix = val.replace(/[\d\-\s]+$/, "").trim();
      return `${textPrefix ? textPrefix + " " : ""}•••• •••• ${last4}`;
    }

    // Mask email e.g. "seller@gmail.com" -> "s••••••r@gmail.com"
    if (val.includes("@")) {
      const [u, d] = val.split("@");
      if (u.length <= 2) return `${u.charAt(0)}•••@${d}`;
      return `${u.slice(0, 2)}••••••${u.slice(-1)}@${d}`;
    }

    if (val.length > 4) {
      return `•••••••• ${val.slice(-4)}`;
    }

    return "••••••••";
  };

  const [adminReplyText, setAdminReplyText] = useState<Record<string, string>>({});
  const [isUpdatingListings, setIsUpdatingListings] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCurrency(getSavedCurrency());
    setQueue(getEscrowQueue());

    const handleQueueUpdate = () => {
      setQueue(getEscrowQueue());
    };

    const handleCurrencyChange = (e: any) => {
      if (e.detail) setCurrency(e.detail);
    };

    window.addEventListener("escrow_queue_updated", handleQueueUpdate);
    window.addEventListener("currency_changed", handleCurrencyChange);

    return () => {
      window.removeEventListener("escrow_queue_updated", handleQueueUpdate);
      window.removeEventListener("currency_changed", handleCurrencyChange);
    };
  }, []);

  const handleCurrencySelect = (c: Currency) => {
    setCurrency(c);
    saveCurrency(c);
  };

  // 1. Admin Approves & Publishes Listing (syncs to Firestore gadgetPosts as In Stock)
  const handleApprove = async (trackingId: string, title: string) => {
    const updated = updateEscrowStatus(trackingId, "APPROVED_LIVE", "Approved & auto-calculated by Admin");
    setQueue(updated);

    const approvedItem = queue.find((i) => i.trackingId === trackingId);
    if (db && approvedItem) {
      try {
        const postsRef = collection(db, "gadgetPosts");
        const q = query(postsRef, where("productNumber", "==", approvedItem.trackingId));
        const snap = await getDocs(q);

        const postData = {
          productNumber: approvedItem.trackingId,
          productName: approvedItem.title,
          category: approvedItem.category || "laptops",
          condition: approvedItem.condition || "Mint 99%",
          description: approvedItem.description || "",
          cashPrice: Math.round(approvedItem.priceUSD * 35),
          downPayment: Math.round(approvedItem.downpaymentUSD * 35),
          installmentMonths: approvedItem.tenorMonths,
          monthlyInstallment: Math.round(approvedItem.monthlyPaymentUSD * 35),
          adminName: approvedItem.sellerName || "Escrow Seller",
          shopName: approvedItem.shopName || approvedItem.sellerName || "Verified Shop",
          contactNumber: approvedItem.sellerContact,
          socialMedia: approvedItem.sellerContact,
          externalLink: "",
          isSold: false,
          stockStatus: "In Stock",
          imageUrl: approvedItem.images[0] || "",
          updatedAt: new Date().toISOString(),
        };

        if (!snap.empty) {
          // Update existing listing document rather than creating a duplicate
          await updateDoc(doc(db, "gadgetPosts", snap.docs[0].id), postData);
        } else {
          await addDoc(postsRef, {
            ...postData,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn("Could not sync approved post to Firestore:", err);
      }
    }

    toast({
      title: "Listing Approved & Published Live!",
      description: `"${title}" is now active in the Guest Marketplace for buyers with auto-calculated installment rates.`,
    });
  };

  // 2. Admin Rejects Listing
  const handleReject = async (trackingId: string, title: string) => {
    const updated = updateEscrowStatus(trackingId, "REJECTED", "Device failed inspection / photos rejected by Admin");
    setQueue(updated);

    // If it was previously published in Firestore gadgetPosts, remove it so it's not live to buyers
    if (db) {
      try {
        const postsRef = collection(db, "gadgetPosts");
        const docIdsToDelete = new Set<string>();

        const q1 = query(postsRef, where("productNumber", "==", trackingId));
        const snap1 = await getDocs(q1);
        snap1.docs.forEach((d) => docIdsToDelete.add(d.id));

        const rawId = trackingId.replace(/^GI-/, "");
        if (rawId && rawId !== trackingId) {
          const qRaw = query(postsRef, where("productNumber", "==", rawId));
          const snapRaw = await getDocs(qRaw);
          snapRaw.docs.forEach((d) => docIdsToDelete.add(d.id));
        }

        await Promise.all(
          Array.from(docIdsToDelete).map((docId) =>
            deleteDoc(doc(db, "gadgetPosts", docId)).catch(() => {})
          )
        );
      } catch (err) {
        console.warn("Could not delete rejected post from Firestore:", err);
      }
    }

    // Clear from marketplace cache
    try {
      const rawCache = localStorage.getItem("gi_cached_marketplace_items");
      if (rawCache) {
        const parsed = JSON.parse(rawCache);
        if (Array.isArray(parsed)) {
          const rawId = trackingId.replace(/^GI-/, "");
          const cleaned = parsed.filter(
            (i: any) =>
              i.id !== trackingId &&
              i.id !== rawId &&
              i.productNumber !== trackingId &&
              i.productNumber !== rawId
          );
          localStorage.setItem("gi_cached_marketplace_items", JSON.stringify(cleaned));
        }
      }
    } catch {}

    window.dispatchEvent(new CustomEvent("escrow_queue_updated", { detail: updated }));
    window.dispatchEvent(new CustomEvent("gadget_post_deleted", { detail: { trackingId, title } }));

    toast({
      variant: "destructive",
      title: "Listing Rejected",
      description: `Listing ${title} has been rejected and removed from buyer marketplace.`,
    });
  };

  // 3. Admin Releases Device to Ship to Buyer
  const handleReleaseToShip = (trackingId: string, title: string) => {
    const updated = updateEscrowStatus(
      trackingId,
      "INSTALLMENT_ACTIVE",
      "Downpayment verified in escrow. Middleman fee deducted. Device cleared for delivery."
    );
    setQueue(updated);
    toast({
      title: "Device Cleared for Delivery!",
      description: `Downpayment verified for ${title}. Seller cleared to hand over / ship device. Installment schedule activated.`,
    });
  };

  // 4. Admin Updates & Releases Monthly Customer Payment
  const handleRecordMonthPaid = (trackingId: string, monthNumber: number, title: string) => {
    const updated = recordMonthlyPayment(trackingId, monthNumber, `Month ${monthNumber} verified and released by Admin`);
    setQueue(updated);
    toast({
      title: `Month ${monthNumber} Payment Verified & Released!`,
      description: `Payment for ${title} recorded. Payout remitted to seller. Customer balance updated.`,
    });
  };

  // 5. Admin Confirms Inspection & Releases Cash Payout to Seller (Express 1-day or agreed holding window)
  const handleConfirmCashRelease = (trackingId: string, title: string) => {
    const updated = confirmCashEscrowRelease(
      trackingId,
      "Admin confirmed device inspection & released full cash escrow payout to seller."
    );
    setQueue(updated);
    toast({
      title: "Cash Escrow Released to Seller!",
      description: `Full payment for "${title}" has been released to the seller upon transaction verification.`,
    });
  };

  // 6. Admin Command: Start Edit Details
  const handleStartEdit = (item: EscrowItem) => {
    setEditingItem(item);
    setEditForm({
      title: item.title,
      priceUSD: item.priceUSD,
      downpaymentPct: item.downpaymentPct,
      tenorMonths: item.tenorMonths,
      condition: item.condition,
      shopName: item.shopName || "",
      sellerName: item.sellerName || "",
      sellerContact: item.sellerContact || "",
      description: item.description || "",
    });
  };

  // 7. Admin Command: Save Edit Details
  const handleSaveEdit = () => {
    if (!editingItem) return;
    const updated = editEscrowItem(editingItem.trackingId, {
      title: editForm.title,
      priceUSD: editForm.priceUSD,
      downpaymentPct: editForm.downpaymentPct,
      tenorMonths: editForm.tenorMonths,
      condition: editForm.condition,
      shopName: editForm.shopName,
      sellerName: editForm.sellerName,
      sellerContact: editForm.sellerContact,
      description: editForm.description,
    });
    setQueue(updated);
    toast({
      title: "Escrow Listing Updated",
      description: `Changes to "${editForm.title}" have been saved.`,
    });
    setEditingItem(null);
  };

  // 7b. Admin Command: Start Edit Payment Details
  const handleStartEditPayment = (item: EscrowItem) => {
    setEditingPaymentItem(item);
    const defaultAmount =
      item.paymentAmountUSD ||
      (item.orderType === "CASH_ESCROW" ? item.priceUSD : item.downpaymentUSD) ||
      item.priceUSD;

    let defaultAccount = item.paymentAccountDeposited || "";
    if (!defaultAccount) {
      if (item.paymentMethod === "PAYPAL") {
        defaultAccount = "Admin Escrow PayPal: escrow-admin@gadget-installment.cc";
      } else if (item.paymentMethod === "GCASH") {
        defaultAccount = "Admin GCash Escrow Trust: +63 973 274 005 (GI Escrow Admin)";
      } else {
        defaultAccount = "Admin Bangkok Bank Escrow Account: 097-3-274005 (Gadget Installment Trust Co.)";
      }
    }

    setPaymentEditForm({
      paymentMethod: item.paymentMethod || "PAYPAL",
      paymentReference: item.paymentReference || "",
      paymentAccountDeposited: defaultAccount,
      paymentAmountUSD: Math.round(defaultAmount * 100) / 100,
      paymentStatus: item.paymentStatus || "VERIFIED_IN_ESCROW",
      paymentNotes: item.paymentNotes || "",
      buyerReceiveMethod: item.buyerReceiveMethod || "PAYPAL",
      buyerReceiveAccountDetails: item.buyerReceiveAccountDetails || "",
      sellerPayoutAccountDetails: item.sellerPayoutAccountDetails || "",
      payoutMethod: item.payoutMethod || "Bank Transfer",
    });
  };

  // 7c. Admin Command: Save Edit Payment Details
  const handleSaveEditPayment = () => {
    if (!editingPaymentItem) return;
    const updated = updateEscrowPaymentDetails(editingPaymentItem.trackingId, {
      paymentMethod: paymentEditForm.paymentMethod,
      paymentReference: paymentEditForm.paymentReference.trim(),
      paymentAccountDeposited: paymentEditForm.paymentAccountDeposited.trim(),
      paymentAmountUSD: Number(paymentEditForm.paymentAmountUSD) || 0,
      paymentStatus: paymentEditForm.paymentStatus,
      paymentNotes: paymentEditForm.paymentNotes.trim(),
      buyerReceiveMethod: paymentEditForm.buyerReceiveMethod,
      buyerReceiveAccountDetails: paymentEditForm.buyerReceiveAccountDetails.trim(),
      sellerPayoutAccountDetails: paymentEditForm.sellerPayoutAccountDetails.trim(),
      payoutMethod: paymentEditForm.payoutMethod,
    });
    setQueue(updated);
    toast({
      title: "Payment Details Updated!",
      description: `Payment details and buyer receive method for "${editingPaymentItem.title}" have been saved.`,
    });
    setEditingPaymentItem(null);
  };

  // 7d. Admin Command: Delete / Reset Payment Details
  const handleDeletePayment = (trackingId: string, title: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Are you sure you want to delete and reset payment details for "${title}" (${trackingId})?`
      )
    ) {
      return;
    }
    const updated = deleteEscrowPaymentDetails(trackingId);
    setQueue(updated);
    toast({
      title: "Payment Details Deleted",
      description: `Payment records for "${title}" have been removed from escrow ledger.`,
    });
  };

  // 8. Admin Command: Delete Item from Escrow Queue & Escrow Market
  const handleDelete = async (trackingId: string, title: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Are you sure you want to delete "${title}" (${trackingId}) from the Escrow Queue and Escrow Market listings?`
      )
    ) {
      return;
    }

    const itemToDelete = queue.find((i) => i.trackingId === trackingId);

    // 1. Delete from local Escrow Queue
    const updated = deleteEscrowItem(trackingId);
    setQueue(updated);

    // 2. Delete all matching documents from Firestore `gadgetPosts`
    if (db) {
      try {
        const postsRef = collection(db, "gadgetPosts");
        const docIdsToDelete = new Set<string>();

        // Query by productNumber == trackingId (e.g. GI-12345)
        const qTracking = query(postsRef, where("productNumber", "==", trackingId));
        const snapTracking = await getDocs(qTracking);
        snapTracking.docs.forEach((d) => docIdsToDelete.add(d.id));

        // Query by raw numeric part if trackingId has GI- prefix
        const rawId = trackingId.replace(/^GI-/, "");
        if (rawId && rawId !== trackingId) {
          const qRaw = query(postsRef, where("productNumber", "==", rawId));
          const snapRaw = await getDocs(qRaw);
          snapRaw.docs.forEach((d) => docIdsToDelete.add(d.id));
        }

        // Query by title match (e.g. "Macbook 123")
        const targetTitle = (title || itemToDelete?.title || "").trim();
        if (targetTitle) {
          const qTitle = query(postsRef, where("productName", "==", targetTitle));
          const snapTitle = await getDocs(qTitle);
          snapTitle.docs.forEach((d) => {
            const data = d.data();
            const shopMatch = itemToDelete?.shopName && data.shopName === itemToDelete.shopName;
            const sellerMatch = itemToDelete?.sellerName && data.adminName === itemToDelete.sellerName;
            const prodNumMatch = data.productNumber === trackingId || data.productNumber === rawId;
            if (shopMatch || sellerMatch || prodNumMatch || snapTitle.docs.length === 1) {
              docIdsToDelete.add(d.id);
            }
          });
        }

        // Also check if document directly has ID == trackingId
        try {
          docIdsToDelete.add(trackingId);
        } catch {}

        await Promise.all(
          Array.from(docIdsToDelete).map((docId) =>
            deleteDoc(doc(db, "gadgetPosts", docId)).catch(() => {})
          )
        );
      } catch (err) {
        console.warn("Could not delete matching gadgetPosts from Firestore:", err);
      }
    }

    // 3. Clear from localStorage cached marketplace items
    try {
      const rawCache = localStorage.getItem("gi_cached_marketplace_items");
      if (rawCache) {
        const parsed = JSON.parse(rawCache);
        if (Array.isArray(parsed)) {
          const rawId = trackingId.replace(/^GI-/, "");
          const cleaned = parsed.filter((i: any) => {
            if (i.id === trackingId || i.id === rawId || i.productNumber === trackingId || i.productNumber === rawId) {
              return false;
            }
            if (
              itemToDelete?.title &&
              i.title?.toLowerCase().trim() === itemToDelete.title.toLowerCase().trim()
            ) {
              if (
                !itemToDelete.shopName ||
                i.shopName === itemToDelete.shopName ||
                i.seller?.includes(itemToDelete.shopName)
              ) {
                return false;
              }
            }
            return true;
          });
          localStorage.setItem("gi_cached_marketplace_items", JSON.stringify(cleaned));
        }
      }
    } catch {}

    // 4. Dispatch events to notify all active windows & components
    window.dispatchEvent(new CustomEvent("escrow_queue_updated", { detail: updated }));
    window.dispatchEvent(
      new CustomEvent("gadget_post_deleted", { detail: { trackingId, title } })
    );

    toast({
      variant: "destructive",
      title: "Item Deleted",
      description: `"${title}" was removed from the Escrow Queue and Escrow Market listings.`,
    });
  };

  // 9. Admin Command: Update to Store Listings (Sync to Firestore gadgetPosts)
  const handleUpdateToListings = async (item: EscrowItem) => {
    setIsUpdatingListings((prev) => ({ ...prev, [item.trackingId]: true }));
    try {
      if (db) {
        const postsRef = collection(db, "gadgetPosts");
        const q = query(postsRef, where("productNumber", "==", item.trackingId));
        const snap = await getDocs(q);

        const postData = {
          productNumber: item.trackingId,
          productName: item.title,
          category: item.category || "laptops",
          condition: item.condition || "Mint 99%",
          description: item.description || "",
          cashPrice: Math.round(item.priceUSD * 35),
          downPayment: Math.round(item.downpaymentUSD * 35),
          installmentMonths: item.tenorMonths,
          monthlyInstallment: Math.round(item.monthlyPaymentUSD * 35),
          adminName: item.sellerName || "Escrow Seller",
          shopName: item.shopName || item.sellerName || "Verified Shop",
          contactNumber: item.sellerContact,
          socialMedia: item.sellerContact,
          stockStatus: "In Stock",
          imageUrl: item.images[0] || "",
          updatedAt: new Date().toISOString(),
        };

        if (!snap.empty) {
          const docId = snap.docs[0].id;
          await updateDoc(doc(db, "gadgetPosts", docId), postData);
        } else {
          await addDoc(postsRef, {
            ...postData,
            createdAt: new Date().toISOString(),
            isSold: false,
            externalLink: "",
          });
        }
      }

      if (item.status === "PENDING_ADMIN") {
        const updated = updateEscrowStatus(item.trackingId, "APPROVED_LIVE", "Synced & Approved live on marketplace");
        setQueue(updated);
      }

      toast({
        title: "Synced to Store Listings!",
        description: `"${item.title}" details have been updated in live marketplace listings.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: err.message || "Failed to sync listing to store.",
      });
    } finally {
      setIsUpdatingListings((prev) => ({ ...prev, [item.trackingId]: false }));
    }
  };

  // 10. Admin Command: Full Refund to Buyer on Dispute / Broken Goods
  const handleAdminRefundDispute = (trackingId: string, title: string) => {
    if (typeof window !== "undefined" && !window.confirm(`Issue full 100% refund to buyer for "${title}" from escrow and cancel order?`)) {
      return;
    }
    const updated = adminRefundAndCancel(
      trackingId,
      "Admin reviewed buyer dispute, verified issue with parties, and issued full refund to buyer."
    );
    setQueue(updated);
    toast({
      title: "Dispute Resolved • Full Refund Issued",
      description: `Funds returned to buyer from escrow account. Order for "${title}" cancelled.`,
    });
  };

  // 11. Admin Command: Send Message to Dispute / Order Thread
  const handleAdminSendChatMessage = (trackingId: string) => {
    const text = (adminReplyText[trackingId] || "").trim();
    if (!text) return;
    const updated = addEscrowMessage(trackingId, "ADMIN", "Admin Escrow Officer", text);
    setQueue(updated);
    setAdminReplyText((prev) => ({ ...prev, [trackingId]: "" }));
    toast({
      title: "Message Sent",
      description: "Admin message added to the order thread.",
    });
  };

  // Metrics Counters
  const pendingCount = queue.filter((i) => i.status === "PENDING_ADMIN").length;
  const liveCount = queue.filter((i) => i.status === "APPROVED_LIVE").length;
  const reservedCount = queue.filter((i) => i.status === "ESCROW_RESERVED").length;
  const activeInstallmentsCount = queue.filter(
    (i) => i.status === "INSTALLMENT_ACTIVE" || i.status === "INSPECTED_SHIPPED"
  ).length;
  const completedCount = queue.filter((i) => i.status === "COMPLETED").length;

  // Extract Company / Seller Names arranged from A to Z alphabet
  const sellerOptions = useMemo(() => {
    const map = new Map<string, { name: string; pendingCount: number; totalCount: number }>();

    queue.forEach((item) => {
      const rawName = (item.shopName || item.sellerName || item.sellerContact || "Independent Seller").trim();
      if (!rawName) return;

      const existing = map.get(rawName) || { name: rawName, pendingCount: 0, totalCount: 0 };
      existing.totalCount += 1;
      // Check if item wants confirmation from Admin
      if (
        item.status === "PENDING_ADMIN" ||
        item.status === "ESCROW_RESERVED" ||
        (item.orderType === "CASH_ESCROW" && item.cashEscrowStatus !== "CONFIRMED_RELEASED")
      ) {
        existing.pendingCount += 1;
      }
      map.set(rawName, existing);
    });

    // Sort alphabetically from A to Z (case-insensitive)
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [queue]);

  // Filtered List based on Status, Seller A-Z, and Search Code
  const filteredQueue = queue.filter((item) => {
    // 1. Company / Seller Filter
    if (selectedSeller !== "all") {
      const itemSeller = (item.shopName || item.sellerName || item.sellerContact || "").trim().toLowerCase();
      if (itemSeller !== selectedSeller.trim().toLowerCase()) {
        return false;
      }
    }

    // 2. Search Code / Keyword Filter
    const matchesCode =
      !searchCode ||
      item.trackingId.toLowerCase().includes(searchCode.toLowerCase()) ||
      item.title.toLowerCase().includes(searchCode.toLowerCase()) ||
      (item.shopName && item.shopName.toLowerCase().includes(searchCode.toLowerCase())) ||
      (item.sellerName && item.sellerName.toLowerCase().includes(searchCode.toLowerCase())) ||
      (item.sellerContact && item.sellerContact.toLowerCase().includes(searchCode.toLowerCase())) ||
      (item.buyerName && item.buyerName.toLowerCase().includes(searchCode.toLowerCase())) ||
      (item.buyerContact && item.buyerContact.toLowerCase().includes(searchCode.toLowerCase()));

    if (!matchesCode) return false;

    // 3. Status Tabs Filter
    if (statusFilter === "pending") return item.status === "PENDING_ADMIN";
    if (statusFilter === "live") return item.status === "APPROVED_LIVE";
    if (statusFilter === "reserved") return item.status === "ESCROW_RESERVED";
    if (statusFilter === "active_plans")
      return item.status === "INSTALLMENT_ACTIVE" || item.status === "INSPECTED_SHIPPED";
    if (statusFilter === "completed") return item.status === "COMPLETED";

    return true;
  });

  return (
    <div className="w-full space-y-5">
      {/* Top Banner & Multi-Currency Switcher */}
      <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-blue-500/25 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
                Escrow Queue &amp; Order Approvals
                {pendingCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    {pendingCount} Pending Review
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Exclusive Admin Control: Verify sellers, inspect devices, approve listings, release escrow payouts, and track monthly schedules.
              </p>
            </div>
          </div>
        </div>

        {/* Currency Switcher: USD ($), PHP (₱), THB (฿) */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl p-1 shrink-0">
          <span className="text-[11px] font-mono text-slate-400 px-2 uppercase font-semibold">
            Currency:
          </span>
          {(["USD", "PHP", "THB"] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => handleCurrencySelect(c)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                currency === c
                  ? "bg-emerald-500 text-slate-950 shadow-sm font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              {CURRENCIES[c].symbol} {c}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Row (Full Width Left to Right) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-amber-500/40 transition">
          <span className="text-xs text-slate-400 font-medium block">1. Pending Review</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-300">{pendingCount}</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Requires admin inspection &amp; approval</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-emerald-500/40 transition">
          <span className="text-xs text-slate-400 font-medium block">2. Live on Store</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-400">{liveCount}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Auto-calculated installment cards</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-cyan-500/40 transition">
          <span className="text-xs text-slate-400 font-medium block">3. Downpayment in Escrow</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-cyan-400">{reservedCount}</span>
            <BadgeCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Buyer deposited downpayment</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-purple-500/40 transition">
          <span className="text-xs text-slate-400 font-medium block">4. Active Monthly Plans</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-purple-400">{activeInstallmentsCount}</span>
            <Truck className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Payments stream monthly</span>
        </div>
      </div>

      {/* FULL-WIDTH STATUS TABS: Using all spaces from left to right */}
      <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-1.5 shadow-lg backdrop-blur-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 w-full">
          {[
            { id: "all", label: "All Items", count: queue.length, icon: Store, color: "text-slate-300" },
            { id: "pending", label: "Pending Review", count: pendingCount, icon: Clock, color: "text-amber-400" },
            { id: "live", label: "Live on Store", count: liveCount, icon: CheckCircle2, color: "text-emerald-400" },
            { id: "reserved", label: "DP in Escrow", count: reservedCount, icon: BadgeCheck, color: "text-cyan-400" },
            { id: "active_plans", label: "Active Plans", count: activeInstallmentsCount, icon: Truck, color: "text-purple-400" },
            { id: "completed", label: "Completed", count: completedCount, icon: Check, color: "text-emerald-400" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? "bg-slate-800 text-white border border-slate-700 shadow-md ring-1 ring-cyan-500/40"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${tab.color}`} />
                  <span className="truncate">{tab.label}</span>
                </div>
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold tabular-nums shrink-0 ${
                    isActive
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-slate-950 text-slate-400 border border-slate-800"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTROL BAR: Search Input & Company / Seller A-Z Dropdown */}
      <div className="w-full flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/90 shadow-md">
        {/* Search Input (Left) */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="Search by Tracking Code (e.g. GI-93787), Seller/Buyer name, phone, or title..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none transition shadow-inner font-sans"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          {searchCode && (
            <button
              onClick={() => setSearchCode("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Company / Seller Dropdown (A to Z) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative min-w-[280px] sm:min-w-[360px]">
            <select
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              className="w-full appearance-none bg-slate-950 border border-slate-700/80 focus:border-cyan-400 rounded-xl pl-10 pr-9 py-2.5 text-xs font-semibold text-white focus:outline-none cursor-pointer shadow-inner transition"
            >
              <option value="all">
                🏢 All Companies / Sellers ({sellerOptions.length} total • {queue.length} items)
              </option>
              {sellerOptions.map((seller) => (
                <option key={seller.name} value={seller.name}>
                  {seller.name} ({seller.totalCount} item{seller.totalCount > 1 ? "s" : ""}
                  {seller.pendingCount > 0 ? ` • ⚠️ ${seller.pendingCount} needs confirmation` : ""})
                </option>
              ))}
            </select>
            <Store className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {selectedSeller !== "all" && (
            <button
              onClick={() => setSelectedSeller("all")}
              className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono font-medium transition cursor-pointer border border-slate-700 shrink-0 flex items-center gap-1.5"
              title="Reset seller filter"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Pill */}
      {selectedSeller !== "all" && (
        <div className="flex items-center justify-between bg-cyan-950/40 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-xs w-full shadow-sm">
          <div className="flex items-center gap-2 text-cyan-300">
            <Store className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Showing items for Company / Seller: <strong className="text-white underline font-bold">{selectedSeller}</strong>
              {" "}({filteredQueue.length} record{filteredQueue.length !== 1 ? "s" : ""} found)
            </span>
          </div>
          <button
            onClick={() => setSelectedSeller("all")}
            className="text-cyan-400 hover:text-white text-xs font-mono underline cursor-pointer"
          >
            Clear Filter (Show All)
          </button>
        </div>
      )}

      {/* REDESIGNED QUEUE CARDS: Expansive 3-Column Layout Across Full Space */}
      <div className="space-y-4 w-full">
        {filteredQueue.map((item) => {
          const isPending = item.status === "PENDING_ADMIN";
          const isApproved = item.status === "APPROVED_LIVE";
          const isReserved = item.status === "ESCROW_RESERVED";
          const isActive = item.status === "INSTALLMENT_ACTIVE" || item.status === "INSPECTED_SHIPPED";
          const isCompleted = item.status === "COMPLETED";
          const isRejected = item.status === "REJECTED";
          const isExpanded = expandedPaymentOrderId === item.trackingId;

          return (
            <div
              key={item.trackingId}
              className={`bg-slate-900/90 border rounded-2xl p-5 sm:p-6 transition shadow-lg w-full ${
                isPending
                  ? "border-amber-500/40 bg-gradient-to-r from-amber-500/5 via-slate-900/90 to-slate-900/90"
                  : isApproved
                  ? "border-emerald-500/40"
                  : isReserved
                  ? "border-cyan-500/40"
                  : isActive
                  ? "border-purple-500/40"
                  : "border-slate-800"
              }`}
            >
              {/* Top Meta Line: Tracking ID, Order Type Pill, Status Pill, Timestamp */}
              <div className="flex items-center justify-between gap-3 pb-3.5 mb-4 border-b border-slate-800/80 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-md bg-slate-950 font-mono text-xs font-bold text-cyan-300 border border-slate-800">
                    {item.trackingId}
                  </span>

                  {item.orderType === "CASH_ESCROW" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                      <Banknote className="w-3.5 h-3.5" /> 💵 CASH ESCROW (0% Int) • {item.cashHoldingDays || "3-7 Days"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                      <Calendar className="w-3.5 h-3.5" /> 📅 MONTHLY INSTALLMENT PLAN
                    </span>
                  )}

                  {isPending && (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      <Clock className="w-3.5 h-3.5" /> 1. Pending Admin Review
                    </span>
                  )}

                  {isApproved && (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 2. Live on Store (Awaiting Buyer)
                    </span>
                  )}

                  {isReserved && (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      <BadgeCheck className="w-3.5 h-3.5" /> 3. Buyer DP in Escrow (Ready to Ship)
                    </span>
                  )}

                  {isActive && (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      <Truck className="w-3.5 h-3.5" /> 4. Shipped &amp; Installments Active
                    </span>
                  )}

                  {isCompleted && (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-500/50">
                      <Check className="w-3.5 h-3.5" /> 5. Completed &amp; Fully Paid
                    </span>
                  )}

                  {item.disputeStatus === "DISPUTED_BY_BUYER" && (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" /> 🚨 Disputed by Buyer
                    </span>
                  )}

                  {item.cancelStatus === "REFUNDED_BY_ADMIN" && (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      <RotateCcw className="w-3.5 h-3.5" /> Cancelled &amp; Refunded
                    </span>
                  )}
                </div>

                {/* Right side: Submitted time + Admin Command Toolset (Edit, Update to Listings, Delete) */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono text-slate-500 mr-1">{item.submittedAt}</span>

                  <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-cyan-300 hover:text-white hover:bg-cyan-500/20 transition cursor-pointer flex items-center gap-1 border border-cyan-500/30"
                      title="Edit item title, pricing, condition, details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateToListings(item)}
                      disabled={isUpdatingListings[item.trackingId]}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-300 hover:text-white hover:bg-emerald-500/20 transition cursor-pointer flex items-center gap-1 border border-emerald-500/30"
                      title="Sync/publish this escrow gadget to live marketplace listings"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingListings[item.trackingId] ? "animate-spin" : ""}`} />
                      <span>Update to Listings</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.trackingId, item.title)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-500/20 transition cursor-pointer border border-rose-500/30"
                      title="Delete from Escrow Queue & Escrow Market"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expansive 3-Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
                {/* Column 1 (4 cols / ~33%): Product Identity, Company & Contact Details */}
                <div className="lg:col-span-4 space-y-3.5">
                  <div className="flex items-start gap-3.5">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white p-2 shrink-0 flex items-center justify-center shadow-md">
                      <img
                        src={item.images[0] || "https://placehold.co/400x300/FFFFFF/0F172A?text=Gadget"}
                        alt={item.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-semibold">
                        <Store className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          Company / Shop: <strong className="text-white font-bold">{item.shopName || item.sellerName || "Private Seller"}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Parties Contact Cards */}
                  <div className="space-y-2.5 pt-1 text-xs">
                    {/* Seller Contact Card */}
                    <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                          <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>Seller: <strong className="text-white">{item.sellerName || "Alex R."}</strong></span>
                        </div>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
                          Seller Profile
                        </span>
                      </div>

                      {/* Explicit Seller Phone & Email */}
                      <div className="flex items-center justify-between bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-2 truncate">
                          <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="text-slate-300 font-mono text-xs truncate">
                            Phone: <strong className="text-white">{item.sellerPhone || item.sellerContact || "N/A"}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {(item.sellerPhone || item.sellerContact) && (
                            <a
                              href={`tel:${item.sellerPhone || item.sellerContact}`}
                              className="text-cyan-400 hover:text-cyan-300 p-1 rounded-md bg-cyan-950/50 border border-cyan-500/30"
                              title="Call / Text Seller"
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                          )}
                          {(item.sellerEmail || item.sellerContact) && (
                            <a
                              href={`mailto:${item.sellerEmail || item.sellerContact}`}
                              className="text-slate-400 hover:text-white p-1 rounded-md bg-slate-900 border border-slate-700"
                              title="Email Seller"
                            >
                              <Mail className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Seller Payout Method & Account (Censored for Client Privacy) */}
                      <div className="text-[11px] font-mono text-slate-400 bg-slate-900/50 px-2.5 py-1.5 rounded border border-slate-800/80 flex items-center justify-between gap-1 flex-wrap">
                        <span>Payout: <strong className="text-white">{item.payoutMethod || "Bank Transfer"}</strong></span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-cyan-300 font-mono text-[11px] truncate max-w-[170px]" title={item.sellerPayoutAccountDetails || "Pending setup"}>
                            {maskBankOrAccount(item.sellerPayoutAccountDetails, `seller-${item.trackingId}`)}
                          </span>
                          {item.sellerPayoutAccountDetails && (
                            <button
                              type="button"
                              onClick={() => toggleUnmaskSensitive(`seller-${item.trackingId}`)}
                              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer shrink-0"
                              title={unmaskedSensitives[`seller-${item.trackingId}`] ? "Mask bank account" : "Reveal bank account"}
                            >
                              {unmaskedSensitives[`seller-${item.trackingId}`] ? (
                                <EyeOff className="w-3 h-3 text-cyan-400" />
                              ) : (
                                <Eye className="w-3 h-3 text-slate-400" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Buyer Contact Card (ADMIN DASHBOARD ONLY - STRICT PRIVACY) */}
                    {(item.buyerContact || item.buyerPhone || item.buyerName) && (
                      <div className="bg-slate-950/90 p-3 rounded-xl border border-emerald-500/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                            <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>Buyer: <strong className="text-white">{item.buyerName || "Customer"}</strong></span>
                          </div>
                          <span className="text-[9px] font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40 font-bold flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Admin Eyes Only</span>
                          </span>
                        </div>

                        {/* Explicit Buyer Phone Number */}
                        <div className="flex items-center justify-between bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800">
                          <div className="flex items-center gap-2 truncate">
                            <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-slate-300 font-mono text-xs truncate">
                              Phone: <strong className="text-emerald-300">{item.buyerPhone || item.buyerContact || "Not provided"}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {(item.buyerPhone || item.buyerContact) && (
                              <a
                                href={`tel:${item.buyerPhone || item.buyerContact}`}
                                className="text-emerald-400 hover:text-emerald-300 p-1 rounded-md bg-emerald-950/50 border border-emerald-500/30 flex items-center gap-1"
                                title="Call Buyer"
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                            )}
                            {item.buyerEmail && (
                              <a
                                href={`mailto:${item.buyerEmail}`}
                                className="text-slate-400 hover:text-white p-1 rounded-md bg-slate-900 border border-slate-700"
                                title="Email Buyer"
                              >
                                <Mail className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Buyer's Method to Receive Payment / Refund (Censored for Client Privacy) */}
                        <div className="text-[11px] font-mono text-slate-400 bg-slate-900/50 px-2.5 py-1.5 rounded border border-slate-800/80 space-y-1">
                          <div className="flex justify-between items-center">
                            <span>Receive Method:</span>
                            <span className="text-emerald-300 font-bold">{item.buyerReceiveMethod || "PayPal"}</span>
                          </div>
                          {item.buyerReceiveAccountDetails && (
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="text-slate-400">Acct:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-emerald-300 font-mono truncate max-w-[160px]" title={item.buyerReceiveAccountDetails}>
                                  {maskBankOrAccount(item.buyerReceiveAccountDetails, `buyer-${item.trackingId}`)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleUnmaskSensitive(`buyer-${item.trackingId}`)}
                                  className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer shrink-0"
                                  title={unmaskedSensitives[`buyer-${item.trackingId}`] ? "Mask receiving account" : "Reveal receiving account"}
                                >
                                  {unmaskedSensitives[`buyer-${item.trackingId}`] ? (
                                    <EyeOff className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Eye className="w-3 h-3 text-slate-400" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2 (5 cols / ~42%): Separated Condition & Full Specifications (Takes ample space) */}
                <div className="lg:col-span-5 space-y-3">
                  {/* Box 1: Separated Condition Container */}
                  <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs flex items-center justify-between shadow-sm">
                    <span className="text-slate-400 font-semibold">Device Condition:</span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${
                        item.condition === "New" || item.condition === "Brand New"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/50"
                      }`}
                    >
                      {item.condition === "New" || item.condition === "Brand New" ? "✨ Brand New" : "📦 Used / Inspected"}
                    </span>
                  </div>

                  {/* Box 2: Separated Specifications & Inclusions Container (Expansive & Readable) */}
                  {item.description && (
                    <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 space-y-1.5 shadow-sm">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 block font-semibold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Item Specifications &amp; Inclusions:
                      </span>
                      <p className="text-slate-200 text-xs leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                        {item.description}
                      </p>
                    </div>
                  )}

                  {/* Admin Timeline Notes */}
                  {item.adminNotes && (
                    <div className="w-full bg-slate-950/50 border border-slate-800/80 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-400">
                      <span className="text-cyan-400 font-semibold">Admin Note: </span>
                      {item.adminNotes}
                    </div>
                  )}
                </div>

                {/* Column 3 (3 cols / ~25%): Financial Summary Card & Action Buttons */}
                <div className="lg:col-span-3 space-y-3">
                  {/* Auto-Calculated Financial Card */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 font-mono text-xs tabular-nums space-y-2 shadow-sm">
                    {item.orderType === "CASH_ESCROW" ? (
                      <>
                        <div className="flex justify-between text-slate-400">
                          <span>Total Cash Price:</span>
                          <span className="text-white font-bold">{formatPrice(item.priceUSD, currency)}</span>
                        </div>

                        <div className="flex justify-between text-emerald-400 font-semibold">
                          <span>Terms:</span>
                          <span>0% Interest (Cash Held in Escrow)</span>
                        </div>

                        <div className="flex justify-between text-cyan-300">
                          <span>Holding Window:</span>
                          <span>{item.cashHoldingDays || "3-7 Days"} Inspection</span>
                        </div>

                        <div className="flex justify-between text-rose-400 border-t border-slate-800/80 pt-1.5">
                          <span>Admin Middleman Fee ({item.feeRate}%):</span>
                          <span>-{formatPrice(item.feeAmountUSD, currency)}</span>
                        </div>

                        <div className="flex justify-between text-emerald-300 font-bold border-t border-slate-800 pt-1.5 text-sm">
                          <span>Guaranteed Net Payout:</span>
                          <span>{formatPrice(item.netPayoutUSD, currency)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-slate-400">
                          <span>Cash Asking Price:</span>
                          <span className="text-white font-bold">{formatPrice(item.priceUSD, currency)}</span>
                        </div>

                        <div className="flex justify-between text-cyan-300">
                          <span>Downpayment ({item.downpaymentPct}%):</span>
                          <span>{formatPrice(item.downpaymentUSD, currency)}</span>
                        </div>

                        <div className="flex justify-between text-emerald-400 font-semibold">
                          <span>{item.tenorMonths === 1 ? "1-Mo Cash Plan:" : "Monthly Plan:"}</span>
                          <span>
                            {item.tenorMonths === 1
                              ? `${formatPrice(item.monthlyPaymentUSD, currency)} (1 Mo • 0% Int)`
                              : `${formatPrice(item.monthlyPaymentUSD, currency)} / mo (${item.tenorMonths} mos)`}
                          </span>
                        </div>

                        <div className="flex justify-between text-rose-400 border-t border-slate-800/80 pt-1.5">
                          <span>Admin Middleman Fee ({item.feeRate}%):</span>
                          <span>-{formatPrice(item.feeAmountUSD, currency)}</span>
                        </div>

                        <div className="flex justify-between text-emerald-300 font-bold border-t border-slate-800 pt-1.5 text-sm">
                          <span>Net Seller Payout:</span>
                          <span>{formatPrice(item.netPayoutUSD, currency)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Admin Action Buttons */}
                  <div className="flex flex-col gap-2">
                    {/* Cash Escrow Confirmation Action (1-Day confirmation or inspection complete) */}
                    {item.orderType === "CASH_ESCROW" && item.cashEscrowStatus !== "CONFIRMED_RELEASED" && (
                      <Button
                        onClick={() => handleConfirmCashRelease(item.trackingId, item.title)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-10 px-4 gap-1.5 shadow cursor-pointer"
                      >
                        <Banknote className="w-4 h-4" />
                        ⚡ 1-Day / Inspection Release to Seller
                      </Button>
                    )}

                    {item.orderType === "CASH_ESCROW" && item.cashEscrowStatus === "CONFIRMED_RELEASED" && (
                      <span className="inline-flex items-center justify-center gap-1.5 text-xs text-emerald-300 font-mono py-2 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 font-bold w-full">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Cash Escrow Released
                      </span>
                    )}

                    {isPending && (
                      <>
                        <Button
                          onClick={() => handleApprove(item.trackingId, item.title)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-10 px-4 gap-1.5 shadow cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Approve &amp; Publish Live
                        </Button>

                        <Button
                          onClick={() => handleReject(item.trackingId, item.title)}
                          variant="outline"
                          className="w-full border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs h-9 px-3 gap-1 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>
                      </>
                    )}

                    {isReserved && item.orderType !== "CASH_ESCROW" && (
                      <Button
                        onClick={() => handleReleaseToShip(item.trackingId, item.title)}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs h-10 px-4 gap-1.5 shadow cursor-pointer"
                      >
                        <Truck className="w-4 h-4" />
                        Confirm Inspection &amp; Ship
                      </Button>
                    )}

                    {isApproved && (
                      <span className="inline-flex items-center justify-center gap-1 text-xs text-emerald-400 font-mono py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
                        <CheckCircle2 className="w-4 h-4" />
                        Awaiting Buyer Inquiries
                      </span>
                    )}

                    {item.orderType !== "CASH_ESCROW" && (isActive || isReserved || isCompleted) && (
                      <Button
                        onClick={() =>
                          setExpandedPaymentOrderId(isExpanded ? null : item.trackingId)
                        }
                        variant="outline"
                        className="w-full border-purple-500/40 text-purple-300 hover:bg-purple-500/10 text-xs h-10 px-3 gap-1.5 cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Monthly Payments ({item.monthsPaid}/{item.totalMonths})</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment & Payout Gateway Section (Admin Edit / Delete / Update) */}
              <div className="mt-4 pt-3.5 border-t border-slate-800/80 bg-slate-950/70 rounded-xl p-3.5 sm:p-4 space-y-3 w-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                        <span>Escrow Payment Details &amp; Receiving Methods</span>
                        {item.paymentMethod ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                            {item.paymentMethod === "PAYPAL"
                              ? "🔵 PayPal"
                              : item.paymentMethod === "BANK_TRANSFER"
                              ? "🏦 Bank Account"
                              : item.paymentMethod === "VISA_CARD"
                              ? "💳 Visa / Card"
                              : item.paymentMethod === "GCASH"
                              ? "🟢 GCash"
                              : item.paymentMethod}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                            No Payment Record
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Admin middleman escrow deposit, payment ref #, and buyer refund / return receiving method.
                      </p>
                    </div>
                  </div>

                  {/* Payment Actions: Edit & Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEditPayment(item)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition cursor-pointer flex items-center gap-1.5 shadow"
                      title="Edit PayPal, Bank Account, Visa / Card payment details and buyer receiving method"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{item.paymentMethod ? "Edit Payment Details" : "Add Payment Details"}</span>
                    </button>

                    {item.paymentMethod && (
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(item.trackingId, item.title)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-500/20 transition cursor-pointer flex items-center gap-1 border border-rose-500/30"
                        title="Delete payment details from this escrow item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Payment</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Payment & Receiving Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
                  {/* Card 1: Deposit Gateway & Ref */}
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                      Payment Gateway &amp; Status:
                    </span>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>
                        {item.paymentMethod === "PAYPAL"
                          ? "PayPal Escrow"
                          : item.paymentMethod === "BANK_TRANSFER"
                          ? "Bank Account Transfer"
                          : item.paymentMethod === "VISA_CARD"
                          ? "Visa / Card"
                          : item.paymentMethod || "Pending / Cash"}
                      </span>
                      {item.paymentStatus && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {item.paymentStatus}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-cyan-300 truncate" title={item.paymentReference || "N/A"}>
                      Ref: {item.paymentReference || "No reference recorded"}
                    </div>
                  </div>

                  {/* Card 2: Deposited Account & Amount */}
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                      Admin Escrow Account &amp; Amount:
                    </span>
                    <div className="font-bold text-emerald-400 font-mono">
                      {formatPrice(
                        item.paymentAmountUSD ||
                          (item.orderType === "CASH_ESCROW" ? item.priceUSD : item.downpaymentUSD) ||
                          item.priceUSD,
                        currency
                      )}
                    </div>
                    <div
                      className="text-[11px] font-mono text-slate-300 truncate"
                      title={item.paymentAccountDeposited || "Admin Escrow Account"}
                    >
                      {item.paymentAccountDeposited || "Admin Escrow Trust Account"}
                    </div>
                  </div>

                  {/* Card 3: Buyer's Method to Receive Payment (Refund/Return) */}
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block font-semibold">
                      Buyer Method to Receive:
                    </span>
                    <div className="font-bold text-white">
                      {item.buyerReceiveMethod === "PAYPAL"
                        ? "PayPal"
                        : item.buyerReceiveMethod === "BANK_TRANSFER"
                        ? "Bank Account"
                        : item.buyerReceiveMethod === "VISA_CARD"
                        ? "Visa / Debit Card"
                        : item.buyerReceiveMethod || "PayPal / Bank"}
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[11px] font-mono text-slate-300">
                      <span className="truncate" title={item.buyerReceiveAccountDetails || "Not provided"}>
                        {item.buyerReceiveAccountDetails
                          ? maskBankOrAccount(item.buyerReceiveAccountDetails, `buyer-gw-${item.trackingId}`)
                          : "Details pending from buyer"}
                      </span>
                      {item.buyerReceiveAccountDetails && (
                        <button
                          type="button"
                          onClick={() => toggleUnmaskSensitive(`buyer-gw-${item.trackingId}`)}
                          className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer shrink-0"
                          title={unmaskedSensitives[`buyer-gw-${item.trackingId}`] ? "Mask receiving details" : "Reveal receiving details"}
                        >
                          {unmaskedSensitives[`buyer-gw-${item.trackingId}`] ? (
                            <EyeOff className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Eye className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card 4: Seller Payout Method & Account */}
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 block font-semibold">
                      Seller Payout Destination:
                    </span>
                    <div className="font-bold text-white">
                      {item.payoutMethod || "Bank Transfer"}
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[11px] font-mono text-slate-300">
                      <span className="truncate" title={item.sellerPayoutAccountDetails || "Pending claim"}>
                        {item.sellerPayoutAccountDetails
                          ? maskBankOrAccount(item.sellerPayoutAccountDetails, `seller-gw-${item.trackingId}`)
                          : "Provided during claim"}
                      </span>
                      {item.sellerPayoutAccountDetails && (
                        <button
                          type="button"
                          onClick={() => toggleUnmaskSensitive(`seller-gw-${item.trackingId}`)}
                          className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer shrink-0"
                          title={unmaskedSensitives[`seller-gw-${item.trackingId}`] ? "Mask payout details" : "Reveal payout details"}
                        >
                          {unmaskedSensitives[`seller-gw-${item.trackingId}`] ? (
                            <EyeOff className="w-3 h-3 text-cyan-400" />
                          ) : (
                            <Eye className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dispute Review & Direct Buyer-Seller-Admin Messages Thread */}
              {(item.disputeStatus === "DISPUTED_BY_BUYER" || (item.messages && item.messages.length > 0)) && (
                <div className="mt-4 pt-4 border-t border-slate-800 bg-slate-950/70 rounded-xl p-4 sm:p-5 space-y-3.5 w-full">
                  {item.disputeStatus === "DISPUTED_BY_BUYER" && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>🚨 Buyer Filed an Order Dispute / Damaged in Shipment</span>
                          </div>
                          <p className="text-xs text-rose-200 mt-1 font-mono">
                            Dispute Reason: "{item.disputeReason || "Item arrived defective or broken in transit"}"
                          </p>
                        </div>

                        <Button
                          onClick={() => handleAdminRefundDispute(item.trackingId, item.title)}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-9 px-4 shrink-0 shadow cursor-pointer gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Issue 100% Refund to Buyer &amp; Close</span>
                        </Button>
                      </div>

                      {/* Attached Evidence Proofs (Photos, Unboxing Videos, External Links) */}
                      {item.disputeEvidenceLinks && item.disputeEvidenceLinks.length > 0 && (
                        <div className="pt-2.5 border-t border-rose-500/20">
                          <span className="text-[10px] font-mono font-bold text-rose-300 block mb-1.5">
                            Buyer's Attached Evidence Photos &amp; Video Proofs ({item.disputeEvidenceLinks.length}):
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {item.disputeEvidenceLinks.map((url, idx) => {
                              const isImg =
                                url.startsWith("data:image/") ||
                                /\.(jpeg|jpg|png|webp|gif)($|\?)/i.test(url) ||
                                url.includes("images.unsplash.com");
                              const isVid =
                                url.startsWith("data:video/") ||
                                url.includes("youtube.com") ||
                                url.includes("youtu.be") ||
                                url.includes("vimeo.com") ||
                                url.includes("streamable.com") ||
                                /\.(mp4|mov|webm)($|\?)/i.test(url);
                              const isDrive = url.includes("drive.google.com");
                              const isICloud = url.includes("icloud.com");
                              const isDropbox = url.includes("dropbox.com");

                              return (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-rose-500/40 text-rose-200 text-xs font-semibold transition hover:border-rose-400 shadow group"
                                >
                                  {isImg ? (
                                    <div className="flex items-center gap-1.5">
                                      <img src={url} alt="Proof" className="w-5 h-5 rounded object-cover border border-rose-400/50" />
                                      <span>View Photo #{idx + 1}</span>
                                    </div>
                                  ) : isVid ? (
                                    <div className="flex items-center gap-1.5 text-red-400">
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                      <span>{url.includes("youtu") ? "YouTube Unboxing Video" : `Video Proof #${idx + 1}`}</span>
                                    </div>
                                  ) : isDrive ? (
                                    <div className="flex items-center gap-1.5 text-amber-300">
                                      <span className="font-bold text-[10px] bg-amber-500/20 px-1 rounded">Drive</span>
                                      <span>Google Drive Proof</span>
                                    </div>
                                  ) : isICloud ? (
                                    <div className="flex items-center gap-1.5 text-sky-300">
                                      <span className="font-bold text-[10px] bg-sky-500/20 px-1 rounded">iCloud</span>
                                      <span>iCloud Shared Album</span>
                                    </div>
                                  ) : isDropbox ? (
                                    <div className="flex items-center gap-1.5 text-blue-300">
                                      <span className="font-bold text-[10px] bg-blue-500/20 px-1 rounded">Dropbox</span>
                                      <span>Dropbox Proof</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-purple-300">
                                      <LinkIcon className="w-3.5 h-3.5" />
                                      <span>Evidence Link #{idx + 1}</span>
                                    </div>
                                  )}
                                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-rose-300 transition" />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Messages Thread */}
                  <div>
                    <h5 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 mb-2.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Order Communication Thread &amp; Dispute Records ({item.messages?.length || 0} messages)</span>
                    </h5>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                      {item.messages && item.messages.length > 0 ? (
                        item.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-2.5 rounded-xl border text-xs ${
                              msg.senderRole === "ADMIN"
                                ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-200"
                                : msg.senderRole === "BUYER"
                                ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-200"
                                : "bg-purple-950/30 border-purple-500/30 text-purple-200"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono mb-1 text-slate-400">
                              <span className="font-bold uppercase tracking-wider">
                                {msg.senderRole === "ADMIN" ? "🛡️ ADMIN" : msg.senderRole === "BUYER" ? "👤 BUYER" : "🏪 SELLER"}: {msg.senderName}
                              </span>
                              <span>{msg.timestamp}</span>
                            </div>
                            <p className="text-white leading-relaxed">{msg.content}</p>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex flex-wrap gap-1.5">
                                {msg.attachments.map((url, aIdx) => (
                                  <a
                                    key={aIdx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-cyan-300 hover:text-white"
                                  >
                                    <span>Proof #{aIdx + 1}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 italic">No messages logged yet.</p>
                      )}
                    </div>

                    {/* Admin Message Reply Bar */}
                    <div className="flex items-center gap-2 mt-3">
                      <Input
                        type="text"
                        value={adminReplyText[item.trackingId] || ""}
                        onChange={(e) =>
                          setAdminReplyText((prev) => ({ ...prev, [item.trackingId]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAdminSendChatMessage(item.trackingId);
                        }}
                        placeholder="Reply as Admin to Buyer and Seller in this thread..."
                        className="bg-slate-900 border-slate-700 text-xs text-white placeholder:text-slate-500 h-9"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAdminSendChatMessage(item.trackingId)}
                        className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs h-9 px-3 shrink-0 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Expandable Monthly Payment Manager (Spans Full Width Below) */}
              {isExpanded && (
                <div className="mt-5 pt-4 border-t border-slate-800 bg-slate-950/60 rounded-xl p-4 sm:p-5 space-y-3 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-cyan-400" />
                        Customer Monthly Installment Ledger &amp; Seller Payout Release
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        When the buyer pays each monthly bill, click below to verify and release the monthly payout to the seller.
                      </p>
                    </div>

                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                      Progress: {item.monthsPaid} / {item.totalMonths} Months Completed
                    </span>
                  </div>

                  {/* Monthly Schedule Table */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-2">
                    {item.monthlySchedule.map((month) => {
                      const isPaid = month.status === "RELEASED_TO_SELLER";

                      return (
                        <div
                          key={month.monthNumber}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-2 font-mono text-xs ${
                            isPaid
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                              : "bg-slate-900 border-slate-800 text-slate-300"
                          }`}
                        >
                          <div>
                            <span className="font-bold block text-white">
                              Month #{month.monthNumber}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              Due: {month.dueDate}
                            </span>
                            <span className="text-xs font-bold text-emerald-400">
                              {formatPrice(month.amountUSD, currency)}
                            </span>
                          </div>

                          <div>
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-md">
                                <Check className="w-3.5 h-3.5" />
                                Paid &amp; Released
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleRecordMonthPaid(item.trackingId, month.monthNumber, item.title)
                                }
                                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-[11px] h-7 px-2.5 shadow cursor-pointer"
                              >
                                Mark Paid &amp; Release
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredQueue.length === 0 && (
          <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-slate-400 text-xs w-full">
            <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-300 text-sm">No escrow records found</p>
            <p className="text-slate-500 mt-1">Try clearing your search query or selecting "All Companies / Sellers" from the dropdown.</p>
            {(selectedSeller !== "all" || searchCode || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSelectedSeller("all");
                  setSearchCode("");
                  setStatusFilter("all");
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono font-medium transition cursor-pointer border border-slate-700"
              >
                Reset All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Admin Edit Escrow Listing Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl p-6 shadow-2xl text-white space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Edit Escrow Listing: <span className="font-mono text-cyan-300">{editingItem.trackingId}</span>
                </h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Gadget Title / Model</label>
                <Input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="bg-slate-950 border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Asking Price ($ USD)</label>
                  <Input
                    type="number"
                    value={editForm.priceUSD}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, priceUSD: Number(e.target.value) }))}
                    className="bg-slate-950 border-slate-700 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Downpayment %</label>
                  <select
                    value={editForm.downpaymentPct}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, downpaymentPct: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white font-mono"
                  >
                    {[0, 10, 15, 20, 25, 30, 40, 50].map((pct) => (
                      <option key={pct} value={pct}>{pct}%</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tenor (Months)</label>
                  <select
                    value={editForm.tenorMonths}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, tenorMonths: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white font-mono"
                  >
                    {[1, 3, 6, 12, 24].map((m) => (
                      <option key={m} value={m}>{m} {m === 1 ? "Month (Cash 0% Int)" : "Months"}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Device Condition</label>
                  <div className="flex gap-2">
                    {["Brand New", "Used"].map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setEditForm((prev) => ({ ...prev, condition: cond }))}
                        className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-semibold cursor-pointer ${
                          editForm.condition === cond || (cond === "Brand New" && editForm.condition === "New")
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-400"
                            : "bg-slate-950 text-slate-400 border-slate-800"
                        }`}
                      >
                        {cond === "Brand New" ? "✨ Brand New" : "📦 Used / Inspected"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Company / Shop Name</label>
                  <Input
                    type="text"
                    value={editForm.shopName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, shopName: e.target.value }))}
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Seller / Poster Name</label>
                  <Input
                    type="text"
                    value={editForm.sellerName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, sellerName: e.target.value }))}
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Contact Phone / Email</label>
                  <Input
                    type="text"
                    value={editForm.sellerContact}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, sellerContact: e.target.value }))}
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Item Specifications &amp; Inclusions</label>
                <textarea
                  rows={4}
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 leading-relaxed font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingItem(null)}
                className="border-slate-700 text-slate-300 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold cursor-pointer"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Edit Payment Details & Buyer Method Modal */}
      {editingPaymentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl text-white space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Manage Payment Details &amp; Buyer Methods
                  </h3>
                  <span className="font-mono text-xs text-cyan-300">
                    Order ID: {editingPaymentItem.trackingId} • {editingPaymentItem.title}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditingPaymentItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Payment Gateway & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Payment Method / Gateway *
                  </label>
                  <select
                    value={paymentEditForm.paymentMethod}
                    onChange={(e) => {
                      const method = e.target.value;
                      let defaultAccount = paymentEditForm.paymentAccountDeposited;
                      if (method === "PAYPAL") {
                        defaultAccount = "Admin Escrow PayPal: escrow-admin@gadget-installment.cc";
                      } else if (method === "BANK_TRANSFER") {
                        defaultAccount = "Admin Bangkok Bank Escrow Account: 097-3-274005 (Gadget Installment Trust Co.)";
                      } else if (method === "VISA_CARD") {
                        defaultAccount = "Admin Bangkok Bank / Merchant Gateway: 097-3-274005";
                      } else if (method === "GCASH") {
                        defaultAccount = "Admin GCash Escrow Trust: +63 973 274 005 (GI Escrow Admin)";
                      }
                      setPaymentEditForm((prev) => ({
                        ...prev,
                        paymentMethod: method,
                        paymentAccountDeposited: defaultAccount,
                      }));
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium cursor-pointer"
                  >
                    <option value="PAYPAL">🔵 PayPal Escrow</option>
                    <option value="BANK_TRANSFER">🏦 Bank Account / Transfer</option>
                    <option value="VISA_CARD">💳 Visa / Mastercard / Card</option>
                    <option value="GCASH">🟢 GCash Mobile Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Escrow Payment Status
                  </label>
                  <select
                    value={paymentEditForm.paymentStatus}
                    onChange={(e) => setPaymentEditForm((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium cursor-pointer"
                  >
                    <option value="VERIFIED_IN_ESCROW">✅ Verified in Admin Escrow</option>
                    <option value="PENDING_VERIFICATION">⏳ Pending Verification</option>
                    <option value="RELEASED">💸 Released to Seller</option>
                    <option value="REFUNDED">🔄 Refunded to Buyer</option>
                  </select>
                </div>
              </div>

              {/* Amount & Reference ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Payment Reference ID / Transaction # *
                  </label>
                  <Input
                    type="text"
                    value={paymentEditForm.paymentReference}
                    onChange={(e) => setPaymentEditForm((prev) => ({ ...prev, paymentReference: e.target.value }))}
                    placeholder="e.g. PP-849201 / Card ending in 4921 / BBL-TXN-9301"
                    className="bg-slate-950 border-slate-700 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Payment Amount ($ USD)
                  </label>
                  <Input
                    type="number"
                    value={paymentEditForm.paymentAmountUSD}
                    onChange={(e) => setPaymentEditForm((prev) => ({ ...prev, paymentAmountUSD: Number(e.target.value) }))}
                    className="bg-slate-950 border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              {/* Deposit Destination Account */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Destination Account Deposited Into
                </label>
                <Input
                  type="text"
                  value={paymentEditForm.paymentAccountDeposited}
                  onChange={(e) => setPaymentEditForm((prev) => ({ ...prev, paymentAccountDeposited: e.target.value }))}
                  placeholder="e.g. Admin Bangkok Bank: 097-3-274005 or Admin PayPal email"
                  className="bg-slate-950 border-slate-700 text-white font-mono"
                />
              </div>

              {/* Buyer Receiving Method & Account */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                  Buyer's Method to Receive Payment (Refunds &amp; Returns):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Buyer Receive Method
                    </label>
                    <select
                      value={paymentEditForm.buyerReceiveMethod}
                      onChange={(e) => setPaymentEditForm((prev) => ({ ...prev, buyerReceiveMethod: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium cursor-pointer"
                    >
                      <option value="PAYPAL">PayPal</option>
                      <option value="BANK_TRANSFER">Bank Account / Transfer</option>
                      <option value="VISA_CARD">Visa / Card</option>
                      <option value="GCASH">GCash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Buyer Receive Account Details
                    </label>
                    <Input
                      type="text"
                      value={paymentEditForm.buyerReceiveAccountDetails}
                      onChange={(e) => setPaymentEditForm((prev) => ({ ...prev, buyerReceiveAccountDetails: e.target.value }))}
                      placeholder="e.g. buyer@paypal.com or Bangkok Bank 097-xxx"
                      className="bg-slate-900 border-slate-700 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Seller Payout Method & Account */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold block">
                  Seller's Payout Method &amp; Destination:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Seller Payout Method
                    </label>
                    <select
                      value={paymentEditForm.payoutMethod}
                      onChange={(e) => setPaymentEditForm((prev) => ({ ...prev, payoutMethod: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium cursor-pointer"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="PayPal">PayPal</option>
                      <option value="Visa / Debit Card">Visa / Debit Card</option>
                      <option value="GCash">GCash</option>
                      <option value="E-Wallet">E-Wallet / PromptPay</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Seller Payout Account Details
                    </label>
                    <Input
                      type="text"
                      value={paymentEditForm.sellerPayoutAccountDetails}
                      onChange={(e) => setPaymentEditForm((prev) => ({ ...prev, sellerPayoutAccountDetails: e.target.value }))}
                      placeholder="e.g. Bangkok Bank 097-3-xxxx / seller@paypal.com"
                      className="bg-slate-900 border-slate-700 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Admin Internal Payment Notes */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Admin Payment Notes</label>
                <Input
                  type="text"
                  value={paymentEditForm.paymentNotes}
                  onChange={(e) => setPaymentEditForm((prev) => ({ ...prev, paymentNotes: e.target.value }))}
                  placeholder="Optional notes: e.g. Verified via Bangkok Bank mobile app at 14:32"
                  className="bg-slate-950 border-slate-700 text-white"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <div>
                {editingPaymentItem.paymentMethod && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const item = editingPaymentItem;
                      setEditingPaymentItem(null);
                      handleDeletePayment(item.trackingId, item.title);
                    }}
                    className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:text-white cursor-pointer gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Payment Details</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingPaymentItem(null)}
                  className="border-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEditPayment}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold cursor-pointer"
                >
                  Save &amp; Update Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}