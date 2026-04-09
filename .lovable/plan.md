

## Plan: Fix Partner RBAC, Fix Finance Build Errors, CRUD Checks, dan Menu Explorer

### Ringkasan Masalah

1. **Partner 403 Forbidden**: Route partner pakai `adminOnly` bukan `adminOrAccess("mitra")` — karyawan dengan hak akses "Mitra" tetap ditolak
2. **Build errors**: `api.updateReimbursementStatus` dan `api.deleteReimbursement` tidak ada di `ApiClient`
3. **Finance**: Peninjau perlu bisa upload file di respond + tampil di detail dialog
4. **Explorer**: Menu baru seperti Windows Explorer untuk manajemen dokumen/folder

---

### 1. Fix Partner Routes — `adminOnly` → `adminOrAccess("mitra")`

**File**: `backend/src/routes/partnerRoutes.js`
- Ganti semua `adminOnly` dengan `adminOrAccess("mitra")` pada semua route CRUD (partners, projects, reports, contracts)
- Import `adminOrAccess` dari middleware

---

### 2. Fix Build Errors — Tambah Method yang Hilang di api.ts

**File**: `src/lib/api.ts`
- Tambah `updateReimbursementStatus(id, status)` → `PUT /finance/reimbursements/:id` 
- Tambah `deleteReimbursement(id)` → `DELETE /finance/reimbursements/:id`

**File**: `backend/src/routes/financeRoutes.js`
- Tambah route `DELETE /reimbursements/:id`

**File**: `backend/src/services/financeService.js`
- Tambah `deleteReimbursement(id)`

**File**: `backend/src/controllers/financeController.js`
- Tambah handler `deleteReimbursement`

---

### 3. Finance — File Upload di Respond & Tampil di Dialog

**File**: `src/pages/Finance.tsx`
- Di respond dialog: tambah input file upload (FormData) saat peninjau setujui/tolak
- Di detail dialog: tampilkan `attachmentUrl` dari response peninjau (seperti di Approval)
- Pastikan komentar juga bisa sertakan file (sudah ada method `addReimbursementComment` dengan FormData)

---

### 4. Menu Explorer — File Manager Lengkap

**4a. Backend — Model & Routes**

**File baru**: `backend/src/models/ExplorerFolder.js`
```
- _id, name, parentId (null = root), ownerId, 
- accessType: "all" | "team" | "specific" | "partner"
- accessIds: [String] (team/user/partner IDs)
- createdBy, createdAt
```

**File baru**: `backend/src/models/ExplorerFile.js`
```
- _id, name, folderId, fileUrl, fileSize, mimeType
- ownerId, createdBy, createdAt
- locked: Boolean (true jika > 3 hari, non-admin tidak bisa hapus)
```

**File baru**: `backend/src/services/explorerService.js`
- CRUD folder (create, rename, delete — cascade delete sub-items)
- CRUD file (upload, rename, delete — cek 3 hari rule)
- List contents (folder + files) by parentId, filtered by access
- Share folder — update accessType & accessIds
- ZIP folder — archive folder contents
- Link ke Partner reports

**File baru**: `backend/src/controllers/explorerController.js`
**File baru**: `backend/src/routes/explorerRoutes.js`

Routes:
- `GET /explorer?parentId=&folderId=` — list isi folder
- `POST /explorer/folders` — buat folder
- `PUT /explorer/folders/:id` — rename/update access
- `DELETE /explorer/folders/:id` — hapus folder (cek 3 hari + admin override)
- `POST /explorer/files` — upload file (multer)
- `PUT /explorer/files/:id` — rename
- `DELETE /explorer/files/:id` — hapus file (cek 3 hari + admin override)
- `POST /explorer/folders/:id/zip` — download ZIP
- `POST /explorer/folders/:id/share` — share folder

**File**: `backend/src/routes/index.js` — tambah `/explorer` route
**File**: `backend/src/middleware/upload.js` — tambah context `explorer`

**4b. Frontend**

**File baru**: `src/pages/Explorer.tsx`
- Layout seperti Windows Explorer:
  - Breadcrumb path navigation (Home > Folder A > Sub-folder)
  - Toolbar: New Folder, Upload File, View (grid/list), Sort
  - Grid/List view untuk folder dan file
  - Context menu (klik kanan): Buka, Rename, Hapus, Share, ZIP, Download
- Dialog share: pilih Team, Karyawan tertentu, atau link ke Mitra
- File preview: gambar thumbnail, PDF/doc icon
- Hak akses: hanya karyawan dengan akses "explorer" yang bisa CRUD
- Rule 3 hari: file/folder > 3 hari tidak bisa dihapus (kecuali admin), tampilkan tooltip

**File**: `src/App.tsx` — tambah route `/explorer`
**File**: `src/components/AppSidebar.tsx` — tambah menu "Explorer" dengan icon `FolderOpen`
**File**: `src/pages/Settings.tsx` — tambah `{ key: "explorer", label: "Explorer" }` di MENU_ITEMS
**File**: `src/lib/api.ts` — tambah semua Explorer API methods
**File**: `src/types/index.ts` — tambah `ExplorerFolder`, `ExplorerFile` interfaces

---

### File yang Diubah/Dibuat

| File | Perubahan |
|------|-----------|
| `backend/src/routes/partnerRoutes.js` | `adminOnly` → `adminOrAccess("mitra")` |
| `src/lib/api.ts` | + updateReimbursementStatus, deleteReimbursement, Explorer methods |
| `backend/src/routes/financeRoutes.js` | + DELETE reimbursements/:id |
| `backend/src/services/financeService.js` | + deleteReimbursement |
| `backend/src/controllers/financeController.js` | + deleteReimbursement handler |
| `src/pages/Finance.tsx` | File upload di respond, tampil attachment di detail |
| `backend/src/models/ExplorerFolder.js` | **BARU** |
| `backend/src/models/ExplorerFile.js` | **BARU** |
| `backend/src/services/explorerService.js` | **BARU** |
| `backend/src/controllers/explorerController.js` | **BARU** |
| `backend/src/routes/explorerRoutes.js` | **BARU** |
| `backend/src/routes/index.js` | + /explorer route |
| `backend/src/middleware/upload.js` | + explorer context |
| `src/pages/Explorer.tsx` | **BARU** — halaman Explorer |
| `src/App.tsx` | + route /explorer |
| `src/components/AppSidebar.tsx` | + menu Explorer |
| `src/pages/Settings.tsx` | + explorer di MENU_ITEMS |
| `src/types/index.ts` | + ExplorerFolder, ExplorerFile |

