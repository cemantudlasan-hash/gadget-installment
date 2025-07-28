
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, orderBy, query } from "firebase/firestore";
import CommissionForm from "./commission-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Commission, Sale } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths, parseISO, startOfYear, endOfYear, addYears, subYears } from "date-fns";

export default function CommissionsSection() {
  const { db, user } = useFirebase();
  const { toast } = useToast();
  const [allCommissions, setAllCommissions] = useState<Commission[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentYear, setCurrentYear] = useState(new Date());

  const fetchAllData = useCallback(async () => {
    if (!db || !user) return;
    setLoading(true);
    try {
      const commissionsCollectionRef = collection(db, "commissions");
      const q = query(commissionsCollectionRef, orderBy("date", "desc"));
      const commissionsSnapshot = await getDocs(q);
      const commissionsData: Commission[] = commissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Commission[];
      
      setAllCommissions(commissionsData);

      const salesCollectionRef = collection(db, "sales");
      const salesSnapshot = await getDocs(salesCollectionRef);
      const salesData: Sale[] = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[];
      setSales(salesData);


    } catch (err: any)      {
      console.error("Error fetching data:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load data. Details: ${err.message}`,
        duration: 9000,
      });
    } finally {
      setLoading(false);
    }
  }, [db, toast, user]);

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, fetchAllData]);

  const { monthlyCommissions, totalCommissionIncome, totalExpenses, netProfitAfterDP } = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const filteredLedgerEntries = allCommissions.filter(c => {
        const commissionDate = parseISO(c.date);
        return isWithinInterval(commissionDate, { start, end });
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningTotal = 0;
    
    const commissionsWithTotal = filteredLedgerEntries.map(item => {
      const getAmount = item.getAmount || 0;
      const spentAmount = item.spentAmount || 0;
      runningTotal += getAmount - spentAmount;
      return { ...item, runningTotal };
    });
    
    const expenseSum = filteredLedgerEntries.reduce((acc, item) => acc + (item.spentAmount || 0), 0);

    // Find sales that were fully paid in the current month
    const fullyPaidSalesThisMonth = sales.filter(sale => {
      const isFullyPaid = sale.paymentInstallments.every(p => p.isPaid);
      if (!isFullyPaid) return false;

      // Find the last payment date among all installments
      const lastPaymentDateStr = sale.paymentInstallments.reduce((latest, current) => {
        if (!current.lastPaymentDate) return latest;
        if (!latest) return current.lastPaymentDate;
        return new Date(current.lastPaymentDate) > new Date(latest) ? current.lastPaymentDate : latest;
      }, null as string | null);

      if (!lastPaymentDateStr) return false;
      
      const lastPaymentDate = parseISO(lastPaymentDateStr);
      return isWithinInterval(lastPaymentDate, { start, end });
    });

    const commissionIncome = fullyPaidSalesThisMonth.reduce((acc, sale) => acc + sale.commission, 0);

    const profitAfterDP = fullyPaidSalesThisMonth.reduce((acc, sale) => {
      // Net Profit for a sale = Commission - Down Payment
      return acc + (sale.commission - sale.downPayment);
    }, 0);


    return {
      monthlyCommissions: commissionsWithTotal,
      totalCommissionIncome: commissionIncome,
      totalExpenses: expenseSum,
      netProfitAfterDP: profitAfterDP,
    };
  }, [allCommissions, sales, currentMonth]);
  
  const yearlyReport = useMemo(() => {
    const start = startOfYear(currentYear);
    const end = endOfYear(currentYear);
    
    const yearlyExpenses = allCommissions
      .filter(c => isWithinInterval(parseISO(c.date), { start, end }))
      .reduce((acc, item) => acc + (item.spentAmount || 0), 0);
      
    const fullyPaidSalesThisYear = sales.filter(sale => {
      const isFullyPaid = sale.paymentInstallments.every(p => p.isPaid);
      if (!isFullyPaid) return false;
      
      const lastPaymentDateStr = sale.paymentInstallments.reduce((latest, current) => {
        if (!current.lastPaymentDate) return latest;
        if (!latest) return current.lastPaymentDate;
        return new Date(current.lastPaymentDate) > new Date(latest) ? current.lastPaymentDate : latest;
      }, null as string | null);

      if (!lastPaymentDateStr) return false;
      
      const lastPaymentDate = parseISO(lastPaymentDateStr);
      return isWithinInterval(lastPaymentDate, { start, end });
    });

    const yearlyCommissionIncome = fullyPaidSalesThisYear.reduce((acc, sale) => acc + sale.commission, 0);
    const yearlyNetProfitAfterDP = fullyPaidSalesThisYear.reduce((acc, sale) => {
      return acc + (sale.commission - sale.downPayment);
    }, 0);


    return {
      totalIncome: yearlyCommissionIncome,
      totalExpenses: yearlyExpenses,
      netProfitAfterDP: yearlyNetProfitAfterDP
    }
  }, [allCommissions, sales, currentYear]);


  const handleSaveCommission = async (commissionData: Omit<Commission, 'id' | 'runningTotal'>) => {
    if (!db) return;
    try {
      if (editingCommission) {
        await updateDoc(doc(db, "commissions", editingCommission.id), commissionData);
        toast({ title: "Success", description: "Entry updated successfully!" });
      } else {
        await addDoc(collection(db, "commissions"), commissionData);
        toast({ title: "Success", description: "Entry added successfully!" });
      }
      setEditingCommission(null);
      fetchAllData();
    } catch (e: any) {
      console.error("Error saving commission:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error saving entry: ${e.message}`,
      });
    }
  };

  const handleDeleteCommission = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "commissions", id));
      toast({ title: "Success", description: "Entry deleted successfully!" });
      fetchAllData();
    } catch (e: any) {
      console.error("Error deleting commission:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error deleting entry: ${e.message}`,
      });
    }
  };

  return (
    <div className="space-y-8">
      <CommissionForm
        onSave={handleSaveCommission}
        initialData={editingCommission}
        onCancel={() => setEditingCommission(null)}
      />

      <Card className="rounded-2xl shadow-lg">
        <CardHeader>
           <div className="flex justify-between items-center">
             <CardTitle className="text-xl font-bold text-gray-700">Monthly Ledger</CardTitle>
             <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold text-primary">{format(currentMonth, "MMMM yyyy")}</span>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
             </div>
           </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : monthlyCommissions.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-lg">No ledger entries for this month. Add one above!</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader className="bg-primary/10">
                  <TableRow>
                    <TableHead className="font-semibold text-primary">Date</TableHead>
                    <TableHead className="font-semibold text-primary">Description</TableHead>
                    <TableHead className="text-right font-semibold text-primary">Income (฿)</TableHead>
                    <TableHead className="text-right font-semibold text-primary">Expense (฿)</TableHead>
                    <TableHead className="text-right font-semibold text-primary">Running Total (฿)</TableHead>
                    <TableHead className="font-semibold text-primary">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyCommissions.map((item) => (
                    <TableRow key={item.id} className="hover:bg-primary/5">
                      <TableCell>{item.date}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{item.getAmount?.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">{item.spentAmount?.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">{item.runningTotal?.toFixed(2)}</TableCell>
                      <TableCell className="flex items-center space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => setEditingCommission(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete this ledger entry.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCommission(item.id)} className="bg-destructive hover:bg-destructive/90">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="rounded-2xl shadow-lg bg-primary/5">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-primary">Monthly Financial Summary for {format(currentMonth, "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card p-4 rounded-lg border">
              <p className="text-base font-medium text-muted-foreground">Total Commission (from paid sales):</p>
              <p className="text-2xl font-bold text-green-600">฿{totalCommissionIncome.toFixed(2)}</p>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <p className="text-base font-medium text-muted-foreground">Total Expenses:</p>
              <p className="text-2xl font-bold text-red-600">฿{totalExpenses.toFixed(2)}</p>
            </div>
             <div className="bg-card p-4 rounded-lg border">
              <p className="text-base font-medium text-muted-foreground">Profit After Down Payment:</p>
              <p className={`text-2xl font-bold ${netProfitAfterDP >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>฿{netProfitAfterDP.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-lg bg-accent/10">
        <CardHeader>
           <div className="flex justify-between items-center">
             <CardTitle className="text-xl font-bold text-accent-foreground">Yearly Report</CardTitle>
             <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => setCurrentYear(subYears(currentYear, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold text-primary">{format(currentYear, "yyyy")}</span>
                <Button variant="outline" size="icon" onClick={() => setCurrentYear(addYears(currentYear, 1))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
             </div>
           </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card p-4 rounded-lg border">
                <p className="text-base font-medium text-muted-foreground">Total Commission Income:</p>
                <p className="text-2xl font-bold text-green-600">฿{yearlyReport.totalIncome.toFixed(2)}</p>
              </div>
              <div className="bg-card p-4 rounded-lg border">
                <p className="text-base font-medium text-muted-foreground">Total Expenses:</p>
                <p className="text-2xl font-bold text-red-600">฿{yearlyReport.totalExpenses.toFixed(2)}</p>
              </div>
              <div className="bg-card p-4 rounded-lg border">
                <p className="text-base font-medium text-muted-foreground">Profit After Down Payment:</p>
                <p className={`text-2xl font-bold ${yearlyReport.netProfitAfterDP >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>฿{yearlyReport.netProfitAfterDP.toFixed(2)}</p>
              </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
