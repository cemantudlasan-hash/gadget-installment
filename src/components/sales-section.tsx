
"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, limit } from "firebase/firestore";
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

export default function SalesSection() {
  const { db, user } = useFirebase();
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<Sale | null>(null);
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    if (!db || !user) return;
    setLoading(true);
    try {
      const salesCollectionRef = collection(db, "sales");
      const snapshot = await getDocs(salesCollectionRef);
      let salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[];

      salesData = salesData.filter(sale => sale.dateStart);
      salesData.sort((a, b) => new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime());
      
      setSales(salesData);
    } catch (err: any) {
      console.error("Error fetching sales:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load sales data. Please check your Firestore rules and network connection. Details: ${err.message}`,
        duration: 9000,
      });
    } finally {
      setLoading(false);
    }
  }, [db, toast, user]);

  useEffect(() => {
    if (user) {
      fetchSales();
    }
  }, [user, fetchSales]);

  const handleSaveSale = async (saleData: Omit<Sale, "id">) => {
    if (!db) return;
    try {
       const commissionsCollectionRef = collection(db, "commissions");

      if (editingSale) {
        // Handle Shipping Cost Update in Ledger
        if (saleData.shippingCost !== editingSale.shippingCost) {
            const shippingDescription = `Shipping for ${saleData.gadget} (${saleData.customerName})`;
            const q = query(commissionsCollectionRef, where("description", "==", shippingDescription), limit(1));
            const shippingDocs = await getDocs(q);

            if (!shippingDocs.empty) {
                const shippingDocId = shippingDocs.docs[0].id;
                await updateDoc(doc(db, "commissions", shippingDocId), { spentAmount: saleData.shippingCost });
            } else if (saleData.shippingCost > 0) {
                 await addDoc(commissionsCollectionRef, { 
                    date: saleData.dateStart, 
                    description: shippingDescription, 
                    getAmount: 0, 
                    spentAmount: saleData.shippingCost 
                });
            }
        }
        
        await updateDoc(doc(db, "sales", editingSale.id), saleData);
        toast({ title: "Success", description: "Sale updated successfully!" });
      } else {
        await addDoc(collection(db, "sales"), saleData);
        toast({ title: "Success", description: "Sale added successfully!" });
        
        // Record shipping cost on new sale
        if (saleData.shippingCost > 0) {
            await addDoc(commissionsCollectionRef, { 
                date: saleData.dateStart, 
                description: `Shipping for ${saleData.gadget} (${saleData.customerName})`, 
                getAmount: 0, 
                spentAmount: saleData.shippingCost 
            });
        }
        // Record down payment on new sale
        if (saleData.downPayment > 0) {
          await addDoc(commissionsCollectionRef, {
            date: saleData.dateStart,
            description: `Down payment for ${saleData.gadget} (${saleData.customerName})`,
            getAmount: saleData.downPayment,
            spentAmount: 0,
          });
        }
      }
      setEditingSale(null);
      setShowSalesForm(false);
      fetchSales();
    } catch (e: any) {
      console.error("Error saving sale:", e);
      toast({ variant: "destructive", title: "Error", description: `Error saving sale: ${e.message}` });
    }
  };

  const handleDeleteSale = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "sales", id));
      toast({ title: "Success", description: "Sale deleted successfully!" });
      fetchSales(); // Refetch data after deleting
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

      await updateDoc(saleRef, {
        paymentInstallments: updatedInstallments,
        totalPaidAmount: newTotalPaid,
        remainingBalance: newRemainingBalance,
      });

      const commissionsCollectionRef = collection(db, "commissions");

      // Record this specific payment in the ledger
      await addDoc(commissionsCollectionRef, {
        date: paymentDate,
        description: `Payment for ${saleDoc.gadget} (${saleDoc.customerName})`,
        getAmount: amountPaid,
        spentAmount: 0,
      });

      // If this payment completes the sale, record the full commission
      if (isNowFullyPaid && !wasAlreadyPaid) {
        await addDoc(commissionsCollectionRef, {
          date: paymentDate,
          description: `Commission for ${saleDoc.gadget} (${saleDoc.customerName})`,
          getAmount: saleDoc.commission,
          spentAmount: 0,
        });
         toast({ title: "Sale Completed!", description: "Commission has been recorded in the ledger." });
      } else {
        toast({ title: "Success", description: "Payment recorded and ledger updated!" });
      }

      fetchSales();
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
          inst.paidAmount = amount;
          inst.lastPaymentDate = amount > 0 ? date : null;
          inst.isPaid = Math.abs(inst.paidAmount - inst.dueAmount) < 0.01;
        }
        return inst;
      });

      const newTotalPaid = updatedInstallments.reduce((sum, inst) => sum + inst.paidAmount, 0);

      await updateDoc(saleRef, {
        paymentInstallments: updatedInstallments,
        totalPaidAmount: newTotalPaid,
        remainingBalance: saleDoc.totalAmountDue - newTotalPaid,
      });

      toast({ title: "Success", description: "Payment updated successfully!" });
      fetchSales();
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
        <div className="text-center py-8">
          <Button onClick={() => setShowSalesForm(true)} size="lg" className="transform hover:scale-105">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Customer
          </Button>
        </div>
      )}

      <Card className="rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-700">Existing Installment Plans</CardTitle>
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
            <p className="text-center text-gray-500 py-8 text-lg">No sales records found.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader className="bg-primary/10">
                  <TableRow>
                    <TableHead className="font-semibold text-primary">Customer</TableHead>
                    <TableHead className="font-semibold text-primary hidden md:table-cell">Gadget</TableHead>
                    <TableHead className="text-right font-semibold text-primary hidden lg:table-cell">Total Due</TableHead>
                    <TableHead className="text-right font-semibold text-primary hidden lg:table-cell">Balance</TableHead>
                    <TableHead className="font-semibold text-primary">Status</TableHead>
                    <TableHead className="font-semibold text-primary">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                       <React.Fragment key={sale.id}>
                        <TableRow className="hover:bg-primary/5">
                          <TableCell>
                            <div className="font-medium">{sale.customerName}</div>
                            <div className="text-sm text-muted-foreground md:hidden">{sale.gadget}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{sale.gadget} ({sale.pieces} pcs)</TableCell>
                          <TableCell className="text-right hidden lg:table-cell">฿{sale.totalAmountDue?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell className="text-right hidden lg:table-cell">฿{sale.remainingBalance?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>
                            <Badge variant={sale.paymentInstallments?.every(p => p.isPaid) ? "default" : "secondary"} className={sale.paymentInstallments?.every(p => p.isPaid) ? 'bg-green-600' : ''}>
                              {sale.paymentInstallments?.every(p => p.isPaid) ? "Paid" : "Ongoing"}
                            </Badge>
                          </TableCell>
                          <TableCell className="flex items-center space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingSale(sale); setShowSalesForm(true); }}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setReceiptData(sale); setShowReceipt(true); }}><Receipt className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the sale for {sale.customerName}.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSale(sale.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
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
            </div>
          )}
        </CardContent>
      </Card>
      <CustomerReceipt saleData={receiptData} isOpen={showReceipt} onClose={() => setShowReceipt(false)} />
    </div>
  );
}
