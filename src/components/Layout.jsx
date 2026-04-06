import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Globe, Headphones,
  MessageSquare, BarChart, ChevronLeft, ChevronRight, LogOut,
  Sun, Moon, Bell, Search, Check, Trash2, ExternalLink, Ticket, AlertCircle, Clock,
  Contact, CreditCard, ShieldCheck
} from "lucide-react";
import { api } from "../api/client.js";
import { useSocket } from "../context/SocketContext.jsx";

function getInitials(name = "") {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function getAvatarColor(name = "") {
  const colors = [
    "from-indigo-500 to-violet-500",
    "from-pink-500 to-rose-500",
    "from-orange-500 to-amber-500",
    "from-teal-500 to-cyan-500",
    "from-blue-500 to-indigo-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const iconMap = {
  "Dashboard": LayoutDashboard,
  "Clients": Users,
  "Websites": Globe,
  "Agents": Headphones,
  "Shortcuts": MessageSquare,
  "Chats": MessageSquare,
  "Assigned Chats": MessageSquare,
  "History": Clock,
  "Historical Archive": Clock,
  "Reports": BarChart,
  "CRM": Contact,
  "Billing": CreditCard,
  "Subscriptions": ShieldCheck
};

export default function Layout({ title, subtitle, children, menuItems = [] }) {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const socket = useSocket();

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const role = user?.role;
  const isOwner = role === "client" || role === "admin";

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const fetchNotifications = async () => {
    try {
      const query = notificationFilter !== "all" ? `?type=${notificationFilter}` : "";
      const data = await api(`/api/notifications${query}`);
      setNotifications(data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [notificationFilter]);

  useEffect(() => {
    if (!socket) return;
    socket.on("notification:new", (notification) => {
      setNotifications(prev => [notification, ...prev]);
      // Optional: Browser Native Notification
      if (Notification.permission === "granted") {
        new Notification(notification.title, { body: notification.message });
      }
    });
    return () => socket.off("notification:new");
  }, [socket]);

  const markAllRead = async () => {
    try {
      await api("/api/notifications/mark-all-read", { method: "PATCH" });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const markRead = async (id) => {
    try {
      await api(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const fallbackMenuItems = role === "admin"
    ? [
      { label: "Dashboard", href: "/admin" },
      { label: "Clients", href: "/admin?tab=clients" },
      { label: "Websites", href: "/admin?tab=websites" },
      { label: "Agents", href: "/admin?tab=agents" },
      { label: "Chats", href: "/admin?tab=chats" },
      { label: "CRM", href: "/admin?tab=crm" },
      { label: "History", href: "/admin?tab=history" },
      { label: "Reports", href: "/admin?tab=reports" }
    ]
    : role === "manager"
      ? [
        { label: "Dashboard", href: "/manager" },
        { label: "CRM", href: "/manager?tab=crm" }
      ]
      : role === "client"
        ? [
          { label: "Dashboard", href: "/client" },
          { label: "Websites", href: "/client?tab=websites" },
          { label: "Agents", href: "/client?tab=agents" },
          { label: "Chats", href: "/client?tab=chats" },
          { label: "CRM", href: "/client?tab=crm" },
          { label: "History", href: "/client?tab=history" },
          { label: "Reports", href: "/client?tab=reports" }
        ]
        : [
          { label: "Dashboard", href: "/agent" },
          { label: "Assigned Chats", href: "/agent?tab=chats" }
        ];

  const links = menuItems.length ? menuItems : fallbackMenuItems;

  return (
    <div className="flex h-screen bg-[var(--bg-main)] text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden transition-colors duration-500">
      {/* Sidebar */}
      <aside className={`glass-sidebar flex flex-col shadow-2xl flex-shrink-0 relative z-50 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isCollapsed ? 'w-24' : 'w-72'}`}>

        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 bg-indigo-600 border border-white/10 text-white rounded-full p-1.5 shadow-xl z-50 transition-all hover:scale-110 active:scale-95"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Top Header / Branding */}
        <div className={`p-8 pb-6 flex items-center ${isCollapsed ? 'justify-center px-0' : ''}`}>
          {isCollapsed ? (
            <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center justify-center font-black text-white text-sm">JTS</div>
          ) : (
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 drop-shadow-sm">Command Center</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tighter flex items-center gap-2 leading-none">
                JTS <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 italic">Support</span>
              </h1>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 px-4 space-y-1 overflow-y-auto mt-5 custom-scrollbar pb-6" aria-label="Sidebar">
          {links.map((item) => {
            const Icon = iconMap[item.label] || LayoutDashboard;
            return (
              <NavLink
                key={item.label}
                to={item.href}
                className={({ isActive }) =>
                  `relative flex items-center ${isCollapsed ? 'justify-center px-0 py-3.5' : 'px-4 py-2.5'} text-[10px] font-black uppercase tracking-[0.15em] rounded-2xl transition-all duration-300 group ${isActive
                    ? "bg-indigo-600/20 text-indigo-300 shadow-[inset_0_0_20px_rgba(79,70,229,0.1)]"
                    : "hover:bg-white/5 hover:text-white text-slate-300"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <div className="absolute left-0 w-1.5 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_15px_rgba(99,102,241,0.8)]" />}
                    <Icon size={isCollapsed ? 22 : 18} className={`${isCollapsed ? '' : 'mr-4'} transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-indigo-300 drop-shadow-[0_0_10px_rgba(99,102,241,0.6)]' : 'text-slate-300 group-hover:text-white'}`} />
                    {!isCollapsed && <span className="z-10">{item.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom User Area */}
        <div className={`mx-4 mb-6 mt-auto shrink-0 transition-all ${isCollapsed ? 'p-2' : 'p-5'} bg-white/5 rounded-[28px] border border-white/5 backdrop-blur-md shadow-inner`}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-6">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getAvatarColor(user?.name || "")} flex items-center justify-center text-white font-black text-xs shadow-2xl select-none shrink-0 border border-white/10`} title={user?.name}>
                {getInitials(user?.name || "")}
              </div>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-2xl transition-all"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${getAvatarColor(user?.name || "")} flex items-center justify-center text-white font-black text-xs shadow-2xl select-none shrink-0 border border-white/10`}>
                  {getInitials(user?.name || "")}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-black text-white truncate block tracking-tight">{user?.name}</span>
                  <span className="text-[10px] text-slate-300 font-bold truncate block uppercase tracking-widest">{role === "admin" ? "Global Admin" : role}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="flex-1 flex items-center justify-center py-2.5 text-slate-400 hover:text-white bg-white/5 border border-white/5 hover:border-white/10 rounded-xl transition-all"
                  title="Toggle Theme"
                >
                  {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                <button
                  onClick={logout}
                  className="flex-1 flex items-center justify-center py-2.5 text-slate-400 hover:text-rose-400 bg-white/5 border border-white/5 hover:border-rose-400/20 rounded-xl transition-all group"
                  title="Sign Out"
                >
                  <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-20 flex items-center justify-between px-6 md:px-12 glass-panel sticky top-0 z-40 shadow-sm transition-colors duration-500">
          <div className="min-w-0 animate-fade-in">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-500 mb-1">{title}</div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tighter truncate">{subtitle}</h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200/50 dark:border-white/5 text-slate-400 focus-within:text-indigo-500 focus-within:border-indigo-500/50 transition-all">
              <Search size={16} />
              <input type="text" placeholder="Search insights..." className="bg-transparent border-none outline-none text-xs font-bold w-48 text-slate-600 dark:text-slate-300 placeholder:text-slate-400" />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2.5 transition-all rounded-xl ${showNotifications ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600' : 'text-slate-400 hover:text-indigo-500'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow-lg animate-bounce">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-4 w-[380px] bg-white dark:bg-slate-900 rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-white/5 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                    <div className="p-6 border-b border-slate-50 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
                      <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-widest dark:text-white">Notifications Center</h4>
                        <div className="flex flex-wrap gap-2">
                          {["all", "new_chat", "new_ticket", "crm_follow_up_due", "sla_breach"].map((type) => (
                            <button
                              key={type}
                              onClick={() => setNotificationFilter(type)}
                              className={`rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${notificationFilter === type ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                                }`}
                            >
                              {type === "all" ? "all" : type.replaceAll("_", " ")}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={markAllRead} className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline">
                        Mark all as read
                      </button>
                    </div>

                    <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                      {notifications.length > 0 ? (
                        notifications.map(n => (
                          <div
                            key={n._id}
                            onClick={() => {
                              markRead(n._id);
                              if (n.link) window.location.href = n.link.startsWith("/") ? n.link : `/${n.link}`;
                            }}
                            className={`p-5 border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer relative ${!n.isRead ? 'bg-indigo-50/20 dark:bg-indigo-500/5' : ''}`}
                          >
                            {!n.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
                            <div className="flex gap-4">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${!n.isRead ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600' : 'bg-slate-100 dark:bg-white/10 text-slate-400'}`}>
                                {n.type === 'new_chat' ? <MessageSquare size={16} /> : n.type === 'new_ticket' ? <Ticket size={16} /> : <AlertCircle size={16} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[11px] font-black uppercase tracking-tight truncate ${n.isRead ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{n.title}</p>
                                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                                {(n.actorName || n.entityType) && (
                                  <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-300">
                                    {[n.actorName, n.entityType].filter(Boolean).join(" • ")}
                                  </p>
                                )}
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  {n.link && <button className="text-[8px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 hover:text-indigo-600">Sync <ExternalLink size={8} /></button>}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-20 text-center space-y-4">
                          <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mx-auto">
                            <Bell size={20} className="text-slate-200" />
                          </div>
                          <p className="text-[10px] font-black text-slate-300 dark:text-slate-800 uppercase tracking-widest">Awaiting system signals...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${getAvatarColor(user?.name || "")} flex items-center justify-center text-white font-black text-xs shadow-xl select-none cursor-pointer border-2 border-white dark:border-slate-800 transition-transform hover:scale-105 active:scale-95`}>
              {getInitials(user?.name || "")}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar scroll-smooth">
          <div className="animate-fade-in max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
