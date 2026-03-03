
-- User settings table for webhook URLs and API configs
CREATE TABLE public.configuracoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  webhook_google_maps text,
  webhook_instagram text,
  evolution_api_url text,
  evolution_api_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.configuracoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.configuracoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.configuracoes FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
