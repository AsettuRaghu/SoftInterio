"use client";

import QuotationTableReusable from "@/components/quotations/QuotationTableReusable";
import { Quotation } from "@/types/quotations";

interface ProjectQuotationsTabProps {
  quotations: Quotation[];
  projectClosed?: boolean;
  onCountChange?: (count: number) => void;
  onViewQuotation?: (quotation: Quotation) => void;
  /**
   * Revising is the supported way to change a quotation that has gone out, and
   * it is needed here as much as on a lead - a price is renegotiated during
   * delivery, not only before it. The table has always accepted this; the
   * project page simply passed nothing, so the button never rendered.
   */
  onReviseQuotation?: (quotationId: string, e: React.MouseEvent) => void;
  revisingId?: string | null;
}

export default function QuotationsTab({
  quotations,
  projectClosed = false,
  onCountChange,
  onViewQuotation,
  onReviseQuotation,
  revisingId,
}: ProjectQuotationsTabProps) {
  return (
    <QuotationTableReusable
      quotations={quotations}
      allowCreate={false}
      allowView={true}
      showFilters={true}
      showHeader={false}
      compact={true}
      readOnly={projectClosed}
      onViewQuotation={onViewQuotation}
      onReviseQuotation={onReviseQuotation}
      revisingId={revisingId}
    />
  );
}
