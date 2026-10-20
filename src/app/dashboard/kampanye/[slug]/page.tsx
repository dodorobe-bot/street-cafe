"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

type CampaignRow = { id: string; title: string; slug: string; is_active: boolean; created_at: string };
type MenuRow = { id: string; name: string; price: number };
type Resp = { selected_menu: string[]; price_range: string; purchase_intent: string; created_at: string };

const MAX_DAYS = 21;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayLabel = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const rp = (n: number) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

export default function CampaignAnalytics() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const supabase = getSupabase();
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [responses, setResponses] = useState<Resp[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "signed-out" | "missing">("loading");

  useEffect(() => {
    if (!supabase) { setStatus("missing"); return; }
    if (!slug) return;
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (alive) setStatus("signed-out"); return; }
      const { data: found } = await supabase.from("campaigns").select("id,title,slug,is_active,created_at").eq("slug", slug).maybeSingle();
      if (!found) { if (alive) setStatus("missing"); return; }
      const cols = "id,name,price";
      const [menuRes, respRes] = await Promise.all([
        supabase.from("menu_items").select(cols).eq("campaign_id", found.id).order("created_at"),
        supabase.from("responses").select("selected_menu,price_range,purchase_intent,created_at").eq("campaign_id", found.id).order("created_at"),
      ]);
      if (!alive) return;
      setCampaign(found as CampaignRow);
      setMenus((menuRes.data || []) as MenuRow[]);
      setResponses((respRes.data || []) as Resp[]);
      setStatus("ready");
    })();
    return () => { alive = false; };
  }, [slug, supabase]);

  const shell = (children: React.ReactNode) => <main className="page">
    <header className="topbar"><Link className="brand" href="/">KAFE <span>RADAR</span></Link><Link className="secondary button" href="/dashboard">← Dashboard</Link></header>
    {children}
  </main>;

  if (!supabase) return shell(<section className="card"><h1>Database belum dikonfigurasi</h1><p className="muted">Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, lalu deploy ulang.</p></section>);
  if (status === "loading") return shell(<section className="card"><h1>Memuat analitik…</h1></section>);
  if (status === "signed-out") return shell(<section className="card"><h1>Masuk dulu</h1><p className="muted">Analitik kampanye hanya bisa dibuka oleh pemilik kampanye.</p><Link className="button" href="/dashboard">Masuk ke dashboard →</Link></section>);
  if (status === "missing" || !campaign) return shell(<section className="card"><h1>Kampanye tidak ditemukan</h1><p className="muted">Tautan analitik hanya berlaku untuk kampanye milik akun Anda. Cek kembali slug di daftar kampanye.</p><Link className="button" href="/dashboard">Kembali ke dashboard →</Link></section>);

  const total = responses.length;
  const counts = new Map<string, number>();
  for (const r of responses) { const k = dayKey(new Date(r.created_at)); counts.set(k, (counts.get(k) || 0) + 1); }

  const start = new Date(`${dayKey(new Date(campaign.created_at))}T00:00:00`);
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const firstShown = Math.max(0, span - MAX_DAYS);
  const days: { key: string; count: number }[] = [];
  for (let i = firstShown; i < span; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    days.push({ key: dayKey(d), count: counts.get(dayKey(d)) || 0 });
  }
  const maxDay = Math.max(1, ...days.map(d => d.count));
  const peak = days.reduce((a, b) => (b.count > a.count ? b : a), days[0] || { key: dayKey(end), count: 0 });
  const hiddenDays = span - days.length;

  const yes = responses.filter(r => r.purchase_intent === "yes").length;
  const maybe = responses.filter(r => r.purchase_intent === "maybe").length;
  const no = responses.filter(r => r.purchase_intent === "no").length;
  const cheaper = responses.filter(r => r.price_range === "lebih_murah").length;
  const higher = responses.filter(r => r.price_range === "lebih_mahal").length;
  const weekAgo = Date.now() - 7 * 86400000;
  const last7 = responses.filter(r => new Date(r.created_at).getTime() >= weekAgo).length;
  const todayCount = counts.get(dayKey(new Date())) || 0;

  const priceOf = new Map(menus.map(m => [m.name, m.price] as const));
  const names = Array.from(new Set([...menus.map(m => m.name), ...responses.flatMap(r => r.selected_menu || [])]));
  const ranking = names.map(name => {
    const picked = responses.filter(r => (r.selected_menu || []).includes(name));
    return { name, price: priceOf.has(name) ? priceOf.get(name)! : null, count: picked.length, yes: picked.filter(r => r.purchase_intent === "yes").length };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const maxPick = Math.max(1, ...ranking.map(r => r.count));
  const top = ranking[0] && ranking[0].count > 0 ? ranking[0] : null;

  const signal = !top
    ? "Belum ada respons. Bagikan tautan /c/" + campaign.slug + " atau tempel QR-nya di meja."
    : total < 3
      ? `"${top.name}" memimpin dengan ${top.count} pilihan, tetapi sampelnya masih kecil — tunggu sampai belasan respons sebelum memutuskan.`
      : pct(cheaper, total) >= 50 && pct(top.yes, top.count) < 50
        ? `"${top.name}" paling banyak dipilih (${top.count} pilihan) tetapi hanya ${pct(top.yes, top.count)}% menyatakan ingin membeli, dan ${pct(cheaper, total)}% berharap harga lebih murah. Sinyalnya mengarah ke penyesuaian harga atau porsi, bukan menu baru.`
        : pct(top.yes, top.count) >= 50
          ? `"${top.name}" paling banyak dipilih (${top.count} pilihan) dan ${pct(top.yes, top.count)}% peminatnya menyatakan ingin membeli — kandidat terkuat untuk promosi berikutnya.`
          : `"${top.name}" paling banyak dipilih (${top.count} pilihan) dengan ${pct(top.yes, top.count)}% menyatakan ingin membeli. Minat ada, konversinya perlu dites dengan penawaran nyata.`;

  const bar = (n: number, scale: number) => <div className="bar"><div style={{ width: `${Math.min(100, (n / Math.max(1, scale)) * 100)}%` }} /></div>;

  return shell(<>
    <section className="hero">
      <span className="pill">Analitik kampanye {campaign.is_active ? "• aktif" : "• nonaktif"}</span>
      <h1>{campaign.title}</h1>
      <p>{total} respons sejak {new Date(campaign.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}. Minat masih survei, bukan transaksi — cocokkan dengan penjualan sebelum menaikkan produksi.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
        <Link className="button" href={`/c/${campaign.slug}`} target="_blank" rel="noopener noreferrer">Buka halaman survei →</Link>
        <Link className="secondary button" href="/dashboard">Kelola kampanye</Link>
      </div>
    </section>

    <div className="grid" style={{ marginBottom: 20 }}>
      <div className="card"><div className="muted">Total respons</div><div className="stat">{total}</div><p className="muted" style={{ fontSize: 12 }}>{todayCount} hari ini • {last7} dalam 7 hari</p></div>
      <div className="card"><div className="muted">Nyatakan ingin membeli</div><div className="stat">{pct(yes, total)}%</div><p className="muted" style={{ fontSize: 12 }}>{yes} dari {total} jawaban</p></div>
      <div className="card"><div className="muted">Hari puncak</div><div className="stat">{peak.count}</div><p className="muted" style={{ fontSize: 12 }}>{peak.count ? dayLabel(peak.key) : "belum ada data"}</p></div>
    </div>

    <section className="card" style={{ marginBottom: 20 }}>
      <h2>Respons per hari</h2>
      <p className="muted" style={{ fontSize: 13 }}>Hari mengikuti zona waktu perangkat Anda. {hiddenDays > 0 ? `${hiddenDays} hari pertama tidak digambar agar grafik tetap terbaca.` : ""}</p>
      {total === 0 ? <p className="muted">Belum ada respons.</p> : (
        <div className="trend">
          {days.map(d => <div key={d.key} title={`${dayLabel(d.key)}: ${d.count} respons`}>
            <span className="trend-n">{d.count}</span>
            <i style={{ height: `${Math.max(2, (d.count / maxDay) * 96)}px` }} />
            <small>{dayLabel(d.key)}</small>
          </div>)}
        </div>
      )}
    </section>

    <section className="notice" style={{ marginBottom: 20 }}>{signal}</section>

    <section className="card" style={{ marginBottom: 20 }}>
      <h2>Menu yang dipilih pelanggan</h2>
      {ranking.length === 0 ? <p className="muted">Belum ada menu di kampanye ini.</p> : <>
        <p className="muted" style={{ fontSize: 13 }}>% minat dihitung dari jawaban yang memilih menu tersebut.</p>
        {menus.length === 0 && <div className="notice" style={{ marginBottom: 14 }}>Daftar menu tidak bisa dibaca. Kalau kampanye ini sudah nonaktif, jalankan policy <code>owner reads menu items</code> di Supabase SQL Editor (ada di <code>supabase/schema.sql</code>) supaya harga menu tetap tampil.</div>}
        {ranking.map(m => <div className="menurow" key={m.name}>
          <div style={{ flex: 1 }}>
            <strong>{m.name}</strong>
            <div className="muted" style={{ fontSize: 12 }}>{m.price === null ? "harga tidak tersedia" : rp(m.price)}</div>
            {bar(m.count, maxPick)}
          </div>
          <span className="price">{m.count} pilihan • {pct(m.yes, m.count)}% ingin beli</span>
        </div>)}
      </>}
    </section>

    <div className="grid">
      <section className="card">
        <h2>Minat beli</h2>
        {[["Ingin membeli", yes], ["Mungkin membeli", maybe], ["Belum berminat", no]].map(([label, n]) => <div key={String(label)} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{label}</span><span>{n} dari {total}</span></div>
          {bar(Number(n), total)}
        </div>)}
      </section>
      <section className="card">
        <h2>Kisaran harga</h2>
        {[["Berharap lebih murah", cheaper], ["Harga saat ini sesuai", responses.filter(r => r.price_range === "sesuai").length], ["Bersedia membayar lebih", higher], ["Belum tahu", responses.filter(r => r.price_range === "tidak_tahu").length]].map(([label, n]) => <div key={String(label)} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{label}</span><span>{n} dari {total}</span></div>
          {bar(Number(n), total)}
        </div>)}
      </section>
    </div>
    <p className="muted" style={{ fontSize: 12, marginTop: 20 }}>KAFE RADAR pilot • Satu perangkat bisa mengirim satu respons, sehingga hasil tetap bisa dipengaruhi oleh siapa yang membuka tautan.</p>
  </>);
}
