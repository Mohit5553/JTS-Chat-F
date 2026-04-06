import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import StatCard from "../components/StatCard.jsx";
import CRMManager from "../components/CRMManager.jsx";
import TicketManager from "../components/TicketManager.jsx";
import PaginationControls from "../components/PaginationControls.jsx";
import { getPaginationMeta } from "../utils/pagination.js";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { hasModule } from "../utils/planAccess.js";

export default function ManagerPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [websites, setWebsites]   = useState([]);
  const [agents, setAgents]       = useState([]);
  const [sessions, setSessions]   = useState([]);
  const [streamsPage, setStreamsPage] = useState(1);
  const [websitesPage, setWebsitesPage] = useState(1);
  const [agentsPage, setAgentsPage] = useState(1);
  const [searchParams]            = useSearchParams();
  const tab                       = searchParams.get("tab") || "overview";
  const canUseTickets = hasModule(user, "tickets");
  const canUseCRM = hasModule(user, "crm");

  async function load() {
    try {
      const [analyticsData, websiteData, agentData, sessionData] = await Promise.all([
        api("/api/analytics"),
        api("/api/websites"),
        api("/api/users/agents"),
        api("/api/chat/sessions")
      ]);
      setAnalytics(analyticsData);
      setWebsites(websiteData);
      setAgents(agentData);
      setSessions(sessionData);
    } catch (err) {
      console.error("Failed to load manager data:", err);
    }
  }

  useEffect(() => { load(); }, []);

  const menuItems = [
    { label: "Overview",  href: "/manager" },
    ...(canUseCRM ? [{ label: "CRM", href: "/manager?tab=crm" }] : []),
    ...(canUseTickets ? [{ label: "Tickets", href: "/manager?tab=tickets" }, { label: "Streams", href: "/manager?tab=streams" }] : []),
  ];

  if (tab === "crm" && !canUseCRM) {
    return (
      <Layout menuItems={menuItems} title="Plan Upgrade Required" subtitle="CRM is available on Pro only">
        <div className="rounded-[40px] border border-emerald-100 bg-emerald-50 p-12 text-center">
          <h3 className="text-lg font-black text-emerald-900 uppercase tracking-tight">Pro plan required</h3>
          <p className="mt-3 text-sm font-bold text-emerald-700">Upgrade this client to Pro to unlock CRM supervision for managers.</p>
        </div>
      </Layout>
    );
  }

  if ((tab === "tickets" || tab === "streams") && !canUseTickets) {
    return (
      <Layout menuItems={menuItems} title="Plan Upgrade Required" subtitle="Ticket operations are available on Standard and Pro">
        <div className="rounded-[40px] border border-amber-100 bg-amber-50 p-12 text-center">
          <h3 className="text-lg font-black text-amber-900 uppercase tracking-tight">Standard plan required</h3>
          <p className="mt-3 text-sm font-bold text-amber-700">Upgrade this client to Standard or Pro to unlock tickets, routing, and stream supervision.</p>
        </div>
      </Layout>
    );
  }

  /* ── CRM Tab ── */
  if (tab === "crm") {
    return (
      <Layout
        menuItems={menuItems}
        title="CRM Master Console"
        subtitle="Strategic customer relationship intelligence"
      >
        <CRMManager />
      </Layout>
    );
  }

  if (tab === "tickets") {
    return (
      <Layout
        menuItems={menuItems}
        title="Ticket Command"
        subtitle="Monitor and coordinate support tickets across your tenant"
      >
        <TicketManager />
      </Layout>
    );
  }

  /* ── Live Streams Tab ── */
  if (tab === "streams") {
    const paginatedSessions = getPaginationMeta(sessions, streamsPage);
    return (
      <Layout
        menuItems={menuItems}
        title="Live Stream Monitor"
        subtitle="Real-time oversight of all concurrent visitor sessions"
      >
        <section className="premium-card p-0 overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30">
            <h3 className="heading-md">Active Sessions</h3>
            <p className="small-label opacity-60 mt-1">Monitoring {sessions.length} total sessions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-5 small-label">Website</th>
                  <th className="px-10 py-5 small-label">Visitor</th>
                  <th className="px-10 py-5 small-label">Status</th>
                  <th className="px-10 py-5 small-label">Assigned Agent</th>
                  <th className="px-10 py-5 small-label">CRN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-10 py-16 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      No active sessions right now
                    </td>
                  </tr>
                ) : paginatedSessions.pageItems.map((session) => (
                  <tr key={session._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-10 py-5 text-xs font-black text-slate-900 uppercase tracking-tight">
                      {session.websiteId?.websiteName}
                    </td>
                    <td className="px-10 py-5 text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                      {session.visitorId?.visitorId}
                    </td>
                    <td className="px-10 py-5">
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                        session.status === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        session.status === "queued" ? "bg-amber-50 text-amber-600 border-amber-100" :
                        "bg-slate-100 text-slate-400 border-slate-200"
                      }`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="px-10 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-black shadow-sm shadow-indigo-200">
                          {session.assignedAgent?.name?.[0] || "Q"}
                        </div>
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">
                          {session.assignedAgent?.name || "Unassigned"}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-5">
                      {session.crn ? (
                        <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded tracking-widest">
                          {session.crn}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-300 font-bold">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 border-t border-slate-50 bg-white">
            <PaginationControls
              currentPage={paginatedSessions.currentPage}
              totalPages={paginatedSessions.totalPages}
              totalItems={paginatedSessions.totalItems}
              itemLabel="sessions"
              onPageChange={setStreamsPage}
            />
          </div>
        </section>
      </Layout>
    );
  }

  /* ── Overview Tab (default) ── */
  return (
    <Layout
      menuItems={menuItems}
      title="Operations Overview"
      subtitle="Monitoring and analytical oversight dashboard"
    >
      <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
      {(() => {
        const paginatedWebsites = getPaginationMeta(websites, websitesPage);
        const paginatedAgents = getPaginationMeta(agents, agentsPage);
        return (
          <>

        {/* Stats row */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <StatCard label="Linked Websites"     value={analytics?.totals?.websites    ?? websites.length} />
          <StatCard label="Active Personnel"    value={analytics?.totals?.agents      ?? agents.length} />
          <StatCard label="Concurrent Sessions" value={analytics?.totals?.liveSessions ?? sessions.length} color="indigo" />
        </section>

        {/* Websites registry */}
        <section className="premium-card p-0 overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30">
            <h3 className="heading-md">System Registry</h3>
            <p className="small-label opacity-60 mt-1">Authorized domain connections and embed scripts</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8">
            {websites.length === 0 ? (
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest col-span-2 py-8 text-center">
                No websites registered yet.
              </p>
            ) : paginatedWebsites.pageItems.map((website) => (
              <article key={website._id} className="p-8 bg-slate-50/50 rounded-3xl border border-slate-100 group hover:border-indigo-100 transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-lg shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">🌐</div>
                    <div>
                      <strong className="text-xs font-black text-slate-950 uppercase tracking-tight block">{website.websiteName}</strong>
                      <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">{website.domain}</span>
                    </div>
                  </div>
                  <code className="text-[9px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">{website.apiKey}</code>
                </div>
                <div className="relative">
                  <textarea readOnly value={website.embedScript} rows={3} className="w-full bg-slate-950 text-indigo-300 font-mono text-[9px] p-5 rounded-2xl border border-slate-800 outline-none resize-none shadow-inner leading-relaxed" />
                  <div className="absolute top-2 right-2 px-2 py-1 bg-white/5 backdrop-blur-sm rounded text-[8px] font-black text-slate-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Copy</div>
                </div>
              </article>
            ))}
          </div>
          <div className="px-8 pb-8">
            <PaginationControls
              currentPage={paginatedWebsites.currentPage}
              totalPages={paginatedWebsites.totalPages}
              totalItems={paginatedWebsites.totalItems}
              itemLabel="websites"
              onPageChange={setWebsitesPage}
            />
          </div>
        </section>

        {/* Agents roster — read-only */}
        <section className="premium-card p-0 overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30">
            <h3 className="heading-md">Personnel Roster</h3>
            <p className="small-label opacity-60 mt-1">View active support personnel under your oversight</p>
          </div>
          <div className="divide-y divide-slate-50">
            {agents.length === 0 ? (
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest py-10 text-center">No personnel assigned yet.</p>
            ) : paginatedAgents.pageItems.map((agent) => (
              <div key={agent._id} className="flex items-center justify-between px-8 py-5 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-200">
                    {agent.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{agent.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{agent.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-lg uppercase tracking-widest">{agent.role}</span>
                  <div className={`w-2 h-2 rounded-full ${agent.isOnline ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-slate-300"}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="px-8 pb-8">
            <PaginationControls
              currentPage={paginatedAgents.currentPage}
              totalPages={paginatedAgents.totalPages}
              totalItems={paginatedAgents.totalItems}
              itemLabel="personnel"
              onPageChange={setAgentsPage}
            />
          </div>
        </section>

          </>
        );
      })()}
      </div>
    </Layout>
  );
}
