"use client";

import { useRef } from "react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import type { Sale } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { X, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface CustomerReceiptProps {
  saleData: Sale | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CustomerReceipt({ saleData, isOpen, onClose }: CustomerReceiptProps) {
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleSaveAsImage = () => {
    const receiptElement = receiptRef.current;
    if (!receiptElement) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Receipt content not found.",
      });
      return;
    }

    html2canvas(receiptElement, {
        scale: 2, // Increase scale for better resolution
        useCORS: true,
        scrollY: -window.scrollY,
        windowWidth: receiptElement.scrollWidth,
        windowHeight: receiptElement.scrollHeight,
      }).then((canvas) => {
        const image = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = image;
        a.download = `Receipt_${saleData?.customerName}_${saleData?.id}.png`;
        a.click();
        toast({
          title: "Success",
          description: "Receipt saved as an image.",
        });
      })
      .catch((err) => {
        console.error("Error generating image from receipt:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save receipt as image. Please try again.",
        });
      });
  };

  if (!saleData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full p-0 flex flex-col max-h-[90vh] overflow-y-auto">
        <div ref={receiptRef} className="bg-background p-6">
          <DialogHeader className="text-center mb-4 border-b pb-4">
            <DialogTitle className="text-xl font-bold">Clef's Techy Gadget Shop</DialogTitle>
            <p className="text-sm text-muted-foreground">Fb@Technohomeservice</p>
            <p className="text-xs text-muted-foreground mt-1">Thank you for your purchase, See you soon!</p>
          </DialogHeader>

          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-primary">Customer Sales Receipt</h3>
          </div>

          <div className="space-y-1 text-sm mb-4">
            <p className="flex justify-between"><span className="font-semibold text-muted-foreground">Receipt ID:</span> <span>{saleData.id}</span></p>
            <p className="flex justify-between"><span className="font-semibold text-muted-foreground">Date:</span> <span>{saleData.dateStart}</span></p>
          </div>

          <Separator className="my-4" />

          <div className="space-y-1 text-sm mb-4">
             <p className="flex justify-between"><span className="font-semibold text-muted-foreground">Customer:</span> <span className="font-medium">{saleData.customerName}</span></p>
             <p className="flex justify-between"><span className="font-semibold text-muted-foreground">Passport ID:</span> <span>{saleData.passportID || 'N/A'}</span></p>
          </div>

           <Separator className="my-4" />

          <div className="space-y-1 text-sm mb-4">
            <p className="flex justify-between"><span className="font-semibold text-muted-foreground">Gadget:</span> <span>{saleData.gadget} ({saleData.pieces} pcs)</span></p>
            <p className="flex justify-between"><span className="font-semibold text-muted-foreground">Sell Price:</span> <span>฿{saleData.sellPrice?.toFixed(2)}</span></p>
            <p className="flex justify-between"><span className="font-semibold text-muted-foreground">Down Payment:</span> <span>฿{saleData.downPayment?.toFixed(2)}</span></p>
             <p className="flex justify-between font-bold text-base text-primary"><span className="font-bold">Total Due (after DP):</span> <span>฿{saleData.totalAmountDue?.toFixed(2)}</span></p>
          </div>
          
           <Separator className="my-4" />

          <div className="space-y-1 text-sm mb-4">
            <p className="flex justify-between"><span className="font-semibold text-muted-foreground">Installments:</span> <span>{saleData.numberOfInstallments} months</span></p>
            <p className="flex justify-between"><span className="font-semibold text-muted-foreground">Monthly Payment:</span> <span>฿{saleData.monthlyPayment?.toFixed(2)}</span></p>
            <p className="flex justify-between"><span className="font-semibold text-muted-foreground">Payment Type:</span> <span>{saleData.paymentType || 'N/A'}</span></p>
          </div>

          <div>
            <h4 className="text-md font-semibold text-primary mb-2 text-center border-t pt-4">Payment Schedule</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {saleData.paymentInstallments?.map((inst, index) => (
                <div key={index} className={`p-2 rounded-md border text-center ${inst.isPaid ? 'bg-green-100 border-green-300 text-green-800' : 'bg-yellow-100 border-yellow-300 text-yellow-800'}`}>
                  <p className="font-semibold">Month {inst.month}</p>
                  <p className="font-bold text-sm">฿{inst.paidAmount?.toFixed(2)}</p>
                  <p className="font-medium mt-1">{inst.isPaid ? 'Paid' : 'Pending'}</p>
                   {inst.isPaid && inst.lastPaymentDate && (
                    <p className="text-xs text-muted-foreground mt-1">{inst.lastPaymentDate}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="bg-slate-50 p-4 flex justify-end space-x-2 border-t mt-auto sticky bottom-0">
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
          <Button onClick={handleSaveAsImage} className="bg-green-600 hover:bg-green-700">
            <Save className="mr-2 h-4 w-4" /> Save as Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
