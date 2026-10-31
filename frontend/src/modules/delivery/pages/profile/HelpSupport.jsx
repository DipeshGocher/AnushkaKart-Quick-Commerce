import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MessageSquare,
  PhoneCall,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Headphones,
} from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useSettings } from "@core/context/SettingsContext";
import { useAuth } from "@core/context/AuthContext";
import axiosInstance from "@core/api/axios";
import { deliveryApi } from "../../services/deliveryApi";
import {
  joinTicketRoom,
  leaveTicketRoom,
  onTicketMessage,
} from "@/core/services/orderSocket";
import { getStoredAuthToken } from "@core/utils/authStorage";
import { STORAGE_KEYS } from "@core/utils/storage";

const ISSUE_CATEGORIES = [
  "Order Delivery Issue",
  "Payout / Cash Query",
  "App or GPS Glitch",
  "Customer Dispute",
  "Accident / Safety Help",
  "Other Assistance",
];

const DEFAULT_DELIVERY_FAQS = [
  {
    question: "How do I change my bank account details?",
    answer:
      "Go to Profile > Bank Account and submit your new IFSC, Account Number, and passbook/cheque photo. Our operations team will verify it within 24 hours.",
  },
  {
    question: "What if I can't find the customer's delivery location?",
    answer:
      "Use the in-app map navigation first. If you still cannot locate the door, use the 'Call Customer' button directly from the active order screen. If unanswered after 3 attempts, inform Admin via Chat Support.",
  },
  {
    question: "How is my delivery payout calculated?",
    answer:
      "Payouts include base fare + distance pay per kilometer + surge or peak incentives. You can view complete per-order fare breakdown anytime in the Earnings tab.",
  },
  {
    question: "What should I do in case of an accident or emergency?",
    answer:
      "Immediately open the Emergency & Safety page and hold the red SOS button for 1.5 seconds. Your exact GPS coordinates will be sent to Admin and our response team will dispatch help.",
  },
];

