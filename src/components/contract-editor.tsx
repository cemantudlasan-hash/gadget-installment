
"use client";

import { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Sale } from "@/types";
import { X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContractEditorProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ContractEditor({ sale, isOpen, onClose }: ContractEditorProps) {
  const { toast } = useToast();
  const contractRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    customerName: "",
    contactNumber: "",
    address: "",
    gadget: "",
    totalAmount: "",
    downPayment: "",
    remainingBalance: "",
    numberOfInstallments: "",
    monthlyPayment: "",
    downPaymentDate: ""
  });

  useEffect(() => {
    if (sale) {
      setFormData({
        customerName: sale.customerName || "",
        contactNumber: "",
        address: "",
        gadget: sale.gadget || "",
        totalAmount: sale.sellPrice?.toFixed(2) || "0.00",
        downPayment: sale.downPayment?.toFixed(2) || "0.00",
        remainingBalance: (sale.sellPrice - sale.downPayment).toFixed(2) || "0.00",
        numberOfInstallments: String(sale.numberOfInstallments) || "0",
        monthlyPayment: sale.monthlyPayment?.toFixed(2) || "0.00",
        downPaymentDate: sale.dateStart || new Date().toISOString().split("T")[0],
      });
    }
  }, [sale]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const exportToJpg = () => {
    if (contractRef.current) {
      html2canvas(contractRef.current, { scale: 2 }).then(canvas => {
        const link = document.createElement("a");
        link.download = `agreement-${formData.customerName}.jpg`;
        link.href = canvas.toDataURL("image/jpeg");
        link.click();
        toast({ title: "Success", description: "Agreement exported as JPG." });
      });
    }
  };

  if (!sale) return null;
  
  const inputUnderline = "bg-transparent border-0 border-b-2 border-dotted border-black rounded-none h-6 px-1 focus-visible:ring-0 focus-visible:ring-offset-0";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full flex flex-col max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contract Agreement Editor</DialogTitle>
        </DialogHeader>

        <div ref={contractRef} className="p-8 bg-white text-black text-sm font-serif">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold">Saowakon Noycumlee</h2>
            <p className="text-sm">Buengkan, Thailand</p>
            <p className="text-sm">Pharmacist/Businesswoman</p>
          </div>

          <div className="space-y-2 mb-6">
            <div className="flex items-center">
              <label className="w-32 shrink-0">Name:</label>
              <Input name="customerName" value={formData.customerName} onChange={handleInputChange} className={cn(inputUnderline, "flex-1")} />
            </div>
            <div className="flex items-center">
              <label className="w-32 shrink-0">Contact Number:</label>
              <Input name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} className={cn(inputUnderline, "flex-1")} />
            </div>
            <div className="flex items-center">
              <label className="w-32 shrink-0">Address:</label>
              <Input name="address" value={formData.address} onChange={handleInputChange} className={cn(inputUnderline, "flex-1")} />
            </div>
          </div>
          
          <hr className="my-6 border-black" />

          <h3 className="text-center font-bold mb-4">Proof and Agreement</h3>

          <div className="text-justify leading-relaxed space-y-4">
            <div className="flex flex-wrap items-end">
              This letter of agreement is made for Ms/Mr
              <Input name="customerName" value={formData.customerName} onChange={handleInputChange} className={cn(inputUnderline, "flex-grow min-w-[150px] mx-1 text-center")} /> 
              for she/he has made a cash instalment for gadget which is gadget:
              <Input name="gadget" value={formData.gadget} onChange={handleInputChange} className={cn(inputUnderline, "flex-grow min-w-[100px] mx-1 text-center")} />
              Worth
              <Input name="totalAmount" value={formData.totalAmount} onChange={handleInputChange} className={cn(inputUnderline, "w-24 mx-1 text-center")} /> 
              baht, She/he paid
              <Input name="downPayment" value={formData.downPayment} onChange={handleInputChange} className={cn(inputUnderline, "w-24 mx-1 text-center")} />
              baht as an initial payment with the total amount of
              <Input name="remainingBalance" value={formData.remainingBalance} onChange={handleInputChange} className={cn(inputUnderline, "w-24 mx-1 text-center")} />
              and she/he promised to pay the remaining balance
              <Input name="monthlyPayment" value={formData.monthlyPayment} onChange={handleInputChange} className={cn(inputUnderline, "w-24 mx-1 text-center")} />
              thb every month for
              <Input name="numberOfInstallments" value={formData.numberOfInstallments} onChange={handleInputChange} className={cn(inputUnderline, "w-16 mx-1 text-center")} />
              months. Which cost 
              <Input name="monthlyPayment" value={formData.monthlyPayment} onChange={handleInputChange} className={cn(inputUnderline, "w-24 mx-1 text-center")} />
              thb monthly. If ever the buyer doesn't pay the remaining balance within months, we will use the letter and her/his documents to post online and also, for police reporting or we will get back the laptop and hold it in our shop until she/he will pay the payment
            </div>
            <p>
              If the buyer is delayed to his/her payment every end of the month until the 6th day of the new month, the remaining days he/she will pay a penalty with an amount of 40 baht per day until he/she can pay including his/her monthly payment.
            </p>
          </div>
          
          <div className="flex items-center mt-6">
            <label className="w-40 shrink-0">Date of Downpayment:</label>
            <Input name="downPaymentDate" value={formData.downPaymentDate} onChange={handleInputChange} className={cn(inputUnderline, "flex-1")} type="date"/>
          </div>

          <div className="flex justify-between mt-16 pt-8">
            <div className="text-center">
              <p className="font-bold border-t border-black px-8">Saowakon Noycumlee</p>
              <p className="text-sm">Businesswoman/Pharmacist</p>
            </div>
            <div className="text-center">
               <div className="border-t border-black w-48 mb-1"></div>
              <p className="text-sm">Buyer's Signature</p>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-slate-100 p-4 flex justify-end space-x-2 border-t mt-auto sticky bottom-0">
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
          <Button onClick={exportToJpg} className="bg-blue-600 hover:bg-blue-700">
            <ImageIcon className="mr-2 h-4 w-4" /> Export as JPG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    