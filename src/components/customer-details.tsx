
"use client";

import * as React from 'react';
import type { Sale } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2, Receipt, ChevronDown } from "lucide-react";
import PaymentRecorder from './payment-recorder';
import CustomerReceipt from './customer-receipt';

interface CustomerDetailsProps {
    sale: Sale;
    isOpen: boolean;
    onToggle: () => void;
    onEditSale: (sale: Sale) => void;
    onDeleteSale: (sale: Sale) => void;
    onRecordPayment: (saleId: string, amount: number, date: string) => void;
    onEditPayment: (saleId: string, month: number, amount: number, date: string) => void;
}

export default function CustomerDetails({ sale, isOpen, onToggle, onEditSale, onDeleteSale, onRecordPayment, onEditPayment }: CustomerDetailsProps) {
    const [receiptData, setReceiptData] = React.useState<Sale | null>(null);
    const [showReceipt, setShowReceipt] = React.useState(false);
    
    return (
        <Card className="bg-slate-800/30 border-slate-700">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl text-cyan-300">{sale.customerName}</CardTitle>
                        <CardDescription>{sale.gadget} ({sale.pieces} pcs)</CardDescription>
                    </div>
                     <div className="flex items-center">
                        <Button variant="ghost" size="icon" onClick={() => onEditSale(sale)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { setReceiptData(sale); setShowReceipt(true); }}><Receipt className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the installment plan for {sale.gadget} and its associated financial records. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteSale(sale)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                          <Button variant="ghost" size="icon" onClick={onToggle}>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </Button>
                   </div>
                </div>
            </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center text-sm">
                        <p>
                            Total: ฿{sale.totalAmountDue?.toFixed(2) || '0.00'} | Balance: ฿{sale.remainingBalance?.toFixed(2) || '0.00'}
                        </p>
                        <Badge variant={sale.paymentInstallments?.every(p => p.isPaid) ? "default" : "secondary"} className="mt-1">
                          {sale.paymentInstallments?.every(p => p.isPaid) ? "Paid" : "Ongoing"}
                        </Badge>
                    </div>
                    {isOpen && (
                       <div className="pt-4">
                         <PaymentRecorder sale={sale} onRecordPayment={onRecordPayment} onEditPayment={onEditPayment} />
                       </div>
                    )}
                </CardContent>
            <CustomerReceipt saleData={receiptData} isOpen={showReceipt} onClose={() => setShowReceipt(false)} />
        </Card>
    );
}
