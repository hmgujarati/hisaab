import React, { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, ListChecks } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const [items, setItems] = useState([]);
  const [newName, setNewName] = useState("");

  const load = async () => {
    const { data } = await api.get("/stages-master");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const addStage = async () => {
    if (!newName.trim()) return;
    try {
      await api.post("/stages-master", { name: newName.trim(), display_order: items.length, active: true });
      setNewName(""); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const move = async (idx, dir) => {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
    await api.post("/stages-master/reorder", { ordered_ids: next.map((s) => s.id) });
  };

  const toggleActive = async (s) => {
    await api.put(`/stages-master/${s.id}`, { name: s.name, display_order: s.display_order, active: !s.active });
    load();
  };

  const remove = async (s) => {
    if (!confirm(`Delete stage "${s.name}"?`)) return;
    try {
      await api.delete(`/stages-master/${s.id}`); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const rename = async (s, name) => {
    await api.put(`/stages-master/${s.id}`, { name, display_order: s.display_order, active: s.active });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-[#5A6566]">Customize</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">Project Stages</h1>
        <p className="text-[#5A6566] mt-1">Create your own stages. Reorder by moving up/down. Inactive stages won&apos;t appear when updating a project.</p>
      </div>

      <div className="rxt-card p-5">
        <div className="flex gap-2">
          <Input data-testid="add-stage-input" placeholder="Stage name (e.g. POP Started)" value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-white" />
          <Button data-testid="add-stage-btn" onClick={addStage} className="bg-[#2B4C3B] hover:bg-[#1F382A]">
            <Plus size={16} className="mr-1.5" /> Add
          </Button>
        </div>
      </div>

      <div className="rxt-card overflow-hidden">
        {items.length === 0 ? (
          <div className="py-12 text-center text-[#5A6566]">No stages yet — add your first stage above.</div>
        ) : items.map((s, idx) => (
          <StageRow
            key={s.id} stage={s} idx={idx} total={items.length}
            onMoveUp={() => move(idx, -1)} onMoveDown={() => move(idx, +1)}
            onToggle={() => toggleActive(s)} onDelete={() => remove(s)} onRename={(name) => rename(s, name)}
          />
        ))}
      </div>
    </div>
  );
}

function StageRow({ stage, idx, total, onMoveUp, onMoveDown, onToggle, onDelete, onRename }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(stage.name);
  useEffect(() => setName(stage.name), [stage.name]);
  const save = async () => { if (name && name !== stage.name) await onRename(name); setEdit(false); };
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E0D8] last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <button data-testid={`stage-up-${stage.id}`} onClick={onMoveUp} disabled={idx === 0} className="p-0.5 text-[#5A6566] hover:text-[#1C2B2D] disabled:opacity-30"><ChevronUp size={14} /></button>
        <button data-testid={`stage-down-${stage.id}`} onClick={onMoveDown} disabled={idx === total - 1} className="p-0.5 text-[#5A6566] hover:text-[#1C2B2D] disabled:opacity-30"><ChevronDown size={14} /></button>
      </div>
      <div className="h-8 w-8 rounded-md bg-[#2B4C3B]/10 text-[#2B4C3B] grid place-items-center text-xs font-medium">{idx + 1}</div>
      <div className="flex-1 min-w-0">
        {edit ? (
          <Input data-testid={`stage-edit-${stage.id}`} autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && save()} className="h-8" />
        ) : (
          <button data-testid={`stage-name-${stage.id}`} onClick={() => setEdit(true)} className="text-sm font-medium hover:text-[#2B4C3B]">{stage.name}</button>
        )}
      </div>
      <button onClick={onToggle} data-testid={`stage-toggle-${stage.id}`} className={`text-[11px] px-2 py-1 rounded-full border ${stage.active ? "bg-[#3A7D44]/10 text-[#3A7D44] border-[#3A7D44]/20" : "bg-[#5A6566]/10 text-[#5A6566] border-[#5A6566]/20"}`}>
        {stage.active ? "Active" : "Inactive"}
      </button>
      <button data-testid={`stage-delete-${stage.id}`} onClick={onDelete} className="p-1 text-[#D04238]/70 hover:text-[#D04238]"><Trash2 size={14} /></button>
    </div>
  );
}
