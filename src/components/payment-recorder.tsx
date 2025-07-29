"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Sale, Installment } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Edit } from 'lucide-react';

interface PaymentRecorderProps {
  sale: Sale;
  onRecordPayment: (saleId: string, amount: number, date: string) => void;
  onEditPayment: (saleId: string, month: number, amount: number, date: string) => void;
}

export default function PaymentRecorder({ sale, onRecordPayment, onEditPayment }: PaymentRecorderProps) {
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDateWarning, setIsDateWarning] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [editedAmount, setEditedAmount] = useState('');
  const [editedDate, setEditedDate] = useState('');
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
    
    onRecordPayment(sale.id, amount, paymentDate);
    setAmountPaid('');
  };

  const handleEditClick = (installment: Installment) => {
    setEditingInstallment(installment);
    setEditedAmount(String(installment.paidAmount));
    setEditedDate(installment.lastPaymentDate || '');
  };

  const handleSaveEdit = () => {
    if (!editingInstallment) return;

    const amount = parseFloat(editedAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount.' });
      return;
    }
    if (!editedDate) {
      toast({ variant: 'destructive', title: 'Invalid Date', description: 'Please select a payment date.' });
      return;
    }

    onEditPayment(sale.id, editingInstallment.month, amount, editedDate);
    setEditingInstallment(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Record Payment for {sale.gadget}</CardTitle>
          <CardDescription>Manage payments and track balances for this installment plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Due</p>
              <p className="text-lg font-bold">฿{sale.totalAmountDue?.toFixed(2)}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-lg font-bold text-green-600">฿{sale.totalPaidAmount?.toFixed(2)}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="text-lg font-bold text-red-600">฿{sale.remainingBalance?.toFixed(2)}</p>
            </div>
          </div>
          
          {sale.customerNote && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h5 className="text-sm font-semibold text-blue-800 mb-1">Customer Note:</h5>
              <p className="text-sm text-blue-700 whitespace-pre-wrap">{sale.customerNote}</p>
            </div>
          )}

          <div>
            <h5 className="text-sm font-semibold mb-2">Installment Status</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {sale.paymentInstallments?.map((inst) => (
                <div key={inst.month} className={`relative p-2 rounded-md text-xs font-semibold ${inst.isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  <p>Month {inst.month}</p>
                  <p className="font-bold">฿{inst.paidAmount.toFixed(2)}</p>
                  {inst.isPaid ? (
                    <span>({inst.lastPaymentDate || 'Paid'})</span>
                  ) : (
                    <span>of ฿{inst.dueAmount.toFixed(2)}</span>
                  )}
                  {inst.paidAmount > 0 && (
                    <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => handleEditClick(inst)}>
                        <Edit className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-end gap-2">
            <div className="flex-grow">
              <label htmlFor={`amount-${sale.id}`} className="text-sm font-medium">Amount (฿)</label>
              <Input id={`amount-${sale.id}`} type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" step="0.01" />
            </div>
            <div className="flex-grow">
              <label htmlFor={`date-${sale.id}`} className="text-sm font-medium">Payment Date</label>
              <Input id={`date-${sale.id}`} type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
            <Button type="submit">Record Payment</Button>
          </form>
          {isDateWarning && <p className="text-red-500 text-xs text-center">A payment has already been recorded for this date.</p>}

        </CardContent>
      </Card>

      <Dialog open={!!editingInstallment} onOpenChange={() => setEditingInstallment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment for Month {editingInstallment?.month}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Paid Amount (฿)</Label>
              <Input
                id="edit-amount"
                type="number"
                value={editedAmount}
                onChange={(e) => setEditedAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Payment Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editedDate}
                onChange={(e) => setEditedDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
 