import React, { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { CRM_STAGE_CONFIG } from "./CrmUIComponents.jsx";

export default function CrmStageEditor({ open, onClose, onChangeStages }) {
    const [stages, setStages] = useState(Object.entries(CRM_STAGE_CONFIG).map(([key, cfg]) => ({ key, label: cfg.label, active: cfg.active !== false })));
    const [newKey, setNewKey] = useState("");
    const [newLabel, setNewLabel] = useState("");
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    if (!open) return null;

    const handleToggleActive = (key) => {
        setStages(prev => prev.map(s => s.key === key ? { ...s, active: !s.active } : s));
    };

    const handleDragStart = (e, idx) => {
        setDragIndex(idx);
        try { e.dataTransfer.effectAllowed = 'move'; } catch (err) { }
    };

    const handleDragOver = (e, idx) => {
        e.preventDefault();
        if (dragOverIndex !== idx) setDragOverIndex(idx);
    };

    const handleDrop = (e, idx) => {
        e.preventDefault();
        if (dragIndex === null) return;
        const copy = [...stages];
        const [moved] = copy.splice(dragIndex, 1);
        copy.splice(idx, 0, moved);
        setStages(copy);
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const handleAdd = () => {
        const key = (newKey || newLabel).toLowerCase().replace(/\s+/g, "_");
        if (!key || stages.find(s => s.key === key)) return;
        const label = newLabel || newKey;
        const next = [...stages, { key, label }];
        setStages(next);
        setNewKey("");
        setNewLabel("");
    };

    const handleSave = () => {
        // Mutate CRM_STAGE_CONFIG to reflect new order and labels. Keep simple default colors.
        const defaultColors = [
            { color: "bg-violet-50 text-violet-600 border-violet-100", dot: "bg-violet-500" },
            { color: "bg-sky-50 text-sky-600 border-sky-100", dot: "bg-sky-500" },
            { color: "bg-indigo-50 text-indigo-600 border-indigo-100", dot: "bg-indigo-500" },
            { color: "bg-amber-50 text-amber-600 border-amber-100", dot: "bg-amber-500" },
            { color: "bg-orange-50 text-orange-600 border-orange-100", dot: "bg-orange-500" },
            { color: "bg-emerald-50 text-emerald-600 border-emerald-100", dot: "bg-emerald-500" },
            { color: "bg-red-50 text-red-500 border-red-100", dot: "bg-red-400" }
        ];

        // Rebuild CRM_STAGE_CONFIG preserving inactive flags
        Object.keys(CRM_STAGE_CONFIG).forEach(k => delete CRM_STAGE_CONFIG[k]);

        stages.forEach((s, idx) => {
            const cfg = defaultColors[idx % defaultColors.length];
            CRM_STAGE_CONFIG[s.key] = { label: s.label, color: cfg.color, dot: cfg.dot, active: s.active !== false };
        });

        if (typeof onChangeStages === "function") onChangeStages(stages.filter(s => s.active).map(s => s.key));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl p-6 z-10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black">Edit Pipeline Stages</h3>
                    <button onClick={onClose} className="p-2 text-slate-500"><X size={18} /></button>
                </div>

                <div className="space-y-3 mb-4">
                    {stages.map((s, idx) => (
                        <div
                            key={s.key}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={(e) => handleDrop(e, idx)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 ${s.active ? '' : 'opacity-50'} ${dragOverIndex === idx ? 'ring-2 ring-indigo-200' : ''}`}
                        >
                            <div>
                                <div className="text-sm font-black">{s.label}</div>
                                <div className="text-[11px] text-slate-400">{s.key}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleToggleActive(s.key)} className={`p-2 ${s.active ? 'text-rose-500' : 'text-emerald-600'}`}>
                                    {s.active ? <Trash2 size={16} /> : <Plus size={16} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                    <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (e.g. 'Proposal')" className="rounded-lg border px-3 py-2" />
                    <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Key (optional)" className="rounded-lg border px-3 py-2" />
                </div>
                <div className="flex items-center gap-2 justify-end">
                    <button onClick={handleAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg"> <Plus size={14} /> Add</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-black">Save</button>
                </div>
            </div>
        </div>
    );
}
