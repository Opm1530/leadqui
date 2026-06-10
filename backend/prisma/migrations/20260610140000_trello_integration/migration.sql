-- Integração Trello + Tasqui: quadro padrão e rastreio de card/tarefa
ALTER TABLE "techqui_settings" ADD COLUMN "trello_board_id" TEXT;
ALTER TABLE "calendar_posts" ADD COLUMN "trello_card_id" TEXT;
ALTER TABLE "calendar_posts" ADD COLUMN "trello_card_url" TEXT;
ALTER TABLE "calendar_posts" ADD COLUMN "task_id" TEXT;
