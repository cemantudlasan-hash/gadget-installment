
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
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { Loader2, Upload } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";

const postSchema = z.object({
  productNumber: z.string().min(1, "Product Number is required"),
  productName: z.string().min(1, "Product name is required"),
  adminName: z.string().min(1, "Your name is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  socialMedia: z.string().min(1, "Social media or email is required"),
  imageFiles: z.custom<FileList>().optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

interface GadgetPostFormProps {
  onSaveSuccess: () => void;
  initialData?: GadgetPost | null;
  onCancel: () => void;
}

export default function GadgetPostForm({ onSaveSuccess, initialData, onCancel }: GadgetPostFormProps) {
  const { app, db } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>(initialData?.imageUrls || []);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      productNumber: initialData?.productNumber || "",
      productName: initialData?.productName || "",
      adminName: initialData?.adminName || "Saowakon Noycumlee",
      contactNumber: initialData?.contactNumber || "",
      socialMedia: initialData?.socialMedia || "",
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newPreviews = Array.from(files).map(file => URL.createObjectURL(file));
      setImagePreviews(newPreviews);
      form.setValue("imageFiles", files);
    } else {
      setImagePreviews(initialData?.imageUrls || []);
      form.setValue("imageFiles", undefined);
    }
  };

  const handleSubmit = async (values: PostFormValues) => {
    if (!app || !db) {
        toast({ variant: "destructive", title: "Firebase not initialized." });
        return;
    }
    
    setIsSubmitting(true);

    try {
      let uploadedImageUrls: string[] = initialData?.imageUrls || [];

      // 1. Handle Image Uploads
      if (values.imageFiles && values.imageFiles.length > 0) {
        const storage = getStorage(app);
        const uploadPromises = Array.from(values.imageFiles).map(file => {
          const imageRef = storageRef(storage, `gadget_posts/${values.productNumber}/${Date.now()}_${file.name}`);
          return uploadBytes(imageRef, file).then(snapshot => getDownloadURL(snapshot.ref));
        });
        uploadedImageUrls = await Promise.all(uploadPromises);
      }
      
      if (!initialData && uploadedImageUrls.length === 0) {
        form.setError("imageFiles", { type: "manual", message: "At least one image is required for a new post." });
        return; // Early exit
      }

      // 2. Prepare Data for Firestore
      const postData = {
          productNumber: values.productNumber,
          productName: values.productName,
          adminName: values.adminName,
          contactNumber: values.contactNumber,
          socialMedia: values.socialMedia,
          imageUrls: uploadedImageUrls,
      };

      // 3. Save to Firestore
      if (initialData) {
        // Update existing document
        const postRef = doc(db, "gadgetPosts", initialData.id);
        await updateDoc(postRef, postData);
        toast({ title: "Success", description: "Post updated successfully!" });
      } else {
        // Create new document
        const postsRef = collection(db, "gadgetPosts");
        const q = query(postsRef, where("productNumber", "==", postData.productNumber));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          toast({ variant: "destructive", title: "Duplicate Product Number", description: `A post with the number "${postData.productNumber}" already exists.` });
          return;
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
      toast({ variant: "destructive", title: "Error", description: `Error saving post: ${error.message}` });
    } finally {
      // 4. THIS IS THE GUARANTEE: Reset submitting state no matter what.
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
             
              <FormField
                control={form.control}
                name="imageFiles"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Images</FormLabel>
                    <FormControl>
                      <div className="flex items-center justify-center w-full">
                        <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                            <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-muted-foreground">You can select multiple images</p>
                          </div>
                          <Input id="dropzone-file" type="file" className="hidden" multiple onChange={handleFileChange} accept="image/png, image/jpeg, image/gif"/>
                        </label>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {imagePreviews.map((src, index) => (
                    <div key={index} className="relative">
                      <Image src={src} alt={`Preview ${index}`} width={200} height={150} className="rounded-md object-cover w-full h-24" />
                    </div>
                  ))}
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
