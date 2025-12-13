
"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, writeBatch } from "firebase/firestore";
import SalesForm from "./sales-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Sale } from "@/types";
import { PlusCircle, ChevronDown, FileSpreadsheet, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import CustomerDetails from "./customer-details"; // Import the new component
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ContractEditor from "./contract-editor";

interface SalesSectionProps {
  sales: Sale[];
  loading: boolean;
  onDataChange: () => void;
  onUpdateSale: (saleId: string, updatedData: Partial<Sale>) => Promise<void>;
}

export default function SalesSection({ sales, loading, onDataChange, onUpdateSale }: SalesSectionProps) {
  const { db } = useFirebase();
  const { toast } = useToast();
  
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [contractSale, setContractSale] = useState<Sale | null>(null);

  const handleToggleSaleDetails = (saleId: string) => {
    setExpandedSaleId(prevId => (prevId === saleId ? null : saleId));
  };


  const handleSaveSale = async (saleData: Omit<Sale, "id">) => {
    if (!db) return;
    try {
      const commissionsCollectionRef = collection(db, "commissions");
      const batch = writeBatch(db);
      const saleId = editingSale ? editingSale.id : doc(collection(db, "sales")).id;

      if (editingSale) {
        await onUpdateSale(saleId, saleData as Partial<Sale>);
        toast({ title: "Success", description: "Sale updated successfully!" });
        
        // This part handles the associated ledger entries
        const dpDesc = `Down payment for sale ${saleId}`;
        const shippingDesc = `Shipping for sale ${saleId}`;
        const dpQuery = query(commissionsCollectionRef, where("saleId", "==", saleId), where("description", "==", dpDesc));
        const shippingQuery = query(commissionsCollectionRef, where("saleId", "==", saleId), where("description", "==", shippingDesc));
        const [dpDocs, shippingDocs] = await Promise.all([getDocs(dpQuery), getDocs(shippingQuery)]);
        const newDpDesc = `Down payment for ${saleData.gadget} (${saleData.customerName})`;
        if (!dpDocs.empty) {
            batch.update(dpDocs.docs[0].ref, { getAmount: saleData.downPayment, description: newDpDesc, date: saleData.dateStart });
        } else if (saleData.downPayment > 0) {
            batch.set(doc(commissionsCollectionRef), { date: saleData.dateStart, description: newDpDesc, getAmount: saleData.downPayment, spentAmount: 0, saleId: saleId });
        }
        const newShippingDesc = `Shipping for ${saleData.gadget} (${saleData.customerName})`;
        if (!shippingDocs.empty) {
            batch.update(shippingDocs.docs[0].ref, { spentAmount: saleData.shippingCost, description: newShippingDesc, date: saleData.dateStart });
        } else if (saleData.shippingCost > 0) {
            batch.set(doc(commissionsCollectionRef), { date: saleData.dateStart, description: newShippingDesc, getAmount: 0, spentAmount: saleData.shippingCost, saleId: saleId });
        }


      } else {
        const newSaleRef = doc(db, "sales", saleId);
        batch.set(newSaleRef, { ...saleData, id: newSaleRef.id });
        
        if (saleData.shippingCost > 0) {
          batch.set(doc(commissionsCollectionRef), {
            date: saleData.dateStart,
            description: `Shipping for ${saleData.gadget} (${saleData.customerName})`,
            getAmount: 0,
            spentAmount: saleData.shippingCost,
            saleId: newSaleRef.id,
          });
        }
        if (saleData.downPayment > 0) {
          batch.set(doc(commissionsCollectionRef), {
            date: saleData.dateStart,
            description: `Down payment for ${saleData.gadget} (${saleData.customerName})`,
            getAmount: saleData.downPayment,
            spentAmount: 0,
            saleId: newSaleRef.id,
          });
        }
        toast({ title: "Success", description: "Sale added successfully!" });
      }
      await batch.commit();
      setEditingSale(null);
      setShowSalesForm(false);
      onDataChange();
    } catch (e: any) {
      console.error("Error saving sale:", e);
      toast({ variant: "destructive", title: "Error", description: `Error saving sale: ${e.message}` });
    }
  };

  const handleDeleteSale = async (saleToDelete: Sale) => {
    if (!db) return;
    try {
        const batch = writeBatch(db);
        
        const saleRef = doc(db, "sales", saleToDelete.id);
        batch.delete(saleRef);

        const commissionsQuery = query(collection(db, "commissions"), where("saleId", "==", saleToDelete.id));
        const commissionDocs = await getDocs(commissionsQuery);
        commissionDocs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        
        toast({ title: "Success", description: "Sale and associated ledger entries deleted successfully!" });
        onDataChange();
    } catch (e: any) {
        console.error("Error deleting sale:", e);
        toast({ variant: "destructive", title: "Error", description: `Error deleting sale: ${e.message}` });
    }
  };

  const handleRecordPayment = async (saleId: string, amountPaid: number, paymentDate: string) => {
    if (!db) return;
    try {
      const saleDoc = sales.find(s => s.id === saleId);
      if (!saleDoc || !saleDoc.paymentInstallments) {
        toast({ variant: "destructive", title: "Error", description: "Could not find sale details to record payment." });
        return;
      };
      
      const wasAlreadyPaid = saleDoc.paymentInstallments.every(inst => inst.isPaid);

      let remainingPayment = amountPaid;
      const updatedInstallments = saleDoc.paymentInstallments.map(inst => {
        if (remainingPayment > 0 && !inst.isPaid) {
          const toPay = Math.min(remainingPayment, inst.dueAmount - inst.paidAmount);
          inst.paidAmount += toPay;
          remainingPayment -= toPay;
          if (Math.abs(inst.paidAmount - inst.dueAmount) < 0.01) {
            inst.isPaid = true;
          }
          if (toPay > 0) {
            inst.lastPaymentDate = paymentDate;
          }
        }
        return inst;
      });

      const newTotalPaid = updatedInstallments.reduce((sum, inst) => sum + inst.paidAmount, 0);
      const newRemainingBalance = saleDoc.totalAmountDue - newTotalPaid;
      
      const isNowFullyPaid = updatedInstallments.every(inst => inst.isPaid);

      const batch = writeBatch(db);
      
      const saleRef = doc(db, "sales", saleId);
      batch.update(saleRef, {
        paymentInstallments: updatedInstallments,
        totalPaidAmount: newTotalPaid,
        remainingBalance: newRemainingBalance,
      });

      const installmentLedgerRef = doc(collection(db, "commissions"));
      batch.set(installmentLedgerRef, {
        date: paymentDate,
        description: `Installment for ${saleDoc.gadget} (${saleDoc.customerName})`,
        getAmount: amountPaid,
        spentAmount: 0,
        saleId: saleId,
      });

      await batch.commit();

      if (isNowFullyPaid && !wasAlreadyPaid) {
         toast({ title: "Sale Completed!", description: "All installments have been paid." });
      } else {
        toast({ title: "Payment Recorded", description: `฿${amountPaid.toFixed(2)} recorded for ${saleDoc.customerName}.`})
      }

      onDataChange();
    } catch (e: any) {
      console.error("Error recording payment:", e);
      toast({ variant: "destructive", title: "Error", description: `Error recording payment: ${e.message}` });
    }
  };

  const handleEditPayment = async (saleId: string, month: number, amount: number, date: string) => {
     if (!db) return;
    try {
      const saleDoc = sales.find(s => s.id === saleId);
      if (!saleDoc || !saleDoc.paymentInstallments) {
        toast({ variant: "destructive", title: "Error", description: "Could not find sale details to edit payment." });
        return;
      };

      const updatedInstallments = saleDoc.paymentInstallments.map(inst => {
        if (inst.month === month) {
          return {
            ...inst,
            paidAmount: amount,
            lastPaymentDate: amount > 0 ? date : null,
            isPaid: Math.abs(amount - inst.dueAmount) < 0.01
          };
        }
        return inst;
      });

      const newTotalPaid = updatedInstallments.reduce((sum, inst) => sum + inst.paidAmount, 0);
      
      await onUpdateSale(saleId, {
        paymentInstallments: updatedInstallments,
        totalPaidAmount: newTotalPaid,
        remainingBalance: saleDoc.totalAmountDue - newTotalPaid,
      });
      
      toast({ title: "Success", description: "Payment updated successfully." });
    } catch (e: any) {
      console.error("Error editing payment:", e);
      toast({ variant: "destructive", title: "Error", description: `Error editing payment: ${e.message}` });
    }
  };

  const handleExcelExport = () => {
    const sortedSales = [...sales].sort((a, b) => a.customerName.localeCompare(b.customerName));
    
    const dataToExport = sortedSales.map(sale => {
      const row: { [key: string]: any } = {
        'Customer Name': sale.customerName,
        'Gadget': sale.gadget,
        'Pieces': sale.pieces,
        'Sell Price': sale.sellPrice,
        'Down Payment': sale.downPayment,
        'Total Amount Due': sale.totalAmountDue,
        'Total Paid': sale.totalPaidAmount,
        'Remaining Balance': sale.remainingBalance,
        'Start Date': sale.dateStart,
        '# of Installments': sale.numberOfInstallments,
        'Monthly Payment': sale.monthlyPayment,
        'Sale Status': sale.remainingBalance <= 0 ? 'Paid' : 'Ongoing',
      };
  
      sale.paymentInstallments.forEach(inst => {
        row[`Month ${inst.month} Due`] = inst.dueAmount;
        row[`Month ${inst.month} Paid`] = inst.paidAmount;
        row[`Month ${inst.month} Status`] = inst.isPaid ? 'Paid' : 'Pending';
        row[`Month ${inst.month} Date`] = inst.lastPaymentDate || '';
      });
  
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Auto-adjust column widths
    const objectMaxLength: number[] = [];
    dataToExport.forEach(obj => {
        Object.values(obj).forEach((value, i) => {
            const val = value ? String(value) : '';
            objectMaxLength[i] = objectMaxLength[i] >= val.length ? objectMaxLength[i] : val.length;
        });
    });

    const headers = Object.keys(dataToExport[0]);
    const colWidths = headers.map((header, i) => {
        const headerLength = header ? header.length : 0;
        const maxLength = Math.max(headerLength, objectMaxLength[i] || 0);
        return { wch: maxLength + 2 }; // +2 for a little padding
    });
    
    worksheet["!cols"] = colWidths;


    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Data");
    XLSX.writeFile(workbook, "Gadget_Installment_Report.xlsx");

    toast({
      title: "Export Successful",
      description: "Your sales data has been downloaded as an Excel file.",
    });
  };


  const customerNames = useMemo(() => {
    const uniqueNames = new Set(sales.map(s => s.customerName));
    return [...uniqueNames].sort((a, b) => a.localeCompare(b));
  }, [sales]);

  const filteredSales = selectedCustomer 
    ? sales.filter(sale => sale.customerName === selectedCustomer) 
    : sales;


  const handleEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setShowSalesForm(true);
  };

  const handleOpenContract = (sale: Sale) => {
    setContractSale(sale);
  };


  const handleAddNewCustomer = () => {
    setEditingSale(null);
    setShowSalesForm(true);
  }

  return (
    <div className="space-y-8">
      {showSalesForm ? (
        <SalesForm onSave={handleSaveSale} initialData={editingSale} onCancel={() => { setEditingSale(null); setShowSalesForm(false); }} />
      ) : (
        <div className="text-center py-4">
          <Button onClick={handleAddNewCustomer} size="lg">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Customer
          </Button>
        </div>
      )}

      {contractSale && (
        <ContractEditor
          sale={contractSale}
          isOpen={!!contractSale}
          onClose={() => setContractSale(null)}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Existing Installment Plans</CardTitle>
            <Button variant="outline" onClick={handleExcelExport} disabled={sales.length === 0}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download Excel
            </Button>
          </div>
          <div className="pt-4 flex items-center gap-4">
            <Label>Filter by Customer</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full md:w-[200px] justify-between">
                  <span className="truncate">{selectedCustomer || "All Customers"}</span>
                  <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px] max-h-60 overflow-y-auto">
                <DropdownMenuItem onSelect={() => setSelectedCustomer("")}>
                  All Customers
                </DropdownMenuItem>
                {customerNames.map((name) => (
                  <DropdownMenuItem key={name} onSelect={() => setSelectedCustomer(name)}>
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : filteredSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sales records found.</p>
          ) : (
            <div className="space-y-6">
              {filteredSales.map((sale) => (
                <CustomerDetails
                  key={sale.id}
                  sale={sale}
                  isOpen={expandedSaleId === sale.id}
                  onToggle={() => handleToggleSaleDetails(sale.id)}
                  onEditSale={handleEditSale}
                  onDeleteSale={handleDeleteSale}
                  onRecordPayment={handleRecordPayment}
                  onEditPayment={handleEditPayment}
                  onOpenContract={handleOpenContract}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
