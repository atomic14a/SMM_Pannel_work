'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';

export default function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [syncing, setSyncing] = useState(false);
    const [cancellingId, setCancellingId] = useState(null);

    const supabase = createClient();

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    services(name, category),
                    api_providers(name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/orders/sync', { method: 'POST' });
            if (!res.ok) throw new Error('Sync failed');
            await fetchOrders();
        } catch (err) {
            console.error(err);
        } finally {
            setSyncing(false);
        }
    };

    const handleCancel = async (orderId) => {
        if (!confirm('Are you sure you want to request cancellation for this order?')) return;

        setCancellingId(orderId);
        try {
            const res = await fetch('/api/orders/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
            });
            const data = await res.json();

            if (!res.ok) {
                alert(data.error || 'Failed to cancel order');
            } else {
                await fetchOrders();
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setCancellingId(null);
        }
    };

    const handleRefreshStatus = async () => {
        setRefreshing(true);
        setError(null);
        try {
            const res = await fetch('/api/orders/sync', { method: 'POST' });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to refresh status');

            // Re-fetch orders to see updates
            await fetchOrders();
        } catch (err) {
            setError(err.message);
        } finally {
            setRefreshing(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString([], {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const StatusBadge = ({ status }) => {
        const s = status?.toLowerCase() || 'pending';
        let badgeClass = 'badge-pending';
        if (s.includes('progress') || s.includes('processing')) badgeClass = 'badge-progress';
        else if (s === 'completed') badgeClass = 'badge-completed';
        else if (s === 'partial') badgeClass = 'badge-partial';
        else if (s === 'canceled' || s === 'cancelled') badgeClass = 'badge-cancelled';

        return <span className={`badge ${badgeClass}`}>{status}</span>;
    };

    const filteredOrders = search
        ? orders.filter(o =>
            o.id.includes(search) ||
            o.external_order_id?.includes(search) ||
            o.link.toLowerCase().includes(search.toLowerCase()) ||
            o.services?.name?.toLowerCase().includes(search.toLowerCase())
        )
        : orders;

    return (
        <div>
            <div className="page-header animate-in">
                <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 className="page-title">Order History</h1>
                        <p className="page-subtitle">Track and manage all placed API orders.</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleRefreshStatus}
                        disabled={refreshing}
                    >
                        {refreshing ? <span className="spinner"></span> : '🔄'} Refresh Statuses
                    </button>
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
                                placeholder="Search link, ID, service..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="toolbar-right">
                        <select
                            className="filter-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="In progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Partial">Partial</option>
                            <option value="Canceled">Canceled</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-8">
                        <div className="spinner mx-auto mb-4"></div>
                        <p className="text-muted">Loading orders...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <h3 className="empty-state-title">No orders found</h3>
                        <p className="empty-state-desc">You haven't placed any orders matching these filters.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Service</th>
                                    <th>Link</th>
                                    <th>Status</th>
                                    <th>Quantity / Rem.</th>
                                    <th>Cost</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map(order => (
                                    <tr key={order.id}>
                                        <td data-label="Order ID">
                                            <div className="text-muted" style={{ fontSize: '11px' }}>Sys: {order.id.split('-')[0]}</div>
                                            <div className="font-bold">API: #{order.external_order_id || '---'}</div>
                                        </td>
                                        <td data-label="Service">
                                            <div className="font-bold" style={{ fontSize: '13px' }}>{order.services?.name || 'Unknown Service'}</div>
                                            <div className="text-muted" style={{ fontSize: '11px' }}>{order.services?.category}</div>
                                        </td>
                                        <td data-label="Link">
                                            <a href={order.link} target="_blank" rel="noopener noreferrer" className="truncate block" style={{ maxWidth: '150px' }}>
                                                {order.link}
                                            </a>
                                        </td>
                                        <td data-label="Status">
                                            <div className="flex items-center gap-2">
                                                <StatusBadge status={order.status} />
                                                {['pending', 'processing'].includes(order.status?.toLowerCase()) && (
                                                    <button
                                                        className="btn btn-danger"
                                                        style={{ padding: '4px 8px', fontSize: '10px', minWidth: '50px' }}
                                                        onClick={() => handleCancel(order.id)}
                                                        disabled={cancellingId === order.id}
                                                    >
                                                        {cancellingId === order.id ? '...' : 'Cancel'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td data-label="Quantity / Rem.">
                                            <div className="font-bold">{order.quantity.toLocaleString()}</div>
                                            <div className="flex flex-col gap-1 mt-1" style={{ fontSize: '11px' }}>
                                                {order.start_count !== null && <div className="text-muted">Start: {order.start_count}</div>}
                                                {order.remains !== null && order.remains > 0 && <div className="text-warning">Remains: {order.remains}</div>}
                                            </div>
                                        </td>
                                        <td data-label="Cost" className="text-accent">Rs. {Number(order.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                        <td data-label="Date" className="text-muted" style={{ fontSize: '12px' }}>{formatDate(order.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
