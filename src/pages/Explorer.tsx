import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMenuSettings } from "@/contexts/MenuSettingsContext";
import api, { getUploadUrl } from "@/lib/api";
import type { ExplorerFolder, ExplorerFile, User, TeamGroup } from "@/types";
import { motion } from "framer-motion";
import {
  Archive,
  ChevronRight,
  Download,
  Edit3,
  File,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Grid3X3,
  Home,
  Image,
  List,
  Lock,
  MoreVertical,
  Music,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import SuccessDialog from "@/components/SuccessDialog";
import { format, formatDistanceToNow } from "date-fns";
import { id as localeID } from "date-fns/locale";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Video;
  if (mimeType.startsWith("audio/")) return Music;
  if (mimeType.includes("pdf")) return FileText;
  return File;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

const Explorer = () => {
  const { user, isAdmin, users } = useAuth();
  const { hasAccess } = useMenuSettings();
  const canManage = isAdmin || hasAccess("explorer");

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<ExplorerFolder[]>([]);
  const [files, setFiles] = useState<ExplorerFile[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Dialogs
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameDialog, setRenameDialog] = useState<{ type: "folder" | "file"; id: string; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "folder" | "file"; id: string; name: string } | null>(null);
  const [shareDialog, setShareDialog] = useState<ExplorerFolder | null>(null);
  const [shareAccessType, setShareAccessType] = useState("all");
  const [shareAccessIds, setShareAccessIds] = useState<string[]>([]);
  const [successDialog, setSuccessDialog] = useState<{ title: string } | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: "folder" | "file"; item: any } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [teams, setTeams] = useState<TeamGroup[]>([]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getExplorerContents(currentFolderId || undefined);
      setFolders(data.folders);
      setFiles(data.files);
      setBreadcrumb(data.breadcrumb);
    } catch {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { api.getTeams().then(setTeams).catch(() => {}); }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const getUserName = (id: string) => users.find((u) => u.id === id)?.name || "Unknown";

  const filteredFolders = useMemo(() => folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())), [folders, search]);
  const filteredFiles = useMemo(() => files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())), [files, search]);

  const canDeleteItem = (createdAt: string) => {
    if (isAdmin) return true;
    return Date.now() - new Date(createdAt).getTime() < THREE_DAYS_MS;
  };

  const navigateTo = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSearch("");
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.createExplorerFolder({ name: newFolderName.trim(), parentId: currentFolderId });
      setNewFolderOpen(false);
      setNewFolderName("");
      refresh();
      setSuccessDialog({ title: "Folder berhasil dibuat" });
    } catch {
      toast.error("Gagal membuat folder");
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (currentFolderId) fd.append("folderId", currentFolderId);
      await api.uploadExplorerFile(fd);
      refresh();
      toast.success("File berhasil diunggah");
    } catch {
      toast.error("Gagal mengunggah file");
    }
    e.target.value = "";
  };

  const handleRename = async () => {
    if (!renameDialog || !renameDialog.name.trim()) return;
    try {
      if (renameDialog.type === "folder") {
        await api.updateExplorerFolder(renameDialog.id, { name: renameDialog.name.trim() } as any);
      } else {
        await api.renameExplorerFile(renameDialog.id, renameDialog.name.trim());
      }
      setRenameDialog(null);
      refresh();
    } catch {
      toast.error("Gagal mengubah nama");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "folder") {
        await api.deleteExplorerFolder(deleteConfirm.id);
      } else {
        await api.deleteExplorerFile(deleteConfirm.id);
      }
      setDeleteConfirm(null);
      refresh();
      setSuccessDialog({ title: `${deleteConfirm.type === "folder" ? "Folder" : "File"} berhasil dihapus` });
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus");
    }
  };

  const handleShare = async () => {
    if (!shareDialog) return;
    try {
      await api.shareExplorerFolder(shareDialog.id, shareAccessType, shareAccessIds);
      setShareDialog(null);
      refresh();
      toast.success("Hak akses folder diperbarui");
    } catch {
      toast.error("Gagal mengubah akses");
    }
  };

  const handleZip = async (folderId: string, folderName: string) => {
    try {
      toast.info("Memproses ZIP...");
      const blob = await api.downloadExplorerZip(folderId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = folderName + ".zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal membuat ZIP");
    }
  };

  const handleContextMenu = (e: React.MouseEvent, type: "folder" | "file", item: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, item });
  };

  const accessLabel = (folder: ExplorerFolder) => {
    if (folder.accessType === "all") return "Semua";
    if (folder.accessType === "team") return "Tim tertentu";
    if (folder.accessType === "specific") return "Karyawan tertentu";
    if (folder.accessType === "partner") return "Mitra";
    return folder.accessType;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-8xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <FolderOpen className="w-6 h-6" /> Explorer
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Kelola dokumen dan file perusahaan secara terstruktur.</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-2 text-xs h-9" onClick={() => setNewFolderOpen(true)}>
              <FolderPlus className="w-4 h-4" /> Folder Baru
            </Button>
            <Button size="sm" className="gap-2 text-xs h-9" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4" /> Unggah File
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadFile} />
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs flex-wrap bg-card border border-border rounded-lg px-3 py-2 shadow-sm">
        <button onClick={() => navigateTo(null)} className="flex items-center gap-1 hover:underline font-medium">
          <Home className="w-3.5 h-3.5" /> Beranda
        </button>
        {breadcrumb.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
            <button onClick={() => navigateTo(crumb.id)} className="hover:underline font-medium">
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari file atau folder..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-xs bg-card" />
        </div>
        <div className="flex items-center border border-border rounded-md overflow-hidden">
          <button onClick={() => setViewMode("grid")} className={`p-2 ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-2 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Folder ini kosong" description={canManage ? "Buat folder baru atau unggah file untuk memulai." : "Belum ada file di folder ini."} />
      ) : viewMode === "grid" ? (
        <div className="space-y-5">
          {filteredFolders.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Folder · {filteredFolders.length}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="group bg-card border border-border rounded-xl p-4 cursor-pointer hover:bg-muted/40 hover:border-primary/30 transition-all relative"
                    onClick={() => navigateTo(folder.id)}
                    onContextMenu={(e) => handleContextMenu(e, "folder", folder)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <Folder className="w-10 h-10  fill-primary/10" />
                      {canManage && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-44 p-1" align="end" onClick={(e) => e.stopPropagation()}>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => setRenameDialog({ type: "folder", id: folder.id, name: folder.name })}>
                              <Edit3 className="w-3.5 h-3.5" /> Ubah Nama
                            </button>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => { setShareDialog(folder); setShareAccessType(folder.accessType); setShareAccessIds(folder.accessIds || []); }}>
                              <Share2 className="w-3.5 h-3.5" /> Atur Akses
                            </button>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => handleZip(folder.id, folder.name)}>
                              <Archive className="w-3.5 h-3.5" /> Unduh ZIP
                            </button>
                            {canDeleteItem(folder.createdAt) ? (
                              <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-md" onClick={() => setDeleteConfirm({ type: "folder", id: folder.id, name: folder.name })}>
                                <Trash2 className="w-3.5 h-3.5" /> Hapus
                              </button>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed">
                                    <Lock className="w-3.5 h-3.5" /> Terkunci
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">Lebih dari 3 hari, hanya admin yang bisa hapus</TooltipContent>
                              </Tooltip>
                            )}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-foreground line-clamp-1">{folder.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[8px] bg-background">{accessLabel(folder)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredFiles.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">File · {filteredFiles.length}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredFiles.map((file) => {
                  const FileIcon = getFileIcon(file.mimeType);
                  const isImage = file.mimeType.startsWith("image/");
                  return (
                    <div
                      key={file.id}
                      className="group bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:bg-muted/40 hover:border-primary/30 transition-all relative"
                      onContextMenu={(e) => handleContextMenu(e, "file", file)}
                    >
                      {/* Preview area */}
                      <div className="h-24 bg-muted/30 flex items-center justify-center relative overflow-hidden">
                        {isImage ? (
                          <img src={getUploadUrl(file.fileUrl)} alt={file.name} className="w-full h-full object-cover" />
                        ) : (
                          <FileIcon className="w-10 h-10 text-muted-foreground/50" />
                        )}
                        {canManage && (
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="p-1 rounded bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-44 p-1" align="end" onClick={(e) => e.stopPropagation()}>
                                <a href={getUploadUrl(file.fileUrl)} target="_blank" rel="noreferrer" className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md">
                                  <Download className="w-3.5 h-3.5" /> Unduh
                                </a>
                                <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => setRenameDialog({ type: "file", id: file.id, name: file.name })}>
                                  <Edit3 className="w-3.5 h-3.5" /> Ubah Nama
                                </button>
                                {canDeleteItem(file.createdAt) ? (
                                  <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-md" onClick={() => setDeleteConfirm({ type: "file", id: file.id, name: file.name })}>
                                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                                  </button>
                                ) : (
                                  <div className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed">
                                    <Lock className="w-3.5 h-3.5" /> Terkunci (3+ hari)
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-[11px] font-semibold text-foreground line-clamp-1">{file.name}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{formatSize(file.fileSize)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 text-muted-foreground border-b border-border">
                <th className="text-left p-3 font-semibold">Nama</th>
                <th className="text-left p-3 font-semibold w-24">Ukuran</th>
                <th className="text-left p-3 font-semibold w-32">Diubah</th>
                <th className="text-left p-3 font-semibold w-28">Pembuat</th>
                <th className="text-right p-3 font-semibold w-20">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredFolders.map((folder) => (
                <tr key={folder.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => navigateTo(folder.id)} onContextMenu={(e) => handleContextMenu(e, "folder", folder)}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Folder className="w-5 h-5 fill-primary/10 shrink-0" />
                      <span className="font-semibold text-foreground">{folder.name}</span>
                      <Badge variant="outline" className="text-[8px] ml-1">{accessLabel(folder)}</Badge>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">—</td>
                  <td className="p-3 text-muted-foreground">{format(new Date(folder.updatedAt || folder.createdAt), "dd MMM yyyy", { locale: localeID })}</td>
                  <td className="p-3 text-muted-foreground">{getUserName(folder.createdBy)}</td>
                  <td className="p-3 text-right">
                    {canManage && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-muted">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1" align="end" onClick={(e) => e.stopPropagation()}>
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => setRenameDialog({ type: "folder", id: folder.id, name: folder.name })}><Edit3 className="w-3.5 h-3.5" /> Ubah Nama</button>
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => { setShareDialog(folder); setShareAccessType(folder.accessType); setShareAccessIds(folder.accessIds || []); }}><Share2 className="w-3.5 h-3.5" /> Atur Akses</button>
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => handleZip(folder.id, folder.name)}><Archive className="w-3.5 h-3.5" /> Unduh ZIP</button>
                          {canDeleteItem(folder.createdAt) && <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-md" onClick={() => setDeleteConfirm({ type: "folder", id: folder.id, name: folder.name })}><Trash2 className="w-3.5 h-3.5" /> Hapus</button>}
                        </PopoverContent>
                      </Popover>
                    )}
                  </td>
                </tr>
              ))}
              {filteredFiles.map((file) => {
                const FileIcon = getFileIcon(file.mimeType);
                return (
                  <tr key={file.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors" onContextMenu={(e) => handleContextMenu(e, "file", file)}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FileIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                        <a href={getUploadUrl(file.fileUrl)} target="_blank" rel="noreferrer" className="font-medium text-foreground  hover:underline">{file.name}</a>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{formatSize(file.fileSize)}</td>
                    <td className="p-3 text-muted-foreground">{format(new Date(file.updatedAt || file.createdAt), "dd MMM yyyy", { locale: localeID })}</td>
                    <td className="p-3 text-muted-foreground">{getUserName(file.createdBy)}</td>
                    <td className="p-3 text-right">
                      {canManage && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="p-1 rounded hover:bg-muted"><MoreVertical className="w-4 h-4 text-muted-foreground" /></button>
                          </PopoverTrigger>
                          <PopoverContent className="w-40 p-1" align="end">
                            <a href={getUploadUrl(file.fileUrl)} target="_blank" rel="noreferrer" className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md"><Download className="w-3.5 h-3.5" /> Unduh</a>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => setRenameDialog({ type: "file", id: file.id, name: file.name })}><Edit3 className="w-3.5 h-3.5" /> Ubah Nama</button>
                            {canDeleteItem(file.createdAt) && <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-md" onClick={() => setDeleteConfirm({ type: "file", id: file.id, name: file.name })}><Trash2 className="w-3.5 h-3.5" /> Hapus</button>}
                          </PopoverContent>
                        </Popover>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "folder" ? (
            <>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => { navigateTo(contextMenu.item.id); setContextMenu(null); }}>
                <FolderOpen className="w-3.5 h-3.5" /> Buka
              </button>
              {canManage && (
                <>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => { setRenameDialog({ type: "folder", id: contextMenu.item.id, name: contextMenu.item.name }); setContextMenu(null); }}>
                    <Edit3 className="w-3.5 h-3.5" /> Ubah Nama
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => { setShareDialog(contextMenu.item); setShareAccessType(contextMenu.item.accessType); setShareAccessIds(contextMenu.item.accessIds || []); setContextMenu(null); }}>
                    <Share2 className="w-3.5 h-3.5" /> Atur Akses
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => { handleZip(contextMenu.item.id, contextMenu.item.name); setContextMenu(null); }}>
                    <Archive className="w-3.5 h-3.5" /> Unduh ZIP
                  </button>
                  {canDeleteItem(contextMenu.item.createdAt) && (
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-md" onClick={() => { setDeleteConfirm({ type: "folder", id: contextMenu.item.id, name: contextMenu.item.name }); setContextMenu(null); }}>
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <a href={getUploadUrl(contextMenu.item.fileUrl)} target="_blank" rel="noreferrer" className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => setContextMenu(null)}>
                <Download className="w-3.5 h-3.5" /> Unduh
              </a>
              {canManage && (
                <>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-md" onClick={() => { setRenameDialog({ type: "file", id: contextMenu.item.id, name: contextMenu.item.name }); setContextMenu(null); }}>
                    <Edit3 className="w-3.5 h-3.5" /> Ubah Nama
                  </button>
                  {canDeleteItem(contextMenu.item.createdAt) && (
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-md" onClick={() => { setDeleteConfirm({ type: "file", id: contextMenu.item.id, name: contextMenu.item.name }); setContextMenu(null); }}>
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><FolderPlus className="w-4 h-4" /> Folder Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nama Folder</Label>
              <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nama folder..." className="text-xs" onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }} autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setNewFolderOpen(false)} className="text-xs">Batal</Button>
              <Button size="sm" onClick={handleCreateFolder} className="text-xs">Buat</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameDialog} onOpenChange={(o) => { if (!o) setRenameDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Edit3 className="w-4 h-4" /> Ubah Nama</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={renameDialog?.name || ""} onChange={(e) => setRenameDialog((prev) => prev ? { ...prev, name: e.target.value } : null)} className="text-xs" onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }} autoFocus />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setRenameDialog(null)} className="text-xs">Batal</Button>
              <Button size="sm" onClick={handleRename} className="text-xs">Simpan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={!!shareDialog} onOpenChange={(o) => { if (!o) setShareDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Share2 className="w-4 h-4" /> Atur Akses — {shareDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipe Akses</Label>
              <Select value={shareAccessType} onValueChange={(v) => { setShareAccessType(v); setShareAccessIds([]); }}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Semua Karyawan</SelectItem>
                  <SelectItem value="team" className="text-xs">Tim Tertentu</SelectItem>
                  <SelectItem value="specific" className="text-xs">Karyawan Tertentu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {shareAccessType === "team" && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {teams.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={shareAccessIds.includes(t.id)} onCheckedChange={(c) => setShareAccessIds((prev) => c ? [...prev, t.id] : prev.filter((x) => x !== t.id))} />
                    {t.name}
                  </label>
                ))}
              </div>
            )}

            {shareAccessType === "specific" && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {users.filter((u) => u.id !== user?.id).map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={shareAccessIds.includes(u.id)} onCheckedChange={(c) => setShareAccessIds((prev) => c ? [...prev, u.id] : prev.filter((x) => x !== u.id))} />
                    {u.name}
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShareDialog(null)} className="text-xs">Batal</Button>
              <Button size="sm" onClick={handleShare} className="text-xs">Simpan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}
        title={`Hapus ${deleteConfirm?.type === "folder" ? "Folder" : "File"}`}
        description={`Anda yakin ingin menghapus "${deleteConfirm?.name}"? ${deleteConfirm?.type === "folder" ? "Semua isi folder juga akan dihapus." : ""}`}
        confirmText="Hapus"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <SuccessDialog
        open={!!successDialog}
        onOpenChange={(o) => { if (!o) setSuccessDialog(null); }}
        title={successDialog?.title || ""}
      />
    </motion.div>
  );
};

export default Explorer;
