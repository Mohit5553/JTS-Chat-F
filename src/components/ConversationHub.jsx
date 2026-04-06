import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, MessageSquare, Clock, Globe, Shield, ChevronRight } from "lucide-react";
import ChatPanel from "./ChatPanel.jsx";
import TicketConversionModal from "./TicketConversionModal.jsx";
import { api } from "../api/client.js";

export default function ConversationHub({ socket, initialSessions = [], websiteId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState(initialSessions);
  const selectedSessionId = searchParams.get("sessionId") || "";
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [sessionToConvert, setSessionToConvert] = useState(null);
  const activeRequestRef = useRef(""); 

  const selectedSession = useMemo(() => 
    sessions.find(s => s.sessionId === selectedSessionId), 
    [sessions, selectedSessionId]
  );

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    setMessages([]); // Clear previous session messages immediately

    if (!selectedSessionId) {
      return;
    }

    setLoadingMessages(true);
    activeRequestRef.current = selectedSessionId;
    
    api(`/api/chat/sessions/${selectedSessionId}/messages`)
      .then(data => {
        // Prevent session leakage: only update if this request still matches active selection
        if (activeRequestRef.current === selectedSessionId) {
          setMessages(data);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (activeRequestRef.current === selectedSessionId) {
          setLoadingMessages(false);
        }
      });

    if (socket) {
      socket.emit("agent:join-session", { sessionId: selectedSessionId });
    }
  }, [selectedSessionId, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (payload) => {
      // Use currentSelectedId from ref to ensure we're matching against latest UI state
      if (payload.sessionId === activeRequestRef.current) {
        setMessages(prev => {
           const exists = prev.some(m => m._id === payload._id || (m.createdAt === payload.createdAt && m.message === payload.message));
           if (exists) return prev;
           return [...prev, payload];
        });
      }
      
      setSessions(prev => prev.map(s => 
        s.sessionId === payload.sessionId 
          ? { ...s, lastMessagePreview: payload.message, updatedAt: new Date() }
          : s
      ));
    };

    const handleSessionUpdated = (session) => {
      setSessions((prev) => {
        const exists = prev.some((s) => s.sessionId === session.sessionId);
        if (!exists) return [session, ...prev];
        return prev.map((s) => (s.sessionId === session.sessionId ? { ...s, ...session } : s));
      });
    };

    const handleClosed = ({ sessionId }) => {
      setSessions((prev) => prev.map((s) => (
        s.sessionId === sessionId ? { ...s, status: "closed", closedAt: new Date().toISOString() } : s
      )));
    };

    const handleAssigned = ({ sessionId }) => {
      setSessions((prev) => prev.map((s) => (
        s.sessionId === sessionId ? { ...s, status: "active" } : s
      )));
    };

    const handleQueued = (data = {}) => {
      const sessionId = data.sessionId || selectedSessionId;
      if (!sessionId) return;
      setSessions((prev) => prev.map((s) => (
        s.sessionId === sessionId ? { ...s, status: "queued" } : s
      )));
    };

    socket.on("chat:message", handleNewMessage);
    socket.on("chat:new-message", handleNewMessage);
    socket.on("chat:session-updated", handleSessionUpdated);
    socket.on("chat:closed", handleClosed);
    socket.on("chat:assigned", handleAssigned);
    socket.on("chat:queued", handleQueued);

    return () => {
      socket.off("chat:message", handleNewMessage);
      socket.off("chat:new-message", handleNewMessage);
      socket.off("chat:session-updated", handleSessionUpdated);
      socket.off("chat:closed", handleClosed);
      socket.off("chat:assigned", handleAssigned);
      socket.off("chat:queued", handleQueued);
    };
  }, [socket, selectedSessionId]);

  const handleSend = (payload) => {
    if (!socket || !selectedSessionId) return;
    socket.emit("agent:message", { 
      sessionId: selectedSessionId, 
      message: payload.text,
      attachmentUrl: payload.attachmentUrl,
      attachmentType: payload.attachmentType
    });
  };

  const filteredSessions = sessions.filter(s => {
    const matchesWebsite = !websiteId || (s.websiteId?._id === websiteId || s.websiteId === websiteId);
    const matchesSearch = !searchTerm || 
      s.websiteId?.websiteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.visitorId?.visitorId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesWebsite && matchesSearch;
  });

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-180px)] min-h-[600px] animate-in slide-in-from-bottom-4 duration-700">
      {/* Session Sidebar */}
      <div className="lg:col-span-4 premium-card p-0 flex flex-col border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden transition-colors">
        <div className="p-8 border-b border-slate-50 dark:border-white/5 space-y-5 bg-slate-50/20 dark:bg-black/10">
           <div className="flex flex-col gap-1.5">
              <h3 className="heading-md dark:text-white">Active Streams</h3>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                 <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.2em]">{sessions.length} Live Connections</span>
              </div>
           </div>
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
              <input 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 placeholder="Filter frequency spectrum..."
                 className="w-full bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl pl-10 pr-4 py-3.5 text-[11px] font-black focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-800 dark:text-white uppercase tracking-wider"
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/10 dark:bg-black/5 custom-scrollbar">
           {filteredSessions.map(session => (
              <div 
                 key={session._id}
                 onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set("sessionId", session.sessionId);
                    setSearchParams(params);
                 }}
                 className={`p-5 rounded-[24px] border transition-all duration-500 cursor-pointer relative overflow-hidden group ${
                    selectedSessionId === session.sessionId
                      ? "bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-500/30 shadow-2xl translate-x-1"
                      : "bg-white/50 dark:bg-white/5 border-slate-50 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10"
                 }`}
              >
                 <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between">
                       <strong className={`text-[10px] font-black tracking-[0.15em] block uppercase transition-colors shrink-0 ${selectedSessionId === session.sessionId ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-200'}`}>
                          {session.websiteId?.websiteName || 'Global Source'}
                       </strong>
                       <div className="flex items-center gap-2">
                         {session.unreadCount > 0 ? (
                           <span className="rounded-md bg-rose-500 px-2 py-0.5 text-[8px] font-black text-white">{session.unreadCount}</span>
                         ) : null}
                         <span className={`text-[8px] font-black px-2 py-0.5 rounded-md ${selectedSessionId === session.sessionId ? 'bg-indigo-600 text-white' : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/5'}`}>
                            {new Date(session.updatedAt || session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] transition-all ${selectedSessionId === session.sessionId ? 'bg-indigo-600 text-white shadow-lg rotate-3' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                          {(session.visitorId?.visitorId || 'AN').slice(0, 2).toUpperCase()}
                       </div>
                       <div className="flex-1 min-w-0">
                          <span className="text-[10px] text-slate-900 dark:text-slate-300 font-black tracking-widest uppercase truncate block">
                             {session.visitorId?.visitorId || 'Anonymous User'}
                          </span>
                          {session.lastMessagePreview ? (
                             <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 opacity-80 font-bold mt-0.5">
                               {session.lastMessagePreview}
                             </p>
                          ) : (
                             <span className="text-[9px] text-slate-300 dark:text-slate-700 font-bold uppercase tracking-widest">Waiting for signal...</span>
                          )}
                          {session.currentPage ? (
                            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-700">
                              {session.currentPage}
                            </p>
                          ) : null}
                       </div>
                       <ChevronRight size={14} className={`text-slate-200 dark:text-slate-800 group-hover:text-indigo-500 transition-colors ${selectedSessionId === session.sessionId ? 'opacity-0' : ''}`} />
                    </div>
                 </div>
                 {selectedSessionId === session.sessionId && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600 dark:bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]" />
                 )}
              </div>
           ))}
           {filteredSessions.length === 0 && (
              <div className="text-center py-24 text-slate-300 dark:text-slate-800 flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
                 <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center shadow-inner">
                    <MessageSquare size={32} strokeWidth={1.5} />
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600">Zero active transmissions</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-300 dark:text-slate-800">Stand by for incoming signals...</p>
                 </div>
              </div>
           )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="lg:col-span-8 h-full bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border border-slate-50 dark:border-white/5">
         <ChatPanel 
           session={selectedSession} 
           messages={messages} 
           onSend={handleSend}
           onTyping={(isTyping) => socket?.emit("agent:typing", { sessionId: selectedSessionId, isTyping })}
           onConvertToTicket={(s) => {
             setSessionToConvert(s);
             setShowTicketModal(true);
           }}
         />
      </div>

      {showTicketModal && sessionToConvert && (
        <TicketConversionModal 
          session={sessionToConvert}
          onClose={() => {
            setShowTicketModal(false);
            setSessionToConvert(null);
          }}
          onSuccess={() => {
            setShowTicketModal(false);
            setSessionToConvert(null);
            alert("Ticket created successfully! View it in the Tickets tab.");
          }}
        />
      )}
    </section>
  );
}
