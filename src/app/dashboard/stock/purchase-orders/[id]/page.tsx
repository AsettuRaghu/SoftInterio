"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { POStatusBadge, EditPurchaseOrderModal } from "@/components/stock";
import type { PurchaseOrder, POStatus, POPaymentStatus } from "@/types/stock";
import {
  POStatusLabels,
  POPaymentStatusLabels,
  POPaymentStatusColors,
  POCostTypeLabels,
} from "@/types/stock";

// Alert Toast Component
function AlertToast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isError = type === "error";

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
      <div
        className={`min-w-[320px] max-w-md rounded-lg border shadow-lg p-4 flex items-start gap-3 ${
          isError ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
        }`}
      >
        <div className="shrink-0">
          {isError ? (
            <svg
              className="w-5 h-5 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 pt-0.5">
          <p
            className={`text-sm font-medium ${
              isError ? "text-red-800" : "text-green-800"
            }`}
          >
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          className={`shrink-0 rounded-md p-1 inline-flex ${
            isError
              ? "text-red-400 hover:text-red-600 hover:bg-red-100"
              : "text-green-400 hover:text-green-600 hover:bg-green-100"
          } focus:outline-none transition-colors`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Icons
const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    />
  </svg>
);

const PencilIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
);

const PrinterIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
    />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const XMarkIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const TruckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
    />
  </svg>
);

const PaperAirplaneIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
    />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const BuildingIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
);

const CurrencyIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const ClipboardIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
  </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

