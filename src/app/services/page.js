'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';

export default function ServicesPage() {
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [providers, setProviders] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedProvider, setSelectedProvider] = useState('All');

    const supabase = createClient();

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('services')
                .select(`
          id, external_service_id, name, category, rate, custom_rate, min_quantity, max_quantity, is_active,
          api_providers(id, name)
        `)
                .eq('is_active', true)
                .order('rate', { ascending: true });

            if (error) throw error;

            setServices(data || []);

            // Extract unique categories
            const uniqueCats = [...new Set(data.map(s => s.category))].sort();
            setCategories(['All', ...uniqueCats]);

            // Extract unique providers
            const uniqueProvIds = new Set();
            const provs = [{ id: 'All', name: 'All Providers' }];

            data.forEach(s => {
                if (s.api_providers && !uniqueProvIds.has(s.api_providers.id)) {
                    uniqueProvIds.add(s.api_providers.id);
                    provs.push(s.api_providers);
                }
            });
            setProviders(provs);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredServices = services.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.external_service_id.toString().includes(search);
        const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
        const matchesProvider = selectedProvider === 'All' || s.api_providers?.id === selectedProvider;

        return matchesSearch && matchesCategory && matchesProvider;
    });

    return (
        <div>
            <div className="page-header animate-in">
                <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 className="page-title">Services</h1>
                        <p className="page-subtitle">Available SMM services for your team to use.</p>
                    </div>
                </div>
            </div>

            {error && <div className="toast toast-error mb-4">{error}</div>}

            <div className="card animate-in" style={{ animationDelay: '0.1s' }}>
                <div className="toolbar">
                    <div className="toolbar-left">
                        <div className="search-input">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                placeholder="Search services..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="toolbar-right">
                        <select
                            className="filter-select"
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value)}
                        >
                            {providers.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Categories Pills */}
                <div className="category-pills">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="text-center py-8">
                        <div className="spinner mx-auto mb-4"></div>
                        <p className="text-muted">Loading services...</p>
                    </div>
                ) : filteredServices.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🔎</div>
                        <h3 className="empty-state-title">No services found</h3>
                        <p className="empty-state-desc">Try adjusting your filters or ask admin to enable services.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Service Name</th>
                                    <th>Provider</th>
                                    <th>Rate (Rs.)</th>
                                    <th>Min / Max</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.filter(c => selectedCategory === 'All' ? c !== 'All' : c === selectedCategory).map(cat => {
                                    const catServices = filteredServices.filter(s => s.category === cat);
                                    if (catServices.length === 0) return null;

                                    return (
                                        <React.Fragment key={cat}>
                                            <tr className="table-section-row" style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.1)' }}>
                                                <td colSpan="5" className="font-bold text-primary" style={{ padding: '0.75rem 1rem' }}>
                                                    {cat}
                                                </td>
                                            </tr>
                                            {catServices.map(service => (
                                                <tr key={service.id}>
                                                    <td data-label="ID" className="font-mono text-muted">#{service.external_service_id}</td>
                                                    <td data-label="Service Name">
                                                        <div className="font-bold">{service.name}</div>
                                                    </td>
                                                    <td data-label="Provider">
                                                        <span className="badge badge-success">
                                                            {service.api_providers?.name || 'Unknown'}
                                                        </span>
                                                    </td>
                                                    <td data-label="Rate (Rs.)" className="service-rate">
                                                        Rs. {parseFloat(service.custom_rate || service.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                    </td>
                                                    <td data-label="Min / Max" className="service-limits">{service.min_quantity} / {service.max_quantity}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
