 "use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/lib/supabase";

type Campaign = { id: string; slug: string; title: string; cafe_id: string; is_active: boolean; created_at: string };
type ResponseRow = { id: string; campaign_id: string; selected_menu: string[]; price_range: string; purchase_intent: string; created_at: string };
export default function Dashboard() {
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [user,setUser] = useState<string|null>(null);
  const [cafeName,setCafeName] = useState("");
  const [campaignTitle,setCampaignTitle] = useState("Menu Favorit Minggu Ini");
  const [slug,setSlug] = useState("menu-favorit-ternate");
  const [menus,setMenus] = useState([{name:"Kopi Susu Gula Aren",price:"22000"},{name:"Matcha Latte",price:"25000"},{name:"Pisang Goreng",price:"18000"}]);
  const [campaigns,setCampaigns] = useState<Campaign[]>([]);
  const [responses,setResponses] = useState<ResponseRow[]>([]);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [qrFor,setQrFor] = useState<string|null>(null);
  const [qrSrc,setQrSrc] = useState<string|null>(null);
  const supabase = getSupabase();

  async function refresh(uid?: string) {
    if (!supabase) return;
    const {data: authData} = await supabase.auth.getUser();
    const id = uid || authData.user?.id;
    if (!id) return;
    const {data: cafes} = await supabase.from("cafes").select("id,name").eq("owner_id",id).limit(1);
    if (!cafes?.length) { setCampaigns([]); setResponses([]); return; }
    setCafeName(cafes[0].name);
    const {data: cs} = await supabase.from("campaigns").select("id,slug,title,cafe_id,is_active,created_at").eq("cafe_id",cafes[0].id).order("created_at",{ascending:false});
    const list = (cs || []) as Campaign[];
    setCampaigns(list);
    if (list.length) {
      const {data: rs} = await supabase.from("responses").select("id,campaign_id,selected_menu,price_range,purchase_intent,created_at").in("campaign_id",list.map(c=>c.id)).order("created_at",{ascending:false});
      setResponses((rs || []) as ResponseRow[]);
    } else setResponses([]);
  }
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({data}) => { if(data.user){setUser(data.user.id); void refresh(data.user.id);} });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault(); if (!supabase) return; setBusy(true); setMessage("");
    const {data,error} = await supabase.auth.signInWithPassword({email,password});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    setUser(data.user.id); await refresh(data.user.id); setMessage("Berhasil masuk.");
  }
  async function signUp(e: React.FormEvent) {
    e.preventDefault(); if (!supabase) return; setBusy(true); setMessage("");
    const {data,error} = await supabase.auth.signUp({email,password});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    if(data.user){setUser(data.user.id); setMessage("Akun dibuat. Jika verifikasi email aktif, buka email untuk mengonfirmasi lalu masuk kembali.");}
  }
  async function createCampaign(e: React.FormEvent) {
    e.preventDefault(); if (!supabase) return; setBusy(true); setMessage("");
    const {data: auth} = await supabase.auth.getUser();
    if(!auth.user){setBusy(false);setMessage("Silakan masuk dahulu.");return;}
    let {data: cafe} = await supabase.from("cafes").select("id").eq("owner_id",auth.user.id).maybeSingle();
    if(!cafe){
      const {data: newCafe,error: cafeError} = await supabase.from("cafes").insert({owner_id:auth.user.id,name:cafeName || "Kafe Saya"}).select("id").single();
      if(cafeError || !newCafe){setBusy(false);setMessage(cafeError?.message || "Gagal membuat profil kafe.");return;}
      cafe = newCafe;
    } else if(cafeName.trim()) {
      await supabase.from("cafes").update({name:cafeName.trim()}).eq("id",cafe.id);
    }
    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");
    const {data: campaign,error} = await supabase.from("campaigns").insert({cafe_id:cafe.id,title:campaignTitle,slug:cleanSlug,is_active:true}).select("id").single();
    if(error || !campaign){setBusy(false);setMessage(error?.message || "Gagal membuat kampanye.");return;}
    const items = menus.filter(m=>m.name.trim()).map(m=>({campaign_id:campaign.id,name:m.name.trim(),price:Math.max(0,Number(m.price)||0)}));
    if(items.length) {
      const {error: menuError} = await supabase.from("menu_items").insert(items);
      if(menuError){setBusy(false);setMessage("Kampanye dibuat, tetapi menu gagal disimpan: "+menuError.message);await refresh();return;}
    }
    setBusy(false);setMessage("Kampanye berhasil dibuat.");await refresh();
  }
  async function signOut(){if(!supabase)return; await supabase.auth.signOut();setUser(null);setCampaigns([]);setResponses([]);setMessage("Anda sudah keluar.");}
  async function toggleQr(slug: string) {
    if (qrFor === slug) { setQrFor(null); setQrSrc(null); return; }
    setQrFor(slug); setQrSrc(null);
    const link = `${window.location.origin}/c/${slug}`;
    try {
      const { toDataURL } = await import("qrcode");
      setQrSrc(await toDataURL(link, { margin: 2, width: 512 }));
    } catch { setQrFor(null); setMessage("QR gagal dibuat di perangkat ini."); }
  }
  const intentCount = responses.filter(r=>r.purchase_intent==="yes").length;
  if(!supabase) return <main className="page">
    <header className="topbar"><Link className="brand" href="/">KAFE <span>RADAR</span></Link><span className="pill">Belum terhubung</span></header>
    <section className="card"><h1>Database belum dikonfigurasi</h1><p className="muted">Dashboard aktif setelah dua variabel lingkungan diisi: <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Di Vercel, isi keduanya pada <strong>Project Settings → Environment Variables</strong> lalu deploy ulang.</p><div className="notice">Jalankan juga seluruh isi <code>supabase/schema.sql</code> di SQL Editor Supabase. Panduan lengkap ada di README.</div></section>
  </main>;
  if(!user) return <main className="page">
    <header className="topbar"><Link className="brand" href="/">KAFE <span>RADAR</span></Link><span className="pill">Dashboard pemilik</span></header>
    <div className="grid">
      <section className="card"><h1>Masuk ke dashboard</h1><p className="muted">Gunakan email dan kata sandi untuk mengelola kampanye kafe.</p>
      <form onSubmit={signIn}><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><label>Kata sandi</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required/><button disabled={busy} style={{marginTop:18}}>{busy?"Memproses…":"Masuk"}</button></form>
      <p className="muted" style={{fontSize:13}}>Belum punya akun? Isi email dan kata sandi, lalu klik daftar.</p><button className="secondary" disabled={busy} onClick={()=>signUp({preventDefault:()=>{}} as React.FormEvent)}>Daftar akun</button>
      {message && <p className="muted">{message}</p>}</section>
      <section className="card"><h2>Sebelum digunakan</h2><p className="muted">Buat project Supabase, jalankan <code>supabase/schema.sql</code>, dan isi <code>.env.local</code>. Panduan lengkap ada di README.</p><div className="notice">Jangan masukkan data pribadi pelanggan yang sensitif. Respons pilot hanya menyimpan pilihan menu dan minat beli.</div></section>
    </div>
  </main>;
  const bar = (n: number) => <div className="bar"><div style={{width:`${Math.min(100,n/Math.max(1,responses.length)*100)}%`}}/></div>;
  const breakdown = (key: "purchase_intent"|"price_range", values: [string,string][]) => responses.length===0 ? <p className="muted">Belum ada respons.</p> : values.map(([v,label])=>{const n=responses.filter(r=>r[key]===v).length;return <div key={v} style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><span>{label}</span><span>{n} dari {responses.length}</span></div>{bar(n)}</div>;});
  return <main className="page">
    <header className="topbar"><Link className="brand" href="/">KAFE <span>RADAR</span></Link><div><span className="pill">Dashboard pilot</span> <button className="secondary" onClick={signOut}>Keluar</button></div></header>
    <section className="hero"><span className="pill">Ringkasan kampanye</span><h1>Halo, {cafeName || "pemilik kafe"}.</h1><p>Pantau minat menu dari respons pelanggan. Minat bukan penjualan terverifikasi—cocokkan dengan transaksi aktual sebelum mengambil keputusan.</p></section>
    <div className="grid" style={{marginBottom:20}}>
      <div className="card"><div className="muted">Total respons</div><div className="stat">{responses.length}</div></div>
      <div className="card"><div className="muted">Menyatakan ingin membeli</div><div className="stat">{intentCount}</div></div>
      <div className="card"><div className="muted">Kampanye aktif</div><div className="stat">{campaigns.filter(c=>c.is_active).length}</div></div>
    </div>
    <section className="card" style={{marginBottom:20}}><h2>Buat kampanye baru</h2><form onSubmit={createCampaign}>
      <label>Nama kafe</label><input value={cafeName} onChange={e=>setCafeName(e.target.value)} placeholder="Contoh: Kopi Sudut Ternate" required/>
      <label>Judul kampanye</label><input value={campaignTitle} onChange={e=>setCampaignTitle(e.target.value)} required/>
      <label>Slug tautan (huruf kecil, angka, tanda hubung)</label><input value={slug} onChange={e=>setSlug(e.target.value)} required/>
      <h3>Menu kampanye</h3>{menus.map((m,i)=><div className="grid" key={i} style={{gridTemplateColumns:"2fr 1fr",marginBottom:8}}><input aria-label={`Nama menu ${i+1}`} value={m.name} onChange={e=>setMenus(old=>old.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="Nama menu"/><input aria-label={`Harga menu ${i+1}`} type="number" min="0" value={m.price} onChange={e=>setMenus(old=>old.map((x,j)=>j===i?{...x,price:e.target.value}:x))} placeholder="Harga (Rp)"/></div>)}
      <button type="button" className="secondary" onClick={()=>setMenus(old=>[...old,{name:"",price:"0"}])}>+ Tambah menu</button> <button disabled={busy} type="submit">{busy?"Menyimpan…":"Simpan kampanye"}</button>
    </form>{message && <p className="muted">{message}</p>}</section>
    <section className="card" style={{marginBottom:20}}><h2>Kampanye Anda</h2>{campaigns.length===0?<p className="muted">Belum ada kampanye. Buat kampanye pertama di atas.</p>:campaigns.map(c=><div key={c.id}><div className="menurow"><div><strong>{c.title}</strong><div className="muted" style={{fontSize:13}}>/{`c/${c.slug}`}</div></div><span className="price">{responses.filter(r=>r.campaign_id===c.id).length} respons</span><Link href={`/c/${c.slug}`}>Buka →</Link><button className="secondary" type="button" onClick={()=>toggleQr(c.slug)}>{qrFor===c.slug?"Tutup QR":"QR & tautan"}</button></div>{qrFor===c.slug && <div style={{display:"flex",gap:18,alignItems:"center",flexWrap:"wrap",padding:"14px 0 18px"}}>{qrSrc?<><Image src={qrSrc} alt={`QR kampanye ${c.title}`} width={180} height={180} unoptimized/><a className="button" href={qrSrc} download={`qr-${c.slug}.png`}>Unduh PNG</a></>:<span className="muted">Membuat QR…</span>}<p className="muted" style={{fontSize:13,maxWidth:340}}>Tempel di meja kafe atau kirim sebagai gambar lewat WhatsApp. Kode ini mengarah ke tautan kampanye, bukan ke dashboard.</p></div>}</div>)}</section>
    <section className="card" style={{marginBottom:20}}><h2>Minat beli</h2>{breakdown("purchase_intent",[["yes","Ingin membeli"],["maybe","Mungkin membeli"],["no","Belum berminat"]])}<p className="muted" style={{fontSize:12}}>Pilihan awal formulir adalah mungkin, jadi hitungan cenderung menumpuk di tengah.</p></section>
    <section className="card" style={{marginBottom:20}}><h2>Kisaran harga menurut pelanggan</h2>{breakdown("price_range",[["sesuai","Harga saat ini terasa sesuai"],["lebih_murah","Berharap lebih murah"],["lebih_mahal","Bersedia membayar lebih"],["tidak_tahu","Belum tahu"]])}</section>
    <section className="card"><h2>Menu yang dipilih pelanggan</h2>{responses.length===0?<p className="muted">Belum ada respons.</p>:Array.from(new Set(responses.flatMap(r=>r.selected_menu||[]))).map(name=>{const count=responses.filter(r=>(r.selected_menu||[]).includes(name)).length;return <div key={name} style={{marginBottom:18}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{name}</strong><span>{count} pilihan</span></div><div className="bar"><div style={{width:`${Math.min(100,count/Math.max(1,responses.length)*100)}%`}}/></div></div>})}</section>
    <p className="muted" style={{fontSize:12,marginTop:20}}>KAFE RADAR pilot • Hasil respons dapat dipengaruhi oleh siapa yang membuka tautan.</p>
  </main>;
}