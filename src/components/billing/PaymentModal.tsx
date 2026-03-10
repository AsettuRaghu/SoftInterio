/**
 * Payment Modal Component
 * Displays Razorpay payment form for subscription payment
 * Used in: src/app/dashboard/settings/billing/page.tsx
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { uiLogger } from "@/lib/logger";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  billingCycle: "monthly" | "yearly";
  onSuccess: (invoiceId: string) => void;
  onError: (error: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  planId,
  billingCycle,
  onSuccess,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const razorpayScriptLoaded = useRef(false);

  // Load Razorpay script
  useEffect(() => {
    if (!razorpayScriptLoaded.current) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        razorpayScriptLoaded.current = true;
      };
      script.onerror = () => {
        uiLogger.error(
          "Failed to load Razorpay script",
          new Error("Script load failed"),
        );
        setError(
          "Failed to load payment service. Please refresh and try again.",
        );
      };
      document.head.appendChild(script);
    }
  }, []);

  const handlePayment = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Create payment order
      uiLogger.info("Creating payment order", {
        action: "create_payment_order",
        planId,
        billingCycle,
      });

      const orderResponse = await fetch("/api/billing/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          billingCycle,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || "Failed to create payment order");
      }

      const { orderId, keyId, amount, currency, customerName, email } =
        orderData.data;

      uiLogger.info("Payment order created", {
        action: "payment_order_created",
        orderId,
        amount,
      });

      // Step 2: Open Razorpay modal
      const options = {
        key: keyId,
        amount: Math.round(amount * 100), // Convert to paise
        currency: currency,
        name: "SoftInterio",
        description: `${billingCycle === "yearly" ? "Annual" : "Monthly"} Subscription`,
        order_id: orderId,
        prefill: {
          name: customerName,
          email: email,
        },
        theme: {
          color: "#0f172a", // slate-900
        },
        method: {
          upi: 1,
          card: 1,
          netbanking: 1,
          wallet: 0,
          emandate: 0,
          emi: 0,
          paylater: 0,
          cardless_emi: 0,
        },
        handler: async (response: any) => {
          try {
            // Step 3: Verify payment
            uiLogger.info("Payment completed by Razorpay, verifying...", {
              action: "verify_payment",
              paymentId: response.razorpay_payment_id,
            });

            const verifyResponse = await fetch("/api/billing/payment", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok) {
              throw new Error(
                verifyData.error || "Payment verification failed",
              );
            }

            uiLogger.info("Payment verified successfully", {
              action: "payment_verified",
              invoiceId: verifyData.data?.invoiceId,
            });

            // Success!
            onSuccess(verifyData.data?.invoiceId || "");
            onClose();
          } catch (verifyError) {
            const errorMessage =
              verifyError instanceof Error
                ? verifyError.message
                : "Payment verification failed";
            uiLogger.error("Payment verification failed", verifyError, {
              action: "payment_verification_failed",
            });
            onError(errorMessage);
            setError(errorMessage);
          }
        },
        modal: {
          ondismiss: () => {
            uiLogger.info("Payment modal dismissed", {
              action: "payment_modal_dismissed",
            });
            setIsLoading(false);
          },
        },
      };

      // Create and open Razorpay checkout
      if (!window.Razorpay) {
        throw new Error("Payment service not loaded. Please refresh the page.");
      }

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Payment failed";
      uiLogger.error("Payment error", err, {
        action: "payment_error",
        planId,
        billingCycle,
      });
      onError(errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Complete Payment
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 mb-1">Billing Cycle</p>
              <p className="text-sm font-semibold text-slate-900 capitalize">
                {billingCycle}
              </p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-600 mb-2">🔒 Secure Payment</p>
              <p className="text-sm text-blue-700">
                Your payment will be processed securely by Razorpay
              </p>
            </div>

            <p className="text-xs text-slate-500 text-center">
              Click "Pay Now" to open the payment gateway
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium text-sm disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              "Pay Now"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
