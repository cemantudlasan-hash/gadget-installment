
"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Sale, Commission } from "@/types";
import { addMonths, differenceInMonths, endOfMonth, format, isAfter, isBefore, parseISO, startOfMonth } from "date-fns";
import { UserX, AlertTriangle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/lib/firebase/context";
import { doc, updateDoc, writeBatch, collection } from "firebase/firestore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

interface RemindersSectionProps {
  sales: Sale[];
  commissions: Commission[];
  loading: boolean;
  onDataChange: () => void;
  onUpdateSale: (saleId: string, updatedData: Partial<Sale>) => Promise<void>;
}

interface OverdueCustomer {
  sale: Sale;
  dueDate: Date;
  monthlyPayment: number;
}

export default function RemindersSection({ sales, commissions, loading, onDataChange, onUpdateSale }: RemindersSectionProps) {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [selectedSaleId, setSelectedSaleId] = useState<string>("");
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const overdueCustomers = useMemo(() => {
    const today = new Date();
    const reminders: OverdueCustomer[] = [];

    sales.forEach((sale) => {
      if (sale.remainingBalance <= 0 || (sale.paymentInstallments?.every(p => p.isPaid))) {
        return;
      }

      const startDate = parseISO(sale.dateStart);
      
      sale.paymentInstallments?.forEach((inst) => {
        if (!inst.isPaid) {
          const dueDate = endOfMonth(addMonths(startDate, inst.month -1));

          if (isBefore(dueDate, today)) {
             reminders.push({
                sale,
                dueDate,
                monthlyPayment: inst.dueAmount,
            });
          }
        }
      });
    });
    
    const uniqueReminders = Array.from(new Map(reminders.map(r => [r.sale.id, r])).values());

    return uniqueReminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [sales]);

  const penaltyHistory = useMemo(() => {
    return commissions
      .filter(c => c.description.toLowerCase().includes('penalty for'))
      .map(c => {
        const sale = sales.find(s => s.id === c.saleId);
        return {
          ...c,
          customerName: sale?.customerName || 'N/A',
          gadget: sale?.gadget || 'N/A',
        };
      })
      .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [commissions, sales]);

  const ongoingSales = useMemo(() => {
    return sales
      .filter(s => s.remainingBalance > 0)
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [sales]);

  const handleAddPenalty = async () => {
    if (!selectedSaleId || penaltyAmount <= 0 || !db) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "Please select a customer and enter a valid penalty amount.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const saleToUpdate = sales.find(s => s.id === selectedSaleId);
      if (!saleToUpdate) throw new Error("Sale not found");
      
      const batch = writeBatch(db);
      
      const saleRef = doc(db, "sales", selectedSaleId);
      const newTotalAmountDue = saleToUpdate.totalAmountDue + penaltyAmount;
      const newRemainingBalance = saleToUpdate.remainingBalance + penaltyAmount;

      batch.update(saleRef, {
        totalAmountDue: newTotalAmountDue,
        remainingBalance: newRemainingBalance,
      });

      const penaltyLedgerRef = doc(collection(db, "commissions"));
      batch.set(penaltyLedgerRef, {
        date: new Date().toISOString().split("T")[0],
        description: `Penalty for ${saleToUpdate.gadget} (${saleToUpdate.customerName})`,
        getAmount: penaltyAmount,
        spentAmount: 0,
        saleId: selectedSaleId,
      });

      await batch.commit();

      toast({
        title: "Penalty Added",
        description: `฿${penaltyAmount.toFixed(2)} has been added to ${saleToUpdate.customerName}'s balance.`,
      });
      setSelectedSaleId("");
      setPenaltyAmount(0);
      onDataChange();

    } catch (e: any) {
      console.error("Error adding penalty:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Could not add penalty: ${e.message}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Overdue Payments</CardTitle>
          <CardDescription>
            This list shows customers with overdue monthly payments. The list is cleared automatically once a payment is recorded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : overdueCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserX className="mx-auto h-12 w-12 mb-4" />
              <p className="text-lg">No overdue payments found.</p>
              <p>All customers are up-to-date!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Gadget</TableHead>
                  <TableHead>Last Due Date</TableHead>
                  <TableHead className="text-right">Amount Due (฿)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueCustomers.map(({ sale, dueDate, monthlyPayment }, index) => (
                  <TableRow key={`${sale.id}-${index}`} className="bg-red-50/50 hover:bg-red-100/60 dark:bg-red-900/20 dark:hover:bg-red-900/40">
                    <TableCell className="font-medium">{sale.customerName}</TableCell>
                    <TableCell>{sale.gadget}</TableCell>
                    <TableCell>{format(dueDate, "MMMM dd, yyyy")}</TableCell>
                    <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                      {monthlyPayment.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Penalty Management</CardTitle>
          <CardDescription>
            Apply a penalty to a customer's outstanding balance. This will be added to their total due amount and recorded as income.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           {loading ? (
             <Skeleton className="h-24 w-full" />
           ) : (
             <div className="flex flex-col sm:flex-row items-end gap-4">
               <div className="w-full sm:w-1/2 space-y-2">
                 <Label htmlFor="customer-select">Customer</Label>
                 <Select value={selectedSaleId} onValueChange={setSelectedSaleId}>
                   <SelectTrigger id="customer-select">
                     <SelectValue placeholder="Select a customer..." />
                   </SelectTrigger>
                   <SelectContent>
                     {ongoingSales.map(sale => (
                       <SelectItem key={sale.id} value={sale.id}>
                         {sale.customerName} - {sale.gadget} (Balance: ฿{sale.remainingBalance.toFixed(2)})
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="w-full sm:w-1/4 space-y-2">
                 <Label htmlFor="penalty-amount">Penalty Amount (฿)</Label>
                 <Input 
                   id="penalty-amount" 
                   type="number" 
                   value={penaltyAmount} 
                   onChange={(e) => setPenaltyAmount(parseFloat(e.target.value) || 0)}
                   placeholder="e.g. 100" 
                   step="1"
                 />
               </div>
               <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      disabled={isSubmitting || !selectedSaleId || penaltyAmount <= 0}
                      className="w-full sm:w-auto"
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Apply Penalty
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will add a penalty of ฿{penaltyAmount.toFixed(2)} to the selected customer's balance. This action will be recorded and cannot be easily undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAddPenalty} disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Yes, Add Penalty'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
             </div>
           )}
          <Separator className="my-6" />

          <div>
            <h4 className="text-md font-semibold mb-2 flex items-center"><History className="mr-2 h-5 w-5" /> Penalty History</h4>
            {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
            ) : penaltyHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No penalties have been applied yet.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Gadget</TableHead>
                        <TableHead className="text-right">Penalty (฿)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {penaltyHistory.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell>{format(parseISO(item.date), "yyyy-MM-dd")}</TableCell>
                            <TableCell>{item.customerName}</TableCell>
                            <TableCell>{item.gadget}</TableCell>
                            <TableCell className="text-right font-medium text-amber-500">{item.getAmount?.toFixed(2)}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
