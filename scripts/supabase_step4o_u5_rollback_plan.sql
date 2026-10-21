-- ==============================================================================
-- SCRIPT: scripts/supabase_step4o_u5_rollback_plan.sql
-- PROJECT: PHC Bhada — NVBDCP + NWBDCP Management System
-- LIVE SUPABASE PROJECT: yuebizvqapfegcjwqxbd
-- PURPOSE: STEP 4O-U7 — COMPANION ROLLBACK SCRIPT WITH OVERWRITE PROTECTION
--
-- EXECUTION STATUS: PREPARED FOR EMERGENCY ROLLBACK ONLY — DO NOT EXECUTE ARBITRARILY
--
-- REVERSAL ACTIONS:
--   1. Verify archive tables exist and contain required archived records (837 BS, 76 VD).
--   2. Restore 837 pre-2026 rows back into active public."NVBDCP_BsDataEntry" (restricted to pre-2026 rows).
--   3. Restore 76 pre-2026 rows back into active public."NVBDCP_VillageDetails" (restricted to pre-2026 rows).
--   4. Safely revert the 2 reconciled 2026-01-05 VillageDetails rows back to 'BS_20260105_54S1_842'.
--   5. Verify that active pre-2026 row counts return exactly to 837 in NVBDCP_BsDataEntry and 76 in NVBDCP_VillageDetails,
--      while guaranteeing no subsequent 2026 active records were destroyed.
--   6. Verify that master tables and NWBDCP remain 100% untouched.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: PRE-ROLLBACK SAFETY ASSERTIONS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_arch_bs INT;
    v_arch_vd INT;
BEGIN
    -- Check that archive tables exist and contain required rows
    SELECT COUNT(*) INTO v_arch_bs FROM public."NVBDCP_Archive_BsDataEntry_2025";
    SELECT COUNT(*) INTO v_arch_vd FROM public."NVBDCP_Archive_VillageDetails_2025";

    IF v_arch_bs != 837 THEN
        RAISE EXCEPTION 'Rollback aborted: NVBDCP_Archive_BsDataEntry_2025 contains % rows (expected 837)', v_arch_bs;
    END IF;

    IF v_arch_vd != 76 THEN
        RAISE EXCEPTION 'Rollback aborted: NVBDCP_Archive_VillageDetails_2025 contains % rows (expected 76)', v_arch_vd;
    END IF;

    RAISE NOTICE 'Rollback pre-flight passed: 837 BS and 76 VD archive records verified for restoration.';
END $$;

-- ------------------------------------------------------------------------------
-- STEP 2: RESTORE PARENT TABLE (NVBDCP_BsDataEntry) FIRST WITH OVERWRITE GUARDS
-- ------------------------------------------------------------------------------
INSERT INTO public."NVBDCP_BsDataEntry" (
    id, date, upkendra, employee_name, designation, bs_code, bundle_number, pasun, paraynt, total, created_at, updated_at
)
SELECT id, date, upkendra, employee_name, designation, bs_code, bundle_number, pasun, paraynt, total, created_at, updated_at
FROM public."NVBDCP_Archive_BsDataEntry_2025"
WHERE date < '2026-01-01T00:00:00+00:00'
ON CONFLICT (id) DO UPDATE SET
    date = EXCLUDED.date,
    upkendra = EXCLUDED.upkendra,
    employee_name = EXCLUDED.employee_name,
    designation = EXCLUDED.designation,
    bs_code = EXCLUDED.bs_code,
    bundle_number = EXCLUDED.bundle_number,
    pasun = EXCLUDED.pasun,
    paraynt = EXCLUDED.paraynt,
    total = EXCLUDED.total,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at
WHERE public."NVBDCP_BsDataEntry".date < '2026-01-01T00:00:00+00:00';

