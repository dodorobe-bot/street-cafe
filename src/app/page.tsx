import Link from "next/link";
export default function Home() {
  return <main className="page">
    <header className="topbar"><div className="brand">KAFE <span>RADAR</span></div><span className="pill">MVP PILOT • TERNATE</span></header>
    <section className="hero">
      <span className="pill">Riset minat menu sederhana</span>
      <h1>Jangan tebak menu yang laku. <span className="hl">Uji minatnya dulu.</span></h1>
      <p>KAFE RADAR membantu kafe mengumpulkan minat pelanggan pada menu, membaca sinyal permintaan, dan memilih promosi berikutnya dengan lebih terarah.</p>
      <Link className="button" href="/dashboard">Buka dashboard pemilik →</Link>
    </section>
    <div className="grid">
      <section className="card"><h2>Untuk pelanggan</h2><p className="muted">Buka tautan kampanye kafe, pilih menu yang menarik, lalu kirim jawaban singkat.</p><p><code>/c/nama-kampanye</code></p></section>
      <section className="card"><h2>Untuk pemilik kafe</h2><p className="muted">Masuk untuk mengelola kampanye dan membaca respons yang masuk.</p><Link href="/dashboard">Masuk / dashboard →</Link></section>
      <section className="card"><h2>Promosi tersambung</h2><p className="muted">Halaman kampanye menampilkan foto menu dan tombol tautan ke Instagram, TikTok, X, Threads, WhatsApp, atau YouTube kafe.</p></section>
    </div>
    <p className="muted" style={{marginTop:28,fontSize:13}}>KAFE RADAR adalah alat riset minat, bukan jaminan penjualan. Validasi hasil dengan transaksi nyata.</p>
  </main>;
}