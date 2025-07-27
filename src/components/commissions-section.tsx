"use client";

import { useState, useEffect } from "react";
import { useFirebase } from "@/lib/firebase/context";
import { collection, addDoc, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import CommissionForm from "./commission-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Commission } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2 } from "lucide-react";

export default function CommissionsSection() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    if (!db) return;

    const commissionsCollectionRef = collection(db, "commissions");
    const q = query(commissionsCollectionRef, orderBy("date"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commissionsData: Commission[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Commission[];

      commissionsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let currentTotal = 0;
      let incomeSum = 0;
      let expenseSum = 0;

      const commissionsWithTotal = commissionsData.map(item => {
        const getAmount = item.getAmount || 0;
        const spentAmount = item.spentAmount || 0;
        currentTotal += getAmount - spentAmount;
        incomeSum += getAmount;
        expenseSum += spentAmount;
        return { ...item, runningTotal: currentTotal };
      });

      setCommissions(commissionsWithTotal);
      setTotalIncome(incomeSum);
      setTotalExpenses(expenseSum);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching commissions:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load commissions data.",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, toast]);

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
    } catch (e) {
      console.error("Error saving commission:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error saving entry. Please try again.",
      });
    }
  };

  const handleDeleteCommission = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "commissions", id));
      toast({ title: "Success", description: "Entry deleted successfully!" });
    } catch (e) {
      console.error("Error deleting commission:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error deleting entry. Please try again.",
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
          <CardTitle className="text-xl font-bold text-gray-700">Ledger Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : commissions.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-lg">No ledger entries found. Add one above!</p>
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
                  {commissions.map((item) => (
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
          <CardTitle className="text-xl font-bold text-primary">Overall Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card p-4 rounded-lg border">
              <p className="text-base font-medium text-muted-foreground">Total Income:</p>
              <p className="text-2xl font-bold text-green-600">฿{totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <p className="text-base font-medium text-muted-foreground">Total Expenses:</p>
              <p className="text-2xl font-bold text-red-600">฿{totalExpenses.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
