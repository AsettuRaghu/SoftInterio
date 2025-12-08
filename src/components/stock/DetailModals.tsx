"use client";

import React from "react";
import { Modal, ModalBody } from "@/components/ui/Modal";
import { XMarkIcon } from "@heroicons/react/24/outline";

// ============================================
// Status Colors & Labels
// ============================================
export const MR_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  partially_fulfilled: "Partial",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const MR_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  partially_fulfilled: "bg-orange-100 text-orange-700",
  fulfilled: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-700",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

// ============================================
// Material Requisition Detail Modal
// ============================================
interface MaterialRequisitionItem {
  id: string;
  quantity_requested: number;
  quantity_approved: number | null;
  material?: {
    name: string;
    sku: string;
    unit_of_measure: string;
  } | null;
}

interface MaterialRequisition {
  id: string;
  mr_number: string;
  status: string;
  priority: string;
  required_date: string | null;
  notes: string | null;
  created_at: string;
  project?: { name: string } | null;
  requested_by_user?: { full_name: string } | null;
  approved_by_user?: { full_name: string } | null;
  items?: MaterialRequisitionItem[];
}

interface RequisitionDetailModalProps {
  requisition: MaterialRequisition;
  onClose: () => void;
  onSubmit?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

export function RequisitionDetailModal({
  requisition,
  onClose,
  onSubmit,
  onApprove,
  onReject,
}: RequisitionDetailModalProps) {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={requisition.mr_number}
      subtitle="Material Requisition Details"
      size="2xl"
    >
      <ModalBody maxHeight="500px">
        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <span
                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                  MR_STATUS_COLORS[requisition.status]
                }`}
              >
                {MR_STATUS_LABELS[requisition.status]}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Priority</p>
              <span
                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                  PRIORITY_COLORS[requisition.priority]
                }`}
              >
                {PRIORITY_LABELS[requisition.priority]}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Project</p>
              <p className="font-medium text-slate-900">
                {requisition.project?.name || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Required Date</p>
              <p className="font-medium text-slate-900">
                {requisition.required_date
                  ? new Date(requisition.required_date).toLocaleDateString()
                  : "Not specified"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Requested By</p>
              <p className="font-medium text-slate-900">
                {requisition.requested_by_user?.full_name || "Unknown"}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(requisition.created_at).toLocaleString()}
              </p>
            </div>
            {requisition.approved_by_user && (
              <div>
                <p className="text-sm text-slate-500">Approved By</p>
                <p className="font-medium text-slate-900">
                  {requisition.approved_by_user.full_name}
                </p>
              </div>
            )}
          </div>

          {requisition.notes && (
            <div>
              <p className="text-sm text-slate-500 mb-1">Notes</p>
              <p className="text-slate-900">{requisition.notes}</p>
            </div>
          )}

          {/* Items */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Requested Items
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Material
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      Qty Requested
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      Qty Approved
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requisition.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {item.material?.name}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {item.material?.sku}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right">
                        {item.quantity_requested}{" "}
                        {item.material?.unit_of_measure}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right">
                        {item.quantity_approved !== null
                          ? `${item.quantity_approved} ${item.material?.unit_of_measure}`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ModalBody>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Close
        </button>
        {requisition.status === "draft" && onSubmit && (
          <button
            onClick={onSubmit}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Submit for Approval
          </button>
        )}
        {requisition.status === "submitted" && (
          <>
            {onReject && (
              <button
                onClick={onReject}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
            )}
            {onApprove && (
              <button
                onClick={onApprove}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Approve
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ============================================
// GRN Status Colors & Labels
// ============================================
export const GRN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_inspection: "Pending QC",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const GRN_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  pending_inspection: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

// ============================================
// GRN Detail Modal
// ============================================
interface GRNItem {
  id: string;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  rejection_reason: string | null;
  po_item?: {
    material?: {
      name: string;
      sku: string;
      unit_of_measure: string;
    };
  };
}

interface GoodsReceipt {
  id: string;
  grn_number: string;
  status: string;
  received_date: string;
  delivery_note_number: string | null;
  vehicle_number: string | null;
  notes: string | null;
  purchase_order?: {
    po_number: string;
    vendor?: { name: string } | null;
  } | null;
  received_by_user?: { full_name: string } | null;
  items?: GRNItem[];
}

interface GRNDetailModalProps {
  grn: GoodsReceipt;
  onClose: () => void;
  onPrint?: () => void;
}

export function GRNDetailModal({ grn, onClose, onPrint }: GRNDetailModalProps) {
  const totalReceived =
    grn.items?.reduce((sum, item) => sum + item.quantity_received, 0) || 0;
  const totalAccepted =
    grn.items?.reduce((sum, item) => sum + item.quantity_accepted, 0) || 0;
  const totalRejected =
    grn.items?.reduce((sum, item) => sum + item.quantity_rejected, 0) || 0;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={grn.grn_number}
      subtitle="Goods Receipt Note Details"
      size="full"
    >
      <ModalBody maxHeight="500px">
        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <span
                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                  GRN_STATUS_COLORS[grn.status]
                }`}
              >
                {GRN_STATUS_LABELS[grn.status]}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Purchase Order</p>
              <p className="font-medium text-blue-600">
                {grn.purchase_order?.po_number}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Vendor</p>
              <p className="font-medium text-slate-900">
                {grn.purchase_order?.vendor?.name || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Received Date</p>
              <p className="font-medium text-slate-900">
                {new Date(grn.received_date).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-500">Received By</p>
              <p className="font-medium text-slate-900">
                {grn.received_by_user?.full_name || "Unknown"}
              </p>
            </div>
            {grn.delivery_note_number && (
              <div>
                <p className="text-sm text-slate-500">Delivery Note</p>
                <p className="font-medium text-slate-900">
                  {grn.delivery_note_number}
                </p>
              </div>
            )}
            {grn.vehicle_number && (
              <div>
                <p className="text-sm text-slate-500">Vehicle Number</p>
                <p className="font-medium text-slate-900">
                  {grn.vehicle_number}
                </p>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600">Total Received</p>
              <p className="text-2xl font-bold text-blue-700">
                {totalReceived}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600">Accepted</p>
              <p className="text-2xl font-bold text-green-700">
                {totalAccepted}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-red-600">Rejected</p>
              <p className="text-2xl font-bold text-red-700">{totalRejected}</p>
            </div>
          </div>

          {grn.notes && (
            <div>
              <p className="text-sm text-slate-500 mb-1">Notes</p>
              <p className="text-slate-900">{grn.notes}</p>
            </div>
          )}

          {/* Items */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Received Items
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Material
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      Received
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      Accepted
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      Rejected
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Rejection Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grn.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {item.po_item?.material?.name}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {item.po_item?.material?.sku}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right">
                        {item.quantity_received}{" "}
                        {item.po_item?.material?.unit_of_measure}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">
                        {item.quantity_accepted}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600 text-right font-medium">
                        {item.quantity_rejected}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {item.rejection_reason || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ModalBody>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Close
        </button>
        {onPrint && (
          <button
            onClick={onPrint}
            className="px-4 py-2 text-sm font-medium bg-slate-600 text-white rounded-lg hover:bg-slate-700"
          >
            Print GRN
          </button>
        )}
      </div>
    </Modal>
  );
}
