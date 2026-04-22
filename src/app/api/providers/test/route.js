import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { fetchBalance } from '@/lib/smm-api';

export async function POST(request) {
    const supabase = createServerClient();

    try {
        const payload = await request.json();
        let { id, apiUrl, apiKey } = payload;

        // If apiKey isn't provided by the client (which is normal for saved providers)
        // fetch it securely from the database.
        if (!apiKey && id) {
            const { data: provider, error } = await supabase
                .from('api_providers')
                .select('api_key, api_url')
                .eq('id', id)
                .single();

            if (error) throw new Error('Failed to retrieve provider credentials');
            apiKey = provider.api_key;
            if (!apiUrl) apiUrl = provider.api_url;
        }

        if (!apiKey || !apiUrl) {
            throw new Error('API Key and URL are required to test connection');
        }

        // Test the connection by fetching balance
        const result = await fetchBalance(apiUrl, apiKey);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        // If we have an ID, update the balance in DB
        if (id) {
            const balance = parseFloat(result.data.balance) || 0;
            const currency = result.data.currency || 'USD';

            await supabase
                .from('api_providers')
                .update({
                    balance,
                    currency,
                    last_synced_at: new Date().toISOString()
                })
                .eq('id', id);
        }

        return NextResponse.json({
            success: true,
            balance: result.data.balance,
            currency: result.data.currency
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
