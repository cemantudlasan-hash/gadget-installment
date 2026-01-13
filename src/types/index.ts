

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
  reminderDismissed?: boolean;
}

export interface Commission {
  id: string;
  date: string;
  description: string;
  getAmount: number;
  spentAmount: number;
  runningTotal?: number;
  saleId?: string;
  penaltyAmount?: number;
  comment?: string;
}

export interface YearlyReport {
  year: number;
  totalExpenses: number;
  netYearlyIncome: number;
  totalDownPayments: number;
  totalCommission: number;
}

export interface GadgetPost {
  id: string;
  productNumber: string;
  productName: string;
  category: string;
  description?: string;
  cashPrice: number;
  downPayment?: number;
  installmentMonths?: number;
  monthlyInstallment?: number;
  adminName: string;
  contactNumber: string;
  socialMedia: string;
  isSold: boolean;
  createdAt: string;
  externalLink?: string;
  imageUrl?: string;
}

export interface Inquiry {
  id: string;
  dailyInquiryId: number;
  guestName: string;
  contactNumber: string;
  email: string;
  socialMedia: string;
  productName: string;
  productId: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  translation?: string;
  detectedLanguage?: string;
}
