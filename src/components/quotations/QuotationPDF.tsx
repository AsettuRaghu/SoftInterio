/**
 * The quotation document, rendered by @react-pdf/renderer.
 *
 * Deliberately NOT a client component. It is only ever rendered server-side by
 * renderToBuffer in the two PDF route handlers, and marking it "use client"
 * made Next hand those routes a client-reference proxy instead of the
 * component - react-pdf then walked it and died with "Cannot read properties
 * of null (reading 'props')", so PDF generation failed for every quotation.
 * It uses no hooks, no browser APIs and no event handlers; there is nothing
 * here that needs the directive.
 */

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
  /** Cost category, used when the format itemises to category level. */
  category_name?: string;
  category_order?: number;
  /** Spec text from the catalogue; the Material column is built from these. */
  description?: string | null;
  /** Delivery, cleanup and the like - shown apart from quoted scope. */
  is_charge?: boolean;
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
  /** Prints below the room totals rather than as a numbered room. */
  is_charges?: boolean;
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

  // Settings from the tenant's print format.
  //
  // itemise_to is how deep the breakdown goes; price_at is the deepest level a
  // money figure appears. They are separate on purpose: "show the client the
  // categories inside each wardrobe, but only price the wardrobe" is the whole
  // reason the print library exists.
  /** Every active clause, each printed as its own headed section. */
  terms_sections?: Array<{ title: string; content: string }>;
  show_tax?: boolean;

  itemise_to?: "space" | "component" | "category" | "cost_item";
  price_at?: "space" | "component" | "category" | "cost_item" | "none";
  show_descriptions?: boolean;
  show_specifications?: boolean;
  show_quantities?: boolean;
  show_payment_terms?: boolean;
  show_terms?: boolean;
  cover_enabled?: boolean;
  cover_image_path?: string;
  terms_title?: string;

  /** Fallback for a tenant with no print format configured. */
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

/**
 * The Indian reading of a rupee figure, for the "amount in words" line.
 *
 * Lakh and crore rather than million: a quotation checked by an Indian client
 * is read in those units, and getting it wrong is the kind of error that stops
 * a signature. Paise are dropped - quotations are whole rupees.
 */
function amountInWords(amount: number): string {
  const ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const TENS = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
    "Eighty", "Ninety",
  ];

  const underThousand = (n: number): string => {
    if (n === 0) return "";
    if (n < 20) return ONES[n];
    if (n < 100) {
      return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
    }
    return (
      ONES[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " and " + underThousand(n % 100) : "")
    );
  };

  const value = Math.round(Math.abs(amount));
  if (value === 0) return "Rupees Zero Only";

  // Indian grouping: crore, lakh, thousand, then the last three digits.
  const parts: string[] = [];
  const crore = Math.floor(value / 10000000);
  const lakh = Math.floor((value % 10000000) / 100000);
  const thousand = Math.floor((value % 100000) / 1000);
  const rest = value % 1000;

  if (crore) parts.push(`${underThousand(crore)} Crore`);
  if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
  if (rest) parts.push(underThousand(rest));

  return `Rupees ${parts.join(" ")} Only`;
}

/**
 * Flattens the clause library's rich text into blocks react-pdf can render.
 *
 * Deliberately small: headings, paragraphs and list items, with inline markup
 * stripped. react-pdf has no HTML renderer, and pulling one in to honour
 * arbitrary markup would be a lot of weight for terms that are, in practice,
 * headings and bullet points. Anything exotic flattens to a paragraph rather
 * than breaking the document.
 */
