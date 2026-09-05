import { redirect } from "next/navigation";

/**
 * Retired builder.
 *
 * This route used to hold a second, self-contained quotation builder - around
 * 1,580 lines with its own space, component and line-item handling. It was
 * superseded by the flow that now runs everywhere: the quotations list opens
 * CreateQuotationModal, POSTs to /api/quotations, and sends the user straight
 * to /dashboard/quotations/[id], which opens the builder in place and is
 * the only builder using the shared quotation components.
 *
 * Nothing linked here any more - the sole remaining references were the route
 * permission entry and the middleware rule, both of which describe the path
 * rather than link to it. Kept as a redirect rather than deleted so an old
 * bookmark or typed URL lands on the create flow instead of a 404.
 */
export default function NewQuotationPage() {
  redirect("/dashboard/quotations?create=true");
}
