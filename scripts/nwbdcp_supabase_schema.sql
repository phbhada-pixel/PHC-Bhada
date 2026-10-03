-- =========================================================================
-- NWBDCP SUPABASE PRODUCTION DATABASE SCHEMA (HARDENED FINAL)
-- Application: PHC Bhada Water Quality Management Module
-- Isolation: 100% Independent and Isolated from NVBDCP
-- Architecture: Trusted Server Backend with Supabase Service-Role Access
-- Security: Strict Row Level Security (RLS) - Zero Public Write Permissions
-- =========================================================================

-- =========================================================================
-- 1. WATER SOURCE MASTER TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."NWBDCP_WaterSources" (
    id TEXT PRIMARY KEY,
    source_code TEXT NOT NULL UNIQUE,
    source_id TEXT NOT NULL,
    subcenter TEXT NOT NULL,
    gram_panchayat TEXT NOT NULL,
    village TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    ownership TEXT NOT NULL DEFAULT 'अज्ञात / Not Specified',
    status TEXT NOT NULL DEFAULT 'Active',
    location TEXT DEFAULT '',
    created_date TEXT,
    updated_date TEXT,
    created_by TEXT DEFAULT 'System',
    updated_by TEXT DEFAULT 'System',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nwbdcp_sources_village ON public."NWBDCP_WaterSources"(village);
CREATE INDEX IF NOT EXISTS idx_nwbdcp_sources_subcenter ON public."NWBDCP_WaterSources"(subcenter);
CREATE INDEX IF NOT EXISTS idx_nwbdcp_sources_status ON public."NWBDCP_WaterSources"(status);
CREATE INDEX IF NOT EXISTS idx_nwbdcp_sources_type ON public."NWBDCP_WaterSources"(source_type);

-- =========================================================================
-- 2. SAMPLE DISPATCHES TABLE (SAMPLE REGISTER)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."NWBDCP_DispatchedSamples" (
    id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL UNIQUE,
    source_id TEXT NOT NULL,
    source_code TEXT,
    subcenter TEXT NOT NULL,
    gram_panchayat TEXT NOT NULL,
    village TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    ownership TEXT NOT NULL DEFAULT 'शासकीय',
    location TEXT DEFAULT '',
    collection_date TEXT NOT NULL,
    dispatch_date TEXT NOT NULL,
    lab_name TEXT DEFAULT 'जिल्हा सार्वजनिक आरोग्य प्रयोगशाळा, धाराशीव',
    dispatched_by TEXT DEFAULT 'वैद्यकीय अधिकारी, प्रा.आ.केंद्र भादा',
    remarks TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'अहवाल अप्राप्त',
    result TEXT DEFAULT 'अहवाल अप्राप्त',
    report_received_date TEXT DEFAULT '',
    lab_ref_no TEXT DEFAULT '',
    lab_remarks TEXT DEFAULT '',
    report_file_name TEXT DEFAULT '',
    report_file_url TEXT DEFAULT '',
    report_file_type TEXT DEFAULT '',
    report_file_size TEXT DEFAULT '',
    report_uploaded_at TEXT DEFAULT '',
    created_date TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT DEFAULT 'System',
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nwbdcp_dispatches_sample_id ON public."NWBDCP_DispatchedSamples"(sample_id);
CREATE INDEX IF NOT EXISTS idx_nwbdcp_dispatches_date ON public."NWBDCP_DispatchedSamples"(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_nwbdcp_dispatches_village ON public."NWBDCP_DispatchedSamples"(village);
CREATE INDEX IF NOT EXISTS idx_nwbdcp_dispatches_subcenter ON public."NWBDCP_DispatchedSamples"(subcenter);
CREATE INDEX IF NOT EXISTS idx_nwbdcp_dispatches_status ON public."NWBDCP_DispatchedSamples"(status);
-- Duplicate dispatch prevention at DB level: Exactly matches application validation (1 source + 1 date = 1 dispatch)
CREATE UNIQUE INDEX IF NOT EXISTS idx_nwbdcp_dispatches_source_date ON public."NWBDCP_DispatchedSamples"(source_id, dispatch_date);

-- =========================================================================
-- 3. SAMPLE RESULTS & CHEMICAL/BIOLOGICAL PARAMETERS TABLE
-- Non-cascading FK (ON DELETE RESTRICT): Prevents deletion of historical lab records
-- Cardinality: Exactly 1 result record per dispatched sample (UNIQUE sample_id)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."NWBDCP_SampleResults" (
    id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL UNIQUE REFERENCES public."NWBDCP_DispatchedSamples"(sample_id) ON DELETE RESTRICT,
    source_id TEXT NOT NULL,
    result TEXT NOT NULL,
    status TEXT NOT NULL,
    report_received_date TEXT,
    lab_ref_no TEXT,
    lab_remarks TEXT,
    coliform_count NUMERIC,
    ecoli_present BOOLEAN DEFAULT FALSE,
    chlorine_ppm NUMERIC,
    turbidity_ntu NUMERIC,
    ph_value NUMERIC,
    tds_ppm NUMERIC,
    tested_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nwbdcp_results_sample ON public."NWBDCP_SampleResults"(sample_id);
CREATE INDEX IF NOT EXISTS idx_nwbdcp_results_result ON public."NWBDCP_SampleResults"(result);

-- =========================================================================
-- 4. CONTAMINATED SOURCE RETESTS TABLE
-- Non-cascading FK on original_sample_id: Ensures original contaminated sample cannot be orphaned
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."NWBDCP_Retests" (
    id TEXT PRIMARY KEY,
    retest_id TEXT NOT NULL UNIQUE,
    original_sample_id TEXT NOT NULL REFERENCES public."NWBDCP_DispatchedSamples"(sample_id) ON DELETE RESTRICT,
    source_id TEXT NOT NULL,
    retest_sample_id TEXT DEFAULT NULL,
    retest_date TEXT,
    retest_collection_date TEXT,
    retest_dispatch_date TEXT,
    lab_name TEXT,
    remarks TEXT,
    retest_result TEXT,
    retest_status TEXT,
    retest_report_received_date TEXT,
    retest_lab_ref_no TEXT,
    retest_report_file_name TEXT,
    retest_report_file_url TEXT,
    corrective_action TEXT,
    created_by TEXT DEFAULT 'System',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent schema migration for existing deployments
ALTER TABLE public."NWBDCP_Retests" ADD COLUMN IF NOT EXISTS retest_collection_date TEXT;
ALTER TABLE public."NWBDCP_Retests" ADD COLUMN IF NOT EXISTS retest_dispatch_date TEXT;
ALTER TABLE public."NWBDCP_Retests" ADD COLUMN IF NOT EXISTS lab_name TEXT;
ALTER TABLE public."NWBDCP_Retests" ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public."NWBDCP_Retests" ADD COLUMN IF NOT EXISTS retest_report_received_date TEXT;
ALTER TABLE public."NWBDCP_Retests" ADD COLUMN IF NOT EXISTS retest_lab_ref_no TEXT;
ALTER TABLE public."NWBDCP_Retests" ADD COLUMN IF NOT EXISTS retest_report_file_name TEXT;
ALTER TABLE public."NWBDCP_Retests" ADD COLUMN IF NOT EXISTS retest_report_file_url TEXT;

CREATE INDEX IF NOT EXISTS idx_nwbdcp_retests_orig_sample ON public."NWBDCP_Retests"(original_sample_id);

-- =========================================================================
-- 5. AUDIT LOGS TABLE (Application-Controlled Append-Only Log)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."NWBDCP_AuditLogs" (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    user_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nwbdcp_audit_action ON public."NWBDCP_AuditLogs"(action);

-- =========================================================================
-- 6. FILE METADATA TABLE (Strictly metadata + Google Drive IDs - NO binary in Supabase)
-- Non-cascading FK (ON DELETE RESTRICT): Prevents orphan or accidental deletion of drive metadata
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."nwbdcp_files" (
    id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL REFERENCES public."NWBDCP_DispatchedSamples"(sample_id) ON DELETE RESTRICT,
    module TEXT NOT NULL DEFAULT 'laboratory_reports',
    file_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    google_drive_file_id TEXT NOT NULL,
    google_drive_url TEXT,
    google_drive_download_url TEXT,
    mime_type TEXT,
    file_size TEXT,
    folder_path TEXT DEFAULT 'NWBDCP/LaboratoryReports/',
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by TEXT DEFAULT 'System',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nwbdcp_files_sample ON public."nwbdcp_files"(sample_id);
CREATE INDEX IF NOT EXISTS idx_nwbdcp_files_drive_id ON public."nwbdcp_files"(google_drive_file_id);
CREATE INDEX IF NOT EXISTS idx_nwbdcp_files_active ON public."nwbdcp_files"(is_active);

-- =========================================================================
-- 7. FILE REPLACEMENT & AUDIT LOG TABLE (Application-Controlled Append-Only Audit)
-- Non-cascading FK (ON DELETE RESTRICT): Enforces link to original dispatched sample
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."nwbdcp_file_audit_logs" (
    id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL REFERENCES public."NWBDCP_DispatchedSamples"(sample_id) ON DELETE RESTRICT,
    module TEXT NOT NULL DEFAULT 'laboratory_reports',
    old_file_id TEXT,
    new_file_id TEXT,
    old_file_name TEXT,
    new_file_name TEXT,
    uploaded_by TEXT,
    upload_datetime TIMESTAMPTZ DEFAULT NOW(),
    replacement_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nwbdcp_file_audit_sample ON public."nwbdcp_file_audit_logs"(sample_id);

-- =========================================================================
-- 8. DURABLE OFFLINE SYNC QUEUE TABLE (Internal Server Sync Queue)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."nwbdcp_sync_queue" (
    queue_id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    retry_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    sync_status TEXT NOT NULL DEFAULT 'PENDING',
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_nwbdcp_sync_status ON public."nwbdcp_sync_queue"(sync_status);

-- =========================================================================
-- 9. AUTO-UPDATE TIMESTAMPS TRIGGER FUNCTION
-- =========================================================================
CREATE OR REPLACE FUNCTION update_nwbdcp_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nwbdcp_sources_updated_at ON public."NWBDCP_WaterSources";
CREATE TRIGGER trg_nwbdcp_sources_updated_at BEFORE UPDATE ON public."NWBDCP_WaterSources" FOR EACH ROW EXECUTE FUNCTION update_nwbdcp_timestamp();

DROP TRIGGER IF EXISTS trg_nwbdcp_dispatches_updated_at ON public."NWBDCP_DispatchedSamples";
CREATE TRIGGER trg_nwbdcp_dispatches_updated_at BEFORE UPDATE ON public."NWBDCP_DispatchedSamples" FOR EACH ROW EXECUTE FUNCTION update_nwbdcp_timestamp();

DROP TRIGGER IF EXISTS trg_nwbdcp_results_updated_at ON public."NWBDCP_SampleResults";
CREATE TRIGGER trg_nwbdcp_results_updated_at BEFORE UPDATE ON public."NWBDCP_SampleResults" FOR EACH ROW EXECUTE FUNCTION update_nwbdcp_timestamp();

DROP TRIGGER IF EXISTS trg_nwbdcp_retests_updated_at ON public."NWBDCP_Retests";
CREATE TRIGGER trg_nwbdcp_retests_updated_at BEFORE UPDATE ON public."NWBDCP_Retests" FOR EACH ROW EXECUTE FUNCTION update_nwbdcp_timestamp();

DROP TRIGGER IF EXISTS trg_nwbdcp_files_updated_at ON public."nwbdcp_files";
CREATE TRIGGER trg_nwbdcp_files_updated_at BEFORE UPDATE ON public."nwbdcp_files" FOR EACH ROW EXECUTE FUNCTION update_nwbdcp_timestamp();

-- =========================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES — HARDENED PRODUCTION CONFIGURATION
-- =========================================================================
-- Enable RLS on all NWBDCP tables
ALTER TABLE public."NWBDCP_WaterSources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NWBDCP_DispatchedSamples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NWBDCP_SampleResults" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NWBDCP_Retests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NWBDCP_AuditLogs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nwbdcp_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nwbdcp_file_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nwbdcp_sync_queue" ENABLE ROW LEVEL SECURITY;

-- 10.1 CLEANUP: DROP ANY PREVIOUS PERMISSIVE POLICIES
DROP POLICY IF EXISTS "NWBDCP_WaterSources_Insert" ON public."NWBDCP_WaterSources";
DROP POLICY IF EXISTS "NWBDCP_WaterSources_Update" ON public."NWBDCP_WaterSources";
DROP POLICY IF EXISTS "NWBDCP_WaterSources_Delete" ON public."NWBDCP_WaterSources";
DROP POLICY IF EXISTS "NWBDCP_WaterSources_All" ON public."NWBDCP_WaterSources";
DROP POLICY IF EXISTS "NWBDCP_WaterSources_Read" ON public."NWBDCP_WaterSources";

DROP POLICY IF EXISTS "NWBDCP_DispatchedSamples_Insert" ON public."NWBDCP_DispatchedSamples";
DROP POLICY IF EXISTS "NWBDCP_DispatchedSamples_Update" ON public."NWBDCP_DispatchedSamples";
DROP POLICY IF EXISTS "NWBDCP_DispatchedSamples_Delete" ON public."NWBDCP_DispatchedSamples";
DROP POLICY IF EXISTS "NWBDCP_DispatchedSamples_All" ON public."NWBDCP_DispatchedSamples";
DROP POLICY IF EXISTS "NWBDCP_DispatchedSamples_Read" ON public."NWBDCP_DispatchedSamples";

DROP POLICY IF EXISTS "NWBDCP_SampleResults_Insert" ON public."NWBDCP_SampleResults";
DROP POLICY IF EXISTS "NWBDCP_SampleResults_Update" ON public."NWBDCP_SampleResults";
DROP POLICY IF EXISTS "NWBDCP_SampleResults_Delete" ON public."NWBDCP_SampleResults";
DROP POLICY IF EXISTS "NWBDCP_SampleResults_All" ON public."NWBDCP_SampleResults";
DROP POLICY IF EXISTS "NWBDCP_SampleResults_Read" ON public."NWBDCP_SampleResults";

DROP POLICY IF EXISTS "NWBDCP_Retests_Insert" ON public."NWBDCP_Retests";
DROP POLICY IF EXISTS "NWBDCP_Retests_Update" ON public."NWBDCP_Retests";
DROP POLICY IF EXISTS "NWBDCP_Retests_Delete" ON public."NWBDCP_Retests";
DROP POLICY IF EXISTS "NWBDCP_Retests_All" ON public."NWBDCP_Retests";
DROP POLICY IF EXISTS "NWBDCP_Retests_Read" ON public."NWBDCP_Retests";

DROP POLICY IF EXISTS "NWBDCP_AuditLogs_Insert" ON public."NWBDCP_AuditLogs";
DROP POLICY IF EXISTS "NWBDCP_AuditLogs_Update" ON public."NWBDCP_AuditLogs";
DROP POLICY IF EXISTS "NWBDCP_AuditLogs_Delete" ON public."NWBDCP_AuditLogs";
DROP POLICY IF EXISTS "NWBDCP_AuditLogs_All" ON public."NWBDCP_AuditLogs";
DROP POLICY IF EXISTS "NWBDCP_AuditLogs_Read" ON public."NWBDCP_AuditLogs";

DROP POLICY IF EXISTS "NWBDCP_Files_Insert" ON public."nwbdcp_files";
DROP POLICY IF EXISTS "NWBDCP_Files_Update" ON public."nwbdcp_files";
DROP POLICY IF EXISTS "NWBDCP_Files_Delete" ON public."nwbdcp_files";
DROP POLICY IF EXISTS "NWBDCP_Files_All" ON public."nwbdcp_files";
DROP POLICY IF EXISTS "NWBDCP_Files_Read" ON public."nwbdcp_files";

DROP POLICY IF EXISTS "NWBDCP_FileAudit_Insert" ON public."nwbdcp_file_audit_logs";
DROP POLICY IF EXISTS "NWBDCP_FileAudit_Update" ON public."nwbdcp_file_audit_logs";
DROP POLICY IF EXISTS "NWBDCP_FileAudit_Delete" ON public."nwbdcp_file_audit_logs";
DROP POLICY IF EXISTS "NWBDCP_FileAudit_All" ON public."nwbdcp_file_audit_logs";
DROP POLICY IF EXISTS "NWBDCP_FileAudit_Read" ON public."nwbdcp_file_audit_logs";

DROP POLICY IF EXISTS "NWBDCP_SyncQueue_Insert" ON public."nwbdcp_sync_queue";
DROP POLICY IF EXISTS "NWBDCP_SyncQueue_Update" ON public."nwbdcp_sync_queue";
DROP POLICY IF EXISTS "NWBDCP_SyncQueue_Delete" ON public."nwbdcp_sync_queue";
DROP POLICY IF EXISTS "NWBDCP_SyncQueue_All" ON public."nwbdcp_sync_queue";
DROP POLICY IF EXISTS "NWBDCP_SyncQueue_Read" ON public."nwbdcp_sync_queue";

-- 10.2 ZERO-TRUST ARCHITECTURE
-- PostgreSQL Default Deny with RLS Enabled:
-- With RLS enabled and zero public grant policies, direct REST calls using Anon/Public keys are rejected.
-- The Express backend server connects exclusively via SUPABASE_SERVICE_ROLE_KEY, which automatically
-- bypasses RLS and executes verified, logged transactions.
