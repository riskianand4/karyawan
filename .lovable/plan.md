

## Plan: 4 Perbaikan

### 1. Lock status "completed" — tidak bisa dikembalikan

**Masalah**: Tugas yang sudah selesai masih bisa di-drag atau diganti statusnya.

**Solusi**:
- **Tasks.tsx (kanban drag)**: Di `canDragTask()`, tambah `if (task.status === "completed") return false;`. Di `handleDrop()`, cek task yang di-drag — jika statusnya sudah "completed", tolak dan tampilkan toast error.
- **Tasks.tsx (KanbanBoard)**: Kolom "completed" tidak boleh menerima drop dari tugas yang sudah completed (sudah handled di atas).
- **TaskDetailModal.tsx**: Di dropdown status change, jika `task.status === "completed"`, disable dropdown atau sembunyikan. Jangan tampilkan opsi selain "Selesai" jika sudah completed.
- **Backend** (`taskService.js`): Di `updateStatus()`, tambah guard: jika task sudah `completed`, tolak dengan error 400 "Tugas yang sudah selesai tidak dapat diubah statusnya".

### 2. Halaman /team → Tampilkan hanya Tim, klik masuk ke /team/:id (page baru)

**Masalah**: Halaman /team saat ini menampilkan daftar karyawan individual + tim + sheet drawer. User ingin hanya daftar tim, dan klik tim membuka halaman baru `/team/:id` dengan detail performa tim (admin only).

**Solusi**:
- **Team.tsx**: Refaktor total — hapus semua kode karyawan grid, employee detail sheet, kanban drag-drop karyawan. Halaman hanya menampilkan:
  - Stats ringkasan (jumlah tim, rata-rata penyelesaian, tugas terlambat)
  - Tombol "Buat Tim"
  - Grid card tim (nama, ketua, jumlah anggota, progress)
  - Klik card → `navigate(\`/team/${team.id}\`)`
  - Hapus Sheet, ganti dengan navigasi ke page baru

- **Buat halaman baru `TeamDetail.tsx`** (`/team/:id`): Admin-only page yang menampilkan:
  - Header tim (nama, deskripsi)
  - Tabs: Anggota, Tugas, Performa
  - Tab Anggota: ketua tim + anggota
  - Tab Tugas: daftar tugas tim
  - Tab Performa: statistik penyelesaian, progress per anggota, chart aktivitas
  - Tombol kembali ke /team

- **App.tsx**: Tambah route `/team/:teamId` yang render `TeamDetail` (admin only).

- **Dialog Buat Tim tetap ada** di Team.tsx.

### 3. ScrollArea + Search di dialog "Buat Tim Baru" untuk daftar anggota

**Masalah**: Ketika karyawan >100, dialog terlalu panjang dan tidak bisa scroll ke bawah.

**Solusi** (Team.tsx, dialog section "Anggota Tim"):
- Tambah `<Input>` search di atas daftar anggota untuk filter nama.
- Bungkus daftar checkbox karyawan dengan `<ScrollArea className="max-h-[200px]">` agar muncul scrollbar setelah ~4 item.
- Filter `employees` berdasarkan search query sebelum render.

### 4. Tugas selesai tidak bisa dikembalikan — juga via dialog status

Sudah tercover di poin 1: TaskDetailModal status dropdown disabled/hidden saat completed.

---

### Technical Details

**File yang diubah/dibuat**:
- `src/pages/Team.tsx` — simplify: hanya tampil tim grid + dialog buat tim (dengan scroll + search)
- `src/pages/TeamDetail.tsx` — **baru**, halaman detail tim `/team/:id`
- `src/App.tsx` — tambah route `/team/:teamId`
- `src/pages/Tasks.tsx` — lock completed tasks dari drag
- `src/components/TaskDetailModal.tsx` — lock status change dari completed
- `backend/src/services/taskService.js` — guard updateStatus dari completed

