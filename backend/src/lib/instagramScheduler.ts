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
      const igToken = conn?.page_access_token || conn?.access_token;
      if (!conn?.instagram_account_id || !igToken) {
        await (prisma as any).instagramScheduledPost.update({
          where: { id: post.id },
          data:  { status: "ERRO", error_message: "Conta Instagram ou token não configurados" },
        });
        continue;
      }

      // Instagram Business Login usa graph.instagram.com; Facebook Login usa graph.facebook.com
      const base = conn.connection_type === "INSTAGRAM"
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
          // Aguardar processamento do vídeo (polling)
          await waitForVideoReady(base, mediaId, igToken);
        } else {
          // IMAGE
          const r = await axios.post(`${base}/${conn.instagram_account_id}/media`, {
            image_url:    mediaUrls[0],
            caption:      post.caption || "",
            access_token: igToken,
          });
          mediaId = r.data.id;
        }

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

async function waitForVideoReady(base: string, mediaId: string, token: string, maxTries = 15) {
  for (let i = 0; i < maxTries; i++) {
    await sleep(10000);
    const r = await axios.get(`${base}/${mediaId}`, {
      params: { fields: "status_code", access_token: token },
    });
    if (r.data.status_code === "FINISHED") return;
    if (r.data.status_code === "ERROR") throw new Error("Vídeo rejeitado pela Meta");
  }
  throw new Error("Timeout aguardando processamento do vídeo");
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function startInstagramScheduler() {
  console.log("[InstagramScheduler] Iniciado — verificação a cada minuto");
  publishScheduledPosts();
  setInterval(publishScheduledPosts, 60 * 1000);
}
