
"use client";

import { useRef, useState, useEffect }from "react";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { Sale } from "@/types";
import { X, Image as ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToWord as exportToWordAction } from "@/app/actions/export-to-word";

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
        downPaymentDate: sale.dateStart ? new Date(sale.dateStart).toISOString().split('T')[0] : new Date().toISOString().split("T")[0],
      });
    }
  }, [sale]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getContractHTML = () => {
    return `
      <div class="p-8 bg-white text-black text-sm font-serif" style="width: 800px; font-family: 'Times New Roman', serif;">
          <div style="text-align: center; margin-bottom: 1.5rem;">
              <h2 style="font-size: 1.125rem; font-weight: bold;">Saowakon Noycumlee</h2>
              <p style="font-size: 0.875rem;">Buengkan, Thailand</p>
              <p style="font-size: 0.875rem;">Pharmacist/Businesswoman</p>
          </div>
          <div style="margin-bottom: 1.5rem; line-height: 1.75;">
              <p>Name: <span style="font-weight: bold;">${formData.customerName}</span></p>
              <p>Contact Number: <span style="font-weight: bold;">${formData.contactNumber}</span></p>
              <p>Address: <span style="font-weight: bold;">${formData.address}</span></p>
          </div>
          <hr style="margin: 1.5rem 0; border-top: 1px solid black;" />
          <h3 style="text-align: center; font-weight: bold; margin-bottom: 1rem;">Proof and Agreement</h3>
          <div style="text-align: justify; line-height: 1.625; margin-bottom: 1.5rem;">
              <p style="margin-bottom: 1rem;">
                  This letter of agreement is made for Ms/Mr <span style="font-weight: bold;">${formData.customerName}</span> for she/he has made a cash instalment for gadget which is item: <span style="font-weight: bold;">${formData.gadget}</span>.
              </p>
              <p style="margin-bottom: 1rem;">
                  Worth <span style="font-weight: bold;">${formData.totalAmount}</span> baht, She/he paid <span style="font-weight: bold;">${formData.downPayment}</span> baht as an initial payment with the total amount of <span style="font-weight: bold;">${formData.remainingBalance}</span> and she/he promised to pay the remaining balance <span style="font-weight: bold;">${formData.monthlyPayment}</span> thb every month for <span style="font-weight: bold;">${formData.numberOfInstallments}</span> months. Which cost <span style="font-weight: bold;">${formData.monthlyPayment}</span> thb monthly. If ever the buyer doesn't pay the remaining balance within months, we will use the letter and her/his documents to post online and also, for police reporting or we will get back the item and hold it in our shop until she/he will pay the payment.
              </p>
              <p>
                If the buyer is delayed to his/her payment every end of the month until the 6th day of the new month, the remaining days he/she will pay a penalty with an amount of 40 baht per day until he/she can pay including his/her monthly payment.
              </p>
          </div>
          <div style="margin-top: 1.5rem;">
              <p>Date of Downpayment: <span style="font-weight: bold;">${formData.downPaymentDate}</span></p>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 4rem; padding-top: 2rem;">
              <div style="text-align: center;">
                  <p style="font-weight: bold; border-top: 1px solid black; padding: 0 2rem;">Saowakon Noycumlee</p>
                  <p style="font-size: 0.875rem;">Businesswoman/Pharmacist</p>
              </div>
              <div style="text-align: center;">
                  <div style="border-top: 1px solid black; width: 12rem; margin-bottom: 0.25rem;"></div>
                  <p style="font-size: 0.875rem;">Buyer's Signature</p>
              </div>
          </div>
      </div>
    `;
  };

  const exportToJpg = () => {
    const printableElement = document.createElement('div');
    printableElement.innerHTML = getContractHTML();
    document.body.appendChild(printableElement);

    html2canvas(printableElement.firstElementChild as HTMLElement, { scale: 2.5, useCORS: true }).then(canvas => {
        const link = document.createElement("a");
        link.download = `agreement-${formData.customerName}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 1.0);
        link.click();
        toast({ title: "Success", description: "Agreement exported as JPG." });
        
        document.body.removeChild(printableElement);
        onClose();
    }).catch(err => {
        console.error('Error exporting to JPG:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not export the agreement.',
        });
        document.body.removeChild(printableElement);
    })
  };
  
  const exportToWord = async () => {
    if (!contractRef.current) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Contract content not found.",
        });
        return;
    }

    try {
        const htmlString = getContractHTML();
        const fileBuffer = await exportToWordAction(htmlString);
        
        if (fileBuffer) {
          const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          saveAs(blob, `agreement-${formData.customerName}.docx`);
          toast({ title: "Success", description: "Agreement exported as DOCX." });
          onClose();
        } else {
           throw new Error("File buffer is empty.");
        }
        
    } catch (err) {
        console.error('Error exporting to DOCX:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not export the agreement as a Word document.',
        });
    }
};

  if (!sale) return null;
  
  const inputStyle = "bg-transparent border-0 border-b-2 border-dotted border-black rounded-none h-6 px-1 text-center focus-visible:ring-0 focus-visible:ring-offset-0 font-bold";

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

            <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2">
                    <label className="w-32 shrink-0">Name:</label>
                    <Input name="customerName" value={formData.customerName} onChange={handleInputChange} className={cn(inputStyle, "flex-1")} />
                </div>
                <div className="flex items-center gap-2">
                    <label className="w-32 shrink-0">Contact Number:</label>
                    <Input name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} className={cn(inputStyle, "flex-1")} />
                </div>
                <div className="flex items-center gap-2">
                    <label className="w-32 shrink-0">Address:</label>
                    <Input name="address" value={formData.address} onChange={handleInputChange} className={cn(inputStyle, "flex-1")} />
                </div>
            </div>
            
            <hr className="my-6 border-black" />

            <h3 className="text-center font-bold mb-4">Proof and Agreement</h3>

            <div className="text-justify leading-relaxed space-y-4">
                 <p>
                  This letter of agreement is made for Ms/Mr <Input name="customerName" value={formData.customerName} onChange={handleInputChange} className={cn(inputStyle, "w-48 mx-1")} /> for she/he has made a cash instalment for gadget which is item: <Input name="gadget" value={formData.gadget} onChange={handleInputChange} className={cn(inputStyle, "w-32 mx-1")} />.
                 </p>
                 <p>
                  Worth <Input name="totalAmount" value={formData.totalAmount} onChange={handleInputChange} className={cn(inputStyle, "w-24 mx-1")} /> baht, She/he paid <Input name="downPayment" value={formData.downPayment} onChange={handleInputChange} className={cn(inputStyle, "w-24 mx-1")} /> baht as an initial payment with the total amount of <Input name="remainingBalance" value={formData.remainingBalance} onChange={handleInputChange} className={cn(inputStyle, "w-24 mx-1")} /> and she/he promised to pay the remaining balance <Input name="monthlyPayment" value={formData.monthlyPayment} onChange={handleInputChange} className={cn(inputStyle, "w-24 mx-1")} /> thb every month for <Input name="numberOfInstallments" value={formData.numberOfInstallments} onChange={handleInputChange} className={cn(inputStyle, "w-16 mx-1")} /> months. Which cost <Input name="monthlyPayment" value={formData.monthlyPayment} onChange={handleInputChange} className={cn(inputStyle, "w-24 mx-1")} readOnly /> thb monthly. If ever the buyer doesn't pay the remaining balance within months, we will use the letter and her/his documents to post online and also, for police reporting or we will get back the item and hold it in our shop until she/he will pay the payment.
                 </p>
                <p>
                  If the buyer is delayed to his/her payment every end of the month until the 6th day of the new month, the remaining days he/she will pay a penalty with an amount of 40 baht per day until he/she can pay including his/her monthly payment.
                </p>
            </div>
          
            <div className="flex items-center mt-6">
                <label className="w-40 shrink-0">Date of Downpayment:</label>
                <Input name="downPaymentDate" value={formData.downPaymentDate} onChange={handleInputChange} className={cn(inputStyle, "w-32")} type="date"/>
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
          <Button onClick={exportToWord} className="bg-blue-600 hover:bg-blue-700">
            <FileText className="mr-2 h-4 w-4" /> Export as Word
          </Button>
          <Button onClick={exportToJpg} className="bg-green-600 hover:bg-green-700">
            <ImageIcon className="mr-2 h-4 w-4" /> Export as JPG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
