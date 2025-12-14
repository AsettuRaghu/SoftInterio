"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";

// ============================================================================
// TYPES
// ============================================================================

interface PaymentTerm {
  milestone: string;
  percent: number;
  description?: string;
}

interface LineItemData {
  name: string;
  unit_code: string;
  length?: number;
  width?: number;
  quantity?: number;
  rate: number;
  amount: number;
}

interface ComponentData {
  name: string;
  description?: string;
  line_items: LineItemData[];
  subtotal: number;
}

interface SpaceData {
  name: string;
  space_type_name?: string;
  components: ComponentData[];
  subtotal: number;
}

interface CompanyDetails {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  gstin?: string;
  logo_url?: string;
}

interface BankDetails {
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch?: string;
}

interface QuotationPDFData {
  quotation_number: string;
  version: number;
  title?: string;
  status: string;
  valid_from?: string;
  valid_until?: string;

  // Client
  client_name?: string;
  client_email?: string;
  client_phone?: string;

  // Property
  property_name?: string;
  property_address?: string;
  property_type?: string;
  carpet_area?: number;

  // Pricing
  subtotal: number;
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  taxable_amount?: number;
  tax_percent?: number;
  tax_amount?: number;
  grand_total: number;

  // Content
  spaces: SpaceData[];

  // Terms
  payment_terms?: PaymentTerm[];
  terms_and_conditions?: string;
  notes?: string;

  // Settings
  presentation_level?: string;
  hide_dimensions?: boolean;
  header_color?: string;

  // Company
  company?: CompanyDetails;
  bank?: BankDetails;
  show_company_details?: boolean;
  show_bank_details?: boolean;
  custom_footer_text?: string;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#1e40af",
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  logo: {
    width: 120,
    height: 40,
    objectFit: "contain",
  },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 4,
  },
  companyDetails: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 2,
  },
  quotationTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 4,
  },
  quotationNumber: {
    fontSize: 12,
    color: "#475569",
  },
  quotationMeta: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },

  // Client/Property Section
  infoSection: {
    flexDirection: "row",
    marginBottom: 25,
    gap: 20,
  },
  infoBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 15,
    borderRadius: 4,
  },
  infoTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 9,
    color: "#64748b",
    width: 80,
  },
  infoValue: {
    fontSize: 9,
    color: "#1e293b",
    flex: 1,
    fontWeight: "medium",
  },

  // Table
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e40af",
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    padding: 8,
    minHeight: 30,
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  tableCell: {
    fontSize: 9,
    color: "#334155",
  },
  tableCellBold: {
    fontSize: 9,
    color: "#1e293b",
    fontWeight: "bold",
  },

  // Space Section
  spaceSection: {
    marginBottom: 20,
  },
  spaceHeader: {
    backgroundColor: "#1e40af",
    padding: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  spaceTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
  },
  spaceSubtotal: {
    fontSize: 11,
    color: "#bfdbfe",
    marginTop: 2,
  },

  // Component
  componentSection: {
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
    paddingLeft: 10,
    marginLeft: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  componentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  componentName: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e293b",
  },
  componentTotal: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1e40af",
  },
  componentDescription: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 8,
    fontStyle: "italic",
  },

  // Line Items
  lineItemsTable: {
    marginTop: 5,
  },
  lineItemHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    padding: 6,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  lineItemRow: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  lineItemCell: {
    fontSize: 8,
    color: "#475569",
  },

  // Totals
  totalsSection: {
    marginTop: 20,
    marginLeft: "auto",
    width: 250,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  totalLabel: {
    fontSize: 10,
    color: "#64748b",
  },
  totalValue: {
    fontSize: 10,
    color: "#1e293b",
    fontWeight: "medium",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    backgroundColor: "#1e40af",
    paddingHorizontal: 10,
    borderRadius: 4,
    marginTop: 5,
  },
  grandTotalLabel: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "bold",
  },
  grandTotalValue: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "bold",
  },

  // Payment Terms
  paymentSection: {
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  paymentTable: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
  },
  paymentRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    padding: 8,
  },
  paymentMilestone: {
    flex: 2,
    fontSize: 9,
    color: "#1e293b",
    fontWeight: "medium",
  },
  paymentPercent: {
    flex: 1,
    fontSize: 9,
    color: "#1e40af",
    fontWeight: "bold",
    textAlign: "center",
  },
  paymentAmount: {
    flex: 1,
    fontSize: 9,
    color: "#1e293b",
    textAlign: "right",
  },
  paymentDescription: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
  },

  // Bank Details
  bankSection: {
    marginTop: 20,
    backgroundColor: "#f8fafc",
    padding: 15,
    borderRadius: 4,
  },
  bankGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
  },
  bankItem: {
    width: "45%",
  },
  bankLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 2,
  },
  bankValue: {
    fontSize: 9,
    color: "#1e293b",
    fontWeight: "medium",
  },

  // Terms
  termsSection: {
    marginTop: 20,
  },
  termsText: {
    fontSize: 8,
    color: "#64748b",
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
  },
  pageNumber: {
    fontSize: 8,
    color: "#64748b",
  },

  // Utilities
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb16: { marginBottom: 16 },
  textRight: { textAlign: "right" },
  textCenter: { textAlign: "center" },
  flexRow: { flexDirection: "row" },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  flex3: { flex: 3 },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

