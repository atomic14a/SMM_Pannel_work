import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { fetchServices } from '@/lib/smm-api';

export async function POST(request) {
    const supabase = createServerClient();

    try {
        // 1. Get all active providers
        const { data: providers, error: provError } = await supabase
            .from('api_providers')
            .select('id, api_url, api_key')
            .eq('is_active', true);

        if (provError) throw provError;
        if (!providers || providers.length === 0) {
            return NextResponse.json({ message: 'No active providers found', syncedCount: 0 });
        }

        // 1.5 Fetch ALL existing services from DB to preserve their is_active state
        const { data: existingServices, error: existErr } = await supabase
            .from('services')
            .select('provider_id, external_service_id, is_active');

        if (existErr) throw existErr;
        const activeMap = {};
        if (existingServices) {
            existingServices.forEach(s => {
                const key = `${s.provider_id}-${s.external_service_id}`;
                activeMap[key] = s.is_active;
            });
        }

        const PKR_RATE = parseFloat(process.env.PKR_EXCHANGE_RATE || '280');
        let allServicesToUpsert = [];
        const syncErrors = [];

        // 2. Fetch services from each provider
        for (const provider of providers) {
            try {
                const result = await fetchServices(provider.api_url, provider.api_key);

                if (!result.success) {
                    syncErrors.push(`Failed to sync provider ${provider.id}: ${result.error}`);
                    continue;
                }

                // 3. Map to our database schema
                const services = result.data.map(svc => {
                    const svcKey = `${provider.id}-${svc.service}`;
                    // If it already exists, use its current is_active state, otherwise false (hidden by default)
                    const currentlyActive = activeMap[svcKey] !== undefined ? activeMap[svcKey] : false;

                    return {
                        provider_id: provider.id,
                        external_service_id: String(svc.service),
                        name: svc.name,
                        category: svc.category || 'Uncategorized',
                        type: svc.type || 'Default',
                        rate: (parseFloat(svc.rate) * PKR_RATE).toFixed(4),
                        min_quantity: Math.min(parseInt(svc.min) || 0, 2147483647),
                        max_quantity: Math.min(parseInt(svc.max) || 0, 2147483647),
                        is_active: currentlyActive,
                        synced_at: new Date().toISOString()
                    };
                });

                allServicesToUpsert = [...allServicesToUpsert, ...services];
            } catch (err) {
                syncErrors.push(`Error parsing services from provider ${provider.id}`);
            }
        }

        if (allServicesToUpsert.length === 0) {
            return NextResponse.json({
                message: 'No services fetched',
                errors: syncErrors
            }, { status: 400 });
        }

        // 4. Batch upsert into database
        // We use external_service_id and provider_id as unique conflict keys 
        const { error: upsertError } = await supabase
            .from('services')
            .upsert(allServicesToUpsert, {
                onConflict: 'provider_id, external_service_id',
                ignoreDuplicates: false
            });

        if (upsertError) throw upsertError;

        return NextResponse.json({
            success: true,
            syncedCount: allServicesToUpsert.length,
            errors: syncErrors.length > 0 ? syncErrors : undefined
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
