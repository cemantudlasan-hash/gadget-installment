
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { GadgetPost } from "@/types";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, updateDoc, getDocs, query, where } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { generateThumbnail } from "@/ai/flows/generate-thumbnail";
import Image from "next/image";
import { Separator } from "./ui/separator";

const postSchema = z.object({
  productNumber: z.string().min(1, "Product Number is required"),
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be a positive number"),
  downPayment: z.coerce.number().min(0).optional(),
  installmentMonths: z.coerce.number().int().min(0).optional(),
  monthlyInstallment: z.coerce.number().min(0).optional(),
  adminName: z.string().min(1, "Your name is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  socialMedia: z.string().min(1, "Social media or email is required"),
  externalLink: z.string().url("Please enter a valid URL for the external link.").optional().or(z.literal('')),
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
  
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      productNumber: initialData?.productNumber || "",
      productName: initialData?.productName || "",
      description: initialData?.description || "",
      price: initialData?.price || 0,
      downPayment: initialData?.downPayment || 0,
      installmentMonths: initialData?.installmentMonths || 0,
      monthlyInstallment: initialData?.monthlyInstallment || 0,
      adminName: initialData?.adminName || "Saowakon Noycumlee",
      contactNumber: initialData?.contactNumber || "",
      socialMedia: initialData?.socialMedia || "",
      externalLink: initialData?.externalLink || "",
    },
  });

  const handleSubmit = async (values: PostFormValues) => {
    if (!db) {
        toast({ variant: "destructive", title: "Firebase not ready", description: "Please wait a moment and try again." });
        return;
    }
    
    setIsSubmitting(true);
    
    try {
      let imageUrl = initialData?.imageUrl || "";

      if (!initialData || !initialData.imageUrl) { 
        toast({ title: "Generating Thumbnail...", description: "Please wait while the AI creates an image for your product." });
        try {
          const thumbnailResult = await generateThumbnail({ productName: values.productName });
          imageUrl = thumbnailResult.imageUrl;
        } catch (aiError) {
            console.error("AI thumbnail generation failed:", aiError);
            toast({
                variant: "destructive",
                title: "AI Thumbnail Failed",
                description: "Could not generate an image. You can save the post without one.",
            });
            imageUrl = ""; // Ensure imageUrl is blank if generation fails
        }
      }

      const postData = {
          ...values,
          imageUrl,
      };

      if (initialData) {
        const postRef = doc(db, "gadgetPosts", initialData.id);
        await updateDoc(postRef, postData);
        toast({ title: "Success", description: "Post updated successfully!" });
      } else {
        const postsRef = collection(db, "gadgetPosts");
        const q = query(postsRef, where("productNumber", "==", postData.productNumber));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          toast({ variant: "destructive", title: "Duplicate Product Number", description: `A post with the number "${postData.productNumber}" already exists.` });
          setIsSubmitting(false); // Stop submission
          return; 
        }

        await addDoc(collection(db, "gadgetPosts"), {
          ...postData,
          isSold: false,
          createdAt: new Date().toISOString(),
        });
        toast({ title: "Success", description: "New gadget post created with AI thumbnail!" });
      }

      onSaveSuccess();

    } catch (error: any) {
      console.error("Error saving post:", error);
      if (error.message !== "Duplicate product number") {
        toast({ variant: "destructive", title: "Error", description: `Error saving post: ${error.message}` });
      }
    } finally {
      if (isSubmitting) { // Only set to false if it was true, to avoid race conditions
          setIsSubmitting(false);
      }
    }
  };
  
  const currentImageUrl = form.watch('imageUrl') || initialData?.imageUrl;

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{initialData ? "Edit Gadget Post" : "Create New Gadget Post"}</CardTitle>
        <CardDescription>Fill in the details for the gadget. A thumbnail will be auto-generated for new posts.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <h4 className="text-lg font-medium">Product Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <FormField name="productNumber" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Product Number</FormLabel><FormControl><Input {...field} placeholder="e.g., IPHONE-001" disabled={!!initialData} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="productName" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} placeholder="e.g., iPhone 15 Pro" /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>
            
            <FormField name="description" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Product Description</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="e.g., Brand new, 256GB, Deep Purple..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>

             <Separator className="my-8" />
             <h4 className="text-lg font-medium">Pricing Details</h4>
             
             <FormField name="price" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Total Price (฿)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} placeholder="e.g., 35000" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField name="downPayment" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Down Payment (฿)</FormLabel><FormControl><Input type="number" {...field} placeholder="e.g., 5000" /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField name="installmentMonths" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Installment Months</FormLabel><FormControl><Input type="number" {...field} placeholder="e.g., 6" /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField name="monthlyInstallment" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Monthly Installment (฿)</FormLabel><FormControl><Input type="number" {...field} placeholder="e.g., 5000" /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>


            <Separator className="my-8" />
            <h4 className="text-lg font-medium">Seller Contact</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField name="adminName" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Your Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="contactNumber" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} placeholder="+66 12 345 6789" /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="socialMedia" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Social Media / Email</FormLabel><FormControl><Input {...field} placeholder="Facebook Page or test@gmail.com" /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="externalLink" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>External Link (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g., https://example.com/product-details" /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>
            
             {currentImageUrl && (
                <div className="space-y-2">
                    <FormLabel>Generated Thumbnail</FormLabel>
                    <div className="mt-2 relative w-full h-48">
                      <Image 
                        src={currentImageUrl} 
                        alt="Generated Thumbnail" 
                        layout="fill" 
                        objectFit="cover" 
                        className="rounded-md bg-muted" 
                      />
                    </div>
                </div>
              )}


            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Saving...' : (initialData ? "Update Post" : "Create Post")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
