export interface MonthlyPaymentRecord {
  monthNumber: number;
  dueDate: string;
  amountUSD: number;
  status: "PENDING" | "PAID_TO_ESCROW" | "RELEASED_TO_SELLER";
  paidAt?: string;
  notes?: string;
}

export type EscrowStatus =
  | "PENDING_ADMIN"        // 1. Submitted by guest seller, awaiting admin approval
  | "APPROVED_LIVE"         // 2. Approved by admin, live on marketplace
  | "ESCROW_RESERVED"       // 3. Buyer reserved & paid downpayment / cash to admin escrow
  | "INSPECTED_SHIPPED"     // 4. Admin inspected gadget & released to ship
  | "INSTALLMENT_ACTIVE"    // 5. Customer installment active, payments streaming monthly
  | "COMPLETED"             // 6. All months paid / cash released to seller
  | "DISPUTED"              // 7. Buyer filed a dispute (damaged, not as described)
  | "CANCELLED_REFUNDED"    // 8. Order cancelled and refunded to buyer
  | "REJECTED";             // Inspection failed

export interface EscrowMessage {
  id: string;
  senderRole: "BUYER" | "SELLER" | "ADMIN";
  senderName: string;
  content: string;
  timestamp: string;
  isDisputeNotice?: boolean;
  attachments?: string[]; // Evidence photos, unboxing video URLs, drive links
}

export interface EscrowItem {
  trackingId: string;
  buyerAccessCode?: string; // Unique private tracking code for buyer, e.g. BUY-93787
  sellerAccessCode?: string; // Unique private tracking code for seller, e.g. SEL-93787
  type: "SELLER_SUBMISSION" | "BUYER_REQUEST";
  status: EscrowStatus;
  title: string;
  category: "laptops" | "phones" | "gaming" | "tablets" | "cameras" | string;
  condition: string;
  description?: string; // Gadget description written by poster
  priceUSD: number; // Stored in USD base
  downpaymentPct: number; // e.g. 20
  tenorMonths: number; // e.g. 12
  downpaymentUSD: number; // priceUSD * (downpaymentPct / 100)
  monthlyPaymentUSD: number; // (priceUSD - downpaymentUSD) / tenorMonths
  feeRate: number; // Middleman fee rate (1%-3%)
  feeAmountUSD: number; // Middleman fee $ (deposited directly to Admin's bank account)
  netPayoutUSD: number; // priceUSD - feeAmountUSD (released to seller upon buyer confirmation)
  
  // Seller Contact & Identity
  sellerContact: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  shopName?: string; // Poster's Company / Shop Name
  payoutMethod?: string; // e.g. Bank Transfer, GCash, PromptPay, PayPal, Visa
  sellerPayoutAccountDetails?: string;

  // Buyer Contact & Identity (Strict Privacy: buyerPhone only in Admin Dashboard)
  buyerContact?: string;
  buyerName?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerReceiveMethod?: "PAYPAL" | "BANK_TRANSFER" | "VISA_CARD" | "GCASH" | string;
  buyerReceiveAccountDetails?: string;

  images: string[];
  submittedAt: string;
  shippedAt?: string;
  shippingCourier?: string;
  shippingTrackingNumber?: string;
  isShipped?: boolean;

  adminNotes?: string;

  // Fully functional Payment Gateway details (Deposited to Admin Bank Account)
  orderType?: "CASH_ESCROW" | "INSTALLMENT";
  paymentMethod?: "GCASH" | "PAYPAL" | "VISA_CARD" | "BANK_TRANSFER" | string;
  paymentReference?: string;
  paymentAccountDeposited?: string; // e.g. "Admin Middleman Bank Account (Bangkok Bank: 097-3-274005 / GCash Escrow Trust)"
  paymentAmountUSD?: number;
  paymentStatus?: "UNPAID" | "PENDING_VERIFICATION" | "VERIFIED_IN_ESCROW" | "REFUNDED" | "RELEASED" | string;
  paymentNotes?: string;
  cashHoldingDays?: "1 Day" | "3-7 Days" | "15 Days" | "30 Days" | string;
  cashEscrowStatus?: "HELD_IN_ESCROW" | "ITEM_RECEIVED_TESTING" | "CONFIRMED_RELEASED";
  cashReleasedAt?: string;

