
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, orderBy, query, where, limit } from "firebase/firestore";
import CommissionForm from "./commission-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Commission, Sale } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths, parseISO, startOfYear, endOfYear, addYears, subYears } from "date-fns";
import { Input } from "@/components/ui/input";

export default function CommissionsSection() {
  const { db, user } = useFirebase();
  const { toast } = useToast();
  const [allCommissions, setAllCommissions] = useState<Commission[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentYear, setCurrentYear] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [showCommissionForm, setShowCommissionForm] = useState(false);

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

  const { monthlyCommissions, totalExpenses, netProfitAfterDP, netMonthlyIncome } = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const monthlyLedgerEntries = allCommissions.filter(c => {
        const commissionDate = parseISO(c.date);
        return isWithinInterval(commissionDate, { start, end });
    });

    const filteredBySearch = (searchTerm
        ? allCommissions.filter(c => c.description.toLowerCase().includes(searchTerm.toLowerCase()))
        : monthlyLedgerEntries
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


    let runningTotal = 0;
    
    const commissionsWithTotal = filteredBySearch.map(item => {
      const getAmount = item.getAmount || 0;
      const spentAmount = item.spentAmount || 0;
      runningTotal += getAmount - spentAmount;
      return { ...item, runningTotal };
    });
    
    const manualIncome = monthlyLedgerEntries.reduce((acc, item) => acc + (item.getAmount || 0), 0);
    const manualExpenses = monthlyLedgerEntries.reduce((acc, item) => acc + (item.spentAmount || 0), 0);
    
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

    const commissionIncomeFromSales = fullyPaidSalesThisMonth.reduce((acc, sale) => acc + sale.commission, 0);
    const shippingCostFromSales = fullyPaidSalesThisMonth.reduce((acc, sale) => acc + (sale.shippingCost || 0), 0);

    const totalMonthlyIncome = manualIncome + commissionIncomeFromSales;
    const totalMonthlyExpenses = manualExpenses + shippingCostFromSales;


    const profitAfterDP = fullyPaidSalesThisMonth.reduce((acc, sale) => {
      // Net Profit for a sale = Commission - Down Payment
      return acc + (sale.commission - sale.downPayment);
    }, 0);


    return {
      monthlyCommissions: commissionsWithTotal,
      totalExpenses: totalMonthlyExpenses,
      netProfitAfterDP: profitAfterDP,
      netMonthlyIncome: totalMonthlyIncome - totalMonthlyExpenses,
    };
  }, [allCommissions, sales, currentMonth, searchTerm]);
  
  const yearlyReport = useMemo(() => {
    const start = startOfYear(currentYear);
    const end = endOfYear(currentYear);
    
    const yearlyLedgerEntries = allCommissions
      .filter(c => isWithinInterval(parseISO(c.date), { start, end }));

    const yearlyManualIncome = yearlyLedgerEntries.reduce((acc, item) => acc + (item.getAmount || 0), 0);
    
    const salesThisYear = sales.filter(sale => isWithinInterval(parseISO(sale.dateStart), { start, end }));
    const yearlyShippingCosts = salesThisYear.reduce((acc, sale) => acc + (sale.shippingCost || 0), 0);

    const totalYearlyExpenses = yearlyShippingCosts;
      
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

    const yearlyCommissionIncomeFromSales = fullyPaidSalesThisYear.reduce((acc, sale) => acc + sale.commission, 0);
    const totalYearlyIncome = yearlyManualIncome + yearlyCommissionIncomeFromSales;

    const yearlyNetProfitAfterDP = fullyPaidSalesThisYear.reduce((acc, sale) => {
      return acc + (sale.commission - sale.downPayment);
    }, 0);


    return {
      totalIncome: totalYearlyIncome,
      totalExpenses: totalYearlyExpenses,
      netProfitAfterDP: yearlyNetProfitAfterDP,
      netYearlyIncome: totalYearlyIncome - totalYearlyExpenses,
    }
  }, [allCommissions, sales, currentYear]);


  const handleSaveCommission = async (commissionData: Omit<Commission, 'id' | 'runningTotal'>) => {
    if (!db) return;
    try {
      await addDoc(collection(db, "commissions"), commissionData);
      toast({ title: "Success", description: "Entry added successfully!" });
      setShowCommissionForm(false);
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
      {showCommissionForm ? (
        <CommissionForm
          onSave={handleSaveCommission}
          onCancel={() => setShowCommissionForm(false)}
        />
      ) : (
         <div className="text-center py-4">
          <Button onClick={() => setShowCommissionForm(true)} size="lg">
             Add Manual Ledger Entry
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
           <div className="flex justify-between items-center mb-4">
             <CardTitle>Monthly Ledger</CardTitle>
             <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</span>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
             </div>
           </div>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                placeholder="Search by description across all months..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
                />
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
            <p className="text-center text-muted-foreground py-8">{searchTerm ? 'No matching entries found.' : 'No ledger entries for this month. Add one above!'}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Income (฿)</TableHead>
                  <TableHead className="text-right">Expense (฿)</TableHead>
                  <TableHead className="text-right">Running Total (฿)</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyCommissions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.date}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{item.getAmount?.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">{item.spentAmount?.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{item.runningTotal?.toFixed(2)}</TableCell>
                    <TableCell>
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
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Monthly Financial Summary for {format(currentMonth, "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Net Income (Total Income - Expenses):</p>
              <p className={`text-2xl font-bold ${netMonthlyIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>฿{netMonthlyIncome.toFixed(2)}</p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Expenses (incl. Shipping):</p>
              <p className="text-2xl font-bold text-red-600">฿{totalExpenses.toFixed(2)}</p>
            </div>
             <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Profit After Down Payment (from sales):</p>
              <p className={`text-2xl font-bold ${netProfitAfterDP >= 0 ? 'text-green-600' : 'text-red-600'}`}>฿{netProfitAfterDP.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
           <div className="flex justify-between items-center">
             <CardTitle>Yearly Report</CardTitle>
             <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => setCurrentYear(subYears(currentYear, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold">{format(currentYear, "yyyy")}</span>
                <Button variant="outline" size="icon" onClick={() => setCurrentYear(addYears(currentYear, 1))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
             </div>
           </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Net Income (Total Income - Expenses):</p>
                <p className={`text-2xl font-bold ${yearlyReport.netYearlyIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>฿{yearlyReport.netYearlyIncome.toFixed(2)}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Expenses (incl. Shipping):</p>
                <p className="text-2xl font-bold text-red-600">฿{yearlyReport.totalExpenses.toFixed(2)}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Profit After Down Payment (from sales):</p>
                <p className={`text-2xl font-bold ${yearlyReport.netProfitAfterDP >= 0 ? 'text-green-600' : 'text-red-600'}`}>฿{yearlyReport.netProfitAfterDP.toFixed(2)}</p>
              </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
