import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import type { AdminNote, DailyNote } from "@/types";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  StickyNote,
  Trash2,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { addDays, format, subDays } from "date-fns";
import { id as localeID } from "date-fns/locale";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmployeeGrid, { EmployeeHeader } from "@/components/EmployeeGrid";

const Notes = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, users } = useAuth();

  const [adminNotes, setAdminNotes] = useState<AdminNote[]>([]);
  const [adminNoteContent, setAdminNoteContent] = useState("");
  const [adminNotePriority, setAdminNotePriority] = useState<
    "normal" | "important"
  >("normal");

  const [currentDate, setCurrentDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && employeeId) {
      api.getAdminNotes({ toEmployeeId: employeeId }).then(setAdminNotes).catch(
        () => {},
      );
    } else if (!isAdmin && user) {
      api.getDailyNotes({ userId: user.id }).then(setDailyNotes).catch(
        () => {},
      );
      api.getAdminNotes({ toEmployeeId: user.id }).then(setAdminNotes).catch(
        () => {},
      );
    }
  }, [isAdmin, employeeId, user]);

  const prevDay = () =>
    setCurrentDate(format(subDays(new Date(currentDate), 1), "yyyy-MM-dd"));
  const nextDay = () =>
    setCurrentDate(format(addDays(new Date(currentDate), 1), "yyyy-MM-dd"));

  if (isAdmin && !employeeId) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-3"
      >
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <StickyNote className="w-5 h-5" /> Catatan
        </h1>
        <EmployeeGrid basePath="/notes" />
      </motion.div>
    );
  }

  if (isAdmin && employeeId) {
    const empNotes = adminNotes.filter((n) => n.toEmployeeId === employeeId);
    const empName = users.find((u) => u.id === employeeId)?.name || "";

    const handleSendNote = async () => {
      if (!adminNoteContent.trim() || !user) return;
      try {
        const note = await api.createAdminNote({
          toEmployeeId: employeeId,
          content: adminNoteContent.trim(),
          priority: adminNotePriority,
        });
        setAdminNotes((prev) => [note, ...prev]);
        setAdminNoteContent("");
        toast.success(`Catatan terkirim ke ${empName}`);
      } catch {
        toast.error("Gagal mengirim catatan");
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4 max-w-8xl"
      >
        <EmployeeHeader employeeId={employeeId} backPath="/notes" />
        <div className="ms-card p-5 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">
            Kirim Catatan ke {empName}
          </h2>
          <div className="space-y-1">
            <Label className="text-xs">Prioritas</Label>
            <Select
              value={adminNotePriority}
              onValueChange={(v) =>
                setAdminNotePriority(v as "normal" | "important")}
            >
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal" className="text-xs">
                  Normal
                </SelectItem>
                <SelectItem value="important" className="text-xs">
                  Penting (Mencolok)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={adminNoteContent}
            onChange={(e) => setAdminNoteContent(e.target.value)}
            placeholder="Tulis instruksi atau pengingat..."
            className="text-sm"
            rows={3}
          />
          <Button
            onClick={handleSendNote}
            className="text-xs gap-1"
            disabled={!adminNoteContent.trim()}
          >
            <Send className="w-3 h-3" /> Kirim
          </Button>
        </div>
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-foreground">
            Catatan Terkirim ({empNotes.length})
          </h2>
          {empNotes.length === 0
            ? (
              <EmptyState
                icon={StickyNote}
                title="Belum ada catatan"
                description="Kirim catatan atau instruksi kepada karyawan ini menggunakan form di atas."
                compact
              />
            )
            : empNotes.map((note) => (
              <div
                key={note.id}
                className={`rounded-lg p-3 border-l-4 ${
                  note.priority === "important"
                    ? "bg-destructive/5 border-l-destructive"
                    : "bg-warning/5 border-l-warning"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {note.priority === "important" && (
                    <Badge
                      variant="destructive"
                      className="text-[9px] px-1.5 py-0"
                    >
                      PENTING
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {note.createdAt}
                  </span>
                </div>
                <p className="text-sm text-foreground">{note.content}</p>
              </div>
            ))}
        </div>
      </motion.div>
    );
  }

  // Employee
  const notesForDate = dailyNotes.filter((n) => n.date === currentDate).sort((
    a,
    b,
  ) => b.createdAt.localeCompare(a.createdAt));
  const myAdminNotes = adminNotes.filter((n) => n.toEmployeeId === user?.id);

  const doAddNote = async () => {
    if (!newNoteText.trim() || !user) return;
    try {
      const note = await api.createDailyNote({
        date: currentDate,
        content: newNoteText.trim(),
      });
      setDailyNotes((prev) => [note, ...prev]);
      setNewNoteText("");
      setConfirmSave(false);
      toast.success("Catatan tersimpan");
    } catch {
      toast.error("Gagal menyimpan");
      setConfirmSave(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await api.deleteDailyNote(id);
      setDailyNotes((prev) => prev.filter((n) => n.id !== id));
      setConfirmDelete(null);
      toast.success("Catatan dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
    >
      <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <StickyNote className="w-5 h-5 text-primary" /> Catatan
      </h1>
      {myAdminNotes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Catatan dari Admin
          </h2>
          {myAdminNotes.map((note) => (
            <div
              key={note.id}
              className={`rounded-lg p-3 border-l-4 ${
                note.priority === "important"
                  ? "bg-destructive/5 border-l-destructive"
                  : "bg-warning/5 border-l-warning"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {note.priority === "important" && (
                  <Badge
                    variant="destructive"
                    className="text-[9px] px-1.5 py-0"
                  >
                    PENTING
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {note.createdAt}
                </span>
              </div>
              <p className="text-sm text-foreground">{note.content}</p>
            </div>
          ))}
        </div>
      )}
      <div className="ms-card p-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={prevDay}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 " />
          <span className="text-sm font-medium text-foreground">
            {format(new Date(currentDate), "EEEE, d MMMM yyyy", {
              locale: localeID,
            })}
          </span>
          -
          <Input
            type="date"
            value={currentDate}
            onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
            className="w-auto h-7 text-xs bg-transparent border-none px-0"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={nextDay}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="ms-card p-4 space-y-3">
        <h2 className="text-xs font-semibold text-foreground">
          Tambah Catatan untuk{" "}
          {format(new Date(currentDate), "d MMMM yyyy", { locale: localeID })}
        </h2>
        <Textarea
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value.slice(0, 2000))}
          placeholder="Tulis catatan harian..."
          className="min-h-[80px] text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {newNoteText.length}/2000
          </span>
          <Button
            size="sm"
            className="gap-1 text-xs"
            onClick={() => {
              if (newNoteText.trim()) setConfirmSave(true);
            }}
            disabled={!newNoteText.trim()}
          >
            <Plus className="w-3 h-3" /> Simpan
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-foreground">
          Catatan Hari Ini ({notesForDate.length})
        </h2>
        {notesForDate.length === 0
          ? (
            <EmptyState
              icon={StickyNote}
              title="Belum ada catatan"
              description="Belum ada catatan untuk tanggal ini. "
              compact
            />
          )
          : notesForDate.map((note) => (
            <div key={note.id} className="ms-card p-3 group ">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {note.content}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(note.createdAt), "HH:mm", {
                      locale: localeID,
                    })}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => setConfirmDelete(note.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
      </div>
      <ConfirmDialog
        open={confirmSave}
        onOpenChange={setConfirmSave}
        title="Simpan catatan?"
        description="Catatan akan disimpan untuk tanggal ini."
        confirmText="Ya, Simpan"
        onConfirm={doAddNote}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="Hapus catatan ini?"
        description="Catatan yang dihapus tidak dapat dikembalikan."
        confirmText="Hapus"
        variant="destructive"
        onConfirm={() => confirmDelete && handleDeleteNote(confirmDelete)}
      />
    </motion.div>
  );
};

export default Notes;
