"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Commission } from "@/types";

const commissionSchema = z.object({
  date: z.string().min(1, "Date is required."),
  description: z.string().min(1, "Description is required."),
  getAmount: z.coerce.number().min(0),
  spentAmount: z.coerce.number().min(0),
});

type CommissionFormValues = z.infer<typeof commissionSchema>;

interface CommissionFormProps {
  onSave: (data: CommissionFormValues) => void;
  initialData?: Commission | null;
  onCancel: () => void;
}

export default function CommissionForm({ onSave, initialData, onCancel }: CommissionFormProps) {
  const form = useForm<CommissionFormValues>({
    resolver: zodResolver(commissionSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      description: "",
      getAmount: 0,
      spentAmount: 0,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        date: initialData.date || new Date().toISOString().split("T")[0],
      });
    } else {
      form.reset({
        date: new Date().toISOString().split("T")[0],
        description: "",
        getAmount: 0,
        spentAmount: 0,
      });
    }
  }, [initialData, form]);

  const handleSubmit = (values: CommissionFormValues) => {
    onSave(values);
    form.reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? "Edit Ledger Entry" : "Add New Ledger Entry"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Commission from sale" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="getAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Income (฿)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="spentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expense (฿)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              {initialData && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onCancel();
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit">
                {initialData ? "Update Entry" : "Add Entry"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
