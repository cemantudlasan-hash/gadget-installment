"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { Sale } from "@/types";
import { suggestCustomerNote } from "@/ai/flows/customer-note-suggestions";
import { Sparkles, Loader2 } from "lucide-react";

const saleSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  gadget: z.string().min(1, "Gadget name is required"),
  pieces: z.coerce.number().int().min(1),
  buyPrice: z.coerce.number().min(0),
  sellPrice: z.coerce.number().min(1, "Sell price must be greater than 0"),
  shippingCost: z.coerce.number().min(0),
  dateStart: z.string().min(1, "Start date is required"),
  downPayment: z.coerce.number().min(0),
  numberOfInstallments: z.coerce.number().int(),
  paymentType: z.string().optional(),
  typeOfCard: z.string().optional(),
  passportID: z.string().optional(),
  customerNote: z.string().optional(),
});

type SaleFormValues = z.infer<typeof saleSchema>;

interface SalesFormProps {
  onSave: (data: Omit<Sale, "id">) => void;
  initialData?: Sale | null;
  onCancel: () => void;
}

export default function SalesForm({ onSave, initialData, onCancel }: SalesFormProps) {
  const { toast } = useToast();
  const [isSuggestingNote, setIsSuggestingNote] = useState(false);
  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      customerName: "",
      gadget: "",
      pieces: 1,
      buyPrice: 0,
      sellPrice: 0,
      shippingCost: 0,
      dateStart: new Date().toISOString().split("T")[0],
      downPayment: 0,
      numberOfInstallments: 6,
      paymentType: "",
      typeOfCard: "",
      passportID: "",
      customerNote: "",
    },
  });

  const watchedValues = form.watch();

  const calculatedMonthly = (watchedValues.sellPrice - watchedValues.downPayment) / watchedValues.numberOfInstallments;
  const calculatedCommission = watchedValues.sellPrice - watchedValues.buyPrice - watchedValues.shippingCost;
  const calculatedTotalAmountDue = watchedValues.sellPrice - watchedValues.downPayment;

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        dateStart: initialData.dateStart || new Date().toISOString().split("T")[0],
      });
    } else {
      form.reset({
        customerName: "",
        gadget: "",
        pieces: 1,
        buyPrice: 0,
        sellPrice: 0,
        shippingCost: 0,
        dateStart: new Date().toISOString().split("T")[0],
        downPayment: 0,
        numberOfInstallments: 6,
        paymentType: "",
        typeOfCard: "",
        passportID: "",
        customerNote: "",
      });
    }
  }, [initialData, form]);

  const handleSuggestNote = async () => {
    const passportID = form.getValues("passportID");
    if (!passportID) {
      toast({
        variant: "destructive",
        title: "Missing Passport ID",
        description: "Please enter a Passport ID to get a suggestion.",
      });
      return;
    }

    setIsSuggestingNote(true);
    try {
      const result = await suggestCustomerNote({ passportID });
      if (result.note) {
        form.setValue("customerNote", result.note);
        toast({ title: "Suggestion added!", description: "AI-powered note has been added." });
      }
    } catch (error) {
      console.error("Error suggesting note:", error);
      toast({ variant: "destructive", title: "AI Error", description: "Could not generate a suggestion." });
    } finally {
      setIsSuggestingNote(false);
    }
  };

  const handleSubmit = (values: SaleFormValues) => {
    const paymentInstallments = Array.from({ length: values.numberOfInstallments }, (_, i) => {
        const existing = initialData?.paymentInstallments?.[i];
        return {
            month: i + 1,
            dueAmount: isFinite(calculatedMonthly) ? calculatedMonthly : 0,
            paidAmount: existing?.paidAmount || 0,
            isPaid: existing?.isPaid || false,
            lastPaymentDate: existing?.lastPaymentDate || null,
        }
    });
    
    const totalPaidAmount = paymentInstallments.reduce((acc, inst) => acc + inst.paidAmount, 0);

    const saleData: Omit<Sale, "id"> = {
      ...values,
      monthlyPayment: isFinite(calculatedMonthly) ? calculatedMonthly : 0,
      commission: isFinite(calculatedCommission) ? calculatedCommission : 0,
      totalAmountDue: isFinite(calculatedTotalAmountDue) ? calculatedTotalAmountDue : 0,
      totalPaidAmount,
      remainingBalance: (isFinite(calculatedTotalAmountDue) ? calculatedTotalAmountDue : 0) - totalPaidAmount,
      paymentInstallments,
    };
    onSave(saleData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? "Edit Installment Plan" : "Add New Installment Plan"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField name="customerName" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Customer Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="gadget" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Gadget</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField name="pieces" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Pieces</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="buyPrice" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Buy Price (฿)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="sellPrice" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Sell Price (฿)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="shippingCost" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Shipping Cost (฿)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="dateStart" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Date Start</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="downPayment" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Down Payment (฿)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="numberOfInstallments" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Number of Installments</FormLabel><Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select months" /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="3">3 Months</SelectItem><SelectItem value="6">6 Months</SelectItem><SelectItem value="10">10 Months</SelectItem><SelectItem value="12">12 Months</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
              )}/>
              <FormField name="paymentType" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Payment Type</FormLabel><FormControl><Input {...field} placeholder="e.g., Cash, Card" /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="typeOfCard" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Type of Card</FormLabel><FormControl><Input {...field} placeholder="e.g., Visa, Mastercard" /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="passportID" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Passport ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>
            
            <FormField name="customerNote" control={form.control} render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center justify-between">
                        <span>Customer Note/Reminders</span>
                        <Button type="button" variant="outline" size="sm" onClick={handleSuggestNote} disabled={isSuggestingNote}>
                            {isSuggestingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                            Suggest
                        </Button>
                    </FormLabel>
                    <FormControl><Textarea {...field} rows={3} placeholder="Add any important notes..." /></FormControl>
                    <FormMessage />
                </FormItem>
            )}/>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <Card><CardHeader><CardDescription>Monthly Payment (฿)</CardDescription><CardTitle>{isFinite(calculatedMonthly) ? calculatedMonthly.toFixed(2) : '0.00'}</CardTitle></CardHeader></Card>
              <Card><CardHeader><CardDescription>Commission (฿)</CardDescription><CardTitle className="text-green-600">{isFinite(calculatedCommission) ? calculatedCommission.toFixed(2) : '0.00'}</CardTitle></CardHeader></Card>
              <Card><CardHeader><CardDescription>Total Due (฿)</CardDescription><CardTitle className="text-red-600">{isFinite(calculatedTotalAmountDue) ? calculatedTotalAmountDue.toFixed(2) : '0.00'}</CardTitle></CardHeader></Card>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="submit">{initialData ? "Update Entry" : "Add Entry"}</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
