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
        scale: 3, // Increase scale for better resolution
        useCORS: true,
        scrollY: -window.scrollY,
        windowWidth: receiptElement.scrollWidth,
        windowHeight: receiptElement.scrollHeight
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
      <DialogContent className="max-w-md w-full p-0 flex flex-col max-h-[95vh] overflow-y-auto">
        <div ref={receiptRef} className="bg-white p-6 font-mono">
          <DialogHeader className="text-center mb-4 border-b pb-4">
            <DialogTitle className="text-2xl font-extrabold text-primary">Clef's Techy Gadget Shop</DialogTitle>
            <p className="text-sm text-muted-foreground">Fb@Technohomeservice</p>
            <p className="text-xs text-muted-foreground mt-1">Thank you for your purchase, See you soon!</p>
          </DialogHeader>

          <div className="text-center mb-4">
            <h3 className="text-lg font-bold text-foreground">Customer Sales Receipt</h3>
          </div>

          <div className="space-y-2 text-sm text-foreground mb-4">
            <p className="flex justify-between items-center"><span className="font-semibold">Receipt ID:</span> <span>{saleData.id}</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Date:</span> <span>{saleData.dateStart}</span></p>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2 text-sm text-foreground mb-4">
             <p className="flex justify-between items-center"><span className="font-semibold">Customer:</span> <span className="font-medium">{saleData.customerName}</span></p>
             <p className="flex justify-between items-center"><span className="font-semibold">Passport ID:</span> <span>{saleData.passportID || 'N/A'}</span></p>
          </div>

           <Separator className="my-4" />

          <div className="space-y-2 text-sm text-foreground mb-4">
            <p className="flex justify-between items-center"><span className="font-semibold">Gadget:</span> <span>{saleData.gadget} ({saleData.pieces} pcs)</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Sell Price:</span> <span>฿{saleData.sellPrice?.toFixed(2)}</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Down Payment:</span> <span>฿{saleData.downPayment?.toFixed(2)}</span></p>
             <p className="flex justify-between items-center font-bold text-base"><span className="font-bold">Total Due (after DP):</span> <span>฿{saleData.totalAmountDue?.toFixed(2)}</span></p>
          </div>
          
           <Separator className="my-4" />

          <div className="space-y-2 text-sm text-foreground mb-4">
            <p className="flex justify-between items-center"><span className="font-semibold">Installments:</span> <span>{saleData.numberOfInstallments} months</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Monthly Payment:</span> <span>฿{saleData.monthlyPayment?.toFixed(2)}</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Payment Type:</span> <span>{saleData.paymentType || 'N/A'}</span></p>
          </div>

          <div>
            <h4 className="text-base font-bold text-foreground mb-2 text-center border-t pt-4">Payment Schedule</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {saleData.paymentInstallments?.map((inst, index) => (
                <div key={index} className={`p-2 rounded-md border text-center ${inst.isPaid ? 'bg-green-100 border-green-200 text-green-800' : 'bg-yellow-100 border-yellow-200 text-yellow-800'}`}>
                  <p className="font-semibold">Month {inst.month}</p>
                  <p className="text-sm font-bold text-foreground">฿{inst.paidAmount?.toFixed(2)}</p>
                  <p className={`font-medium mt-1`}>{inst.isPaid ? 'Paid' : 'Pending'}</p>
                   {inst.isPaid && inst.lastPaymentDate && (
                    <p className="text-xs text-muted-foreground mt-1">{inst.lastPaymentDate}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="bg-secondary p-4 flex justify-end space-x-2 border-t mt-auto sticky bottom-0">
          <Button variant="outline" onClick={onClose}>
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
