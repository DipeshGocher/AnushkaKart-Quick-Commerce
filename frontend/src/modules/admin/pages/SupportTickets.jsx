import React, { useRef, useState, useEffect, useMemo } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import {
    HiOutlineChatBubbleLeftRight,
    HiOutlineMagnifyingGlass,
    HiOutlineUser,
    HiOutlineBuildingStorefront,
    HiOutlineTruck,
    HiOutlinePaperAirplane,
    HiOutlineEllipsisVertical,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineChevronRight,
    HiOutlineArrowLeft,
    HiOutlineCheck,
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@shared/components/ui/Toast';
import { useAuth } from '@core/context/AuthContext';
import { joinTicketRoom, leaveTicketRoom, onTicketCreated, onTicketMessage } from '@/core/services/orderSocket';
import { useSupportUnread } from '@core/context/SupportUnreadContext';
import {
    Ticket,
    Bell,
    CheckCircle2,
    Clock as ClockIcon,
    AlertCircle,
    MessageSquare,
    CheckCheck,
    Search,
} from 'lucide-react';

const SupportTickets = () => {
    const { showToast } = useToast();
    const { token } = useAuth();
    const {
        unreadByTicket,
        setIsViewingSupportChat,
        setActiveTicketId,
        markTicketRead,
        markAllRead,
    } = useSupportUnread();

    const getToken = () => token;
    const fetchTicketsRef = useRef(null);
    const ticketsRef = useRef([]);
    const selectedTicketRoomRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const stickToBottomRef = useRef(true);
    const prevTicketIdRef = useRef(null);
    const menuRef = useRef(null);
    const menuButtonRef = useRef(null);

    const [selectedTicket, setSelectedTicket] = useState(null);
    const [reply, setReply] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [readTicketIds, setReadTicketIds] = useState(() => new Set());

    useEffect(() => {
        setIsViewingSupportChat(true);
        return () => {
            setIsViewingSupportChat(false);
            setActiveTicketId('');
        };
    }, [setIsViewingSupportChat, setActiveTicketId]);

    useEffect(() => {
        const tid = selectedTicket?.id ? String(selectedTicket.id) : "";
        setActiveTicketId(tid);
        if (tid) {
            markTicketRead(tid);
            setReadTicketIds((prev) => new Set(prev).add(tid));
        }
    }, [selectedTicket?.id, setActiveTicketId, markTicketRead]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchTickets(1);
        }, 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, searchTerm]);

    const fetchTickets = async (requestedPage = 1) => {
        try {
            setLoading(true);
            const params = { page: requestedPage, limit: pageSize };
            if (searchTerm.trim()) params.search = searchTerm.trim();

            const res = await adminApi.getTickets(params);
            if (res.data?.success) {
                const payload = res.data.result || {};
                const data = Array.isArray(payload.items) ? payload.items : (res.data.results || []);
                const mapped = data.map((t) => ({
                    ...t,
                    id: t._id,
                    ticketCode: t._id ? String(t._id).slice(-6).toUpperCase() : 'TICKET',
                    user: t.userId?.name || 'Customer',
                    userEmail: t.userId?.email || '',
                    date: t.createdAt
                        ? new Date(t.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true,
                          })
                        : '-',
                    messages: (t.messages || []).map((m, i) => ({
                        ...m,
                        id: m._id || m.id || `msg-${t._id}-${i}`,
                        time: new Date(m.createdAt || Date.now()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                        }),
                    })),
                }));

                setTickets(mapped);
                setTotal(typeof payload.total === 'number' ? payload.total : data.length);
                setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
            }
        } catch (error) {
            console.error('Fetch Tickets Error:', error);
            showToast('Failed to load tickets', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTicketsRef.current = fetchTickets;
    });

    useEffect(() => {
        ticketsRef.current = tickets;
    }, [tickets]);

    useEffect(() => {
        const el = messagesContainerRef.current;
        if (!el || !selectedTicket) return;

        const ticketChanged = prevTicketIdRef.current !== selectedTicket.id;
        const shouldScroll = ticketChanged || stickToBottomRef.current;
        prevTicketIdRef.current = selectedTicket.id;
        if (!shouldScroll) return;

        requestAnimationFrame(() => {
            el.scrollTo({
                top: el.scrollHeight,
                behavior: ticketChanged ? 'auto' : 'smooth',
            });
        });
    }, [selectedTicket?.id, selectedTicket?.messages?.length]);

    useEffect(() => {
        setMenuOpen(false);
    }, [selectedTicket?.id]);

    useEffect(() => {
        if (!menuOpen) return;

        const onKeyDown = (e) => {
            if (e.key === 'Escape') setMenuOpen(false);
        };

        const onPointerDown = (e) => {
            const target = e.target;
            if (!target) return;
            if (menuRef.current?.contains(target)) return;
            if (menuButtonRef.current?.contains(target)) return;
            setMenuOpen(false);
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('pointerdown', onPointerDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointerdown', onPointerDown);
        };
    }, [menuOpen]);

    useEffect(() => {
        if (!token) return;

        const offCreated = onTicketCreated(getToken, () => {
            showToast('New support ticket received', 'info');
            fetchTicketsRef.current?.(1);
        });

        const offMessage = onTicketMessage(getToken, (payload) => {
            const tid = String(payload?.ticketId || '').trim();
            if (!tid) return;

            const message = payload?.message || {};
            const time = new Date(message.createdAt || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
            const normalized = {
                ...message,
                id: message._id || message.id || `msg-${tid}-${Date.now()}`,
                time,
            };

            setTickets((prev) =>
                prev.map((t) => {
                    if (String(t.id) !== tid) return t;
                    const existing = Array.isArray(t.messages) ? t.messages : [];
                    const last = existing[existing.length - 1];
                    if (
                        last &&
                        last.text === normalized.text &&
                        last.senderType === normalized.senderType &&
                        last.createdAt === normalized.createdAt
                    ) {
                        return t;
                    }
                    return { ...t, messages: [...existing, normalized] };
                })
            );

            setSelectedTicket((prev) => {
                if (!prev || String(prev.id) !== tid) return prev;
                const existing = Array.isArray(prev.messages) ? prev.messages : [];
                const last = existing[existing.length - 1];
                if (
                    last &&
                    last.text === normalized.text &&
                    last.senderType === normalized.senderType &&
                    last.createdAt === normalized.createdAt
                ) {
                    return prev;
                }
                return { ...prev, messages: [...existing, normalized] };
            });
        });

        return () => {
            offCreated?.();
            offMessage?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => {
        if (!token) return;
        const nextId = selectedTicket?.id ? String(selectedTicket.id) : null;
        const prevId = selectedTicketRoomRef.current;

        if (prevId && prevId !== nextId) {
            leaveTicketRoom(prevId, getToken);
        }
        if (nextId && prevId !== nextId) {
            joinTicketRoom(nextId, getToken);
        }
        selectedTicketRoomRef.current = nextId;

        return () => {
            const current = selectedTicketRoomRef.current;
            if (current) leaveTicketRoom(current, getToken);
            selectedTicketRoomRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, selectedTicket?.id]);

    const isTicketUnread = (t) => {
        if (!t?.id) return false;
        if (readTicketIds.has(t.id)) return false;
        if (Number(unreadByTicket?.[t.id] || 0) > 0) return true;

        const msgs = t.messages || [];
        if (msgs.length > 0) {
            const last = msgs[msgs.length - 1];
            if (!last?.isAdmin && last?.senderType !== 'Admin' && t.status !== 'closed') {
                return true;
            }
        }
        return false;
    };

    const handleMarkAllAsRead = () => {
        markAllRead();
        const allIds = new Set(tickets.map((t) => t.id));
        setReadTicketIds(allIds);
        showToast('All tickets marked as read', 'success');
    };

    const handleSelectTicket = (t) => {
        setSelectedTicket(t);
        setReadTicketIds((prev) => new Set(prev).add(t.id));
        markTicketRead(t.id);
    };

    const copyToClipboard = async (text) => {
        const value = String(text || '').trim();
        if (!value) return;

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                showToast('Copied to clipboard', 'success');
                return;
            }
        } catch {
            // fallback
        }

        try {
            const textarea = document.createElement('textarea');
            textarea.value = value;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('Copied to clipboard', 'success');
        } catch {
            showToast('Copy failed', 'error');
        }
    };

    const handleSetStatus = async (id, status) => {
        try {
            const res = await adminApi.updateTicketStatus(id, status);
            if (res.data?.success) {
                setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
                setSelectedTicket((prev) => (prev?.id === id ? { ...prev, status } : prev));
                showToast(`Ticket status updated: ${status}`, 'success');
            }
        } catch (error) {
            showToast('Failed to update status', 'error');
        } finally {
            setMenuOpen(false);
        }
    };

    const handleSendReply = async () => {
        if (!reply.trim() || !selectedTicket) return;

        try {
            const res = await adminApi.replyTicket(selectedTicket.id, reply);
            if (res.data?.success) {
                const updatedTicketData = res.data.result;
                const newMessage = {
                    ...updatedTicketData.messages[updatedTicketData.messages.length - 1],
                    time: new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                    }),
                };

                const updatedTickets = tickets.map((t) => {
                    if (t.id === selectedTicket.id) {
                        return {
                            ...t,
                            messages: [...t.messages, newMessage],
                            status: 'processing',
                        };
                    }
                    return t;
                });

                setTickets(updatedTickets);
                setSelectedTicket((prev) => ({
                    ...prev,
                    messages: [...prev.messages, newMessage],
                    status: 'processing',
                }));
                setReply('');
                showToast('Reply sent successfully', 'success');
            }
        } catch (error) {
            showToast('Failed to send reply', 'error');
        }
    };

    const handleResolve = async (id) => {
        return handleSetStatus(id, 'closed');
    };

    const unreadCount = useMemo(() => {
        return tickets.filter((t) => isTicketUnread(t)).length;
    }, [tickets, unreadByTicket, readTicketIds]);

    const openCount = useMemo(() => {
        return tickets.filter((t) => t.status === 'open' || t.status === 'processing').length;
    }, [tickets]);

    const resolvedCount = useMemo(() => {
        return tickets.filter((t) => t.status === 'closed').length;
    }, [tickets]);

    const filteredTickets = useMemo(() => {
        return tickets.filter((t) => {
            const query = searchTerm.toLowerCase();
            return (
                t.id?.toString().toLowerCase().includes(query) ||
                t.user?.toLowerCase().includes(query) ||
                t.subject?.toLowerCase().includes(query)
            );
        });
    }, [tickets, searchTerm]);

    return (
        <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header with Title and Search/Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Customer Support Desk
                        <span className="p-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs font-bold border border-brand-200">
                            Help Tickets
                        </span>
                    </h1>
                    <p className="text-xs font-medium text-slate-500 mt-1">
                        View, manage, and respond to incoming customer and seller support inquiries.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleMarkAllAsRead}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                        <CheckCheck className="h-4 w-4 text-emerald-600" />
                        <span>Mark All as Read</span>
                        {unreadCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Top Stat Divs: Total Tickets, Unread Tickets, Open Tickets, Resolved Tickets */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Tickets */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                        <Ticket className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Total Tickets
                        </p>
                        <p className="text-xl font-black text-slate-900 mt-0.5">{total || tickets.length}</p>
                    </div>
                </div>

                {/* Unread Tickets (Highlighted) */}
                <div className="p-4 rounded-2xl bg-white border border-orange-200/80 shadow-sm flex items-center gap-4 relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                        {unreadCount > 0 && (
                            <span className="flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                            </span>
                        )}
                    </div>
                    <div className="h-11 w-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-200">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
                            Unread Tickets
                        </p>
                        <p className="text-xl font-black text-orange-700 mt-0.5">{unreadCount}</p>
                    </div>
                </div>

                {/* Open / Active Tickets */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                        <ClockIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Active / Open
                        </p>
                        <p className="text-xl font-black text-slate-900 mt-0.5">{openCount}</p>
                    </div>
                </div>

                {/* Resolved / Closed */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Resolved
                        </p>
                        <p className="text-xl font-black text-slate-900 mt-0.5">{resolvedCount}</p>
                    </div>
                </div>
            </div>

            {/* Main Content: If a ticket is selected, display the Chat View; otherwise, display the Tickets Table */}
            {selectedTicket ? (
                /* ── SUPPORT CHAT VIEW (Matching Given Image) ── */
                <Card
                    className="border border-slate-200 shadow-xl rounded-2xl overflow-hidden bg-white min-h-[580px] flex flex-col"
                    contentClassName="p-0 flex flex-col flex-1"
                >
                    {/* Chat Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm active:scale-95 shrink-0"
                            >
                                <HiOutlineArrowLeft className="h-4 w-4" />
                                <span className="hidden sm:inline">Back to Tickets</span>
                            </button>

                            <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm shrink-0">
                                <HiOutlineChatBubbleLeftRight className="h-5 w-5" />
                            </div>

                            <div className="min-w-0">
                                <h3 className="text-sm font-black text-slate-900 truncate">
                                    {selectedTicket.subject}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate mt-0.5">
                                    TICKET ID: {selectedTicket.id} • USER: {selectedTicket.user} • STATUS:{' '}
                                    <span
                                        className={cn(
                                            'font-black',
                                            selectedTicket.status === 'closed'
                                                ? 'text-emerald-600'
                                                : selectedTicket.status === 'processing'
                                                ? 'text-blue-600'
                                                : 'text-amber-600'
                                        )}
                                    >
                                        {selectedTicket.status?.toUpperCase()}
                                    </span>
                                </p>
                            </div>
                        </div>

                        {/* Top-Right Chat Actions */}
                        <div className="relative flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => handleResolve(selectedTicket.id)}
                                className={cn(
                                    'p-2 sm:px-3 sm:py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                                    selectedTicket.status === 'closed'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-emerald-600'
                                )}
                                title="Mark as Resolved"
                            >
                                <HiOutlineCheckCircle className="h-4 w-4" />
                                <span className="hidden md:inline">
                                    {selectedTicket.status === 'closed' ? 'Resolved' : 'Resolve'}
                                </span>
                            </button>

                            <button
                                ref={menuButtonRef}
                                onClick={() => setMenuOpen((v) => !v)}
                                className="p-2 bg-white text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl transition-all shadow-sm"
                                aria-haspopup="menu"
                                aria-expanded={menuOpen ? 'true' : 'false'}
                                title="More actions"
                            >
                                <HiOutlineEllipsisVertical className="h-4 w-4" />
                            </button>

                            <AnimatePresence>
                                {menuOpen && (
                                    <motion.div
                                        ref={menuRef}
                                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                        transition={{ duration: 0.12 }}
                                        className="absolute right-0 top-12 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 text-xs font-bold"
                                        role="menu"
                                    >
                                        <button
                                            onClick={() => copyToClipboard(selectedTicket.id)}
                                            className="w-full text-left px-4 py-3 text-slate-700 hover:bg-slate-50 transition-colors"
                                            role="menuitem"
                                        >
                                            Copy ticket ID
                                        </button>
                                        <button
                                            onClick={() => copyToClipboard(selectedTicket.user)}
                                            className="w-full text-left px-4 py-3 text-slate-700 hover:bg-slate-50 transition-colors"
                                            role="menuitem"
                                        >
                                            Copy customer name
                                        </button>
                                        <div className="h-px bg-slate-100" />
                                        <button
                                            onClick={() => handleSetStatus(selectedTicket.id, 'open')}
                                            className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
                                            role="menuitem"
                                        >
                                            Status: Mark as Open
                                        </button>
                                        <button
                                            onClick={() => handleSetStatus(selectedTicket.id, 'processing')}
                                            className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors"
                                            role="menuitem"
                                        >
                                            Status: Mark as Processing
                                        </button>
                                        <button
                                            onClick={() => handleSetStatus(selectedTicket.id, 'closed')}
                                            className="w-full text-left px-4 py-2.5 text-emerald-700 hover:bg-emerald-50 transition-colors"
                                            role="menuitem"
                                        >
                                            Status: Mark as Closed
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Messages Container */}
                    <div className="flex-1 min-h-[380px] max-h-[500px] overflow-hidden flex flex-col bg-slate-50/20">
                        <div
                            ref={messagesContainerRef}
                            onScroll={(e) => {
                                const el = e.currentTarget;
                                const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                                stickToBottomRef.current = distanceFromBottom < 80;
                            }}
                            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar"
                            tabIndex={0}
                            aria-label="Support chat messages"
                        >
                            {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                                selectedTicket.messages.map((m) => (
                                    <div
                                        key={m.id}
                                        className={cn('flex flex-col', m.isAdmin ? 'items-end' : 'items-start')}
                                    >
                                        <div
                                            className={cn(
                                                'max-w-[85%] sm:max-w-[70%] p-3.5 sm:p-4 rounded-2xl text-sm leading-relaxed shadow-sm',
                                                m.isAdmin
                                                    ? 'bg-slate-900 text-white rounded-tr-sm'
                                                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'
                                            )}
                                        >
                                            {m.mediaUrl && (
                                                <img
                                                    src={m.mediaUrl}
                                                    alt="Attachment"
                                                    loading="lazy"
                                                    className="max-w-[260px] w-full rounded-xl border border-black/10 mb-2"
                                                />
                                            )}
                                            {m.text && <div className="font-medium whitespace-pre-wrap">{m.text}</div>}
                                        </div>
                                        <span className="text-[10px] font-semibold text-slate-400 mt-1 px-1 tracking-wide">
                                            {m.time}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                                    No messages in this ticket yet.
                                </div>
                            )}
                        </div>

                        {/* Chat Reply Input Bar (Matching Given Image) */}
                        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 shrink-0">
                            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border-2 border-slate-300 focus-within:border-slate-800 transition-all shadow-sm">
                                <textarea
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendReply();
                                        }
                                    }}
                                    placeholder="Type your response here..."
                                    rows={1}
                                    className="flex-1 bg-transparent border-none outline-none p-2 sm:p-3 text-sm font-medium text-slate-800 resize-none min-h-[44px] max-h-[120px]"
                                />
                                <button
                                    onClick={handleSendReply}
                                    disabled={!reply.trim()}
                                    className="h-10 w-10 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 shrink-0"
                                    title="Send Message"
                                >
                                    <HiOutlinePaperAirplane className="h-5 w-5 -rotate-45 -mt-0.5 ml-0.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </Card>
            ) : (
                /* ── TICKETS TABLE VIEW ── */
                <Card
                    className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white"
                    contentClassName="p-0"
                >
                    {/* Table Filter / Search Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by customer, ID, or subject..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-slate-800 transition-all"
                            />
                        </div>

                        <div className="text-xs font-semibold text-slate-500 self-end sm:self-center">
                            Showing <span className="font-bold text-slate-900">{filteredTickets.length}</span> of{' '}
                            <span className="font-bold text-slate-900">{total || tickets.length}</span> tickets
                        </div>
                    </div>

                    {/* Table Content */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="py-3.5 px-4 w-8 text-center">Status</th>
                                    <th className="py-3.5 px-4">Customer</th>
                                    <th className="py-3.5 px-4">Subject & Query</th>
                                    <th className="py-3.5 px-4 whitespace-nowrap">Sent Time</th>
                                    <th className="py-3.5 px-4">Priority</th>
                                    <th className="py-3.5 px-4">Ticket Status</th>
                                    <th className="py-3.5 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {loading && tickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-slate-400">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                                                <span className="font-semibold text-xs">Loading support tickets...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredTickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-slate-400">
                                            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                            <p className="font-bold text-slate-600">No support tickets found</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                {searchTerm ? 'Try adjusting your search query' : 'Tickets submitted by customers will appear here.'}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTickets.map((t) => {
                                        const unread = isTicketUnread(t);
                                        const lastMsg = t.messages?.[t.messages?.length - 1];

                                        return (
                                            <tr
                                                key={t.id}
                                                onClick={() => handleSelectTicket(t)}
                                                className={cn(
                                                    'hover:bg-slate-50/80 transition-colors cursor-pointer group',
                                                    unread && 'bg-orange-50/20'
                                                )}
                                            >
                                                {/* Orange Unread Dot */}
                                                <td className="py-4 px-4 text-center">
                                                    {unread ? (
                                                        <span
                                                            className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50 ring-2 ring-orange-200 animate-pulse"
                                                            title="Unread message"
                                                        />
                                                    ) : (
                                                        <span className="inline-block w-2 h-2 rounded-full bg-slate-200" />
                                                    )}
                                                </td>

                                                {/* Customer Name */}
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-700 text-xs shrink-0">
                                                            {t.user?.charAt(0)?.toUpperCase() || 'C'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                                                                {t.user}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                                <span className="capitalize">{t.userType || 'Customer'}</span>
                                                                {t.userEmail && <span>• {t.userEmail}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Subject & Snippet */}
                                                <td className="py-4 px-4 max-w-xs">
                                                    <div className="font-semibold text-slate-800 truncate">
                                                        {t.subject || 'Support Query'}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                                        {lastMsg?.text || t.description || 'No message content'}
                                                    </div>
                                                </td>

                                                {/* Date & Time (Kb bheja) */}
                                                <td className="py-4 px-4 whitespace-nowrap text-[11px] font-semibold text-slate-500">
                                                    <div className="flex items-center gap-1.5">
                                                        <HiOutlineClock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                        <span>{t.date}</span>
                                                    </div>
                                                </td>

                                                {/* Priority */}
                                                <td className="py-4 px-4 whitespace-nowrap">
                                                    <span
                                                        className={cn(
                                                            'inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                                                            t.priority === 'high'
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : t.priority === 'medium'
                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                        )}
                                                    >
                                                        {t.priority || 'medium'}
                                                    </span>
                                                </td>

                                                {/* Ticket Status */}
                                                <td className="py-4 px-4 whitespace-nowrap">
                                                    <span
                                                        className={cn(
                                                            'inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                                                            t.status === 'closed'
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : t.status === 'processing'
                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        )}
                                                    >
                                                        {t.status || 'open'}
                                                    </span>
                                                </td>

                                                {/* Action */}
                                                <td className="py-4 px-4 text-right whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectTicket(t);
                                                        }}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-[11px] font-bold transition-all shadow-sm group-hover:scale-105"
                                                    >
                                                        <span>Open Chat</span>
                                                        <HiOutlineChevronRight className="h-3.5 w-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                        <Pagination
                            page={page}
                            totalPages={Math.ceil(total / pageSize) || 1}
                            total={total}
                            pageSize={pageSize}
                            onPageChange={(p) => fetchTickets(p)}
                            onPageSizeChange={(newSize) => {
                                setPageSize(newSize);
                                setPage(1);
                            }}
                            loading={loading}
                        />
                    </div>
                </Card>
            )}
        </div>
    );
};

export default SupportTickets;
