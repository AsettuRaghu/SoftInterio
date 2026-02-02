"use client";

import QuotationTableReusable from "@/components/quotations/QuotationTableReusable";
import { Quotation } from "@/types/quotations";

interface ProjectQuotationsTabProps {
  quotations: Quotation[];
  onCountChange?: (count: number) => void;
  onViewQuotation?: (quotation: Quotation) => void;
}

export default function QuotationsTab({
  quotations,
  onCountChange,
  onViewQuotation,
}: ProjectQuotationsTabProps) {
  return (
    <QuotationTableReusable
      quotations={quotations}
      allowCreate={false}
      allowView={true}
      showFilters={true}
      showHeader={false}
      compact={true}
      readOnly={false}
      onViewQuotation={onViewQuotation}
    />
  );
}
