import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import CRMManager from "../components/CRMManager.jsx";
import PaginationControls from "../components/PaginationControls.jsx";
import Layout from "../components/Layout.jsx";
import { getPaginationMeta } from "../utils/pagination.js";
import {
  Activity,
  MessageCircle,
  FileText,
  CheckSquare
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
    <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-700">
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
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "pipeline";
  const canUseCRM = hasModule(user, "crm");

  const menuItems = [
    { label: "Pipeline", href: "/sales" },
    { label: "Tasks", href: "/sales?tab=tasks" },
    { label: "Notes", href: "/sales?tab=notes" },
    { label: "Chats", href: "/sales?tab=chats" }
  ];

  if (!canUseCRM && activeTab === "pipeline") {
    return (
      <Layout menuItems={menuItems} title="Plan Upgrade Required" subtitle="CRM is available on Pro only">
        <div className="rounded-[40px] border border-emerald-100 bg-emerald-50 p-12 text-center">
          <h3 className="text-lg font-black text-emerald-900 uppercase tracking-tight">Pro plan required</h3>
          <p className="mt-3 text-sm font-bold text-emerald-700">This sales account can only use CRM when the client is on the Pro plan.</p>
        </div>
      </Layout>
    );
  }

  if (activeTab === "chats") {
    return (
      <Layout menuItems={menuItems} title="Sales Chats" subtitle="Manage your assigned visitor conversations">
         <SalesChatsPanel />
      </Layout>
    );
  }

  if (activeTab === "tasks") {
    return (
      <Layout menuItems={menuItems} title="My Tasks" subtitle="Follow-ups and scheduled activities">
        <div className="p-12 mt-10 max-w-2xl mx-auto rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50 text-center flex flex-col items-center justify-center space-y-4">
           <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center border border-slate-100">
             <CheckSquare size={24} className="text-indigo-400" />
           </div>
           <h3 className="text-lg font-black text-slate-800 tracking-tight">Tasks are managed per Lead</h3>
           <p className="text-sm font-medium text-slate-500">
             To view or create tasks, return to the <strong>Pipeline</strong> tab, select a specific lead, and navigate to the Tasks tab within their intelligence drawer. Global task view is coming soon.
           </p>
        </div>
      </Layout>
    );
  }

  if (activeTab === "notes") {
    return (
      <Layout menuItems={menuItems} title="My Notes" subtitle="Internal observations and lead context">
        <div className="p-12 mt-10 max-w-2xl mx-auto rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50 text-center flex flex-col items-center justify-center space-y-4">
           <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center border border-slate-100">
             <FileText size={24} className="text-purple-400" />
           </div>
           <h3 className="text-lg font-black text-slate-800 tracking-tight">Notes are attached to Leads</h3>
           <p className="text-sm font-medium text-slate-500">
             To view or create internal notes, return to the <strong>Pipeline</strong> tab, select a lead, and click the "Intel Notes" tab inside their drawer.
           </p>
        </div>
      </Layout>
    );
  }

  // default: pipeline
  return (
    <Layout
      menuItems={menuItems}
      title="Sales Pipeline"
      subtitle="Manage your leads, opportunities, and deals"
    >
      <CRMManager />
    </Layout>
  );
}
