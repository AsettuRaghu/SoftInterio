/**
 * One shape for a library entry as the page sees it, built from the rows
 * plus signed image URLs. Shared by every library route so the list, the
 * detail and a freshly created entry all look the same.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export const LIBRARY_KINDS = ["our_work", "product", "inspiration"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];
export const LIBRARY_KIND_LABELS: Record<LibraryKind, string> = {
  our_work: "Our work",
  product: "What we sell",
  inspiration: "Inspiration",
};

export const ENTRY_SELECT =
  "id, kind, title, description, space_type_id, style_code, tags, visible_to_customer, project_id, cost_item_id, partner_id, source_url, created_by, created_at, updated_at, " +
  "space_type:space_types(id, name, slug), " +
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
  style_code: string | null;
  tags: string[];
  visible_to_customer: boolean;
  project: { id: string; project_number: string; name: string } | null;
  cost_item_id: string | null;
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
    const space = Array.isArray(r.space_type) ? r.space_type[0] : r.space_type;
    const project = Array.isArray(r.project) ? r.project[0] : r.project;
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      description: r.description,
      space_type_id: r.space_type_id,
      space_type: space ?? null,
      style_code: r.style_code,
      tags: r.tags ?? [],
      visible_to_customer: r.visible_to_customer,
      project: project ?? null,
      cost_item_id: r.cost_item_id,
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
