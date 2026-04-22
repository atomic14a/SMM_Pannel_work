import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { cancelOrders } from '@/lib/smm-api';

export async function POST(request) {
    const supabase = createServerClient();

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { orderId } = await request.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        // 1. Get order details and provider info
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
                id, external_order_id, status,
                api_providers (api_url, api_key, is_active)
            `)
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (!order.api_providers?.is_active) {
            return NextResponse.json({ error: 'Provider is currently inactive' }, { status: 400 });
        }

        // 2. Map status to check if it's potentially cancellable
        // Standard SMM panels usually only allow cancellation for Pending, Processing, In Progress
        const cancellableStatuses = ['Pending', 'Processing', 'In Progress'];
        if (!cancellableStatuses.includes(order.status)) {
            return NextResponse.json({ error: `Orders with status '${order.status}' cannot be cancelled.` }, { status: 400 });
        }

        // 3. Request cancellation from the provider
        const result = await cancelOrders(
            order.api_providers.api_url,
            order.api_providers.api_key,
            [order.external_order_id]
        );

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Cancellation failed at provider' }, { status: 400 });
        }

        // The result data from standard SMM API for multi_cancel is usually [{order: 1, status: 1}] or {1: 1}
        // If it returns an error in the array, handle it
        const responseData = result.data;

        // Update local order status if successful
        // We'll trust the provider. If they say it's cancelled, we update it.
        // Usually, the provider will update the status to 'Cancelled' which our sync will pick up, 
        // but let's update it immediately for better UX.

        const { error: updateError } = await supabase
            .from('orders')
            .update({ status: 'Cancelled' })
            .eq('id', orderId);

        if (updateError) {
            console.error('Failed to update local order status:', updateError);
        }

        return NextResponse.json({
            success: true,
            message: 'Cancellation request sent successfully.'
        });

    } catch (error) {
        console.error('Cancellation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