// Status Workflow Steps
const STATUS_WORKFLOW: POStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "sent_to_vendor",
  "dispatched",
  "fully_received",
  "closed",
];

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [relatedGRNs, setRelatedGRNs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<
    "details" | "receive" | "history" | "payments"
  >("details");

  // Payment state
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<{
    total_amount: number;
    total_paid: number;
    balance: number;
    payment_status: string;
  } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_type: "regular" as "advance" | "regular" | "final" | "adjustment",
    payment_method: "" as string,
    reference_number: "",
    bank_reference: "",
    notes: "",
  });

  // Receive Goods state
  const [receiveMode, setReceiveMode] = useState(false);
  const [receivingItems, setReceivingItems] = useState<
    Record<
      string,
      {
        quantity_received: number;
        quantity_accepted: number;
        quantity_rejected: number;
        rejection_reason: string;
      }
    >
  >({});
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch purchase order
  useEffect(() => {
    const fetchPO = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/stock/purchase-orders/${id}`);
        if (!response.ok) {
          throw new Error("Failed to load purchase order");
        }
        const data = await response.json();
        console.log(
          "[PO Detail] Loaded PO:",
          data.purchaseOrder?.po_number,
          "Items:",
          data.purchaseOrder?.items?.length
        );
        setPurchaseOrder(data.purchaseOrder);

        // Fetch related GRNs
        const grnResponse = await fetch(`/api/stock/grn?po_id=${id}`);
        if (grnResponse.ok) {
          const grnData = await grnResponse.json();
          console.log(
            "[PO Detail] Loaded GRNs:",
            grnData.grns?.length,
            "GRNs:",
            grnData.grns?.map((g: any) => g.grn_number)
          );
          setRelatedGRNs(grnData.grns || []);
        } else {
          console.error(
            "[PO Detail] Failed to fetch GRNs:",
            grnResponse.status
          );
        }

        // Fetch payments
        const paymentsResponse = await fetch(
          `/api/stock/purchase-orders/${id}/payments`
        );
        if (paymentsResponse.ok) {
          const paymentsData = await paymentsResponse.json();
          setPayments(paymentsData.payments || []);
          setPaymentSummary(paymentsData.summary || null);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load purchase order"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchPO();
  }, [id]);

  // Fetch payments (separate function for refresh after adding payment)
  const fetchPayments = async () => {
    try {
      const paymentsResponse = await fetch(
        `/api/stock/purchase-orders/${id}/payments`
      );
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        setPayments(paymentsData.payments || []);
        setPaymentSummary(paymentsData.summary || null);
      }
    } catch (err) {
      console.error("Error fetching payments:", err);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Get current step index
  const getCurrentStepIndex = (status: POStatus): number => {
    if (status === "cancelled" || status === "rejected") return -1;
    if (status === "acknowledged")
      return STATUS_WORKFLOW.indexOf("sent_to_vendor") + 0.5;
    if (status === "partially_received")
      return STATUS_WORKFLOW.indexOf("dispatched") + 0.5;
    return STATUS_WORKFLOW.indexOf(status);
  };

  // Handle status update
  const handleStatusUpdate = async (newStatus: POStatus) => {
    setActionLoading(newStatus);
    try {
      const response = await fetch(`/api/stock/purchase-orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }
      const data = await response.json();
      setPurchaseOrder(data.purchaseOrder);
      setSuccessMessage(
        `Status updated to ${POStatusLabels[newStatus]} successfully!`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update status"
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this purchase order?")) {
      return;
    }
    setActionLoading("cancel");
    try {
      const response = await fetch(`/api/stock/purchase-orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel");
      }
      const data = await response.json();
      setPurchaseOrder(data.purchaseOrder);
      setSuccessMessage("Purchase order cancelled successfully");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setActionLoading(null);
    }
  };

  // Handle reject PO
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setErrorMessage("Please provide a rejection reason");
      return;
    }
    setActionLoading("reject");
    try {
      const response = await fetch(`/api/stock/purchase-orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "rejected",
          rejection_reason: rejectionReason,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reject");
      }
      const data = await response.json();
      setPurchaseOrder(data.purchaseOrder);
      setSuccessMessage("Purchase order rejected");
      setRejectionModalOpen(false);
      setRejectionReason("");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  // Handle close PO
  const handleClose = async () => {
    if (
      !confirm(
        "Are you sure you want to close this purchase order? This action cannot be undone."
      )
    ) {
      return;
    }
    setActionLoading("close");
    try {
      const response = await fetch(`/api/stock/purchase-orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to close PO");
      }
      const data = await response.json();
      setPurchaseOrder(data.purchaseOrder);
      setSuccessMessage("Purchase order closed successfully");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to close");
    } finally {
      setActionLoading(null);
    }
  };

  // Initialize receiving items from PO items
  const initializeReceivingItems = () => {
    if (!purchaseOrder?.items) return;

    // Calculate previously received quantities
    const previouslyReceived: Record<string, number> = {};
    relatedGRNs.forEach((grn) => {
      if (grn.status === "completed") {
        (grn.items || []).forEach((item: any) => {
          previouslyReceived[item.po_item_id] =
            (previouslyReceived[item.po_item_id] || 0) +
            Number(item.quantity_accepted);
        });
      }
    });

    const initialItems: Record<string, any> = {};
    purchaseOrder.items.forEach((item) => {
      const received = previouslyReceived[item.id] || 0;
      const pending = item.quantity - received;
      if (pending > 0) {
        initialItems[item.id] = {
          quantity_received: pending,
          quantity_accepted: pending,
          quantity_rejected: 0,
          rejection_reason: "",
        };
      }
    });
    setReceivingItems(initialItems);
    setReceiveMode(true);
  };

  // Handle goods receipt submission
  const handleReceiveGoods = async () => {
    const validItems = Object.entries(receivingItems)
      .filter(([_, item]) => item.quantity_received > 0)
      .map(([poItemId, item]) => ({
        po_item_id: poItemId,
        quantity_received: item.quantity_received,
        quantity_accepted: item.quantity_accepted,
        quantity_rejected: item.quantity_rejected,
        rejection_reason: item.rejection_reason || null,
      }));

    console.log("Submitting GRN with items:", validItems);

    if (validItems.length === 0) {
      setErrorMessage("Please enter quantities for at least one item");
      return;
    }

    setReceiveLoading(true);
    try {
      const requestBody = {
        po_id: id,
        received_date: new Date().toISOString().split("T")[0],
        delivery_note_number: deliveryNoteNumber || null,
        vehicle_number: vehicleNumber || null,
        notes: receiveNotes || null,
        items: validItems,
      };
      console.log("GRN Request body:", requestBody);

      const response = await fetch("/api/stock/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();
      console.log("GRN Response:", responseData);

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to record goods receipt");
      }

      // Refresh PO and GRNs
      const [poResponse, grnResponse] = await Promise.all([
        fetch(`/api/stock/purchase-orders/${id}`),
        fetch(`/api/stock/grn?po_id=${id}`),
      ]);

      if (poResponse.ok) {
        const poData = await poResponse.json();
        setPurchaseOrder(poData.purchaseOrder);
      }
      if (grnResponse.ok) {
        const grnData = await grnResponse.json();
        setRelatedGRNs(grnData.grns || []);
        console.log("Fetched GRNs:", grnData.grns);
      }

      setSuccessMessage("Goods received successfully! PO status updated.");
      setReceiveMode(false);
      setReceivingItems({});
      setDeliveryNoteNumber("");
      setVehicleNumber("");
      setReceiveNotes("");
      setActiveTab("history"); // Switch to history tab to show the new receipt
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to receive goods"
      );
    } finally {
      setReceiveLoading(false);
    }
  };

  // Update receiving item quantity with validation
  const updateReceivingItem = (
    itemId: string,
    field: string,
    value: number | string,
    maxPending?: number
  ) => {
    setReceivingItems((prev) => {
      const current = prev[itemId] || {
        quantity_received: 0,
        quantity_accepted: 0,
        quantity_rejected: 0,
        rejection_reason: "",
      };
      let updated = { ...current, [field]: value };

      // Enforce max pending quantity for quantity_received
      if (field === "quantity_received" && maxPending !== undefined) {
        const numValue = Math.max(0, Math.min(Number(value), maxPending));
        updated.quantity_received = numValue;
        updated.quantity_accepted = Math.max(
          0,
          numValue - updated.quantity_rejected
        );
      } else if (field === "quantity_received") {
        updated.quantity_accepted = Math.max(
          0,
          Number(value) - updated.quantity_rejected
        );
      } else if (field === "quantity_rejected") {
        // Rejected cannot exceed received
        const rejectedValue = Math.max(
          0,
          Math.min(Number(value), updated.quantity_received)
        );
        updated.quantity_rejected = rejectedValue;
        updated.quantity_accepted = Math.max(
          0,
          updated.quantity_received - rejectedValue
        );
      }

      return { ...prev, [itemId]: updated };
    });
  };

  // Handle payment submission
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paymentAmount = Number(paymentForm.amount);

    if (!paymentForm.amount || paymentAmount <= 0) {
      setErrorMessage("Please enter a valid payment amount");
      return;
    }

    // Strict validation: don't allow amount greater than balance
    if (paymentSummary && paymentAmount > paymentSummary.balance) {
      setErrorMessage(
        `Payment amount cannot exceed balance due: ${formatCurrency(
          paymentSummary.balance
        )}`
      );
      return;
    }

    setPaymentLoading(true);
    try {
      const response = await fetch(
        `/api/stock/purchase-orders/${id}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: paymentAmount,
            payment_date: paymentForm.payment_date,
            payment_type: paymentForm.payment_type,
            payment_method: paymentForm.payment_method || null,
            reference_number: paymentForm.reference_number || null,
            bank_reference: paymentForm.bank_reference || null,
            notes: paymentForm.notes || null,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to record payment");
      }

      const data = await response.json();
      setPayments((prev) => [data.payment, ...prev]);
      setPaymentSummary(data.summary);
      setShowPaymentForm(false);
      setPaymentForm({
        amount: "",
        payment_date: new Date().toISOString().split("T")[0],
        payment_type: "regular",
        payment_method: "",
        reference_number: "",
        bank_reference: "",
        notes: "",
      });
      setSuccessMessage("Payment recorded successfully!");

      // Update the local PO state with new payment status
      if (purchaseOrder && data.summary.payment_status) {
        setPurchaseOrder((prev) =>
          prev
            ? {
                ...prev,
                payment_status: data.summary.payment_status,
              }
            : null
        );
      }

      // Refresh full PO data if fully paid (may trigger auto-close)
      if (data.summary.payment_status === "fully_paid") {
        const poResponse = await fetch(`/api/stock/purchase-orders/${id}`);
        if (poResponse.ok) {
          const poData = await poResponse.json();
          setPurchaseOrder(poData.purchaseOrder);
        }
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to record payment"
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  // Calculate pending quantities - use received_quantity from PO item
  const getPendingQuantity = (item: any) => {
    const orderedQty = Number(item.quantity) || 0;
    const receivedQty = Number(item.received_quantity) || 0;
    return Math.max(0, orderedQty - receivedQty);
  };

  // Check if goods can be received
  const canReceiveGoods =
    purchaseOrder &&
    ["dispatched", "acknowledged", "partially_received"].includes(
      purchaseOrder.status
    );

  // Check if we should show receipt history (any status that has had goods received)
  const showReceiptHistory =
    purchaseOrder &&
    [
      "dispatched",
      "acknowledged",
      "partially_received",
      "fully_received",
      "closed",
    ].includes(purchaseOrder.status);

  // Check if payments can be made
  const canMakePayment =
    purchaseOrder &&
    !["draft", "pending_approval", "rejected", "cancelled"].includes(
      purchaseOrder.status
    ) &&
    paymentSummary &&
    paymentSummary.balance > 0;

  // Check if edit is allowed (only draft is editable, approved can edit but goes back to draft)
  const canEdit =
    purchaseOrder && ["draft", "approved"].includes(purchaseOrder.status);

  // Check if PO is in a terminal/read-only state
  const isTerminalState =
    purchaseOrder &&
    ["rejected", "cancelled", "closed"].includes(purchaseOrder.status);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Loading purchase order...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !purchaseOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96">
        <p className="text-sm text-red-600 mb-4">
          {error || "Purchase order not found"}
        </p>
        <Link
          href="/dashboard/stock/purchase-orders"
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          Back to Purchase Orders
        </Link>
      </div>
    );
  }

  const currentStepIndex = getCurrentStepIndex(purchaseOrder.status);

  return (
    <>
      {/* Toast Notifications */}
      {successMessage && (
        <AlertToast
          message={successMessage}
          type="success"
          onClose={() => setSuccessMessage(null)}
        />
      )}
      {errorMessage && (
        <AlertToast
          message={errorMessage}
          type="error"
          onClose={() => setErrorMessage(null)}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard/stock/purchase-orders")}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
                <Link href="/dashboard" className="hover:text-blue-600">
                  Dashboard
                </Link>
                <span>/</span>
                <Link href="/dashboard/stock" className="hover:text-blue-600">
                  Stock
                </Link>
                <span>/</span>
                <Link
                  href="/dashboard/stock/purchase-orders"
                  className="hover:text-blue-600"
                >
                  Purchase Orders
                </Link>
                <span>/</span>
                <span className="text-slate-700">
                  {purchaseOrder.po_number}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-slate-900">
                  {purchaseOrder.po_number}
                </h1>
                <POStatusBadge status={purchaseOrder.status} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
              >
                <PencilIcon className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            >
              <PrinterIcon className="h-3.5 w-3.5" />
              Print
            </button>
          </div>
        </div>

        {/* Status Workflow Stepper */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            {STATUS_WORKFLOW.map((status, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === Math.floor(currentStepIndex);
              const isCancelled = purchaseOrder.status === "cancelled";

              return (
                <React.Fragment key={status}>
                  {index > 0 && (
                    <div
                      className={`flex-1 h-1 mx-2 rounded ${
                        isCompleted ? "bg-green-500" : "bg-slate-200"
                      }`}
                    />
                  )}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        isCancelled
                          ? "bg-red-100 text-red-600"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                          ? "bg-blue-500 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckIcon className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span
                      className={`mt-1.5 text-xs ${
                        isCurrent
                          ? "font-medium text-slate-900"
                          : "text-slate-500"
                      }`}
                    >
                      {POStatusLabels[status]}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Rejected/Cancelled Banner */}
        {(purchaseOrder.status === "rejected" ||
          purchaseOrder.status === "cancelled") && (
          <div
            className={`rounded-lg border p-4 ${
              purchaseOrder.status === "rejected"
                ? "bg-red-50 border-red-200"
                : "bg-slate-100 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <XMarkIcon
                className={`w-5 h-5 ${
                  purchaseOrder.status === "rejected"
                    ? "text-red-600"
                    : "text-slate-500"
                }`}
              />
              <div>
                <h3
                  className={`font-medium ${
                    purchaseOrder.status === "rejected"
                      ? "text-red-800"
                      : "text-slate-700"
                  }`}
                >
                  {purchaseOrder.status === "rejected"
                    ? "Purchase Order Rejected"
                    : "Purchase Order Cancelled"}
                </h3>
                {(purchaseOrder as any).rejection_reason && (
                  <p className="text-sm text-red-600 mt-1">
                    Reason: {(purchaseOrder as any).rejection_reason}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Closed Banner */}
        {purchaseOrder.status === "closed" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckIcon className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-medium text-emerald-800">
                  Purchase Order Closed
                </h3>
                <p className="text-sm text-emerald-600 mt-1">
                  All items received and payment completed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isTerminalState && purchaseOrder.status !== "fully_received" && (
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700">Actions</h3>
              <div className="flex items-center gap-2">
                {purchaseOrder.status === "draft" && (
                  <button
                    onClick={() => handleStatusUpdate("pending_approval")}
                    disabled={actionLoading === "pending_approval"}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                    {actionLoading === "pending_approval"
                      ? "Submitting..."
                      : "Submit for Approval"}
                  </button>
                )}

                {purchaseOrder.status === "pending_approval" && (
                  <>
                    <button
                      onClick={() => handleStatusUpdate("approved")}
                      disabled={actionLoading === "approved"}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
                    >
                      <CheckIcon className="h-4 w-4" />
                      {actionLoading === "approved"
                        ? "Approving..."
                        : "Approve"}
                    </button>
                    <button
                      onClick={() => setRejectionModalOpen(true)}
                      disabled={actionLoading === "reject"}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      Reject
                    </button>
                  </>
                )}

                {purchaseOrder.status === "approved" && (
                  <button
                    onClick={() => handleStatusUpdate("sent_to_vendor")}
                    disabled={actionLoading === "sent_to_vendor"}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                    {actionLoading === "sent_to_vendor"
                      ? "Sending..."
                      : "Send to Vendor"}
                  </button>
                )}

                {purchaseOrder.status === "sent_to_vendor" && (
                  <button
                    onClick={() => handleStatusUpdate("dispatched")}
                    disabled={actionLoading === "dispatched"}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                  >
                    <TruckIcon className="h-4 w-4" />
                    {actionLoading === "dispatched"
                      ? "Updating..."
                      : "Mark Dispatched"}
                  </button>
                )}

                {canReceiveGoods && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                        />
                      </svg>
                      <span className="text-xs text-green-700 font-medium">
                        {purchaseOrder.status === "dispatched"
                          ? "Goods dispatched - Ready to receive"
                          : purchaseOrder.status === "partially_received"
                          ? "Partially received - Continue receiving"
                          : "Acknowledged - Waiting for dispatch"}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab("receive")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                        />
                      </svg>
                      Receive Goods
                    </button>
                  </>
                )}

                {purchaseOrder.status !== "draft" &&
                  purchaseOrder.status !== "pending_approval" && (
                    <button
                      onClick={handleCancel}
                      disabled={actionLoading === "cancel"}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      {actionLoading === "cancel"
                        ? "Cancelling..."
                        : "Cancel PO"}
                    </button>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* Close PO Button for fully received */}
        {purchaseOrder.status === "fully_received" && (
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-700">
                  Close Purchase Order
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {purchaseOrder.payment_status === "fully_paid"
                    ? "All items received and fully paid. Ready to close."
                    : "All items received. Complete payment to close this PO."}
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={
                  actionLoading === "close" ||
                  purchaseOrder.payment_status !== "fully_paid"
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckIcon className="h-4 w-4" />
                {actionLoading === "close" ? "Closing..." : "Close PO"}
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation - Always show all tabs */}
        {purchaseOrder && (
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="border-b border-slate-200">
              <nav className="flex -mb-px overflow-x-auto">
                <button
                  onClick={() => setActiveTab("details")}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === "details"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Order Details
                </button>
                <button
                  onClick={() => setActiveTab("receive")}
                  disabled={!canReceiveGoods}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "receive"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  } ${!canReceiveGoods ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                    />
                  </svg>
                  Receive Goods
                  {purchaseOrder.items?.some(
                    (item) => getPendingQuantity(item) > 0
                  ) &&
                    canReceiveGoods && (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-orange-100 text-orange-600 rounded-full">
                        {
                          purchaseOrder.items.filter(
                            (item) => getPendingQuantity(item) > 0
                          ).length
                        }
                      </span>
                    )}
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "history"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                  Receipt History
                  {relatedGRNs.length > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-600 rounded-full">
                      {relatedGRNs.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("payments")}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "payments"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Payments
                  {payments.length > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-600 rounded-full">
                      {payments.length}
                    </span>
                  )}
                  {paymentSummary && paymentSummary.balance > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-600 rounded-full">
                      Due
                    </span>
                  )}
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {rejectionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Reject Purchase Order
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setRejectionModalOpen(false);
                    setRejectionReason("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={
                    actionLoading === "reject" || !rejectionReason.trim()
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading === "reject" ? "Rejecting..." : "Reject PO"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receive Goods Tab Content */}
        {activeTab === "receive" && canReceiveGoods && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Receive Goods
              </h3>
              <p className="text-sm text-slate-500">
                Record the quantities received for each item. Items with zero
                pending quantity are not shown.
              </p>
            </div>

            {/* Receipt Details */}
            <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Delivery Note #
                </label>
                <input
                  type="text"
                  value={deliveryNoteNumber}
                  onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                  placeholder="DN-12345"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="KA-01-AB-1234"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Items Table Header with Fill All button */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">
                Enter the quantity received for each item. You can only receive
                up to the pending quantity.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setReceivingItems({})}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allItems: Record<string, any> = {};
                    purchaseOrder.items
                      ?.filter((item) => getPendingQuantity(item) > 0)
                      .forEach((item) => {
                        const pending = getPendingQuantity(item);
                        allItems[item.id] = {
                          quantity_received: pending,
                          quantity_accepted: pending,
                          quantity_rejected: 0,
                          rejection_reason: "",
                        };
                      });
                    setReceivingItems(allItems);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Fill All Pending
                </button>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                      Material
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">
                      Ordered
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">
                      Prev. Received
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">
                      Pending
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 w-28">
                      Receiving
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 w-28">
                      Rejected
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 w-28">
                      Accepted
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseOrder.items
                    ?.filter((item) => getPendingQuantity(item) > 0)
                    .map((item) => {
                      const pending = getPendingQuantity(item);
                      const prevReceived = Number(item.received_quantity) || 0;
                      const receiving = receivingItems[item.id] || {
                        quantity_received: 0,
                        quantity_accepted: 0,
                        quantity_rejected: 0,
                        rejection_reason: "",
                      };

                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 text-sm">
                              {item.material?.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.material?.sku}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-900">
                            {item.quantity} {item.material?.unit_of_measure}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-500">
                            {prevReceived}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-medium text-orange-600">
                              {pending}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              max={pending}
                              value={receiving.quantity_received}
                              onChange={(e) =>
                                updateReceivingItem(
                                  item.id,
                                  "quantity_received",
                                  Number(e.target.value),
                                  pending
                                )
                              }
                              className="w-full px-2 py-1.5 text-sm text-right border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              max={receiving.quantity_received}
                              value={receiving.quantity_rejected}
                              onChange={(e) =>
                                updateReceivingItem(
                                  item.id,
                                  "quantity_rejected",
                                  Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1.5 text-sm text-right border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="px-2 py-1.5 text-sm text-right bg-green-50 border border-green-200 rounded font-medium text-green-700">
                              {receiving.quantity_accepted}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={receiving.rejection_reason}
                              onChange={(e) =>
                                updateReceivingItem(
                                  item.id,
                                  "rejection_reason",
                                  e.target.value
                                )
                              }
                              placeholder={
                                receiving.quantity_rejected > 0
                                  ? "Required"
                                  : ""
                              }
                              disabled={receiving.quantity_rejected === 0}
                              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Summary and Submit */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                <span className="font-medium">Total Receiving:</span>{" "}
                {Object.values(receivingItems).reduce(
                  (sum, item) => sum + (item.quantity_received || 0),
                  0
                )}{" "}
                items
                <span className="mx-2">•</span>
                <span className="text-green-600 font-medium">
                  Accepted:{" "}
                  {Object.values(receivingItems).reduce(
                    (sum, item) => sum + (item.quantity_accepted || 0),
                    0
                  )}
                </span>
                {Object.values(receivingItems).some(
                  (item) => item.quantity_rejected > 0
                ) && (
                  <>
                    <span className="mx-2">•</span>
                    <span className="text-red-600 font-medium">
                      Rejected:{" "}
                      {Object.values(receivingItems).reduce(
                        (sum, item) => sum + (item.quantity_rejected || 0),
                        0
                      )}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveTab("details");
                    setReceivingItems({});
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReceiveGoods}
                  disabled={
                    receiveLoading || Object.keys(receivingItems).length === 0
                  }
                  className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {receiveLoading ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-4 h-4" />
                      Confirm Receipt
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Previous GRNs */}
            {relatedGRNs.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">
                  Previous Receipts
                </h4>
                <div className="space-y-2">
                  {relatedGRNs.map((grn) => (
                    <div
                      key={grn.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div>
                        <span className="font-medium text-slate-900">
                          {grn.grn_number}
                        </span>
                        <span className="text-slate-500 text-sm ml-2">
                          • {formatDate(grn.received_date)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-green-600 font-medium">
                          {grn.items?.reduce(
                            (sum: number, i: any) =>
                              sum + Number(i.quantity_accepted),
                            0
                          )}{" "}
                          accepted
                        </span>
                        {grn.items?.some(
                          (i: any) => Number(i.quantity_rejected) > 0
                        ) && (
                          <span className="text-red-600 font-medium ml-2">
                            {grn.items?.reduce(
                              (sum: number, i: any) =>
                                sum + Number(i.quantity_rejected),
                              0
                            )}{" "}
                            rejected
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Receipt History Tab Content */}
        {activeTab === "history" && (
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Goods Receipt History
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Complete record of all goods received against this purchase
                order.
              </p>
            </div>

            {relatedGRNs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <svg
                  className="w-12 h-12 mx-auto text-slate-300 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <h4 className="text-sm font-medium text-slate-900 mb-1">
                  No receipts recorded yet
                </h4>
                <p className="text-xs text-slate-500">
                  Goods receipts will appear here once items are received.
                </p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                      <div className="text-2xl font-bold text-slate-900">
                        {relatedGRNs.length}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Total Receipts
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-green-200 p-4">
                      <div className="text-2xl font-bold text-green-600">
                        {relatedGRNs.reduce(
                          (sum, grn) =>
                            sum +
                            (grn.items?.reduce(
                              (s: number, i: any) =>
                                s + Number(i.quantity_accepted),
                              0
                            ) || 0),
                          0
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Total Accepted
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-red-200 p-4">
                      <div className="text-2xl font-bold text-red-600">
                        {relatedGRNs.reduce(
                          (sum, grn) =>
                            sum +
                            (grn.items?.reduce(
                              (s: number, i: any) =>
                                s + Number(i.quantity_rejected),
                              0
                            ) || 0),
                          0
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Total Rejected
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                      <div className="text-2xl font-bold text-slate-900">
                        {relatedGRNs.length > 0
                          ? formatDate(relatedGRNs[0].received_date)
                          : "-"}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Last Receipt
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRN Details Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                          GRN Number
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                          Received Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                          Received By
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                          Delivery Note
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                          Vehicle
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">
                          Accepted
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">
                          Rejected
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {relatedGRNs.map((grn) => (
                        <tr key={grn.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className="font-medium text-blue-600">
                              {grn.grn_number}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900">
                            {formatDate(grn.received_date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {grn.received_by_user?.full_name || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {grn.delivery_note_number || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {grn.vehicle_number || "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-medium text-green-600">
                              {grn.items?.reduce(
                                (sum: number, i: any) =>
                                  sum + Number(i.quantity_accepted),
                                0
                              ) || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`text-sm font-medium ${
                                grn.items?.some(
                                  (i: any) => Number(i.quantity_rejected) > 0
                                )
                                  ? "text-red-600"
                                  : "text-slate-400"
                              }`}
                            >
                              {grn.items?.reduce(
                                (sum: number, i: any) =>
                                  sum + Number(i.quantity_rejected),
                                0
                              ) || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                                grn.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : grn.status === "partial"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {grn.status === "completed"
                                ? "Completed"
                                : grn.status === "partial"
                                ? "Partial"
                                : grn.status.charAt(0).toUpperCase() +
                                  grn.status.slice(1).replace(/_/g, " ")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Detailed Item Breakdown */}
                <div className="px-6 py-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-4">
                    Item-wise Receipt Details
                  </h4>
                  <div className="space-y-4">
                    {relatedGRNs.map((grn) => (
                      <div
                        key={grn.id}
                        className="border border-slate-200 rounded-lg overflow-hidden"
                      >
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-slate-900">
                              {grn.grn_number}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDate(grn.received_date)}
                            </span>
                          </div>
                          {grn.notes && (
                            <span className="text-xs text-slate-500 italic">
                              Note: {grn.notes}
                            </span>
                          )}
                        </div>
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50/50">
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                                Material
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                                Received
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                                Accepted
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                                Rejected
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                                Rejection Reason
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {grn.items?.map((item: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-4 py-2">
                                  <div className="text-sm font-medium text-slate-900">
                                    {item.po_item?.material?.name ||
                                      "Unknown Material"}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {item.po_item?.material?.sku || ""}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-right text-sm text-slate-900">
                                  {item.quantity_received}
                                </td>
                                <td className="px-4 py-2 text-right text-sm font-medium text-green-600">
                                  {item.quantity_accepted}
                                </td>
                                <td className="px-4 py-2 text-right text-sm font-medium text-red-600">
                                  {Number(item.quantity_rejected) > 0
                                    ? item.quantity_rejected
                                    : "-"}
                                </td>
                                <td className="px-4 py-2 text-sm text-slate-600">
                                  {item.rejection_reason || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Payments Tab Content */}
        {activeTab === "payments" && purchaseOrder && (
          <div className="bg-white rounded-lg border border-slate-200">
            {/* Payment Summary Header */}
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  Payment Details
                </h3>
                {canMakePayment && (
                  <button
                    onClick={() => setShowPaymentForm(!showPaymentForm)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Record Payment
                  </button>
                )}
              </div>
            </div>

            {/* Payment Summary Cards */}
            {paymentSummary && (
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <div className="text-xs text-slate-500 mb-1">
                      Total Amount
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {formatCurrency(paymentSummary.total_amount)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-green-200 p-4">
                    <div className="text-xs text-slate-500 mb-1">
                      Total Paid
                    </div>
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(paymentSummary.total_paid)}
                    </div>
                  </div>
                  <div
                    className={`bg-white rounded-lg border p-4 ${
                      paymentSummary.balance > 0
                        ? "border-orange-200"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="text-xs text-slate-500 mb-1">
                      Balance Due
                    </div>
                    <div
                      className={`text-xl font-bold ${
                        paymentSummary.balance > 0
                          ? "text-orange-600"
                          : "text-slate-400"
                      }`}
                    >
                      {formatCurrency(paymentSummary.balance)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <div className="text-xs text-slate-500 mb-1">
                      Payment Status
                    </div>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          POPaymentStatusColors[
                            paymentSummary.payment_status as POPaymentStatus
                          ]?.bg || "bg-slate-100"
                        } ${
                          POPaymentStatusColors[
                            paymentSummary.payment_status as POPaymentStatus
                          ]?.text || "text-slate-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            POPaymentStatusColors[
                              paymentSummary.payment_status as POPaymentStatus
                            ]?.dot || "bg-slate-400"
                          }`}
                        />
                        {POPaymentStatusLabels[
                          paymentSummary.payment_status as POPaymentStatus
                        ] || paymentSummary.payment_status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Form */}
            {showPaymentForm && (
              <div className="px-6 py-4 border-b border-slate-200 bg-blue-50">
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">
                    Record New Payment
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Amount <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={paymentSummary?.balance || 0}
                        value={paymentForm.amount}
                        onChange={(e) => {
                          const value = e.target.value;
                          const numValue = parseFloat(value);
                          const maxBalance = paymentSummary?.balance || 0;
                          // Cap the value at max balance
                          if (!isNaN(numValue) && numValue > maxBalance) {
                            setPaymentForm((prev) => ({
                              ...prev,
                              amount: maxBalance.toString(),
                            }));
                          } else {
                            setPaymentForm((prev) => ({
                              ...prev,
                              amount: value,
                            }));
                          }
                        }}
                        placeholder="Enter amount"
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          paymentForm.amount &&
                          Number(paymentForm.amount) >
                            (paymentSummary?.balance || 0)
                            ? "border-red-500 bg-red-50"
                            : "border-slate-300"
                        }`}
                        required
                      />
                      {paymentSummary && (
                        <p className="text-xs text-slate-500 mt-1">
                          Max: {formatCurrency(paymentSummary.balance)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Payment Date
                      </label>
                      <input
                        type="date"
                        value={paymentForm.payment_date}
                        onChange={(e) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            payment_date: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Payment Type
                      </label>
                      <select
                        value={paymentForm.payment_type}
                        onChange={(e) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            payment_type: e.target.value as any,
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="advance">Advance</option>
                        <option value="regular">Regular</option>
                        <option value="final">Final</option>
                        <option value="adjustment">Adjustment</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentForm.payment_method}
                        onChange={(e) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            payment_method: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select method...</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Reference Number
                      </label>
                      <input
                        type="text"
                        value={paymentForm.reference_number}
                        onChange={(e) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            reference_number: e.target.value,
                          }))
                        }
                        placeholder="e.g., Cheque number"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Bank Reference
                      </label>
                      <input
                        type="text"
                        value={paymentForm.bank_reference}
                        onChange={(e) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            bank_reference: e.target.value,
                          }))
                        }
                        placeholder="e.g., UTR number"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={paymentForm.notes}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Add any notes about this payment..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPaymentForm(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={paymentLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {paymentLoading ? "Recording..." : "Record Payment"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Payment History */}
            <div className="px-6 py-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">
                Payment History
              </h4>
              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <svg
                    className="w-12 h-12 mx-auto text-slate-300 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">
                    No payments recorded
                  </h3>
                  <p className="text-xs text-slate-500">
                    {canMakePayment
                      ? "Click 'Record Payment' to add the first payment."
                      : "Payment recording will be available once the PO is approved."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                          Date
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                          Method
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                          Reference
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                          Recorded By
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-900">
                            {formatDate(payment.payment_date)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-semibold text-green-600">
                              {formatCurrency(payment.amount)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                                payment.payment_type === "advance"
                                  ? "bg-blue-100 text-blue-700"
                                  : payment.payment_type === "final"
                                  ? "bg-green-100 text-green-700"
                                  : payment.payment_type === "adjustment"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {payment.payment_type?.charAt(0).toUpperCase() +
                                payment.payment_type?.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {payment.payment_method
                              ?.replace(/_/g, " ")
                              .split(" ")
                              .map(
                                (w: string) =>
                                  w.charAt(0).toUpperCase() + w.slice(1)
                              )
                              .join(" ") || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {payment.reference_number ||
                              payment.bank_reference ||
                              "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {payment.created_by_user?.full_name || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">
                            {payment.notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order Details Tab Content */}
        {(activeTab === "details" ||
          (!canReceiveGoods &&
            activeTab !== "history" &&
            activeTab !== "payments")) && (
          <div className="grid grid-cols-5 gap-6">
            {/* Main Content - 3 columns */}
            <div className="col-span-3 space-y-6">
              {/* Line Items */}
              <div className="bg-white rounded-lg border border-slate-200">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardIcon className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-medium text-slate-900">
                      Line Items ({purchaseOrder.items?.length || 0})
                    </h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">
                          #
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">
                          Material
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">
                          Project
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">
                          Qty
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">
                          Rate
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">
                          Total
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">
                          Received
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchaseOrder.items?.map((item, index) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-slate-900">
                              {item.material?.name || "Unknown"}
                            </div>
                            <div className="text-xs text-slate-500">
                              SKU: {item.material?.sku || "-"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {item.project_id ? (
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                                {item.project?.project_number || "Project"}
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                                {POCostTypeLabels[
                                  item.cost_type as keyof typeof POCostTypeLabels
                                ] || "Stock"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-900">
                            {item.quantity}{" "}
                            {item.material?.unit_of_measure || "pcs"}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-900">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                            {formatCurrency(item.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`text-sm font-medium ${
                                item.received_quantity >= item.quantity
                                  ? "text-green-600"
                                  : item.received_quantity > 0
                                  ? "text-orange-600"
                                  : "text-slate-400"
                              }`}
                            >
                              {item.received_quantity} / {item.quantity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Subtotal:</span>
                        <span className="font-medium text-slate-900">
                          {formatCurrency(purchaseOrder.subtotal)}
                        </span>
                      </div>
                      {purchaseOrder.discount_amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Discount:</span>
                          <span className="font-medium text-green-600">
                            -{formatCurrency(purchaseOrder.discount_amount)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Tax (GST):</span>
                        <span className="font-medium text-slate-900">
                          {formatCurrency(purchaseOrder.tax_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-base font-semibold border-t border-slate-300 pt-2 mt-2">
                        <span className="text-slate-900">Grand Total:</span>
                        <span className="text-blue-600">
                          {formatCurrency(purchaseOrder.total_amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {purchaseOrder.notes && (
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">
                    Notes
                  </h3>
                  <p className="text-sm text-slate-600 whitespace-pre-line">
                    {purchaseOrder.notes}
                  </p>
                </div>
              )}

              {/* Goods Receipt Notes (GRN) History */}
              {(relatedGRNs.length > 0 ||
                [
                  "dispatched",
                  "acknowledged",
                  "partially_received",
                  "fully_received",
                ].includes(purchaseOrder.status)) && (
                <div className="bg-white rounded-lg border border-slate-200">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <h3 className="text-sm font-medium text-slate-900">
                        Goods Receipt Notes ({relatedGRNs.length})
                      </h3>
                    </div>
                    {[
                      "dispatched",
                      "acknowledged",
                      "partially_received",
                    ].includes(purchaseOrder.status) && (
                      <button
                        onClick={() => setActiveTab("receive")}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        Receive Goods
                      </button>
                    )}
                  </div>

                  {relatedGRNs.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <svg
                        className="w-10 h-10 mx-auto mb-2 text-slate-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-sm text-slate-500 mb-3">
                        No goods receipts recorded yet
                      </p>
                      {[
                        "dispatched",
                        "acknowledged",
                        "partially_received",
                      ].includes(purchaseOrder.status) && (
                        <button
                          onClick={() => setActiveTab("receive")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                            />
                          </svg>
                          Receive Goods
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {relatedGRNs.map((grn) => (
                        <div
                          key={grn.id}
                          className="px-4 py-3 hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Link
                              href={`/dashboard/stock/grn/${grn.id}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700"
                            >
                              {grn.grn_number}
                            </Link>
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                                grn.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : grn.status === "partial"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {grn.status === "completed"
                                ? "Completed"
                                : grn.status === "partial"
                                ? "Partial"
                                : grn.status.charAt(0).toUpperCase() +
                                  grn.status.slice(1).replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>
                              <svg
                                className="w-3 h-3 inline mr-1"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              {formatDate(grn.received_date)}
                            </span>
                            {grn.received_by_user && (
                              <span>
                                <svg
                                  className="w-3 h-3 inline mr-1"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                                {grn.received_by_user.full_name}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-slate-600">
                              Items: {grn.items?.length || 0}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-green-600 font-medium">
                              Accepted:{" "}
                              {grn.items?.reduce(
                                (sum: number, item: any) =>
                                  sum + Number(item.quantity_accepted),
                                0
                              ) || 0}
                            </span>
                            {grn.items?.some(
                              (item: any) => Number(item.quantity_rejected) > 0
                            ) && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-red-600 font-medium">
                                  Rejected:{" "}
                                  {grn.items?.reduce(
                                    (sum: number, item: any) =>
                                      sum + Number(item.quantity_rejected),
                                    0
                                  ) || 0}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar - 2 columns */}
            <div className="col-span-2 space-y-6">
              {/* Vendor Details */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BuildingIcon className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-medium text-slate-700">Vendor</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {purchaseOrder.vendor?.name || "Unknown Vendor"}
                  </p>
                  {purchaseOrder.vendor?.contact_person && (
                    <p className="text-xs text-slate-600">
                      {purchaseOrder.vendor.contact_person}
                    </p>
                  )}
                  {purchaseOrder.vendor?.email && (
                    <p className="text-xs text-slate-600">
                      {purchaseOrder.vendor.email}
                    </p>
                  )}
                  {purchaseOrder.vendor?.phone && (
                    <p className="text-xs text-slate-600">
                      {purchaseOrder.vendor.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Order Details */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarIcon className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-medium text-slate-700">
                    Order Details
                  </h3>
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Order Date</span>
                    <span className="text-xs font-medium text-slate-900">
                      {formatDate(purchaseOrder.order_date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">
                      Expected Delivery
                    </span>
                    <span className="text-xs font-medium text-slate-900">
                      {formatDate(purchaseOrder.expected_delivery)}
                    </span>
                  </div>
                  {purchaseOrder.payment_terms && (
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">
                        Payment Terms
                      </span>
                      <span className="text-xs font-medium text-slate-900">
                        {purchaseOrder.payment_terms}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Created</span>
                    <span className="text-xs font-medium text-slate-900">
                      {formatDate(purchaseOrder.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CurrencyIcon className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-medium text-slate-700">
                    Payment
                  </h3>
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Status</span>
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                        POPaymentStatusColors[
                          purchaseOrder.payment_status as POPaymentStatus
                        ]?.bg || "bg-slate-100"
                      } ${
                        POPaymentStatusColors[
                          purchaseOrder.payment_status as POPaymentStatus
                        ]?.text || "text-slate-700"
                      }`}
                    >
                      {POPaymentStatusLabels[
                        purchaseOrder.payment_status as POPaymentStatus
                      ] || "Pending"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Total Amount</span>
                    <span className="text-xs font-medium text-slate-900">
                      {formatCurrency(purchaseOrder.total_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Amount Paid</span>
                    <span className="text-xs font-medium text-green-600">
                      {formatCurrency(purchaseOrder.amount_paid || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="text-xs font-medium text-slate-700">
                      Balance Due
                    </span>
                    <span className="text-xs font-semibold text-red-600">
                      {formatCurrency(
                        purchaseOrder.total_amount -
                          (purchaseOrder.amount_paid || 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              {purchaseOrder.shipping_address && (
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPinIcon className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-medium text-slate-700">
                      Shipping Address
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 whitespace-pre-line">
                    {purchaseOrder.shipping_address}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {purchaseOrder && (
          <EditPurchaseOrderModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={() => {
              setIsEditModalOpen(false);
              fetch(`/api/stock/purchase-orders/${id}`)
                .then((res) => res.json())
                .then((data) => setPurchaseOrder(data.purchaseOrder));
            }}
            purchaseOrder={purchaseOrder}
          />
        )}
      </div>
    </>
  );
}
