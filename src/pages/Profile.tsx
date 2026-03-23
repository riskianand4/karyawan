import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import type { User, UserDocument, ContractHistory, Gender, MaritalStatus } from "@/types";
import { calculateProfileCompletion, getCompletionColor, getCompletionBgColor, formatDocumentType, getMissingFields } from "@/lib/profileUtils";
import { motion } from "framer-motion";
import { User as UserIcon, Building2, Phone, MapPin, FileText, Edit2, Save, Upload, Check, X, Calendar, CreditCard, Heart, Users, AlertCircle, Trash2, Eye, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfileSkeleton } from "@/components/PageSkeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";
import Cropper from "react-easy-crop";
import { Slider } from "@/components/ui/slider";
import getCroppedImg, { type CroppedArea } from "@/lib/cropImage";

const RELIGIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lainnya"];
const BANKS = ["BCA", "BNI", "BRI", "Mandiri", "CIMB Niaga", "BTN", "BSI", "Lainnya"];

const Profile = () => {
  const { user, updateProfile } = useAuth();
  
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [contracts, setContracts] = useState<ContractHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const [profileData, setProfileData] = useState<Partial<User>>({});
  const [editing, setEditing] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<UserDocument | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Crop state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(null);

  useEffect(() => {
    if (user) {
      setProfileData({
        phone: user.phone || "",
        emergencyContact: user.emergencyContact || "",
        address: user.address || "",
        birthPlace: user.birthPlace || "",
        birthDate: user.birthDate || "",
        gender: user.gender || undefined,
        religion: user.religion || "",
        maritalStatus: user.maritalStatus || undefined,
        npwp: user.npwp || "",
        bpjsKesehatan: user.bpjsKesehatan || "",
        bpjsKetenagakerjaan: user.bpjsKetenagakerjaan || "",
        bankName: user.bankName || "",
        bankAccountNumber: user.bankAccountNumber || "",
        bankAccountName: user.bankAccountName || "",
      });
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [docs, ctrs] = await Promise.all([
        api.getUserDocuments(user.id),
        api.getContracts(user.id),
      ]);
      setDocuments(docs);
      setContracts(ctrs);
    } catch (err) {
      console.error("Failed to load profile data:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const initials = user?.name?.split(" ").map((n) => n[0]).join("") || "?";

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran foto maksimal 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropComplete = async () => {
    if (!cropImage || !croppedAreaPixels) return;
    try {
      setUploadingAvatar(true);
      const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
      const formData = new FormData();
      formData.append("avatar", croppedBlob, "avatar.jpg");
      const result = await api.uploadAvatar(formData);
      await updateProfile({ avatar: result.avatar });
      toast.success("Foto profil berhasil diperbarui");
      setCropDialogOpen(false);
      setCropImage(null);
    } catch { toast.error("Gagal mengupload foto"); }
    finally { setUploadingAvatar(false); }
  };

  const userDocs = documents.filter((d) => d.userId === user?.id);
  const mergedUser = { ...user, ...profileData } as User;
  const completionPercentage = calculateProfileCompletion(mergedUser, documents);
  const missingFields = getMissingFields(mergedUser, documents);

  const handleSave = async () => {
    try {
      await updateProfile(profileData);
      setEditing(false);
      toast.success("Profil berhasil diperbarui");
    } catch {
      toast.error("Gagal memperbarui profil");
    }
  };

  const handleFileUpload = async (type: UserDocument["type"], e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran file maksimal 5MB"); return; }
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      formData.append("userId", user.id);
      const newDoc = await api.uploadDocument(formData);
      setDocuments((prev) => [...prev.filter((d) => !(d.userId === user.id && d.type === type)), newDoc]);
      toast.success(`${formatDocumentType(type)} berhasil diupload`);
    } catch {
      toast.error("Gagal mengupload dokumen");
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Dokumen berhasil dihapus");
    } catch {
      toast.error("Gagal menghapus dokumen");
    }
  };

  const getDocByType = (type: UserDocument["type"]) => userDocs.find((d) => d.type === type);

  const ReadOnlyDocBox = ({ type, label }: { type: UserDocument["type"]; label: string }) => {
    const doc = getDocByType(type);
    const isRequired = ["ktp", "kk", "foto"].includes(type);
    return (
      <div className="flex flex-col items-center p-3 border border-border rounded-lg bg-card">
        <p className="text-xs font-medium text-foreground mb-1">{label}</p>
        {isRequired && <Badge variant="outline" className="text-[8px] mb-2">Wajib</Badge>}
        {doc ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded flex items-center justify-center">
              <Check className="w-5 h-5 text-success" />
            </div>
            <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{doc.fileName}</p>
            {doc.fileUrl && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPreviewDoc(doc)}><Eye className="w-3 h-3" /></Button>
            )}
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded flex items-center justify-center">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
            <span className="text-[10px] ">Upload</span>
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(type, e)} />
          </label>
        )}
      </div>
    );
  };

  if (loading) return <ProfileSkeleton />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 max-w-8xl">
      <h1 className="text-lg font-semibold text-foreground">Profil Saya</h1>

      {/* Header with completion */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative group">
              <Avatar className="w-16 h-16">
                {user?.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {uploadingAvatar ? <span className="text-white text-[10px]">...</span> : <Camera className="w-5 h-5 text-white" />}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} disabled={uploadingAvatar} />
              </label>
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-foreground">{user?.name}</h2>
              <p className="text-xs text-muted-foreground">{user?.position} • {user?.department}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px]">{user?.contractType}</Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{user?.role === "admin" ? "Admin" : "Karyawan"}</Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground mb-1">Kelengkapan Profil</p>
              <div className="flex items-center gap-2">
                <Progress value={completionPercentage} className="w-24 h-2" />
                <span className={`text-sm font-semibold  ${getCompletionColor(completionPercentage)}`}>{completionPercentage}%</span>
              </div>
            </div>
          </div>

          {missingFields.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-warning">Profil Belum Lengkap</p>
                <p className="text-[10px] text-muted-foreground">Lengkapi: {missingFields.join(", ")}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-3.5 h-3.5" />
              <span>Bergabung {user?.joinDate ? format(new Date(user.joinDate), "d MMMM yyyy", { locale: localeID }) : "-"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserIcon className="w-3.5 h-3.5" />
              <span>{user?.email}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Data — Read Only */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <UserIcon className="w-4 h-4 " /> Data Pribadi
            </CardTitle>
            <Button size="sm" variant="ghost" className="text-xs gap-1 h-7" onClick={() => editing ? handleSave() : setEditing(true)}>
              {editing ? <><Save className="w-3 h-3" /> Simpan</> : <><Edit2 className="w-3 h-3" /> Ubah</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Tempat Lahir</Label>
              {editing ? <Input value={profileData.birthPlace || ""} onChange={(e) => setProfileData((p) => ({ ...p, birthPlace: e.target.value }))} placeholder="cth. Banda Aceh" className="text-xs" /> : <p className="text-xs text-foreground">{profileData.birthPlace || "-"}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Tanggal Lahir</Label>
              {editing ? <Input type="date" value={profileData.birthDate || ""} onChange={(e) => setProfileData((p) => ({ ...p, birthDate: e.target.value }))} className="text-xs" /> : <p className="text-xs text-foreground">{profileData.birthDate ? format(new Date(profileData.birthDate), "d MMMM yyyy", { locale: localeID }) : "-"}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Jenis Kelamin</Label>
              {editing ? (
                <Select value={profileData.gender || ""} onValueChange={(v) => setProfileData((p) => ({ ...p, gender: v as Gender }))}>
                  <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male" className="text-xs">Laki-laki</SelectItem>
                    <SelectItem value="female" className="text-xs">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              ) : <p className="text-xs text-foreground">{profileData.gender === "male" ? "Laki-laki" : profileData.gender === "female" ? "Perempuan" : "-"}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Agama</Label>
              {editing ? (
                <Select value={profileData.religion || ""} onValueChange={(v) => setProfileData((p) => ({ ...p, religion: v }))}>
                  <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>{RELIGIONS.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}</SelectContent>
                </Select>
              ) : <p className="text-xs text-foreground">{profileData.religion || "-"}</p>}
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Heart className="w-3 h-3" /> Status Perkawinan</Label>
              {editing ? (
                <Select value={profileData.maritalStatus || ""} onValueChange={(v) => setProfileData((p) => ({ ...p, maritalStatus: v as MaritalStatus }))}>
                  <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single" className="text-xs">Belum Menikah</SelectItem>
                    <SelectItem value="married" className="text-xs">Menikah</SelectItem>
                    <SelectItem value="divorced" className="text-xs">Cerai</SelectItem>
                    <SelectItem value="widowed" className="text-xs">Duda/Janda</SelectItem>
                  </SelectContent>
                </Select>
              ) : <p className="text-xs text-foreground">{profileData.maritalStatus === "single" ? "Belum Menikah" : profileData.maritalStatus === "married" ? "Menikah" : profileData.maritalStatus === "divorced" ? "Cerai" : profileData.maritalStatus === "widowed" ? "Duda/Janda" : "-"}</p>}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> No. Telepon</Label>
              {editing ? <Input value={profileData.phone || ""} onChange={(e) => setProfileData((p) => ({ ...p, phone: e.target.value }))} className="text-xs" /> : <p className="text-xs text-foreground">{profileData.phone || "-"}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Kontak Darurat</Label>
              {editing ? <Input value={profileData.emergencyContact || ""} onChange={(e) => setProfileData((p) => ({ ...p, emergencyContact: e.target.value }))} className="text-xs" /> : <p className="text-xs text-foreground">{profileData.emergencyContact || "-"}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Alamat Domisili</Label>
            {editing ? <Input value={profileData.address || ""} onChange={(e) => setProfileData((p) => ({ ...p, address: e.target.value }))} className="text-xs" /> : <p className="text-xs text-foreground">{profileData.address || "-"}</p>}
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">NPWP</Label>
              {editing ? <Input value={profileData.npwp || ""} onChange={(e) => setProfileData((p) => ({ ...p, npwp: e.target.value }))} placeholder="XX.XXX.XXX.X-XXX.XXX" className="text-xs" /> : <p className="text-xs text-foreground">{profileData.npwp || "-"}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">BPJS Kesehatan</Label>
              {editing ? <Input value={profileData.bpjsKesehatan || ""} onChange={(e) => setProfileData((p) => ({ ...p, bpjsKesehatan: e.target.value }))} className="text-xs" /> : <p className="text-xs text-foreground">{profileData.bpjsKesehatan || "-"}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">BPJS Ketenagakerjaan</Label>
              {editing ? <Input value={profileData.bpjsKetenagakerjaan || ""} onChange={(e) => setProfileData((p) => ({ ...p, bpjsKetenagakerjaan: e.target.value }))} className="text-xs" /> : <p className="text-xs text-foreground">{profileData.bpjsKetenagakerjaan || "-"}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> Bank</Label>
              {editing ? (
                <Select value={profileData.bankName || ""} onValueChange={(v) => setProfileData((p) => ({ ...p, bankName: v }))}>
                  <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Pilih bank" /></SelectTrigger>
                  <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}</SelectContent>
                </Select>
              ) : <p className="text-xs text-foreground">{profileData.bankName || "-"}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">No. Rekening</Label>
              {editing ? <Input value={profileData.bankAccountNumber || ""} onChange={(e) => setProfileData((p) => ({ ...p, bankAccountNumber: e.target.value }))} className="text-xs" /> : <p className="text-xs text-foreground">{profileData.bankAccountNumber || "-"}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nama Pemilik Rekening</Label>
              {editing ? <Input value={profileData.bankAccountName || ""} onChange={(e) => setProfileData((p) => ({ ...p, bankAccountName: e.target.value }))} className="text-xs" /> : <p className="text-xs text-foreground">{profileData.bankAccountName || "-"}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents — View Only */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5"><FileText className="w-4 h-4 " /> Dokumen Wajib</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            <ReadOnlyDocBox type="ktp" label="KTP" />
            <ReadOnlyDocBox type="kk" label="Kartu Keluarga" />
            <ReadOnlyDocBox type="foto" label="Foto Formal" />
            <ReadOnlyDocBox type="sim" label="SIM" />
            <ReadOnlyDocBox type="ijazah" label="Ijazah" />
          </div>
        </CardContent>
      </Card>

      {/* Other Documents */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><FileText className="w-4 h-4 " /> Lampiran Lainnya</CardTitle>
            <label className="cursor-pointer">
              <Button size="sm" variant="outline" className="text-xs gap-1 h-7" asChild><span><Upload className="w-3 h-3" /> Tambah Lampiran</span></Button>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileUpload("other", e)} />
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {userDocs.filter((d) => d.type === "other").length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Belum ada lampiran tambahan</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {userDocs.filter((d) => d.type === "other").map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-xs">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-foreground">{doc.fileName}</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setPreviewDoc(doc)}><Eye className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => handleDeleteDoc(doc.id)}><X className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5"><FileText className="w-4 h-4" /> Riwayat Kontrak</CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada data kontrak</p>
          ) : (
            <div className="space-y-2">
              {contracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border text-xs">
                  <div>
                    <p className="font-medium text-foreground">{c.position}</p>
                    <p className="text-[10px] text-muted-foreground">{c.startDate} — {c.endDate}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{c.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">{previewDoc?.fileName}</DialogTitle></DialogHeader>
          <div className="flex justify-center">
            {previewDoc?.fileUrl && (
              previewDoc.fileName.endsWith(".pdf") ? (
                <iframe src={previewDoc.fileUrl} className="w-full h-96 rounded-lg" />
              ) : (
                <img src={previewDoc.fileUrl} alt={previewDoc.fileName} className="max-h-96 rounded-lg object-contain" />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Avatar Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={(o) => { if (!o) { setCropDialogOpen(false); setCropImage(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Crop Foto Profil</DialogTitle></DialogHeader>
          <div className="relative w-full h-72 bg-muted rounded-lg overflow-hidden">
            {cropImage && (
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
              />
            )}
          </div>
          <div className="flex items-center gap-3 px-2">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(v) => setZoom(v[0])}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setCropDialogOpen(false); setCropImage(null); }}>Batal</Button>
            <Button size="sm" onClick={handleCropComplete} disabled={uploadingAvatar}>
              {uploadingAvatar ? "Mengupload..." : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Profile;
