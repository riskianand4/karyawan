import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/contexts/TaskContext";
import { useMessages } from "@/contexts/MessageContext";
import api from "@/lib/api";
import type { Notification } from "@/types";
import { Bell, AlertTriangle, CheckCircle2, Info, MessageCircleCodeIcon, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, isPast, addDays } from "date-fns";
import { id as localeID } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

const ICON_MAP = {
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
  message: MessageCircleCodeIcon,
  deadline: Clock,
};

const COLOR_MAP = {
  warning: "text-warning",
  success: "text-success",
  info: "text-primary",
  message: "text-primary",
  deadline: "text-destructive",
};

interface SmartNotif {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: keyof typeof ICON_MAP;
}

const DISMISSED_KEY = "notif_dismissed_ids";
const DELETED_KEY = "notif_deleted_ids";

const getDismissedIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

const getDeletedIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

const saveDismissedIds = (ids: Set<string>) => {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
};

const NotificationDropdown = () => {
  const navigate = useNavigate();
  const { user, isAdmin, users } = useAuth();
  const { tasks } = useTasks();
  const { messages } = useMessages();
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissedIds);
  const [deleted] = useState<Set<string>>(getDeletedIds);
  const [serverNotifs, setServerNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (api.getToken()) {
      api.getNotifications().then(setServerNotifs).catch(() => {});
    }
  }, []);

  // Re-fetch when popover opens to sync with deletions from Notifications page
  useEffect(() => {
    if (open && api.getToken()) {
      api.getNotifications().then(setServerNotifs).catch(() => {});
    }
  }, [open]);

  const smartNotifs = useMemo<SmartNotif[]>(() => {
    const notifs: SmartNotif[] = [];
    const preferences = user?.notificationSettings ?? {
      taskAssignments: true,
      deadlineReminders: true,
      teamUpdates: false,
    };

    serverNotifs.forEach((n) => {
      notifs.push({ ...n, type: n.type as keyof typeof ICON_MAP, read: n.read || dismissed.has(n.id) });
    });

    if (!user) return notifs;

    const myTasks = isAdmin ? tasks : tasks.filter((t) => t.assigneeId === user.id);
    if (preferences.deadlineReminders) {
      myTasks.forEach((t) => {
        if (isPast(new Date(t.deadline)) && t.status !== "completed") {
          const nid = `overdue-${t.id}`;
          notifs.push({ id: nid, title: "Tugas terlambat", message: `"${t.title}" sudah melewati tenggat`, timestamp: t.deadline, read: dismissed.has(nid), type: "deadline" });
        }
      });

      const tomorrow = addDays(new Date(), 1);
      myTasks.forEach((t) => {
        const d = new Date(t.deadline);
        if (d.toDateString() === tomorrow.toDateString() && t.status !== "completed") {
          const nid = `due-tomorrow-${t.id}`;
          notifs.push({ id: nid, title: "Tenggat besok", message: `"${t.title}" jatuh tempo besok`, timestamp: new Date().toISOString(), read: dismissed.has(nid), type: "warning" });
        }
      });
    }

    const unreadMsgs = messages.filter(
      (m) => (m.toUserId === user.id || m.toUserId === "all") && m.fromUserId !== user.id
    ).slice(0, 3);
    unreadMsgs.forEach((m) => {
      const from = users.find((u) => u.id === m.fromUserId);
      const nid = `msg-notif-${m.id}`;
      notifs.push({ id: nid, title: m.type === "announcement" ? "Pengumuman baru" : "Pesan baru", message: `${from?.name || "?"}: ${m.content.slice(0, 60)}...`, timestamp: m.createdAt, read: dismissed.has(nid) || m.status === "read", type: "message" });
    });

    const seen = new Set<string>();
    const currentDeleted = getDeletedIds();
    return notifs
      .filter((n) => { if (seen.has(n.id) || deleted.has(n.id) || currentDeleted.has(n.id)) return false; seen.add(n.id); return true; })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [user, isAdmin, tasks, messages, dismissed, serverNotifs, users, deleted]);

  const unreadCount = smartNotifs.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const newDismissed = new Set([...dismissed, ...smartNotifs.map((n) => n.id)]);
    setDismissed(newDismissed);
    saveDismissedIds(newDismissed);
    // Update local serverNotifs to mark all as read immediately
    setServerNotifs(prev => prev.map(n => ({ ...n, read: true })));
    api.markAllNotificationsRead().catch(() => {});
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted" aria-label="Buka notifikasi">
          <Bell className="w-4.5 h-4.5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold flex items-center justify-center">{unreadCount}</motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Notifikasi</h3>
          {unreadCount > 0 && (<Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>Tandai semua dibaca</Button>)}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {smartNotifs.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Tidak ada notifikasi</p>
            </div>
          ) : smartNotifs.map((n) => {
            const Icon = ICON_MAP[n.type] || Info;
            const color = COLOR_MAP[n.type] || "text-primary";
            return (
              <div
                key={n.id}
                className={`px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer ${!n.read ? "bg-accent/30" : ""}`}
                onClick={() => {
                  const newDismissed = new Set([...dismissed, n.id]);
                  setDismissed(newDismissed);
                  saveDismissedIds(newDismissed);
                  setOpen(false);
                  const t = (n.title + " " + n.message).toLowerCase();
                  if (t.includes("persetujuan") || t.includes("approval") || t.includes("disetujui") || t.includes("ditolak") || t.includes("pengajuan")) navigate("/approval");
                  else if (t.includes("tugas") || t.includes("task") || t.includes("tinjau")) navigate("/tasks");
                  else if (t.includes("pesan") || t.includes("message")) navigate("/messages");
                  else if (t.includes("kehadiran") || t.includes("attendance") || t.includes("absen")) navigate("/attendance");
                  else if (t.includes("pengumuman") || t.includes("announcement")) navigate("/announcements");
                  else if (t.includes("cuti") || t.includes("leave")) navigate("/attendance");
                  else if (t.includes("catatan") || t.includes("note")) navigate("/notes");
                  else navigate("/notifications");
                }}
              >
                <div className="flex gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.timestamp), { addSuffix: true, locale: localeID })}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-border px-4 py-2">
          <Button variant="ghost" size="sm" className="w-full text-xs h-7 " onClick={() => { setOpen(false); navigate("/notifications"); }}>
            Lihat semua notifikasi
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationDropdown;
