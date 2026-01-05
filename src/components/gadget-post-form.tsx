
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { GadgetPost } from "@/types";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";

const postSchema = z.object({
  productNumber: z.string().min(1, "Product Number is required"),
  productName: z.string().min(1, "Product name is required"),
  adminName: z.string().min(1, "Your name is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  socialMedia: z.string().min(1, "Social media or email is required"),
  imageUrl: z.string().url("Please enter a valid URL for the image."),
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
      adminName: initialData?.adminName || "Saowakon Noycumlee",
      contactNumber: initialData?.contactNumber || "",
      socialMedia: initialData?.socialMedia || "",
      imageUrl: initialData?.imageUrl || "",
    },
  });

  const imageUrl = form.watch("imageUrl");

  const handleSubmit = async (values: PostFormValues) => {
    if (!db) {
        toast({ variant: "destructive", title: "Firebase not ready", description: "Please wait a moment and try again." });
        return;
    }
    
    setIsSubmitting(true);
    
    try {
      const postData = {
          productNumber: values.productNumber,
          productName: values.productName,
          adminName: values.adminName,
          contactNumber: values.contactNumber,
          socialMedia: values.socialMedia,
          imageUrl: values.imageUrl,
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
          throw new Error("Duplicate product number");
        }

        await addDoc(collection(db, "gadgetPosts"), {
          ...postData,
          isSold: false,
          createdAt: new Date().toISOString(),
        });
        toast({ title: "Success", description: "New gadget post created!" });
      }

      onSaveSuccess();

    } catch (error: any) {
      console.error("Error saving post:", error);
      if (error.message !== "Duplicate product number") {
        toast({ variant: "destructive", title: "Error", description: `Error saving post: ${error.message}` });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{initialData ? "Edit Gadget Post" : "Create New Gadget Post"}</CardTitle>
        <CardDescription>Fill in the details for the gadget you want to list.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <FormField name="productNumber" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Product Number</FormLabel><FormControl><Input {...field} placeholder="e.g., IPHONE-001" disabled={!!initialData} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="productName" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} placeholder="e.g., iPhone 15 Pro" /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="adminName" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Your Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="contactNumber" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} placeholder="+66 12 345 6789" /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="socialMedia" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Social Media / Email</FormLabel><FormControl><Input {...field} placeholder="Facebook Page or test@gmail.com" /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>
            
             <FormField name="imageUrl" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Image URL</FormLabel><FormControl><Input {...field} placeholder="https://postimg.cc/your-image-link.jpg" /></FormControl><FormMessage /></FormItem>
            )}/>
              
              {imageUrl && (
                <div className="mt-4">
                    <FormLabel>Image Preview</FormLabel>
                    <div className="mt-2 relative w-full h-48">
                      <Image 
                        src={imageUrl || "https://picsum.photos/seed/fallback/400/300"} 
                        alt="Preview" 
                        layout="fill" 
                        objectFit="cover" 
                        className="rounded-md bg-muted" 
                        onError={(e) => { e.currentTarget.src = "https://picsum.photos/seed/fallback-error/400/300"; }}
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
