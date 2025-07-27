"use client";

import { useRef } from "react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import type { Sale } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { X, Save } from "lucide-react";

interface CustomerReceiptProps {
  saleData: Sale | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CustomerReceipt({ saleData, isOpen, onClose }: CustomerReceiptProps) {
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleSaveAsImage = () => {
    if (!receiptRef.current) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Receipt content not found.",
      });
      return;
    }

    html2canvas(receiptRef.current, { scale: 2, useCORS: true })
      .then((canvas) => {
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
      <DialogContent className="max-w-sm w-full p-0 flex flex-col">
        <div ref={receiptRef} className="bg-white p-6 overflow-y-auto max-h-[70vh]">
          <DialogHeader className="text-center mb-4">
            <DialogTitle className="text-xl font-extrabold text-primary">Clef's Techy Gadget Shop.</DialogTitle>
            <p className="text-xs text-muted-foreground">Fb@Technohomeservice</p>
            <p className="text-xs text-muted-foreground mt-1">Thank you for your purchase, See you soon!</p>
            <h3 className="text-lg font-bold text-foreground pt-3">Customer Sales Receipt</h3>
          </DialogHeader>

          <div className="space-y-1 text-sm text-foreground mb-4 border-t border-b py-3">
            <p className="flex justify-between items-center"><span className="font-semibold">Receipt ID:</span> <span className="text-right">{saleData.id}</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Date:</span> <span className="text-right">{saleData.dateStart}</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Customer Name:</span> <span className="text-right">{saleData.customerName}</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Passport ID:</span> <span className="text-right">{saleData.passportID || 'N/A'}</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Gadget:</span> <span className="text-right">{saleData.gadget} ({saleData.pieces} pcs)</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Sell Price:</span> <span className="text-right">฿{saleData.sellPrice?.toFixed(2)}</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Down Payment:</span> <span className="text-right">฿{saleData.downPayment?.toFixed(2)}</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Installments:</span> <span className="text-right">{saleData.numberOfInstallments} months</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Monthly Payment:</span> <span className="text-right">฿{saleData.monthlyPayment?.toFixed(2)}</span></p>
            <p className="flex justify-between items-center text-base"><span className="font-bold">Total Due (after DP):</span> <span className="text-right font-bold">฿{saleData.totalAmountDue?.toFixed(2)}</span></p>
            <p className="flex justify-between items-center"><span className="font-semibold">Payment Type:</span> <span className="text-right">{saleData.paymentType || 'N/A'}</span></p>
          </div>

          <div>
            <h4 className="text-base font-bold text-foreground mb-2">Payment Schedule:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {saleData.paymentInstallments?.map((inst, index) => (
                <div key={index} className={`p-2 rounded-md border ${inst.isPaid ? 'bg-green-100 border-green-200 text-green-800' : 'bg-yellow-100 border-yellow-200 text-yellow-800'}`}>
                  <p className="font-semibold">Month {inst.month}:</p>
                  <p className="text-sm font-bold text-foreground">฿{inst.paidAmount?.toFixed(2)} / ฿{inst.dueAmount?.toFixed(2)}</p>
                  {inst.isPaid && inst.lastPaymentDate && (
                    <p className="text-xs text-muted-foreground mt-1">Paid: {inst.lastPaymentDate}</p>
                  )}
                  <p className={`font-medium mt-1`}>Status: {inst.isPaid ? 'Paid' : 'Pending'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="bg-secondary p-4 flex justify-end space-x-2 border-t mt-auto">
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
