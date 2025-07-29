
"use client";

import * as React from "react";
import { useState } from "react";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, limit, writeBatch, setDoc } from "firebase/firestore";
import SalesForm from "./sales-form";
import CustomerReceipt from "./customer-receipt";
import PaymentRecorder from "./payment-recorder";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Sale } from "@/types";
import { Edit, Trash2, Receipt, ChevronDown, PlusCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

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
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<Sale | null>(null);
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);

  const handleSaveSale = async (saleData: Omit<Sale, "id">) => {
    if (!db) return;
    try {
       const commissionsCollectionRef = collection(db, "commissions");
       const batch = writeBatch(db);

      if (editingSale) {
        // Find existing ledger entries to update them
        const dpDescription = `Down payment for ${editingSale.gadget} (${editingSale.customerName})`;
        const dpQuery = query(commissionsCollectionRef, where("saleId", "==", editingSale.id), where("description", "==", dpDescription), limit(1));
        const shippingDescription = `Shipping for ${editingSale.gadget} (${editingSale.customerName})`;
        const shippingQuery = query(commissionsCollectionRef, where("saleId", "==", editingSale.id), where("description", "==", shippingDescription), limit(1));

        const [dpDocs, shippingDocs] = await Promise.all([
          getDocs(dpQuery),
          getDocs(shippingQuery)
        ]);

        // Update Down Payment Ledger
        const newDpDesc = `Down payment for ${saleData.gadget} (${saleData.customerName})`;
        if (!dpDocs.empty) {
          const dpDocId = dpDocs.docs[0].id;
          batch.update(doc(db, "commissions", dpDocId), { getAmount: saleData.downPayment, description: newDpDesc, date: saleData.dateStart });
        } else if (saleData.downPayment > 0) {
          const newDpRef = doc(commissionsCollectionRef);
          batch.set(newDpRef, { date: saleData.dateStart, description: newDpDesc, getAmount: saleData.downPayment, spentAmount: 0, saleId: editingSale.id });
        }
        
        // Update Shipping Cost Ledger
        const newShippingDesc = `Shipping for ${saleData.gadget} (${saleData.customerName})`;
        if (!shippingDocs.empty) {
            const shippingDocId = shippingDocs.docs[0].id;
            batch.update(doc(db, "commissions", shippingDocId), { spentAmount: saleData.shippingCost, description: newShippingDesc, date: saleData.dateStart });
        } else if (saleData.shippingCost > 0) {
            const newShippingRef = doc(commissionsCollectionRef);
            batch.set(newShippingRef, { date: saleData.dateStart, description: newShippingDesc, getAmount: 0, spentAmount: saleData.shippingCost, saleId: editingSale.id });
        }
        
        // Update the sale itself
        const saleRef = doc(db, "sales", editingSale.id);
        batch.update(saleRef, saleData as any);
        toast({ title: "Success", description: "Sale updated successfully!" });

      } else {
        const newSaleRef = doc(collection(db, "sales"));
        // Set the sale data, including the generated ID.
        await setDoc(newSaleRef, { ...saleData, id: newSaleRef.id });

        toast({ title: "Success", description: "Sale added successfully!" });
        // Now that the sale is created, create ledger entries in a batch.
        
        if (saleData.shippingCost > 0) {
          const shippingRef = doc(commissionsCollectionRef);
          batch.set(shippingRef, {
            date: saleData.dateStart,
            description: `Shipping for ${saleData.gadget} (${saleData.customerName})`,
            getAmount: 0,
            spentAmount: saleData.shippingCost,
            saleId: newSaleRef.id,
          });
        }
        if (saleData.downPayment > 0) {
          const dpRef = doc(commissionsCollectionRef);
          batch.set(dpRef, {
            date: saleData.dateStart,
            description: `Down payment for ${saleData.gadget} (${saleData.customerName})`,
            getAmount: saleData.downPayment,
            spentAmount: 0,
            saleId: newSaleRef.id,
          });
        }
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
      // Only delete the sale document, associated ledger entries will remain for historical accuracy.
      await deleteDoc(doc(db, "sales", saleToDelete.id));
      
      toast({ title: "Success", description: "Sale record deleted successfully! Financial records have been preserved." });
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

      const commissionsCollectionRef = collection(db, "commissions");

      // Record this specific payment in the ledger
      const paymentRef = doc(commissionsCollectionRef);
      batch.set(paymentRef, {
        date: paymentDate,
        description: `Payment for ${saleDoc.gadget} (${saleDoc.customerName})`,
        getAmount: amountPaid,
        spentAmount: 0,
        saleId: saleId
      });

      await batch.commit();

      if (isNowFullyPaid && !wasAlreadyPaid) {
         toast({ title: "Sale Completed!", description: "All installments have been paid." });
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

      // Find original paid amount for the month to calculate the difference
      const originalInstallment = saleDoc.paymentInstallments.find(inst => inst.month === month);
      const originalAmount = originalInstallment ? originalInstallment.paidAmount : 0;
      const difference = amount - originalAmount;

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

      const batch = writeBatch(db);
      
      batch.update(saleRef, {
        paymentInstallments: updatedInstallments,
        totalPaidAmount: newTotalPaid,
        remainingBalance: saleDoc.totalAmountDue - newTotalPaid,
      });

      // Add a ledger entry for the difference
      if (Math.abs(difference) > 0.01) {
          const ledgerRef = doc(collection(db, "commissions"));
          batch.set(ledgerRef, {
              date: date,
              description: `Correction for ${saleDoc.gadget} (${saleDoc.customerName}), Month ${month}`,
              getAmount: difference > 0 ? difference : 0,
              spentAmount: difference < 0 ? -difference : 0,
              saleId: saleId,
          });
      }
      
      await batch.commit();

      toast({ title: "Success", description: "Payment updated successfully and ledger corrected." });
      onDataChange();
    } catch (e: any) {
      console.error("Error editing payment:", e);
      toast({ variant: "destructive", title: "Error", description: `Error editing payment: ${e.message}` });
    }
  };


  const customerNames = [...new Set(sales.map(s => s.customerName))].sort();
  const filteredSales = selectedCustomer ? sales.filter(s => s.customerName === selectedCustomer) : sales;

  return (
    <div className="space-y-8">
      {showSalesForm ? (
        <SalesForm onSave={handleSaveSale} initialData={editingSale} onCancel={() => { setEditingSale(null); setShowSalesForm(false); }} />
      ) : (
        <div className="text-center py-4">
          <Button onClick={() => setShowSalesForm(true)} size="lg">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Customer
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Existing Installment Plans</CardTitle>
          <div className="pt-4">
            <Label>Filter by Customer</Label>
            <Select value={selectedCustomer} onValueChange={(value) => setSelectedCustomer(value === 'all' ? '' : value)}>
              <SelectTrigger className="w-full md:w-1/2">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customerNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : filteredSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sales records found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Gadget</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Total Due</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => (
                       <React.Fragment key={sale.id}>
                        <TableRow>
                          <TableCell>
                            <div className="font-medium">{sale.customerName}</div>
                            <div className="text-sm text-muted-foreground md:hidden">{sale.gadget}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{sale.gadget} ({sale.pieces} pcs)</TableCell>
                          <TableCell className="text-right hidden lg:table-cell">฿{sale.totalAmountDue?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell className="text-right hidden lg:table-cell">฿{sale.remainingBalance?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>
                            <Badge variant={sale.paymentInstallments?.every(p => p.isPaid) ? "default" : "secondary"}>
                              {sale.paymentInstallments?.every(p => p.isPaid) ? "Paid" : "Ongoing"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingSale(sale); setShowSalesForm(true); }}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setReceiptData(sale); setShowReceipt(true); }}><Receipt className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the installment plan for {sale.customerName}. The associated financial records will be kept for historical reporting.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSale(sale)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                              <Button variant="ghost" size="icon" onClick={() => setOpenSaleId(openSaleId === sale.id ? null : sale.id)}>
                                <ChevronDown className={`h-4 w-4 transition-transform ${openSaleId === sale.id ? 'rotate-180' : ''}`} />
                              </Button>
                          </TableCell>
                        </TableRow>
                        {openSaleId === sale.id && (
                           <TableRow>
                              <TableCell colSpan={6} className="p-0">
                                <PaymentRecorder sale={sale} onRecordPayment={handleRecordPayment} onEditPayment={handleEditPayment} />
                              </TableCell>
                            </TableRow>
                        )}
                        </React.Fragment>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <CustomerReceipt saleData={receiptData} isOpen={showReceipt} onClose={() => setShowReceipt(false)} />
    </div>
  );
}
