-- ==============================================================================
-- SCRIPT: scripts/supabase_step4o_u4_retention_plan.sql
-- PROJECT: PHC Bhada — NVBDCP + NWBDCP Management System
-- LIVE SUPABASE PROJECT: yuebizvqapfegcjwqxbd
-- PURPOSE: STEP 4O-U7 — 2026-ONLY NVBDCP RETENTION PLAN (SECURITY & BIDIRECTIONAL VERIFICATION PATCHED)
--
-- EXECUTION STATUS: PREPARED FOR REVIEW ONLY — DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL
--
-- RETENTION POLICY:
--   Official cutoff: 2026-01-01T00:00:00+00:00 inclusive.
--   Active dataset: Records dated on or after 2026-01-01.
--   Pre-2026 dataset: 837 rows in NVBDCP_BsDataEntry, 76 rows in NVBDCP_VillageDetails.
--   Protected master data: NVBDCP_Subcenters (8), NVBDCP_Villages (30),
--                          NVBDCP_Employees (65), NVBDCP_MonthMaster (12),
--                          NVBDCP_BsCodes (67).
--   NWBDCP status: COMPLETELY PROTECTED AND UNTOUCHED.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: PRE-FLIGHT SAFETY ASSERTIONS (Verify baseline counts before changes)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_bs_total INT;
    v_vd_total INT;
    v_bs_pre2026 INT;
    v_vd_pre2026 INT;
    v_bs_2026 INT;
    v_vd_2026 INT;
BEGIN
    SELECT COUNT(*) INTO v_bs_total FROM public."NVBDCP_BsDataEntry";
    SELECT COUNT(*) INTO v_vd_total FROM public."NVBDCP_VillageDetails";
    SELECT COUNT(*) INTO v_bs_pre2026 FROM public."NVBDCP_BsDataEntry" WHERE date < '2026-01-01T00:00:00+00:00';
    SELECT COUNT(*) INTO v_vd_pre2026 FROM public."NVBDCP_VillageDetails" WHERE date < '2026-01-01T00:00:00+00:00';
    SELECT COUNT(*) INTO v_bs_2026 FROM public."NVBDCP_BsDataEntry" WHERE date >= '2026-01-01T00:00:00+00:00';
    SELECT COUNT(*) INTO v_vd_2026 FROM public."NVBDCP_VillageDetails" WHERE date >= '2026-01-01T00:00:00+00:00';

    IF v_bs_total != 1494 THEN
        RAISE EXCEPTION 'Pre-flight check failed: NVBDCP_BsDataEntry total is % (expected 1494)', v_bs_total;
    END IF;

    IF v_vd_total != 800 THEN
        RAISE EXCEPTION 'Pre-flight check failed: NVBDCP_VillageDetails total is % (expected 800)', v_vd_total;
    END IF;

    IF v_bs_pre2026 != 837 THEN
        RAISE EXCEPTION 'Pre-flight check failed: NVBDCP_BsDataEntry pre-2026 is % (expected 837)', v_bs_pre2026;
    END IF;

    IF v_vd_pre2026 != 76 THEN
        RAISE EXCEPTION 'Pre-flight check failed: NVBDCP_VillageDetails pre-2026 is % (expected 76)', v_vd_pre2026;
    END IF;

    IF v_bs_2026 != 657 THEN
        RAISE EXCEPTION 'Pre-flight check failed: NVBDCP_BsDataEntry 2026 is % (expected 657)', v_bs_2026;
    END IF;

    IF v_vd_2026 != 724 THEN
        RAISE EXCEPTION 'Pre-flight check failed: NVBDCP_VillageDetails 2026 is % (expected 724)', v_vd_2026;
    END IF;

    RAISE NOTICE 'Pre-flight assertions passed: 1494 BS rows (837 pre-2026, 657 active 2026); 800 VD rows (76 pre-2026, 724 active 2026).';
END $$;

