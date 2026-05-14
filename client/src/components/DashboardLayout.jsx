import { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

export default function DashboardLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="dashboard-main">
                <div className="dashboard-content">
                    {children}
                </div>
            </main>

            <BottomNav onMenuClick={() => setSidebarOpen(true)} />
        </div>
    );
}
