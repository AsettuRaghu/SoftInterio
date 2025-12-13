// Document Management Types
// Unified document types for all modules

// Linked entity types
export type DocumentLinkedType =
  | "lead"
  | "project"
  | "quotation"
  | "invoice"
  | "client"
  | "property"
  | "purchase_order"
  | "vendor"
  | "expense";

// Document categories
export type DocumentCategory =
  | "contract"
  | "agreement"
  | "proposal"
  | "design"
  | "floor_plan"
  | "3d_render"
  | "photo"
  | "invoice"
  | "receipt"
  | "purchase_order"
  | "delivery_note"
  | "identification"
  | "property_document"
  | "reference"
  | "other";

// Document category labels for display
export const DocumentCategoryLabels: Record<DocumentCategory, string> = {
  contract: "Contract",
  agreement: "Agreement",
  proposal: "Proposal",
  design: "Design",
  floor_plan: "Floor Plan",
  "3d_render": "3D Render",
  photo: "Photo",
  invoice: "Invoice",
  receipt: "Receipt",
  purchase_order: "Purchase Order",
  delivery_note: "Delivery Note",
  identification: "ID Document",
  property_document: "Property Document",
  reference: "Reference",
  other: "Other",
};

// Document category icons (Heroicon names)
export const DocumentCategoryIcons: Record<DocumentCategory, string> = {
  contract: "DocumentTextIcon",
  agreement: "DocumentCheckIcon",
  proposal: "DocumentIcon",
  design: "SwatchIcon",
  floor_plan: "MapIcon",
  "3d_render": "CubeIcon",
  photo: "PhotoIcon",
  invoice: "ReceiptPercentIcon",
  receipt: "ReceiptRefundIcon",
  purchase_order: "ClipboardDocumentListIcon",
  delivery_note: "TruckIcon",
  identification: "IdentificationIcon",
  property_document: "HomeIcon",
  reference: "BookOpenIcon",
  other: "FolderIcon",
};

// Main Document interface
export interface Document {
  id: string;
  tenant_id: string;
  linked_type: DocumentLinkedType;
  linked_id: string;
  file_name: string;
  original_name: string;
  file_type: string | null;
  file_extension: string | null;
  file_size: number | null;
  storage_bucket: string;
  storage_path: string;
  category: DocumentCategory;
  title: string | null;
  description: string | null;
  tags: string[] | null;
  version: number;
  parent_id: string | null;
  is_latest: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;

