
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, deleteDoc, setDoc, getDocs, query, orderBy, writeBatch } from "firebase/firestore";
import CommissionForm from "./commission-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Commission, Sale, YearlyReport } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, ChevronLeft, ChevronRight, Search, Archive, History, FileX2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths, parseISO, startOfYear, endOfYear, addYears, subYears } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CommissionsSectionProps {
  commissions: Commission[];
  sales: Sale[];
  loading: boolean;
  onDataChange: () => void;
  userRole: 'admin' | 'guest';
}

export default function CommissionsSection({ commissions, sales, loading, onDataChange, userRole }: CommissionsSectionProps) {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentYear, setCurrentYear] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [showCommissionForm, setShowCommissionForm] = useState(false);
  const [archivedReports, setArchivedReports] = useState<YearlyReport[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);

  const fetchArchivedReports = useCallback(async () => {
    if (!db) return;
    try {
      const reportsRef = collection(db, "yearlyReports");
      const q = query(reportsRef, orderBy("year", "desc"));
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(doc => doc.data() as YearlyReport);
      setArchivedReports(reports);
    } catch (e: any) {
      console.error("Error fetching archived reports:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Could not fetch archived reports: ${e.message}`,
      });
    }
  }, [db, toast]);

  useEffect(() => {
    fetchArchivedReports();
  }, [db, fetchArchivedReports]);


  const monthlyCommissions = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    const searchedCommissions = searchTerm
      ? commissions.filter(c => c.description.toLowerCase().includes(searchTerm.toLowerCase()))
      : commissions;

    const monthlyLedgerEntries = searchedCommissions.filter(c => {
      try {
        const commissionDate = parseISO(c.date);
        return isWithinInterval(commissionDate, { start, end });
      } catch (e) {
        return false;
      }
    });

    return monthlyLedgerEntries.sort((a, b) => {
       try {
         return new Date(b.date).getTime() - new Date(a.date).getTime()
       } catch(e) {
         return 0;
       }
    });

  }, [commissions, currentMonth, searchTerm]);
  
  const yearlyReport = useMemo(() => {
    const year = currentYear.getFullYear();

    const yearlyLedgerEntries = commissions.filter(c => {
        try {
            return parseISO(c.date).getFullYear() === year;
        } catch(e) {
            return false;
        }
    });

    const yearlySales = sales.filter(s => {
        try {
            return parseISO(s.dateStart).getFullYear() === year;
        } catch(e) {
            return false;
        }
    });
    
    const totalYearlyLedgerExpenses = yearlyLedgerEntries
      .reduce((acc, item) => acc + (item.spentAmount || 0), 0);
      
    const totalYearlyManualIncome = yearlyLedgerEntries
      .filter(item => !item.saleId) // Only include income not tied to a sale
      .reduce((acc, item) => acc + (item.getAmount || 0), 0);
      
    const totalYearlyCommissionFromSales = yearlySales.reduce((acc, sale) => acc + (sale.commission || 0), 0);
    
    const totalCombinedCommission = totalYearlyCommissionFromSales + totalYearlyManualIncome;

    const netYearlyIncome = totalCombinedCommission - totalYearlyLedgerExpenses;

    const totalDownPayments = yearlySales.reduce((acc, sale) => acc + (sale.downPayment || 0), 0);
  
    return {
      year,
      totalExpenses: totalYearlyLedgerExpenses,
      netYearlyIncome: netYearlyIncome,
      totalDownPayments: totalDownPayments,
      totalCommission: totalCombinedCommission,
    };
  }, [commissions, sales, currentYear]);


  const handleSaveCommission = async (commissionData: Omit<Commission, 'id' | 'runningTotal'>) => {
    if (!db || userRole === 'guest') {
        if(userRole === 'guest') toast({ variant: "destructive", title: "Read-only Access", description: "Guests cannot save ledger entries." });
        return;
    }
    try {
      await addDoc(collection(db, "commissions"), commissionData);
      toast({ title: "Success", description: "Entry added successfully!" });
      setShowCommissionForm(false);
      onDataChange();
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
    if (!db || userRole === 'guest') {
        if(userRole === 'guest') toast({ variant: "destructive", title: "Read-only Access", description: "Guests cannot delete ledger entries." });
        return;
    }

    try {
      await deleteDoc(doc(db, "commissions", id));
      toast({ title: "Success", description: "Entry deleted successfully!" });
      onDataChange();
    } catch (e: any) {
      console.error("Error deleting commission:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error deleting entry: ${e.message}`,
      });
    }
  };

  const handleArchiveYear = async () => {
    if (!db || userRole === 'guest') {
        if(userRole === 'guest') toast({ variant: "destructive", title: "Read-only Access", description: "Guests cannot archive data." });
        return;
    }
    setIsArchiving(true);
    try {
      const year = currentYear.getFullYear();
      const reportRef = doc(db, "yearlyReports", String(year));
      await setDoc(reportRef, yearlyReport);

      const start = startOfYear(currentYear);
      const end = endOfYear(currentYear);

      const commissionsToArchive = commissions.filter(c => {
        try {
            const commissionDate = parseISO(c.date);
            return isWithinInterval(commissionDate, { start, end });
        } catch (e) { return false; }
      });
      
      const salesToArchive = sales.filter(s => {
        try {
            const saleDate = parseISO(s.dateStart);
            return isWithinInterval(saleDate, { start, end });
        } catch (e) { return false; }
      });

      const batch = writeBatch(db);

      commissionsToArchive.forEach(c => {
        batch.delete(doc(db, "commissions", c.id));
      });
      salesToArchive.forEach(s => {
        batch.delete(doc(db, "sales", s.id));
      });
      
      await batch.commit();

      toast({
        title: "Year Archived",
        description: `The data for ${year} has been successfully archived.`,
      });

      onDataChange();
      fetchArchivedReports();
    } catch (e: any) {
      console.error("Error archiving year:", e);
      toast({
        variant: "destructive",
        title: "Archive Error",
        description: e.message || "An unknown error occurred during archiving.",
      });
    } finally {
      setIsArchiving(false);
    }
  };
  
  const handleRestoreReport = async (report: YearlyReport) => {
    toast({
        variant: "destructive",
        title: "Not Implemented",
        description: "Restoring archived data is not yet supported.",
    });
  }

  const changeMonth = (amount: number) => {
    setCurrentMonth(prev => addMonths(prev, amount));
  };
  
  const changeYear = (amount: number) => {
    setCurrentYear(prev => addYears(prev, amount));
  };

  const hasDataForCurrentYear = useMemo(() => {
    const year = currentYear.getFullYear();
    const hasCommissions = commissions.some(c => parseISO(c.date).getFullYear() === year);
    const hasSales = sales.some(s => parseISO(s.dateStart).getFullYear() === year);
    return hasCommissions || hasSales;
  }, [commissions, sales, currentYear]);

  if (showCommissionForm) {
    return <CommissionForm onSave={handleSaveCommission} onCancel={() => setShowCommissionForm(false)} />;
  }
  
  return (
    <div className="space-y-8">
      <Card className="bg-slate-800/30 backdrop-blur-sm border border-slate-700">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Commission & Expense Ledger</CardTitle>
                <p className="text-muted-foreground text-sm mt-1">Track all your income and expenses here.</p>
              </div>
              <Button onClick={() => setShowCommissionForm(true)} disabled={userRole === 'guest'}>
                  Add New Entry
              </Button>
          </div>
        </CardHeader>
        <CardContent>
            <div className="flex justify-between items-center mb-4">
              <Button variant="outline" size="icon" onClick={() => changeMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-xl font-bold text-center">
                {format(currentMonth, "MMMM yyyy")}
              </div>
              <Button variant="outline" size="icon" onClick={() => changeMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search descriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : monthlyCommissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right text-green-500">Income (฿)</TableHead>
                  <TableHead className="text-right text-red-500">Expense (฿)</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyCommissions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{format(parseISO(item.date), "MMM dd")}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right font-medium text-green-500">
                      {item.getAmount > 0 ? item.getAmount.toFixed(2) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-500">
                      {item.spentAmount > 0 ? item.spentAmount.toFixed(2) : "-"}
                    </TableCell>
                     <TableCell className="text-center">
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={userRole === 'guest'}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This action will permanently delete the ledger entry. This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCommission(item.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            ) : (
                <p className="text-center py-8 text-muted-foreground">
                    No ledger entries for {format(currentMonth, "MMMM yyyy")}.
                </p>
            )}
        </CardContent>
      </Card>
      
      <Card className="bg-slate-800/30 backdrop-blur-sm border border-slate-700">
        <CardHeader>
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Yearly Financial Report</CardTitle>
              <p className="text-muted-foreground text-sm mt-1">Summary of income, expenses, and net profit for the selected year.</p>
            </div>
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isArchiving || !hasDataForCurrentYear || userRole === 'guest'}>
                    <Archive className="mr-2 h-4 w-4"/>
                    {isArchiving ? "Archiving..." : `Archive ${currentYear.getFullYear()} Data`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Archive {currentYear.getFullYear()} Data?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete all sales and ledger entries for {currentYear.getFullYear()} and save a summary report. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleArchiveYear} className="bg-destructive hover:bg-destructive/90">
                        {isArchiving ? "Archiving..." : "Yes, Archive"}
                    </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <Button variant="outline" size="icon" onClick={() => changeYear(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-2xl font-bold">{yearlyReport.year}</h3>
            <Button variant="outline" size="icon" onClick={() => changeYear(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Commission</p>
              <p className="text-2xl font-bold text-green-500">฿{yearlyReport.totalCommission.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-red-500">฿{yearlyReport.totalExpenses.toFixed(2)}</p>
            </div>
             <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Down Payments</p>
              <p className="text-2xl font-bold text-blue-500">฿{yearlyReport.totalDownPayments.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm font-bold text-primary">Net Yearly Income</p>
              <p className="text-2xl font-extrabold text-primary">฿{yearlyReport.netYearlyIncome.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
       <Card className="bg-slate-800/30 backdrop-blur-sm border border-slate-700">
        <CardHeader>
            <CardTitle>Archived Reports</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">View summaries of previously archived years.</p>
        </CardHeader>
        <CardContent>
             {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                </div>
            ) : archivedReports.length > 0 ? (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead className="text-right">Net Income (฿)</TableHead>
                        <TableHead className="text-right">Total Commission (฿)</TableHead>
                        <TableHead className="text-right">Total Expenses (฿)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {archivedReports.map((report) => (
                        <TableRow key={report.year}>
                            <TableCell className="font-bold">{report.year}</TableCell>
                            <TableCell className="text-right font-bold text-primary">฿{report.netYearlyIncome.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-green-500">฿{report.totalCommission.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-red-500">฿{report.totalExpenses.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                               <Button variant="outline" size="sm" onClick={() => handleRestoreReport(report)} disabled>
                                    <History className="mr-2 h-4 w-4" />
                                    Restore
                               </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
             ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <FileX2 className="mx-auto h-12 w-12 mb-4" />
                    <p className="text-lg">No archived reports found.</p>
                </div>
            )}
        </CardContent>
       </Card>
    </div>
  );
}
