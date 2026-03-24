

# Rencana Perbaikan: Hak Akses, Dashboard Catatan, Redesign Notes, Statistik

## Ringkasan Perubahan

Ada 4 perbaikan utama yang perlu dilakukan:

### 1. Ubah Logika Hak Akses (Bukan Sembunyikan Menu, Tapi Beri Kemampuan CRUD)

**Saat ini**: Hak akses per jabatan menyembunyikan/menampilkan menu di sidebar.
**Yang benar**: Menu selalu terlihat untuk semua karyawan (selama global toggle aktif). Hak akses menentukan apakah karyawan mendapat kemampuan CRUD seperti admin di menu tersebut (tapi tidak bisa kelola akun admin).

Perubahan:
- **AppSidebar.tsx**: Hapus filter berdasarkan `positionAccess`. Semua menu yang global-enabled selalu tampil untuk karyawan.
- **MenuSettingsContext.tsx**: Tambah helper `hasAccess(menuKey)` yang return true jika user admin ATAU user punya positionAccess untuk menu tersebut.
- **Halaman-halaman terkait** (Notes, Accounts, Attendance, dll): Gunakan `hasAccess` untuk menentukan apakah tampilkan view admin (CRUD semua karyawan) atau view biasa.
- **Khusus Kelola Akun**: Jika karyawan punya akses, dia bisa lihat dan kelola semua karyawan tapi TIDAK bisa kelola akun admin. Filter admin accounts dari daftar yang bisa dikelola.
- **Settings > Hak Akses**: Tambahkan menu "Kelola Akun" (`accounts`) ke daftar MENU_ITEMS yang bisa di-toggle per jabatan.
- **Backend PositionAccess model**: Tambah field `accounts` di menus schema.

### 2. Tampilkan Catatan di Dashboard Karyawan

- **Dashboard.tsx**: Tambah widget baru "Catatan Saya" di samping kanan (sebelah widget Tenggat Waktu).
  - Tampilkan catatan harian terbaru (max 3).
  - Jika ada catatan dari admin, tampilkan sebagai notifikasi card dengan warna berbeda.
  - Klik catatan admin → navigate ke `/notes`.
- Fetch `getDailyNotes` dan `getAdminNotes` di Dashboard.

### 3. Redesign Halaman Notes (2 Kolom + Papan Catatan)

- **Notes.tsx** untuk employee: Ubah layout jadi 2 kolom:
  - **Kiri**: Form catatan dengan date picker (seperti sekarang).
  - **Kanan**: "Papan Catatan" — grid/masonry dari card kertas:
    - Setiap catatan tampil sebagai card dengan rotasi acak (-3deg s/d +3deg).
    - Catatan dari admin punya warna berbeda (kuning/amber vs putih).
    - Klik card → buka dialog detail catatan.
    - Efek visual seperti sticky notes di papan kelas.

### 4. Sinkronkan Statistik dengan Data Tugas Sebenarnya

- **Settings.tsx**: Statistik saat ini menghitung dari `tasks` context yang mungkin masih menyimpan data lama.
  - Pastikan statistik hanya menghitung tugas yang benar-benar ada (dari API response terkini).
  - Filter `myTasks` dengan benar: untuk employee, hanya tugas yang assigneeId === user.id.

---

## Detail Teknis

### File yang diubah:

**Backend:**
- `backend/src/models/PositionAccess.js` — tambah `accounts: { type: Boolean, default: false }` di menus schema
- `backend/src/models/MenuSetting.js` — tidak perlu ubah (accounts bukan menu global)

**Frontend:**
- `src/contexts/MenuSettingsContext.tsx` — tambah fungsi `hasAccess(menuKey): boolean`
- `src/components/AppSidebar.tsx` — hapus filter positionAccess, semua menu global-enabled tampil
- `src/pages/Dashboard.tsx` — tambah widget catatan + fetch notes data
- `src/pages/Notes.tsx` — redesign 2 kolom dengan papan catatan sticky notes
- `src/pages/Settings.tsx` — tambah "Kelola Akun" di MENU_ITEMS + perbaiki statistik
- `src/pages/Accounts.tsx` — cek `hasAccess("accounts")` untuk izinkan karyawan kelola akun (kecuali admin)

### Alur Hak Akses Baru:
```text
Admin toggle "Catatan" ON untuk jabatan "Staff"
→ Karyawan Staff tetap lihat menu Catatan (seperti biasa)
→ TAPI sekarang di halaman Catatan, karyawan Staff
  bisa lihat daftar semua karyawan dan kirim catatan
  (seperti admin, tapi tidak bisa ke akun admin)

Admin toggle "Kelola Akun" ON untuk jabatan "Manager"  
→ Karyawan Manager muncul menu "Kelola Akun" di sidebar
→ Bisa kelola semua karyawan, tapi akun admin di-filter keluar
```

### Papan Catatan (Visual):
```text
┌─────────────────────────────────────────────┐
│  Form Catatan (Kiri)  │  Papan Catatan (Kanan)   │
│  ┌─────────────────┐  │  ┌───┐ ┌───┐ ┌───┐     │
│  │ Tanggal picker  │  │  │ 📝│ │ 📝│ │ 📝│     │
│  │ Textarea        │  │  │rot│ │rot│ │rot│     │
│  │ [Simpan]        │  │  │-2°│ │+3°│ │-1°│     │
│  └─────────────────┘  │  └───┘ └───┘ └───┘     │
│                        │  ┌───┐ ┌───┐           │
│                        │  │ 🟡│ │ 📝│  ← admin  │
│                        │  │adm│ │rot│    note    │
│                        │  └───┘ └───┘           │
└─────────────────────────────────────────────┘
```

