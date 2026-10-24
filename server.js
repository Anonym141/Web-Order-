const express = require("express");
const path = require("path");
const os = require("os");
const Database = require("better-sqlite3");
const QRCode = require("qrcode");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const db = new Database(path.join(__dirname, "warmindo.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS menu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Makanan',
  price INTEGER NOT NULL DEFAULT 0,
  image TEXT DEFAULT '',
  available INTEGER NOT NULL DEFAULT 1,
  stock INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_no TEXT NOT NULL,
  customer_name TEXT DEFAULT '',
  items_json TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'QRIS Simulasi',
  payment_status TEXT NOT NULL DEFAULT 'Menunggu pembayaran',
  order_status TEXT NOT NULL DEFAULT 'Baru',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`);

const menuCount = db.prepare("SELECT COUNT(*) AS n FROM menu").get().n;
if (!menuCount) {
  const seed = db.prepare(`INSERT INTO menu (name,description,category,price,image,available,stock) VALUES (?,?,?,?,?,?,?)`);
  const data = [
    ["Indomie Goreng Telur", "Indomie goreng dengan telur dan sayur", "Mie", 12000, "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80", 1, 40],
    ["Indomie Kuah Spesial", "Mie kuah hangat dengan telur", "Mie", 12000, "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80", 1, 40],
    ["Nasi Goreng", "Nasi goreng rumahan dengan telur", "Makanan", 15000, "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=900&q=80", 1, 25],
    ["Roti Bakar Cokelat", "Roti panggang dengan cokelat", "Snack", 10000, "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80", 1, 20],
    ["Pisang Bakar", "Pisang bakar topping cokelat keju", "Snack", 10000, "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?auto=format&fit=crop&w=900&q=80", 1, 20],
    ["Es Teh Manis", "Teh manis dingin", "Minuman", 5000, "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=80", 1, 60],
    ["Kopi Susu", "Kopi susu dingin", "Minuman", 8000, "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80", 1, 40],
    ["Air Mineral", "Air mineral botol", "Minuman", 4000, "https://images.unsplash.com/photo-1564419320461-6870880221ad?auto=format&fit=crop&w=900&q=80", 1, 60]
  ];
  const tx = db.transaction(() => data.forEach(row => seed.run(...row)));
  tx();
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of (list || [])) {
      if (net.family === "IPv4" && !net.internal) out.push(net.address);
    }
  }
  return out;
}
function safeOrder(row) {
  return { ...row, items: JSON.parse(row.items_json || "[]") };
}

app.get("/api/network", (req, res) => {
  res.json({ port: PORT, addresses: lanAddresses(), local: `http://localhost:${PORT}` });
});
app.get("/api/menu", (req, res) => {
  const includeUnavailable = req.query.all === "1";
  const rows = db.prepare(includeUnavailable
    ? "SELECT * FROM menu ORDER BY category, name"
    : "SELECT * FROM menu WHERE available=1 ORDER BY category, name").all();
  res.json(rows);
});
app.post("/api/menu", (req, res) => {
  const { name, description = "", category = "Makanan", price, image = "", available = true, stock = 100 } = req.body || {};
  if (!String(name || "").trim() || !Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: "Nama dan harga yang valid wajib diisi." });
  const result = db.prepare("INSERT INTO menu (name,description,category,price,image,available,stock) VALUES (?,?,?,?,?,?,?)")
    .run(String(name).trim(), String(description), String(category), Math.round(Number(price)), String(image), available ? 1 : 0, Math.max(0, Number(stock) || 0));
  res.status(201).json(db.prepare("SELECT * FROM menu WHERE id=?").get(result.lastInsertRowid));
});
app.put("/api/menu/:id", (req, res) => {
  const { name, description = "", category = "Makanan", price, image = "", available = true, stock = 100 } = req.body || {};
  if (!String(name || "").trim() || !Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: "Nama dan harga yang valid wajib diisi." });
  const result = db.prepare("UPDATE menu SET name=?,description=?,category=?,price=?,image=?,available=?,stock=? WHERE id=?")
    .run(String(name).trim(), String(description), String(category), Math.round(Number(price)), String(image), available ? 1 : 0, Math.max(0, Number(stock) || 0), Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Menu tidak ditemukan." });
  res.json(db.prepare("SELECT * FROM menu WHERE id=?").get(Number(req.params.id)));
});
app.delete("/api/menu/:id", (req, res) => {
  const result = db.prepare("DELETE FROM menu WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Menu tidak ditemukan." });
  res.json({ ok: true });
});
app.get("/api/orders", (req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 200").all();
  res.json(rows.map(safeOrder));
});
app.post("/api/orders", (req, res) => {
  const { tableNo, customerName = "", items, paymentMethod = "QRIS Simulasi" } = req.body || {};
  if (!tableNo || !Array.isArray(items) || !items.length) return res.status(400).json({ error: "Nomor meja dan menu pesanan wajib diisi." });
  const normalized = [];
  for (const item of items) {
    const menu = db.prepare("SELECT * FROM menu WHERE id=? AND available=1").get(Number(item.id));
    const qty = Math.floor(Number(item.qty));
    if (!menu || !Number.isFinite(qty) || qty < 1 || qty > 99) return res.status(400).json({ error: "Ada menu atau jumlah pesanan yang tidak valid." });
    normalized.push({ id: menu.id, name: menu.name, price: menu.price, qty, lineTotal: menu.price * qty });
  }
  const subtotal = normalized.reduce((sum, item) => sum + item.lineTotal, 0);
  const result = db.prepare(`INSERT INTO orders (table_no,customer_name,items_json,subtotal,payment_method,payment_status,order_status)
    VALUES (?,?,?,?,?,'Menunggu pembayaran','Baru')`)
    .run(String(tableNo).slice(0, 30), String(customerName).slice(0, 80), JSON.stringify(normalized), subtotal, String(paymentMethod));
  res.status(201).json(safeOrder(db.prepare("SELECT * FROM orders WHERE id=?").get(result.lastInsertRowid)));
});
app.patch("/api/orders/:id", (req, res) => {
  const allowedStatus = ["Baru", "Diproses", "Siap", "Selesai", "Dibatalkan"];
  const allowedPayment = ["Menunggu pembayaran", "Lunas"];
  const old = db.prepare("SELECT * FROM orders WHERE id=?").get(Number(req.params.id));
  if (!old) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
  const status = req.body.orderStatus ?? old.order_status;
  const payment = req.body.paymentStatus ?? old.payment_status;
  if (!allowedStatus.includes(status) || !allowedPayment.includes(payment)) return res.status(400).json({ error: "Status tidak valid." });
  db.prepare("UPDATE orders SET order_status=?,payment_status=? WHERE id=?").run(status, payment, old.id);
  res.json(safeOrder(db.prepare("SELECT * FROM orders WHERE id=?").get(old.id)));
});
app.get("/api/stats", (req, res) => {
  const today = db.prepare("SELECT date('now','localtime') AS d").get().d;
  const todayOrders = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE date(created_at)=? AND order_status!='Dibatalkan'").get(today).n;
  const todayRevenue = db.prepare("SELECT COALESCE(SUM(subtotal),0) AS n FROM orders WHERE date(created_at)=? AND payment_status='Lunas' AND order_status!='Dibatalkan'").get(today).n;
  const waiting = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE order_status IN ('Baru','Diproses')").get().n;
  const lowStock = db.prepare("SELECT COUNT(*) AS n FROM menu WHERE stock<=5 AND available=1").get().n;
  const top = db.prepare(`SELECT m.name, SUM(CAST(json_extract(j.value,'$.qty') AS INTEGER)) AS qty
    FROM orders o, json_each(o.items_json) j, menu m
    WHERE m.id=CAST(json_extract(j.value,'$.id') AS INTEGER) AND o.order_status!='Dibatalkan'
    GROUP BY m.id ORDER BY qty DESC LIMIT 5`).all();
  res.json({ today, todayOrders, todayRevenue, waiting, lowStock, top });
});
app.get("/api/qr", async (req, res) => {
  try {
    const target = String(req.query.url || "");
    if (!/^https?:\/\/(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3}|[\w.-]+):\d{2,5}\/?/.test(target)) return res.status(400).json({ error: "URL lokal tidak valid." });
    const dataUrl = await QRCode.toDataURL(target, { width: 320, margin: 2, color: { dark: "#202020", light: "#ffffff" } });
    res.json({ dataUrl });
  } catch (err) { res.status(500).json({ error: "QR gagal dibuat." }); }
});

app.get("/dashboard", (_req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/menu", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use((_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\nWarmindo Order berjalan: http://localhost:${PORT}`);
  console.log("Akses dari perangkat lain di Wi-Fi yang sama:");
  lanAddresses().forEach(ip => console.log(`  http://${ip}:${PORT}`));
  console.log("\nDashboard: http://localhost:" + PORT + "/dashboard\n");
});
