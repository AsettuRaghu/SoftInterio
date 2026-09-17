"use client";

import { useParams } from "next/navigation";
import { PartnersList } from "@/components/partners/PartnersList";

/** One hat: /dashboard/partners/t/customer, /t/architect, ... */
export default function PartnersByTypePage() {
  const { type } = useParams<{ type: string }>();
  return <PartnersList type={type} />;
}
