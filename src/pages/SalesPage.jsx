import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import CRMManager from "../components/CRMManager.jsx";
import PaginationControls from "../components/PaginationControls.jsx";
import { getPaginationMeta } from "../utils/pagination.js";
import {
  Activity,
  LogOut,
  MessageCircle,
  Wallet
} from "lucide-react";
import { hasModule } from "../utils/planAccess.js";

function SessionStatusBadge({ status }) {
  const styles = {
    active: "bg-emerald-50 text-emerald-600 border-emerald-100",
    queued: "bg-amber-50 text-amber-600 border-amber-100",
    closed: "bg-slate-100 text-slate-500 border-slate-200"
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${styles[status] || styles.closed}`}>
      {status || "unknown"}
    </span>
  );
}

function SalesChatsPanel() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api("/api/chat/sessions");
        if (!cancelled) {
          setSessions(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load sales chats");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400">
        <p className="text-[10px] font-black uppercase tracking-widest">Loading assigned chats...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-3xl bg-red-50 border border-red-100 text-red-600">
        <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400">
        <Activity size={40} className="mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-slate-600">No active sales chats</h2>
        <p className="text-sm mt-2">Only chats assigned to this sales user appear here.</p>
      </div>
    );
  }

  const paginatedSessions = getPaginationMeta(sessions, page);

  return (
    <div className="space-y-4">
      {paginatedSessions.pageItems.map((session) => (
        <div key={session._id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <MessageCircle size={16} className="text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {session.websiteId?.websiteName || "Website"}
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                {session.visitorId?.name || "Anonymous visitor"}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 break-all">
                {session.visitorId?.email || session.visitorId?.visitorId || "No visitor contact"}
              </p>
              <p className="text-[11px] font-medium text-slate-600 line-clamp-2">
                {session.lastMessagePreview || "No preview available yet."}
              </p>
            </div>
            <div className="text-right space-y-2 shrink-0">
              <SessionStatusBadge status={session.status} />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {new Date(session.updatedAt || session.createdAt).toLocaleDateString()}
              </p>
              <p className="text-[9px] font-bold text-slate-400">
                {new Date(session.updatedAt || session.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        </div>
      ))}
      <PaginationControls
        currentPage={paginatedSessions.currentPage}
        totalPages={paginatedSessions.totalPages}
        totalItems={paginatedSessions.totalItems}
        itemLabel="sales chats"
        onPageChange={setPage}
      />
    </div>
  );
}

export default function SalesPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("pipeline");
  const canUseCRM = hasModule(user, "crm");

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden">
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 rounded-r-3xl my-2 shadow-[20px_0_40px_-15px_rgba(0,0,0,0.1)] relative z-20">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            <h1 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Sales <span className="text-white">Command</span>
            </h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-1">
          {canUseCRM ? (
            <button
              onClick={() => setActiveTab("pipeline")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-xs font-bold ${
                activeTab === "pipeline"
                  ? "bg-emerald-600/10 text-emerald-400 border border-emerald-500/20"
                  : "hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Wallet size={16} />
              Pipeline
            </button>
          ) : null}

          <button
            onClick={() => setActiveTab("chats")}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-xs font-bold ${
              activeTab === "chats"
                ? "bg-emerald-600/10 text-emerald-400 border border-emerald-500/20"
                : "hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Activity size={16} />
            Active Sales Chats
          </button>
        </div>

        <div className="p-4 mt-auto">
          <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50 mb-4 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center font-black text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/20">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.name}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1">Sales Exec</p>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-slate-800/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 font-bold transition-all border border-transparent hover:border-red-500/20 text-[10px] uppercase tracking-widest"
          >
            <LogOut size={14} />
            Output
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto w-full">
          {activeTab === "pipeline" && canUseCRM ? <CRMManager /> : null}
          {activeTab === "pipeline" && !canUseCRM ? (
            <div className="rounded-[40px] border border-emerald-100 bg-emerald-50 p-12 text-center">
              <h3 className="text-lg font-black text-emerald-900 uppercase tracking-tight">Pro plan required</h3>
              <p className="mt-3 text-sm font-bold text-emerald-700">This sales account can only use CRM when the client is on the Pro plan.</p>
            </div>
          ) : null}
          {activeTab === "chats" && <SalesChatsPanel />}
        </div>
      </div>
    </div>
  );
}