-- ------------------------------------------------------------------------------
-- STEP 2: CREATE HISTORICAL ARCHIVE TABLES WITH STRICT ACCESS RESTRICTION & RLS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."NVBDCP_Archive_BsDataEntry_2025" (LIKE public."NVBDCP_BsDataEntry" INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public."NVBDCP_Archive_VillageDetails_2025" (LIKE public."NVBDCP_VillageDetails" INCLUDING ALL);

-- Revoke default public/anon/authenticated access to prevent unauthorized exposure via PostgREST
REVOKE ALL ON public."NVBDCP_Archive_BsDataEntry_2025" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public."NVBDCP_Archive_VillageDetails_2025" FROM PUBLIC, anon, authenticated;

-- Enable and force Row Level Security (RLS) on both archive tables
ALTER TABLE public."NVBDCP_Archive_BsDataEntry_2025" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NVBDCP_Archive_BsDataEntry_2025" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."NVBDCP_Archive_VillageDetails_2025" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NVBDCP_Archive_VillageDetails_2025" FORCE ROW LEVEL SECURITY;

-- Grant access ONLY to administrative service role
GRANT ALL ON public."NVBDCP_Archive_BsDataEntry_2025" TO service_role;
GRANT ALL ON public."NVBDCP_Archive_VillageDetails_2025" TO service_role;

-- Establish explicit restrictive policies for service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'NVBDCP_Archive_BsDataEntry_2025' 
      AND policyname = 'service_role_admin_only_archive_bs'
  ) THEN
    CREATE POLICY service_role_admin_only_archive_bs 
    ON public."NVBDCP_Archive_BsDataEntry_2025" 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'NVBDCP_Archive_VillageDetails_2025' 
      AND policyname = 'service_role_admin_only_archive_vd'
  ) THEN
    CREATE POLICY service_role_admin_only_archive_vd 
    ON public."NVBDCP_Archive_VillageDetails_2025" 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 3: CONFLICT CHECK & SAFE ARCHIVE COPY
-- ------------------------------------------------------------------------------
-- Assert no pre-existing conflicting archive rows with divergent payload columns exist
DO $$
DECLARE
    v_conflict_bs INT;
    v_conflict_vd INT;
BEGIN
    SELECT COUNT(*) INTO v_conflict_bs
    FROM public."NVBDCP_BsDataEntry" s
    JOIN public."NVBDCP_Archive_BsDataEntry_2025" a ON s.id = a.id
    WHERE s.date < '2026-01-01T00:00:00+00:00'
      AND (
        s.date IS DISTINCT FROM a.date OR
        s.upkendra IS DISTINCT FROM a.upkendra OR
        s.employee_name IS DISTINCT FROM a.employee_name OR
        s.designation IS DISTINCT FROM a.designation OR
        s.bs_code IS DISTINCT FROM a.bs_code OR
        s.bundle_number IS DISTINCT FROM a.bundle_number OR
        s.pasun IS DISTINCT FROM a.pasun OR
        s.paraynt IS DISTINCT FROM a.paraynt OR
        s.total IS DISTINCT FROM a.total
      );

    IF v_conflict_bs > 0 THEN
        RAISE EXCEPTION 'Archive conflict detected: % pre-2026 BS rows exist in archive with divergent column contents', v_conflict_bs;
    END IF;

    SELECT COUNT(*) INTO v_conflict_vd
    FROM public."NVBDCP_VillageDetails" s
    JOIN public."NVBDCP_Archive_VillageDetails_2025" a ON s.id = a.id
    WHERE s.date < '2026-01-01T00:00:00+00:00'
      AND (
        s.bs_id IS DISTINCT FROM a.bs_id OR
        s.employee_name IS DISTINCT FROM a.employee_name OR
        s.date IS DISTINCT FROM a.date OR
        s.village_name IS DISTINCT FROM a.village_name OR
        s.sample_count IS DISTINCT FROM a.sample_count OR
        s.male_count IS DISTINCT FROM a.male_count OR
        s.female_count IS DISTINCT FROM a.female_count OR
        s.upkendra IS DISTINCT FROM a.upkendra
      );

    IF v_conflict_vd > 0 THEN
        RAISE EXCEPTION 'Archive conflict detected: % pre-2026 VillageDetails rows exist in archive with divergent column contents', v_conflict_vd;
    END IF;
END $$;

