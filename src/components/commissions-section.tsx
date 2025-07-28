
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, orderBy, query } from "firebase/firestore";
import CommissionForm from "./commission-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Commission } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths } from "date-fns";

export default function CommissionsSection() {
  const { db, user } = useFirebase();
  const { toast } = useToast();
  const [allCommissions, setAllCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const fetchCommissions = useCallback(async () => {
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
      fetchCommissions();
    }
  }, [user, fetchCommissions]);

  const { monthlyCommissions, totalIncome, totalExpenses, netProfit } = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const filteredLedgerEntries = allCommissions.filter(c => {
        const commissionDate = new Date(c.date);
        return isWithinInterval(commissionDate, { start, end });
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningTotal = 0;
    
    const commissionsWithTotal = filteredLedgerEntries.map(item => {
      const getAmount = item.getAmount || 0;
      const spentAmount = item.spentAmount || 0;
      runningTotal += getAmount - spentAmount;
      return { ...item, runningTotal };
    });
    
    const incomeSum = filteredLedgerEntries.reduce((acc, item) => {
        // Only include entries that are commissions or down payments in "Total Income"
        if (item.description.toLowerCase().includes('commission') || item.description.toLowerCase().includes('down payment')) {
            return acc + (item.getAmount || 0);
        }
        return acc;
    }, 0);

    const expenseSum = filteredLedgerEntries.reduce((acc, item) => acc + (item.spentAmount || 0), 0);
    const net = incomeSum - expenseSum;

    return {
      monthlyCommissions: commissionsWithTotal,
      totalIncome: incomeSum,
      totalExpenses: expenseSum,
      netProfit: net,
    };
  }, [allCommissions, currentMonth]);


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
      fetchCommissions();
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
      fetchCommissions();
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
          <CardTitle className="text-xl font-bold text-primary">Financial Summary for {format(currentMonth, "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card p-4 rounded-lg border">
              <p className="text-base font-medium text-muted-foreground">Total Income:</p>
              <p className="text-2xl font-bold text-green-600">฿{totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <p className="text-base font-medium text-muted-foreground">Total Expenses:</p>
              <p className="text-2xl font-bold text-red-600">฿{totalExpenses.toFixed(2)}</p>
            </div>
             <div className="bg-card p-4 rounded-lg border">
              <p className="text-base font-medium text-muted-foreground">Net Profit:</p>
              <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>฿{netProfit.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
