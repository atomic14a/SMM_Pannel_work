import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(request) {
    const supabase = createServerClient();
    try {
        const { updates } = await request.json();

        if (!Array.isArray(updates) || updates.length === 0) {
            throw new Error('No updates provided');
        }

        const results = await Promise.all(updates.map(u => {
            const { id, ...data } = u;
            return supabase.from('services').update(data).eq('id', id);
        }));

        const errors = results.filter(r => r.error);
        if (errors.length > 0) throw new Error(errors[0].error.message);

        return NextResponse.json({ success: true, updatedCount: updates.length });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
