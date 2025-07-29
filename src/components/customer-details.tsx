
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
    customerName: string;
    sales: Sale[];
    onEditSale: (sale: Sale) => void;
    onDeleteSale: (sale: Sale) => void;
    onRecordPayment: (saleId: string, amount: number, date: string) => void;
    onEditPayment: (saleId: string, month: number, amount: number, date: string) => void;
}

export default function CustomerDetails({ customerName, sales, onEditSale, onDeleteSale, onRecordPayment, onEditPayment }: CustomerDetailsProps) {
    const [openSaleId, setOpenSaleId] = React.useState<string | null>(null);
    const [receiptData, setReceiptData] = React.useState<Sale | null>(null);
    const [showReceipt, setShowReceipt] = React.useState(false);
    
    return (
        <Card className="bg-slate-800/30 border-slate-700">
            <CardHeader>
                <CardTitle className="text-xl text-cyan-300">{customerName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {sales.map(sale => (
                    <div key={sale.id} className="border border-slate-600 rounded-lg overflow-hidden">
                        <div className="p-4 bg-slate-700/50 flex justify-between items-center">
                           <div>
                                <h4 className="font-semibold">{sale.gadget} ({sale.pieces} pcs)</h4>
                                <p className="text-sm text-muted-foreground">
                                    Total: ฿{sale.totalAmountDue?.toFixed(2) || '0.00'} | Balance: ฿{sale.remainingBalance?.toFixed(2) || '0.00'}
                                </p>
                                <Badge variant={sale.paymentInstallments?.every(p => p.isPaid) ? "default" : "secondary"} className="mt-1">
                                  {sale.paymentInstallments?.every(p => p.isPaid) ? "Paid" : "Ongoing"}
                                </Badge>
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
                                  <Button variant="ghost" size="icon" onClick={() => setOpenSaleId(openSaleId === sale.id ? null : sale.id)}>
                                    <ChevronDown className={`h-4 w-4 transition-transform ${openSaleId === sale.id ? 'rotate-180' : ''}`} />
                                  </Button>
                           </div>
                        </div>
                        {openSaleId === sale.id && (
                           <div className="p-4">
                             <PaymentRecorder sale={sale} onRecordPayment={onRecordPayment} onEditPayment={onEditPayment} />
                           </div>
                        )}
                    </div>
                ))}
            </CardContent>
            <CustomerReceipt saleData={receiptData} isOpen={showReceipt} onClose={() => setShowReceipt(false)} />
        </Card>
    );
}
