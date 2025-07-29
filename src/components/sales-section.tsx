
"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, writeBatch } from "firebase/firestore";
import SalesForm from "./sales-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Sale } from "@/types";
import { PlusCircle, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import CustomerDetails from "./customer-details"; // Import the new component
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SalesSectionProps {
  sales: Sale[];
  loading: boolean;
  onDataChange: () => void;
}

export default function SalesSection({ sales, loading, onDataChange }: SalesSectionProps) {
  const { db } = useFirebase();
  const { toast } = useToast();
  
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

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
        const saleRef = doc(db, "sales", saleId);
        batch.update(saleRef, saleData as any);
        toast({ title: "Success", description: "Sale updated successfully!" });

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
            description: `Shipping for sale ${saleId}`,
            getAmount: 0,
            spentAmount: saleData.shippingCost,
            saleId: newSaleRef.id,
          });
        }
        if (saleData.downPayment > 0) {
          batch.set(doc(commissionsCollectionRef), {
            date: saleData.dateStart,
            description: `Down payment for sale ${saleId}`,
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
      const saleRef = doc(db, "sales", saleId);
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
      const saleRef = doc(db, "sales", saleId);
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
      
      await updateDoc(saleRef, {
        paymentInstallments: updatedInstallments,
        totalPaidAmount: newTotalPaid,
        remainingBalance: saleDoc.totalAmountDue - newTotalPaid,
      });
      
      toast({ title: "Success", description: "Payment updated successfully." });
      onDataChange();
    } catch (e: any) {
      console.error("Error editing payment:", e);
      toast({ variant: "destructive", title: "Error", description: `Error editing payment: ${e.message}` });
    }
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

      <Card>
        <CardHeader>
          <CardTitle>Existing Installment Plans</CardTitle>
          <div className="pt-4 space-y-2">
            <Label>Filter by Customer</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full md:w-1/2 justify-between">
                  {selectedCustomer || "All Customers"}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full md:w-1/2">
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
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
