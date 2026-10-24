# Warmindo Order — QR Ordering & Business Dashboard

Aplikasi demo pemesanan Warmindo berbasis Node.js + Express + SQLite. Antarmuka memakai warna oranye dan putih dengan desain minimal.

## Fitur
- Halaman menu pelanggan (`/menu`) dengan kategori, pencarian, keranjang, dan checkout.
- Nomor meja diambil dari query QR, contoh `/menu?table=03`.
- Dashboard admin (`/dashboard`) untuk ringkasan, daftar pesanan, status pembayaran/pesanan, kelola menu, harga, foto, stok, dan ketersediaan.
- Data menu dan pesanan tersimpan pada `warmindo.sqlite`.
- Ringkasan omzet lunas, jumlah pesanan, antrean, stok menipis, serta menu terlaris dihitung otomatis.
- Generator QR meja di dashboard dengan pilihan URL localhost atau IP LAN.
- Foto menu memakai URL foto eksternal Unsplash (bukan gambar AI yang digenerate khusus untuk aplikasi).

## Jalankan di Arch Linux / Linux
Pastikan Node.js dan npm sudah terpasang, lalu di folder proyek:

```bash
npm install
npm start
```

Buka:
- Menu pelanggan: http://localhost:3000/menu
- Dashboard: http://localhost:3000/dashboard

## Tes QR dari HP di Wi-Fi yang sama
1. Jalankan `npm start`.
2. Buka Dashboard → QR Meja.
3. Pilih opsi **Jaringan lokal** (IP komputer), bukan localhost.
4. Buat QR, lalu scan dengan HP yang tersambung ke Wi-Fi yang sama.
5. Jika gagal, periksa firewall dan pastikan jaringan mengizinkan koneksi antarperangkat. Server bind ke `0.0.0.0:3000`.

`localhost` pada HP berarti HP itu sendiri, bukan laptop. Karena itu gunakan IP LAN untuk scan lintas perangkat.

## Pembayaran
Ini **simulasi pembayaran**, bukan payment gateway sungguhan. Memilih QRIS simulasi dan konfirmasi akan menandai pesanan sebagai lunas agar alur dashboard bisa dites. Tidak ada uang sungguhan yang diproses. Integrasi pembayaran nyata memerlukan penyedia resmi, kredensial backend, callback/webhook, dan pengujian keamanan.

## Foto menu
URL gambar disimpan pada kolom `image` di SQLite dan dapat diubah lewat Dashboard → Kelola menu. Gambar awal menggunakan foto Unsplash sebagai gambar demo. Jika foto tidak tampil, ganti URL foto dari sumber foto yang dapat diakses perangkat.

Referensi pencarian foto menu:
- Unsplash — nasi goreng: https://unsplash.com/s/photos/nasi-goreng
- Unsplash — mie goreng: https://unsplash.com/s/photos/mie-goreng
- Unsplash — Indonesian food: https://unsplash.com/s/photos/indonesian-food

## Catatan pengembangan
- Belum ada login admin; jangan publikasikan ke internet tanpa autentikasi dan hardening.
- Untuk demo lokal, menu dihapus secara permanen jika tombol Hapus digunakan.
- Stok menu adalah stok manual dan belum otomatis dikurangi saat pesanan dibuat.
- Pengaturan pembayaran dan status pesanan sengaja sederhana agar mudah dipelajari dan dikembangkan.