-- Insert source rows with explicit column lists
INSERT INTO public."NVBDCP_Archive_BsDataEntry_2025" (
    id, date, upkendra, employee_name, designation, bs_code, bundle_number, pasun, paraynt, total, created_at, updated_at
)
SELECT id, date, upkendra, employee_name, designation, bs_code, bundle_number, pasun, paraynt, total, created_at, updated_at
FROM public."NVBDCP_BsDataEntry"
WHERE date < '2026-01-01T00:00:00+00:00'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."NVBDCP_Archive_VillageDetails_2025" (
    id, bs_id, employee_name, date, village_name, sample_count, male_count, female_count, upkendra, created_at, updated_at
)
SELECT id, bs_id, employee_name, date, village_name, sample_count, male_count, female_count, upkendra, created_at, updated_at
FROM public."NVBDCP_VillageDetails"
WHERE date < '2026-01-01T00:00:00+00:00'
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- STEP 4: BIDIRECTIONAL ROW-LEVEL "EXCEPT ALL" VERIFICATION
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_arch_bs INT;
    v_arch_vd INT;
    v_bs_diff_src_to_arch INT;
    v_bs_diff_arch_to_src INT;
    v_vd_diff_src_to_arch INT;
    v_vd_diff_arch_to_src INT;
BEGIN
    -- 1. Exact Row Count Assertions
    SELECT COUNT(*) INTO v_arch_bs FROM public."NVBDCP_Archive_BsDataEntry_2025";
    SELECT COUNT(*) INTO v_arch_vd FROM public."NVBDCP_Archive_VillageDetails_2025";

    IF v_arch_bs != 837 THEN
        RAISE EXCEPTION 'Archive count failed: NVBDCP_Archive_BsDataEntry_2025 has % rows (expected 837)', v_arch_bs;
    END IF;

    IF v_arch_vd != 76 THEN
        RAISE EXCEPTION 'Archive count failed: NVBDCP_Archive_VillageDetails_2025 has % rows (expected 76)', v_arch_vd;
    END IF;

    -- 2. Bidirectional Row-Level EXCEPT ALL Verification: BsDataEntry
    -- Direction A: Source -> Archive (Every source row must exist identically in archive)
    SELECT COUNT(*) INTO v_bs_diff_src_to_arch
    FROM (
        SELECT id, date, upkendra, employee_name, designation, bs_code, bundle_number, pasun, paraynt, total
        FROM public."NVBDCP_BsDataEntry"
        WHERE date < '2026-01-01T00:00:00+00:00'
        EXCEPT ALL
        SELECT id, date, upkendra, employee_name, designation, bs_code, bundle_number, pasun, paraynt, total
        FROM public."NVBDCP_Archive_BsDataEntry_2025"
    ) diff_bs_1;

    IF v_bs_diff_src_to_arch != 0 THEN
        RAISE EXCEPTION 'Bidirectional verification failed: % pre-2026 BS rows missing or mismatched in archive', v_bs_diff_src_to_arch;
    END IF;

    -- Direction B: Archive -> Source (No foreign or altered pre-2026 rows in archive)
    SELECT COUNT(*) INTO v_bs_diff_arch_to_src
    FROM (
        SELECT id, date, upkendra, employee_name, designation, bs_code, bundle_number, pasun, paraynt, total
        FROM public."NVBDCP_Archive_BsDataEntry_2025"
        WHERE date < '2026-01-01T00:00:00+00:00'
        EXCEPT ALL
        SELECT id, date, upkendra, employee_name, designation, bs_code, bundle_number, pasun, paraynt, total
        FROM public."NVBDCP_BsDataEntry"
        WHERE date < '2026-01-01T00:00:00+00:00'
    ) diff_bs_2;

    IF v_bs_diff_arch_to_src != 0 THEN
        RAISE EXCEPTION 'Bidirectional verification failed: % archive BS rows do not match active source', v_bs_diff_arch_to_src;
    END IF;

    -- 3. Bidirectional Row-Level EXCEPT ALL Verification: VillageDetails
    -- Direction A: Source -> Archive
    SELECT COUNT(*) INTO v_vd_diff_src_to_arch
    FROM (
        SELECT id, bs_id, employee_name, date, village_name, sample_count, male_count, female_count, upkendra
        FROM public."NVBDCP_VillageDetails"
        WHERE date < '2026-01-01T00:00:00+00:00'
        EXCEPT ALL
        SELECT id, bs_id, employee_name, date, village_name, sample_count, male_count, female_count, upkendra
        FROM public."NVBDCP_Archive_VillageDetails_2025"
    ) diff_vd_1;

    IF v_vd_diff_src_to_arch != 0 THEN
        RAISE EXCEPTION 'Bidirectional verification failed: % pre-2026 VillageDetails rows missing or mismatched in archive', v_vd_diff_src_to_arch;
    END IF;

    -- Direction B: Archive -> Source
    SELECT COUNT(*) INTO v_vd_diff_arch_to_src
    FROM (
        SELECT id, bs_id, employee_name, date, village_name, sample_count, male_count, female_count, upkendra
        FROM public."NVBDCP_Archive_VillageDetails_2025"
        WHERE date < '2026-01-01T00:00:00+00:00'
        EXCEPT ALL
        SELECT id, bs_id, employee_name, date, village_name, sample_count, male_count, female_count, upkendra
        FROM public."NVBDCP_VillageDetails"
        WHERE date < '2026-01-01T00:00:00+00:00'
    ) diff_vd_2;

    IF v_vd_diff_arch_to_src != 0 THEN
        RAISE EXCEPTION 'Bidirectional verification failed: % archive VillageDetails rows do not match active source', v_vd_diff_arch_to_src;
    END IF;

    RAISE NOTICE 'Bidirectional archive verification passed: 837 BS and 76 VD rows verified identical in both directions.';
