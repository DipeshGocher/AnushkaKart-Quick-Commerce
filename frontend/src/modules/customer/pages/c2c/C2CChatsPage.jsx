import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Send, Phone, Tag, ShieldCheck, 
  CheckCheck, MessageSquare, ChevronRight, Sparkles, User, ExternalLink,
  MoreVertical, Pin, PinOff, Star, StarOff, Check, BellOff
} from 'lucide-react';
import { getC2CChats, sendC2CMessage } from '../../data/c2cMockData';
import { toast } from 'sonner';

// ── helpers ──────────────────────────────────────────────────────────────────
const saveChats = (updated) => {
  localStorage.setItem('c2c_marketplace_chats', JSON.stringify(updated));
  window.dispatchEvent(new Event('c2c_chats_updated'));
};

// ── component ────────────────────────────────────────────────────────────────
const C2CChatsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedChatId = searchParams.get('id');

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [chatFilter, setChatFilter] = useState('all'); // 'all' | 'unread' | 'important'
  const [chatTypeTab, setChatTypeTab] = useState('buying'); // 'buying' | 'selling'
  const [menuOpenChatId, setMenuOpenChatId] = useState(null); // three-dots menu
  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);

  // ── close three-dot menu when clicking outside ──
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenChatId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── load chats ──
  const handleSelectChat = useCallback((chatId) => {
    setActiveChatId(chatId);
    const loaded = getC2CChats();
    const updated = loaded.map(c => c.id === chatId ? { ...c, unread: false } : c);
    saveChats(updated);
    setChats(updated);
  }, []);

  const handleMarkAllRead = () => {
    const loaded = getC2CChats();
    const updated = loaded.map(c => ({ ...c, unread: false }));
    saveChats(updated);
    setChats(updated);
  };

  useEffect(() => {
    const loaded = getC2CChats();
    setChats(loaded);
    let targetId = null;
    if (requestedChatId && loaded.some(c => c.id === requestedChatId)) {
      targetId = requestedChatId;
    } else if (window.innerWidth >= 768 && loaded.length > 0) {
      targetId = loaded[0].id;
    }
    if (targetId) handleSelectChat(targetId);
  }, [requestedChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatId, chats]);

  // ── pin / important handlers ──
  const togglePinChat = (e, chatId) => {
    e.stopPropagation();
    const loaded = getC2CChats();
    const updated = loaded.map(c =>
      c.id === chatId ? { ...c, isPinned: !c.isPinned } : c
    );
    saveChats(updated);
    setChats(updated);
    const chat = updated.find(c => c.id === chatId);
    toast.success(chat?.isPinned ? 'Chat pinned to top' : 'Chat unpinned');
    setMenuOpenChatId(null);
  };

  const toggleImportantChat = (e, chatId) => {
    e.stopPropagation();
    const loaded = getC2CChats();
    const updated = loaded.map(c =>
      c.id === chatId ? { ...c, isImportant: !c.isImportant } : c
    );
    saveChats(updated);
    setChats(updated);
    const chat = updated.find(c => c.id === chatId);
    toast.success(chat?.isImportant ? 'Marked as important' : 'Removed from important');
    setMenuOpenChatId(null);
  };

  const toggleReadChat = (e, chatId) => {
    e.stopPropagation();
    const loaded = getC2CChats();
    const chat = loaded.find(c => c.id === chatId);
    const updated = loaded.map(c =>
      c.id === chatId ? { ...c, unread: !c.unread } : c
    );
    saveChats(updated);
    setChats(updated);
    toast.success(chat?.unread ? 'Marked as read' : 'Marked as unread');
    setMenuOpenChatId(null);
  };

  // ── filtered + sorted chats ──
  const filteredChats = useMemo(() => {
    // Step 1: filter by Buying / Selling type
    let list = chats.filter(c => (c.type || 'buying') === chatTypeTab);
    // Step 2: apply All / Unread / Important filter
    if (chatFilter === 'unread') {
      list = list.filter(c => c.unread === true || Number(c.unread) > 0);
    } else if (chatFilter === 'important') {
      list = list.filter(c => c.isImportant);
    }
    // Pinned always floats to top
    return list.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  }, [chats, chatFilter, chatTypeTab]);

  const activeChat = chats.find(c => c.id === activeChatId);

  // ── send message ──
  const handleSendMessage = (textToSend = null, isOffer = false, amount = null) => {
    const text = textToSend || inputText;
    if (!text?.trim() || !activeChatId) return;
    const updated = sendC2CMessage(activeChatId, text.trim(), isOffer, amount);
    setChats(updated);
    setInputText('');
    if (!isOffer && Math.random() > 0.3) {
      setTimeout(() => {
        const replies = [
          'Yes, it is available in perfect working condition. Let me know when you would like to test it.',
          'Price is slightly negotiable if you can pick it up today.',
          'Yes, original bill and box are included with the device.',
          'Sure! We can meet in Vijay Nagar near C21 Mall.',
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        const chatsCurrent = getC2CChats();
        const cur = chatsCurrent.find(c => c.id === activeChatId);
        if (cur) {
          cur.messages.push({ id: `reply-${Date.now()}`, sender: 'seller', text: randomReply, time: 'Just now' });
          cur.lastMessage = randomReply;
          cur.lastMessageTime = 'Just now';
          localStorage.setItem('c2c_marketplace_chats', JSON.stringify(chatsCurrent));
          setChats([...chatsCurrent]);
        }
      }, 1200);
    }
  };

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'important', label: 'Important' },
  ];

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-20 text-slate-900 font-sans">

      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => activeChatId ? setActiveChatId(null) : navigate(-1)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <MessageSquare size={19} className="text-[#0F4C81]" />
              All Chats
            </h1>
          </div>
          <span className="text-xs font-bold bg-blue-50 px-2.5 py-1 rounded-full text-[#0F4C81] border border-[#0F4C81]/20">
            {chats.length} active
          </span>
        </div>

        {/* ── Buying / Selling Tab Bar ── */}
        <div className="flex border-t border-slate-100">
          {[{ id: 'buying', label: 'Buying' }, { id: 'selling', label: 'Selling' }].map(tab => {
            const count = chats.filter(c => (c.type || 'buying') === tab.id).length;
            const isActive = chatTypeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setChatTypeTab(tab.id); setActiveChatId(null); }}
                className={`flex-1 py-2.5 text-sm font-bold transition-colors relative ${
                  isActive
                    ? 'text-[#0F4C81]'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-[#0F4C81]/10 text-[#0F4C81]' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {count}
                  </span>
                )}
                {/* Underline indicator */}
                {isActive && (
                  <span className="absolute bottom-0 left-6 right-6 h-[2.5px] rounded-full bg-[#0F4C81]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-2 sm:p-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col md:flex-row h-[80vh] min-h-[520px]">

          {/* ── Chat List Sidebar ── */}
          <div className={`w-full md:w-[340px] md:border-r border-slate-200 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>

            {/* Conversations count + Mark all read */}
            <div className="px-4 pt-4 pb-2 bg-white border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                Conversations ({filteredChats.length})
              </span>
              {chats.some(c => c.unread) && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-bold text-[#0F4C81] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* ── Filter Pills ── */}
            <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center gap-2">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setChatFilter(f.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    chatFilter === f.id
                      ? 'bg-[#0F4C81] text-white shadow-sm shadow-[#0F4C81]/30'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                  {f.id === 'unread' && chats.filter(c => c.unread === true || Number(c.unread) > 0).length > 0 && (
                    <span className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                      chatFilter === 'unread' ? 'bg-white/30 text-white' : 'bg-[#0F4C81]/10 text-[#0F4C81]'
                    }`}>
                      {chats.filter(c => c.unread === true || Number(c.unread) > 0).length}
                    </span>
                  )}
                  {f.id === 'important' && chats.filter(c => c.isImportant).length > 0 && (
                    <span className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                      chatFilter === 'important' ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {chats.filter(c => c.isImportant).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Chat List ── */}
            <div className="flex-1 overflow-y-auto py-2 space-y-0">
              {filteredChats.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {chatFilter === 'unread' && `No unread ${chatTypeTab} chats.`}
                  {chatFilter === 'important' && 'No important chats yet. Use the ⋮ menu to mark important.'}
                  {chatFilter === 'all' && chatTypeTab === 'buying' && 'No buying chats yet. Tap Chat on any product to start!'}
                  {chatFilter === 'all' && chatTypeTab === 'selling' && 'No selling chats yet. Buyers will appear here when they contact you.'}
                </div>
              ) : (
                filteredChats.map((c) => {
                  const isSelected = c.id === activeChatId;
                  const isMenuOpen = menuOpenChatId === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`relative border-b transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#0F4C81]/20 bg-blue-50/70'
                          : c.isPinned
                          ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50'
                          : 'border-slate-100 bg-white hover:bg-slate-50'
                      }`}
                      onClick={() => handleSelectChat(c.id)}
                    >
                      {/* Pinned indicator strip */}
                      {c.isPinned && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-400" />
                      )}
                      {/* Selected left bar */}
                      {isSelected && (
                        <div className="absolute top-0 left-0 bottom-0 w-[3px] bg-[#0F4C81]" />
                      )}

                      <div className="p-4 flex items-start gap-3.5">
                        {/* Ad Image + Seller Avatar */}
                        <div className="relative shrink-0">
                          <img
                            src={c.adImage}
                            alt={c.adTitle}
                            className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
                          />
                          <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full overflow-hidden border-2 border-white shadow-sm">
                            <img src={c.sellerAvatar} alt={c.sellerName} className="w-full h-full object-cover" />
                          </div>
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h4 className="text-sm font-black text-slate-900 truncate">
                                {c.sellerName}
                              </h4>
                              {c.isPinned && (
                                <Pin size={11} className="text-amber-500 shrink-0" />
                              )}
                              {c.isImportant && (
                                <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-semibold shrink-0 ml-1">
                              {c.lastMessageTime}
                            </span>
                          </div>

                          <p className="text-[12px] font-bold text-[#0F4C81] truncate mb-1">
                            {c.adTitle}
                          </p>

                          <p className="text-[12px] text-slate-500 truncate font-medium leading-snug">
                            {c.lastMessage}
                          </p>
                        </div>

                        {/* Right column: unread dot + three dots */}
                        <div className="flex flex-col items-end gap-2 shrink-0 ml-1">
                          {/* Unread badge */}
                          {(c.unread === true || Number(c.unread) > 0) ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-[#0F4C81] shrink-0 mt-1" />
                          ) : (
                            <span className="w-2.5 h-2.5 shrink-0 mt-1" />
                          )}

                          {/* Three-dots button */}
                          <div className="relative" ref={isMenuOpen ? menuRef : null}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenChatId(isMenuOpen ? null : c.id);
                              }}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              aria-label="Chat options"
                            >
                              <MoreVertical size={15} />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                className="absolute right-0 top-8 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 w-48 text-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => togglePinChat(e, c.id)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-slate-700 font-semibold transition-colors text-left"
                                >
                                  {c.isPinned ? (
                                    <><PinOff size={14} className="text-slate-500" /> Unpin Chat</>
                                  ) : (
                                    <><Pin size={14} className="text-amber-500" /> Pin Chat</>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => toggleImportantChat(e, c.id)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-slate-700 font-semibold transition-colors text-left"
                                >
                                  {c.isImportant ? (
                                    <><StarOff size={14} className="text-slate-400" /> Remove Important</>
                                  ) : (
                                    <><Star size={14} className="text-amber-400" /> Mark as Important</>
                                  )}
                                </button>
                                <div className="border-t border-slate-100 my-1" />
                                <button
                                  type="button"
                                  onClick={(e) => toggleReadChat(e, c.id)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-slate-700 font-semibold transition-colors text-left"
                                >
                                  {(c.unread === true || Number(c.unread) > 0) ? (
                                    <><Check size={14} className="text-emerald-500" /> Mark as Read</>
                                  ) : (
                                    <><BellOff size={14} className="text-slate-400" /> Mark as Unread</>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Active Chat Conversation Area ── */}
          <div className={`flex-1 flex flex-col bg-slate-50/50 ${activeChatId ? 'flex' : 'hidden md:flex'}`}>
            {activeChat ? (
              <>
                {/* Active Chat Header */}
                <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={activeChat.sellerAvatar}
                      alt={activeChat.sellerName}
                      className="w-10 h-10 rounded-full object-cover border border-[#0F4C81]/30"
                    />
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 leading-tight flex items-center gap-1.5">
                        {activeChat.sellerName}
                        <ShieldCheck size={14} className="text-[#0F4C81]" />
                      </h3>
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Online • Verified Seller
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${activeChat.sellerPhone?.replace(/\s+/g, '') || '9826012345'}`}
                      className="h-8 px-3 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 flex items-center gap-1 hover:bg-emerald-100 transition-colors"
                    >
                      <Phone size={13} />
                      Call
                    </a>
                  </div>
                </div>

                {/* Sticky Ad Snippet Top Bar */}
                <div 
                  onClick={() => navigate(`/marketplace/product/${activeChat.adId}`)}
                  className="bg-blue-50/80 px-3.5 py-2 border-b border-[#0F4C81]/20 flex items-center justify-between cursor-pointer hover:bg-blue-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={activeChat.adImage}
                      alt={activeChat.adTitle}
                      className="w-9 h-9 rounded-lg object-cover shrink-0 border border-[#0F4C81]/30"
                    />
                    <div className="truncate">
                      <p className="text-xs font-extrabold text-slate-900 truncate">
                        {activeChat.adTitle}
                      </p>
                      <p className="text-[11px] font-black text-[#0F4C81]">
                        ₹{activeChat.adPrice?.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#0F4C81] flex items-center gap-0.5 shrink-0">
                    View Ad <ExternalLink size={11} />
                  </span>
                </div>

                {/* Message Stream */}
                <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5">
                  <div className="text-center my-2">
                    <span className="bg-slate-200/70 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Direct End-to-End Chat
                    </span>
                  </div>

                  {activeChat.messages.map((m) => {
                    const isMe = m.sender === 'me';
                    return (
                      <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {m.isOffer ? (
                          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 max-w-[85%] shadow-xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1 mb-1">
                              <Tag size={12} /> Special Bargain Offer
                            </span>
                            <p className="text-base font-black text-slate-900 mb-0.5">
                              Offer: ₹{m.amount?.toLocaleString('en-IN')}
                            </p>
                            <p className="text-xs text-slate-700 font-medium">{m.text}</p>
                            <span className="text-[9px] text-amber-700 font-semibold block text-right mt-1">
                              {m.time}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs font-medium leading-relaxed shadow-2xs ${
                              isMe
                                ? 'bg-[#0F4C81] text-white rounded-tr-xs'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                            }`}
                          >
                            <p>{m.text}</p>
                            <span className={`text-[9px] block text-right mt-1 ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                              {m.time}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Reply Chips */}
                <div className="p-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    'Is this still available?',
                    'What is your final best price?',
                    'Can we meet today?',
                    'Bill and box available?'
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSendMessage(chip)}
                      className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 text-[11px] font-semibold text-slate-700 hover:text-[#0F4C81] shrink-0 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Message Input Bar */}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                  className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your message or counter-offer..."
                    className="flex-1 h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/20 text-xs font-medium outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="w-11 h-11 rounded-xl bg-[#0F4C81] hover:bg-[#0A365C] disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-md shadow-[#0F4C81]/30 transition-all active:scale-95"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <MessageSquare size={48} className="text-slate-300 mb-2" />
                <h4 className="text-sm font-bold text-slate-700">Select a conversation</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Chat directly with sellers, negotiate pricing, and arrange safe pick-ups.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default C2CChatsPage;
