
Tujuan perbaikan (sesuai kebutuhan Anda):
1) Dashboard karyawan harus menampilkan tugas pribadi + tugas tim.
2) Buat Tugas hanya untuk Admin dan Ketua Tim, dan Ketua Tim hanya bisa buat tugas tim.
3) Vault favicon harus fallback ke ikon default lokal jika favicon website gagal.
4) Klik tugas tim di halaman Tim harus membuka /tasks pada tab Tim.
5) Kelola Akun: admin klik “Kelengkapan” langsung masuk halaman khusus untuk melengkapi profil karyawan.
6) Settings > Hak Akses: jabatan tidak hardcode, admin bisa tambah jabatan (nama + deskripsi), lalu dipakai di aturan menu dan dropdown jabatan saat buat akun.

Rencana implementasi (urut kerja):
1. Perketat aturan di backend (agar tidak bisa dibypass dari client)
   - Task create permission:
     - Admin: boleh buat personal & team.
     - Employee non-leader: ditolak buat task.
     - Leader: hanya boleh buat task type=team, dan hanya untuk team yang dia pimpin.
   - Validasi payload task:
     - personal wajib assigneeId.
     - team wajib teamId valid.
   - Tambah endpoint jabatan dinamis:
     - GET daftar jabatan.
     - POST tambah jabatan (nama unik + deskripsi).
   - Simpan jabatan di sumber data yang sama dengan hak akses (PositionAccess) supaya sinkron otomatis.

2. Dashboard karyawan tampilkan tugas tim
   - Ubah filter dashboard agar untuk employee memakai seluruh task yang memang sudah boleh diakses (personal + team), bukan hanya assigneeId pribadi.
   - Rangkuman dashboard (alert/deadline/today tasks) ikut menghitung task tim.

3. Perbaiki flow halaman Tugas sesuai role
   - CreateTaskDialog:
     - Admin: tetap bisa pilih personal/team.
     - Leader: hanya opsi team (opsi personal dihapus).
     - Non-leader: tidak ada tombol buat tugas.
   - Tasks page:
     - Leader tetap melihat tombol buat tugas.
     - Dialog leader hanya menampilkan daftar team yang dia pimpin.

4. Sinkron “klik tugas tim” dari halaman Tim ke /tasks tab Tim
   - MyTeam: item tugas tim dibuat clickable ke /tasks?tab=team&teamId=...
   - TeamDetail (admin): item tugas tim juga diarahkan ke /tasks?tab=team&teamId=...
   - Tasks page membaca query param:
     - employee: auto aktif tab “Tim”.
     - admin: auto pilih tim terkait (selectedTeamId).

5. Vault favicon fallback default icon
   - Tambahkan asset default icon sesuai path yang Anda minta (`src/assets/iconDefault.ico`).
   - Komponen favicon:
     - jika favicon website gagal load/URL invalid, langsung tampilkan icon default lokal (bukan icon lucide).
   - Sekaligus rapikan sumber favicon agar mengurangi 404 eksternal yang mengganggu.

6. Kelola Akun: halaman khusus kelengkapan profil karyawan (admin-only)
   - Tambah route admin-only baru, contoh: `/accounts/:employeeId/profile`.
   - Di tabel Kelola Akun, kolom “Kelengkapan” dibuat clickable untuk buka halaman ini.
   - Halaman baru memuat:
     - data personal lengkap (field yang dipakai di profile completion),
     - upload dokumen wajib (KTP/KK/FOTO),
     - simpan update user oleh admin.
   - Batasi akses: hanya admin yang bisa membuka/menyimpan halaman ini.

7. Settings > Hak Akses: jabatan dinamis + dialog Tambah Jabatan
   - Tambah dialog “Tambah Jabatan” (nama jabatan, deskripsi).
   - List jabatan di tab Hak Akses diambil dari data jabatan dinamis (bukan dari user yang sudah ada).
   - Toggle “Atur menu mana saja” langsung muncul untuk jabatan baru.
   - Saat buat/edit akun di Kelola Akun:
     - field Jabatan diubah jadi dropdown dari daftar jabatan dinamis.
     - tetap ada fallback aman untuk data jabatan lama (legacy) agar tidak rusak.

8. Perbaikan warning DOM nesting
   - Komponen Badge saat ini memakai elemen block; ubah root menjadi inline (`span`) agar aman dipakai di teks dan menghilangkan warning `validateDOMNesting`.

Detail teknis (ringkas):
- File backend utama:
  - `backend/src/services/taskService.js` (rule create task by role + leader check)
  - `backend/src/controllers/taskController.js` (error response sesuai rule)
  - `backend/src/models/PositionAccess.js` (tambah `description`)
  - `backend/src/services/settingsService.js`, `backend/src/controllers/settingsController.js`, `backend/src/routes/settingsRoutes.js` (CRUD jabatan dinamis)
- File frontend utama:
  - `src/pages/Dashboard.tsx`
  - `src/components/DashboardSummary.tsx`
  - `src/pages/Tasks.tsx`
  - `src/components/CreateTaskDialog.tsx`
  - `src/pages/MyTeam.tsx`
  - `src/pages/TeamDetail.tsx`
  - `src/pages/Vault.tsx`
  - `src/pages/Accounts.tsx`
  - `src/pages/Settings.tsx`
  - `src/lib/api.ts`
  - `src/components/ui/badge.tsx`
  - tambah 1 page admin baru untuk edit kelengkapan profil + update route di `src/App.tsx`

Urutan verifikasi (end-to-end):
1) Login sebagai employee non-leader: tidak ada tombol buat tugas.
2) Login sebagai leader: tombol buat tugas ada, dialog hanya bisa buat tugas tim.
3) Login sebagai admin: bisa buat personal/team.
4) Dashboard employee: task tim muncul di statistik/deadline/rangkuman.
5) Klik tugas tim di halaman Tim: pindah ke `/tasks` tab Tim otomatis.
6) Vault link tanpa favicon valid: tampil icon default lokal.
7) Kelola Akun > klik Kelengkapan: masuk halaman admin editor profil karyawan.
8) Settings > tambah jabatan baru: langsung muncul di Hak Akses dan dropdown jabatan saat buat akun.
9) Console bersih dari warning DOM nesting terkait Badge.