  // Buyer & Seller Interactive Escrow Actions
  buyerConfirmedReceived?: boolean;
  buyerConfirmedAt?: string;
  buyerReleaseAuthorized?: boolean; // When true, notifies admin and unlocks seller claim
  sellerClaimedPayout?: boolean;
  sellerClaimedAt?: string;

  // Order Cancellation & Refund Status
  cancelStatus?: "NONE" | "CANCELLED_BY_BUYER" | "CANCELLED_BY_SELLER" | "REFUNDED_BY_ADMIN";
  cancelReason?: string;
  refundedAt?: string;

  // Dispute & Direct Messaging between Buyer and Seller
  disputeStatus?: "NONE" | "DISPUTED_BY_BUYER" | "RESOLVED_REFUNDED" | "RESOLVED_RELEASED";
  disputeReason?: string;
  disputeEvidenceLinks?: string[]; // Uploaded photos, videos, or external Drive/iCloud/YouTube links
  disputeCreatedAt?: string;
  messages?: EscrowMessage[];

  // Monthly installments tracking:
  totalMonths: number;
  monthsPaid: number;
  monthlySchedule: MonthlyPaymentRecord[];
}

const STORAGE_KEY = "gadget_escrow_queue";

export function generateMonthlySchedule(
  tenorMonths: number,
  monthlyPaymentUSD: number
): MonthlyPaymentRecord[] {
  const schedule: MonthlyPaymentRecord[] = [];
  const now = new Date();

  for (let i = 1; i <= tenorMonths; i++) {
    const due = new Date(now);
    due.setMonth(now.getMonth() + i);
    schedule.push({
      monthNumber: i,
      dueDate: due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      amountUSD: monthlyPaymentUSD,
      status: "PENDING",
    });
  }

  return schedule;
}

export function getEscrowQueue(): EscrowItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Remove legacy mock listings if present
        const cleaned = parsed.filter(
          (item: EscrowItem) =>
            item.trackingId !== "GI-84920" &&
            item.trackingId !== "GI-59102" &&
            !item.trackingId.startsWith("GI-104")
        );
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
        }
        return cleaned;
      }
    }
  } catch {}
  return [];
}

export function saveEscrowQueue(items: EscrowItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("escrow_queue_updated", { detail: items }));
  } catch {}
}

export function addEscrowItem(item: EscrowItem): void {
  const current = getEscrowQueue();
  // Ensure access codes exist
  const rawId = item.trackingId.replace(/^GI-/, "");
  const enrichedItem: EscrowItem = {
    ...item,
    buyerAccessCode: item.buyerAccessCode || `BUY-${rawId}`,
    sellerAccessCode: item.sellerAccessCode || `SEL-${rawId}`,
    isShipped: item.isShipped ?? Boolean(item.shippedAt),
    messages: item.messages || [],
    cancelStatus: item.cancelStatus || "NONE",
    disputeStatus: item.disputeStatus || "NONE",
  };
  const updated = [enrichedItem, ...current];
  saveEscrowQueue(updated);
}

