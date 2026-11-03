import * as FileSystem from 'expo-file-system/legacy';
import { getSupabase } from '@/services/supabase/client';
import type { DocumentKind, DocumentUploadRow, ExtractionStatus, Json } from '@/types/database';

const BUCKET = 'academic-documents';

export interface PickedDocument {
  uri: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

/**
 * Upload a document to the private bucket under the owner's UID folder, then
 * record metadata. Storage RLS requires the first folder to equal auth.uid().
 */
export async function uploadDocument(
  userId: string,
  semesterId: string | null,
  doc: PickedDocument,
  kind: DocumentKind,
): Promise<DocumentUploadRow> {
  const supabase = getSupabase();
  const ext = doc.name.includes('.') ? doc.name.split('.').pop() : 'bin';
  const objectName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(doc.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectName, bytes, {
    contentType: doc.mimeType ?? 'application/octet-stream',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('document_uploads')
    .insert({
      owner_id: userId,
      semester_id: semesterId,
      storage_path: objectName,
      file_name: doc.name,
      mime_type: doc.mimeType,
      document_kind: kind,
      extraction_status: 'uploaded',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchDocuments(semesterId: string): Promise<DocumentUploadRow[]> {
  const { data, error } = await getSupabase()
    .from('document_uploads')
    .select('*')
    .eq('semester_id', semesterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateDocumentExtraction(
  id: string,
  status: ExtractionStatus,
  extractedData?: Json,
): Promise<void> {
  const { error } = await getSupabase()
    .from('document_uploads')
    .update({ extraction_status: status, extracted_data: extractedData ?? null })
    .eq('id', id);
  if (error) throw error;
}

export async function documentSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
