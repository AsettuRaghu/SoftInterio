"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Truck,
  Calendar,
  FileText,
  AlertCircle,
  Check,
  X,
  Loader2,
} from "lucide-react";

interface POItem {
  id: string;
  material: {
    id: string;
    name: string;
    sku: string;
    unit_of_measure: string;
  };
  quantity: number;
  unit_price: number;
  total_price: number;
  previously_received?: number;
  pending_quantity?: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  vendor: {
    id: string;
    name: string;
    code: string;
  };
  items: POItem[];
  total_amount: number;
}

interface GRNItem {
  po_item_id: string;
  material_name: string;
  material_sku: string;
  unit: string;
  ordered_qty: number;
  previously_received: number;
  pending_qty: number;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  rejection_reason: string;
  storage_location: string;
  notes: string;
}

function GRNCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poId = searchParams.get("po");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(
    null
  );

  // Form state
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [grnItems, setGrnItems] = useState<GRNItem[]>([]);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      5000
    );
  };

  // Fetch PO details and previously received quantities
  useEffect(() => {
    const fetchPODetails = async () => {
      if (!poId) {
        setError("No Purchase Order specified");
        setLoading(false);
        return;
      }

      try {
        // Fetch PO details
        const poResponse = await fetch(`/api/stock/purchase-orders/${poId}`);
        if (!poResponse.ok) {
          throw new Error("Failed to fetch Purchase Order");
        }
        const poData = await poResponse.json();

        // Check if PO is in a valid status
        const validStatuses = [
          "dispatched",
          "acknowledged",
          "partially_received",
        ];
        if (!validStatuses.includes(poData.purchaseOrder.status)) {
          setError(
            `Cannot create GRN for PO with status "${poData.purchaseOrder.status}". PO must be dispatched, acknowledged, or partially received.`
          );
          setLoading(false);
          return;
        }

        // Fetch previously received quantities for this PO
        const grnResponse = await fetch(`/api/stock/grn?po_id=${poId}`);
        const grnData = await grnResponse.json();

        // Calculate previously received quantities per item
        const previouslyReceived: Record<string, number> = {};
        (grnData.grns || []).forEach((grn: any) => {
          if (grn.status === "completed") {
            (grn.items || []).forEach((item: any) => {
              previouslyReceived[item.po_item_id] =
                (previouslyReceived[item.po_item_id] || 0) +
                Number(item.quantity_accepted);
            });
          }
        });

        // Add previously received info to PO items
        const enrichedItems = poData.purchaseOrder.items.map((item: any) => ({
          ...item,
          previously_received: previouslyReceived[item.id] || 0,
          pending_quantity: item.quantity - (previouslyReceived[item.id] || 0),
        }));

        setPurchaseOrder({
          ...poData.purchaseOrder,
          items: enrichedItems,
        });

        // Initialize GRN items
        const initialGrnItems: GRNItem[] = enrichedItems
          .filter((item: POItem) => (item.pending_quantity || 0) > 0)
          .map((item: POItem) => ({
            po_item_id: item.id,
            material_name: item.material.name,
            material_sku: item.material.sku,
            unit: item.material.unit_of_measure,
            ordered_qty: item.quantity,
            previously_received: item.previously_received || 0,
            pending_qty: item.pending_quantity || item.quantity,
            quantity_received: item.pending_quantity || item.quantity,
            quantity_accepted: item.pending_quantity || item.quantity,
            quantity_rejected: 0,
            rejection_reason: "",
            storage_location: "",
            notes: "",
          }));

        setGrnItems(initialGrnItems);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching PO:", err);
        setError("Failed to load Purchase Order details");
        setLoading(false);
      }
    };

    fetchPODetails();
  }, [poId]);

  const updateGrnItem = (index: number, field: keyof GRNItem, value: any) => {
    setGrnItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-calculate accepted when received changes
      if (field === "quantity_received") {
        const received = Number(value) || 0;
        const rejected = Number(updated[index].quantity_rejected) || 0;
        updated[index].quantity_accepted = Math.max(0, received - rejected);
      }

      // Auto-calculate accepted when rejected changes
      if (field === "quantity_rejected") {
        const received = Number(updated[index].quantity_received) || 0;
        const rejected = Number(value) || 0;
        updated[index].quantity_accepted = Math.max(0, received - rejected);
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Validate that at least one item has quantity received
      const validItems = grnItems.filter(
        (item) => Number(item.quantity_received) > 0
      );
      if (validItems.length === 0) {
        setError(
          "At least one item must have a received quantity greater than 0"
        );
        setSubmitting(false);
        return;
      }

      // Validate quantities
      for (const item of validItems) {
        if (Number(item.quantity_received) > item.pending_qty) {
          setError(
            `Received quantity for "${item.material_name}" cannot exceed pending quantity (${item.pending_qty})`
          );
          setSubmitting(false);
          return;
        }
        if (Number(item.quantity_rejected) > Number(item.quantity_received)) {
          setError(
            `Rejected quantity for "${item.material_name}" cannot exceed received quantity`
          );
          setSubmitting(false);
          return;
        }
      }

      const response = await fetch("/api/stock/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: poId,
          received_date: receivedDate,
          delivery_note_number: deliveryNoteNumber || null,
          vehicle_number: vehicleNumber || null,
          notes: notes || null,
          items: validItems.map((item) => ({
            po_item_id: item.po_item_id,
            quantity_received: Number(item.quantity_received),
            quantity_accepted: Number(item.quantity_accepted),
            quantity_rejected: Number(item.quantity_rejected),
            rejection_reason: item.rejection_reason || null,
            storage_location: item.storage_location || null,
            notes: item.notes || null,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create GRN");
      }

      showToast("GRN created successfully! PO status updated.", "success");
      setTimeout(() => {
        router.push(`/dashboard/stock/purchase-orders/${poId}`);
      }, 1500);
    } catch (err: any) {
      console.error("Error creating GRN:", err);
      showToast(err.message || "Failed to create GRN", "error");
      setError(err.message || "Failed to create GRN");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !purchaseOrder) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
          <div>
            <h3 className="font-semibold text-red-800">Error</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <Link
              href="/dashboard/stock/purchase-orders"
              className="inline-flex items-center gap-2 mt-4 text-red-600 hover:text-red-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Purchase Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
            toast.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <span className="font-medium">{toast.message}</span>
          <button
            onClick={() => setToast({ ...toast, show: false })}
            className="ml-2 text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link
            href="/dashboard/stock/purchase-orders"
            className="hover:text-gray-700"
          >
            Purchase Orders
          </Link>
          <span>/</span>
          <Link
            href={`/dashboard/stock/purchase-orders/${poId}`}
            className="hover:text-gray-700"
          >
            {purchaseOrder?.po_number}
          </Link>
          <span>/</span>
          <span className="text-gray-900">Create GRN</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/stock/purchase-orders/${poId}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Create Goods Receipt Note
            </h1>
            <p className="text-gray-500 mt-1">
              Record received items for {purchaseOrder?.po_number} from{" "}
              {purchaseOrder?.vendor?.name}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Receipt Details Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-gray-500" />
            Receipt Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Received Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Note Number
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={deliveryNoteNumber}
                  onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                  placeholder="DN-12345"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Number
              </label>
              <div className="relative">
                <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="KA-01-AB-1234"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Items to Receive */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-500" />
            Items to Receive
          </h2>

          {grnItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>All items have been fully received.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                      Material
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                      Ordered
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                      Prev. Received
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                      Pending
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 w-32">
                      Received *
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 w-32">
                      Rejected
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 w-32">
                      Accepted
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                      Rejection Reason
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grnItems.map((item, index) => (
                    <tr
                      key={item.po_item_id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {item.material_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.material_sku}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900">
                        {item.ordered_qty} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500">
                        {item.previously_received} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-medium ${
                            item.pending_qty > 0
                              ? "text-orange-600"
                              : "text-green-600"
                          }`}
                        >
                          {item.pending_qty} {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0"
                          max={item.pending_qty}
                          step="0.01"
                          value={item.quantity_received}
                          onChange={(e) =>
                            updateGrnItem(
                              index,
                              "quantity_received",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0"
                          max={item.quantity_received}
                          step="0.01"
                          value={item.quantity_rejected}
                          onChange={(e) =>
                            updateGrnItem(
                              index,
                              "quantity_rejected",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-full px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-right font-medium text-green-700">
                          {item.quantity_accepted}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={item.rejection_reason}
                          onChange={(e) =>
                            updateGrnItem(
                              index,
                              "rejection_reason",
                              e.target.value
                            )
                          }
                          placeholder={
                            Number(item.quantity_rejected) > 0
                              ? "Reason required"
                              : ""
                          }
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={Number(item.quantity_rejected) === 0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">Receipt Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-blue-700">Total Items</div>
              <div className="text-2xl font-bold text-blue-900">
                {grnItems.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-blue-700">Total Receiving</div>
              <div className="text-2xl font-bold text-blue-900">
                {grnItems.reduce(
                  (sum, item) => sum + Number(item.quantity_received),
                  0
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-blue-700">Total Accepted</div>
              <div className="text-2xl font-bold text-green-700">
                {grnItems.reduce(
                  (sum, item) => sum + Number(item.quantity_accepted),
                  0
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/dashboard/stock/purchase-orders/${poId}`}
            className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || grnItems.length === 0}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Create GRN
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function GRNCreatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <GRNCreateContent />
    </Suspense>
  );
}
