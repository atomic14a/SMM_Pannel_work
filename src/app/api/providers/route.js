import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET() {
    const supabase = createServerClient();

    try {
        const { data: providers, error } = await supabase
            .from('api_providers')
            .select('id, name, api_url, is_active, balance, currency, last_synced_at, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json(providers);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const supabase = createServerClient();

    try {
        const body = await request.json();

        const { data, error } = await supabase
            .from('api_providers')
            .insert([body])
            .select('id, name, api_url, is_active')
            .single();

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
        const { id, ...updates } = body;

        if (!id) throw new Error('Provider ID is required');

        const { data, error } = await supabase
            .from('api_providers')
            .update(updates)
            .eq('id', id)
            .select('id, name, api_url, is_active')
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    const supabase = createServerClient();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    try {
        const { error } = await supabase
            .from('api_providers')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
