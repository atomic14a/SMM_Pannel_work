'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import PinModal from '@/components/PinModal';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('providers');

    // Providers State
    const [providers, setProviders] = useState([]);
    const [providersLoading, setProvidersLoading] = useState(true);
    const [providersError, setProvidersError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ name: '', api_url: '', api_key: '' });
    const [saving, setSaving] = useState(false);
    const [testingId, setTestingId] = useState(null);

    // Services State
    const [services, setServices] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [servicesSearch, setServicesSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [dirtyServices, setDirtyServices] = useState({});
    const [savingChanges, setSavingChanges] = useState(false);

    // PIN Protection state
    const [isAuthorized, setIsAuthorized] = useState(false);

    const supabase = createClient();
    const adminPin = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234';

    useEffect(() => {
        if (isAuthorized) {
            fetchProviders();
            fetchServices();
        }
    }, [isAuthorized]);

    // ----------------- PROVIDERS LOGIC -----------------
    const fetchProviders = async () => {
        setProvidersLoading(true);
        try {
            const res = await fetch('/api/providers');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setProviders(data);
        } catch (err) {
            setProvidersError(err.message);
        } finally {
            setProvidersLoading(false);
        }
    };

    const handleTestConnection = async (provider) => {
        setTestingId(provider.id);
        try {
            const res = await fetch('/api/providers/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: provider.id,
                    apiUrl: provider.api_url
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(`Success! Balance: $${data.balance} ${data.currency}`);
            await fetchProviders();
        } catch (err) {
            alert(`Connection failed: ${err.message}`);
        } finally {
            setTestingId(null);
        }
    };

    const handleProviderSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setProvidersError(null);
        try {
            const method = editingId ? 'PUT' : 'POST';
            const body = { ...formData };
            if (editingId) body.id = editingId;

            const res = await fetch('/api/providers', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setFormData({ name: '', api_url: '', api_key: '' });
            setEditingId(null);
            await fetchProviders();
        } catch (err) {
            setProvidersError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProvider = async (id) => {
        if (!confirm('Are you sure you want to delete this provider?')) return;
        try {
            const res = await fetch(`/api/providers?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).error);
            await fetchProviders();
        } catch (err) {
            alert(err.message);
        }
    };

    // ----------------- SERVICES LOGIC -----------------
    const fetchServices = async () => {
        setServicesLoading(true);
        try {
            const res = await fetch('/api/services');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setServices(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setServicesLoading(false);
        }
    };

    const handleSyncServices = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/services/sync', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to sync options');

            alert(`Successfully synced ${data.syncedCount} services from providers! Check your service catalog.`);
            await fetchServices();
        } catch (err) {
            alert(err.message);
        } finally {
            setSyncing(false);
        }
    };

    const toggleServiceStatus = (serviceId, currentStatus) => {
        const newStatus = !currentStatus;
        setServices(services.map(s => s.id === serviceId ? { ...s, is_active: newStatus } : s));
        setDirtyServices(prev => ({
            ...prev,
            [serviceId]: { ...prev[serviceId], id: serviceId, is_active: newStatus }
        }));
    };

    const updateCustomRate = (serviceId, newRate) => {
        const rateVal = newRate === '' ? null : newRate;
        setServices(services.map(s => s.id === serviceId ? { ...s, custom_rate: rateVal } : s));
        setDirtyServices(prev => ({
            ...prev,
            [serviceId]: { ...prev[serviceId], id: serviceId, custom_rate: rateVal }
        }));
    };

    const handleBulkToggle = (setActive) => {
        const serviceIds = filteredServices
            .filter(s => s.is_active !== setActive)
            .map(s => s.id);

        if (serviceIds.length === 0) return;

        setServices(services.map(s =>
            serviceIds.includes(s.id) ? { ...s, is_active: setActive } : s
        ));

        const newDirty = { ...dirtyServices };
        serviceIds.forEach(id => {
            newDirty[id] = { ...newDirty[id], id, is_active: setActive };
        });
        setDirtyServices(newDirty);
    };

    const saveChanges = async () => {
        const updates = Object.values(dirtyServices);
        if (updates.length === 0) return;

        setSavingChanges(true);
        try {
            const res = await fetch('/api/services/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });
            if (!res.ok) throw new Error('Failed to save changes');

            alert(`Successfully saved ${updates.length} service changes!`);
            setDirtyServices({});
        } catch (err) {
            alert(err.message);
        } finally {
            setSavingChanges(false);
        }
    };

    if (!isAuthorized) {
        return <PinModal isOpen={true} onSuccess={() => setIsAuthorized(true)} expectedPin={adminPin} />;
    }

    const categories = ['All', ...new Set(services.map(s => s.category))].sort();
    const filteredServices = services
        .filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(servicesSearch.toLowerCase()) || String(s.external_service_id).includes(servicesSearch);
            const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;
            return matchesSearch && matchesCat;
        })
        .sort((a, b) => b.is_active === a.is_active ? 0 : b.is_active ? 1 : -1);

    return (
        <div>
            <div className="page-header animate-in">
                <h1 className="page-title">Admin Settings</h1>
                <p className="page-subtitle">Manage providers and select which services to show your team.</p>
            </div>

            <div className="tabs mb-6 flex gap-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <button
                    className={`btn ${activeTab === 'providers' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('providers')}
                >
                    API Providers
                </button>
                <button
                    className={`btn ${activeTab === 'services' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('services')}
                >
                    Service Catalog
                </button>
            </div>

            {/* API PROVIDERS TAB */}
            {activeTab === 'providers' && (
                <div className="grid-2">
                    <div className="card animate-in">
                        <h2 className="card-title mb-4">{editingId ? 'Edit Provider' : 'Add New Provider'}</h2>
                        {providersError && <div className="form-error mb-4">{providersError}</div>}

                        <form onSubmit={handleProviderSubmit}>
                            <div className="form-group">
                                <label className="form-label">Provider Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. JustAnotherPanel"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">API URL</label>
                                <input
                                    type="url"
                                    className="form-input"
                                    value={formData.api_url}
                                    onChange={e => setFormData({ ...formData, api_url: e.target.value })}
                                    placeholder="https://example.com/api/v2"
                                    required
                                />
                            </div>

                            <div className="form-group mb-6">
                                <label className="form-label">API Key {editingId && '(Leave blank to keep existing)'}</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={formData.api_key}
                                    onChange={e => setFormData({ ...formData, api_key: e.target.value })}
                                    placeholder="••••••••••••••••"
                                    required={!editingId}
                                />
                            </div>

                            <div className="flex gap-3">
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Saving...' : (editingId ? 'Update Provider' : 'Add Provider')}
                                </button>
                                {editingId && (
                                    <button type="button" className="btn btn-secondary" onClick={() => {
                                        setEditingId(null);
                                        setFormData({ name: '', api_url: '', api_key: '' });
                                    }}>
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="card animate-in" style={{ animationDelay: '0.1s' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="card-title">Connected Providers</h2>
                            <button className="btn btn-secondary btn-sm" onClick={fetchProviders}>Refresh</button>
                        </div>

                        {providersLoading ? (
                            <div className="text-center py-8"><div className="spinner mx-auto"></div></div>
                        ) : providers.length === 0 ? (
                            <div className="empty-state" style={{ padding: '30px' }}>No APIs added.</div>
                        ) : (
                            <div className="flex-col gap-4">
                                {providers.map(p => (
                                    <div key={p.id} className="provider-card">
                                        <div className="provider-card-header">
                                            <div className="provider-name">{p.name}</div>
                                            <div className="provider-status">
                                                <span className={`badge-dot ${p.is_active ? 'text-success' : 'text-error'}`}></span>
                                                {p.is_active ? 'Active' : 'Disabled'}
                                            </div>
                                        </div>

                                        <div className="provider-info mb-0">
                                            <div className="provider-info-item">
                                                <span className="provider-info-label">Balance</span>
                                                <span className="provider-info-value font-bold">${p.balance?.toFixed(2)}</span>
                                            </div>
                                            <div className="provider-info-item">
                                                <span className="provider-info-label">URL</span>
                                                <span className="provider-info-value" style={{ fontSize: '12px' }}>{new URL(p.api_url).hostname}</span>
                                            </div>
                                        </div>

                                        <div className="provider-actions mt-4 pt-4 border-t border-subtle">
                                            <button
                                                className="btn btn-secondary btn-sm flex-1"
                                                onClick={() => handleTestConnection(p)}
                                                disabled={testingId === p.id}
                                            >
                                                {testingId === p.id ? 'Testing...' : 'Test API'}
                                            </button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => {
                                                setFormData({ name: p.name, api_url: p.api_url, api_key: '' });
                                                setEditingId(p.id);
                                            }}>Edit</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProvider(p.id)}>Del</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SERVICES CATALOG TAB */}
            {activeTab === 'services' && (
                <div className="card animate-in">
                    <div className="flex justify-between items-center mb-6" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h2 className="card-title">Service Catalog Manager</h2>
                            <p className="text-muted" style={{ fontSize: '13px' }}>Toggle ON to make services visible to your team.</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                className="btn btn-primary"
                                onClick={handleSyncServices}
                                disabled={syncing}
                            >
                                {syncing ? <span className="spinner"></span> : '🔄 Fetch & Sync'}
                            </button>
                            <button
                                className="btn"
                                style={{
                                    backgroundColor: Object.keys(dirtyServices).length > 0 ? 'var(--status-warning)' : 'var(--border-subtle)',
                                    color: Object.keys(dirtyServices).length > 0 ? '#fff' : 'var(--text-muted)',
                                    fontWeight: 'bold',
                                    opacity: Object.keys(dirtyServices).length > 0 ? 1 : 0.6
                                }}
                                onClick={saveChanges}
                                disabled={savingChanges || Object.keys(dirtyServices).length === 0}
                            >
                                {savingChanges ? 'Saving...' : `💾 Save Details (${Object.keys(dirtyServices).length})`}
                            </button>
                        </div>
                    </div>

                    <div className="toolbar">
                        <div className="toolbar-left" style={{ flex: 1, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <div className="search-input" style={{ flex: 1, minWidth: '200px' }}>
                                <span className="search-icon">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search services..."
                                    value={servicesSearch}
                                    onChange={(e) => setServicesSearch(e.target.value)}
                                />
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleBulkToggle(true)}>
                                Select All Filtered
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleBulkToggle(false)}>
                                Unselect All Filtered
                            </button>
                        </div>
                        <div className="toolbar-right">
                            <select
                                className="filter-select"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    {servicesLoading ? (
                        <div className="text-center py-8"><div className="spinner mx-auto"></div></div>
                    ) : filteredServices.length === 0 ? (
                        <div className="empty-state">
                            <h3 className="empty-state-title">No services found</h3>
                            <p className="empty-state-desc">Click "Fetch & Sync" to download services from your providers.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '60px' }}>Active</th>
                                        <th>ID</th>
                                        <th>Service Name</th>
                                        <th>Rate</th>
                                        <th>Provider</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const activeCategories = new Set(filteredServices.filter(s => s.is_active).map(s => s.category));
                                        const sortedCategories = categories.filter(c => c !== 'All').sort((a, b) => {
                                            const aActive = activeCategories.has(a);
                                            const bActive = activeCategories.has(b);
                                            if (aActive && !bActive) return -1;
                                            if (!aActive && bActive) return 1;
                                            return a.localeCompare(b);
                                        });

                                        return sortedCategories.map(cat => {
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
                                                        <tr key={service.id} style={{ opacity: service.is_active ? 1 : 0.5 }}>
                                                            <td data-label="Active">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={service.is_active}
                                                                    onChange={() => toggleServiceStatus(service.id, service.is_active)}
                                                                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                                                />
                                                            </td>
                                                            <td data-label="ID" className="font-mono text-muted">#{service.external_service_id}</td>
                                                            <td data-label="Service Name">
                                                                <div className="font-bold">{service.name}</div>
                                                            </td>
                                                            <td data-label="Rate">
                                                                <div className="text-muted" style={{ fontSize: '11px', textDecoration: service.custom_rate ? 'line-through' : 'none' }}>
                                                                    Base: Rs. {parseFloat(service.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                                </div>
                                                                <div className="mt-1 flex items-center gap-1">
                                                                    <span className="text-accent font-bold" style={{ fontSize: '12px' }}>Rs.</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.0001"
                                                                        placeholder="Custom"
                                                                        className="form-input"
                                                                        style={{ width: '90px', padding: '0.2rem 0.5rem', fontSize: '12px' }}
                                                                        defaultValue={service.custom_rate || ''}
                                                                        onBlur={(e) => updateCustomRate(service.id, e.target.value)}
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td data-label="Provider">
                                                                <span className="badge">{service.api_providers?.name}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
