'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function BulkOrderPage() {
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Cart / Items to order
    const [link, setLink] = useState('');
    const [cart, setCart] = useState([]); // Array of { service, quantity }

    // UI state
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
                .order('category');

            if (error) throw error;

            setServices(data || []);
            const uniqueCats = ['All', ...new Set(data.map(s => s.category))].sort();
            setCategories(uniqueCats);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (service) => {
        if (cart.find(item => item.service.id === service.id)) {
            return; // Already in cart
        }
        setCart([...cart, { service, quantity: service.min_quantity }]);
    };

    const removeFromCart = (serviceId) => {
        setCart(cart.filter(item => item.service.id !== serviceId));
    };

    const updateQuantity = (serviceId, qty) => {
        setCart(cart.map(item =>
            item.service.id === serviceId ? { ...item, quantity: qty } : item
        ));
    };

    const calculateTotal = () => {
        return cart.reduce((total, item) => {
            const rate = parseFloat(item.service.custom_rate || item.service.rate);
            return total + (rate * item.quantity / 1000);
        }, 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!link || cart.length === 0) return;

        // Final validation
        for (const item of cart) {
            if (item.quantity < item.service.min_quantity || item.quantity > item.service.max_quantity) {
                setError(`Quantity for ${item.service.name} must be between ${item.service.min_quantity} and ${item.service.max_quantity}`);
                return;
            }
        }

        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch('/api/orders/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    link,
                    items: cart.map(item => ({
                        serviceId: item.service.id,
                        quantity: parseInt(item.quantity)
                    }))
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            router.push('/orders');
        } catch (err) {
            setError(err.message);
            setSubmitting(false);
        }
    };

    const filteredServices = services.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.external_service_id.includes(searchTerm);
        const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;
        return matchesSearch && matchesCat;
    });

    return (
        <div>
            <div className="page-header animate-in">
                <h1 className="page-title">Bulk Order</h1>
                <p className="page-subtitle">Order multiple services for a single link at once.</p>
            </div>

            {error && <div className="toast toast-error mb-6">{error}</div>}

            <div className="bulk-grid-container">
                <div className="bulk-grid gap-6 items-start">

                    {/* Left Side: Service Selector */}
                    <div className="card animate-in" style={{ animationDelay: '0.1s' }}>
                        <div className="card-header">
                            <h2 className="card-title">Choose Services</h2>
                        </div>

                        <div className="toolbar" style={{ marginBottom: '16px' }}>
                            <div className="search-input" style={{ flex: 2 }}>
                                <span className="search-icon">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search services..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <select
                                className="form-select"
                                style={{ flex: 1 }}
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>

                        <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Service</th>
                                        <th>Rate (1K)</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredServices.map(svc => (
                                        <tr key={svc.id}>
                                            <td data-label="Service">
                                                <div className="font-bold" style={{ fontSize: '13px' }}>{svc.name}</div>
                                                <div className="flex gap-2 items-center mt-1">
                                                    <span className="text-muted" style={{ fontSize: '11px' }}>ID: {svc.external_service_id}</span>
                                                    <span className="badge" style={{ fontSize: '10px' }}>{svc.category}</span>
                                                </div>
                                            </td>
                                            <td data-label="Rate (1K)">
                                                <span className="text-accent font-bold">
                                                    Rs. {parseFloat(svc.custom_rate || svc.rate).toFixed(2)}
                                                </span>
                                            </td>
                                            <td data-label="Action">
                                                <button
                                                    className={`btn btn-sm ${cart.find(i => i.service.id === svc.id) ? 'btn-secondary' : 'btn-primary'}`}
                                                    onClick={() => addToCart(svc)}
                                                    disabled={!!cart.find(i => i.service.id === svc.id)}
                                                >
                                                    {cart.find(i => i.service.id === svc.id) ? 'Added' : 'Add +'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right Side: Order Cart */}
                    <div className="card animate-in bulk-cart-container" style={{ position: 'sticky', top: '24px', animationDelay: '0.2s' }}>
                        <div className="card-header">
                            <h2 className="card-title">Order Details</h2>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Destination Link</label>
                                <input
                                    type="url"
                                    className="form-input"
                                    placeholder="https://..."
                                    value={link}
                                    onChange={(e) => setLink(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="form-label mb-2">Selected Services ({cart.length})</label>
                                {cart.length === 0 ? (
                                    <div className="text-center py-6 border border-dashed rounded-lg bg-surface mt-2">
                                        <p className="text-muted" style={{ fontSize: '13px' }}>No services selected yet.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3 mt-2">
                                        {cart.map(item => (
                                            <div key={item.service.id} className="p-3 rounded-lg bg-surface border">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="font-bold truncate pr-4" style={{ fontSize: '12px' }}>{item.service.name}</div>
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <div style={{ flex: 1 }}>
                                                        <div className="text-muted mb-1" style={{ fontSize: '10px' }}>Quantity (Min: {item.service.min_quantity})</div>
                                                        <input
                                                            type="number"
                                                            className="form-input py-1"
                                                            style={{ fontSize: '12px' }}
                                                            value={item.quantity === 0 ? '' : item.quantity}
                                                            onChange={(e) => updateQuantity(item.service.id, e.target.value === '' ? 0 : parseInt(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-3" style={{ minWidth: '100px', flex: 1, justifyContent: 'flex-end' }}>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div className="text-muted mb-1" style={{ fontSize: '10px' }}>Subtotal</div>
                                                            <div className="text-accent font-bold" style={{ fontSize: '13px' }}>
                                                                Rs. {(parseFloat(item.service.custom_rate || item.service.rate) * item.quantity / 1000).toFixed(2)}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn btn-icon btn-secondary"
                                                            style={{ width: '32px', height: '32px' }}
                                                            onClick={() => removeFromCart(item.service.id)}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center py-4 border-t mb-4">
                                <span className="font-bold">Total Bill</span>
                                <span className="text-xl font-bold text-primary">Rs. {calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-lg w-full"
                                style={{ width: '100%' }}
                                disabled={submitting || cart.length === 0 || !link}
                            >
                                {submitting ? <span className="spinner"></span> : '🚀 Place Bulk Order'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
