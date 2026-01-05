
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { GadgetPost } from "@/types";

const postSchema = z.object({
  productNumber: z.string().min(1, "Product Number is required"),
  productName: z.string().min(1, "Product name is required"),
  adminName: z.string().min(1, "Your name is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  socialMedia: z.string().min(1, "Social media or email is required"),
  imageUrl: z.string().url("Please enter a valid image URL"),
});

type PostFormValues = z.infer<typeof postSchema>;

interface GadgetPostFormProps {
  onSave: (data: Omit<GadgetPost, "id" | "isSold" | "createdAt">, isEditing: boolean) => void;
  initialData?: GadgetPost | null;
  onCancel: () => void;
}

export default function GadgetPostForm({ onSave, initialData, onCancel }: GadgetPostFormProps) {
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: initialData || {
      productNumber: "",
      productName: "",
      adminName: "Saowakon Noycumlee",
      contactNumber: "",
      socialMedia: "",
      imageUrl: "",
    },
  });

  const handleSubmit = (values: PostFormValues) => {
    onSave(values, !!initialData);
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
                  <FormItem><FormLabel>Image URL</FormLabel><FormControl><Input {...field} placeholder="https://picsum.photos/seed/..." /></FormControl><FormMessage /></FormItem>
              )}/>
              <div className="text-xs text-muted-foreground">
                For placeholder images, you can use a service like picsum.photos. Example: `https://picsum.photos/seed/gadget1/600/400`
              </div>


            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="submit">{initialData ? "Update Post" : "Create Post"}</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
