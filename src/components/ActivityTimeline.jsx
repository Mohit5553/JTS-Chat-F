const TYPE_STYLES = {
  created: "bg-emerald-500",
  updated: "bg-indigo-500",
  archived: "bg-amber-500",
  restored: "bg-cyan-500",
  assigned: "bg-violet-500",
  transferred: "bg-fuchsia-500",
  note_added: "bg-slate-500",
  email_sent: "bg-sky-500",
  task_created: "bg-emerald-500",
  task_updated: "bg-indigo-500",
  task_completed: "bg-emerald-600",
  duplicate_detected: "bg-rose-500",
  merged: "bg-orange-500",
  comment_added: "bg-slate-700",
  status_changed: "bg-blue-500"
};

export default function ActivityTimeline({ items = [], emptyLabel = "No timeline activity yet." }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
      {items.map((item, index) => (
        <div key={item._id || `${item.type}-${index}`} className="relative flex gap-5">
          <div className={`relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-white ${TYPE_STYLES[item.type] || "bg-slate-400"}`} />
          <div className="flex-1 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black text-slate-900">{item.summary || item.title || item.type}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {(item.actorName || "System")} {item.actorRole ? `• ${item.actorRole}` : ""}
                </p>
              </div>
              <span className="text-[9px] font-bold uppercase text-slate-300">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>
            {item.metadata && Object.keys(item.metadata).length > 0 ? (
              <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-medium text-slate-500">
                {JSON.stringify(item.metadata, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
