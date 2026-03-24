import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api, { getUploadUrl } from "@/lib/api";
import type { User, UserDocument, Gender, MaritalStatus } from "@/types";
import { calculateProfileCompletion, getCompletionColor, formatDocumentType } from "@/lib/profileUtils";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Upload, Camera, User as UserIcon, Phone, MapPin, Heart, CreditCard, FileText, AlertCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";

const RELIGIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lainnya"];
const BANKS = ["BCA", "BNI", "BRI", "Mandiri", "CIMB Niaga", "BTN", "BSI", "Lainnya"];

const EmployeeProfileEditor = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { users, refreshUsers } = useAuth();

  const [employee, setEmployee] = useState<User | null>(null);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<User>>({});

  const fetchData = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const [userData, docs] = await Promise.all([
        api.getUser(employeeId),
        api.getUserDocuments(employeeId),
      ]);
      setEmployee(userData);
      setDocuments(docs);
      setFormData({
        phone: userData.phone || "",
        address: userData.address || "",
        birthPlace: userData.birthPlace || "",
        birthDate: userData.birthDate || "",
        gender: userData.gender,
        religion: userData.religion || "",
        maritalStatus: userData.maritalStatus,
        emergencyContact: userData.emergencyContact || "",
        npwp: userData.npwp || "",
        bpjsKesehatan: userData.bpjsKesehatan || "",
        bpjsKetenagakerjaan: userData.bpjsKetenagakerjaan || "",
        bankName: userData.bankName || "",
        bankAccountNumber: userData.bankAccountNumber || "",
        bankAccountName: userData.bankAccountName || "",
      });
    } catch {
      toast.error("Gagal memuat data karyawan");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!employeeId) return;
    try {
      setSaving(true);
      await api.updateUser(employeeId, formData);
      await refreshUsers();
      toast.success("Data karyawan berhasil disimpan");
      navigate("/accounts");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  };

  const handleDocUpload = async (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employeeId) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      fd.append("userId", employeeId);
      await api.uploadDocument(fd);
      const docs = await api.getUserDocuments(employeeId);
      setDocuments(docs);
      toast.success(`${formatDocumentType(type)} berhasil diupload`);
    } catch {
      toast.error("Gagal upload dokumen");
    }
  };

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate("/accounts")}>
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali
        </Button>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-muted rounded-xl" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate("/accounts")}>
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali
        </Button>
        <p className="text-sm text-muted-foreground text-center py-12">Karyawan tidak ditemukan</p>
      </div>
    );
  }

  const completion = calculateProfileCompletion(employee, documents);
  const initials = employee.name.split(" ").map((n) => n[0]).join("").toUpperCase();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-8xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate("/accounts")}>
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali
        </Button>
        <h1 className="text-sm font-semibold text-foreground">Kelengkapan Profil</h1>
      </div>

      {/* Employee Header */}
      <div className="ms-card p-4 flex items-center gap-4">
        <Avatar className="w-14 h-14">
          {employee.avatar && <AvatarImage src={getUploadUrl(employee.avatar)} />}
          <AvatarFallback className="bg-primary text-lg font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{employee.name}</p>
          <p className="text-xs text-muted-foreground">{employee.position} • {employee.department}</p>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={completion} className="w-24 h-1.5" />
            <span className={`text-[10px] font-medium ${getCompletionColor(completion)}`}>{completion}% lengkap</span>
          </div>
        </div>
      </div>

      {/* Personal Data */}
      <div className="ms-card p-4 space-y-4">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <UserIcon className="w-3.5 h-3.5 " /> Data Pribadi
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">No. Telepon</Label>
            <Input value={formData.phone || ""} onChange={(e) => updateField("phone", e.target.value)} placeholder="08xxxxxxxxxx" className="text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tempat Lahir</Label>
            <Input value={formData.birthPlace || ""} onChange={(e) => updateField("birthPlace", e.target.value)} className="text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tanggal Lahir</Label>
            <Input type="date" value={formData.birthDate || ""} onChange={(e) => updateField("birthDate", e.target.value)} className="text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Jenis Kelamin</Label>
            <Select value={formData.gender || ""} onValueChange={(v) => updateField("gender", v)}>
              <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male" className="text-xs">Laki-laki</SelectItem>
                <SelectItem value="female" className="text-xs">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Agama</Label>
            <Select value={formData.religion || ""} onValueChange={(v) => updateField("religion", v)}>
              <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>
                {RELIGIONS.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status Pernikahan</Label>
            <Select value={formData.maritalStatus || ""} onValueChange={(v) => updateField("maritalStatus", v)}>
              <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single" className="text-xs">Belum Menikah</SelectItem>
                <SelectItem value="married" className="text-xs">Menikah</SelectItem>
                <SelectItem value="divorced" className="text-xs">Cerai</SelectItem>
                <SelectItem value="widowed" className="text-xs">Duda/Janda</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kontak Darurat</Label>
            <Input value={formData.emergencyContact || ""} onChange={(e) => updateField("emergencyContact", e.target.value)} className="text-xs" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Alamat</Label>
          <Textarea value={formData.address || ""} onChange={(e) => updateField("address", e.target.value)} rows={2} className="text-xs" />
        </div>
      </div>

      {/* Financial Data */}
      <div className="ms-card p-4 space-y-4">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5 " /> Data Keuangan & Pajak
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">NPWP</Label>
            <Input value={formData.npwp || ""} onChange={(e) => updateField("npwp", e.target.value)} className="text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">BPJS Kesehatan</Label>
            <Input value={formData.bpjsKesehatan || ""} onChange={(e) => updateField("bpjsKesehatan", e.target.value)} className="text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">BPJS TK</Label>
            <Input value={formData.bpjsKetenagakerjaan || ""} onChange={(e) => updateField("bpjsKetenagakerjaan", e.target.value)} className="text-xs" />
          </div>
        </div>
        <Separator />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Bank</Label>
            <Select value={formData.bankName || ""} onValueChange={(v) => updateField("bankName", v)}>
              <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Pilih bank..." /></SelectTrigger>
              <SelectContent>
                {BANKS.map((b) => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">No. Rekening</Label>
            <Input value={formData.bankAccountNumber || ""} onChange={(e) => updateField("bankAccountNumber", e.target.value)} className="text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Atas Nama</Label>
            <Input value={formData.bankAccountName || ""} onChange={(e) => updateField("bankAccountName", e.target.value)} className="text-xs" />
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="ms-card p-4 space-y-4">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-primary" /> Dokumen Wajib
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(["ktp", "kk", "foto"] as const).map((type) => {
            const doc = documents.find((d) => d.type === type);
            return (
              <div key={type} className="flex flex-col items-center p-3 rounded-lg border border-border bg-card">
                <p className="text-xs font-medium text-foreground mb-2">{formatDocumentType(type)}</p>
                {doc ? (
                  <>
                    <div className="w-16 h-16 rounded bg-success/10 flex items-center justify-center mb-2">
                      <FileText className="w-6 h-6 text-success" />
                    </div>
                    <p className="text-[9px] text-success truncate max-w-full">Terupload ✓</p>
                  </>
                ) : (
                  <>
                    <label className="w-16 h-16 rounded bg-muted flex items-center justify-center mb-2 cursor-pointer hover:bg-muted/80 transition-colors">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => handleDocUpload(type, e)} />
                    </label>
                    <p className="text-[10px] text-destructive">Belum diupload</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/accounts")}>Batal</Button>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="w-3.5 h-3.5" /> {saving ? "Menyimpan..." : "Simpan Data"}
        </Button>
      </div>
    </motion.div>
  );
};

export default EmployeeProfileEditor;