function richTextToBlocks(
  html: string
): Array<{ type: "heading" | "paragraph" | "listItem"; text: string }> {
  const decode = (t: string) =>
    t
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

  const strip = (t: string) => decode(t.replace(/<[^>]+>/g, "")).trim();

  // Plain text, which is what the clause editor actually stores today.
  // Structure is inferred from the conventions people type: a numbered or
  // fully capitalised line is a heading, and a line opening with >, - or a
  // bullet is a list item. Without this the whole document prints as one
  // undifferentiated block with literal ">" characters down the margin.
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const bullet = line.match(/^[>\-\u2022]\s*(.+)$/);
        if (bullet) return { type: "listItem" as const, text: bullet[1] };
        const numbered = /^\d+[.)]\s+\S/.test(line);
        const shouty = line.length < 60 && line === line.toUpperCase() && /[A-Z]/.test(line);
        if (numbered || shouty) return { type: "heading" as const, text: line };
        return { type: "paragraph" as const, text: line };
      });
  }

  const blocks: Array<{
    type: "heading" | "paragraph" | "listItem";
    text: string;
  }> = [];
  const pattern = /<(h[1-6]|p|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const text = strip(match[2].replace(/<br\s*\/?>/gi, " "));
    if (!text) continue;
    blocks.push({
      type: tag.startsWith("h")
        ? "heading"
        : tag === "li"
        ? "listItem"
        : "paragraph",
      text,
    });
  }

  // No recognised block tags - fall back to the stripped text rather than
  // printing nothing.
  if (blocks.length === 0) {
    const text = strip(html);
    if (text) blocks.push({ type: "paragraph", text });
  }
  return blocks;
}

// ============================================================================
// DOCUMENT COMPONENT
// ============================================================================

