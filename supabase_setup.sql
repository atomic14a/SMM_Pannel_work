-- ==========================================
-- SMM PANEL DATABASE INITIALIZATION SCRIPT
-- ==========================================
-- INSTRUCTIONS:
-- 1. Go to https://supabase.com and open your project
-- 2. Click "SQL Editor" on the left menu
-- 3. Click "New query"
-- 4. Paste this entire file into the editor and hit "Run"

-- ==========================================
-- 1. Create Tables
-- ==========================================

-- Providers table (your external SMM Panels)
CREATE TABLE public.api_providers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    api_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    balance DECIMAL(10,2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services table (synced from external panels)
CREATE TABLE public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_id UUID REFERENCES public.api_providers(id) ON DELETE CASCADE,
    external_service_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    type TEXT,
    rate NUMERIC(10, 4) NOT NULL, -- The cost per 1000 units from the provider (in PKR after sync mapping)
    custom_rate NUMERIC(10, 4), -- Optional custom price override for your users
    min_quantity INTEGER NOT NULL,
    max_quantity INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider_id, external_service_id)
);

-- Orders table (placed by your team)
CREATE TABLE public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID REFERENCES public.services(id),
    provider_id UUID REFERENCES public.api_providers(id),
    external_order_id TEXT,
    link TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    cost DECIMAL(10,4),
    status TEXT DEFAULT 'Pending',
    start_count INTEGER,
    remains INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 2. Setup Row Level Security (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to have full access
-- Since this is an internal tool with one shared login, 
-- anyone logged in has full access.

-- API Providers policies
CREATE POLICY "Authenticated users can select providers" 
ON public.api_providers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert providers" 
ON public.api_providers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update providers" 
ON public.api_providers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete providers" 
ON public.api_providers FOR DELETE TO authenticated USING (true);

-- Services policies
CREATE POLICY "Authenticated users can select services" 
ON public.services FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service Role can insert/update services" 
ON public.services FOR ALL TO service_role USING (true);

-- Orders policies
CREATE POLICY "Authenticated users can select orders" 
ON public.orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert orders" 
ON public.orders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update orders" 
ON public.orders FOR UPDATE TO authenticated USING (true);


-- ==========================================
-- 3. Create Update Trigger
-- ==========================================

CREATE OR REPLACE FUNCTION update_modified_column()   
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$$ language 'plpgsql';

CREATE TRIGGER update_order_modtime 
BEFORE UPDATE ON public.orders 
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ==========================================
-- SETUP COMPLETE
-- Now go to Authentication -> Users and create one admin account!
-- ==========================================
