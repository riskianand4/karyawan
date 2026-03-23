import { useState, useRef } from "react";
import { Task, TaskStatus, Priority, TaskAttachment } from "@/types";
import { useTasks } from "@/contexts/TaskContext";
import { useAuth } from "@/contexts/AuthContext";
import api, { getUploadUrl } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmDialog from "@/components/ConfirmDialog";
import { MessageCircleCodeIcon, Send, Calendar, Flag, Edit2, Trash2, Paperclip, Download, FileText, X } from "lucide-react";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Akan Dikerjakan",
  "in-progress": "Sedang Dikerjakan",
  "needs-review": "Perlu Ditinjau",
  completed: "Selesai",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-muted text-muted-foreground",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const TaskDetailModal = ({ task, open, onOpenChange }: Props) => {
  const { updateTaskStatus, addTaskNote, updateTask, deleteTask, refreshTasks } = useTasks();
  const { user, isAdmin } = useAuth();
  const [noteText, setNoteText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("medium");
  const [editDeadline, setEditDeadline] = useState("");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSaveEdit, setConfirmSaveEdit] = useState(false);
  const [confirmAddNote, setConfirmAddNote] = useState(false);
  const [confirmStatusChange, setConfirmStatusChange] = useState<TaskStatus | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionFiles, setCompletionFiles] = useState<File[]>([]);
  const [uploadingCompletion, setUploadingCompletion] = useState(false);
  const completionFileRef = useRef<HTMLInputElement>(null);

  if (!task) return null;

  const handleAddNote = () => {
    if (!noteText.trim() || !user) return;
    setConfirmAddNote(true);
  };

  const doAddNote = () => {
    if (!noteText.trim() || !user) return;
    addTaskNote(task.id, {
      text: noteText.trim(),
      createdAt: new Date().toISOString().split("T")[0],
      authorId: user.id,
    });
    setNoteText("");
    setConfirmAddNote(false);
    toast.success("Catatan progress ditambahkan");
  };

  const startEdit = () => {
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditPriority(task.priority);
    setEditDeadline(task.deadline);
    setEditing(true);
  };

  const saveEdit = () => {
    updateTask(task.id, { title: editTitle, description: editDesc, priority: editPriority, deadline: editDeadline });
    setEditing(false);
    setConfirmSaveEdit(false);
    toast.success("Tugas diperbarui");
  };

  const handleDelete = () => {
    deleteTask(task.id);
    onOpenChange(false);
    setConfirmDelete(false);
    toast.success("Tugas dihapus");
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (newStatus === "completed") {
      setCompletionOpen(true);
      setCompletionFiles([]);
    } else {
      setConfirmStatusChange(newStatus);
    }
  };

  const doStatusChange = () => {
    if (confirmStatusChange) {
      updateTaskStatus(task.id, confirmStatusChange);
      setConfirmStatusChange(null);
    }
  };

  const handleCompletionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setCompletionFiles((prev) => [...prev, ...Array.from(files)]);
    if (completionFileRef.current) completionFileRef.current.value = "";
  };

  const confirmCompletion = async () => {
    if (completionFiles.length === 0) return;
    try {
      setUploadingCompletion(true);
      const formData = new FormData();
      completionFiles.forEach((file) => formData.append("files", file));
      await api.uploadTaskAttachments(task.id, formData);
      await updateTaskStatus(task.id, "completed");
      await refreshTasks();
      setCompletionOpen(false);
      setCompletionFiles([]);
      toast.success("Tugas diselesaikan dengan dokumentasi");
    } catch {
      toast.error("Gagal mengunggah dokumentasi penyelesaian");
    } finally {
      setUploadingCompletion(false);
    }
  };

  const handleAddAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    try {
      setUploadingAttachment(true);
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      await api.uploadTaskAttachments(task.id, formData);
      await refreshTasks();
      toast.success(`${files.length} file ditambahkan`);
    } catch {
      toast.error("Gagal menambahkan lampiran");
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (attId: string) => {
    updateTask(task.id, { attachments: (task.attachments || []).filter((a) => a.id !== attId) });
    toast.success("Lampiran dihapus");
  };

  const downloadAttachment = (att: TaskAttachment) => {
    const link = document.createElement("a");
    link.href = getUploadUrl(att.url);
    link.download = att.name;
    link.click();
  };

  const attachments = task.attachments || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">{task.title}</DialogTitle>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <>
                    <Button size="icon" variant="ghost" className="w-7 h-7" onClick={startEdit}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          {editing && isAdmin ? (
            <div className="space-y-3">
              <div className="space-y-1"><Label className="text-sm">Judul</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-sm">Deskripsi</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="min-h-[60px]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Prioritas</Label>
                  <Select value={editPriority} onValueChange={(v) => setEditPriority(v as Priority)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">Tinggi</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="low">Rendah</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Tenggat Waktu</Label>
                  <Input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Batal</Button>
                <Button size="sm" onClick={() => setConfirmSaveEdit(true)}>Simpan</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {task.description && (
                <p className="text-sm text-muted-foreground">{task.description}</p>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={PRIORITY_STYLES[task.priority]}>
                  <Flag className="w-3 h-3 mr-1" />
                  {PRIORITY_LABELS[task.priority]}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Tenggat {format(new Date(task.deadline), "d MMMM yyyy", { locale: localeID })}
                </span>
              </div>

              {/* Status - only employee can change, completed is locked */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Status</label>
                {!isAdmin && task.status !== "completed" ? (
                  <Select value={task.status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{STATUS_LABELS[task.status]}</Badge>
                    {task.status === "completed" && !isAdmin && (
                      <span className="text-[10px] text-muted-foreground">Tugas selesai tidak dapat diubah</span>
                    )}
                  </div>
                )}
              </div>

              {/* Lampiran - karyawan bisa tambah, hanya admin bisa hapus */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-primary" /> Lampiran
                  </h3>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip,.rar"
                    onChange={handleAddAttachment}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs gap-1 h-7"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAttachment}
                  >
                    <Paperclip className="w-3 h-3" /> {uploadingAttachment ? "Mengunggah..." : "Tambah"}
                  </Button>
                </div>
                {attachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Belum ada lampiran.</p>
                ) : (
                  <div className="space-y-1.5">
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted group">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{att.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => downloadAttachment(att)}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {isAdmin && (
                          <button onClick={() => removeAttachment(att.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Catatan Progres - semua bisa tambah */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <MessageCircleCodeIcon className="w-4 h-4 text-primary" /> Catatan Progres
                </h3>
                {task.notes.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Belum ada catatan.</p>
                )}
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {task.notes.map((note) => (
                    <div key={note.id} className="bg-muted rounded-md p-3">
                      <p className="text-sm text-foreground">{note.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">{note.createdAt}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Tambahkan catatan progres..."
                    className="min-h-[60px] text-sm"
                  />
                  <Button size="icon" onClick={handleAddNote} disabled={!noteText.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Hapus tugas ini?"
        description="Tugas akan dihapus secara permanen."
        confirmText="Hapus"
        variant="destructive"
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={confirmSaveEdit}
        onOpenChange={setConfirmSaveEdit}
        title="Simpan perubahan?"
        description="Perubahan tugas akan disimpan."
        onConfirm={saveEdit}
      />
      <ConfirmDialog
        open={confirmAddNote}
        onOpenChange={setConfirmAddNote}
        title="Simpan catatan progres?"
        description="Catatan akan ditambahkan ke tugas ini."
        onConfirm={doAddNote}
      />
      <ConfirmDialog
        open={!!confirmStatusChange}
        onOpenChange={(open) => { if (!open) setConfirmStatusChange(null); }}
        title="Ubah status tugas?"
        description={`Status akan diubah ke "${confirmStatusChange ? STATUS_LABELS[confirmStatusChange] : ""}".`}
        onConfirm={doStatusChange}
      />

      {/* Completion Documentation Dialog */}
      <Dialog open={completionOpen} onOpenChange={(open) => { if (!open) { setCompletionOpen(false); setCompletionFiles([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Dokumentasi Penyelesaian Tugas</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Upload minimal 1 file dokumentasi (gambar/PDF) sebagai bukti penyelesaian tugas.</p>
          <div className="space-y-3">
            <input ref={completionFileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleCompletionFileChange} className="hidden" />
            <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full border-dashed" onClick={() => completionFileRef.current?.click()}>
              <Paperclip className="w-3.5 h-3.5" /> Pilih File Dokumentasi
            </Button>
            {completionFiles.length > 0 && (
              <div className="space-y-1.5">
                {completionFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted text-xs">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1 text-foreground">{file.name}</span>
                    <span className="text-muted-foreground shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                    <button type="button" onClick={() => setCompletionFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full text-xs" disabled={completionFiles.length === 0 || uploadingCompletion} onClick={confirmCompletion}>
              {uploadingCompletion ? "Mengunggah dokumentasi..." : `Selesaikan Tugas (${completionFiles.length} file)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TaskDetailModal;
