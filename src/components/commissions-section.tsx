
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, deleteDoc, setDoc, getDocs, query, orderBy } from "firebase/firestore";
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
}

export default function CommissionsSection({ commissions, sales, loading, onDataChange }: CommissionsSectionProps) {
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
  }, [fetchArchivedReports]);


  const monthlyCommissions = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const monthlyLedgerEntries = commissions.filter(c => {
        try {
            const commissionDate = parseISO(c.date);
            return isWithinInterval(commissionDate, { start, end });
        } catch (e) {
            return false;
        }
    });

    const filteredBySearch = (searchTerm
        ? commissions.filter(c => c.description.toLowerCase().includes(searchTerm.toLowerCase()))
        : monthlyLedgerEntries
    ).sort((a, b) => {
       try {
         return new Date(b.date).getTime() - new Date(a.date).getTime()
       } catch(e) {
         return 0;
       }
    });


    let runningTotal = 0;
    
    const allCommissionsSorted = [...commissions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const runningTotalMap = new Map<string, number>();
    allCommissionsSorted.forEach(item => {
        const getAmount = item.getAmount || 0;
        const spentAmount = item.spentAmount || 0;
        runningTotal += getAmount - spentAmount;
        runningTotalMap.set(item.id, runningTotal);
    })

    const commissionsWithTotal = filteredBySearch.map(item => {
      return { ...item, runningTotal: runningTotalMap.get(item.id) || 0 };
    });

    return commissionsWithTotal;
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
    
    const totalYearlyManualExpenses = yearlyLedgerEntries
      .reduce((acc, item) => acc + (item.spentAmount || 0), 0);
      
    const totalYearlyIncome = yearlyLedgerEntries
      .reduce((acc, item) => acc + (item.getAmount || 0), 0);
      
    const netYearlyIncome = totalYearlyIncome - totalYearlyManualExpenses;

    const totalDownPayments = yearlySales.reduce((acc, sale) => acc + (sale.downPayment || 0), 0);
  
    return {
      year,
      totalExpenses: totalYearlyManualExpenses,
      totalIncome: totalYearlyIncome,
      netYearlyIncome: netYearlyIncome,
      totalDownPayments: totalDownPayments,
    };
  }, [commissions, sales, currentYear]);


  const handleSaveCommission = async (commissionData: Omit<Commission, 'id' | 'runningTotal'>) => {
    if (!db) return;
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
    if (!db) return;

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

  const handleArchiveReport = async () => {
    if (!db) return;
    setIsArchiving(true);
    try {
      const reportId = String(yearlyReport.year);
      const reportRef = doc(db, "yearlyReports", reportId);
      await setDoc(reportRef, yearlyReport);

      toast({
        title: "Report Archived!",
        description: `The report for ${yearlyReport.year} has been successfully saved.`,
      });
      fetchArchivedReports(); 
    } catch (e: any) {
      console.error("Error archiving report:", e);
      toast({
        variant: "destructive",
        title: "Archive Error",
        description: `Could not archive the report: ${e.message}`,
      });
    } finally {
      setIsArchiving(false);
    }
  }

  const handleDeleteArchive = async (year: number) => {
     if (!db) return;
    try {
      const reportId = String(year);
      await deleteDoc(doc(db, "yearlyReports", reportId));
      toast({
        title: "Archive Deleted",
        description: `The archived report for ${year} has been deleted.`,
      });
      fetchArchivedReports();
    } catch (e: any) {
      console.error("Error deleting archive:", e);
      toast({
        variant: "destructive",
        title: "Deletion Error",
        description: `Could not delete the archived report: ${e.message}`,
      });
    }
  };


  const isReportArchived = archivedReports.some(r => r.year === yearlyReport.year);


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
           <div className="flex justify-between items-center">
             <CardTitle>Sales Report</CardTitle>
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
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col bg-muted p-4 rounded-lg h-full">
                <p className="text-sm text-muted-foreground text-center">Total Yearly Income (from Ledger):</p>
                <p className={`text-2xl font-bold mt-auto text-center text-green-600`}>฿{yearlyReport.totalIncome.toFixed(2)}</p>
              </div>
              <div className="flex flex-col bg-muted p-4 rounded-lg h-full">
                <p className="text-sm text-muted-foreground text-center">Total Yearly Expenses (from Ledger):</p>
                <p className="text-2xl font-bold mt-auto text-center text-red-600">฿{yearlyReport.totalExpenses.toFixed(2)}</p>
              </div>
              <div className="flex flex-col bg-muted p-4 rounded-lg h-full">
                <p className="text-sm text-muted-foreground text-center">Net Income (Total Income - Total Expenses):</p>
                <p className={`text-2xl font-bold mt-auto text-center ${yearlyReport.netYearlyIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>฿{yearlyReport.netYearlyIncome.toFixed(2)}</p>
              </div>
              <div className="flex flex-col bg-muted p-4 rounded-lg h-full">
                <p className="text-sm text-muted-foreground text-center">Total Down Payments (from Sales):</p>
                <p className={`text-2xl font-bold mt-auto text-center text-yellow-500`}>฿{yearlyReport.totalDownPayments.toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-2">
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button disabled={isArchiving || isReportArchived}>
                           <Archive className="mr-2 h-4 w-4" />
                           {isReportArchived ? `Report for ${yearlyReport.year} is Archived` : `Finalize & Archive ${yearlyReport.year} Report`}
                         </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Finalize Yearly Report?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will save a permanent record of the {yearlyReport.year} report. You will not be able to change it after archiving.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchiveReport}>
                            Yes, Archive Report
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                 {isReportArchived && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isArchiving}>
                                <FileX2 className="mr-2 h-4 w-4" />
                                Delete Archive
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Delete Archived Report?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete the archived report for {yearlyReport.year}? This action cannot be undone.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteArchive(yearlyReport.year)} className="bg-destructive hover:bg-destructive/90">
                                Yes, Delete Archive
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
             <div className="flex justify-between items-center">
                <CardTitle>Archived Yearly Reports</CardTitle>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                           <History className="mr-2 h-4 w-4"/>
                           View Archives
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {loading && <DropdownMenuItem>Loading...</DropdownMenuItem>}
                        {!loading && archivedReports.length === 0 && <DropdownMenuItem>No archived reports yet.</DropdownMenuItem>}
                        {archivedReports.map(report => (
                             <DropdownMenuItem key={report.year} onSelect={() => setCurrentYear(new Date(report.year, 1, 1))}>
                                {report.year} Report
                             </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
             </div>
          </CardHeader>
      </Card>
    </div>
  );
}


    
