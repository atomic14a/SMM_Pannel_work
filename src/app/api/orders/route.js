import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { placeOrder } from '@/lib/smm-api';

export async function GET(request) {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    try {
        let query = supabase
            .from('orders')
            .select(`
        id, provider_id, external_order_id, link, quantity, 
        cost, status, start_count, remains, created_at,
        services(name, category),
        api_providers(name)
      `)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data: orders, error } = await query;
        if (error) throw error;

        return NextResponse.json(orders);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const supabase = createServerClient();

    try {
        const { serviceId, link, quantity } = await request.json();

        // 1. Get the service and provider details
        const { data: service, error: svcError } = await supabase
            .from('services')
            .select(`
        external_service_id, provider_id, rate, custom_rate,
        api_providers (api_url, api_key, is_active)
      `)
            .eq('id', serviceId)
            .single();

        if (svcError) throw svcError;
        if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        if (!service.api_providers?.is_active) {
            return NextResponse.json({ error: 'Provider is currently inactive' }, { status: 400 });
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
            if (errLower.includes('fund') || errLower.includes('balance') || errLower.includes('money')) {
                return NextResponse.json({ error: 'Balance Low! Please load the Account.' }, { status: 400 });
            }
            return NextResponse.json({ error: orderResult.error }, { status: 400 });
        }

        // Extract order ID string (some panels return integer, some string)
        const externalOrderId = String(orderResult.data.order || orderResult.data.order_id || '');

        // Calculate final cost for DB
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

        if (insertError) throw insertError;

        return NextResponse.json({ success: true, order: newOrder });

    } catch (error) {
        console.error('Order placement error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
