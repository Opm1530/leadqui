import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import OpenAI from "openai";

admin.initializeApp();
const db = admin.firestore();

export const extractGoogleMaps = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { categoria, cidade, quantidade, userId, extracaoId, tagId } = data;
  
  if (!categoria || !cidade || !quantidade || !userId || !extracaoId) {
    throw new functions.https.HttpsError("invalid-argument", "Parâmetros obrigatórios ausentes");
  }

  try {
    // Buscar API Key
    const configDoc = await db.collection("configuracoes").doc(userId).get();
    if (!configDoc.exists) {
      throw new Error("Configurações não encontradas");
    }
    
    // .trim() evita erro 403 (Unauthorized) caso o usuário tenha colado com espaços em branco no final
    const apiKey = (configDoc.data()?.serper_api_key || "").trim();
    if (!apiKey) {
      throw new Error("Serper API Key não configurada");
    }

    // --- Paginação Serper ---
    const totalPaginas = Math.ceil(quantidade / 10);
    let allPlaces: any[] = [];
    let lastRatelimitRemaining = null;

    for (let page = 1; page <= totalPaginas; page++) {
      // Verificar cancelamento
      const check = await db.collection("extracoes").doc(extracaoId).get();
      if (check.data()?.status === "parado") break;

      await db.collection("extracoes").doc(extracaoId).update({ 
        step_message: `Buscando resultados: página ${page} de ${totalPaginas}...`,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      try {
        const response = await axios.post(
          "https://google.serper.dev/places",
          {
            q: `${categoria} em ${cidade}`,
            num: 10,
            page: page,
            gl: "br",
            hl: "pt"
          },
          {
            headers: {
              "X-API-KEY": apiKey,
              "Content-Type": "application/json"
            }
          }
        );

        const places = response.data.places || [];
        if (places.length === 0) break;

        allPlaces = allPlaces.concat(places);

        // Atualizar progresso com leads "encontrados"
        await db.collection("extracoes").doc(extracaoId).update({
          progresso: allPlaces.length,
          total_leads: allPlaces.length,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        const ratelimit = response.headers["x-ratelimit-remaining"] || response.headers["X-RateLimit-Remaining"];
        if (ratelimit) lastRatelimitRemaining = ratelimit;

      } catch (error: any) {
        console.error(`Erro na página ${page}:`, error.response?.data || error.message);
        break; // Para no primeiro erro de página
      }
    }

    // Fatiar para a quantidade exata solicitada
    const places = allPlaces.slice(0, quantidade);

    // Salvar saldo do Serper da última chamada bem-sucedida
    if (lastRatelimitRemaining) {
      await db.collection("configuracoes").doc(userId).update({
        serper_credits_remaining: parseInt(lastRatelimitRemaining, 10),
        serper_credits_updated_at: admin.firestore.FieldValue.serverTimestamp()
      }).catch(err => console.error("Erro ao salvar saldo serper:", err));
    }

    // --- Deduplicação Inter-fontes e Contra Antigos ---
    await db.collection("extracoes").doc(extracaoId).update({ step_message: "Deduplicando e salvando leads..." });
    
    // IDs das fontes
    const placeIds = places.filter((p: any) => !!p.placeId).map((p: any) => p.placeId);
    const existingPlaceIds = new Set<string>();

    for (let i = 0; i < placeIds.length; i += 30) {
      const chunk = placeIds.slice(i, i + 30);
      const snap = await db.collection("leads")
        .where("user_id", "==", userId)
        .where("google_place_id", "in", chunk)
        .get();
      snap.forEach(doc => existingPlaceIds.add(doc.data().google_place_id));
    }

    // Telefones
    const phones = places
      .filter((p: any) => !!p.phoneNumber)
      .map((p: any) => String(p.phoneNumber).replace(/\D/g, ""));
    const existingPhones = new Set<string>();

    for (let i = 0; i < phones.length; i += 30) {
      const chunk = phones.slice(i, i + 30);
      const snap = await db.collection("leads")
        .where("user_id", "==", userId)
        .where("telefone_limpo", "in", chunk)
        .get();
      snap.forEach(doc => existingPhones.add(doc.data().telefone_limpo));
    }

    // URLs (Deduplicação para leads antigos que não tinham place_id ou telefone_limpo)
    const urls = places.map((p: any) => p.url).filter(Boolean);
    const existingUrls = new Set<string>();
    for (let i = 0; i < urls.length; i += 30) {
      const chunk = urls.slice(i, i + 30);
      const snap = await db.collection("leads")
        .where("user_id", "==", userId)
        .where("maps_url", "in", chunk)
        .get();
      snap.forEach(doc => existingUrls.add(doc.data().maps_url));
    }

    let savedCount = 0;
    let batchCount = 0;
    const batch = db.batch();
    
    for (const place of places) {
      // Verificar se já existe (Deduplicação)
      const phoneClean = place.phoneNumber ? String(place.phoneNumber).replace(/\D/g, "") : null;
      
      // Critérios de exclusão
      if (place.placeId && existingPlaceIds.has(place.placeId)) continue;
      if (phoneClean && existingPhones.has(phoneClean)) continue;
      if (place.url && existingUrls.has(place.url)) continue;

      // --- IMPORTANTE: Adicionar aos conjuntos existentes para evitar duplicatas NO MESMO LOTE ---
      if (place.placeId) existingPlaceIds.add(place.placeId);
      if (phoneClean) existingPhones.add(phoneClean);
      if (place.url) existingUrls.add(place.url);

      const leadRef = db.collection("leads").doc();
      batch.set(leadRef, {
        user_id: userId,
        nome: place.title || "Sem nome",
        telefone: place.phoneNumber || null,
        telefone_limpo: phoneClean,
        endereco: place.address || null,
        cidade: cidade,
        categoria: categoria,
        website: place.website || null,
        maps_url: place.url || (place.placeId ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}` : null),
        google_place_id: place.placeId || null,
        origem: "google_maps",
        status: "novo",
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      batchCount++;
      savedCount++;

      if (tagId) {
        const leadTagRef = db.collection("lead_tags").doc();
        batch.set(leadTagRef, {
          lead_id: leadRef.id,
          tag_id: tagId,
          user_id: userId,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        batchCount++;
      }
      
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
        await db.collection("extracoes").doc(extracaoId).update({ progresso: savedCount, total_leads: savedCount });
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    // Atualizar status final da extração
    await db.collection("extracoes").doc(extracaoId).update({
      status: "concluido",
      progresso: savedCount,
      total_leads: savedCount,
      step_message: `Concluído! ${savedCount} novos leads salvos.`,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, total: savedCount };
    
  } catch (error: any) {
    console.error("Erro em extractGoogleMaps:", error.response?.data || error);
    const msg = error.response?.data?.message || error.message;
    await db.collection("extracoes").doc(extracaoId).update({
      status: "erro",
      erro: msg || "Erro desconhecido na API do Serper",
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    throw new functions.https.HttpsError("internal", msg);
  }
});


export const extractInstagram = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { hashtag, quantidade, userId, extracaoId, tagId } = data;
  
  if (!hashtag || !quantidade || !userId || !extracaoId) {
    throw new functions.https.HttpsError("invalid-argument", "Parâmetros obrigatórios ausentes");
  }

  const updateExt = async (payload: any) => {
    await db.collection("extracoes").doc(extracaoId).update({
      ...payload,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  };

  try {
    // 1. Obter configs (Apify e OpenAI)
    const configDoc = await db.collection("configuracoes").doc(userId).get();
    if (!configDoc.exists) throw new Error("Configurações não encontradas");
    const config = configDoc.data() || {};
    
    // .trim() para evitar falhas de autenticação
    const apifyKey = (config.apify_api_key || "").trim();
    const openaiKey = (config.openai_api_key || "").trim();

    if (!apifyKey || !openaiKey) {
      throw new Error("Apify API Key ou OpenAI API Key não configuradas");
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    // ETAPA 1 - Buscar posts pela hashtag (Apify)
    await updateExt({ step_message: "Buscando posts da hashtag..." });
    const postsRes = await axios.post(
      `https://api.apify.com/v2/acts/reGe1ST3OBgYZSsZJ/run-sync-get-dataset-items?token=${apifyKey}`,
      { hashtags: [hashtag], resultsType: "posts", resultsLimit: quantidade },
      { headers: { "Content-Type": "application/json" } }
    );

    const postsMap: Record<string, string> = {};
    for (const post of postsRes.data || []) {
      if (post.ownerUsername) {
        let u = post.ownerUsername.toLowerCase().trim().replace(/^@/, "");
        if (u) {
          if (!postsMap[u]) postsMap[u] = post.url || "";
        }
      }
    }
    const uniqueUsernames = Object.keys(postsMap);

    // ETAPA 2 - Deduplicar no Firestore
    await updateExt({ step_message: "Deduplicando usuários..." });
    const existingUsernames = new Set<string>();

    for (let i = 0; i < uniqueUsernames.length; i += 30) {
      const chunk = uniqueUsernames.slice(i, i + 30);
      const snap = await db.collection("leads")
        .where("user_id", "==", userId)
        .where("username", "in", chunk)
        .get();
      snap.forEach(doc => {
        existingUsernames.add(doc.data().username);
      });
    }

    const newTargetUsernames = uniqueUsernames.filter(u => !existingUsernames.has(u));

    await updateExt({ 
      step_message: `Encontrados ${newTargetUsernames.length} perfis novos para processar...`,
      total: newTargetUsernames.length,
      progresso: 0
    });

    if (newTargetUsernames.length === 0) {
      await updateExt({ status: "concluido", step_message: "Concluído! 0 leads salvos (todos já existiam).", total_leads: 0 });
      return { success: true, total: 0 };
    }

    // ETAPA 3 e 4 - Buscar perfis completos (lotes de 10) e IA
    let savedCount = 0;
    let batchCount = 0;
    const batch = db.batch();

    for (let i = 0; i < newTargetUsernames.length; i += 10) {
      // Check cancelation
      const check = await db.collection("extracoes").doc(extracaoId).get();
      if (check.data()?.status === "parado") break;

      const chunk = newTargetUsernames.slice(i, i + 10);
      
      await updateExt({ 
        step_message: `Buscando perfis: ${Math.min(i + 10, newTargetUsernames.length)} de ${newTargetUsernames.length}`
      });

      const profileRes = await axios.post(
        `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyKey}`,
        { usernames: chunk },
        { headers: { "Content-Type": "application/json" } }
      );

      const profiles = profileRes.data || [];

      await updateExt({ step_message: `Extraindo contatos via IA: lote ${i/10 + 1}...` });

      for (const profile of profiles) {
        const u = profile.username;
        const fullName = profile.fullName;
        const bio = profile.biography || "";
        const followers = profile.followersCount || null;
        const externalUrls = profile.externalUrls || [];
        const latestPostDate = profile.latestPosts && profile.latestPosts[0] ? profile.latestPosts[0].timestamp : null;

        // ETAPA 4 - Extração de Contato (OpenAI)
        let contato = "";
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `Extraia o número de WhatsApp (com DDI 55) da "Biografia" ou "LinksExternos" abaixo.
Se encontrar, retorne um objeto JSON contendo APENAS a chave "telefone" com o número (somente dígitos).
Exemplo positivo: {"telefone": "5511999999999"}
Caso não exista nenhum WhatsApp explícito ou dedutível, retorne EXATAMENTE: {"telefone": "NONE"}
Seja estrito. Não adicione textos extras.`
              },
              {
                role: "user",
                content: `Biografia: ${bio}\nLinksExternos: ${JSON.stringify(externalUrls)}`
              }
            ]
          });
          
          const rawResponse = completion.choices[0]?.message?.content?.trim() || "{}";
          let jsonStr = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
          
          const parsed = JSON.parse(jsonStr);
          if (parsed.telefone && parsed.telefone !== "NONE") {
             contato = String(parsed.telefone).replace(/\D/g, "");
          } else if (Array.isArray(parsed) && parsed[0]?.telefone && parsed[0].telefone !== "NONE") {
             contato = String(parsed[0].telefone).replace(/\D/g, ""); // fallback de segurança
          }
        } catch(e) {
          console.error(`Erro OpenAI para ${u}:`, e);
        }

        // ETAPA 5 - Salvar cada lead
        // Se encontramos um telefone, verificamos se já existe um lead com ele (para evitar duplicidade inter-fontes)
        if (contato) {
          const phoneSnap = await db.collection("leads")
            .where("user_id", "==", userId)
            .where("telefone_limpo", "==", contato)
            .limit(1)
            .get();
          
          if (!phoneSnap.empty) {
            console.log(`Lead com telefone ${contato} já existe. Pulando...`);
            continue; 
          }
        }

        const leadRef = db.collection("leads").doc();
        batch.set(leadRef, {
          nome: fullName || u,
          username: u,
          telefone: contato ? contato : "",
          telefone_limpo: contato || null,
          perfil: "https://instagram.com/" + u,
          biografia: bio,
          seguidores: followers,
          data_ultimo_post: latestPostDate,
          origem: "instagram",
          status: "novo",
          user_id: userId,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
          perfil_url: `https://www.instagram.com/${u}/`,
          post_url: postsMap[u] || null
        });
        batchCount++;
        savedCount++;
        
        if (tagId) {
          const leadTagRef = db.collection("lead_tags").doc();
          batch.set(leadTagRef, {
            lead_id: leadRef.id,
            tag_id: tagId,
            user_id: userId,
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
          batchCount++;
        }
        
        await updateExt({ progresso: savedCount });

        if (batchCount >= 400) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    // Finished
    await updateExt({
      status: "concluido",
      progresso: savedCount,
      total_leads: savedCount,
      total: savedCount,
      step_message: `Concluído! ${savedCount} leads salvos.`
    });

    return { success: true, total: savedCount };
    
  } catch (error: any) {
    console.error("Erro em extractInstagram:", error);
    await updateExt({
      status: "erro",
      step_message: "Ocorreu um erro fatal.",
      erro: error.message || "Erro desconhecido na extração do Instagram"
    });
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// Endpoint para consultar saldo do Apify
export const getApifyUsage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const userId = data.userId || context.auth.uid;
  
  try {
    const configDoc = await db.collection("configuracoes").doc(userId).get();
    if (!configDoc.exists) throw new Error("Configurações não encontradas");
    
    const apiKey = configDoc.data()?.apify_api_key;
    if (!apiKey) throw new Error("Apify API Key não configurada");

    const response = await axios.get("https://api.apify.com/v2/users/me/usage/monthly", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    const dataObj = response.data?.data || {};
    const usedUsd = dataObj.usedUsd || 0;
    const totalCreditsUsd = dataObj.totalCreditsUsd || 0;
    const remainingUsd = totalCreditsUsd - usedUsd;

    return {
      usedUsd,
      totalCreditsUsd,
      remainingUsd
    };

  } catch (error: any) {
    console.error("Erro em getApifyUsage:", error);
    throw new functions.https.HttpsError("internal", error.message || "Erro ao consultar saldo Apify");
  }
});
