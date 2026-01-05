
"use client";

import { useState } from "react";
import type { Inquiry } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Inbox, MailOpen, Trash2, Mail, Phone, User, Tag, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/lib/firebase/context";
import { doc, deleteDoc } from "firebase/firestore";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface InboxSectionProps {
  inquiries: Inquiry[];
  loading: boolean;
  onUpdateInquiry: (inquiryId: string, updatedData: Partial<Inquiry>) => Promise<void>;
}

export default function InboxSection({ inquiries, loading, onUpdateInquiry }: InboxSectionProps) {
  const { db } = useFirebase();
  const { toast } = useToast();

  const handleToggleRead = (inquiry: Inquiry) => {
    onUpdateInquiry(inquiry.id, { isRead: !inquiry.isRead });
  };

  const handleDeleteInquiry = async (inquiryId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "inquiries", inquiryId));
      toast({ title: "Inquiry Deleted", description: "The message has been permanently removed." });
      // The parent component will receive the update via onSnapshot
    } catch (e: any) {
      console.error("Error deleting inquiry:", e);
      toast({ variant: "destructive", title: "Error", description: `Could not delete inquiry: ${e.message}` });
    }
  };
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInquiries = inquiries.filter(i => i.createdAt.startsWith(todayStr));
  const pastInquiries = inquiries.filter(i => !i.createdAt.startsWith(todayStr));


  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Guest Inquiries Inbox</CardTitle>
          <CardDescription>Messages from potential customers interested in your gadgets.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : inquiries.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Inbox className="mx-auto h-16 w-16 mb-4" />
              <h3 className="text-2xl font-bold">Inbox is Empty</h3>
              <p>You have no new inquiries at the moment.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-4">
              {todayInquiries.length > 0 && <div><h3 className="mb-4 text-lg font-semibold">Today's Inquiries</h3>
              {todayInquiries.map((inquiry) => (
                <InquiryItem key={inquiry.id} inquiry={inquiry} onToggleRead={handleToggleRead} onDelete={handleDeleteInquiry}/>
              ))}</div>}

              {pastInquiries.length > 0 && <div><h3 className="mb-4 text-lg font-semibold mt-8">Past Inquiries</h3>
              {pastInquiries.map((inquiry) => (
                <InquiryItem key={inquiry.id} inquiry={inquiry} onToggleRead={handleToggleRead} onDelete={handleDeleteInquiry}/>
              ))}</div>}

            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


interface InquiryItemProps {
    inquiry: Inquiry;
    onToggleRead: (inquiry: Inquiry) => void;
    onDelete: (inquiryId: string) => void;
}

function InquiryItem({ inquiry, onToggleRead, onDelete }: InquiryItemProps) {
    const inquiryDate = parseISO(inquiry.createdAt);
    return (
         <AccordionItem value={inquiry.id} className={cn("border rounded-lg", !inquiry.isRead ? "bg-primary/10 border-primary/20" : "bg-card")}>
            <AccordionTrigger className="p-4 hover:no-underline" onClick={() => inquiry.isRead ? null : onToggleRead(inquiry)}>
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-4 text-left">
                         {!inquiry.isRead && <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse"></div>}
                        <div>
                             <p className={cn("font-bold", !inquiry.isRead && "text-primary")}>Guest #{inquiry.dailyInquiryId}: {inquiry.guestName}</p>
                             <p className="text-sm text-muted-foreground truncate max-w-xs md:max-w-md">{inquiry.productName}</p>
                        </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm text-muted-foreground">{format(inquiryDate, "MMM dd, yyyy")}</p>
                       <p className="text-xs text-muted-foreground">{format(inquiryDate, "h:mm a")}</p>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0">
                <div className="border-t pt-4 space-y-4">
                    <p className="text-md font-medium bg-muted p-3 rounded-lg"><strong className="text-muted-foreground">Message:</strong> {inquiry.message}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                            <h4 className="font-semibold text-primary">Guest Details</h4>
                            <p className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground"/><strong>Name:</strong> {inquiry.guestName}</p>
                            <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground"/><strong>Contact:</strong> {inquiry.contactNumber}</p>
                            <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground"/><strong>Email:</strong> {inquiry.email || 'N/A'}</p>
                             <p className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-muted-foreground"/><strong>Socials:</strong> {inquiry.socialMedia || 'N/A'}</p>
                        </div>
                         <div className="space-y-2">
                             <h4 className="font-semibold text-primary">Product Details</h4>
                            <p className="flex items-center gap-2"><Tag className="w-4 h-4 text-muted-foreground"/><strong>Product:</strong> {inquiry.productName}</p>
                            <p className="flex items-center gap-2"><Tag className="w-4 h-4 text-muted-foreground"/><strong>P/N:</strong> <span className="font-mono">{inquiry.productId}</span></p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => onToggleRead(inquiry)}>
                           {inquiry.isRead ? <Mail className="mr-2"/> : <MailOpen className="mr-2"/>}
                           {inquiry.isRead ? 'Mark as Unread' : 'Mark as Read'}
                        </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                    <Trash2 className="mr-2"/> Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete this inquiry. This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(inquiry.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}
