export interface ConsentDoc {
  consent_doc_id: string; // PK, uuid
  consent_type: string;
  consent_version: string;
  consent_content: string | null;
  consent_effective_date: string | null; // date string (YYYY-MM-DD)
  is_active: boolean | null;
  created_at: string | null; // ISO timestamp
}