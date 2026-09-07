import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requestLogger } from "@/lib/logger/request";

/**
 * The lead list as CSV, for the analysis nobody anticipated.
 *
 * A report page answers the questions it was designed around; a spreadsheet
 * answers the rest. Exports the fields a sales review actually pivots on -
 * source, owner, stage, value, age - rather than everything on the row.
 */

/** RFC 4180: quote the field, and double any quote inside it. */
const csvCell = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export async function GET(request: NextRequest) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);

    const supabase = await createClient();

    // Which slice of the list. The aggregate tables on the report page are
    // exported from the browser instead, using figures already loaded there -
    // recomputing them here would give two sets of numbers that could drift.
    const report = request.nextUrl.searchParams.get("report") || "leads";

    const [{ data: leads }, { data: users }, { data: quotations }] =
      await Promise.all([
        supabase
          .from("leads")
          .select(
            "id, lead_number, stage, lead_source, service_type, priority, budget_range, won_amount, assigned_to, created_at, won_at, last_activity_at, next_follow_up_at, lost_reason, disqualification_reason, client:clients(name, phone, email), property:properties(property_name, city)"
          )
          .order("created_at", { ascending: false }),
        supabase.from("users").select("id, name"),
        supabase
          .from("quotations")
          .select("lead_id, quotation_number, grand_total")
          .not("lead_id", "is", null),
      ]);

    const userName = Object.fromEntries((users || []).map((u) => [u.id, u.name]));
    const quoteCount: Record<string, number> = {};
    const bestQuote: Record<string, number> = {};
    (quotations || []).forEach((q) => {
      if (!q.lead_id) return;
      quoteCount[q.lead_id] = (quoteCount[q.lead_id] || 0) + 1;
      bestQuote[q.lead_id] = Math.max(
        bestQuote[q.lead_id] || 0,
        Number(q.grand_total) || 0
      );
    });

    const now = Date.now();
    const days = (iso?: string | null) =>
      iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : "";

    const headers = [
      "Lead Number", "Client", "Phone", "Email", "Property", "City",
      "Stage", "Source", "Service", "Priority", "Budget Band",
      "Owner", "Created", "Age (days)", "Days Since Activity",
      "Next Follow-up", "Quotations", "Best Quotation", "Won Amount",
      "Won On", "Lost / Disqualified Reason",
    ];

    const CLOSED = ["won", "lost", "disqualified"];
    const selected = (leads || []).filter((l) => {
      if (report === "pipeline") return !CLOSED.includes(l.stage);
      if (report === "won") return l.stage === "won";
      if (report === "lost") return l.stage === "lost" || l.stage === "disqualified";
      return true;
    });

    const rows = selected.map((l) => {
      const client = l.client as { name?: string; phone?: string; email?: string } | null;
      const property = l.property as { property_name?: string; city?: string } | null;
      return [
        l.lead_number, client?.name, client?.phone, client?.email,
        property?.property_name, property?.city,
        l.stage, l.lead_source, l.service_type, l.priority, l.budget_range,
        userName[l.assigned_to || ""] || "Unassigned",
        l.created_at?.slice(0, 10),
        days(l.created_at),
        days(l.last_activity_at || l.created_at),
        l.next_follow_up_at?.slice(0, 10),
        quoteCount[l.id] || 0,
        bestQuote[l.id] || "",
        l.won_amount || "",
        l.won_at?.slice(0, 10),
        l.lost_reason || l.disqualification_reason,
      ].map(csvCell).join(",");
    });

    // Excel reads a UTF-8 CSV as Latin-1 unless it starts with a byte order
    // mark, which turns every rupee sign and accented name into mojibake.
    const csv =
      "\uFEFF" + [headers.map(csvCell).join(","), ...rows].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    const name = report === "leads" ? "leads" : `leads-${report}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-${stamp}.csv"`,
      },
    });
  } catch (error) {
    log.error("Lead export error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
