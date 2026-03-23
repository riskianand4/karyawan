import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages, TeamMessage } from "@/contexts/MessageContext";
import { motion } from "framer-motion";
import { MessageCircleCodeIcon, Send, Megaphone, Inbox, Users, Check, X, ArrowRightLeft } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { id as localeID } from "date-fns/locale";
import EmployeeGrid, { EmployeeHeader } from "@/components/EmployeeGrid";
import { useAdminBadges } from "@/hooks/useAdminBadges";

const Messages = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, users } = useAuth();
  const { messages, sendMessage, respondToRequest } = useMessages();
  const adminBadges = useAdminBadges();
  const [content, setContent] = useState("");
  const [targetUser, setTargetUser] = useState("");

  const employees = users.filter((u) => u.role === "employee");
  const otherEmployees = employees.filter((u) => u.id !== user?.id);

  const getUserName = (id: string) => users.find((u) => u.id === id)?.name ?? "Tidak dikenal";
  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("");

  const renderMessage = (msg: TeamMessage) => {
    const fromUser = users.find((u) => u.id === msg.fromUserId);
    const initials = fromUser ? getInitials(fromUser.name) : "?";
    const isRequest = msg.type === "collaboration_request";
    const isPending = isRequest && msg.status === "pending" && msg.toUserId === user?.id;

    return (
      <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <Avatar className="w-9 h-9 shrink-0"><AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback></Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{fromUser?.name}</span>
              <Badge variant="secondary" className="text-[9px]">{msg.type === "announcement" ? "Pengumuman" : msg.type === "collaboration_request" ? "Kolaborasi" : "Pesan"}</Badge>
              {isRequest && <Badge variant="secondary" className={`text-[9px] ${msg.status === "accepted" ? "bg-success/10 text-success" : msg.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>{msg.status === "accepted" ? "Diterima" : msg.status === "rejected" ? "Ditolak" : "Menunggu"}</Badge>}
            </div>
            {msg.toUserId !== "all" && <p className="text-[11px] text-muted-foreground">Kepada: {getUserName(msg.toUserId)}</p>}
            <p className="text-sm text-foreground mt-1.5">{msg.content}</p>
            <p className="text-[10px] text-muted-foreground mt-2">{formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: localeID })}</p>
            {isPending && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { respondToRequest(msg.id, "accepted"); toast.success("Kolaborasi diterima"); }}><Check className="w-3 h-3" /> Terima</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { respondToRequest(msg.id, "rejected"); toast.info("Kolaborasi ditolak"); }}><X className="w-3 h-3" /> Tolak</Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  if (isAdmin && !employeeId) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        <h1 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><MessageCircleCodeIcon className="w-4 h-4 text-primary" /> Pesan Tim</h1>
        <EmployeeGrid basePath="/messages" badgeCounts={Object.fromEntries(Object.entries(adminBadges.perEmployee).map(([k, v]) => [k, v.messages]))} />
      </motion.div>
    );
  }

  if (isAdmin && employeeId) {
    const empName = users.find((u) => u.id === employeeId)?.name || "";
    const empMessages = messages.filter((m) => (m.fromUserId === user?.id && m.toUserId === employeeId) || (m.fromUserId === employeeId && m.toUserId === user?.id) || (m.fromUserId === user?.id && m.toUserId === "all"));

    const handleSend = () => {
      if (!content.trim() || !user) return;
      sendMessage({ fromUserId: user.id, toUserId: employeeId, type: "message", content: content.trim(), status: "read" });
      toast.success("Pesan terkirim"); setContent("");
    };

    const handleAnnouncement = () => {
      if (!content.trim() || !user) return;
      sendMessage({ fromUserId: user.id, toUserId: "all", type: "announcement", content: content.trim(), status: "read" });
      toast.success("Pengumuman terkirim"); setContent("");
    };

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-8xl">
        <EmployeeHeader employeeId={employeeId} backPath="/messages" />
        <div className="ms-card p-4 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">Kirim Pesan ke {empName}</h2>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Tulis pesan atau instruksi..." className="min-h-[100px]" />
          <div className="flex gap-2">
            <Button onClick={handleSend} disabled={!content.trim()} className="gap-1.5 text-xs"><Send className="w-3.5 h-3.5" /> Kirim Pesan</Button>
            <Button onClick={handleAnnouncement} disabled={!content.trim()} variant="outline" className="gap-1.5 text-xs"><Megaphone className="w-3.5 h-3.5" /> Kirim ke Semua</Button>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground">Riwayat Pesan</h3>
          {empMessages.length === 0 ? <EmptyState icon={MessageCircleCodeIcon} title="Belum ada pesan" description="Mulai percakapan dengan mengirim pesan atau pengumuman kepada karyawan ini." compact /> : empMessages.map(renderMessage)}
        </div>
      </motion.div>
    );
  }

  // Employee view
  const myInbox = messages.filter((m) => (m.toUserId === user?.id || m.toUserId === "all") && m.fromUserId !== user?.id);
  const mySent = messages.filter((m) => m.fromUserId === user?.id);
  const pendingRequests = messages.filter((m) => m.toUserId === user?.id && m.type === "collaboration_request" && m.status === "pending");
  const activeCollabs = messages.filter((m) => m.type === "collaboration_request" && m.status === "accepted" && (m.fromUserId === user?.id || m.toUserId === user?.id));

  const handleSendMessage = () => {
    if (!content.trim() || !user || !targetUser) return;
    sendMessage({ fromUserId: user.id, toUserId: targetUser, type: "collaboration_request", content: content.trim(), status: "pending" });
    toast.success("Permintaan kolaborasi terkirim"); setContent(""); setTargetUser("");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 max-w-8xl">
      <h1 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><MessageCircleCodeIcon className="w-4 h-4 text-primary" /> Pesan Tim</h1>
      <Tabs defaultValue="inbox" className="space-y-3">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5"><Inbox className="w-3.5 h-3.5" /> Kotak Masuk</TabsTrigger>
          <TabsTrigger value="collaboration" className="gap-1.5 relative"><ArrowRightLeft className="w-3.5 h-3.5" /> Kolaborasi{pendingRequests.length > 0 && <span className="ml-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[9px] font-bold flex items-center justify-center">{pendingRequests.length}</span>}</TabsTrigger>
          <TabsTrigger value="send" className="gap-1.5"><Send className="w-3.5 h-3.5" /> Minta Kolaborasi</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="space-y-3">{myInbox.filter((m) => m.type !== "collaboration_request").length === 0 ? <EmptyState icon={Inbox} title="Kotak masuk kosong" description="Belum ada pesan atau pengumuman dari admin. Pesan baru akan muncul di sini." compact /> : myInbox.filter((m) => m.type !== "collaboration_request").map(renderMessage)}</TabsContent>
        <TabsContent value="collaboration" className="space-y-3">
          {pendingRequests.length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold text-foreground">Permintaan Masuk</h3>{pendingRequests.map(renderMessage)}</div>}
          {activeCollabs.length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold text-foreground">Kolaborasi Aktif</h3>{activeCollabs.map(renderMessage)}</div>}
          {pendingRequests.length === 0 && activeCollabs.length === 0 && <EmptyState icon={ArrowRightLeft} title="Belum ada kolaborasi" description="Kirim permintaan kolaborasi ke rekan kerja untuk mulai bekerja bersama." compact />}
        </TabsContent>
        <TabsContent value="send" className="space-y-3">
          <div className="ms-card p-4 space-y-3">
            <h2 className="text-xs font-semibold text-foreground">Minta Kolaborasi</h2>
            <Select value={targetUser} onValueChange={setTargetUser}><SelectTrigger className="h-9"><SelectValue placeholder="Pilih rekan kerja..." /></SelectTrigger><SelectContent>{otherEmployees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Jelaskan bantuan yang dibutuhkan..." className="min-h-[100px]" />
            <Button onClick={handleSendMessage} disabled={!content.trim() || !targetUser} className="gap-1.5"><Send className="w-3.5 h-3.5" /> Kirim Permintaan</Button>
          </div>
          {mySent.filter((m) => m.type === "collaboration_request").length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold text-foreground">Permintaan Terkirim</h3>{mySent.filter((m) => m.type === "collaboration_request").map(renderMessage)}</div>}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default Messages;