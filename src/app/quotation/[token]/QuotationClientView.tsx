"use client";

import React, { useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

interface LineItem {
  id: string;
  name: string;
  group_name?: string;
  unit_code: string;
  length?: number;
  width?: number;
  quantity?: number;
  rate: number;
  amount: number;
}

interface Component {
  id: string;
  name: string;
  description?: string;
  line_items: LineItem[];
  subtotal: number;
}

interface Space {
  id: string;
  name: string;
  space_type_name?: string;
  components: Component[];
  subtotal: number;
}

interface PaymentTerm {
  milestone: string;
  percent: number;
  description?: string;
}

interface Company {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
}

interface Quotation {
  id: string;
  quotation_number: string;
  version: number;
  title?: string;
  description?: string;
  status: string;
  valid_from?: string;
  valid_until?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  property_name?: string;
  property_address?: string;
  property_type?: string;
  carpet_area?: number;
  subtotal: number;
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  tax_percent?: number;
  tax_amount?: number;
  grand_total: number;
  payment_terms?: PaymentTerm[];
  terms_and_conditions?: string;
  notes?: string;
  presentation_level?: string;
  hide_dimensions?: boolean;
  spaces: Space[];
}

interface Props {
  quotation: Quotation;
  company?: Company;
  token: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export function QuotationClientView({ quotation, company, token }: Props) {
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(
    new Set(quotation.spaces.map((s) => s.id))
  );
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(
    new Set()
  );
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionComplete, setActionComplete] = useState<
    "approved" | "rejected" | null
  >(null);

  const showFullDetail = quotation.presentation_level === "full_detail";
  const showComponents = quotation.presentation_level !== "space_only";

  const toggleSpace = (spaceId: string) => {
    const newExpanded = new Set(expandedSpaces);
    if (newExpanded.has(spaceId)) {
      newExpanded.delete(spaceId);
    } else {
      newExpanded.add(spaceId);
    }
    setExpandedSpaces(newExpanded);
  };

  const toggleComponent = (componentId: string) => {
    const newExpanded = new Set(expandedComponents);
    if (newExpanded.has(componentId)) {
      newExpanded.delete(componentId);
    } else {
      newExpanded.add(componentId);
    }
    setExpandedComponents(newExpanded);
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/quotations/client/${token}/approve`, {
        method: "POST",
      });
      if (response.ok) {
        setActionComplete("approved");
      }
    } catch (error) {
      console.error("Error approving:", error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const response = await fetch(`/api/quotations/client/${token}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (response.ok) {
        setActionComplete("rejected");
        setShowRejectModal(false);
      }
    } catch (error) {
      console.error("Error rejecting:", error);
    } finally {
      setIsRejecting(false);
    }
  };

  const downloadPDF = () => {
    window.open(`/api/quotations/client/${token}/pdf`, "_blank");
  };

  const isExpired = quotation.valid_until
    ? new Date(quotation.valid_until) < new Date()
    : false;

  const canTakeAction =
    quotation.status === "sent" ||
    quotation.status === "viewed" ||
    quotation.status === "negotiating";

  if (actionComplete) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              actionComplete === "approved" ? "bg-green-100" : "bg-red-100"
            }`}
          >
            {actionComplete === "approved" ? (
              <CheckCircleIcon className="w-10 h-10 text-green-600" />
            ) : (
              <XCircleIcon className="w-10 h-10 text-red-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Quotation {actionComplete === "approved" ? "Approved" : "Rejected"}
          </h1>
          <p className="text-slate-600 mb-6">
            {actionComplete === "approved"
              ? "Thank you! The team has been notified and will be in touch soon."
              : "Your feedback has been sent to the team. They will reach out to discuss further."}
          </p>
          <p className="text-sm text-slate-500">
            Quotation: {quotation.quotation_number}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {company?.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="h-10 object-contain"
                />
              ) : (
                <div className="text-xl font-bold text-blue-600">
                  {company?.name || "Interior Design"}
                </div>
              )}
            </div>
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
            >
              <DocumentArrowDownIcon className="w-5 h-5" />
              Download PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Quotation Header Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Quotation</h1>
                <p className="text-blue-100 text-lg">
                  {quotation.quotation_number} (v{quotation.version})
                </p>
                {quotation.title && (
                  <p className="text-blue-100 mt-2">{quotation.title}</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold mb-2">
                  {formatCurrency(quotation.grand_total)}
                </div>
                <div className="text-blue-100">
                  Valid until: {formatDate(quotation.valid_until)}
                </div>
                {isExpired && (
                  <span className="inline-block mt-2 px-3 py-1 bg-red-500 rounded-full text-sm">
                    Expired
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Client & Property Info */}
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Prepared For
              </h3>
              <p className="text-lg font-semibold text-slate-900 mb-2">
                {quotation.client_name || "Client"}
              </p>
              {quotation.client_phone && (
                <p className="text-slate-600 flex items-center gap-2 text-sm mb-1">
                  <PhoneIcon className="w-4 h-4" />
                  {quotation.client_phone}
                </p>
              )}
              {quotation.client_email && (
                <p className="text-slate-600 flex items-center gap-2 text-sm">
                  <EnvelopeIcon className="w-4 h-4" />
                  {quotation.client_email}
                </p>
              )}
            </div>
            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Property Details
              </h3>
              <p className="text-lg font-semibold text-slate-900 mb-2">
                {quotation.property_name || "Property"}
              </p>
              {quotation.property_address && (
                <p className="text-slate-600 flex items-center gap-2 text-sm mb-1">
                  <MapPinIcon className="w-4 h-4" />
                  {quotation.property_address}
                </p>
              )}
              <div className="flex gap-4 mt-2">
                {quotation.property_type && (
                  <span className="text-sm text-slate-600">
                    Type:{" "}
                    <span className="font-medium">
                      {quotation.property_type.toUpperCase()}
                    </span>
                  </span>
                )}
                {quotation.carpet_area && (
                  <span className="text-sm text-slate-600">
                    Area:{" "}
                    <span className="font-medium">
                      {quotation.carpet_area} sq.ft
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scope of Work */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Scope of Work
            </h2>
          </div>

          <div className="divide-y divide-slate-200">
            {quotation.spaces.map((space) => (
              <div key={space.id} className="bg-white">
                {/* Space Header */}
                <button
                  onClick={() => toggleSpace(space.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    {expandedSpaces.has(space.id) ? (
                      <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 text-slate-400" />
                    )}
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <BuildingOfficeIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-slate-900">
                        {space.name}
                      </h3>
                      {showComponents && (
                        <p className="text-sm text-slate-500">
                          {space.components.length} items
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-blue-600">
                      {formatCurrency(space.subtotal)}
                    </span>
                  </div>
                </button>

                {/* Space Content */}
                {expandedSpaces.has(space.id) && showComponents && (
                  <div className="px-6 pb-4">
                    <div className="ml-8 space-y-3">
                      {space.components.map((component) => (
                        <div
                          key={component.id}
                          className="bg-slate-50 rounded-xl overflow-hidden"
                        >
                          {/* Component Header */}
                          <button
                            onClick={() => toggleComponent(component.id)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition"
                          >
                            <div className="flex items-center gap-2">
                              {showFullDetail &&
                                component.line_items.length > 0 &&
                                (expandedComponents.has(component.id) ? (
                                  <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronRightIcon className="w-4 h-4 text-slate-400" />
                                ))}
                              <div>
                                <span className="font-medium text-slate-900">
                                  {component.name}
                                </span>
                              </div>
                            </div>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(component.subtotal)}
                            </span>
                          </button>

                          {/* Component Description */}
                          {component.description && (
                            <div className="px-4 pb-3">
                              <p className="text-sm text-slate-600 italic">
                                {component.description}
                              </p>
                            </div>
                          )}

                          {/* Line Items */}
                          {showFullDetail &&
                            expandedComponents.has(component.id) &&
                            component.line_items.length > 0 && (
                              <div className="border-t border-slate-200 bg-white">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-600">
                                      <th className="px-4 py-2 text-left font-medium">
                                        Item
                                      </th>
                                      {!quotation.hide_dimensions && (
                                        <th className="px-4 py-2 text-center font-medium">
                                          Dimensions
                                        </th>
                                      )}
                                      <th className="px-4 py-2 text-right font-medium">
                                        Rate
                                      </th>
                                      <th className="px-4 py-2 text-right font-medium">
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {component.line_items.map((item) => (
                                      <tr key={item.id}>
                                        <td className="px-4 py-2">
                                          <div className="font-medium text-slate-900">
                                            {item.name}
                                          </div>
                                          {item.group_name && (
                                            <div className="text-xs text-slate-500">
                                              {item.group_name}
                                            </div>
                                          )}
                                        </td>
                                        {!quotation.hide_dimensions && (
                                          <td className="px-4 py-2 text-center text-slate-600">
                                            {item.length && item.width
                                              ? `${item.length} × ${item.width}`
                                              : item.length
                                              ? item.length
                                              : item.quantity || "-"}{" "}
                                            {item.unit_code}
                                          </td>
                                        )}
                                        <td className="px-4 py-2 text-right text-slate-600">
                                          {formatCurrency(item.rate)}/
                                          {item.unit_code}
                                        </td>
                                        <td className="px-4 py-2 text-right font-medium text-slate-900">
                                          {formatCurrency(item.amount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Pricing Summary
            </h2>
          </div>
          <div className="p-6">
            <div className="max-w-sm ml-auto space-y-3">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(quotation.subtotal)}
                </span>
              </div>
              {quotation.discount_amount && quotation.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    Discount{" "}
                    {quotation.discount_type === "percentage"
                      ? `(${quotation.discount_value}%)`
                      : ""}
                  </span>
                  <span className="font-medium">
                    -{formatCurrency(quotation.discount_amount)}
                  </span>
                </div>
              )}
              {quotation.tax_amount && quotation.tax_amount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>GST ({quotation.tax_percent || 18}%)</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(quotation.tax_amount)}
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-slate-900">
                    Grand Total
                  </span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency(quotation.grand_total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Terms */}
        {quotation.payment_terms && quotation.payment_terms.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Payment Terms
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {quotation.payment_terms.map((term, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {term.milestone}
                      </div>
                      {term.description && (
                        <div className="text-sm text-slate-500">
                          {term.description}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        {term.percent}%
                      </div>
                      <div className="text-sm text-slate-600">
                        {formatCurrency(
                          (quotation.grand_total * term.percent) / 100
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Terms & Conditions */}
        {quotation.terms_and_conditions && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Terms & Conditions
              </h2>
            </div>
            <div className="p-6">
              <p className="text-slate-600 whitespace-pre-line">
                {quotation.terms_and_conditions}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {canTakeAction && !isExpired && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="flex-1 sm:flex-none px-8 py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isApproving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircleIcon className="w-5 h-5" />
                )}
                Approve Quotation
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="flex-1 sm:flex-none px-8 py-4 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition flex items-center justify-center gap-2"
              >
                <XCircleIcon className="w-5 h-5" />
                Request Changes
              </button>
            </div>
          </div>
        )}

        {/* Company Contact */}
        {company && (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <p className="text-slate-500 mb-2">
              Questions about this quotation?
            </p>
            <div className="flex items-center justify-center gap-6 text-slate-600">
              {company.phone && (
                <a
                  href={`tel:${company.phone}`}
                  className="flex items-center gap-2 hover:text-blue-600"
                >
                  <PhoneIcon className="w-4 h-4" />
                  {company.phone}
                </a>
              )}
              {company.email && (
                <a
                  href={`mailto:${company.email}`}
                  className="flex items-center gap-2 hover:text-blue-600"
                >
                  <EnvelopeIcon className="w-4 h-4" />
                  {company.email}
                </a>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Request Changes
            </h3>
            <p className="text-slate-600 mb-4">
              Please let us know what changes you&apos;d like to see in this
              quotation.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter your feedback..."
              className="w-full h-32 px-4 py-3 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isRejecting || !rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {isRejecting ? "Sending..." : "Send Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