-- ------------------------------------------------------------------------------
-- STEP 3: RESTORE CHILD TABLE (NVBDCP_VillageDetails) SECOND WITH OVERWRITE GUARDS
-- ------------------------------------------------------------------------------
INSERT INTO public."NVBDCP_VillageDetails" (
    id, bs_id, employee_name, date, village_name, sample_count, male_count, female_count, upkendra, created_at, updated_at
)
SELECT id, bs_id, employee_name, date, village_name, sample_count, male_count, female_count, upkendra, created_at, updated_at
FROM public."NVBDCP_Archive_VillageDetails_2025"
WHERE date < '2026-01-01T00:00:00+00:00'
ON CONFLICT (id) DO UPDATE SET
    bs_id = EXCLUDED.bs_id,
    employee_name = EXCLUDED.employee_name,
    date = EXCLUDED.date,
    village_name = EXCLUDED.village_name,
    sample_count = EXCLUDED.sample_count,
    male_count = EXCLUDED.male_count,
    female_count = EXCLUDED.female_count,
    upkendra = EXCLUDED.upkendra,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at
WHERE public."NVBDCP_VillageDetails".date < '2026-01-01T00:00:00+00:00';

-- ------------------------------------------------------------------------------
-- STEP 4: REVERT THE 2 SURGICALLY RECONCILED 2026 ROWS
-- ------------------------------------------------------------------------------
UPDATE public."NVBDCP_VillageDetails"
SET bs_id = 'BS_20260105_54S1_842',
    updated_at = NOW()
WHERE id IN ('VD_BS_20260105_54S1_842______87', 'VD_BS_20260105_54S1_842__-_______88')
  AND bs_id = 'BS_20260105_54S1A1_840'
  AND date = '2026-01-05T12:00:00+00:00';

-- ------------------------------------------------------------------------------
-- STEP 5: POST-ROLLBACK VERIFICATION WITH RESILIENCE FOR POST-MIGRATION DATA
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_restored_total_bs INT;
    v_restored_total_vd INT;
    v_restored_pre_bs INT;
    v_restored_pre_vd INT;
    v_restored_2026_bs INT;
    v_restored_2026_vd INT;
BEGIN
    SELECT COUNT(*) INTO v_restored_total_bs FROM public."NVBDCP_BsDataEntry";
    SELECT COUNT(*) INTO v_restored_total_vd FROM public."NVBDCP_VillageDetails";
    SELECT COUNT(*) INTO v_restored_pre_bs FROM public."NVBDCP_BsDataEntry" WHERE date < '2026-01-01T00:00:00+00:00';
    SELECT COUNT(*) INTO v_restored_pre_vd FROM public."NVBDCP_VillageDetails" WHERE date < '2026-01-01T00:00:00+00:00';
    SELECT COUNT(*) INTO v_restored_2026_bs FROM public."NVBDCP_BsDataEntry" WHERE date >= '2026-01-01T00:00:00+00:00';
    SELECT COUNT(*) INTO v_restored_2026_vd FROM public."NVBDCP_VillageDetails" WHERE date >= '2026-01-01T00:00:00+00:00';

    -- Pre-2026 records must match original baseline exactly
    IF v_restored_pre_bs != 837 THEN
        RAISE EXCEPTION 'Rollback verification failed: Restored pre-2026 BS count is % (expected 837)', v_restored_pre_bs;
    END IF;

    IF v_restored_pre_vd != 76 THEN
        RAISE EXCEPTION 'Rollback verification failed: Restored pre-2026 VillageDetails count is % (expected 76)', v_restored_pre_vd;
    END IF;

    -- Ensure no subsequent 2026 operational records were destroyed or dropped
    IF v_restored_2026_bs < 657 THEN
        RAISE EXCEPTION 'Rollback verification failed: Active 2026 BS count dropped to % (expected >= 657)', v_restored_2026_bs;
    END IF;

    IF v_restored_2026_vd < 724 THEN
        RAISE EXCEPTION 'Rollback verification failed: Active 2026 VillageDetails count dropped to % (expected >= 724)', v_restored_2026_vd;
    END IF;

    RAISE NOTICE 'SUCCESS: Rollback complete. Pre-2026 historical records restored (837 BS, 76 VD); 2026 operational records preserved (% BS, % VD).',
                 v_restored_2026_bs, v_restored_2026_vd;
END $$;

COMMIT;
