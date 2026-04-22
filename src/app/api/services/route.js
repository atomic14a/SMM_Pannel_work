import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET() {
    const supabase = createServerClient();
    try {
        const { data, error } = await supabase
            .from('services')
            .select(`
                id, external_service_id, name, category, rate, custom_rate, min_quantity, max_quantity, is_active,
                api_providers(id, name)
            `)
            .order('category', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request) {
    const supabase = createServerClient();
    try {
        const body = await request.json();
        const { id, is_active, custom_rate } = body;

        if (!id) throw new Error('Service ID is required');

        const updateData = {};
        if (is_active !== undefined) updateData.is_active = is_active;
        if (custom_rate !== undefined) updateData.custom_rate = custom_rate === '' ? null : custom_rate;

        const { data, error } = await supabase
            .from('services')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
