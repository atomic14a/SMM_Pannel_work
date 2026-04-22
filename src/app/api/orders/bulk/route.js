import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { placeOrder } from '@/lib/smm-api';

export async function POST(request) {
    const supabase = createServerClient();

    try {
        const { link, items } = await request.json();

        if (!link || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
        }

        const results = [];
        let totalSuccess = 0;

        for (const item of items) {
            const { serviceId, quantity } = item;

            try {
                // 1. Get the service and provider details
                const { data: service, error: svcError } = await supabase
                    .from('services')
                    .select(`
                        id, external_service_id, provider_id, rate, custom_rate,
                        api_providers (api_url, api_key, is_active)
                    `)
                    .eq('id', serviceId)
                    .single();

                if (svcError || !service) {
                    results.push({ serviceId, success: false, error: 'Service not found' });
                    continue;
                }

                if (!service.api_providers?.is_active) {
                    results.push({ serviceId, success: false, error: 'Provider is currently inactive' });
                    continue;
                }

                // 2. Submit order to external provider
                const orderResult = await placeOrder(
                    service.api_providers.api_url,
                    service.api_providers.api_key,
                    {
                        service: service.external_service_id,
                        link,
                        quantity,
                    }
                );

                if (!orderResult.success) {
                    const errLower = orderResult.error.toLowerCase();
                    let errorMessage = orderResult.error;
                    if (errLower.includes('fund') || errLower.includes('balance') || errLower.includes('money')) {
                        errorMessage = 'Balance Low! Please load the Account.';
                    }
                    results.push({ serviceId, success: false, error: errorMessage });
                    continue;
                }

                // Extract order ID string
                const externalOrderId = String(orderResult.data.order || orderResult.data.order_id || '');

                // Calculate final cost
                const activeRate = service.custom_rate || service.rate;
                const cost = (parseFloat(activeRate) * parseInt(quantity) / 1000).toFixed(4);

                // 3. Save order to our database
                const { data: newOrder, error: insertError } = await supabase
                    .from('orders')
                    .insert([{
                        service_id: serviceId,
                        provider_id: service.provider_id,
                        external_order_id: externalOrderId,
                        link,
                        quantity,
                        cost,
                        status: 'Pending'
                    }])
                    .select()
                    .single();

                if (insertError) {
                    results.push({ serviceId, success: false, error: 'Failed to save to database' });
                } else {
                    results.push({ serviceId, success: true, orderId: newOrder.id });
                    totalSuccess++;
                }

            } catch (err) {
                console.error(`Error placing bulk item ${serviceId}:`, err);
                results.push({ serviceId, success: false, error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            totalSuccess,
            totalItems: items.length,
            results
        });

    } catch (error) {
        console.error('Bulk order error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
