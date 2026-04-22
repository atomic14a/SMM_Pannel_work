'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';

const StatsCard = ({ title, value, icon, colorClass, delay = 0 }) => (
    <div className={`stat-card animate-in`} style={{ animationDelay: `${delay}s` }}>
        <div className={`stat-card-icon ${colorClass}`}>{icon}</div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{title}</div>
    </div>
);

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        totalSpent: 0
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cancellingId, setCancellingId] = useState(null);
    const supabase = createClient();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch stats summary (all time)
            const { data: summaryData, error: summaryError } = await supabase
                .from('orders')
                .select('cost, status');

            if (summaryError) throw summaryError;

            const totalOrders = summaryData.length;
            let completedOrders = 0;
            let pendingOrders = 0;
            let totalSpent = 0;

            summaryData.forEach(order => {
                totalSpent += Number(order.cost || 0);
                const s = order.status?.toLowerCase();
                if (s === 'completed') completedOrders++;
                if (s === 'pending' || s.includes('progress') || s.includes('processing')) pendingOrders++;
            });

            setStats({
                totalOrders,
                completedOrders,
                pendingOrders,
                totalSpent: totalSpent.toFixed(2)
            });

            // Fetch recent 5 orders
            const { data: recentData, error: recentError } = await supabase
                .from('orders')
                .select(`
          id, link, quantity, cost, status, created_at,
          services (name)
        `)
                .order('created_at', { ascending: false })
                .limit(5);

            if (recentError) throw recentError;
            setRecentOrders(recentData || []);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
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
                await fetchDashboardData();
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setCancellingId(null);
        }
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

    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner spinner-lg"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header animate-in">
                <h1 className="page-title">Dashboard</h1>
                <p className="page-subtitle">Overview of your SMM orders and stats.</p>
            </div>

            <div className="stats-grid">
                <StatsCard
                    title="Total Orders"
                    value={stats.totalOrders}
                    icon="📦"
                    colorClass="blue"
                    delay={0}
                />
                <StatsCard
                    title="Completed"
                    value={stats.completedOrders}
                    icon="✅"
                    colorClass="green"
                    delay={0.1}
                />
                <StatsCard
                    title="In Progress"
                    value={stats.pendingOrders}
                    icon="⏳"
                    colorClass="amber"
                    delay={0.2}
                />
                <StatsCard
                    title="Total Spent"
                    value={`Rs. ${Number(stats.totalSpent).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon="💰"
                    colorClass="purple"
                    delay={0.3}
                />
            </div>

            <div className="card animate-in" style={{ animationDelay: '0.4s' }}>
                <div className="card-header">
                    <h2 className="card-title">Recent Orders</h2>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🗑️</div>
                        <h3 className="empty-state-title">No orders yet</h3>
                        <p className="empty-state-desc">When you place orders, they will appear here.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Service</th>
                                    <th>Link</th>
                                    <th>Qty</th>
                                    <th>Cost</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map(order => (
                                    <tr key={order.id}>
                                        <td data-label="Service" className="font-bold">{order.services?.name || 'Unknown Service'}</td>
                                        <td data-label="Link">
                                            <div className="truncate" title={order.link}>
                                                {order.link}
                                            </div>
                                        </td>
                                        <td data-label="Qty">{order.quantity}</td>
                                        <td data-label="Cost" className="text-accent">Rs. {Number(order.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
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
