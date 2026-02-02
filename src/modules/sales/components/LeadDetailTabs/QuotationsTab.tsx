"use client";

import QuotationTableReusable from "@/components/quotations/QuotationTableReusable";
import { Quotation } from "@/types/quotations";
import { LeadStage } from "@/types/leads";

interface QuotationsTabProps {
  quotations: Quotation[];
  leadStage?: LeadStage;
  leadClosed?: boolean;
  onAddQuotationClick?: () => void;
  onNavigateToQuotations?: () => void;
  onViewQuotation?: (quotation: Quotation) => void;
  onReviseQuotation?: (quotationId: string, e: React.MouseEvent) => void;
  revisingId?: string | null;
}

export default function QuotationsTab({
  quotations,
  leadStage,
  leadClosed = false,
  onAddQuotationClick,
  onNavigateToQuotations,
  onViewQuotation,
  onReviseQuotation,
  revisingId,
}: QuotationsTabProps) {
  // Only allow creating quotations if in Proposal & Negotiation stage and lead is not closed
  const isProposalStage = leadStage === "proposal_discussion";
  const allowCreate =
    isProposalStage &&
    (!!onAddQuotationClick || !!onNavigateToQuotations) &&
    !leadClosed;

  return (
    <QuotationTableReusable
      quotations={quotations}
      allowCreate={allowCreate}
      allowView={true}
      showFilters={true}
      showHeader={false}
      compact={true}
      readOnly={leadClosed}
      onCreateQuotation={onAddQuotationClick}
      onNavigateToQuotations={onNavigateToQuotations}
      onViewQuotation={onViewQuotation}
      onReviseQuotation={onReviseQuotation}
      revisingId={revisingId}
    />
  );
}
