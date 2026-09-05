import { redirect } from "next/navigation";

/**
 * Retired route.
 *
 * Reading and editing a quotation used to be two pages - roughly 1,760 and
 * 2,350 lines - each rendering the same spaces / components / line items tree,
 * each with its own copy of "create a revision", and only one of them aware of
 * cost and margin. They are now one route at /dashboard/quotations/[id], which
 * opens as the document and switches into the builder in place.
 *
 * Kept as a redirect so existing links and bookmarks still land somewhere.
 */
export default async function EditQuotationRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/quotations/${id}?edit=1`);
}
