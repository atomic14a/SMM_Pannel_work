import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { fetchBalance } from '@/lib/smm-api';

export async function POST() {
    const supabase = createServerClient();

    try {
        const { data: providers, error: fetchError } = await supabase
            .from('api_providers')
            .select('id, name, api_url, api_key')
            .eq('is_active', true);

        if (fetchError) throw fetchError;
        if (!providers || providers.length === 0) {
            return NextResponse.json({ message: 'No active providers found' });
        }

        const unhandledErrors = [];
        const balances = {};

        for (const provider of providers) {
            try {
                const result = await fetchBalance(provider.api_url, provider.api_key);

                if (result.success && result.data) {
                    const balance = parseFloat(result.data.balance) || 0;
                    const currency = result.data.currency || 'USD';
                    balances[provider.name] = { balance, currency };

                    await supabase
                        .from('api_providers')
                        .update({ balance, currency, last_synced_at: new Date().toISOString() })
                        .eq('id', provider.id);
                } else {
                    unhandledErrors.push(`Failed for ${provider.name}: ${result.error}`);
                }
            } catch (err) {
                unhandledErrors.push(`Error checking ${provider.name}`);
            }
        }

        return NextResponse.json({
            success: true,
            balances,
            errors: unhandledErrors.length > 0 ? unhandledErrors : undefined
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
