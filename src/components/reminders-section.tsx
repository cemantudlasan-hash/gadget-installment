
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Sale } from "@/types";
import { addMonths, differenceInMonths, endOfMonth, format, isAfter, isBefore, parseISO, startOfMonth } from "date-fns";
import { UserX } from "lucide-react";

interface RemindersSectionProps {
  sales: Sale[];
  loading: boolean;
}

interface OverdueCustomer {
  sale: Sale;
  dueDate: Date;
  monthlyPayment: number;
}

export default function RemindersSection({ sales, loading }: RemindersSectionProps) {
  const overdueCustomers = useMemo(() => {
    const today = new Date();
    const reminders: OverdueCustomer[] = [];

    // The logic checks for payments due from the end of the previous month up to the 5th of the current month.
    // Or if we are past the 5th, it checks for the current month's due payments.
    const lastDayOfLastMonth = endOfMonth(addMonths(today, -1));
    const fifthOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 5);

    sales.forEach((sale) => {
      // Skip fully paid sales
      if (sale.remainingBalance <= 0 || (sale.paymentInstallments?.every(p => p.isPaid))) {
        return;
      }

      const startDate = parseISO(sale.dateStart);
      
      sale.paymentInstallments?.forEach((inst, index) => {
        if (!inst.isPaid) {
          const dueDate = endOfMonth(addMonths(startDate, inst.month -1));

          // Has the due date passed?
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

    // Sort by due date, earliest first
    return reminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [sales]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Reminders</CardTitle>
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
                <TableHead>Due Date</TableHead>
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
  );
}
