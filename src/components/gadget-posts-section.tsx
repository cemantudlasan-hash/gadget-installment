"use client";

import { useState, useEffect } from "react";
import { useFirebase } from "@/lib/firebase/context";
import { collection, doc, updateDoc, deleteDoc } from "firebase/firestore";
import GadgetPostForm from "./gadget-post-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { GadgetPost } from "@/types";
import {
  PlusCircle,
  Edit,
  Trash2,
  PackageCheck,
  Package,
  ExternalLink,
  Tag,
  Wallet,
  Calendar,
  Repeat,
  CheckCircle2,
  XCircle,
  Filter,
  DollarSign,
  FileText,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Image from "next/image";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import {
  Currency,
  CURRENCIES,
  formatPrice,
  getSavedCurrency,
  saveCurrency,
} from "@/lib/currency";
import { deleteEscrowItem } from "@/lib/escrow-store";

interface GadgetPostsSectionProps {
  posts: GadgetPost[];
  loading: boolean;
  onDataChange: () => void;
  userRole: "admin" | "guest";
}

export default function GadgetPostsSection({
  posts,
  loading,
  onDataChange,
  userRole,
}: GadgetPostsSectionProps) {
  const { db } = useFirebase();
  const { toast } = useToast();

  const [editingPost, setEditingPost] = useState<GadgetPost | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<string[]>([]);
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "out_of_stock">("all");
  const [currency, setCurrency] = useState<Currency>("USD");

  // Sync currency with global switcher
  useEffect(() => {
    setCurrency(getSavedCurrency());

    const handleCurrencyChange = (e: any) => {
      if (e.detail) setCurrency(e.detail);
    };

    window.addEventListener("currency_changed", handleCurrencyChange);
    return () => {
      window.removeEventListener("currency_changed", handleCurrencyChange);
    };
  }, []);

  const handleCurrencySelect = (c: Currency) => {
    setCurrency(c);
    saveCurrency(c);
  };

  const toggleDescription = (postId: string) => {
    setExpandedDescriptions((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  };

  const handleSaveSuccess = () => {
    setShowForm(false);
    setEditingPost(null);
    onDataChange();
  };

  const handleDeletePost = async (postId: string) => {
    if (!db || userRole !== "admin") {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "You cannot delete posts.",
      });
      return;
    }
    const targetPost = posts.find((p) => p.id === postId);
    try {
      await deleteDoc(doc(db, "gadgetPosts", postId));

      if (targetPost) {
        const prodNum = targetPost.productNumber || targetPost.partNumber || targetPost.id;
        deleteEscrowItem(prodNum);
        deleteEscrowItem(`GI-${prodNum}`);

        // Purge from cached marketplace items
        try {
          const rawCache = localStorage.getItem("gi_cached_marketplace_items");
          if (rawCache) {
            const parsed = JSON.parse(rawCache);
            if (Array.isArray(parsed)) {
              const cleaned = parsed.filter(
                (i: any) =>
                  i.id !== postId &&
                  i.firestoreDocId !== postId &&
                  i.productNumber !== prodNum &&
                  i.title?.toLowerCase().trim() !== targetPost.productName?.toLowerCase().trim()
              );
              localStorage.setItem("gi_cached_marketplace_items", JSON.stringify(cleaned));
            }
          }
        } catch {}

        window.dispatchEvent(
          new CustomEvent("gadget_post_deleted", {
            detail: { trackingId: prodNum, title: targetPost.productName },
          })
        );
      }

      toast({ title: "Success", description: "Post deleted successfully from database and Escrow Market!" });
      onDataChange();
    } catch (e: any) {
      console.error("Error deleting post:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error deleting post: ${e.message}`,
      });
    }
  };

  // Direct toggle between In Stock and Out of Stock
  const handleSetStockStatus = async (post: GadgetPost, isSold: boolean) => {
    if (!db || userRole !== "admin") {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only Admin can update gadget stock status.",
      });
      return;
    }
    try {
      const postRef = doc(db, "gadgetPosts", post.id);
      await updateDoc(postRef, {
        isSold,
        stockStatus: isSold ? "Out of Stock" : "In Stock",
      });
      toast({
        title: isSold ? "Marked as Out of Stock" : "Marked as In Stock",
        description: `${post.productName} is now ${isSold ? "Out of Stock (Unavailable)" : "In Stock (Available for Installment)"}.`,
      });
      onDataChange();
    } catch (e: any) {
      console.error("Error updating stock status:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Could not update status: ${e.message}`,
      });
    }
  };

  const handleEditPost = (post: GadgetPost) => {
    setEditingPost(post);
    setShowForm(true);
  };

  const handleAddNewPost = () => {
    setEditingPost(null);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setEditingPost(null);
    setShowForm(false);
  };

  if (showForm) {
    return (
      <GadgetPostForm
        onSaveSuccess={handleSaveSuccess}
        initialData={editingPost}
        onCancel={handleCancelForm}
      />
    );
  }

  // Filter posts based on active stock filter tab
  const filteredPosts = posts.filter((post) => {
    if (stockFilter === "in_stock") return !post.isSold && post.stockStatus !== "Out of Stock";
    if (stockFilter === "out_of_stock") return post.isSold || post.stockStatus === "Out of Stock";
    return true;
  });

  const inStockCount = posts.filter(
    (p) => !p.isSold && p.stockStatus !== "Out of Stock"
  ).length;
  const outOfStockCount = posts.filter(
    (p) => p.isSold || p.stockStatus === "Out of Stock"
  ).length;

  return (
    <Card className="bg-slate-900/60 backdrop-blur-md border border-slate-700 shadow-2xl">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              <CardTitle className="text-xl font-bold text-white">
                Manage Gadget Posts &amp; Inventory
              </CardTitle>
            </div>
            <CardDescription className="text-slate-400 text-xs sm:text-sm mt-1">
              Create and manage listings. Update stock status between{" "}
              <span className="text-emerald-400 font-semibold">In Stock</span> and{" "}
              <span className="text-rose-400 font-semibold">Out of Stock</span>.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Multi-Currency Selector */}
            <div className="flex items-center bg-slate-950/80 rounded-lg p-1 border border-slate-700 text-xs font-mono">
              {(["USD", "PHP", "THB"] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleCurrencySelect(c)}
                  className={cn(
                    "px-2 py-1 rounded transition cursor-pointer font-bold",
                    currency === c
                      ? "bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {CURRENCIES[c].symbol} {c}
                </button>
              ))}
            </div>

            <Button
              onClick={handleAddNewPost}
              disabled={userRole !== "admin"}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 font-bold text-xs sm:text-sm shadow-md"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Post
            </Button>
          </div>
        </div>

        {/* Filter Tabs for Stock Status */}
        <div className="flex items-center gap-2 pt-4 border-t border-slate-800/80 mt-2 flex-wrap">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Stock Filter:
          </span>

          <button
            type="button"
            onClick={() => setStockFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border",
              stockFilter === "all"
                ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-300 font-bold"
                : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white"
            )}
          >
            All Listings ({posts.length})
          </button>

          <button
            type="button"
            onClick={() => setStockFilter("in_stock")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border flex items-center gap-1.5",
              stockFilter === "in_stock"
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold"
                : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            In Stock ({inStockCount})
          </button>

          <button
            type="button"
            onClick={() => setStockFilter("out_of_stock")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border flex items-center gap-1.5",
              stockFilter === "out_of_stock"
                ? "bg-rose-500/20 border-rose-500 text-rose-300 font-bold"
                : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            Out of Stock ({outOfStockCount})
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-96 w-full rounded-xl bg-slate-800/60" />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl">
            <Package className="mx-auto h-12 w-12 text-slate-600 mb-4" />
            <p className="text-slate-400 font-medium">
              {stockFilter === "all"
                ? "No gadget posts found."
                : stockFilter === "in_stock"
                ? "No items currently marked In Stock."
                : "No items currently marked Out of Stock."}
            </p>
            {stockFilter === "all" && (
              <Button
                onClick={handleAddNewPost}
                className="mt-4 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                disabled={userRole !== "admin"}
              >
                Create Your First Post
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 items-start">
            {filteredPosts.map((post) => {
              const isExpanded = expandedDescriptions.includes(post.id);
              const isOutOfStock = post.isSold || post.stockStatus === "Out of Stock";

              return (
                <Card
                  key={post.id}
                  className={cn(
                    "overflow-hidden relative flex flex-col bg-[#141C2E] border rounded-xl shadow-lg transition-all duration-200",
                    isOutOfStock
                      ? "border-rose-900/60 opacity-90"
                      : "border-slate-700 hover:border-cyan-500/50"
                  )}
                >
                  {/* Top Badges */}
                  <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5 flex-wrap justify-end">
                    {post.category && (
                      <Badge
                        variant="secondary"
                        className="bg-slate-900/80 text-cyan-300 border border-cyan-500/30 text-[10px]"
                      >
                        {post.category}
                      </Badge>
                    )}
                    <Badge
                      className={cn(
                        "text-[10px] font-bold tracking-wider uppercase border",
                        isOutOfStock
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/50"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                      )}
                    >
                      {isOutOfStock ? "Out of Stock" : "In Stock"}
                    </Badge>
                  </div>

                  {/* Product Image */}
                  <div className="relative w-full h-48 bg-slate-950/70 flex items-center justify-center overflow-hidden">
                    {post.imageUrl ? (
                      <Image
                        src={post.imageUrl}
                        alt={post.productName}
                        layout="fill"
                        objectFit="cover"
                        className={cn(
                          "transition duration-300",
                          isOutOfStock && "grayscale-[40%] contrast-90"
                        )}
                      />
                    ) : (
                      <Package className="h-16 w-16 text-slate-600" />
                    )}

                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="px-3 py-1 rounded-md bg-rose-950/90 border border-rose-500 text-rose-300 font-mono text-xs font-bold uppercase tracking-wider">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-grow flex flex-col">
                    <h3 className="font-bold text-lg text-white leading-tight">
                      {post.productName}
                    </h3>
                    <p className="text-xs text-slate-400 mb-2 font-mono">
                      P/N: {post.productNumber || "N/A"}
                    </p>

                    {/* Cash Price in Active Currency */}
                    <div className="font-bold text-cyan-400 text-lg my-1.5 flex items-center gap-1 font-mono">
                      <Tag className="mr-1.5 h-4 w-4 text-cyan-400" />
                      <span>Cash Price:</span>
                      <span className="text-white font-bold tabular-nums">
                        {formatPrice(post.cashPrice || 0, currency)}
                      </span>
                    </div>

                    {/* Box 1: Separated Condition View Container */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 my-2 flex items-center justify-between text-xs shadow-sm">
                      <span className="text-slate-400 font-semibold">Device Condition:</span>
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider border",
                          post.condition === "New" || post.condition === "Brand New"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/50"
                        )}
                      >
                        {post.condition === "New" || post.condition === "Brand New" ? "✨ New" : "📦 Used"}
                      </span>
                    </div>

                    {/* Box 2: Separated Specifications & Inclusions Container */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 my-1 text-xs space-y-1 shadow-sm flex-grow">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 block font-semibold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Item Specifications &amp; Inclusions:
                      </span>
                      <p
                        className={cn(
                          "text-slate-300 leading-relaxed whitespace-pre-line text-xs",
                          !isExpanded && "line-clamp-3"
                        )}
                      >
                        {post.description || "No specifications or description provided."}
                      </p>
                      {post.description && post.description.length > 100 && (
                        <button
                          type="button"
                          className="text-cyan-400 hover:text-cyan-300 text-[11px] font-medium cursor-pointer"
                          onClick={() => toggleDescription(post.id)}
                        >
                          {isExpanded ? "Read Less" : "Read More"}
                        </button>
                      )}
                    </div>

                    {/* Installment breakdown if available */}
                    {(post.downPayment || 0) > 0 && (
                      <div className="mt-3 space-y-1.5 text-xs border-t border-slate-800 pt-3 font-mono">
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Down Payment:</span>
                          <span className="font-semibold text-white">
                            {formatPrice(post.downPayment || 0, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Tenor:</span>
                          <span className="font-semibold text-cyan-300">
                            {post.installmentMonths || 0} Months
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Monthly Bill:</span>
                          <span className="font-bold text-emerald-400">
                            {formatPrice(post.monthlyInstallment || 0, currency)} / mo
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Seller & Shop details */}
                    <div className="text-[11px] text-slate-400 mt-3 border-t border-slate-800 pt-2.5 space-y-0.5">
                      {post.shopName && (
                        <p className="flex items-center gap-1 text-cyan-300">
                          <strong className="text-cyan-400">Shop / Company:</strong>{" "}
                          <span className="font-semibold text-white">{post.shopName}</span>
                        </p>
                      )}
                      <p>
                        <strong className="text-slate-300">Poster / Seller:</strong> {post.adminName}
                      </p>
                      <p>
                        <strong className="text-slate-300">Contact:</strong> {post.contactNumber}
                      </p>
                      <p className="truncate">
                        <strong className="text-slate-300">Socials:</strong> {post.socialMedia}
                      </p>
                    </div>

                    {/* ============================================================ */}
                    {/* STOCK STATUS TOGGLE BUTTONS (Admin Exclusive Control)        */}
                    {/* ============================================================ */}
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 font-semibold">
                        Stock Availability (Admin Control):
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetStockStatus(post, false)}
                          disabled={userRole !== "admin"}
                          className={cn(
                            "py-2 px-2.5 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer",
                            !isOutOfStock
                              ? "bg-emerald-500/25 border-emerald-500 text-emerald-300 shadow-sm ring-1 ring-emerald-500/50"
                              : "bg-slate-900 border-slate-700 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/50"
                          )}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>In Stock</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetStockStatus(post, true)}
                          disabled={userRole !== "admin"}
                          className={cn(
                            "py-2 px-2.5 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer",
                            isOutOfStock
                              ? "bg-rose-500/25 border-rose-500 text-rose-300 shadow-sm ring-1 ring-rose-500/50"
                              : "bg-slate-900 border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-500/50"
                          )}
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Out of Stock</span>
                        </button>
                      </div>
                    </div>

                    {/* External Link */}
                    {post.externalLink && (
                      <div className="mt-3">
                        <a
                          href={post.externalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full block"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                          >
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-cyan-400" /> View Photos Link
                          </Button>
                        </a>
                      </div>
                    )}

                    {/* Edit & Delete Controls */}
                    <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-800/80">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPost(post)}
                        disabled={userRole !== "admin"}
                        className="text-slate-300 hover:text-cyan-400 text-xs"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-400 hover:text-rose-300 text-xs"
                            disabled={userRole !== "admin"}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-[#141C2E] border border-slate-700 text-white">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this gadget listing?</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-400">
                              This will permanently remove "{post.productName}" from the database and marketplace.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-slate-800 text-white border-slate-700">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeletePost(post.id)}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                            >
                              Delete Listing
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
