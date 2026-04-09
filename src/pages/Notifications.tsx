import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/contexts/TaskContext";
import { useMessages } from "@/contexts/MessageContext";
import api from "@/lib/api";
import type { Notification } from "@/types";
import { Bell, AlertTriangle, CheckCircle2, Info, MessageCircleCodeIcon, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, isPast, addDays } from "date-fns";
import { id as localeID } from "date-fns/locale";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

const ICON_MAP: Record<string, any> = {
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
  message: MessageCircleCodeIcon,
  deadline: Clock,
};

const COLOR_MAP: Record<string, string> = {
  warning: "text-warning",
  success: "text-success",
  info: "text-muted",
  message: "text-muted",
  deadline: "text-destructive",
};

interface SmartNotif {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: string;
  isServer?: boolean;
}

const DISMISSED_KEY = "notif_dismissed_ids";
const DELETED_KEY = "notif_deleted_ids";
const getDismissedIds = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]")); } catch { return new Set(); }
};
const getDeletedIds = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(DELETED_KEY) || "[]")); } catch { return new Set(); }
};
const saveDismissedIds = (ids: Set<string>) => {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
};
const saveDeletedIds = (ids: Set<string>) => {
  localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
};

const Notifications = () => {
  const { user, isAdmin, users } = useAuth();
  const { tasks } = useTasks();
  const { messages } = useMessages();
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissedIds);
  const [deleted, setDeleted] = useState<Set<string>>(getDeletedIds);
  const [serverNotifs, setServerNotifs] = useState<Notification[]>([]);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    if (api.getToken()) {
      api.getNotifications().then(setServerNotifs).catch(() => {});
    }
  }, []);

  const allNotifs = useMemo<SmartNotif[]>(() => {
    const notifs: SmartNotif[] = [];

    serverNotifs.forEach((n) => {
      notifs.push({ ...n, type: n.type || "info", read: n.read || dismissed.has(n.id), isServer: true });
    });

    if (!user) return notifs;

    const myTasks = isAdmin ? tasks : tasks.filter((t) => t.assigneeId === user.id);
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

    const unreadMsgs = messages.filter(
      (m) => (m.toUserId === user.id || m.toUserId === "all") && m.fromUserId !== user.id
    ).slice(0, 10);
    unreadMsgs.forEach((m) => {
      const from = users.find((u) => u.id === m.fromUserId);
      const nid = `msg-notif-${m.id}`;
      notifs.push({ id: nid, title: m.type === "announcement" ? "Pengumuman baru" : "Pesan baru", message: `${from?.name || "?"}: ${m.content.slice(0, 80)}`, timestamp: m.createdAt, read: dismissed.has(nid) || m.status === "read", type: "message" });
    });

    const seen = new Set<string>();
    return notifs
      .filter((n) => { if (seen.has(n.id) || deleted.has(n.id)) return false; seen.add(n.id); return true; })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [user, isAdmin, tasks, messages, dismissed, deleted, serverNotifs, users]);

  const markAllRead = () => {
    const newDismissed = new Set([...dismissed, ...allNotifs.map((n) => n.id)]);
    setDismissed(newDismissed);
    saveDismissedIds(newDismissed);
    api.markAllNotificationsRead().catch(() => {});
  };

  const deleteNotif = async (id: string, isServer?: boolean) => {
    const newDeleted = new Set([...deleted, id]);
    setDeleted(newDeleted);
    saveDeletedIds(newDeleted);
    const newDismissed = new Set([...dismissed, id]);
    setDismissed(newDismissed);
    saveDismissedIds(newDismissed);

    if (isServer) {
      try {
        await api.deleteNotification(id);
        setServerNotifs(prev => prev.filter(n => n.id !== id));
      } catch { }
    }
  };

  const clearAll = async () => {
    const allIds = new Set([...deleted, ...allNotifs.map((n) => n.id)]);
    setDeleted(allIds);
    saveDeletedIds(allIds);
    const allDismissed = new Set([...dismissed, ...allNotifs.map((n) => n.id)]);
    setDismissed(allDismissed);
    saveDismissedIds(allDismissed);
    setConfirmClearAll(false);

    try {
      await api.clearAllNotifications();
      setServerNotifs([]);
    } catch { }
  };

  const unreadCount = allNotifs.filter((n) => !n.read).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-primary" /> Notifikasi
          {unreadCount > 0 && <span className="text-[10px] bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5">{unreadCount} belum dibaca</span>}
        </h1>
        <div className="flex gap-1.5">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={markAllRead}>Tandai semua dibaca</Button>
          )}
          {allNotifs.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="w-7 h-7 text-destructive" onClick={() => setConfirmClearAll(true)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Hapus semua</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {allNotifs.length === 0 ? (
        <EmptyState icon={Bell} title="Tidak ada notifikasi" description="Semua notifikasi sudah dibaca atau dihapus." />
      ) : (
        <div className="space-y-1.5">
          {allNotifs.map((n, i) => {
            const Icon = ICON_MAP[n.type] || Info;
            const color = COLOR_MAP[n.type] || "text-primary";
            return (
              <motion.div key={n.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={`ms-card p-3 flex gap-3 group ${!n.read ? "border-primary/20 bg-accent/20" : ""}`}>
                <Icon className={`w-4 h-4 mt-0.5  shrink-0 ${color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.timestamp), { addSuffix: true, locale: localeID })}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="w-6 h-6 opacity-0 group-hover:opacity-100 text-destructive shrink-0" onClick={() => deleteNotif(n.id, n.isServer)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Hapus</TooltipContent>
                </Tooltip>
              </motion.div>
            );
          })}
        </div>
      )}

      <ConfirmDialog open={confirmClearAll} onOpenChange={setConfirmClearAll} title="Hapus semua notifikasi?" description="Semua notifikasi akan dihapus permanen." variant="destructive" confirmText="Hapus Semua" onConfirm={clearAll} />
    </motion.div>
  );
};

export default Notifications;
