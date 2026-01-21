export interface ConsentRecord {
  consent_record_id: string; // PK, uuid
  consent_doc_id: string | null; // FK -> consent_docs
  sign_by_id: string | null; // FK -> customers
  consent_status: boolean | null;
  record_by_user_id: string | null; // FK -> auth.users
  created_at: string | null;
}