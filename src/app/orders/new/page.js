'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function NewOrderPage() {
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);

    // Form State
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [link, setLink] = useState('');
    const [quantity, setQuantity] = useState('');

    // UI State
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        fetchActiveServices();
    }, []);

    const fetchActiveServices = async () => {
        try {
            const { data, error } = await supabase
                .from('services')
                .select(`
          id, name, category, rate, custom_rate, min_quantity, max_quantity, external_service_id,
          api_providers!inner(name, is_active)
        `)
                .eq('is_active', true)
                .eq('api_providers.is_active', true)
                .order('name');

            if (error) throw error;

            setServices(data || []);
            const uniqueCats = [...new Set(data.map(s => s.category))].sort();
            setCategories(uniqueCats);
            if (uniqueCats.length > 0) setSelectedCategory(uniqueCats[0]);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredServices = () => {
        return services.filter(s => s.category === selectedCategory);
    };

    const selectedService = services.find(s => s.id === selectedServiceId);
    const activeRate = selectedService ? parseFloat(selectedService.custom_rate || selectedService.rate) : 0;
    const cost = selectedService && quantity
        ? ((activeRate * parseInt(quantity)) / 1000).toFixed(4)
        : '0.0000';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedService || !link || !quantity) return;

        const qty = parseInt(quantity);
        if (qty < selectedService.min_quantity || qty > selectedService.max_quantity) {
            setError(`Quantity must be between ${selectedService.min_quantity} and ${selectedService.max_quantity}`);
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId: selectedServiceId,
                    link,
                    quantity: qty,
                    cost: parseFloat(cost)
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Successfully placed order
            router.push('/orders');
        } catch (err) {
            setError(err.message);
            setSubmitting(false);
        }
    };

    // Auto-select first service when category changes
    useEffect(() => {
        const filtered = getFilteredServices();
        if (filtered.length > 0 && (!selectedServiceId || !filtered.find(s => s.id === selectedServiceId))) {
            setSelectedServiceId(filtered[0].id);
        }
    }, [selectedCategory]);

    return (
        <div>
            <div className="page-header animate-in">
                <h1 className="page-title">New Order</h1>
                <p className="page-subtitle">Place a new order for an SMM service.</p>
            </div>

            <div className="card animate-in" style={{ animationDelay: '0.1s', maxWidth: '800px' }}>
                {error && <div className="toast toast-error mb-6">{error}</div>}

                {loading ? (
                    <div className="text-center py-8">
                        <div className="spinner mx-auto mb-4"></div>
                        <p className="text-muted">Loading services...</p>
                    </div>
                ) : services.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">⚠️</div>
                        <h3 className="empty-state-title">No services available</h3>
                        <p className="empty-state-desc">You need to connect an API provider and sync services first.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Category</label>
                            <select
                                className="form-select"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                required
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Service</label>
                            <select
                                className="form-input"
                                value={selectedServiceId}
                                onChange={(e) => setSelectedServiceId(e.target.value)}
                                required
                            >
                                <option value="" disabled>-- Select a Service --</option>
                                {categories.filter(c => selectedCategory === 'All' ? c !== 'All' : c === selectedCategory).map(cat => {
                                    const catServices = getFilteredServices().filter(s => s.category === cat);
                                    if (catServices.length === 0) return null;
                                    return (
                                        <optgroup key={cat} label={cat}>
                                            {catServices.map(svc => (
                                                <option key={svc.id} value={svc.id}>
                                                    {svc.external_service_id} — {svc.name} (Rs. {parseFloat(svc.custom_rate || svc.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / 1K)
                                                </option>
                                            ))}
                                        </optgroup>
                                    );
                                })}
                            </select>
                            {selectedService && (
                                <div className="form-hint mt-2 flex gap-4">
                                    <span className="badge badge-success">{selectedService.api_providers?.name}</span>
                                    <span>Min: <b className="text-primary">{selectedService.min_quantity}</b></span>
                                    <span>Max: <b className="text-primary">{selectedService.max_quantity}</b></span>
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Link</label>
                            <input
                                type="url"
                                className="form-input"
                                value={link}
                                onChange={(e) => setLink(e.target.value)}
                                placeholder="https://instagram.com/..."
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Quantity</label>
                            <input
                                type="number"
                                className="form-input"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                min={selectedService?.min_quantity || 1}
                                max={selectedService?.max_quantity || 9999999}
                                placeholder="1000"
                                required
                            />
                        </div>

                        <div className="cost-display mb-6">
                            <span className="cost-label">Total Cost</span>
                            <span className="cost-value">Rs. {Number(cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                Your order is forwarded immediately to the API provider.
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                disabled={submitting || !selectedService}
                            >
                                {submitting ? <span className="spinner"></span> : 'Place Order'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
