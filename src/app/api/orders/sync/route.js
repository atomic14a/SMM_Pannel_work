import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkMultipleOrderStatuses } from '@/lib/smm-api';

export async function POST() {
    const supabase = createServerClient();

    try {
        // 1. Get all orders that are NOT in a final state
        // We include many possible final state variations just in case
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
                id, external_order_id, provider_id, status,
                api_providers!inner(id, api_url, api_key)
            `)
            .not('status', 'in', '("Completed", "Canceled", "Cancelled", "Refunded", "Rejected")')
            .not('external_order_id', 'is', null);

        if (ordersError) throw ordersError;

        if (!orders || orders.length === 0) {
            return NextResponse.json({ success: true, message: 'No orders need syncing.', updatedCount: 0 });
        }

        // 2. Group by provider
        const groups = {};
        orders.forEach(order => {
            const pId = order.api_providers.id;
            if (!groups[pId]) {
                groups[pId] = {
                    provider: order.api_providers,
                    externalIds: [],
                    map: {} // extId -> localUuid
                };
            }
            const extIdStr = String(order.external_order_id);
            groups[pId].externalIds.push(extIdStr);
            groups[pId].map[extIdStr] = order.id;
        });

        let totalUpdated = 0;
        const processResults = [];

        // 3. Process each provider
        for (const pId in groups) {
            const group = groups[pId];

            // Call SMM API (standard panels handle comma-separated IDs)
            const result = await checkMultipleOrderStatuses(
                group.provider.api_url,
                group.provider.api_key,
                group.externalIds
            );

            if (!result.success) {
                processResults.push({ providerId: pId, error: result.error });
                continue;
            }

            // result.data is usually { "123": { "status": "Pending", ... }, "124": { ... } }
            const apiData = result.data;

            for (const [extId, info] of Object.entries(apiData)) {
                if (!info || info.error) continue;

                const localId = group.map[extId];
                if (!localId) continue;

                // Normalize Status for local DB
                // We keep the provider's casing but ensure it's not empty
                const newStatus = info.status ? info.status : 'Pending';

                const updatePayload = {
                    status: newStatus,
                    updated_at: new Date().toISOString()
                };

                // Update start_count and remains if provided
                if (info.start_count !== undefined && info.start_count !== null) {
                    updatePayload.start_count = parseInt(info.start_count);
                }
                if (info.remains !== undefined && info.remains !== null) {
                    updatePayload.remains = parseInt(info.remains);
                }

                const { error: updateError } = await supabase
                    .from('orders')
                    .update(updatePayload)
                    .eq('id', localId);

                if (!updateError) {
                    totalUpdated++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            updatedCount: totalUpdated,
            details: processResults.length > 0 ? processResults : undefined
        });

    } catch (error) {
        console.error('Unified Sync Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
