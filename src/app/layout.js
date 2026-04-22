'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Sidebar from '@/components/Sidebar';
import './globals.css';

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  // Don't wrap login page with sidebar layout
  if (pathname === '/login') {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  // Prevent flash of unstyled content
  if (!mounted) {
    return (
      <html lang="en">
        <body></body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          {/* Mobile Header */}
          <div className="mobile-header">
            <div className="sidebar-title">SMM Panel</div>
            <button className="hamburger-btn" onClick={toggleSidebar}>
              ☰
            </button>
          </div>

          {/* Sidebar Navigation */}
          {user && (
            <Sidebar
              isOpen={sidebarOpen}
              toggleSidebar={toggleSidebar}
            />
          )}

          {/* Main Content Area */}
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
