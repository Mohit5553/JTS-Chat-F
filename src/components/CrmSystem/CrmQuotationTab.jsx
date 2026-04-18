import React, { useState, useEffect } from "react";
import { Plus, FileText, CheckCircle, Shield } from "lucide-react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

export default function CRMQuotationTab({ customer, websiteId }) {
    const { user } = useAuth();
    const isManager = ["admin", "client", "manager"].includes(user?.role);

    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        items: [{ description: "", quantity: 1, price: 0, total: 0 }],
        notes: "",
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchQuotes();
    }, [customer?._id]);

    const fetchQuotes = async () => {
        if (!customer?._id) return;
        try {
            const data = await api.get(`/api/crm/${customer._id}/quotations`);
            setQuotes(data);
        } catch (err) {
            console.error("Failed to fetch quotes", err);
        } finally {
            setLoading(false);
        }
    };

    const createPayment = async (quote) => {
        try {
            const data = await api.post(`/api/crm/quotations/${quote._id}/pay`, {});
            // For now just surface the client secret for testing; integrate Stripe.js later.
            alert(`Payment client secret:\n${data.clientSecret}`);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const total = form.items.reduce((acc, item) => acc + item.total, 0);
        const subtotal = total;
        try {
            await api("/api/crm/quotations", {
                method: "POST",
                body: JSON.stringify({
                    customerId: customer._id,
                    websiteId: websiteId || customer.websiteId,
                    items: form.items,
                    total,
                    subtotal,
                    notes: form.notes,
                    validUntil: form.validUntil
                })
            });
            setShowCreate(false);
            fetchQuotes();
        } catch (err) {
            console.error(err);
        }
    };

    const approveQuote = async (id) => {
        try {
            await api(`/api/crm/quotations/${id}/approve`, { method: "POST", body: JSON.stringify({}) });
            fetchQuotes();
        } catch (err) {
            console.error(err);
        }
    };

    const denyQuote = async (id) => {
        try {
            await api(`/api/crm/quotations/${id}/deny`, { method: "POST", body: JSON.stringify({}) });
            fetchQuotes();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="py-10 text-center animate-pulse text-slate-400 text-[10px] font-black uppercase">Syncing financial data…</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Digital Quotations</h3>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                    <Plus size={12} /> New Quote
                </button>
            </div>

            {showCreate && (
                <div className="bg-white rounded-2xl border-2 border-indigo-100 p-5 shadow-xl animate-in fade-in slide-in-from-top-4">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Quote Construction</p>
                            <div className="flex gap-2">
                                {[
                                    { 
                                        label: "SaaS Template", 
                                        items: [
                                            { description: "Monthly SaaS Subscription", quantity: 1, price: 4999, total: 4999 },
                                            { description: "One-time Setup Fee", quantity: 1, price: 1999, total: 1999 }
                                        ] 
                                    },
                                    { 
                                        label: "Consulting", 
                                        items: [
                                            { description: "Hourly Consulting Services", quantity: 10, price: 1500, total: 15000 }
                                        ] 
                                    }
                                ].map(template => (
                                    <button
                                        key={template.label}
                                        type="button"
                                        onClick={() => setForm({ ...form, items: template.items })}
                                        className="px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[8px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
                                    >
                                        Use {template.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {form.items.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-6">
                                    <input
                                        placeholder="Item Description"
                                        value={item.description}
                                        onChange={(e) => {
                                            const newItems = [...form.items];
                                            newItems[idx].description = e.target.value;
                                            setForm({ ...form, items: newItems });
                                        }}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        required
                                    />
                                </div>
                                <div className="col-span-2">
                                    <input
                                        type="number"
                                        placeholder="Qty"
                                        value={item.quantity}
                                        onChange={(e) => {
                                            const newItems = [...form.items];
                                            newItems[idx].quantity = Number(e.target.value);
                                            newItems[idx].total = newItems[idx].quantity * newItems[idx].price;
                                            setForm({ ...form, items: newItems });
                                        }}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <input
                                        type="number"
                                        placeholder="Price"
                                        value={item.price}
                                        onChange={(e) => {
                                            const newItems = [...form.items];
                                            newItems[idx].price = Number(e.target.value);
                                            newItems[idx].total = newItems[idx].quantity * newItems[idx].price;
                                            setForm({ ...form, items: newItems });
                                        }}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    {form.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                                            className="text-rose-400 hover:text-rose-600 text-lg leading-none font-black transition-colors"
                                            title="Remove item"
                                        >×</button>
                                    )}
                                </div>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, price: 0, total: 0 }] })}
                            className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1 transition-colors"
                        >
                            + Add Line Item
                        </button>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-[11px] font-black text-slate-900 uppercase">Total: {formatCurrency(form.items.reduce((acc, i) => acc + i.total, 0))}</span>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">Process Deal</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-3">
                {quotes.length > 0 ? quotes.map(quote => (
                    <div key={quote._id} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${quote.status === "accepted" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                    quote.status === "pending_approval" ? "bg-amber-50 text-amber-600 border border-amber-100 animate-pulse" :
                                        quote.status === "denied" ? "bg-rose-50 text-rose-700 border-rose-100" :
                                            "bg-slate-50 text-slate-400"
                                }`}>
                                {quote.status === "accepted" ? <CheckCircle size={18} /> :
                                    quote.status === "pending_approval" ? <Shield size={18} /> :
                                        <FileText size={18} />}
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{quote.quotationId}</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{new Date(quote.createdAt).toLocaleDateString()}</span>
                                    <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${quote.status === "accepted" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                            quote.status === "pending_approval" ? "bg-amber-50 text-amber-700 border-amber-100" :
                                                quote.status === "denied" ? "bg-rose-50 text-rose-700 border-rose-100" :
                                                    "bg-slate-50 text-slate-500 border-slate-200"
                                        }`}>{quote.status.replace("_", " ")}</span>
                                    {quote.validUntil && (
                                        <span className="text-[7px] font-black text-rose-400 uppercase tracking-widest">
                                            Valid till {new Date(quote.validUntil).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black text-slate-900 leading-none mb-1">{formatCurrency(quote.total)}</p>
                            {quote.status === "pending_approval" ? (
                                isManager ? (
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={() => approveQuote(quote._id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded italic text-[9px] font-black uppercase">Approve</button>
                                        <button onClick={() => denyQuote(quote._id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded italic text-[9px] font-black uppercase">Deny</button>
                                    </div>
                                ) : (
                                    <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1 justify-end">
                                        <Shield size={8} /> Reviewing…
                                    </span>
                                )
                            ) : quote.status === "accepted" ? (
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 italic">Confirmed Deal</span>
                            ) : quote.status === "denied" ? (
                                <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 italic">Rejected</span>
                            ) : quote.status === "draft" ? (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.patch(`/api/crm/quotations/${quote._id}/status`, { status: "sent" });
                                                fetchQuotes();
                                            } catch (err) { console.error(err); }
                                        }}
                                        className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700"
                                    >
                                        Send
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await api.patch(`/api/crm/quotations/${quote._id}/status`, { status: "accepted" });
                                            fetchQuotes();
                                        }}
                                        className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700"
                                    >
                                        Mark Won
                                    </button>
                                    <button
                                        onClick={() => createPayment(quote)}
                                        className="text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-800"
                                    >
                                        Create Payment Intent
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={async () => {
                                        await api.patch(`/api/crm/quotations/${quote._id}/status`, { status: "accepted" });
                                        fetchQuotes();
                                    }}
                                    className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-700"
                                >
                                    Mark Won
                                </button>
                            )}
                        </div>
                    </div>
                )) : (
                    <div className="py-16 text-center space-y-3 border-2 border-dashed border-slate-100 rounded-2xl">
                        <FileText size={32} className="mx-auto text-slate-100" />
                        <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">No active quotations</p>
                    </div>
                )}
            </div>
        </div>
    );
}
