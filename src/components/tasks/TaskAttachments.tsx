"use client";

/**
 * Attachments on a task: drag-drop or pick, list, open, delete.
 *
 * Files live in the private documents bucket, so the API hands back a
 * short-lived signed URL per file rather than a permanent link. Those expire,
 * which is why the list re-fetches rather than caching URLs across mounts.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

interface Attachment {
  id: string;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
  description?: string | null;
  created_at: string;
  signed_url?: string | null;
  uploaded_user?: { id: string; name: string; avatar_url?: string | null };
}

interface Props {
  taskId: string;
  /** Hide upload/delete controls (closed project, read-only view). */
  readOnly?: boolean;
  onCountChange?: (count: number) => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const isImage = (type?: string | null) => !!type && type.startsWith("image/");

export function TaskAttachments({ taskId, readOnly = false, onCountChange }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Held in a ref so the callback's identity never feeds back into load()'s
  // dependencies. A caller passing an inline arrow would otherwise change
  // load() on every render and re-trigger the fetch effect forever.
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  });

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/attachments`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || "Could not load attachments");
        return;
      }
      const data = await response.json();
      setAttachments(data.attachments || []);
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Report the count as an EFFECT of the list changing. Calling the parent's
  // setter from inside a setAttachments updater meant updating EditTaskModal
  // while TaskAttachments was rendering, which React rejects - state updaters
  // must be pure and may be replayed.
  useEffect(() => {
    if (!isLoading) onCountChangeRef.current?.(attachments.length);
  }, [attachments.length, isLoading]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      setIsUploading(true);
      setError(null);

      for (const file of list) {
        // Check locally so an oversized file never leaves the browser.
        if (file.size > MAX_FILE_SIZE) {
          setError(
            `"${file.name}" is ${(file.size / 1048576).toFixed(
              1
            )}MB. The limit is ${MAX_FILE_SIZE / 1048576}MB.`
          );
          continue;
        }

        const body = new FormData();
        body.append("file", file);

        try {
          const response = await fetch(`/api/tasks/${taskId}/attachments`, {
            method: "POST",
            body,
          });
          const data = await response.json();

          if (!response.ok) {
            setError(data.error || `Could not upload "${file.name}"`);
            continue;
          }

          setAttachments((prev) => [data.attachment, ...prev]);
        } catch {
          setError(`Could not upload "${file.name}"`);
        }
      }

      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    },
    [taskId]
  );

  const remove = useCallback(
    async (attachment: Attachment) => {
      setDeletingId(attachment.id);
      setError(null);
      try {
        const response = await fetch(
          `/api/tasks/${taskId}/attachments/${attachment.id}`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setError(data.error || "Could not delete the file");
          return;
        }
        setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      } catch {
        setError("Could not reach the server");
      } finally {
        setDeletingId(null);
      }
    },
    [taskId]
  );

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void upload(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`px-3 py-4 rounded-lg border border-dashed text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && void upload(e.target.files)}
          />
          <p className="text-xs text-slate-500">
            {isUploading ? (
              "Uploading..."
            ) : (
              <>
                <span className="font-medium text-blue-600">Choose files</span>{" "}
                or drag them here
              </>
            )}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Up to {MAX_FILE_SIZE / 1048576}MB each
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-xs text-slate-400">Loading attachments...</p>
      ) : attachments.length === 0 ? (
        !readOnly ? null : (
          <p className="text-xs text-slate-400">No attachments.</p>
        )
      ) : (
        <div className="space-y-1">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              {isImage(a.file_type) && a.signed_url ? (
                <img
                  src={a.signed_url}
                  alt={a.file_name}
                  className="w-8 h-8 rounded object-cover shrink-0 border border-slate-200"
                />
              ) : (
                <span className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                  <svg
                    className="w-4 h-4 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </span>
              )}

              <span className="flex-1 min-w-0">
                {a.signed_url ? (
                  <a
                    href={a.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs font-medium text-slate-700 hover:text-blue-600 truncate"
                  >
                    {a.file_name}
                  </a>
                ) : (
                  <span className="block text-xs font-medium text-slate-500 truncate">
                    {a.file_name}
                  </span>
                )}
                <span className="block text-[10px] text-slate-400">
                  {formatBytes(a.file_size)}
                  {a.uploaded_user?.name ? ` · ${a.uploaded_user.name}` : ""}
                </span>
              </span>

              {!readOnly && (
                <button
                  type="button"
                  disabled={deletingId === a.id}
                  onClick={() => void remove(a)}
                  title="Remove"
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TaskAttachments;
