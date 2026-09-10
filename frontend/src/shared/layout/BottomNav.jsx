import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    ClipboardList,
    Box,
    Wallet
} from 'lucide-react';

import { useAuth } from '@core/context/AuthContext';

const BottomNav = () => {
    const { role } = useAuth();

    // Define the primary bottom nav items based on user role
    const primaryItems = role === 'admin' ? [
        { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true },
        { label: 'Orders', path: '/admin/orders/all', icon: ClipboardList },
        { label: 'Products', path: '/admin/products', icon: Box },
        { label: 'Wallet', path: '/admin/wallet', icon: Wallet },
    ] : [
        { label: 'Dashboard', path: '/seller', icon: LayoutDashboard, end: true },
        { label: 'Orders', path: '/seller/orders', icon: ClipboardList },
        { label: 'Products', path: '/seller/products', icon: Box },
        { label: 'Earnings', path: '/seller/earnings', icon: Wallet },
    ];

    return (
        <div 
            className="fixed left-3 right-3 max-w-sm mx-auto bg-[#18181b]/90 backdrop-blur-xl border border-white/10 z-[60] md:hidden px-2 py-1.5 flex items-center justify-around rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition-all duration-300"
            style={{
                bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))"
            }}
        >
            {primaryItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    className={({ isActive }) => cn(
                        "flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-2xl transition-all duration-300 flex-1 min-w-[55px]",
                        isActive ? "bg-white text-slate-900 shadow-md font-extrabold" : "text-slate-300 hover:text-white font-medium"
                    )}
                >
                    {({ isActive }) => (
                        <>
                            <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-slate-400")} />
                            <span className={cn("text-[10px] whitespace-nowrap leading-none tracking-tight", isActive ? "text-slate-900 font-black" : "text-slate-300 font-medium")}>{item.label}</span>
                        </>
                    )}
                </NavLink>
            ))}
        </div>
    );
};

export default BottomNav;

