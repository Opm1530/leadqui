import prisma from "./prisma";

// Sistema de empresa única: as configurações de API são compartilhadas.
// O registro "dono" é o do primeiro ADMIN criado (admin fundador).

export async function getCompanySettingsUserId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { created_at: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}

export async function getCompanySettings() {
  const uid = await getCompanySettingsUserId();
  if (!uid) return null;
  return prisma.userSettings.findUnique({ where: { user_id: uid } });
}