const HelpSupport = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { user } = useAuth();
  const supportPhone = settings?.supportPhone || settings?.phone || "18001234567";

  // Token getter for socket
  const getToken = useMemo(
    () => () => getStoredAuthToken(STORAGE_KEYS.AUTH_DELIVERY) || localStorage.getItem("token") || "",
    []
  );

  // FAQs State
  const [faqs, setFaqs] = useState([]);
  const [faqsLoading, setFaqsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [openIndex, setOpenIndex] = useState(null);

  // Tickets & Chat Modal State
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("new"); // "new" | "list"
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // New Ticket Form State
  const [category, setCategory] = useState(ISSUE_CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");

  const chatEndRef = useRef(null);

  // Fetch FAQs from backend
  const fetchFaqs = async () => {
    try {
      setFaqsLoading(true);
      const res = await axiosInstance.get("/public/faqs", {
        params: { category: "Delivery", status: "published" },
      });
      const data = res.data?.result ?? res.data;
      const list = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];

      if (list.length > 0) {
        setFaqs(list);
      } else {
        setFaqs(DEFAULT_DELIVERY_FAQS);
      }
    } catch {
      setFaqs(DEFAULT_DELIVERY_FAQS);
    } finally {
      setFaqsLoading(false);
    }
  };

  useEffect(() => {
    fetchFaqs();
  }, []);

  // Fetch Rider's Tickets
  const fetchMyTickets = async () => {
    try {
      setLoadingTickets(true);
      const res = await deliveryApi.getMyTickets();
      const list = Array.isArray(res.data?.results)
        ? res.data.results
        : Array.isArray(res.data?.result)
        ? res.data.result
        : Array.isArray(res.data)
        ? res.data
        : [];
      setTickets(list);

      // If active ticket is open, update it
      if (activeTicket?._id) {
        const updated = list.find((t) => t._id === activeTicket._id);
        if (updated) setActiveTicket(updated);
      }
    } catch {
      // Silent error handling
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (isTicketModalOpen) {
      fetchMyTickets();
    }
  }, [isTicketModalOpen]);

  // Join ticket room when active ticket is selected
  useEffect(() => {
    if (!activeTicket?._id) return;
    const tid = activeTicket._id;
    joinTicketRoom(tid, getToken);

    const unsubscribe = onTicketMessage(getToken, (payload) => {
      if (payload?.ticketId && String(payload.ticketId) === String(tid)) {
        setActiveTicket((prev) => {
          if (!prev || prev._id !== tid) return prev;
          const exists = prev.messages?.some(
            (m) => m._id === payload.message?._id || (m.createdAt === payload.message?.createdAt && m.text === payload.message?.text)
          );
          if (exists) return prev;
          return {
            ...prev,
            messages: [...(prev.messages || []), payload.message],
          };
        });
        // Also refresh list in background
        fetchMyTickets();
      }
    });

    return () => {
      leaveTicketRoom(tid, getToken);
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [activeTicket?._id]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTicket && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTicket?.messages]);

  // Handle direct call
  const handleCallSupport = () => {
    toast.success(`Calling Support Desk: ${supportPhone}`);
    window.location.href = `tel:${supportPhone}`;
  };

  // Open Chat modal
  const handleOpenChatModal = () => {
    setIsTicketModalOpen(true);
    if (tickets.length > 0) {
      setActiveTab("list");
    } else {
      setActiveTab("new");
    }
  };

  // Submit new ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    const finalSubject = subject.trim() || `${category} - ${user?.name || "Rider"}`;
    if (!description.trim()) {
      toast.error("Please explain your issue in the message box");
      return;
    }

    try {
      setSubmittingTicket(true);
      const res = await deliveryApi.createTicket({
        subject: finalSubject,
        description: description.trim(),
        priority,
        userType: "Delivery",
      });

      if (res.data?.success || res.status === 201 || res.status === 200) {
        toast.success("Ticket raised successfully! Admin alerted.");
        const createdTicket = res.data?.result || res.data?.data || res.data;
        setDescription("");
        setSubject("");
        await fetchMyTickets();
        if (createdTicket?._id) {
          setActiveTicket(createdTicket);
        } else {
          setActiveTab("list");
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create support ticket");
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Reply to ticket
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket?._id) return;

    try {
      setSendingReply(true);
      const textToSend = replyText.trim();
      setReplyText("");

      const res = await deliveryApi.replyToTicket(activeTicket._id, {
        text: textToSend,
        isAdmin: false,
      });

      if (res.data?.success || res.status === 200) {
        const updatedTicket = res.data?.result || res.data;
        if (updatedTicket?._id) {
          setActiveTicket(updatedTicket);
        }
        fetchMyTickets();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const q = searchQuery.toLowerCase().trim();
    return faqs.filter(
      (f) =>
        f.question?.toLowerCase().includes(q) ||
        f.answer?.toLowerCase().includes(q)
    );
  }, [faqs, searchQuery]);

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const getStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "open") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
          Open
        </span>
      );
    }
    if (s === "processing" || s === "in_progress") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
          In Progress
        </span>
      );
    }
    if (s === "closed" || s === "resolved") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
          Resolved
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#f1f4f8] pb-36 font-['Outfit',_sans-serif]">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="flex items-center p-4 max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="ds-h3 text-gray-900 leading-tight">Help & Support</h1>
            <p className="text-xs text-gray-500">Delivery partner assistance desk</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Support Channels Grid */}
        <section className="grid grid-cols-2 gap-4">
          {/* Chat Support Card */}
          <Card
            onClick={handleOpenChatModal}
            className="p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md active:scale-98 transition-all card-left-pill-orange bg-white relative overflow-hidden">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-2 border border-indigo-100/60 shadow-xs">
              <MessageSquare size={24} />
            </div>
            <h4 className="font-bold text-gray-900 text-sm">Chat Support</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {tickets.some((t) => String(t.status).toLowerCase() !== "closed")
                ? "Active ticket open"
                : "Raise ticket & chat"}
            </p>
            <span className="mt-2 text-[10px] font-bold text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-full">
              Tap to Open
            </span>
          </Card>

          {/* Call Support Card */}
          <Card
            onClick={handleCallSupport}
            className="p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md active:scale-98 transition-all card-left-pill-orange bg-white relative overflow-hidden">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-2 border border-emerald-100/60 shadow-xs">
              <PhoneCall size={24} />
            </div>
            <h4 className="font-bold text-gray-900 text-sm">Call Support</h4>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">{supportPhone}</p>
            <span className="mt-2 text-[10px] font-bold text-emerald-600 bg-emerald-50/80 px-2 py-0.5 rounded-full">
              1-Tap Dial
            </span>
          </Card>
        </section>

        {/* FAQs Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 flex items-center">
              <HelpCircle size={18} className="mr-2 text-primary" /> Frequently Asked Questions
            </h2>
            <button
              onClick={fetchFaqs}
              title="Refresh FAQs"
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full">
              <RefreshCw size={14} className={faqsLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rider questions & answers..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* FAQs Accordion */}
          {faqsLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-14 bg-white rounded-xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : filteredFaqs.length > 0 ? (
            <div className="space-y-2.5">
              {filteredFaqs.map((faq, index) => (
                <Card
                  key={faq._id || index}
                  className="overflow-hidden cursor-pointer card-left-pill-orange bg-white border border-gray-100 shadow-xs"
                  onClick={() => toggleAccordion(index)}>
                  <div className="p-3.5 flex justify-between items-center bg-white hover:bg-slate-50/60 transition-colors">
                    <h4 className="font-semibold text-gray-800 text-xs sm:text-sm pr-3 leading-snug">
                      {faq.question}
                    </h4>
                    {openIndex === index ? (
                      <ChevronUp size={16} className="text-primary shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400 shrink-0" />
                    )}
                  </div>
                  <AnimatePresence>
                    {openIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-slate-50/70 border-t border-slate-100">
                        <div className="p-3.5 text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center bg-white rounded-xl border border-gray-100 text-gray-400 text-xs">
              No matching questions found for &quot;{searchQuery}&quot;. Try a different keyword or tap Chat Support above.
            </div>
          )}
        </section>

        {/* Emergency Disclaimer Banner */}
        <div className="p-3.5 bg-rose-50/80 border border-rose-200/70 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
            <AlertCircle size={20} />
          </div>
          <div className="text-xs">
            <p className="font-bold text-rose-900">Life-Threatening Emergency?</p>
            <p className="text-rose-700 mt-0.5">
              Use the <span className="font-bold underline cursor-pointer" onClick={() => navigate("/delivery/profile/safety-privacy")}>Emergency & Safety SOS button</span> or dial 112 directly.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CHAT SUPPORT & TICKETS MODAL (z-[600] to overlay bottom bar) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isTicketModalOpen && (
          <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden">
              
              {/* Modal Top Bar */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                  {activeTicket ? (
                    <button
                      onClick={() => setActiveTicket(null)}
                      className="p-1 rounded-full hover:bg-gray-100 text-gray-500 mr-1">
                      <ArrowLeft size={18} />
                    </button>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Headphones size={18} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">
                      {activeTicket
                        ? `Ticket #${String(activeTicket._id).slice(-6).toUpperCase()}`
                        : "Rider Support & Tickets"}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      {activeTicket ? activeTicket.subject : "Admin Desk Direct Connected"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsTicketModalOpen(false);
                    setActiveTicket(null);
                  }}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Sub-Header Tabs (When not viewing a specific chat thread) */}
              {!activeTicket && (
                <div className="flex border-b border-gray-100 bg-slate-50/70 p-1.5 gap-1 shrink-0">
                  <button
                    onClick={() => setActiveTab("new")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                      activeTab === "new"
                        ? "bg-white text-primary shadow-xs"
                        : "text-gray-500 hover:text-gray-800"
                    }`}>
                    + Raise New Ticket
                  </button>
                  <button
                    onClick={() => setActiveTab("list")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === "list"
                        ? "bg-white text-primary shadow-xs"
                        : "text-gray-500 hover:text-gray-800"
                    }`}>
                    <span>My Tickets</span>
                    {tickets.length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
                        {tickets.length}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* 1. TICKET CHAT THREAD VIEW */}
                {activeTicket ? (
                  <div className="space-y-4">
                    {/* Ticket Status Bar */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-gray-400 mr-1">Status:</span>
                        {getStatusBadge(activeTicket.status)}
                      </div>
                      <span className="text-[11px] text-gray-400">
                        Priority: <strong className="text-gray-700 capitalize">{activeTicket.priority || "Normal"}</strong>
                      </span>
                    </div>

                    {/* Messages Container */}
                    <div className="space-y-3 min-h-[220px]">
                      {activeTicket.messages && activeTicket.messages.length > 0 ? (
                        activeTicket.messages.map((m, idx) => {
                          const isAdmin = m.isAdmin || m.senderType === "Admin";
                          return (
                            <div
                              key={m._id || idx}
                              className={`flex flex-col ${isAdmin ? "items-start" : "items-end"}`}>
                              <div className="flex items-center gap-1 mb-1 px-1">
                                <span className="text-[10px] font-bold text-gray-500">
                                  {isAdmin ? "Admin Desk" : "You (Rider)"}
                                </span>
                                <span className="text-[9px] text-gray-400">
                                  {m.createdAt
                                    ? new Date(m.createdAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : ""}
                                </span>
                              </div>
                              <div
                                className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-2xs ${
                                  isAdmin
                                    ? "bg-white border border-gray-200 text-gray-800 rounded-tl-xs"
                                    : "bg-primary text-white rounded-tr-xs"
                                }`}>
                                {m.text}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-xs text-gray-400">
                          Ticket opened. An admin will respond shortly.
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </div>
                ) : activeTab === "new" ? (
                  /* 2. RAISE NEW TICKET FORM */
                  <form onSubmit={handleCreateTicket} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Issue Category
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {ISSUE_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setCategory(cat);
                              if (!subject) setSubject(cat);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                              category === cat
                                ? "bg-primary text-white shadow-xs font-bold"
                                : "bg-slate-100 text-gray-600 hover:bg-slate-200"
                            }`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Subject / Brief Title
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder={`e.g. ${category}`}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Priority Level
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "low", label: "Low" },
                          { id: "medium", label: "Medium" },
                          { id: "urgent", label: "Urgent" },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPriority(p.id)}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                              priority === p.id
                                ? p.id === "urgent"
                                  ? "bg-rose-50 border-rose-300 text-rose-700 font-extrabold"
                                  : "bg-primary/10 border-primary text-primary"
                                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Describe What Happened
                      </label>
                      <textarea
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Explain the order number, customer issue, or payout question in detail..."
                        className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submittingTicket}
                      className="w-full py-3 rounded-xl bg-primary text-white font-bold text-xs shadow-md shadow-primary/20 hover:opacity-95 flex items-center justify-center gap-2">
                      {submittingTicket ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" /> Submitting Ticket...
                        </>
                      ) : (
                        <>
                          <Send size={14} /> Send Alert to Admin
                        </>
                      )}
                    </Button>
                  </form>
                ) : (
                  /* 3. MY TICKETS LIST */
                  <div className="space-y-3">
                    {loadingTickets ? (
                      <div className="space-y-2 py-4">
                        {[1, 2].map((n) => (
                          <div key={n} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : tickets.length > 0 ? (
                      tickets.map((t) => (
                        <div
                          key={t._id}
                          onClick={() => setActiveTicket(t)}
                          className="p-3.5 bg-white border border-gray-200 rounded-2xl hover:border-primary/50 cursor-pointer shadow-xs transition-all space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-gray-900">
                              #{String(t._id).slice(-6).toUpperCase()}
                            </span>
                            {getStatusBadge(t.status)}
                          </div>
                          <p className="text-xs font-semibold text-gray-800 line-clamp-1">{t.subject}</p>
                          <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-50 pt-2">
                            <span>
                              {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ""}
                            </span>
                            <span className="text-primary font-bold">
                              {t.messages?.length || 0} messages • View Chat →
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-gray-400 space-y-2">
                        <MessageSquare size={32} className="mx-auto text-gray-300" />
                        <p className="text-xs">No support tickets raised yet.</p>
                        <Button
                          variant="ghost"
                          onClick={() => setActiveTab("new")}
                          className="text-primary text-xs font-bold">
                          + Raise Your First Ticket
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chat Input Bar (Only when chat thread is active) */}
              {activeTicket && (
                <div className="p-3 border-t border-gray-100 bg-white shrink-0">
                  {String(activeTicket.status).toLowerCase() === "closed" ? (
                    <div className="p-2.5 bg-gray-50 rounded-xl text-center text-xs text-gray-500 font-medium">
                      This ticket has been marked resolved by Admin.
                    </div>
                  ) : (
                    <form onSubmit={handleSendReply} className="flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type reply to Admin..."
                        className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <button
                        type="submit"
                        disabled={sendingReply || !replyText.trim()}
                        className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center disabled:opacity-50 hover:opacity-95 transition-all shadow-xs">
                        <Send size={16} />
                      </button>
                    </form>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HelpSupport;
