export interface Installment {
  month: number;
  dueAmount: number;
  paidAmount: number;
  isPaid: boolean;
  lastPaymentDate: string | null;
}

export interface Sale {
  id: string;
  customerName: string;
  gadget: string;
  pieces: number;
  buyPrice: number;
  sellPrice: number;
  shippingCost: number;
  dateStart: string;
  downPayment: number;
  numberOfInstallments: number;
  monthlyPayment: number;
  commission: number;
  totalAmountDue: number;
  totalPaidAmount: number;
  remainingBalance: number;
  paymentInstallments: Installment[];
  typeOfCard?: string;
  paymentType?: string;
  customerNote?: string;
  passportID?: string;
}

export interface Commission {
  id: string;
  date: string;
  description: string;
  getAmount: number;
  spentAmount: number;
  runningTotal?: number;
  saleId?: string;
}