export function updateEscrowStatus(
  trackingId: string,
  status: EscrowStatus,
  adminNotes?: string
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;
    const isNowShipped = status === "INSPECTED_SHIPPED" || status === "INSTALLMENT_ACTIVE";
    return {
      ...item,
      status,
      isShipped: isNowShipped || item.isShipped,
      shippedAt: isNowShipped && !item.shippedAt ? new Date().toLocaleString() : item.shippedAt,
      adminNotes: adminNotes ?? item.adminNotes,
    };
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Admin Command: Edit Escrow Item Details
 */
export function editEscrowItem(
  trackingId: string,
  updates: Partial<EscrowItem>
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;

    const newPrice = updates.priceUSD !== undefined ? updates.priceUSD : item.priceUSD;
    const newDpPct = updates.downpaymentPct !== undefined ? updates.downpaymentPct : item.downpaymentPct;
    const newTenor = updates.tenorMonths !== undefined ? updates.tenorMonths : item.tenorMonths;

    const newDpUSD = newPrice * (newDpPct / 100);
    const newMonthlyUSD = newTenor > 0 ? (newPrice - newDpUSD) / newTenor : 0;
    const feeRate = item.feeRate || 2;
    const feeAmountUSD = newPrice * (feeRate / 100);
    const netPayoutUSD = Math.max(0, newPrice - feeAmountUSD);

    return {
      ...item,
      ...updates,
      priceUSD: newPrice,
      downpaymentPct: newDpPct,
      tenorMonths: newTenor,
      downpaymentUSD: newDpUSD,
      monthlyPaymentUSD: newMonthlyUSD,
      feeAmountUSD,
      netPayoutUSD,
    };
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Admin Command: Delete Escrow Item
 */
export function deleteEscrowItem(trackingId: string): EscrowItem[] {
  if (!trackingId) return getEscrowQueue();
  const current = getEscrowQueue();
  const rawId = trackingId.replace(/^GI-/, "");
  const updated = current.filter(
    (item) =>
      item.trackingId !== trackingId &&
      item.trackingId !== `GI-${rawId}` &&
      item.trackingId !== rawId
  );
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Admin Command: Update Payment Details & Buyer/Seller Receiving Methods
 */
export function updateEscrowPaymentDetails(
  trackingId: string,
  updates: {
    paymentMethod?: string;
    paymentReference?: string;
    paymentAccountDeposited?: string;
    paymentAmountUSD?: number;
    paymentStatus?: string;
    paymentNotes?: string;
    buyerReceiveMethod?: string;
    buyerReceiveAccountDetails?: string;
    sellerPayoutAccountDetails?: string;
    payoutMethod?: string;
  }
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;
    return {
      ...item,
      ...updates,
    };
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Admin Command: Delete / Reset Escrow Payment Details
 */
export function deleteEscrowPaymentDetails(trackingId: string): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;
    const clone = { ...item };
    delete clone.paymentMethod;
    delete clone.paymentReference;
    delete clone.paymentAccountDeposited;
    delete clone.paymentAmountUSD;
    delete clone.paymentStatus;
    delete clone.paymentNotes;
    delete clone.buyerReceiveMethod;
    delete clone.buyerReceiveAccountDetails;
    return clone;
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Seller Action in Tracker: Update Contact, Payout Method & Bank Details
 */
export function updateEscrowSellerDetails(
  trackingId: string,
  updates: {
    sellerName?: string;
    sellerPhone?: string;
    sellerEmail?: string;
    payoutMethod?: string;
    sellerPayoutAccountDetails?: string;
    shopName?: string;
  }
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;

    const parts = [
      updates.payoutMethod ? `Payout: ${updates.payoutMethod}` : "",
      updates.sellerPayoutAccountDetails ? `Bank/Acct: ${updates.sellerPayoutAccountDetails}` : "",
      updates.sellerPhone ? `Phone: ${updates.sellerPhone}` : "",
      updates.sellerEmail ? `Email: ${updates.sellerEmail}` : "",
    ].filter(Boolean);

    const changesText = parts.length > 0 ? parts.join(" • ") : "Contact/Bank details modified";

    const newMsg: EscrowMessage = {
      id: "msg-" + Date.now(),
      senderRole: "SELLER",
      senderName: updates.shopName || updates.sellerName || item.shopName || item.sellerName || "Seller",
      content: `📝 Seller updated bank & payout info: ${changesText}. Admin records automatically updated.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    return {
      ...item,
      ...updates,
      sellerContact: updates.sellerPhone || updates.sellerEmail || item.sellerContact,
      messages: [...(item.messages || []), newMsg],
    };
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Buyer Action in Tracker: Update Contact & Method to Receive Refund/Payment
 */
export function updateEscrowBuyerDetails(
  trackingId: string,
  updates: {
    buyerName?: string;
    buyerPhone?: string;
    buyerEmail?: string;
    buyerReceiveMethod?: string;
    buyerReceiveAccountDetails?: string;
  }
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;

    const parts = [
      updates.buyerReceiveMethod ? `Receive Method: ${updates.buyerReceiveMethod}` : "",
      updates.buyerReceiveAccountDetails ? `Acct: ${updates.buyerReceiveAccountDetails}` : "",
      updates.buyerPhone ? `Phone: ${updates.buyerPhone}` : "",
      updates.buyerEmail ? `Email: ${updates.buyerEmail}` : "",
    ].filter(Boolean);

    const changesText = parts.length > 0 ? parts.join(" • ") : "Contact/Receive details modified";

    const newMsg: EscrowMessage = {
      id: "msg-" + Date.now(),
      senderRole: "BUYER",
      senderName: updates.buyerName || item.buyerName || "Buyer",
      content: `📝 Buyer updated receiving method & details: ${changesText}. Admin records automatically updated.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    return {
      ...item,
      ...updates,
      buyerContact: updates.buyerPhone || updates.buyerEmail || item.buyerContact,
      messages: [...(item.messages || []), newMsg],
    };
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Buyer Action: Confirm Device Received & Authorize Money Release
 * Notifies admin and unlocks seller's claim button.
 */
export function buyerConfirmReceipt(
  trackingId: string,
  buyerFeedback?: string
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;

    const newMsg: EscrowMessage = {
      id: "msg-" + Date.now(),
      senderRole: "BUYER",
      senderName: item.buyerName || "Buyer",
      content: buyerFeedback
        ? `Buyer confirmed item received in good condition: "${buyerFeedback}". Authorized Admin to release payment to seller.`
        : "Buyer verified the item condition and authorized Admin escrow release to seller.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    return {
      ...item,
      buyerConfirmedReceived: true,
      buyerConfirmedAt: new Date().toLocaleString(),
      buyerReleaseAuthorized: true,
      cashEscrowStatus: "ITEM_RECEIVED_TESTING" as const,
      messages: [...(item.messages || []), newMsg],
    };
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Seller Action: Mark Device as Shipped (Locks cancellation by buyer)
 */
export function sellerMarkShipped(
  trackingId: string,
  courier: string = "Standard Express",
  trackingNum?: string
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;

    const newMsg: EscrowMessage = {
      id: "msg-" + Date.now(),
      senderRole: "SELLER",
      senderName: item.shopName || item.sellerName || "Seller",
      content: `Item marked as shipped via ${courier}${trackingNum ? ` (Tracking #: ${trackingNum})` : ""}. Order is now in transit and protected by Admin Escrow.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    return {
      ...item,
      isShipped: true,
      shippedAt: new Date().toLocaleString(),
      shippingCourier: courier,
      shippingTrackingNumber: trackingNum || `TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      status: item.status === "ESCROW_RESERVED" ? ("INSPECTED_SHIPPED" as const) : item.status,
      messages: [...(item.messages || []), newMsg],
    };
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Seller Action: Claim Released Payout (Transferred from Admin Escrow)
 */
export function sellerClaimPayout(trackingId: string): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;

    const newMsg: EscrowMessage = {
      id: "msg-" + Date.now(),
      senderRole: "SELLER",
      senderName: item.shopName || item.sellerName || "Seller",
      content: `Seller submitted payout claim for net amount $${item.netPayoutUSD.toFixed(2)}. Admin escrow funds released.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    return {
      ...item,
      sellerClaimedPayout: true,
      sellerClaimedAt: new Date().toLocaleString(),
      cashEscrowStatus: "CONFIRMED_RELEASED" as const,
      status: "COMPLETED" as const,
      messages: [...(item.messages || []), newMsg],
    };
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Buyer or Seller Action: Cancel Order before shipment
 */
export function cancelEscrowOrder(
  trackingId: string,
  cancelledBy: "BUYER" | "SELLER",
  reason: string
): { success: boolean; message: string; updatedQueue: EscrowItem[] } {
  const current = getEscrowQueue();
  const target = current.find((i) => i.trackingId === trackingId);

  if (!target) {
    return { success: false, message: "Order not found", updatedQueue: current };
  }

  // Buyer CANNOT cancel if item has already been shipped
  if (cancelledBy === "BUYER" && (target.isShipped || target.status === "INSPECTED_SHIPPED" || target.status === "INSTALLMENT_ACTIVE")) {
    return {
      success: false,
      message: "Order has already been shipped. Cancellation is locked. You can inspect upon delivery or file a dispute if damaged.",
      updatedQueue: current,
    };
  }

  const newMsg: EscrowMessage = {
    id: "msg-" + Date.now(),
    senderRole: cancelledBy,
    senderName: cancelledBy === "BUYER" ? (target.buyerName || "Buyer") : (target.shopName || target.sellerName || "Seller"),
    content: `Order was cancelled by ${cancelledBy}: "${reason}". Full funds in Admin Escrow queued for refund to buyer.`,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;
    return {
      ...item,
      status: "CANCELLED_REFUNDED" as const,
      cancelStatus: (cancelledBy === "BUYER" ? "CANCELLED_BY_BUYER" : "CANCELLED_BY_SELLER") as any,
      cancelReason: reason,
      refundedAt: new Date().toLocaleString(),
      messages: [...(item.messages || []), newMsg],
    };
  });

  saveEscrowQueue(updated);
  return { success: true, message: "Order successfully cancelled. Refund processed.", updatedQueue: updated };
}

/**
 * Buyer Action: File a Dispute / Report damaged item (with evidence photos/videos/external links)
 */
export function fileEscrowDispute(
  trackingId: string,
  reason: string,
  evidenceLinks?: string[]
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;

    const linksText =
      evidenceLinks && evidenceLinks.length > 0
        ? `\nAttached Evidence Proofs (${evidenceLinks.length}):\n` +
          evidenceLinks.map((l, idx) => `[Proof ${idx + 1}]: ${l}`).join("\n")
        : "";

    const newMsg: EscrowMessage = {
      id: "msg-" + Date.now(),
      senderRole: "BUYER",
      senderName: item.buyerName || "Buyer",
      content: `🚨 DISPUTE FILED: "${reason}".${linksText}\nAdmin escrow hold is frozen. Parties please inspect the evidence photos/videos below and agree on resolution.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isDisputeNotice: true,
      attachments: evidenceLinks || [],
    };

    return {
      ...item,
      status: "DISPUTED" as const,
      disputeStatus: "DISPUTED_BY_BUYER" as const,
      disputeReason: reason,
      disputeEvidenceLinks: evidenceLinks || [],
      disputeCreatedAt: new Date().toLocaleString(),
      messages: [...(item.messages || []), newMsg],
    };
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Direct Messaging Channel: Add a message to order thread (with optional attachments)
 */
export function addEscrowMessage(
  trackingId: string,
  senderRole: "BUYER" | "SELLER" | "ADMIN",
  senderName: string,
  content: string,
  attachments?: string[]
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;

    const newMsg: EscrowMessage = {
      id: "msg-" + Date.now(),
      senderRole,
      senderName,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachments: attachments || [],
    };

    return {
      ...item,
      messages: [...(item.messages || []), newMsg],
    };
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Admin Action: Full Refund to Buyer & Cancel Order upon Mutual Agreement / Broken Item
 */
export function adminRefundAndCancel(
  trackingId: string,
  notes: string = "Admin reviewed dispute and issued full refund to buyer."
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;

    const newMsg: EscrowMessage = {
      id: "msg-" + Date.now(),
      senderRole: "ADMIN",
      senderName: "Admin Middleman",
      content: `✅ DISPUTE RESOLVED: Admin processed 100% full refund to buyer from escrow account. Order closed. Note: ${notes}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isDisputeNotice: true,
    };

    return {
      ...item,
      status: "CANCELLED_REFUNDED" as const,
      disputeStatus: "RESOLVED_REFUNDED" as const,
      cancelStatus: "REFUNDED_BY_ADMIN" as const,
      refundedAt: new Date().toLocaleString(),
      adminNotes: notes,
      messages: [...(item.messages || []), newMsg],
    };
  });
  saveEscrowQueue(updated);
  return updated;
}

/**
 * Request Access Code by matching phone number and email
 */
export function findEscrowByPhoneAndEmail(
  inputPhone: string,
  inputEmail: string
): { found: boolean; item?: EscrowItem; role?: "BUYER" | "SELLER"; accessCode?: string } {
  const queue = getEscrowQueue();
  const cleanPhone = inputPhone.replace(/\D/g, "");
  const cleanEmail = inputEmail.trim().toLowerCase();

  for (const item of queue) {
    // Check Buyer match
    const bContact = (item.buyerContact || "").toLowerCase();
    const bEmail = (item.buyerEmail || "").toLowerCase();
    const bPhone = (item.buyerPhone || "").replace(/\D/g, "");

    const buyerEmailMatches = (cleanEmail && (bContact.includes(cleanEmail) || bEmail.includes(cleanEmail)));
    const buyerPhoneMatches = (cleanPhone && (bContact.replace(/\D/g, "").includes(cleanPhone) || bPhone.includes(cleanPhone)));

    if (buyerEmailMatches || (buyerPhoneMatches && buyerEmailMatches) || (cleanPhone.length >= 7 && buyerPhoneMatches)) {
      const rawId = item.trackingId.replace(/^GI-/, "");
      const accessCode = item.buyerAccessCode || `BUY-${rawId}`;
      return { found: true, item, role: "BUYER", accessCode };
    }

    // Check Seller match
    const sContact = (item.sellerContact || "").toLowerCase();
    const sEmail = (item.sellerEmail || "").toLowerCase();
    const sPhone = (item.sellerPhone || "").replace(/\D/g, "");

    const sellerEmailMatches = (cleanEmail && (sContact.includes(cleanEmail) || sEmail.includes(cleanEmail)));
    const sellerPhoneMatches = (cleanPhone && (sContact.replace(/\D/g, "").includes(cleanPhone) || sPhone.includes(cleanPhone)));

    if (sellerEmailMatches || (sellerPhoneMatches && sellerEmailMatches) || (cleanPhone.length >= 7 && sellerPhoneMatches)) {
      const rawId = item.trackingId.replace(/^GI-/, "");
      const accessCode = item.sellerAccessCode || `SEL-${rawId}`;
      return { found: true, item, role: "SELLER", accessCode };
    }
  }

  return { found: false };
}

/**
 * Admin action: record monthly payment for monthNumber
 */
export function recordMonthlyPayment(
  trackingId: string,
  monthNumber: number,
  notes?: string
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;

    const schedule = item.monthlySchedule.map((m) => {
      if (m.monthNumber === monthNumber) {
        return {
          ...m,
          status: "RELEASED_TO_SELLER" as const,
          paidAt: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          notes: notes || "Payment received & released to seller by Admin",
        };
      }
      return m;
    });

    const newMonthsPaid = schedule.filter((m) => m.status === "RELEASED_TO_SELLER").length;
    const isFullyPaid = newMonthsPaid >= item.totalMonths;

    return {
      ...item,
      monthsPaid: newMonthsPaid,
      monthlySchedule: schedule,
      status: isFullyPaid ? ("COMPLETED" as const) : ("INSTALLMENT_ACTIVE" as const),
    };
  });

  saveEscrowQueue(updated);
  return updated;
}

/**
 * Admin action: Confirm transaction and release cash escrow payout to seller
 */
export function confirmCashEscrowRelease(
  trackingId: string,
  notes?: string
): EscrowItem[] {
  const current = getEscrowQueue();
  const updated = current.map((item) => {
    if (item.trackingId !== trackingId) return item;
    return {
      ...item,
      status: "COMPLETED" as const,
      cashEscrowStatus: "CONFIRMED_RELEASED" as const,
      cashReleasedAt: new Date().toLocaleString(),
      adminNotes: notes || "Admin verified transaction and released full cash escrow payout to seller.",
    };
  });
  saveEscrowQueue(updated);
  return updated;
}
