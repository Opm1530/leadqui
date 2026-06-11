-- Colunas do fluxo no Trello: em aprovação e aprovado/concluída
ALTER TABLE "techqui_settings" ADD COLUMN "trello_approval_list_id" TEXT;
ALTER TABLE "techqui_settings" ADD COLUMN "trello_approved_list_id" TEXT;
