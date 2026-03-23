import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import type {
  AttendanceRecord,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  User,
} from "@/types";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  Clock,
  Download,
  FileText,
  Filter,
  Image,
  Paperclip,
  Plus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { id as localeID } from "date-fns/locale";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useNavigate, useParams } from "react-router-dom";

const STATUS_BADGE: Record<string, string> = {
  present: "bg-success/10 text-success border-success/20",
  late: "bg-warning/10 text-warning border-warning/20",
  absent: "bg-destructive/10 text-destructive border-destructive/20",
  leave: "bg-primary/10 text-primary border-primary/20",
};
const STATUS_LABEL: Record<string, string> = {
  present: "Hadir",
  late: "Terlambat",
  absent: "Tidak Hadir",
  leave: "Cuti/Izin",
};
const REASON_LABEL: Record<string, string> = {
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
  "dinas luar": "Dinas Luar",
};
const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  webhook: "Biocloud",
  import: "Import",
};
const LEAVE_LABEL: Record<string, string> = {
  annual: "Cuti Tahunan",
  sick: "Sakit",
  permission: "Izin",
};
const REQUEST_BADGE: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};
const REQUEST_LABEL: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

type PeriodFilter = "today" | "week" | "month" | "year" | "all";

function getDateRange(
  period: PeriodFilter,
): { startDate?: string; endDate?: string } {
  const now = new Date();
  switch (period) {
    case "today": {
      const today = format(now, "yyyy-MM-dd");
      return { startDate: today, endDate: today };
    }
    case "week":
      return {
        startDate: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        endDate: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    case "month":
      return {
        startDate: format(startOfMonth(now), "yyyy-MM-dd"),
        endDate: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    case "year":
      return {
        startDate: format(startOfYear(now), "yyyy-MM-dd"),
        endDate: format(endOfYear(now), "yyyy-MM-dd"),
      };
    default:
      return {};
  }
}

const apiBase = import.meta.env.VITE_API_URL || "";

const Attendance = () => {
  const { user, isAdmin, users } = useAuth();
  const { employeeId } = useParams<{ employeeId?: string }>();
  const navigate = useNavigate();

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);

  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>("today");

  const importRef = useRef<HTMLInputElement>(null);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editProofFile, setEditProofFile] = useState<File | null>(null);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveAttachments, setLeaveAttachments] = useState<string[]>([]);
  const leaveFileRef = useRef<HTMLInputElement>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);

  const employees = useMemo(() => users.filter((u) => u.role === "employee"), [
    users,
  ]);


  const getMatchedUser = (record: AttendanceRecord): User | undefined => {
    let foundUser = users.find((u) => u.id === record.userId);

    if (!foundUser && record.userName) {
      foundUser = users.find((u) =>
        u.name.toLowerCase() === record.userName?.toLowerCase()
      );
    }
    console.log(foundUser);
    
    return foundUser;
  };

  const getAttendanceName = (record: AttendanceRecord) => {
    const foundUser = getMatchedUser(record);
    if (foundUser) return foundUser.name;
    if (record.userName) return record.userName;
    return record.userId;
  };

  useEffect(() => {
    const params: Record<string, string> = {};

    if (!isAdmin && user) {
      params.userName = user.name;
    } else if (isAdmin) {
      if (filterEmployee !== "all") {
        const selectedEmp = users.find((u) => u.id === filterEmployee);
        if (selectedEmp) {
          params.userName = selectedEmp.name;
        }
      }

      const range = getDateRange(filterPeriod);
      if (range.startDate) params.startDate = range.startDate;
      if (range.endDate) params.endDate = range.endDate;
    }

    api.getAttendance(params).then(setAttendance).catch(() => {});

    // Leave request tetap menggunakan userId karena ini murni data dari aplikasi internal
    const leaveParams: Record<string, string> = {};
    if (!isAdmin && user) leaveParams.userId = user.id;
    api.getLeaveRequests(leaveParams).then(setLeaveRequests).catch(() => {});

    if (!isAdmin && user) {
      api.getLeaveBalance().then(setBalance).catch(() => {});
    }
  }, [isAdmin, user, filterEmployee, filterPeriod]);

  const handleApprove = async (id: string) => {
    try {
      await api.approveLeaveRequest(id, "approved");
      setLeaveRequests(
        leaveRequests.map((l) =>
          l.id === id
            ? { ...l, status: "approved" as const, approvedBy: user?.id }
            : l
        ),
      );
      setConfirmApprove(null);
      toast.success("Pengajuan disetujui");
    } catch {
      toast.error("Gagal menyetujui");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.approveLeaveRequest(id, "rejected");
      setLeaveRequests(
        leaveRequests.map((l) =>
          l.id === id ? { ...l, status: "rejected" as const } : l
        ),
      );
      setConfirmReject(null);
      toast.info("Pengajuan ditolak");
    } catch {
      toast.error("Gagal menolak");
    }
  };

  const exportCSV = () => {
    const header =
      "Tanggal,Karyawan,Masuk,Keluar,Status,Alasan,Lokasi,Sumber\n";
    // Filter data export menggunakan fungsi pencocokan yang baru
    const data = attendance.filter((a) => {
      if (!employeeId) return true;
      const matchedUser = getMatchedUser(a);
      return matchedUser?.id === employeeId;
    });

    const rows = data.map((a) => {
      const name = getAttendanceName(a);
      return `${a.date},${name},${a.clockIn || "-"},${a.clockOut || "-"},${
        STATUS_LABEL[a.status]
      },${a.reason || "-"},${a.location},${SOURCE_LABEL[a.source || "manual"]}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kehadiran_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Data kehadiran diekspor");
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await api.importAttendance(formData);
      toast.success(`${result.imported} data berhasil diimport`);
      const params: Record<string, string> = {};
      if (employeeId) {
        const emp = users.find((u) => u.id === employeeId);
        if (emp) params.userName = emp.name;
      }
      api.getAttendance(params).then(setAttendance);
    } catch {
      toast.error("Gagal import CSV");
    }
    if (importRef.current) importRef.current.value = "";
  };

  const handleEditSave = async () => {
    if (!editRecord) return;
    try {
      if (editProofFile) {
        const formData = new FormData();
        formData.append("proof", editProofFile);
        await api.uploadAttendanceProof(editRecord.id, formData);
      }
      const updated = await api.updateAttendance(editRecord.id, {
        reason: editReason,
      });
      setAttendance(
        attendance.map((a) =>
          a.id === editRecord.id
            ? {
              ...a,
              reason: editReason,
              proofImage: updated.proofImage || a.proofImage,
            }
            : a
        ),
      );
      setEditRecord(null);
      setEditProofFile(null);
      toast.success("Data diperbarui");
    } catch {
      toast.error("Gagal memperbarui data");
    }
  };

  const handleLeaveFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileNames = Array.from(e.target.files).map((f) => f.name);
      setLeaveAttachments((prev) => [...prev, ...fileNames]);
    }
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayRecords = attendance.filter((a) => a.date === todayStr);
  const presentCount =
    todayRecords.filter((a) => a.status === "present").length;
  const lateCount = todayRecords.filter((a) => a.status === "late").length;
  const absentCount = employees.length - todayRecords.length;

  // ========= ADMIN VIEW =========
  if (isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Kehadiran
          </h1>
          <div className="flex gap-2">
            <input
              type="file"
              ref={importRef}
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => importRef.current?.click()}
            >
              Import CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={exportCSV}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="ms-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {employees.length}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Total Karyawan
            </p>
          </div>
          <div className="ms-card p-4 text-center">
            <p className="text-2xl font-bold text-success">{presentCount}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Hadir Hari Ini
            </p>
          </div>
          <div className="ms-card p-4 text-center">
            <p className="text-2xl font-bold text-warning">{lateCount}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Terlambat</p>
          </div>
          <div className="ms-card p-4 text-center">
            <p className="text-2xl font-bold text-destructive">
              {absentCount < 0 ? 0 : absentCount}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Belum Hadir
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="ms-card p-3 flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Karyawan:
            </Label>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="text-xs h-8 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className=" max-h-96">
                <SelectItem value="all" className="text-xs">
                  Semua Karyawan
                </SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Periode:
            </Label>
            <Select
              value={filterPeriod}
              onValueChange={(v) => setFilterPeriod(v as PeriodFilter)}
            >
              <SelectTrigger className="text-xs h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-xs">
                  Hari Ini
                </SelectItem>
                <SelectItem value="week" className="text-xs">
                  Minggu Ini
                </SelectItem>
                <SelectItem value="month" className="text-xs">
                  Bulan Ini
                </SelectItem>
                <SelectItem value="year" className="text-xs">
                  Tahun Ini
                </SelectItem>
                <SelectItem value="all" className="text-xs">Semua</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="ms-card p-4">
          <h2 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" /> Data Kehadiran
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {attendance.length} data
            </Badge>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2 font-medium">Bukti</th>
                  <th className="text-left py-2 px-2 font-medium">Nama</th>
                  <th className="text-left py-2 px-2 font-medium">Tanggal</th>
                  <th className="text-left py-2 px-2 font-medium">Masuk</th>
                  <th className="text-left py-2 px-2 font-medium">Keluar</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-left py-2 px-2 font-medium">Alasan</th>
                  <th className="text-left py-2 px-2 font-medium">Lokasi</th>
                  <th className="text-left py-2 px-2 font-medium">Sumber</th>
                  <th className="text-left py-2 px-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {attendance.length === 0
                  ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Tidak ada data kehadiran
                      </td>
                    </tr>
                  )
                  : attendance.map((a, i) => (
                    <tr
                      key={a.id}
                      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                        i % 2 === 0 ? "" : "bg-muted/10"
                      }`}
                    >
                      <td className="py-2 px-2">
                        {a.proofImage
                          ? (
                            <button
                              onClick={() =>
                                navigate(
                                  `/attendance/${a.userId}/proof/${a.id}`,
                                )}
                              className="flex items-center justify-center w-8 h-8 rounded border border-border overflow-hidden hover:ring-2 ring-primary transition-all"
                            >
                              <img
                                src={`${apiBase}${a.proofImage}`}
                                alt="bukti"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          )
                          : (
                            <span className="flex items-center justify-center w-8 h-8 rounded border border-border/50 text-muted-foreground">
                              <Image className="w-3.5 h-3.5" />
                            </span>
                          )}
                      </td>
                      <td className="py-2 px-2 font-medium text-foreground">
                        {getAttendanceName(a)}
                      </td>
                      <td className="py-2 px-2">{a.date}</td>
                      <td className="py-2 px-2">{a.clockIn || "-"}</td>
                      <td className="py-2 px-2">{a.clockOut || "-"}</td>
                      <td className="py-2 px-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            STATUS_BADGE[a.status]
                          }`}
                        >
                          {STATUS_LABEL[a.status]}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {a.reason ? REASON_LABEL[a.reason] || a.reason : "-"}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {a.location || "-"}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[10px]">
                          {SOURCE_LABEL[a.source || "manual"]}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => {
                            setEditRecord(a);
                            setEditReason(a.reason || "");
                            setEditProofFile(null);
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leave Requests */}
        <div className="ms-card p-4">
          <h2 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-primary" />{" "}
            Pengajuan Cuti / Izin
          </h2>
          {leaveRequests.length === 0
            ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Belum ada pengajuan
              </p>
            )
            : (
              <div className="space-y-2">
                {leaveRequests.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {users.find((u) => u.id === l.userId)?.name ||
                            l.userId}
                        </span>
                        <span className="text-xs text-muted-foreground">—</span>
                        <span className="text-xs font-medium text-foreground">
                          {LEAVE_LABEL[l.type]}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            REQUEST_BADGE[l.status]
                          }`}
                        >
                          {REQUEST_LABEL[l.status]}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {l.startDate} — {l.endDate}
                      </p>
                    </div>
                    {l.status === "pending" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-success"
                          onClick={() => setConfirmApprove(l.id)}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => setConfirmReject(l.id)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>

        <ConfirmDialog
          open={!!confirmApprove}
          onOpenChange={(o) => {
            if (!o) setConfirmApprove(null);
          }}
          title="Setujui pengajuan ini?"
          onConfirm={() => confirmApprove && handleApprove(confirmApprove)}
        />
        <ConfirmDialog
          open={!!confirmReject}
          onOpenChange={(o) => {
            if (!o) setConfirmReject(null);
          }}
          title="Tolak pengajuan ini?"
          variant="destructive"
          confirmText="Tolak"
          onConfirm={() => confirmReject && handleReject(confirmReject)}
        />
      </motion.div>
    );
  }

  // ========= EMPLOYEE VIEW =========
  const handleSubmitLeave = () => {
    if (!leaveStart || !leaveEnd || leaveAttachments.length === 0) {
      toast.error("Lengkapi semua data dan lampiran wajib");
      return;
    }
    setConfirmLeave(true);
  };

  async function doSubmitLeave() {
    try {
      const newLeave = await api.createLeaveRequest({
        type: leaveType,
        startDate: leaveStart,
        endDate: leaveEnd,
        attachments: leaveAttachments,
      });
      setLeaveRequests([newLeave, ...leaveRequests]);
      setLeaveOpen(false);
      setLeaveAttachments([]);
      setLeaveStart("");
      setLeaveEnd("");
      setConfirmLeave(false);
      toast.success("Pengajuan cuti berhasil dikirim");
    } catch {
      toast.error("Gagal mengirim pengajuan");
      setConfirmLeave(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
    >
      <h1 className="text-lg font-semibold text-foreground">Kehadiran</h1>
      <div className="ms-card p-4">
        <h2 className="text-xs font-semibold text-foreground mb-3">
          Riwayat Kehadiran
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 px-2 font-medium">Bukti</th>
                <th className="text-left py-2 px-2 font-medium">Nama</th>
                <th className="text-left py-2 px-2 font-medium">Tanggal</th>
                <th className="text-left py-2 px-2 font-medium">Masuk</th>
                <th className="text-left py-2 px-2 font-medium">Keluar</th>
                <th className="text-left py-2 px-2 font-medium">Status</th>
                <th className="text-left py-2 px-2 font-medium">Alasan</th>
                <th className="text-left py-2 px-2 font-medium">Lokasi</th>
                <th className="text-left py-2 px-2 font-medium">Sumber</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length === 0
                ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Tidak ada data kehadiran
                    </td>
                  </tr>
                )
                : attendance.map((a, i) => (
                  <tr
                    key={a.id}
                    className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                      i % 2 === 0 ? "" : "bg-muted/10"
                    }`}
                  >
                    <td className="py-2 px-2">
                      {a.proofImage
                        ? (
                          <button
                            onClick={() =>
                              navigate(
                                `/attendance/${a.userId}/proof/${a.id}`,
                              )}
                            className="flex items-center justify-center w-8 h-8 rounded border border-border overflow-hidden hover:ring-2 ring-primary transition-all"
                          >
                            <img
                              src={`${apiBase}${a.proofImage}`}
                              alt="bukti"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        )
                        : (
                          <span className="flex items-center justify-center w-8 h-8 rounded border border-border/50 text-muted-foreground">
                            <Image className="w-3.5 h-3.5" />
                          </span>
                        )}
                    </td>
                    <td className="py-2 px-2 font-medium text-foreground">
                      {getAttendanceName(a)}
                    </td>
                    <td className="py-2 px-2">{a.date}</td>
                    <td className="py-2 px-2">{a.clockIn || "-"}</td>
                    <td className="py-2 px-2">{a.clockOut || "-"}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          STATUS_BADGE[a.status]
                        }`}
                      >
                        {STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {a.reason ? REASON_LABEL[a.reason] || a.reason : "-"}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {a.location || "-"}
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className="text-[10px]">
                        {SOURCE_LABEL[a.source || "manual"]}
                      </Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="ms-card p-4">
        <h2 className="text-xs font-semibold text-foreground mb-3">
          Pengajuan Cuti / Izin
        </h2>
        {leaveRequests.length === 0
          ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Belum ada pengajuan
            </p>
          )
          : (
            <div className="space-y-2">
              {leaveRequests.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {LEAVE_LABEL[l.type]}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          REQUEST_BADGE[l.status]
                        }`}
                      >
                        {REQUEST_LABEL[l.status]}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {l.startDate} — {l.endDate}
                    </p>
                    {l.attachments && l.attachments.length > 0 && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Paperclip className="w-2.5 h-2.5" />{" "}
                        {l.attachments.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Kirim pengajuan cuti?"
        description="Pengajuan akan dikirim ke admin."
        onConfirm={doSubmitLeave}
      />
    </motion.div>
  );
};

export default Attendance;
