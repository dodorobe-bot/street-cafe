import type { SupabaseClient } from "@supabase/supabase-js";

// Must stay in sync with the platform CHECK constraint in supabase/schema.sql.
export type SocialPlatform = "instagram" | "facebook" | "x" | "tiktok" | "threads" | "whatsapp" | "youtube" | "other";
export type SocialLink = { id: string; platform: SocialPlatform; url: string; cafe_id: string | null; campaign_id: string | null };

export const SOCIAL_PLATFORMS: [SocialPlatform, string][] = [
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["x", "X (Twitter)"],
  ["tiktok", "TikTok"],
  ["threads", "Threads"],
  ["whatsapp", "WhatsApp"],
  ["youtube", "YouTube"],
  ["other", "Lainnya"],
];

export const platformLabel = (platform: SocialPlatform) => SOCIAL_PLATFORMS.find(([value]) => value === platform)?.[1] ?? platform;

// Campaign links plus the cafe defaults that apply to every campaign of that cafe.
export async function fetchSocialLinks(client: SupabaseClient, campaignId: string, cafeId: string): Promise<SocialLink[]> {
  const [byCampaign, byCafe] = await Promise.all([
    client.from("social_links").select("id,platform,url,cafe_id,campaign_id").eq("campaign_id", campaignId),
    client.from("social_links").select("id,platform,url,cafe_id,campaign_id").eq("cafe_id", cafeId),
  ]);
  const seen = new Set<string>();
  return [...((byCampaign.data || []) as SocialLink[]), ...((byCafe.data || []) as SocialLink[])].filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}
