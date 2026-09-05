import { redirect } from "next/navigation";

/**
 * Retired route.
 *
 * Viewing and editing a template used to be two pages rendering the same
 * spaces -> components -> line items tree: about 1,100 lines each, one
 * read-only with a summary sidebar and one editable without it. So the page
 * where decisions get made was the one that could not tell you what you had
 * built, and every fix needed doing twice - which is how the editor ended up
 * blind to template levels while the create page handled them correctly.
 *
 * They are now one page at /dashboard/quotations/templates/[id], editable with
 * the summary alongside. Kept as a redirect so existing links and bookmarks
 * land there instead of 404ing.
 */
export default async function EditTemplateRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/quotations/templates/${id}`);
}