const formatDimensions = (
  item: LineItemData,
  hideDimensions?: boolean
): string => {
  if (hideDimensions) return "-";

  if (item.length && item.width) {
    return `${item.length} × ${item.width} ft`;
  } else if (item.length) {
    return `${item.length} ft`;
  } else if (item.quantity) {
    return `${item.quantity} ${item.unit_code}`;
  }
  return "-";
};

// ============================================================================
// DOCUMENT COMPONENT
// ============================================================================

export function QuotationPDF({ data }: { data: QuotationPDFData }) {
  const showFullDetail = data.presentation_level === "full_detail";
  const showComponents = data.presentation_level !== "space_only";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {data.company?.logo_url ? (
              <Image src={data.company.logo_url} style={styles.logo} />
            ) : (
              <Text style={styles.companyName}>
                {data.company?.name || "Your Company"}
              </Text>
            )}
            {data.show_company_details !== false && data.company && (
              <>
                {data.company.address && (
                  <Text style={styles.companyDetails}>
                    {data.company.address}
                  </Text>
                )}
                {(data.company.phone || data.company.email) && (
                  <Text style={styles.companyDetails}>
                    {[data.company.phone, data.company.email]
                      .filter(Boolean)
                      .join(" | ")}
                  </Text>
                )}
                {data.company.gstin && (
                  <Text style={styles.companyDetails}>
                    GSTIN: {data.company.gstin}
                  </Text>
                )}
              </>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.quotationTitle}>QUOTATION</Text>
            <Text style={styles.quotationNumber}>
              {data.quotation_number} (v{data.version})
            </Text>
            <Text style={styles.quotationMeta}>
              Date: {formatDate(data.valid_from)}
            </Text>
            <Text style={styles.quotationMeta}>
              Valid Until: {formatDate(data.valid_until)}
            </Text>
          </View>
        </View>

        {/* Client & Property Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Client Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{data.client_name || "-"}</Text>
            </View>
            {data.client_phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{data.client_phone}</Text>
              </View>
            )}
            {data.client_email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{data.client_email}</Text>
              </View>
            )}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Property Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Property</Text>
              <Text style={styles.infoValue}>{data.property_name || "-"}</Text>
            </View>
            {data.property_address && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{data.property_address}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>
                {data.property_type?.toUpperCase() || "-"}
              </Text>
            </View>
            {data.carpet_area && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Carpet Area</Text>
                <Text style={styles.infoValue}>{data.carpet_area} sq.ft</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quotation Title */}
        {data.title && (
          <View style={styles.mb16}>
            <Text style={[styles.sectionTitle, { fontSize: 14 }]}>
              {data.title}
            </Text>
          </View>
        )}

        {/* Spaces & Components */}
        {data.spaces.map((space, spaceIdx) => (
          <View key={spaceIdx} style={styles.spaceSection} wrap={false}>
            <View style={styles.spaceHeader}>
              <Text style={styles.spaceTitle}>
                {space.name || space.space_type_name}
              </Text>
              <Text style={styles.spaceSubtotal}>
                Subtotal: {formatCurrency(space.subtotal)}
              </Text>
            </View>

            {showComponents &&
              space.components.map((component, compIdx) => (
                <View key={compIdx} style={styles.componentSection}>
                  <View style={styles.componentHeader}>
                    <View style={styles.flexRow}>
                      <Text style={styles.componentName}>{component.name}</Text>
                    </View>
                    <Text style={styles.componentTotal}>
                      {formatCurrency(component.subtotal)}
                    </Text>
                  </View>

                  {component.description && (
                    <Text style={styles.componentDescription}>
                      {component.description}
                    </Text>
                  )}

                  {showFullDetail && component.line_items.length > 0 && (
                    <View style={styles.lineItemsTable}>
                      <View style={styles.lineItemHeader}>
                        <Text
                          style={[
                            styles.lineItemCell,
                            styles.flex3,
                            { fontWeight: "bold", color: "#475569" },
                          ]}
                        >
                          Item
                        </Text>
                        <Text
                          style={[
                            styles.lineItemCell,
                            styles.flex1,
                            styles.textCenter,
                            { fontWeight: "bold", color: "#475569" },
                          ]}
                        >
                          {data.hide_dimensions ? "Qty" : "Dimensions"}
                        </Text>
                        <Text
                          style={[
                            styles.lineItemCell,
                            styles.flex1,
                            styles.textRight,
                            { fontWeight: "bold", color: "#475569" },
                          ]}
                        >
                          Rate
                        </Text>
                        <Text
                          style={[
                            styles.lineItemCell,
                            styles.flex1,
                            styles.textRight,
                            { fontWeight: "bold", color: "#475569" },
                          ]}
                        >
                          Amount
                        </Text>
                      </View>

                      {component.line_items.map((item, itemIdx) => (
                        <View
                          key={itemIdx}
                          style={[
                            styles.lineItemRow,
                            itemIdx % 2 === 1
                              ? { backgroundColor: "#f8fafc" }
                              : {},
                          ]}
                        >
                          <View style={styles.flex3}>
                            <Text style={styles.lineItemCell}>{item.name}</Text>
                          </View>
                          <Text
                            style={[
                              styles.lineItemCell,
                              styles.flex1,
                              styles.textCenter,
                            ]}
                          >
                            {formatDimensions(item, data.hide_dimensions)}
                          </Text>
                          <Text
                            style={[
                              styles.lineItemCell,
                              styles.flex1,
                              styles.textRight,
                            ]}
                          >
                            {formatCurrency(item.rate)}/{item.unit_code}
                          </Text>
                          <Text
                            style={[
                              styles.lineItemCell,
                              styles.flex1,
                              styles.textRight,
                              { fontWeight: "medium" },
                            ]}
                          >
                            {formatCurrency(item.amount)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(data.subtotal)}
            </Text>
          </View>

          {data.discount_amount && data.discount_amount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Discount (
                {data.discount_type === "percentage"
                  ? `${data.discount_value}%`
                  : "Fixed"}
                )
              </Text>
              <Text style={[styles.totalValue, { color: "#16a34a" }]}>
                -{formatCurrency(data.discount_amount)}
              </Text>
            </View>
          )}

          {data.tax_amount && data.tax_amount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                GST ({data.tax_percent || 18}%)
              </Text>
              <Text style={styles.totalValue}>
                {formatCurrency(data.tax_amount)}
              </Text>
            </View>
          )}

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(data.grand_total)}
            </Text>
          </View>
        </View>

        {/* Payment Terms */}
        {data.payment_terms && data.payment_terms.length > 0 && (
          <View style={styles.paymentSection} wrap={false}>
            <Text style={styles.sectionTitle}>Payment Terms</Text>
            <View style={styles.paymentTable}>
              {data.payment_terms.map((term, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.paymentRow,
                    idx === data.payment_terms!.length - 1
                      ? { borderBottomWidth: 0 }
                      : {},
                  ]}
                >
                  <View style={styles.paymentMilestone}>
                    <Text>{term.milestone}</Text>
                    {term.description && (
                      <Text style={styles.paymentDescription}>
                        {term.description}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.paymentPercent}>{term.percent}%</Text>
                  <Text style={styles.paymentAmount}>
                    {formatCurrency((data.grand_total * term.percent) / 100)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bank Details */}
        {data.show_bank_details !== false && data.bank && (
          <View style={styles.bankSection} wrap={false}>
            <Text style={styles.sectionTitle}>Bank Details for Payment</Text>
            <View style={styles.bankGrid}>
              {data.bank.bank_name && (
                <View style={styles.bankItem}>
                  <Text style={styles.bankLabel}>Bank Name</Text>
                  <Text style={styles.bankValue}>{data.bank.bank_name}</Text>
                </View>
              )}
              {data.bank.account_name && (
                <View style={styles.bankItem}>
                  <Text style={styles.bankLabel}>Account Name</Text>
                  <Text style={styles.bankValue}>{data.bank.account_name}</Text>
                </View>
              )}
              {data.bank.account_number && (
                <View style={styles.bankItem}>
                  <Text style={styles.bankLabel}>Account Number</Text>
                  <Text style={styles.bankValue}>
                    {data.bank.account_number}
                  </Text>
                </View>
              )}
              {data.bank.ifsc_code && (
                <View style={styles.bankItem}>
                  <Text style={styles.bankLabel}>IFSC Code</Text>
                  <Text style={styles.bankValue}>{data.bank.ifsc_code}</Text>
                </View>
              )}
              {data.bank.branch && (
                <View style={styles.bankItem}>
                  <Text style={styles.bankLabel}>Branch</Text>
                  <Text style={styles.bankValue}>{data.bank.branch}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Terms & Conditions */}
        {data.terms_and_conditions && (
          <View style={styles.termsSection} wrap={false}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <Text style={styles.termsText}>{data.terms_and_conditions}</Text>
          </View>
        )}

        {/* Notes */}
        {data.notes && (
          <View style={styles.termsSection} wrap={false}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.termsText}>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.custom_footer_text ||
              "This is a computer-generated quotation."}
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export type {
  QuotationPDFData,
  SpaceData,
  ComponentData,
  LineItemData,
  PaymentTerm,
  CompanyDetails,
  BankDetails,
};
