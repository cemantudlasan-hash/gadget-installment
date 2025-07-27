"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Sale } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface PaymentRecorderProps {
  sale: Sale;
  onRecordPayment: (saleId: string, amount: number, date: string) => void;
}

export default function PaymentRecorder({ sale, onRecordPayment }: PaymentRecorderProps) {
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDateWarning, setIsDateWarning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const dateUsed = sale.paymentInstallments.some(
      (inst) => inst.lastPaymentDate === paymentDate && inst.isPaid
    );
    setIsDateWarning(dateUsed);
  }, [paymentDate, sale.paymentInstallments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountPaid);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid positive amount.' });
      return;
    }
    if (isDateWarning) {
      toast({ variant: 'destructive', title: 'Date Conflict', description: 'A payment is already recorded for this date. To modify, please edit the main sale entry.' });
      return;
    }
    onRecordPayment(sale.id, amount, paymentDate);
    setAmountPaid('');
  };

  return (
    <Card className="bg-primary/5 border-primary/20 shadow-md rounded-xl">
      <CardHeader>
        <CardTitle className="text-lg">Record Payment for {sale.gadget}</CardTitle>
        <CardDescription>Manage payments and track balances for this installment plan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card p-3 rounded-lg border">
            <p className="text-sm font-medium text-muted-foreground">Total Due</p>
            <p className="text-lg font-bold text-foreground">฿{sale.totalAmountDue?.toFixed(2)}</p>
          </div>
          <div className="bg-card p-3 rounded-lg border">
            <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
            <p className="text-lg font-bold text-green-600">฿{sale.totalPaidAmount?.toFixed(2)}</p>
          </div>
          <div className="bg-card p-3 rounded-lg border">
            <p className="text-sm font-medium text-muted-foreground">Balance</p>
            <p className="text-lg font-bold text-red-600">฿{sale.remainingBalance?.toFixed(2)}</p>
          </div>
        </div>
        
        {sale.customerNote && (
          <div className="p-4 bg-blue-100 rounded-lg border border-blue-200">
            <h5 className="text-md font-semibold text-blue-800 mb-2">Customer Note:</h5>
            <p className="text-sm text-blue-700 whitespace-pre-wrap">{sale.customerNote}</p>
          </div>
        )}

        <div>
          <h5 className="text-md font-semibold text-foreground mb-3">Installment Status</h5>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {sale.paymentInstallments?.map((inst) => (
              <div key={inst.month} className={`p-3 rounded-lg text-center text-xs font-semibold ${inst.isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                <p className="text-sm">Month {inst.month}</p>
                <p className="font-bold">฿{inst.paidAmount.toFixed(2)}</p>
                {inst.isPaid ? (
                  <span className="text-xs">({inst.lastPaymentDate || 'Paid'})</span>
                ) : (
                  <span className="text-xs">of ฿{inst.dueAmount.toFixed(2)}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-grow">
            <label htmlFor={`amount-${sale.id}`} className="text-sm font-medium">Amount (฿)</label>
            <Input id={`amount-${sale.id}`} type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" step="0.01" />
          </div>
          <div className="flex-grow">
            <label htmlFor={`date-${sale.id}`} className="text-sm font-medium">Payment Date</label>
            <Input id={`date-${sale.id}`} type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <Button type="submit" disabled={isDateWarning} className="w-full sm:w-auto">Record Payment</Button>
        </form>
        {isDateWarning && <p className="text-destructive text-sm text-center">A payment has already been recorded for this date.</p>}

      </CardContent>
    </Card>
  );
}
