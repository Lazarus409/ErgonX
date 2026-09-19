import { apiAction, apiGetList, apiPost } from "./client";
import type { PaginatedData } from "@/types/api";
import type { BackgroundJob, DocumentRecord, ExportJob, ImportJob } from "@/types/operations";

export function listDocuments(): Promise<PaginatedData<DocumentRecord>> { return apiGetList<DocumentRecord>("/documents/", { ordering: "-created_at" }); }
export function listImportJobs(): Promise<PaginatedData<ImportJob>> { return apiGetList<ImportJob>("/import-jobs/", { ordering: "-created_at" }); }
export function listExportJobs(): Promise<PaginatedData<ExportJob>> { return apiGetList<ExportJob>("/export-jobs/", { ordering: "-created_at" }); }
export function listBackgroundJobs(): Promise<PaginatedData<BackgroundJob>> { return apiGetList<BackgroundJob>("/background-jobs/", { ordering: "-created_at" }); }
export function confirmImportJob(id: string): Promise<ImportJob> { return apiAction<ImportJob>(`/import-jobs/${id}/confirm/`); }
export interface DocumentCreatePayload { file_reference: string; original_filename: string; content_type: string; size_bytes: number; category?: string; classification?: string; entity_type?: string; entity_id?: string | null; }
export function createDocument(payload: DocumentCreatePayload): Promise<DocumentRecord> { return apiPost<DocumentRecord, DocumentCreatePayload>("/documents/", payload); }