export function QuotationPDF({ data }: { data: QuotationPDFData }) {
  // The print format governs. presentation_level is only consulted when no
  // format exists, so an unconfigured tenant keeps the old behaviour.
  const itemiseTo =
    data.itemise_to ||
    (data.presentation_level === "full_detail"
      ? "cost_item"
      : data.presentation_level === "space_only"
      ? "space"
      : "component");
  const priceAt =
    data.price_at || (itemiseTo === "cost_item" ? "cost_item" : "component");

  const showComponents = itemiseTo !== "space";
  const showCategories = itemiseTo === "category";
  const showFullDetail = itemiseTo === "cost_item";
  // A component's price is hidden when the format prices at space level only,
  // or when it says to print no prices at all.
  const showComponentPrice = priceAt !== "space" && priceAt !== "none";
  // Prices below the component: on category rows, and on each cost item.
  const showCategoryPrice = priceAt === "category" || priceAt === "cost_item";
  const showItemPrice = priceAt === "cost_item";

  /**
   * The Material column: what a component is actually made of, assembled from
   * the catalogue descriptions of the cost items inside it.
   *
   * Built rather than typed, so it cannot describe a material the quotation no
   * longer uses - swap the carcass to Luxury and this sentence changes with
   * it. Ordered by cost category so it always reads carcass, then shutters,
   * then hardware, and de-duplicated so a material used on three lines is
   * named once.
   */
  const materialText = (items: LineItemData[]) => {
    const seen = new Set<string>();
    return [...items]
      .sort((a, b) => (a.category_order ?? 99) - (b.category_order ?? 99))
      .map((item) => item.description?.trim())
      .filter((text): text is string => {
        if (!text || seen.has(text)) return false;
        seen.add(text);
        return true;
      })
      .join(" ");
  };

  // Charges are quoted the same way as anything else - they are simply shown
  // after the rooms, where a transport line belongs on a client document.
  const quotedSpaces = data.spaces.filter((s) => !s.is_charges);
  const chargeSpaces = data.spaces.filter((s) => s.is_charges);
  const chargesTotal = chargeSpaces.reduce((n, s) => n + s.subtotal, 0);
  const roomsTotal = quotedSpaces.reduce((n, s) => n + s.subtotal, 0);
  // A document that does not print tax must not include it in the total it
  // does print, or the client adds up the visible rows and gets a different
  // number from the one they are asked to agree to.
  const grandTotal =
    data.show_tax === false
      ? roomsTotal + chargesTotal - (data.discount_amount ?? 0)
      : data.grand_total;

  /** Line items rolled up to their cost category, for itemise_to="category". */
  const groupByCategory = (items: LineItemData[]) => {
    const byName = new Map<string, { name: string; amount: number; count: number }>();
    items.forEach((item) => {
      const name = item.category_name || "Other";
      const row = byName.get(name) || { name, amount: 0, count: 0 };
      row.amount += item.amount || 0;
      row.count += 1;
      byName.set(name, row);
    });
    return [...byName.values()];
  };

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
            {!!data.carpet_area && (
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
        {quotedSpaces.map((space, spaceIdx) => (
          <View key={spaceIdx} style={styles.spaceSection}>
            <View style={styles.spaceHeader}>
              <Text style={styles.spaceTitle}>
                {spaceIdx + 1}. {space.name || space.space_type_name}
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
                    {showComponentPrice && (
                      <Text style={styles.componentTotal}>
                        {formatCurrency(component.subtotal)}
                      </Text>
                    )}
                  </View>

                  {/* Material: the component's own note if someone wrote one,
                      otherwise assembled from its cost items. */}
                  {data.show_descriptions !== false &&
                    (() => {
                      const material =
                        component.description || materialText(component.line_items);
                      return material ? (
                        <Text style={styles.componentDescription}>{material}</Text>
                      ) : null;
                    })()}

                  {/* Category level: what the component is made of, without
                      exposing the rate of each cost item inside it. This is the
                      middle ground the print format exists to express. */}
                  {showCategories && component.line_items.length > 0 && (
                    <View style={styles.lineItemsTable}>
                      {groupByCategory(component.line_items).map((cat, i) => (
                        <View key={i} style={styles.lineItemRow}>
                          <Text style={[styles.lineItemCell, styles.flex3]}>
                            {cat.name}
                          </Text>
                          {data.show_quantities !== false && (
                            <Text
                              style={[
                                styles.lineItemCell,
                                styles.flex1,
                                { textAlign: "center" },
                              ]}
                            >
                              {cat.count}
                            </Text>
                          )}
                          <Text
                            style={[
                              styles.lineItemCell,
                              styles.flex2,
                              { textAlign: "right" },
                            ]}
                          >
                            {showCategoryPrice ? formatCurrency(cat.amount) : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
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

          {(data.discount_amount ?? 0) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Discount (
                {data.discount_type === "percentage"
                  ? `${data.discount_value}%`
                  : "Fixed"}
                )
              </Text>
              <Text style={[styles.totalValue, { color: "#16a34a" }]}>
                -{formatCurrency(data.discount_amount ?? 0)}
              </Text>
            </View>
          )}

          {/* Charges sit between the room totals and the grand total, each
              named, so the client can see what was added and why. */}
          {chargeSpaces.map((space, idx) =>
            space.components.map((component) =>
              component.line_items.map((item, itemIdx) => (
                <View key={`${idx}-${itemIdx}`} style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{item.name}</Text>
                  <Text style={styles.totalValue}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              ))
            )
          )}

          {data.show_tax !== false && (data.tax_amount ?? 0) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                GST ({data.tax_percent || 18}%)
              </Text>
              <Text style={styles.totalValue}>
                {formatCurrency(data.tax_amount ?? 0)}
              </Text>
            </View>
          )}

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(grandTotal)}
            </Text>
          </View>

          {/* Amount in words is how an Indian quotation is checked - the
              figure and the words have to agree before anyone signs. */}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontFamily: "Helvetica-Oblique" }]}>
              {amountInWords(grandTotal)}
            </Text>
          </View>
        </View>

        {/* Payment Terms */}
        {data.show_payment_terms !== false &&
          data.payment_terms &&
          data.payment_terms.length > 0 && (
          <View style={styles.paymentSection}>
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
        {/* The one section that keeps wrap={false}: it is a handful of fixed
            rows and account details split across a page break are genuinely
            hard to read. Everything else can grow past a page, and react-pdf
            silently drops - not truncates - any unwrappable view that does. */}
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

        {/* Terms & Conditions.
            The clause library stores rich text, and react-pdf renders no HTML
            at all - passing it straight through printed the tags. */}
        {data.show_terms !== false &&
          (data.terms_sections?.length
            ? data.terms_sections
            : data.terms_and_conditions
            ? [{ title: "Terms & Conditions", content: data.terms_and_conditions }]
            : []
          ).map((section, sectionIdx) => (
          <View key={sectionIdx} style={styles.termsSection}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {richTextToBlocks(section.content).map((block, i) => (
              <Text
                key={i}
                style={[
                  styles.termsText,
                  block.type === "heading"
                    ? { fontFamily: "Helvetica-Bold", marginTop: 6 }
                    : {},
                  block.type === "listItem" ? { marginLeft: 10 } : {},
                ]}
              >
                {block.type === "listItem" ? `\u2022  ${block.text}` : block.text}
              </Text>
            ))}
          </View>
        ))}

        {/* Notes */}
        {data.notes && (
          <View style={styles.termsSection}>
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
