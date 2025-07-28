"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function PricingCalculator() {
  const [buyPrice, setBuyPrice] = useState(0);
  const [markupPercentage, setMarkupPercentage] = useState(20);
  const [downPaymentAmount, setDownPaymentAmount] = useState(0);

  const [sellPrice, setSellPrice] = useState(0);
  const [downPaymentPercentage, setDownPaymentPercentage] = useState(0);
  const [commission, setCommission] = useState(0);

  useEffect(() => {
    const calculatedSellPrice = buyPrice * (1 + markupPercentage / 100);
    const calculatedCommission = calculatedSellPrice - buyPrice;
    const calculatedDpPercent = calculatedSellPrice > 0 ? (downPaymentAmount / calculatedSellPrice) * 100 : 0;

    setSellPrice(calculatedSellPrice);
    setCommission(calculatedCommission);
    setDownPaymentPercentage(calculatedDpPercent);
  }, [buyPrice, markupPercentage, downPaymentAmount]);

  return (
    <Card className="max-w-4xl mx-auto shadow-lg rounded-2xl bg-slate-800/60 border border-slate-700 text-slate-300">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-cyan-300">Gadget Pricing Calculator</CardTitle>
        <CardDescription className="text-slate-400">
          Calculate selling prices and commissions based on your costs and markup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="space-y-2">
            <Label htmlFor="buyPriceCalc" className="text-slate-400">Buy Price (฿)</Label>
            <Input
              id="buyPriceCalc"
              type="number"
              value={buyPrice}
              onChange={(e) => setBuyPrice(parseFloat(e.target.value) || 0)}
              placeholder="e.g., 10000"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="markupPercentage" className="text-slate-400">Markup Percentage (%)</Label>
            <Input
              id="markupPercentage"
              type="number"
              value={markupPercentage}
              onChange={(e) => setMarkupPercentage(parseFloat(e.target.value) || 0)}
              placeholder="e.g., 20"
              step="0.1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="downPaymentAmount" className="text-slate-400">Customer's Down Payment (฿)</Label>
            <Input
              id="downPaymentAmount"
              type="number"
              value={downPaymentAmount}
              onChange={(e) => setDownPaymentAmount(parseFloat(e.target.value) || 0)}
              placeholder="e.g., 2000"
              step="0.01"
            />
          </div>
        </div>

        <div className="mt-8 p-6 bg-slate-900/80 rounded-xl border border-slate-700 text-center space-y-4">
          <div>
            <p className="text-lg font-semibold text-cyan-400 mb-1">Suggested Selling Price:</p>
            <p className="text-4xl font-extrabold text-slate-100">฿{sellPrice.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-cyan-400 mb-1">Calculated Commission:</p>
            <p className="text-3xl font-extrabold text-green-400">฿{commission.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-cyan-400 mt-2 mb-1">Customer's Down Payment:</p>
            <p className="text-3xl font-extrabold text-slate-100">฿{downPaymentAmount.toFixed(2)}</p>
            <p className="text-sm text-slate-400 mt-1">
              ({downPaymentPercentage.toFixed(2)}% of Selling Price)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