  // Joined user data
  uploaded_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// Document with signed URL for viewing/downloading
export interface DocumentWithUrl extends Document {
  signed_url?: string;
  thumbnail_url?: string;
}

// Input for creating a document record (after upload)
export interface CreateDocumentInput {
  linked_type: DocumentLinkedType;
  linked_id: string;
  file_name: string;
  original_name: string;
  file_type?: string;
  file_extension?: string;
  file_size?: number;
  storage_path: string;
  category?: DocumentCategory;
  title?: string;
  description?: string;
  tags?: string[];
}

// Input for updating a document
export interface UpdateDocumentInput {
  category?: DocumentCategory;
  title?: string;
  description?: string;
  tags?: string[];
}

// Upload progress state
export interface UploadProgress {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
  document?: Document;
}

// Allowed file types configuration (max 20MB to match Supabase limit)
export const ALLOWED_FILE_TYPES = {
  // Images
  "image/jpeg": { extension: ".jpg", maxSize: 20 * 1024 * 1024 },
  "image/png": { extension: ".png", maxSize: 20 * 1024 * 1024 },
  "image/gif": { extension: ".gif", maxSize: 20 * 1024 * 1024 },
  "image/webp": { extension: ".webp", maxSize: 20 * 1024 * 1024 },
  // Documents
  "application/pdf": { extension: ".pdf", maxSize: 20 * 1024 * 1024 },
  "application/msword": { extension: ".doc", maxSize: 20 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extension: ".docx",
    maxSize: 20 * 1024 * 1024,
  },
  "application/vnd.ms-excel": { extension: ".xls", maxSize: 20 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extension: ".xlsx",
    maxSize: 20 * 1024 * 1024,
  },
  "application/vnd.ms-powerpoint": {
    extension: ".ppt",
    maxSize: 20 * 1024 * 1024,
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    extension: ".pptx",
    maxSize: 20 * 1024 * 1024,
  },
  // Archives
  "application/zip": { extension: ".zip", maxSize: 20 * 1024 * 1024 },
  "application/x-rar-compressed": {
    extension: ".rar",
    maxSize: 20 * 1024 * 1024,
  },
  // CAD (common in interior design)
  "application/acad": { extension: ".dwg", maxSize: 20 * 1024 * 1024 },
  "image/vnd.dwg": { extension: ".dwg", maxSize: 20 * 1024 * 1024 },
  "application/x-dwg": { extension: ".dwg", maxSize: 20 * 1024 * 1024 },
  "application/dwg": { extension: ".dwg", maxSize: 20 * 1024 * 1024 },
  "image/x-dwg": { extension: ".dwg", maxSize: 20 * 1024 * 1024 },
  "application/dxf": { extension: ".dxf", maxSize: 20 * 1024 * 1024 },
  "image/vnd.dxf": { extension: ".dxf", maxSize: 20 * 1024 * 1024 },
  // SketchUp
  "application/vnd.sketchup.skp": { extension: ".skp", maxSize: 20 * 1024 * 1024 },
  "application/x-sketchup": { extension: ".skp", maxSize: 20 * 1024 * 1024 },
  "application/octet-stream": { extension: "", maxSize: 20 * 1024 * 1024 }, // Fallback for .skp and other binary files
  // Text
  "text/plain": { extension: ".txt", maxSize: 5 * 1024 * 1024 },
  "text/csv": { extension: ".csv", maxSize: 10 * 1024 * 1024 },
};

// Default max file size (20MB to match Supabase limit)
export const DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024;

// Helper to format file size
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Helper to get file extension from name
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : "";
}

// Allowed file extensions (for when MIME type is not reliable)
export const ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".rar",
  ".dwg", ".dxf", ".skp",
  ".txt", ".csv"
];

// Helper to check if file type is allowed
export function isAllowedFileType(file: File): boolean {
  // Check by MIME type first
  if (file.type && file.type in ALLOWED_FILE_TYPES) {
    return true;
  }
  // Fallback to extension check (for .skp, .dwg, etc. that may have generic MIME types)
  const ext = getFileExtension(file.name);
  return ALLOWED_EXTENSIONS.includes(ext);
}

// Helper to check file size
export function isFileSizeAllowed(file: File): boolean {
  const config =
    ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES];
  // For files with unrecognized MIME types, use extension-based size limits
  if (!config) {
    const ext = getFileExtension(file.name);
    // All files capped at 20MB to match Supabase limit
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      return file.size <= 20 * 1024 * 1024;
    }
    // Default to 20MB for other allowed extensions
    return file.size <= DEFAULT_MAX_FILE_SIZE;
  }
  return file.size <= config.maxSize;
}

// Helper to get file type icon based on extension/mime
export function getFileTypeIcon(
  fileType: string | null,
  extension: string | null
): string {
  const ext = extension?.toLowerCase() || "";
  const mime = fileType?.toLowerCase() || "";

  if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) {
    return "photo";
  }
  if (mime === "application/pdf" || ext === ".pdf") {
    return "pdf";
  }
  if (
    mime.includes("word") ||
    mime.includes("document") ||
    [".doc", ".docx"].includes(ext)
  ) {
    return "word";
  }
  if (
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    [".xls", ".xlsx", ".csv"].includes(ext)
  ) {
    return "excel";
  }
  if (
    mime.includes("powerpoint") ||
    mime.includes("presentation") ||
    [".ppt", ".pptx"].includes(ext)
  ) {
    return "powerpoint";
  }
  if ([".dwg", ".dxf"].includes(ext)) {
    return "cad";
  }
  if ([".zip", ".rar", ".7z"].includes(ext)) {
    return "archive";
  }
  return "file";
}

// Helper to check if file is previewable in browser
export function isPreviewable(fileType: string | null): boolean {
  if (!fileType) return false;
  return (
    fileType.startsWith("image/") ||
    fileType === "application/pdf"
  );
}
