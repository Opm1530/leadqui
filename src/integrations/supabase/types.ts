export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campanhas: {
        Row: {
          created_at: string
          id: string
          instancia_id: string | null
          mensagem: string
          nome: string
          status: string
          total_leads: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instancia_id?: string | null
          mensagem: string
          nome: string
          status?: string
          total_leads?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instancia_id?: string | null
          mensagem?: string
          nome?: string
          status?: string
          total_leads?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          created_at: string
          evolution_api_key: string | null
          evolution_api_url: string | null
          id: string
          updated_at: string
          user_id: string
          webhook_google_maps: string | null
          webhook_instagram: string | null
        }
        Insert: {
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          updated_at?: string
          user_id: string
          webhook_google_maps?: string | null
          webhook_instagram?: string | null
        }
        Update: {
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          webhook_google_maps?: string | null
          webhook_instagram?: string | null
        }
        Relationships: []
      }
      extracoes: {
        Row: {
          created_at: string
          id: string
          parametros: Json | null
          status: string
          tipo: string
          total_leads: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parametros?: Json | null
          status?: string
          tipo: string
          total_leads?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parametros?: Json | null
          status?: string
          tipo?: string
          total_leads?: number | null
          user_id?: string
        }
        Relationships: []
      }
      instancias: {
        Row: {
          created_at: string
          evolution_instance_id: string
          id: string
          nome: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          evolution_instance_id: string
          id?: string
          nome: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          evolution_instance_id?: string
          id?: string
          nome?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_tags: {
        Row: {
          id: string
          lead_id: string
          tag_id: string
        }
        Insert: {
          id?: string
          lead_id: string
          tag_id: string
        }
        Update: {
          id?: string
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          campos_extras: Json | null
          categoria: string | null
          cidade: string | null
          created_at: string
          extracao_id: string | null
          id: string
          nome: string
          origem: string | null
          perfil_url: string | null
          post_url: string | null
          seguidores: number | null
          status: string
          tag_origem: string | null
          telefone: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          campos_extras?: Json | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string
          extracao_id?: string | null
          id?: string
          nome: string
          origem?: string | null
          perfil_url?: string | null
          post_url?: string | null
          seguidores?: number | null
          status?: string
          tag_origem?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          campos_extras?: Json | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string
          extracao_id?: string | null
          id?: string
          nome?: string
          origem?: string | null
          perfil_url?: string | null
          post_url?: string | null
          seguidores?: number | null
          status?: string
          tag_origem?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_extracao_id_fkey"
            columns: ["extracao_id"]
            isOneToOne: false
            referencedRelation: "extracoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
