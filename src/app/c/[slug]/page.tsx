 "use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { getSupabase, publicPhotoUrl } from "@/lib/supabase";
import { fetchSocialLinks, platformLabel, type SocialLink } from "@/lib/social";
type Campaign = { id:string; title:string; is_active:boolean; cafe_id:string };
type Cafe = { name:string };
type Menu = { id:string; name:string; price:number; photo_path:string|null };
export default function CampaignPage() {
  const params = useParams<{slug:string}>();
  const slug = params.slug;
  const supabase = getSupabase();
  const [campaign,setCampaign] = useState<Campaign|null>(null);
  const [cafe,setCafe] = useState<Cafe|null>(null);
  const [menus,setMenus] = useState<Menu[]>([]);
  const [selected,setSelected] = useState<string[]>([]);
  const [priceRange,setPriceRange] = useState("sesuai");
  const [intent,setIntent] = useState("maybe");
  const [busy,setBusy] = useState(false);
  const [done,setDone] = useState(false);
  const [error,setError] = useState("");
  const [trap,setTrap] = useState("");
  const [links,setLinks] = useState<SocialLink[]>([]);
  const openedAt = useRef(0);
  useEffect(()=>{(async()=>{
    if(!supabase){setError("Kampanye tidak tersedia. Database belum dikonfigurasi.");return;}
    const {data:c,error:ce} = await supabase.from("campaigns").select("id,title,is_active,cafe_id").eq("slug",slug).eq("is_active",true).maybeSingle();
    if(ce || !c){setError("Kampanye tidak ditemukan atau sudah tidak aktif.");return;}
    setCampaign(c as Campaign);
    const [{data:ca},{data:mi},ls] = await Promise.all([
      supabase.from("cafes").select("name").eq("id",c.cafe_id).single(),
      supabase.from("menu_items").select("id,name,price,photo_path").eq("campaign_id",c.id).order("created_at"),
      fetchSocialLinks(supabase, c.id, c.cafe_id)
    ]);
    setCafe(ca as Cafe);setMenus((mi||[]) as Menu[]);setLinks(ls);
    openedAt.current = Date.now();
    if(sessionStorage.getItem("kafe-resp:"+slug)) setDone(true);
  })();},[slug,supabase]);
  async function submit(e:React.FormEvent){
    e.preventDefault(); if(!supabase){setError("Respons belum dapat disimpan. Database belum dikonfigurasi.");return;}
    if(trap){setDone(true);return;}
    if(!campaign || selected.length===0){setError("Pilih minimal satu menu.");return;}
    if(Date.now()-openedAt.current<2500){setError("Jawaban Anda belum selesai terbaca. Coba kirim lagi sebentar lagi.");return;}
    setBusy(true);setError("");
    const {error:submitError} = await supabase.from("responses").insert({campaign_id:campaign.id,selected_menu:menus.filter(m=>selected.includes(m.id)).map(m=>m.name),price_range:priceRange,purchase_intent:intent});
    setBusy(false);
    if(submitError){setError("Respons belum terkirim. Periksa konfigurasi database atau coba lagi.");return;}
    sessionStorage.setItem("kafe-resp:"+slug,"1");
    setDone(true);
  }
  const followLinks = links.length===0 ? null : <section className="card" style={{marginBottom:20}}><h2>Ikuti {cafe?.name || "kafe ini"}</h2><p className="muted">Lihat menu, video promosi, dan kabar terbaru di media sosial kami.</p><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{links.map(l=><a className="pill" key={l.id} href={l.url} target="_blank" rel="noopener noreferrer">{platformLabel(l.platform)}</a>)}</div></section>;
  return <main className="page">
    <header className="topbar"><Link className="brand" href="/">KAFE <span>RADAR</span></Link><span className="pill">Survei menu singkat</span></header>
    {error && !campaign ? <section className="card"><h1>Kampanye tidak tersedia</h1><p className="error">{error}</p></section> : done ? <><section className="hero"><span className="pill">Respons terkirim</span><h1>Terima kasih sudah berbagi minat!</h1><p>Jawaban Anda membantu kafe memahami menu yang diminati. Ini adalah survei minat, bukan pesanan atau reservasi.</p></section>{followLinks}</> : <><section className="hero"><span className="pill">Bantu kafe lokal</span><h1>{campaign?.title || "Memuat kampanye…"}</h1><p>{cafe?.name || "Kafe lokal"} ingin tahu menu apa yang menarik bagi Anda. Hanya perlu sekitar 30 detik.</p></section>
    <form className="card" onSubmit={submit}><h2>Menu mana yang menarik bagi Anda?</h2><p className="muted">Pilih satu atau lebih. Ini belum merupakan pemesanan.</p>
      <input type="text" name="website" value={trap} onChange={e=>setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{position:"absolute",left:"-9999px",top:0,width:1,height:1,opacity:0}}/>
      {menus.map(m=>{const photo=publicPhotoUrl(supabase,m.photo_path);return <label className="menurow" key={m.id} style={{fontWeight:400,margin:0}}><input type="checkbox" checked={selected.includes(m.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,m.id]:old.filter(id=>id!==m.id))}/>{photo && <Image src={photo} alt={`Foto ${m.name}`} width={56} height={56} unoptimized style={{borderRadius:8,objectFit:"cover"}}/>}<span>{m.name}</span><span className="price">Rp {Number(m.price).toLocaleString("id-ID")}</span></label>;})}
      <label>Kisaran harga yang terasa sesuai</label><select value={priceRange} onChange={e=>setPriceRange(e.target.value)}><option value="lebih_murah">Berharap lebih murah</option><option value="sesuai">Harga saat ini terasa sesuai</option><option value="lebih_mahal">Bersedia membayar lebih</option><option value="tidak_tahu">Belum tahu</option></select>
      <label>Seberapa mungkin Anda membeli menu pilihan?</label><select value={intent} onChange={e=>setIntent(e.target.value)}><option value="yes">Saya ingin membeli</option><option value="maybe">Mungkin akan membeli</option><option value="no">Belum berminat membeli</option></select>
      {error && <p className="error">{error}</p>}<button disabled={busy||!campaign||menus.length===0} style={{marginTop:20}}>{busy?"Mengirim…":"Kirim jawaban"}</button>
      <p className="muted" style={{fontSize:12}}>Hindari memasukkan informasi pribadi. Jawaban digunakan untuk membaca minat menu.</p>
    </form>{followLinks}</>}
  </main>;
}