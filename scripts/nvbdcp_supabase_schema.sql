-- =========================================================================
-- NVBDCP SUPABASE PRODUCTION DATABASE SCHEMA
-- Application: PHC Bhada National Vector Borne Disease Control Programme
-- Architecture: Supabase as PRIMARY Database with Service-Role Security
-- Row-Level Security: Enabled on all tables; Service-Role bypasses RLS
-- =========================================================================

-- 1. SUBCENTERS MASTER
CREATE TABLE IF NOT EXISTS public."NVBDCP_Subcenters" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    headquarter TEXT,
    population BIGINT DEFAULT 0,
    houses BIGINT DEFAULT 0,
    villages JSONB DEFAULT '[]'::jsonb,
    contact_person TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_subcenters_name ON public."NVBDCP_Subcenters"(name);

-- 2. VILLAGES MASTER
CREATE TABLE IF NOT EXISTS public."NVBDCP_Villages" (
    id TEXT PRIMARY KEY,
    village_name TEXT NOT NULL,
    subcenter TEXT NOT NULL,
    population BIGINT DEFAULT 0,
    houses BIGINT DEFAULT 0,
    households BIGINT DEFAULT 0,
    annual_smear_target BIGINT DEFAULT 0,
    asha_name TEXT DEFAULT '',
    assigned_employees JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_villages_subcenter ON public."NVBDCP_Villages"(subcenter);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_villages_name ON public."NVBDCP_Villages"(village_name);

-- 3. EMPLOYEES MASTER
CREATE TABLE IF NOT EXISTS public."NVBDCP_Employees" (
    id TEXT PRIMARY KEY,
    employee_name TEXT NOT NULL,
    designation TEXT NOT NULL,
    upkendra TEXT NOT NULL,
    bs_code TEXT DEFAULT '',
    village_list JSONB DEFAULT '[]'::jsonb,
    mobile TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_employees_upkendra ON public."NVBDCP_Employees"(upkendra);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_employees_bscode ON public."NVBDCP_Employees"(bs_code);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_employees_name ON public."NVBDCP_Employees"(employee_name);

-- 4. MONTH MASTER (INDICATORS & PROGRESSIVE TOTALS)
CREATE TABLE IF NOT EXISTS public."NVBDCP_MonthMaster" (
    name TEXT PRIMARY KEY,
    f1_start TIMESTAMPTZ,
    f1_end TIMESTAMPTZ,
    f2_start TIMESTAMPTZ,
    f2_end TIMESTAMPTZ,
    new_opd NUMERIC DEFAULT 0,
    prog_new_opd NUMERIC DEFAULT 0,
    mpw_fn1 NUMERIC DEFAULT 0,
    mpw_fn2 NUMERIC DEFAULT 0,
    mpw_home_visits NUMERIC DEFAULT 0,
    prog_mpw_fn1 NUMERIC DEFAULT 0,
    prog_mpw_fn2 NUMERIC DEFAULT 0,
    prog_mpw_home_visits NUMERIC DEFAULT 0,
    anm_fn1 NUMERIC DEFAULT 0,
    anm_fn2 NUMERIC DEFAULT 0,
    anm_home_visits NUMERIC DEFAULT 0,
    prog_anm_fn1 NUMERIC DEFAULT 0,
    prog_anm_fn2 NUMERIC DEFAULT 0,
    prog_anm_home_visits NUMERIC DEFAULT 0,
    asha_home_visits NUMERIC DEFAULT 0,
    prog_asha_home_visits NUMERIC DEFAULT 0,
    fever_cases NUMERIC DEFAULT 0,
    prog_fever_cases NUMERIC DEFAULT 0,
    blood_smears NUMERIC DEFAULT 0,
    prog_blood_smears NUMERIC DEFAULT 0,
    treated_cases NUMERIC DEFAULT 0,
    prog_treated_cases NUMERIC DEFAULT 0,
    chloroquine_spent NUMERIC DEFAULT 0,
    prog_chloroquine_spent NUMERIC DEFAULT 0,
    prior_opd_sum NUMERIC DEFAULT 0,
    prior_fever_sum NUMERIC DEFAULT 0,
    prior_smears_sum NUMERIC DEFAULT 0,
    prior_treated_sum NUMERIC DEFAULT 0,
    prior_cq_sum NUMERIC DEFAULT 0,
    prior_mpw_sum NUMERIC DEFAULT 0,
    prior_anm_sum NUMERIC DEFAULT 0,
    prior_asha_sum NUMERIC DEFAULT 0,
    blood_smears_manual BOOLEAN DEFAULT true,
    prior_mpw_fn1_sum NUMERIC DEFAULT 0,
    prior_mpw_fn2_sum NUMERIC DEFAULT 0,
    prior_anm_fn1_sum NUMERIC DEFAULT 0,
    prior_anm_fn2_sum NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BLOOD SMEAR DATA ENTRY (BS DATA ENTRY)
CREATE TABLE IF NOT EXISTS public."NVBDCP_BsDataEntry" (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL,
    upkendra TEXT DEFAULT '',
    employee_name TEXT DEFAULT '',
    designation TEXT DEFAULT '',
    bs_code TEXT DEFAULT '',
    bundle_number TEXT DEFAULT '',
    pasun NUMERIC DEFAULT 0,
    paraynt NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_bsdata_date ON public."NVBDCP_BsDataEntry"(date);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_bsdata_upkendra ON public."NVBDCP_BsDataEntry"(upkendra);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_bsdata_bscode ON public."NVBDCP_BsDataEntry"(bs_code);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_bsdata_emp ON public."NVBDCP_BsDataEntry"(employee_name);

-- 6. VILLAGE DETAILS BREAKDOWN
CREATE TABLE IF NOT EXISTS public."NVBDCP_VillageDetails" (
    id TEXT PRIMARY KEY,
    bs_id TEXT NOT NULL,
    employee_name TEXT DEFAULT '',
    date TIMESTAMPTZ NOT NULL,
    village_name TEXT DEFAULT '',
    sample_count NUMERIC DEFAULT 0,
    male_count NUMERIC DEFAULT 0,
    female_count NUMERIC DEFAULT 0,
    upkendra TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_vildetails_bsid ON public."NVBDCP_VillageDetails"(bs_id);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_vildetails_date ON public."NVBDCP_VillageDetails"(date);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_vildetails_village ON public."NVBDCP_VillageDetails"(village_name);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_vildetails_upkendra ON public."NVBDCP_VillageDetails"(upkendra);

-- 7. EMPLOYEE TRANSFER HISTORY
CREATE TABLE IF NOT EXISTS public."NVBDCP_TransferHistory" (
    id TEXT PRIMARY KEY,
    employee_id TEXT DEFAULT '',
    employee_name TEXT DEFAULT '',
    old_upkendra TEXT DEFAULT '',
    new_upkendra TEXT DEFAULT '',
    old_villages JSONB DEFAULT '[]'::jsonb,
    new_villages JSONB DEFAULT '[]'::jsonb,
    old_bscode TEXT DEFAULT '',
    new_bscode TEXT DEFAULT '',
    order_no TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    transfer_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_transfers_empid ON public."NVBDCP_TransferHistory"(employee_id);

-- 8. DENGUE & CHIKUNGUNYA SURVEILLANCE
CREATE TABLE IF NOT EXISTS public."NVBDCP_DengueChikungunya" (
    id TEXT PRIMARY KEY,
    patient_name TEXT DEFAULT '',
    age NUMERIC DEFAULT 0,
    gender TEXT DEFAULT '',
    village TEXT DEFAULT '',
    upkendra TEXT DEFAULT '',
    date_collection TEXT DEFAULT '',
    date_reporting TEXT DEFAULT '',
    disease_type TEXT DEFAULT 'डेंग्यू',
    lab_result TEXT DEFAULT 'प्रलंबित',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_dengue_village ON public."NVBDCP_DengueChikungunya"(village);
CREATE INDEX IF NOT EXISTS idx_nvbdcp_dengue_upkendra ON public."NVBDCP_DengueChikungunya"(upkendra);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public."NVBDCP_Subcenters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NVBDCP_Villages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NVBDCP_Employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NVBDCP_MonthMaster" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NVBDCP_BsDataEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NVBDCP_VillageDetails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NVBDCP_TransferHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NVBDCP_DengueChikungunya" ENABLE ROW LEVEL SECURITY;

-- Allow trusted service-role access (Supabase service role automatically bypasses RLS, but explicit policy for clarity)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_subcenters' AND tablename = 'NVBDCP_Subcenters') THEN
    CREATE POLICY service_role_all_subcenters ON public."NVBDCP_Subcenters" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_villages' AND tablename = 'NVBDCP_Villages') THEN
    CREATE POLICY service_role_all_villages ON public."NVBDCP_Villages" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_employees' AND tablename = 'NVBDCP_Employees') THEN
    CREATE POLICY service_role_all_employees ON public."NVBDCP_Employees" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_months' AND tablename = 'NVBDCP_MonthMaster') THEN
    CREATE POLICY service_role_all_months ON public."NVBDCP_MonthMaster" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_bsdata' AND tablename = 'NVBDCP_BsDataEntry') THEN
    CREATE POLICY service_role_all_bsdata ON public."NVBDCP_BsDataEntry" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_vildetails' AND tablename = 'NVBDCP_VillageDetails') THEN
    CREATE POLICY service_role_all_vildetails ON public."NVBDCP_VillageDetails" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_transfers' AND tablename = 'NVBDCP_TransferHistory') THEN
    CREATE POLICY service_role_all_transfers ON public."NVBDCP_TransferHistory" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_dengue' AND tablename = 'NVBDCP_DengueChikungunya') THEN
    CREATE POLICY service_role_all_dengue ON public."NVBDCP_DengueChikungunya" FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
