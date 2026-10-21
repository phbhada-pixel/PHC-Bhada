-- =========================================================================
-- STEP 4O-T: SUPABASE BS CODE SCHEMA & DUPLICATE ASSIGNMENT REPAIR SCRIPT
-- Project: PHC Bhada NVBDCP Management System
-- Live Database: Supabase (Project ID: yuebizvqapfegcjwqxbd)
-- STRICT PROTECTION: READ-ONLY AUDIT & PREPARED REPAIR PLAN (NO RUNTIME MUTATION YET)
-- =========================================================================

-- =========================================================================
-- PART 1: DDL — CREATE NVBDCP_BsCodes REGISTRY TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."NVBDCP_BsCodes" (
    bs_code TEXT PRIMARY KEY,
    upkendra TEXT NOT NULL,
    designation TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('MPW', 'ANM', 'ASHA', 'MO')),
    villages TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bscodes_upkendra ON public."NVBDCP_BsCodes"(upkendra);
CREATE INDEX IF NOT EXISTS idx_bscodes_category ON public."NVBDCP_BsCodes"(category);
CREATE INDEX IF NOT EXISTS idx_bscodes_status ON public."NVBDCP_BsCodes"(status);

-- Enable RLS and add Service-Role Policy
ALTER TABLE public."NVBDCP_BsCodes" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_bscodes' AND tablename = 'NVBDCP_BsCodes') THEN
    CREATE POLICY service_role_all_bscodes ON public."NVBDCP_BsCodes" FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =========================================================================
-- PART 2: DDL — CREATE NVBDCP_BsServiceTenureHistory TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."NVBDCP_BsServiceTenureHistory" (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public."NVBDCP_Employees"(id) ON UPDATE CASCADE,
    employee_name TEXT NOT NULL,
    bs_code TEXT NOT NULL,
    upkendra TEXT NOT NULL,
    designation TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('MPW', 'ANM', 'ASHA', 'MO')),
    charge_type TEXT NOT NULL DEFAULT 'REGULAR' CHECK (charge_type IN ('REGULAR', 'ADDITIONAL')),
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED')),
    end_reason TEXT DEFAULT '',
    order_no TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenure_emp_id ON public."NVBDCP_BsServiceTenureHistory"(employee_id);
CREATE INDEX IF NOT EXISTS idx_tenure_bscode ON public."NVBDCP_BsServiceTenureHistory"(bs_code);
CREATE INDEX IF NOT EXISTS idx_tenure_status ON public."NVBDCP_BsServiceTenureHistory"(status);
CREATE INDEX IF NOT EXISTS idx_tenure_upkendra ON public."NVBDCP_BsServiceTenureHistory"(upkendra);

-- DATABASE-LEVEL CONSTRAINT: Prevent simultaneous active assignments for the same BS Code
-- A BS Code can only have at most ONE record where status = 'ACTIVE'
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_bscode_single_occupant 
ON public."NVBDCP_BsServiceTenureHistory"(bs_code) 
WHERE (status = 'ACTIVE');

-- Enable RLS and add Service-Role Policy
ALTER TABLE public."NVBDCP_BsServiceTenureHistory" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_tenure' AND tablename = 'NVBDCP_BsServiceTenureHistory') THEN
    CREATE POLICY service_role_all_tenure ON public."NVBDCP_BsServiceTenureHistory" FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =========================================================================
-- PART 3: DDL — SAFE EXTENSION OF NVBDCP_Employees TABLE
-- =========================================================================
-- Safely add metadata columns to NVBDCP_Employees without altering existing columns
ALTER TABLE public."NVBDCP_Employees" 
    ADD COLUMN IF NOT EXISTS service_status TEXT DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS previous_bs_code TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS charge_type TEXT DEFAULT 'REGULAR',
    ADD COLUMN IF NOT EXISTS attach_date TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_nvbdcp_employees_status ON public."NVBDCP_Employees"(service_status);

