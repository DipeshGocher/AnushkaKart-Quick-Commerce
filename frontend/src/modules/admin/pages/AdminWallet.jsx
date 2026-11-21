import React, { useState, useEffect, useCallback } from 'react';
import Card from '@shared/components/ui/Card';
import { Landmark, Users, CircleDollarSign, TrendingUp, RotateCw, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const EMPTY = { platformHolds: 0, owedToPartners: 0, owedToSellers: 0, owedToRiders: 0, riderCash: 0, courierCash: 0, ourEarning: 0, ourEarningCashPending: 0 };

/**
 * Admin Wallet: just four plain numbers.
 *  1. Money with the platform    2. What sellers and riders can still claim
 *  3. Cash the riders hold       4. What the platform really earned
 */
const AdminWallet = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState(EMPTY);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await adminApi.getFinanceSummary();
            setOverview({ ...EMPTY, ...(res?.data?.result?.overview || {}) });
        } catch (error) {
            console.error("Admin Wallet Fetch Error:", error);
            toast.error("Could not load the wallet numbers");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const cards = [
        {
            id: 'platform-holds',
            label: 'Money with Platform',
            value: rupees(overview.platformHolds),
            description: 'Everything we hold right now, including the money of sellers and riders',
            icon: Landmark,
            bg: 'bg-blue-50',
            iconColor: 'text-blue-600',
        },
        {
            id: 'owed',
            label: 'Sellers & Riders can claim',
            value: rupees(overview.owedToPartners),
            description: `Sellers ${rupees(overview.owedToSellers)} • Riders ${rupees(overview.owedToRiders)}`,
            icon: Users,
            bg: 'bg-rose-50',
            iconColor: 'text-rose-600',
            actionText: 'Money Requests',
            actionPath: '/admin/withdrawals',
        },
        {
            id: 'rider-cash',
            label: 'Cash with Riders',
            value: rupees(overview.riderCash),
            description: (overview.riderCash > 0 ? 'Collected from customers, not handed over yet' : 'All clear, no cash pending') +
                (overview.courierCash > 0 ? ` • ${rupees(overview.courierCash)} more is with the courier (Shiprocket)` : ''),
            icon: CircleDollarSign,
            bg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            actionText: 'Collect Cash',
            actionPath: '/admin/cash-collection',
        },
        {
            id: 'our-earning',
            label: 'Our Earning',
            value: rupees(overview.ourEarning),
            description: overview.ourEarningCashPending > 0
                ? `After rider cost and coupons • ${rupees(overview.ourEarningCashPending)} of it is still cash with riders`
                : 'After rider / courier cost and coupons',
            icon: TrendingUp,
            bg: 'bg-purple-50',
            iconColor: 'text-purple-600',
        },
    ];

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1">Wallet</h1>
                    <p className="ds-description mt-1">Where the money stands right now.</p>
                </div>
                <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 self-start"
                >
                    <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    REFRESH
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="wallet-four-numbers">
                {cards.map((card, idx) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        key={card.id}
                    >
                        <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white flex flex-col justify-between h-full" data-testid={`wallet-card-${card.id}`}>
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <div className={cn("p-2.5 rounded-xl", card.bg)}>
                                        <card.icon className={cn("h-5 w-5", card.iconColor)} strokeWidth={2.5} />
                                    </div>
                                </div>
                                <p className="ds-label mb-1 text-[11px]">{card.label}</p>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight" data-testid={`wallet-value-${card.id}`}>{card.value}</h3>
                            </div>
                            <div className="pt-3 border-t border-slate-50 mt-4 flex items-end justify-between gap-2">
                                <p className="text-[11px] font-semibold text-slate-400/90">{card.description}</p>
                                {card.actionText && card.actionPath && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(card.actionPath)}
                                        className="text-[10px] font-black text-primary hover:underline shrink-0 flex items-center gap-0.5"
                                    >
                                        {card.actionText}
                                        <ChevronRight className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default AdminWallet;
