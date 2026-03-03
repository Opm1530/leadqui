
-- Add new columns to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS perfil_url text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS post_url text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tag_origem text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS campos_extras jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS extracao_id uuid;

-- Create extracoes table
CREATE TABLE public.extracoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  parametros jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'em_andamento',
  total_leads integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.extracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extractions" ON public.extracoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own extractions" ON public.extracoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own extractions" ON public.extracoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own extractions" ON public.extracoes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_extracoes_user_id ON public.extracoes(user_id);

-- Create tags table
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#3b82f6',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags" ON public.tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON public.tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON public.tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON public.tags FOR DELETE USING (auth.uid() = user_id);

-- Create lead_tags table
CREATE TABLE public.lead_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  UNIQUE(lead_id, tag_id)
);

ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lead_tags" ON public.lead_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_tags.lead_id AND leads.user_id = auth.uid()));
CREATE POLICY "Users can insert own lead_tags" ON public.lead_tags FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_tags.lead_id AND leads.user_id = auth.uid()));
CREATE POLICY "Users can delete own lead_tags" ON public.lead_tags FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_tags.lead_id AND leads.user_id = auth.uid()));

CREATE INDEX idx_lead_tags_lead_id ON public.lead_tags(lead_id);
CREATE INDEX idx_lead_tags_tag_id ON public.lead_tags(tag_id);

-- Add FK from leads to extracoes
ALTER TABLE public.leads ADD CONSTRAINT leads_extracao_id_fkey FOREIGN KEY (extracao_id) REFERENCES public.extracoes(id);

-- Enable realtime for extracoes
ALTER PUBLICATION supabase_realtime ADD TABLE public.extracoes;
