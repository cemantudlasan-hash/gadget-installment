"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { GadgetPost } from "@/types";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, updateDoc, getDocs, query, where } from "firebase/firestore";
import { Loader2, Sparkles, Upload, Trash2, Image as ImageIcon, Calculator, Globe } from "lucide-react";
import { generateThumbnail } from "@/ai/flows/generate-thumbnail";
import { translateProductDetails } from "@/ai/flows/translate-product-details";
import Image from "next/image";
import { Separator } from "./ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";

const postSchema = z.object({
  productNumber: z.string().min(1, "Product Number is required"),
  productName: z.string().min(1, "Product name is required"),
  titleTh: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  isSold: z.boolean().default(false),
  specsInput: z.string().optional(),
  description: z.string().optional(),
  cashPrice: z.coerce.number().min(0, "Price must be a positive number"),
  downPayment: z.coerce.number().min(0).optional(),
  installmentMonths: z.coerce.number().int().min(1, "Installment months must be at least 1.").optional(),
  monthlyInstallment: z.coerce.number().min(0).optional(),
  adminName: z.string().min(1, "Your name is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  socialMedia: z.string().min(1, "Social media or email is required"),
  externalLink: z.string().url("Please enter a valid URL for the external link.").optional().or(z.literal("")),
  imageUrl: z.string().optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

interface GadgetPostFormProps {
  onSaveSuccess: () => void;
  initialData?: GadgetPost | null;
  onCancel: () => void;
}

export default function GadgetPostForm({ onSaveSuccess, initialData, onCancel }: GadgetPostFormProps) {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>(initialData?.imageUrl || "");

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      productNumber: initialData?.productNumber || initialData?.partNumber || "",
      productName: initialData?.productName || initialData?.title || "",
      titleTh: initialData?.titleTh || "",
      category: initialData?.category || "Notebook",
      isSold: initialData?.isSold ?? (initialData?.stockStatus === "Out of Stock"),
      specsInput: initialData?.specs ? initialData.specs.join(", ") : "",
      description: initialData?.description || "",
      cashPrice: initialData?.cashPrice || 0,
      downPayment: initialData?.downPayment || 0,
      installmentMonths: initialData?.installmentMonths || 6,
      monthlyInstallment: initialData?.monthlyInstallment || initialData?.installmentMonthly || 0,
      adminName: initialData?.adminName || "Ceman Dejamo Tudlasan",
      contactNumber: initialData?.contactNumber || "0973274005",
      socialMedia: initialData?.socialMedia || "https://www.facebook.com/technohomeservice/",
      externalLink: initialData?.externalLink || "",
      imageUrl: initialData?.imageUrl || "",
    },
  });

  const { cashPrice, downPayment, installmentMonths } = form.watch();

  // Helper calculation
  const handleAutoCalculateMonthly = () => {
    const cPrice = form.getValues("cashPrice") || 0;
    const dPayment = form.getValues("downPayment") || 0;
    const months = form.getValues("installmentMonths") || 1;
    if (cPrice > 0 && months > 0) {
      const remainingBalance = cPrice - dPayment;
      const monthly = remainingBalance / months;
      form.setValue("monthlyInstallment", parseFloat(monthly.toFixed(2)));
      toast({ title: "Calculated", description: `Monthly rate updated to ฿${monthly.toFixed(2)}` });
    }
  };

  // Auto-calculate on initial values if monthly is 0
  useEffect(() => {
    const currentMonthly = form.getValues("monthlyInstallment");
    if ((!currentMonthly || currentMonthly === 0) && cashPrice > 0 && installmentMonths && installmentMonths > 0) {
      const remainingBalance = cashPrice - (downPayment || 0);
      const monthly = remainingBalance / installmentMonths;
      if (isFinite(monthly) && monthly >= 0) {
        form.setValue("monthlyInstallment", parseFloat(monthly.toFixed(2)));
      }
    }
  }, [cashPrice, downPayment, installmentMonths, form]);

  // AI Thumbnail Generator with pure background removal / black background
  const handleGenerateAiImage = async () => {
    const pName = form.getValues("productName");
    const pCategory = form.getValues("category");
    const pDesc = form.getValues("description");

    if (!pName || pName.trim() === "") {
      toast({
        variant: "destructive",
        title: "Product Name Required",
        description: "Please enter the product name before generating an image.",
      });
      return;
    }

    setIsGeneratingAi(true);
    toast({
      title: "Generating AI Product Photo...",
      description: "Generating an accurate, isolated product image with no background.",
    });

    try {
      const result = await generateThumbnail({
        productName: pName,
        category: pCategory,
        description: pDesc,
      });

      if (result.imageUrl) {
        setCurrentImage(result.imageUrl);
        form.setValue("imageUrl", result.imageUrl);
        toast({
          title: "Image Generated!",
          description: "Clean isolated product photo created successfully.",
        });
      }
    } catch (err: any) {
      console.error("AI Generation error:", err);
      toast({
        variant: "destructive",
        title: "AI Generation Notice",
        description: "Could not generate an image right now. You can upload or paste an image URL.",
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // AI Translation for Thai title
  const handleAutoTranslateTitle = async () => {
    const pName = form.getValues("productName");
    const pDesc = form.getValues("description") || "";
    if (!pName) {
      toast({ variant: "destructive", title: "Missing Name", description: "Enter product name first." });
      return;
    }
    setIsTranslating(true);
    try {
      const res = await translateProductDetails({ productName: pName, description: pDesc });
      if (res.translatedName) {
        form.setValue("titleTh", res.translatedName);
        toast({ title: "Translated", description: "Thai product name generated." });
      }
    } catch {
      toast({ variant: "destructive", title: "Translation Error", description: "Could not auto-translate." });
    } finally {
      setIsTranslating(false);
    }
  };

  // File Upload to Base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCurrentImage(base64);
        form.setValue("imageUrl", base64);
        toast({ title: "Image Uploaded", description: "Custom photo attached to post." });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (values: PostFormValues) => {
    if (!db) {
      toast({ variant: "destructive", title: "Firebase not ready", description: "Please wait a moment and try again." });
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse specs from comma-separated string
      const parsedSpecs = values.specsInput
        ? values.specsInput
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];

      const postData: Partial<GadgetPost> = {
        productNumber: values.productNumber,
        partNumber: values.productNumber,
        productName: values.productName,
        title: values.productName,
        titleTh: values.titleTh || "",
        category: values.category,
        description: values.description || "",
        specs: parsedSpecs,
        isSold: values.isSold,
        stockStatus: values.isSold ? "Out of Stock" : "In Stock",
        cashPrice: values.cashPrice,
        downPayment: values.downPayment || 0,
        installmentMonths: values.installmentMonths || 1,
        monthlyInstallment: values.monthlyInstallment || 0,
        installmentMonthly: values.monthlyInstallment || 0,
        adminName: values.adminName,
        contactNumber: values.contactNumber,
        socialMedia: values.socialMedia,
        externalLink: values.externalLink || "",
        imageUrl: currentImage || values.imageUrl || "",
      };

      if (initialData) {
        const postRef = doc(db, "gadgetPosts", initialData.id);
        await updateDoc(postRef, postData);
        toast({ title: "Success", description: "Post updated successfully!" });
      } else {
        const postsRef = collection(db, "gadgetPosts");
        const q = query(postsRef, where("productNumber", "==", values.productNumber));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          toast({
            variant: "destructive",
            title: "Duplicate Product Number",
            description: `A post with number "${values.productNumber}" already exists.`,
          });
          setIsSubmitting(false);
          return;
        }

        await addDoc(collection(db, "gadgetPosts"), {
          ...postData,
          createdAt: new Date().toISOString(),
        });
        toast({ title: "Success", description: "New gadget listing created!" });
      }

      onSaveSuccess();
    } catch (error: any) {
      console.error("Error saving post:", error);
      toast({ variant: "destructive", title: "Error", description: `Error saving post: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto bg-slate-900 border-slate-700 text-white shadow-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-cyan-400">
          {initialData ? "Edit Gadget Post" : "Create New Gadget Post"}
        </CardTitle>
        <CardDescription className="text-slate-400">
          Configure complete product details, installment plans, and isolated product photography.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Stock Status & Basic Identification */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
              <div>
                <FormLabel className="text-sm font-semibold text-slate-200">Inventory Status</FormLabel>
                <FormDescription className="text-xs text-slate-400">
                  Controls whether guests see &quot;In Stock (Apply Now)&quot; or &quot;Out of Stock (Join Waitlist)&quot;.
                </FormDescription>
              </div>
              <FormField
                name="isSold"
                control={form.control}
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <span className={field.value ? "text-rose-400 font-bold text-xs" : "text-emerald-400 font-bold text-xs"}>
                      {field.value ? "Out of Stock" : "In Stock"}
                    </span>
                    <Switch
                      checked={!field.value}
                      onCheckedChange={(checked) => field.onChange(!checked)}
                    />
                  </div>
                )}
              />
            </div>

            <h4 className="text-base font-semibold text-cyan-300">Product Identification</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                name="productNumber"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Number (P/N) *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Macbook pro 2019 - 0001" className="bg-slate-800 border-slate-700" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="category"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-800 border-slate-700">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="Notebook">Notebook</SelectItem>
                        <SelectItem value="Tablet/iPad">Tablet/iPad</SelectItem>
                        <SelectItem value="Mobile Phone">Mobile Phone</SelectItem>
                        <SelectItem value="Accessories">Accessories</SelectItem>
                        <SelectItem value="Others">Others</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                name="productName"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name (English) *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Macbook pro 2019 16 inch 32gb ram 512gb ssd." className="bg-slate-800 border-slate-700" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="titleTh"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel>Thai Name (Optional)</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAutoTranslateTitle}
                        disabled={isTranslating}
                        className="h-6 text-xs text-cyan-400 hover:text-cyan-300 p-0"
                      >
                        {isTranslating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                        AI Translate
                      </Button>
                    </div>
                    <FormControl>
                      <Input {...field} placeholder="e.g., แมคบุ๊กโปร 2019 ขนาด 16 นิ้ว..." className="bg-slate-800 border-slate-700" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Specs Pills Input */}
            <FormField
              name="specsInput"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Specifications Tags (Comma Separated)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 32GB RAM, 512GB SSD, 16-inch, M1" className="bg-slate-800 border-slate-700 font-mono text-xs" />
                  </FormControl>
                  <FormDescription className="text-xs text-slate-400">
                    Displayed as high-tech monospace spec tags on the guest storefront card.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              name="description"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Product Description & Condition</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={4}
                      placeholder="e.g., Macbook pro in excellent condition. 16 inch Touchbar 512gb ssd 32gb ram. Updated latest OS with charger..."
                      className="bg-slate-800 border-slate-700"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Image Upload & AI Generator */}
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700 space-y-4">
              <div className="flex justify-between items-center">
                <FormLabel className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-cyan-400" /> Product Photo (No Background)
                </FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAiImage}
                  disabled={isGeneratingAi}
                  className="bg-cyan-500/10 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 text-xs"
                >
                  {isGeneratingAi ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI Generate (No Background)
                    </>
                  )}
                </Button>
              </div>

              {currentImage ? (
                <div className="relative w-full h-44 rounded-xl bg-black border border-slate-700 flex items-center justify-center overflow-hidden">
                  <img src={currentImage} alt="Preview" className="max-h-36 max-w-[85%] object-contain" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setCurrentImage("");
                      form.setValue("imageUrl", "");
                    }}
                    className="absolute top-2 right-2 h-7 px-2 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="border border-dashed border-slate-700 rounded-xl p-6 text-center bg-slate-900/50">
                  <ImageIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 mb-2">No photo selected. Click AI Generate or upload a photo.</p>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-600 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" /> Choose File
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              )}

              <FormField
                name="imageUrl"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-400">Direct Image URL / Path</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={currentImage || field.value || ""}
                        onChange={(e) => {
                          field.onChange(e);
                          setCurrentImage(e.target.value);
                        }}
                        placeholder="e.g. /images/macbook-pro-16.jpg or https://..."
                        className="bg-slate-800 border-slate-700 text-xs font-mono"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator className="bg-slate-700" />

            {/* Pricing & Installment Section */}
            <h4 className="text-base font-semibold text-cyan-300">Pricing & Installment Terms</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                name="cashPrice"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cash Price (฿) *</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} placeholder="e.g., 23500" className="bg-slate-800 border-slate-700 font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="downPayment"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Down Payment (฿)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} placeholder="e.g., 3500" className="bg-slate-800 border-slate-700 font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                name="installmentMonths"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Installment Months (Plan Duration)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} placeholder="e.g., 6 or 12" className="bg-slate-800 border-slate-700 font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="monthlyInstallment"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel>Monthly Installment (฿) *</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAutoCalculateMonthly}
                        className="h-6 text-xs text-cyan-400 hover:text-cyan-300 p-0"
                      >
                        <Calculator className="w-3 h-3 mr-1" /> Auto-Calc
                      </Button>
                    </div>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} className="bg-slate-800 border-slate-700 font-mono text-cyan-300 font-bold" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator className="bg-slate-700" />

            {/* Seller Contact & Verification */}
            <h4 className="text-base font-semibold text-cyan-300">Seller & Contact Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                name="adminName"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seller Name *</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-slate-800 border-slate-700" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="contactNumber"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Number *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. 0973274005" className="bg-slate-800 border-slate-700" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                name="socialMedia"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Social Media / Line / Facebook *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://www.facebook.com/..." className="bg-slate-800 border-slate-700" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="externalLink"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>View Photos External Drive Link (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://drive.google.com/..." className="bg-slate-800 border-slate-700" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:brightness-110 shadow-lg shadow-cyan-500/20"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "Saving..." : initialData ? "Update Post" : "Create Post"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}