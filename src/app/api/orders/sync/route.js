import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkMultipleOrderStatuses } from '@/lib/smm-api';

export async function POST() {
    const supabase = createServerClient();

    try {
        // 1. Get all active orders that are not in final state
        // Typical final states: Completed, Canceled, Partial (sometimes Partial can be final)
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
                id, external_order_id, provider_id,
                api_providers (api_url, api_key)
            `)
            .not('status', 'in', '("Completed", "Canceled", "Refunded")')
            .not('external_order_id', 'is', null);

        if (ordersError) throw ordersError;
        if (!orders || orders.length === 0) {
            return NextResponse.json({ message: 'No active orders to sync', syncedCount: 0 });
        }

        // 2. Group orders by provider
        const ordersByProvider = orders.reduce((acc, order) => {
            const pid = order.provider_id;
            if (!acc[pid]) {
                acc[pid] = {
                    provider: order.api_providers,
                    orderIds: [],
                    orderMap: {}
                };
            }
            if (order.external_order_id) {
                acc[pid].orderIds.push(order.external_order_id);
                acc[pid].orderMap[order.external_order_id] = order.id;
            }
            return acc;
        }, {});

        let totalSynced = 0;

        // 3. Sync each provider
        for (const pid in ordersByProvider) {
            const { provider, orderIds, orderMap } = ordersByProvider[pid];

            // SMM Panels usually allow checking up to 100 orders at once
            // For simplicity, we check all if small, or we could chunk them
            const response = await checkMultipleOrderStatuses(provider.api_url, provider.api_key, orderIds);

            if (response.success && response.data) {
                // response.data is an object with externalOrderId as key
                for (const externalId in response.data) {
                    const statusData = response.data[externalId];
                    const localOrderId = orderMap[externalId];

                    if (localOrderId && statusData.status) {
                        // Update local order
                        const { error: updateError } = await supabase
                            .from('orders')
                            .update({
                                status: statusData.status,
                                start_count: (statusData.start_count !== undefined && statusData.start_count !== null) ? parseInt(statusData.start_count) : null,
                                remains: (statusData.remains !== undefined && statusData.remains !== null) ? parseInt(statusData.remains) : null,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', localOrderId);

                        if (!updateError) totalSynced++;
                    }
                }
            }
        }

        return NextResponse.json({ success: true, syncedCount: totalSynced });

    } catch (error) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
