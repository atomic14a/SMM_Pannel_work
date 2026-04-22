'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function Sidebar({ isOpen, toggleSidebar }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = async () => {
        setLoggingOut(true);
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const navItems = [
        { name: 'Dashboard', href: '/dashboard', icon: '📊' },
        { name: 'Services', href: '/services', icon: '📦' },
    ];

    const orderItems = [
        { name: 'New Order', href: '/orders/new', icon: '🛒' },
        { name: 'Bulk Order', href: '/orders/bulk', icon: '📦' },
        { name: 'Order History', href: '/orders', icon: '📋' },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
                onClick={toggleSidebar}
            />

            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">S</div>
                    <div>
                        <div className="sidebar-title">SMM Panel</div>
                        <div className="sidebar-subtitle">Workspace</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-nav-label">Main</div>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-link ${isActive ? 'active' : ''}`}
                                onClick={() => { if (window.innerWidth <= 768) toggleSidebar(); }}
                            >
                                <div className="nav-icon">{item.icon}</div>
                                {item.name}
                            </Link>
                        );
                    })}

                    <div className="sidebar-nav-label">Orders</div>
                    {orderItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-link ${isActive ? 'active' : ''}`}
                                onClick={() => { if (window.innerWidth <= 768) toggleSidebar(); }}
                            >
                                <div className="nav-icon">{item.icon}</div>
                                {item.name}
                            </Link>
                        );
                    })}

                    <div className="sidebar-nav-label">Admin</div>
                    <Link
                        href="/settings"
                        className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}
                        onClick={() => { if (window.innerWidth <= 768) toggleSidebar(); }}
                    >
                        <div className="nav-icon">⚙️</div>
                        Settings
                    </Link>
                </nav>

                <div className="sidebar-footer">
                    <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="nav-link"
                        style={{ color: 'var(--status-error)' }}
                    >
                        <div className="nav-icon">🚪</div>
                        {loggingOut ? 'Signing out...' : 'Sign Out'}
                    </button>
                </div>
            </aside>
        </>
    );
}
