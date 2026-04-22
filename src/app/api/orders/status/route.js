import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkMultipleOrderStatuses } from '@/lib/smm-api';

export async function POST() {
    const supabase = createServerClient();

    try {
        // 1. Get all incomplete orders with their provider details
        const { data: incompleteOrders, error: fetchError } = await supabase
            .from('orders')
            .select('id, external_order_id, provider_id, api_providers!inner(api_url, api_key)')
            .not('status', 'in', '("Completed", "Canceled", "Cancelled")');

        if (fetchError) throw fetchError;
        if (!incompleteOrders || incompleteOrders.length === 0) {
            return NextResponse.json({ message: 'No pending orders to update', updatedCount: 0 });
        }

        // Group by provider to minimize API calls
        const payloadByProvider = {};
        incompleteOrders.forEach(order => {
            const pId = order.provider_id;
            if (!payloadByProvider[pId]) {
                payloadByProvider[pId] = {
                    apiUrl: order.api_providers.api_url,
                    apiKey: order.api_providers.api_key,
                    orderMap: {} // external_order_id -> our internal uuid
                };
            }
            if (order.external_order_id) {
                payloadByProvider[pId].orderMap[String(order.external_order_id)] = order.id;
            }
        });

        let updatedCount = 0;
        const errors = [];

        // 2. Poll providers for status updates
        for (const pId in payloadByProvider) {
            const provider = payloadByProvider[pId];
            const externalIds = Object.keys(provider.orderMap);

            if (externalIds.length === 0) continue;

            try {
                const result = await checkMultipleOrderStatuses(
                    provider.apiUrl,
                    provider.apiKey,
                    externalIds
                );

                if (!result.success) {
                    errors.push(`Failed to fetch statuses from provider ${pId}: ${result.error}`);
                    continue;
                }

                // result.data should be an object mapping ID -> status details
                for (const [extId, info] of Object.entries(result.data)) {
                    if (!info || info.error) continue;

                    const internalId = provider.orderMap[extId];
                    if (!internalId) continue;

                    const updatePayload = {
                        status: info.status || 'Pending',
                        updated_at: new Date().toISOString()
                    };

                    if (info.start_count !== undefined) updatePayload.start_count = parseInt(info.start_count);
                    if (info.remains !== undefined) updatePayload.remains = parseInt(info.remains);

                    const { error: updateError } = await supabase
                        .from('orders')
                        .update(updatePayload)
                        .eq('id', internalId);

                    if (updateError) {
                        console.error(`Failed to update order ${internalId}:`, updateError);
                    } else {
                        updatedCount++;
                    }
                }

            } catch (err) {
                errors.push(`Error processing provider ${pId}: ${err.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            updatedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
