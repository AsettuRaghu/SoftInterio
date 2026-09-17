/**
 * One shape for a library entry as the page sees it, built from the rows
 * plus signed image URLs. Shared by every library route so the list, the
 * detail and a freshly created entry all look the same.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export const LIBRARY_KINDS = ["our_work", "drawing", "material", "product", "process", "inspiration"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];
export const LIBRARY_KIND_LABELS: Record<LibraryKind, string> = {
  our_work: "Our work",
  drawing: "Drawings",
  material: "Materials",
  product: "What we sell",
  process: "How we work",
  inspiration: "Inspiration",
};
/** What each kind is for - shown when choosing, so the labels stay honest. */
export const LIBRARY_KIND_HELP: Record<LibraryKind, string> = {
  our_work: "A finished piece we executed. Say which project, space and component.",
  drawing: "A layout, 2D, 3D or detail we produced - this is what you will get.",
  material: "What we build with, and how the grades differ - the educational one.",
  product: "A range or item we sell; the catalogue item carries the price.",
  process: "How the business works - a stage, a site visit, a handover.",
  inspiration: "A reference we admire - not ours, and never shown as ours.",
};

export const ENTRY_SELECT =
  "id, kind, title, description, space_type_id, component_type_id, cost_item_id, cost_category_id, quality_tier, stage_key, style_code, tags, visible_to_customer, project_id, partner_id, source_url, created_by, created_at, updated_at, " +
  "space_type:space_types(id, name, slug), " +
  "component_type:component_types(id, name, slug), " +
  "cost_item:quotation_cost_items(id, name, quality_tier, category_id), " +
  "cost_category:quotation_cost_item_categories(id, name), " +
  "project:projects(id, project_number, name), " +
  "images:library_entry_images(id, storage_bucket, storage_path, file_type, document_id, display_order), " +
  "collections:library_collection_entries(collection_id)";

export interface LibraryEntryShape {
  id: string;
  kind: LibraryKind;
  title: string;
  description: string | null;
  space_type_id: string | null;
  space_type: { id: string; name: string; slug: string } | null;
  component_type_id: string | null;
  component_type: { id: string; name: string; slug: string } | null;
  cost_item_id: string | null;
  cost_item: { id: string; name: string; quality_tier: string | null; category_id: string | null } | null;
  cost_category_id: string | null;
  cost_category: { id: string; name: string } | null;
  quality_tier: string | null;
  stage_key: string | null;
  style_code: string | null;
  tags: string[];
  visible_to_customer: boolean;
  project: { id: string; project_number: string; name: string } | null;
  partner_id: string | null;
  source_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  images: { id: string; url: string | null; file_type: string | null; document_id: string | null }[];
  cover_url: string | null;
  collection_ids: string[];
}

export async function shapeEntries(rows: any[]): Promise<LibraryEntryShape[]> {
  const admin = createAdminClient();
  // One signed URL per image, an hour long; the page keeps them for a session.
  const paths = rows.flatMap((r) => (r.images ?? []).map((i: any) => i.storage_path as string));
  const urlByPath = new Map<string, string>();
  if (paths.length) {
    const { data } = await admin.storage.from("documents").createSignedUrls(paths, 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) urlByPath.set(d.path, d.signedUrl);
  }
  return rows.map((r) => {
    const images = [...(r.images ?? [])]
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((i: any) => ({ id: i.id, url: urlByPath.get(i.storage_path) ?? null, file_type: i.file_type, document_id: i.document_id }));
    const one = (v: any) => (Array.isArray(v) ? v[0] ?? null : v ?? null);
    const project = one(r.project);
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      description: r.description,
      space_type_id: r.space_type_id,
      space_type: one(r.space_type),
      component_type_id: r.component_type_id,
      component_type: one(r.component_type),
      cost_item_id: r.cost_item_id,
      cost_item: one(r.cost_item),
      cost_category_id: r.cost_category_id,
      cost_category: one(r.cost_category),
      quality_tier: r.quality_tier,
      stage_key: r.stage_key,
      style_code: r.style_code,
      tags: r.tags ?? [],
      visible_to_customer: r.visible_to_customer,
      project: project ?? null,
      partner_id: r.partner_id,
      source_url: r.source_url,
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      images,
      cover_url: images[0]?.url ?? null,
      collection_ids: (r.collections ?? []).map((c: any) => c.collection_id),
    };
  });
}

export const cleanTags = (v: unknown): string[] =>
  Array.isArray(v)
    ? [...new Set(v.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 20)
    : typeof v === "string"
      ? cleanTags(v.split(","))
      : [];