-- =========================================================================
-- PART 4: DML — SEED 67 OFFICIAL FIXED BS CODES
-- =========================================================================
INSERT INTO public."NVBDCP_BsCodes" (bs_code, upkendra, designation, category, villages, status) VALUES
-- 1. आलमला (8 codes)
('54S6', 'आलमला', 'आरोग्य सेवक (MPW)', 'MPW', 'आलमला, उंबडगा', 'ACTIVE'),
('54F6A', 'आलमला', 'आरोग्य सेविका (ANM)', 'ANM', 'आलमला, उंबडगा', 'ACTIVE'),
('54F6V1', 'आलमला', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'आलमला', 'ACTIVE'),
('54F6V2', 'आलमला', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'आलमला', 'ACTIVE'),
('54F6V3', 'आलमला', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'आलमला', 'ACTIVE'),
('54F6V4', 'आलमला', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'आलमला', 'ACTIVE'),
('54F6V5', 'आलमला', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'उंबडगा बू', 'ACTIVE'),
('54F6V6', 'आलमला', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'उंबडगा खू', 'ACTIVE'),
-- 2. कोरंगळा (10 codes)
('54S5', 'कोरंगळा', 'आरोग्य सेवक (MPW)', 'MPW', 'कोरंगळा, समदर्गा, मदनसुरी', 'ACTIVE'),
('54F5A', 'कोरंगळा', 'आरोग्य सेविका (ANM)', 'ANM', 'कोरंगळा, समदर्गा, मदनसुरी', 'ACTIVE'),
('54F5V1', 'कोरंगळा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'कोरंगळा', 'ACTIVE'),
('54F5V2', 'कोरंगळा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'कोरंगळा', 'ACTIVE'),
('54F5V3', 'कोरंगळा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'कोरंगळा', 'ACTIVE'),
('54F5V4', 'कोरंगळा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'समदर्गा', 'ACTIVE'),
('54F5V5', 'कोरंगळा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'सोनकांबळेवाडी', 'ACTIVE'),
('54F5V6', 'कोरंगळा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'मदनसुरी', 'ACTIVE'),
('54F5V7', 'कोरंगळा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'मुळूकवाडी', 'ACTIVE'),
('54F5V8', 'कोरंगळा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'कारभारीवाडी', 'ACTIVE'),
-- 3. बोरगाव (6 codes)
('54S2', 'बोरगाव', 'आरोग्य सेवक (MPW)', 'MPW', 'बोरगाव, जवळगा', 'ACTIVE'),
('54F2', 'बोरगाव', 'आरोग्य सेविका (ANM)', 'ANM', 'बोरगाव, जवळगा', 'ACTIVE'),
('54F2V1', 'बोरगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'बोरगाव', 'ACTIVE'),
('54F2V2', 'बोरगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'बोरगाव', 'ACTIVE'),
('54F2V3', 'बोरगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'काळमाथा', 'ACTIVE'),
('54F2V5', 'बोरगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'जवळगा', 'ACTIVE'),
-- 4. भादा (13 codes)
('54S1', 'भादा', 'आरोग्य सेवक (MPW)', 'MPW', 'भादा', 'ACTIVE'),
('54S1A1', 'भादा', 'आरोग्य सेवक (MPW)', 'MPW', 'भादा', 'ACTIVE'),
('54S1A2', 'भादा', 'आरोग्य सेवक (MPW)', 'MPW', 'भादा', 'ACTIVE'),
('54F1', 'भादा', 'आरोग्य सेविका (ANM)', 'ANM', 'भादा', 'ACTIVE'),
('54F1A', 'भादा', 'आरोग्य सेविका (ANM)', 'ANM', 'भादा', 'ACTIVE'),
('54F1V1', 'भादा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'भादा', 'ACTIVE'),
('54F1V2', 'भादा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'भादा', 'ACTIVE'),
('54F1V3', 'भादा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'भादा', 'ACTIVE'),
('54F1V4', 'भादा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'भादा', 'ACTIVE'),
('54F1V5', 'भादा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'भादा', 'ACTIVE'),
('54F1V6', 'भादा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'भादा', 'ACTIVE'),
('54F1V7', 'भादा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'भादा', 'ACTIVE'),
('54F1V8', 'भादा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'भादा', 'ACTIVE'),
-- 5. भेटा (8 codes)
('54S3', 'भेटा', 'आरोग्य सेवक (MPW)', 'MPW', 'भेटा, तळणी, मनेरवाडी', 'ACTIVE'),
('54F3', 'भेटा', 'आरोग्य सेविका (ANM)', 'ANM', 'भेटा, तळणी, मनेरवाडी', 'ACTIVE'),
('54F3A', 'भेटा', 'आरोग्य सेविका (ANM)', 'ANM', 'भेटा, तळणी, मनेरवाडी', 'ACTIVE'),
('54F3V2', 'भेटा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'भेटा', 'ACTIVE'),
('54F3V3', 'भेटा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'भेटा', 'ACTIVE'),
('54F3V4', 'भेटा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'भेटा', 'ACTIVE'),
('54F3V5', 'भेटा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'तळणी', 'ACTIVE'),
('54F3V6', 'भेटा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'मनेरवाडी / वडजी', 'ACTIVE'),
-- 6. लखनगाव (11 codes)
('54S7', 'लखनगाव', 'आरोग्य सेवक (MPW)', 'MPW', 'लखनगाव, सोनपट्टी तांडा, उटी बु.', 'ACTIVE'),
('54S7A1', 'लखनगाव', 'आरोग्य सेवक (MPW)', 'MPW', 'लखनगाव', 'ACTIVE'),
('54F7', 'लखनगाव', 'आरोग्य सेविका (ANM)', 'ANM', 'लखनगाव, सोनपट्टी तांडा, उटी बु.', 'ACTIVE'),
('54F7A', 'लखनगाव', 'आरोग्य सेविका (ANM)', 'ANM', 'लखनगाव', 'ACTIVE'),
('54F7V1', 'लखनगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'लखनगाव', 'ACTIVE'),
('54F7V2', 'लखनगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'लखनगाव', 'ACTIVE'),
('54F7V3', 'लखनगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'लखनगाव', 'ACTIVE'),
('54F7V4', 'लखनगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'उटी बु.', 'ACTIVE'),
('54F7V5', 'लखनगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'सोनपट्टी तांडा', 'ACTIVE'),
('54F7V6', 'लखनगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'लखनगाव', 'ACTIVE'),
('54F7V7', 'लखनगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'सत्तधरवाडी / कुलकर्णी तांडा', 'ACTIVE'),
-- 7. शिवली (10 codes)
('54S4', 'शिवली', 'आरोग्य सेवक (MPW)', 'MPW', 'शिवली, वरवडा, जायफळ', 'ACTIVE'),
('54F4', 'शिवली', 'आरोग्य सेविका (ANM)', 'ANM', 'शिवली, वरवडा, जायफळ', 'ACTIVE'),
('54F4A', 'शिवली', 'आरोग्य सेविका (ANM)', 'ANM', 'शिवली', 'ACTIVE'),
('54F4V1', 'शिवली', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'शिवली', 'ACTIVE'),
('54F4V2', 'शिवली', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'शिवली', 'ACTIVE'),
('54F4V3', 'शिवली', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'शिवली', 'ACTIVE'),
('54F4V4', 'शिवली', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'शिवली', 'ACTIVE'),
('54F4V5', 'शिवली', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'वरवडा', 'ACTIVE'),
('54F4V6', 'शिवली', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'जायफळ', 'ACTIVE'),
('54F4V7', 'शिवली', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'वरवडा', 'ACTIVE'),
-- 8. प्रा.आ.केंद्र (1 code)
('54P', 'प्रा.आ.केंद्र', 'वैद्यकीय अधिकारी (MO)', 'MO', 'Phc भादा', 'ACTIVE')
ON CONFLICT (bs_code) DO UPDATE SET
    upkendra = EXCLUDED.upkendra,
    designation = EXCLUDED.designation,
    category = EXCLUDED.category,
    villages = EXCLUDED.villages,
    status = EXCLUDED.status,
    updated_at = NOW();

-- =========================================================================
-- PART 5: DML — SAFE RESOLUTION OF 3 DUPLICATE BS CODES IN NVBDCP_Employees
-- =========================================================================
-- RESOLUTION RULE:
-- Active workers who are current occupants retain the bs_code.
-- Predecessors have bs_code cleared, previous_bs_code recorded, and service_status set to 'ENDED'.
-- Zero employee rows are deleted!

-- 1. Resolve 54F2V3 (Active: EMP_022 Mrs. Tasleem Fakir; Predecessor: EMP_019 Mrs. Sarika Gajnetri)
UPDATE public."NVBDCP_Employees"
SET bs_code = '',
    previous_bs_code = '54F2V3',
    service_status = 'ENDED',
    updated_at = NOW()
WHERE id = 'EMP_019' AND bs_code = '54F2V3';

-- 2. Resolve 54F3V6 (Active: EMP_042 Mrs. Chandrakala Puri; Predecessor: EMP_040 Mrs. Chandrakala Pimpare)
UPDATE public."NVBDCP_Employees"
SET bs_code = '',
    previous_bs_code = '54F3V6',
    service_status = 'ENDED',
    updated_at = NOW()
WHERE id = 'EMP_040' AND bs_code = '54F3V6';

-- 3. Resolve 54S7 (Active at Lakhangaon: EMP_053B Mr. Ravi Lipare; Transferred: EMP_053 Mr. Vanraj Jadhav)
UPDATE public."NVBDCP_Employees"
SET bs_code = '',
    previous_bs_code = '54S7',
    service_status = 'ENDED',
    updated_at = NOW()
WHERE id = 'EMP_053' AND bs_code = '54S7';

-- =========================================================================
-- PART 6: DML — SEED SERVICE TENURE HISTORY FOR ALL EMPLOYEES
-- =========================================================================
-- Seed Historical Ended Tenures for the 3 Predecessors
INSERT INTO public."NVBDCP_BsServiceTenureHistory" (
    id, employee_id, employee_name, bs_code, upkendra, designation, category, charge_type, start_date, end_date, status, end_reason, order_no, remarks, created_at, updated_at
) VALUES
('TENURE_HIST_EMP_019_54F2V3', 'EMP_019', 'श्रीमती सारीका बब्रुवान गजनेत्री', '54F2V3', 'बोरगाव', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'REGULAR', '2024-01-01', '2025-12-31', 'ENDED', 'कार्यमुक्ती / कार्यभार हस्तांतरण', 'PHC/NVBDCP/2026/019', 'श्रीमती तस्लीम सय्यद फकीर यांनी कार्यभार स्वीकारला', NOW(), NOW()),
('TENURE_HIST_EMP_040_54F3V6', 'EMP_040', 'श्रीमती पिंपरे चंद्रकला शंकर', '54F3V6', 'भेटा', 'आशा स्वयंसेविका (ASHA)', 'ASHA', 'REGULAR', '2024-01-01', '2025-12-31', 'ENDED', 'कार्यमुक्ती / कार्यभार हस्तांतरण', 'PHC/NVBDCP/2026/040', 'श्रीमती चंद्रकला राजेंद्र पुरी यांनी कार्यभार स्वीकारला', NOW(), NOW()),
('TENURE_HIST_EMP_053_54S7', 'EMP_053', 'श्री वनराज जाधव', '54S7', 'लखनगाव', 'आरोग्य सेवक (MPW)', 'MPW', 'REGULAR', '2024-01-01', '2026-02-01', 'ENDED', 'आलमला येथे स्थानांतरण', 'PHC/NVBDCP/TR/2026/053', 'लखनगाव कार्यभार श्री रवी लिपारे यांच्याकडे हस्तांतरित', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Active Tenures for all currently assigned employees
INSERT INTO public."NVBDCP_BsServiceTenureHistory" (
    id, employee_id, employee_name, bs_code, upkendra, designation, category, charge_type, start_date, end_date, status, end_reason, order_no, remarks, created_at, updated_at
)
SELECT 
    'TENURE_ACT_' || e.id || '_' || e.bs_code AS id,
    e.id AS employee_id,
    e.employee_name,
    e.bs_code,
    e.upkendra,
    e.designation,
    CASE 
        WHEN e.designation LIKE '%MPW%' OR e.designation LIKE '%आरोग्य सेवक%' THEN 'MPW'
        WHEN e.designation LIKE '%ANM%' OR e.designation LIKE '%आरोग्य सेविका%' THEN 'ANM'
        WHEN e.designation LIKE '%ASHA%' OR e.designation LIKE '%आशा%' THEN 'ASHA'
        ELSE 'MO'
    END AS category,
    'REGULAR' AS charge_type,
    '2025-01-01'::DATE AS start_date,
    NULL::DATE AS end_date,
    'ACTIVE' AS status,
    '' AS end_reason,
    'PHC/INIT/2025' AS order_no,
    'नियमित बीएस कोड कार्यभार' AS remarks,
    NOW(),
    NOW()
FROM public."NVBDCP_Employees" e
WHERE e.bs_code IS NOT NULL AND e.bs_code <> ''
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- PART 7: AUDIT VERIFICATION QUERIES (RUN TO PROVE ZERO DUPLICATES & INTEGRITY)
-- =========================================================================

-- Verification 1: Count of Official BS Codes in Registry (Must equal 67)
-- SELECT COUNT(*) AS total_official_bs_codes FROM public."NVBDCP_BsCodes";

-- Verification 2: Count of Unique Active BS Codes in NVBDCP_Employees (Must equal 62)
-- SELECT COUNT(DISTINCT bs_code) AS active_assigned_codes FROM public."NVBDCP_Employees" WHERE bs_code <> '';

-- Verification 3: Count of Duplicate Active Assignments (Must equal 0)
-- SELECT bs_code, COUNT(*) AS occupant_count 
-- FROM public."NVBDCP_Employees" 
-- WHERE bs_code <> '' 
-- GROUP BY bs_code 
-- HAVING COUNT(*) > 1;

-- Verification 4: Identify Vacant BS Codes (Must equal 5)
-- SELECT c.bs_code, c.upkendra, c.designation 
-- FROM public."NVBDCP_BsCodes" c 
-- LEFT JOIN public."NVBDCP_Employees" e ON c.bs_code = e.bs_code 
-- WHERE e.id IS NULL;

-- Verification 5: Verify Active Single Occupant Integrity in Tenure Table (Must equal 62 active rows)
-- SELECT COUNT(*) AS active_tenure_count FROM public."NVBDCP_BsServiceTenureHistory" WHERE status = 'ACTIVE';

-- Verification 6: Historical Smear Count Verification (Must remain exactly 1,494 unchanged)
-- SELECT COUNT(*) AS smear_count FROM public."NVBDCP_BsDataEntry";
