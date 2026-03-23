import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import type { PayslipData } from "@/types";
import { motion } from "framer-motion";
import { FileText, Download, Lock, Eye, Plus, Edit2, Trash2, X, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmployeeGrid, { EmployeeHeader } from "@/components/EmployeeGrid";
import { EmployeeGridSkeleton, PayslipCardSkeleton } from "@/components/PageSkeleton";

interface PayslipAllowance { name: string; amount: number; }
interface PayslipDeduction { name: string; amount: number; }

const MONTH_NAMES = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const formatCurrency = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const Payslip = () => {
  const { employeeId, slipId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useAuth();

  const isAddMode = location.pathname.endsWith("/add");
  const isEditMode = !!slipId;

  const [payslips, setPayslips] = useState<PayslipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<PayslipData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");

  // Form state
  const [formMonth, setFormMonth] = useState("1");
  const [formYear, setFormYear] = useState("2026");
  const [formBasicSalary, setFormBasicSalary] = useState("");
  const [formAllowances, setFormAllowances] = useState<PayslipAllowance[]>([{ name: "Tunjangan Makan", amount: 0 }]);
  const [formDeductions, setFormDeductions] = useState<PayslipDeduction[]>([{ name: "BPJS Kesehatan", amount: 0 }]);

  // Fetch payslips
  const fetchPayslips = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (employeeId) params.userId = employeeId;
      else if (!isAdmin && user?.id) params.userId = user.id;
      const data = await api.getPayslips(params);
      setPayslips(data);
    } catch (err) {
      console.error("Failed to load payslips:", err);
      toast.error("Gagal memuat data slip gaji");
    } finally {
      setLoading(false);
    }
  }, [employeeId, isAdmin, user?.id]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  const handlePinVerify = () => {
    const userPin = user?.pin || "1234";
    if (pinInput === userPin) { setPinVerified(true); setPinDialogOpen(false); setPinInput(""); toast.success("PIN terverifikasi"); }
    else { toast.error("PIN salah"); }
  };

  const handleViewSlip = (slip: PayslipData) => {
    if (!pinVerified && !isAdmin) { setPinDialogOpen(true); return; }
    setSelectedSlip(slip); setDetailOpen(true);
  };

  const totalAllowances = (slip: PayslipData) => slip.allowances.reduce((s, a) => s + a.amount, 0);
  const totalDeductions = (slip: PayslipData) => slip.deductions.reduce((s, d) => s + d.amount, 0);

  const { users } = useAuth();
  const slipUser = (slip: PayslipData) => users.find((u) => u.id === slip.userId);

  const updateAllowance = (index: number, field: "name" | "amount", value: string) => {
    setFormAllowances((prev) => prev.map((a, i) => i === index ? { ...a, [field]: field === "amount" ? parseInt(value) || 0 : value } : a));
  };
  const updateDeduction = (index: number, field: "name" | "amount", value: string) => {
    setFormDeductions((prev) => prev.map((d, i) => i === index ? { ...d, [field]: field === "amount" ? parseInt(value) || 0 : value } : d));
  };

  const handleDeleteSlip = async () => {
    if (confirmDeleteId) {
      try {
        await api.deletePayslip(confirmDeleteId);
        setPayslips((prev) => prev.filter((s) => s.id !== confirmDeleteId));
        setConfirmDeleteId(null);
        toast.success("Slip gaji dihapus");
      } catch {
        toast.error("Gagal menghapus slip gaji");
      }
    }
  };

  // ===== ADMIN: Employee Grid =====
  if (isAdmin && !employeeId) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        <h1 className="text-lg font-semibold text-foreground">Slip Gaji</h1>
        {loading ? <EmployeeGridSkeleton /> : <EmployeeGrid basePath="/payslip" />}
      </motion.div>
    );
  }

  // ===== ADMIN: Add/Edit Slip Form (full page) =====
  if (isAdmin && employeeId && (isAddMode || isEditMode)) {
    // Initialize form for edit mode
    if (isEditMode && slipId) {
      const slip = payslips.find((s) => s.id === slipId);
      if (slip && formBasicSalary === "") {
        setFormMonth(String(slip.month));
        setFormYear(String(slip.year));
        setFormBasicSalary(String(slip.basicSalary));
        setFormAllowances([...slip.allowances]);
        setFormDeductions([...slip.deductions]);
      }
    }

    const handleSave = async () => {
      const basic = parseInt(formBasicSalary);
      if (!basic) { toast.error("Lengkapi gaji pokok"); return; }
      const allowances = formAllowances.filter((a) => a.name.trim() && a.amount > 0);
      const deductions = formDeductions.filter((d) => d.name.trim() && d.amount > 0);
      const netSalary = basic + allowances.reduce((s, a) => s + a.amount, 0) - deductions.reduce((s, d) => s + d.amount, 0);

      try {
        if (isEditMode && slipId) {
          const updated = await api.updatePayslip(slipId, {
            userId: employeeId, month: parseInt(formMonth), year: parseInt(formYear),
            basicSalary: basic, allowances, deductions, netSalary,
          });
          setPayslips((prev) => prev.map((s) => s.id === slipId ? updated : s));
          toast.success("Slip gaji diperbarui");
        } else {
          const created = await api.createPayslip({
            userId: employeeId, month: parseInt(formMonth), year: parseInt(formYear),
            basicSalary: basic, allowances, deductions, netSalary,
          });
          setPayslips((prev) => [created, ...prev]);
          toast.success("Slip gaji ditambahkan");
        }
        navigate(`/payslip/${employeeId}`);
      } catch {
        toast.error("Gagal menyimpan slip gaji");
      }
    };

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-8xl">
        <EmployeeHeader employeeId={employeeId} backPath={`/payslip/${employeeId}`} />
        <h2 className="text-sm font-semibold text-foreground">{isEditMode ? "Edit Slip Gaji" : "Tambah Slip Gaji"}</h2>
        <div className="ms-card p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Bulan</Label>
              <Select value={formMonth} onValueChange={setFormMonth}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTH_NAMES.slice(1).map((m, i) => <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Tahun</Label><Input type="number" value={formYear} onChange={(e) => setFormYear(e.target.value)} className="text-xs" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Gaji Pokok (Rp)</Label><Input type="number" value={formBasicSalary} onChange={(e) => setFormBasicSalary(e.target.value)} placeholder="6500000" className="text-xs" /></div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Tunjangan</Label>
              <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2" onClick={() => setFormAllowances([...formAllowances, { name: "", amount: 0 }])}><Plus className="w-3 h-3 mr-1" /> Tambah</Button>
            </div>
            {formAllowances.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={a.name} onChange={(e) => updateAllowance(i, "name", e.target.value)} placeholder="Nama tunjangan" className="text-xs flex-1" />
                <Input type="number" value={a.amount || ""} onChange={(e) => updateAllowance(i, "amount", e.target.value)} placeholder="Jumlah" className="text-xs w-32" />
                <Button size="icon" variant="ghost" className="w-6 h-6 shrink-0 text-destructive" onClick={() => setFormAllowances(formAllowances.filter((_, j) => j !== i))}><X className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Potongan</Label>
              <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2" onClick={() => setFormDeductions([...formDeductions, { name: "", amount: 0 }])}><Plus className="w-3 h-3 mr-1" /> Tambah</Button>
            </div>
            {formDeductions.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={d.name} onChange={(e) => updateDeduction(i, "name", e.target.value)} placeholder="Nama potongan" className="text-xs flex-1" />
                <Input type="number" value={d.amount || ""} onChange={(e) => updateDeduction(i, "amount", e.target.value)} placeholder="Jumlah" className="text-xs w-32" />
                <Button size="icon" variant="ghost" className="w-6 h-6 shrink-0 text-destructive" onClick={() => setFormDeductions(formDeductions.filter((_, j) => j !== i))}><X className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-xs" onClick={() => navigate(`/payslip/${employeeId}`)}>Batal</Button>
            <Button className="flex-1 text-xs" onClick={handleSave}>{isEditMode ? "Simpan Perubahan" : "Tambah Slip Gaji"}</Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ===== ADMIN: Employee Payslip List =====
  if (isAdmin && employeeId) {
    const empSlips = payslips.filter((s) => s.userId === employeeId);

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <EmployeeHeader employeeId={employeeId} backPath="/payslip" />
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => navigate(`/payslip/${employeeId}/add`)}>
          <Plus className="w-3 h-3" /> Tambah Slip
        </Button>

        {loading ? <PayslipCardSkeleton /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {empSlips.map((slip) => (
              <div key={slip.id} className="ms-card-hover p-4 cursor-pointer group" onClick={() => handleViewSlip(slip)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">{MONTH_NAMES[slip.month]} {slip.year}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="w-6 h-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); navigate(`/payslip/${employeeId}/edit/${slip.id}`); }}><Edit2 className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="w-6 h-6 text-destructive opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(slip.id); }}><Trash2 className="w-3 h-3" /></Button>
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground">{formatCurrency(slip.netSalary)}</p>
                <p className="text-[10px] text-muted-foreground">Gaji Bersih</p>
              </div>
            ))}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-md">
            {selectedSlip && (() => {
              const emp = slipUser(selectedSlip);
              const totAllow = totalAllowances(selectedSlip);
              const totDeduct = totalDeductions(selectedSlip);
              return (
                <>
                  <DialogHeader><DialogTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Slip Gaji — {MONTH_NAMES[selectedSlip.month]} {selectedSlip.year}</DialogTitle></DialogHeader>
                  <div className="space-y-3 text-xs">
                    <div className="text-center pb-3 border-b-2 border-foreground">
                      <p className="font-bold text-foreground text-sm tracking-wide">PT. TELNET BANDA ACEH</p>
                      <p className="text-[10px] text-muted-foreground">Jl. T. Umar No. 12, Banda Aceh</p>
                      <p className="text-[10px] text-muted-foreground font-medium mt-1">SLIP GAJI KARYAWAN</p>
                    </div>
                    <table className="w-full text-[11px]"><tbody>
                      <tr><td className="text-muted-foreground py-0.5 w-28">Nama</td><td className="text-foreground font-medium">: {emp?.name}</td></tr>
                      <tr><td className="text-muted-foreground py-0.5">Jabatan</td><td className="text-foreground">: {emp?.position}</td></tr>
                      <tr><td className="text-muted-foreground py-0.5">Periode</td><td className="text-foreground">: {MONTH_NAMES[selectedSlip.month]} {selectedSlip.year}</td></tr>
                    </tbody></table>
                    <div>
                      <div className="bg-primary/10 px-3 py-1.5 rounded-t-md"><p className="font-semibold text-foreground text-[11px]">A. PENGHASILAN</p></div>
                      <table className="w-full border border-border"><tbody>
                        <tr className="border-b border-border"><td className="px-3 py-1.5 text-muted-foreground w-8">1</td><td className="px-3 py-1.5 text-foreground">Gaji Pokok</td><td className="px-3 py-1.5 text-foreground text-right font-medium">{formatCurrency(selectedSlip.basicSalary)}</td></tr>
                        {selectedSlip.allowances.map((a, i) => (<tr key={i} className="border-b border-border"><td className="px-3 py-1.5 text-muted-foreground">{i + 2}</td><td className="px-3 py-1.5 text-foreground">{a.name}</td><td className="px-3 py-1.5 text-foreground text-right">{formatCurrency(a.amount)}</td></tr>))}
                        <tr className="bg-primary/5 font-semibold"><td className="px-3 py-2" colSpan={2}>Total Penghasilan</td><td className="px-3 py-2 text-right text-foreground">{formatCurrency(selectedSlip.basicSalary + totAllow)}</td></tr>
                      </tbody></table>
                    </div>
                    <div>
                      <div className="bg-destructive/10 px-3 py-1.5 rounded-t-md"><p className="font-semibold text-foreground text-[11px]">B. POTONGAN</p></div>
                      <table className="w-full border border-border"><tbody>
                        {selectedSlip.deductions.map((d, i) => (<tr key={i} className="border-b border-border"><td className="px-3 py-1.5 text-muted-foreground w-8">{i + 1}</td><td className="px-3 py-1.5 text-foreground">{d.name}</td><td className="px-3 py-1.5 text-destructive text-right">-{formatCurrency(d.amount)}</td></tr>))}
                        <tr className="bg-destructive/5 font-semibold"><td className="px-3 py-2" colSpan={2}>Total Potongan</td><td className="px-3 py-2 text-right text-destructive">-{formatCurrency(totDeduct)}</td></tr>
                      </tbody></table>
                    </div>
                    <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-3 flex justify-between items-center">
                      <span className="font-bold text-foreground text-sm">GAJI BERSIH</span>
                      <span className="font-bold text-primary text-lg">{formatCurrency(selectedSlip.netSalary)}</span>
                    </div>
                  </div>
                  <Button onClick={() => window.print()} variant="outline" className="w-full gap-1.5 text-xs mt-2"><Download className="w-3.5 h-3.5" /> Unduh / Cetak PDF</Button>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        <ConfirmDialog open={!!confirmDeleteId} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }} title="Hapus slip gaji ini?" description="Slip gaji akan dihapus permanen." variant="destructive" confirmText="Hapus" onConfirm={handleDeleteSlip} />
      </motion.div>
    );
  }

  // ===== EMPLOYEE VIEW =====
  const mySlips = payslips.filter((s) => s.userId === user?.id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Slip Gaji</h1>
        <div className="flex items-center gap-2">
          {pinVerified && <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setChangePinOpen(true)}><KeyRound className="w-3 h-3" /> Ubah PIN</Button>}
          {!pinVerified && <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setPinDialogOpen(true)}><Lock className="w-3 h-3" /> Verifikasi PIN</Button>}
        </div>
      </div>

      {!pinVerified && (
        <div className="ms-card p-8 text-center space-y-3">
          <Lock className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Masukkan PIN untuk mengakses slip gaji</p>
          <Button onClick={() => setPinDialogOpen(true)} className="text-xs">Masukkan PIN</Button>
        </div>
      )}

      {pinVerified && (
        loading ? <PayslipCardSkeleton /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mySlips.map((slip) => (
              <div key={slip.id} className="ms-card-hover p-4 cursor-pointer" onClick={() => handleViewSlip(slip)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /><span className="text-xs font-semibold text-foreground">{MONTH_NAMES[slip.month]} {slip.year}</span></div>
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-lg font-bold text-foreground">{formatCurrency(slip.netSalary)}</p>
                <p className="text-[10px] text-muted-foreground">Gaji Bersih</p>
              </div>
            ))}
          </div>
        )
      )}

      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-sm text-center">Masukkan PIN</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">PIN (maks. 6 digit)</Label>
              <Input type="password" maxLength={6} value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))} placeholder="••••••" className="text-center text-lg tracking-[0.5em]" onKeyDown={(e) => e.key === "Enter" && handlePinVerify()} />
            </div>
            {!user?.pin && <p className="text-[10px] text-muted-foreground text-center">PIN default: 1234</p>}
            <Button onClick={handlePinVerify} className="w-full text-xs">Verifikasi</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Employee Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          {selectedSlip && (() => {
            const emp = slipUser(selectedSlip);
            const totAllow = totalAllowances(selectedSlip);
            const totDeduct = totalDeductions(selectedSlip);
            return (
              <>
                <DialogHeader><DialogTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Slip Gaji — {MONTH_NAMES[selectedSlip.month]} {selectedSlip.year}</DialogTitle></DialogHeader>
                <div className="space-y-3 text-xs">
                  <div className="text-center pb-3 border-b-2 border-foreground">
                    <p className="font-bold text-foreground text-sm tracking-wide">PT. TELNET BANDA ACEH</p>
                    <p className="text-[10px] text-muted-foreground">Jl. T. Umar No. 12, Banda Aceh</p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-1">SLIP GAJI KARYAWAN</p>
                  </div>
                  <table className="w-full text-[11px]"><tbody>
                    <tr><td className="text-muted-foreground py-0.5 w-28">Nama</td><td className="text-foreground font-medium">: {emp?.name}</td></tr>
                    <tr><td className="text-muted-foreground py-0.5">Jabatan</td><td className="text-foreground">: {emp?.position}</td></tr>
                    <tr><td className="text-muted-foreground py-0.5">Periode</td><td className="text-foreground">: {MONTH_NAMES[selectedSlip.month]} {selectedSlip.year}</td></tr>
                  </tbody></table>
                  <div>
                    <div className="bg-primary/10 px-3 py-1.5 rounded-t-md"><p className="font-semibold text-foreground text-[11px]">A. PENGHASILAN</p></div>
                    <table className="w-full border border-border"><tbody>
                      <tr className="border-b border-border"><td className="px-3 py-1.5 text-muted-foreground w-8">1</td><td className="px-3 py-1.5 text-foreground">Gaji Pokok</td><td className="px-3 py-1.5 text-foreground text-right font-medium">{formatCurrency(selectedSlip.basicSalary)}</td></tr>
                      {selectedSlip.allowances.map((a, i) => (<tr key={i} className="border-b border-border"><td className="px-3 py-1.5 text-muted-foreground">{i + 2}</td><td className="px-3 py-1.5 text-foreground">{a.name}</td><td className="px-3 py-1.5 text-foreground text-right">{formatCurrency(a.amount)}</td></tr>))}
                      <tr className="bg-primary/5 font-semibold"><td className="px-3 py-2" colSpan={2}>Total Penghasilan</td><td className="px-3 py-2 text-right text-foreground">{formatCurrency(selectedSlip.basicSalary + totAllow)}</td></tr>
                    </tbody></table>
                  </div>
                  <div>
                    <div className="bg-destructive/10 px-3 py-1.5 rounded-t-md"><p className="font-semibold text-foreground text-[11px]">B. POTONGAN</p></div>
                    <table className="w-full border border-border"><tbody>
                      {selectedSlip.deductions.map((d, i) => (<tr key={i} className="border-b border-border"><td className="px-3 py-1.5 text-muted-foreground w-8">{i + 1}</td><td className="px-3 py-1.5 text-foreground">{d.name}</td><td className="px-3 py-1.5 text-destructive text-right">-{formatCurrency(d.amount)}</td></tr>))}
                      <tr className="bg-destructive/5 font-semibold"><td className="px-3 py-2" colSpan={2}>Total Potongan</td><td className="px-3 py-2 text-right text-destructive">-{formatCurrency(totDeduct)}</td></tr>
                    </tbody></table>
                  </div>
                  <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-3 flex justify-between items-center">
                    <span className="font-bold text-foreground text-sm">GAJI BERSIH</span>
                    <span className="font-bold text-primary text-lg">{formatCurrency(selectedSlip.netSalary)}</span>
                  </div>
                </div>
                <Button onClick={() => window.print()} variant="outline" className="w-full gap-1.5 text-xs mt-2"><Download className="w-3.5 h-3.5" /> Unduh / Cetak PDF</Button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmDeleteId} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }} title="Hapus slip gaji ini?" variant="destructive" confirmText="Hapus" onConfirm={handleDeleteSlip} />

      {/* Change PIN Dialog */}
      <Dialog open={changePinOpen} onOpenChange={(o) => { setChangePinOpen(o); if (!o) { setOldPin(""); setNewPin(""); setConfirmNewPin(""); } }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-sm text-center">Ubah PIN</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">PIN Lama</Label>
              <Input type="password" maxLength={6} value={oldPin} onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))} placeholder="••••••" className="text-center text-lg tracking-[0.5em]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">PIN Baru (maks. 6 digit)</Label>
              <Input type="password" maxLength={6} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="••••••" className="text-center text-lg tracking-[0.5em]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Konfirmasi PIN Baru</Label>
              <Input type="password" maxLength={6} value={confirmNewPin} onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))} placeholder="••••••" className="text-center text-lg tracking-[0.5em]" />
            </div>
            <Button className="w-full text-xs" onClick={async () => {
              const currentPin = user?.pin || "1234";
              if (oldPin !== currentPin) { toast.error("PIN lama salah"); return; }
              if (newPin.length < 4) { toast.error("PIN baru minimal 4 digit"); return; }
              if (newPin !== confirmNewPin) { toast.error("Konfirmasi PIN tidak cocok"); return; }
              try {
                await api.updateProfile({ pin: newPin } as any);
                toast.success("PIN berhasil diubah");
                setChangePinOpen(false);
                setOldPin(""); setNewPin(""); setConfirmNewPin("");
              } catch { toast.error("Gagal mengubah PIN"); }
            }}>Simpan PIN Baru</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Payslip;
