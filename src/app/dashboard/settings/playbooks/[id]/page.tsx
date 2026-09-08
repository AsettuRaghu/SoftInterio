"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/components/ui/PageLayout";
import { PlaybookEditor } from "@/components/playbooks";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";

/**
 * Authoring a playbook, on its own page.
 *
 * This was a modal. A real process is twenty-five nested steps, each with an
 * owner, a gate, a duration, a priority and an effort, and that never fitted a
 * dialog - the things still to come need more room again, not less.
 *
 * The id "new" writes a new one; anything else edits that playbook.
 */
export default function PlaybookEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const isNew = id === "new";
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    void (async () => {
      try {
        const res = await fetch(`/api/playbooks/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setName(data.playbook?.name ?? null);
      } catch {
        // The crumb falls back to a generic label.
      }
    })();
  }, [id, isNew]);

  const backToList = () => router.push("/dashboard/settings/playbooks");

  return (
    <PageLayout>
      <PageHeader
        title={isNew ? "New playbook" : (name ?? "Playbook")}
        subtitle="Ordered steps with gates, which become tasks when the playbook is run"
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
        breadcrumbs={[
          { label: "Playbooks", href: "/dashboard/settings/playbooks" },
          { label: isNew ? "New" : (name ?? "Edit") },
        ]}
        icon={<ClipboardDocumentCheckIcon className="w-4 h-4 text-white" />}
        iconBgClass="from-slate-600 to-slate-700"
      />

      <PageContent>
        <PlaybookEditor
          playbookId={isNew ? null : id}
          onCancel={backToList}
          onSaved={backToList}
        />
      </PageContent>
    </PageLayout>
  );
}