END $$;

-- ------------------------------------------------------------------------------
-- STEP 5: PRUNE PRE-2026 RECORDS FROM ACTIVE TABLES
-- ------------------------------------------------------------------------------
-- Dependent child records deleted first to respect relational order
DELETE FROM public."NVBDCP_VillageDetails"
WHERE date < '2026-01-01T00:00:00+00:00';

-- Parent blood smear entries deleted second
DELETE FROM public."NVBDCP_BsDataEntry"
WHERE date < '2026-01-01T00:00:00+00:00';

-- ------------------------------------------------------------------------------
-- STEP 6: SURGICAL RECONCILIATION FOR THE TWO 2026-01-05 ANOMALIES
-- ------------------------------------------------------------------------------
UPDATE public."NVBDCP_VillageDetails"
SET bs_id = 'BS_20260105_54S1A1_840',
    updated_at = NOW()
WHERE id IN ('VD_BS_20260105_54S1_842______87', 'VD_BS_20260105_54S1_842__-_______88')
  AND bs_id = 'BS_20260105_54S1_842'
  AND date = '2026-01-05T12:00:00+00:00';

-- ------------------------------------------------------------------------------
-- STEP 7: POST-EXECUTION VERIFICATION & RELATIONAL INTEGRITY CHECK
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_rem_bs INT;
    v_rem_vd INT;
    v_orphaned_vd INT;
BEGIN
    SELECT COUNT(*) INTO v_rem_bs FROM public."NVBDCP_BsDataEntry";
    SELECT COUNT(*) INTO v_rem_vd FROM public."NVBDCP_VillageDetails";

    IF v_rem_bs != 657 THEN
        RAISE EXCEPTION 'Post-execution check failed: Active NVBDCP_BsDataEntry has % rows (expected 657)', v_rem_bs;
    END IF;

    IF v_rem_vd != 724 THEN
        RAISE EXCEPTION 'Post-execution check failed: Active NVBDCP_VillageDetails has % rows (expected 724)', v_rem_vd;
    END IF;

    SELECT COUNT(*) INTO v_orphaned_vd
    FROM public."NVBDCP_VillageDetails" vd
    LEFT JOIN public."NVBDCP_BsDataEntry" bs ON vd.bs_id = bs.id
    WHERE bs.id IS NULL;

    IF v_orphaned_vd != 0 THEN
        RAISE EXCEPTION 'Relational integrity failed: % orphaned rows remain in NVBDCP_VillageDetails', v_orphaned_vd;
    END IF;

    RAISE NOTICE 'SUCCESS: Active 2026 dataset reconciled with 100%% relational integrity (657 BS rows, 724 VD rows, 0 orphans).';
END $$;

COMMIT;
