import axios from "axios";
import prisma from "./prisma";

export async function publishScheduledPosts() {
  const now = new Date();
  try {
    const due = await (prisma as any).instagramScheduledPost.findMany({
      where: { status: "AGENDADO", scheduled_at: { lte: now } },
      include: { connection: true },
    });

    for (const post of due) {
      const conn = post.connection;
      // Prioriza Instagram Login (ig_access_token); senão Facebook Page token
      const useIg   = !!conn?.ig_access_token;
      const igToken = useIg ? conn.ig_access_token : (conn?.page_access_token || conn?.access_token);
      if (!conn?.instagram_account_id || !igToken) {
        await (prisma as any).instagramScheduledPost.update({
          where: { id: post.id },
          data:  { status: "ERRO", error_message: "Conta Instagram ou token não configurados" },
        });
        continue;
      }

      const base = useIg
        ? "https://graph.instagram.com/v21.0"
        : "https://graph.facebook.com/v20.0";

      try {
        const mediaUrls: string[] = JSON.parse(post.media_urls || "[]");
        let mediaId: string;

        if (post.media_type === "CAROUSEL") {
          // 1. Criar cada item do carrossel
          const childIds: string[] = [];
          for (const url of mediaUrls) {
            const isVideo = /\.(mp4|mov|avi)$/i.test(url);
            const r = await axios.post(`${base}/${conn.instagram_account_id}/media`, {
              ...(isVideo ? { video_url: url, media_type: "VIDEO", is_carousel_item: true } : { image_url: url, is_carousel_item: true }),
              access_token: igToken,
            });
            childIds.push(r.data.id);
          }
          // 2. Criar container do carrossel
          const container = await axios.post(`${base}/${conn.instagram_account_id}/media`, {
            media_type: "CAROUSEL",
            children:   childIds.join(","),
            caption:    post.caption || "",
            access_token: igToken,
          });
          mediaId = container.data.id;
        } else if (post.media_type === "REELS") {
          const r = await axios.post(`${base}/${conn.instagram_account_id}/media`, {
            media_type:   "REELS",
            video_url:    mediaUrls[0],
            caption:      post.caption || "",
            access_token: igToken,
          });
          mediaId = r.data.id;
        } else {
          // IMAGE
          const r = await axios.post(`${base}/${conn.instagram_account_id}/media`, {
            image_url:    mediaUrls[0],
            caption:      post.caption || "",
            access_token: igToken,
          });
          mediaId = r.data.id;
        }

        // 2.5. Aguardar o container ficar FINISHED antes de publicar (vale para todos os tipos)
        await waitForMediaReady(base, mediaId, igToken);

        // 3. Publicar
        const published = await axios.post(`${base}/${conn.instagram_account_id}/media_publish`, {
          creation_id: mediaId,
          access_token: igToken,
        });

        await (prisma as any).instagramScheduledPost.update({
          where: { id: post.id },
          data:  { status: "PUBLICADO", instagram_media_id: published.data.id, published_at: new Date() },
        });

        // Sincronizar status de volta ao CalendarPost vinculado
        await (prisma as any).calendarPost.updateMany({
          where: { instagram_post_id: post.id },
          data:  { status: "PUBLICADO" },
        });

        console.log(`[InstagramScheduler] Post ${post.id} publicado — media_id: ${published.data.id}`);
      } catch (err: any) {
        const msg = err.response?.data?.error?.message || err.message;
        await (prisma as any).instagramScheduledPost.update({
          where: { id: post.id },
          data:  { status: "ERRO", error_message: msg },
        });
        console.error(`[InstagramScheduler] Erro no post ${post.id}:`, msg);
      }
    }
  } catch (err: any) {
    console.error("[InstagramScheduler] Erro geral:", err.message);
  }
}

async function waitForMediaReady(base: string, mediaId: string, token: string, maxTries = 20) {
  for (let i = 0; i < maxTries; i++) {
    const r = await axios.get(`${base}/${mediaId}`, {
      params: { fields: "status_code,status", access_token: token },
    });
    const code = r.data.status_code;
    if (code === "FINISHED") return;
    if (code === "ERROR") {
      throw new Error("Mídia rejeitada pela Meta. Verifique se a URL é pública e o formato é suportado. Detalhe: " + (r.data.status || ""));
    }
    // IN_PROGRESS / EXPIRED / PUBLISHED — aguardar
    await sleep(5000);
  }
  throw new Error("Timeout aguardando processamento da mídia (a URL pode estar inacessível pela Meta)");
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function startInstagramScheduler() {
  console.log("[InstagramScheduler] Iniciado — verificação a cada minuto");
  publishScheduledPosts();
  setInterval(publishScheduledPosts, 60 * 1000);
}
