export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      challenge_members: {
        Row: {
          challenge_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          challenge_id: string
          id?: string
          joined_at?: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          challenge_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_members_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          bet_description: string | null
          bet_rule: Database["public"]["Enums"]["bet_rule"]
          checkin_time: string
          created_at: string
          creator_id: string
          description: string | null
          end_date: string
          id: string
          join_code: string
          screenshot_required: boolean
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          bet_description?: string | null
          bet_rule: Database["public"]["Enums"]["bet_rule"]
          checkin_time: string
          created_at?: string
          creator_id: string
          description?: string | null
          end_date: string
          id?: string
          join_code: string
          screenshot_required?: boolean
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          bet_description?: string | null
          bet_rule?: Database["public"]["Enums"]["bet_rule"]
          checkin_time?: string
          created_at?: string
          creator_id?: string
          description?: string | null
          end_date?: string
          id?: string
          join_code?: string
          screenshot_required?: boolean
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          challenge_id: string
          created_at: string
          date: string
          id: string
          screenshot_name: string | null
          status: Database["public"]["Enums"]["checkin_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          date: string
          id?: string
          screenshot_name?: string | null
          status: Database["public"]["Enums"]["checkin_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          date?: string
          id?: string
          screenshot_name?: string | null
          status?: Database["public"]["Enums"]["checkin_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_logs: {
        Row: {
          challenge_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          challenge_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_logs_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          dark_mode: boolean
          display_name: string | null
          id: string
          locale: string
          push_enabled: boolean
          updated_at: string
          user_name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dark_mode?: boolean
          display_name?: string | null
          id: string
          locale?: string
          push_enabled?: boolean
          updated_at?: string
          user_name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dark_mode?: boolean
          display_name?: string | null
          id?: string
          locale?: string
          push_enabled?: boolean
          updated_at?: string
          user_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_profile_exists: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_unique_join_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_challenge_by_join_code: {
        Args: { p_join_code: string }
        Returns: {
          bet_description: string | null
          bet_rule: Database["public"]["Enums"]["bet_rule"]
          checkin_time: string
          created_at: string
          creator_id: string
          description: string | null
          end_date: string
          id: string
          join_code: string
          screenshot_required: boolean
          start_date: string
          title: string
          updated_at: string
        }
      }
      get_fail_counts: {
        Args: { p_challenge_id: string }
        Returns: {
          user_id: string
          days: number
        }[]
      }
      get_success_counts: {
        Args: { p_challenge_id: string }
        Returns: {
          user_id: string
          days: number
        }[]
      }
      get_user_calendar: {
        Args: { p_challenge_id: string; p_user_id?: string }
        Returns: {
          date: string
          status: Database["public"]["Enums"]["checkin_status"]
        }[]
      }
      is_creator_of_challenge: {
        Args: { p_challenge_id: string }
        Returns: boolean
      }
      is_member_of_challenge: {
        Args: { p_challenge_id: string }
        Returns: boolean
      }
      join_challenge_by_code: {
        Args: { p_join_code: string }
        Returns: {
          bet_description: string | null
          bet_rule: Database["public"]["Enums"]["bet_rule"]
          checkin_time: string
          created_at: string
          creator_id: string
          description: string | null
          end_date: string
          id: string
          join_code: string
          screenshot_required: boolean
          start_date: string
          title: string
          updated_at: string
        }
      }
      rotate_join_code: {
        Args: { p_challenge_id: string }
        Returns: string
      }
      upsert_check_in: {
        Args: {
          p_challenge_id: string
          p_date: string
          p_status: Database["public"]["Enums"]["checkin_status"]
          p_screenshot_name?: string
        }
        Returns: {
          challenge_id: string
          created_at: string
          date: string
          id: string
          screenshot_name: string | null
          status: Database["public"]["Enums"]["checkin_status"]
          updated_at: string
          user_id: string
        }
      }
    }
    Enums: {
      bet_rule: "per_day" | "end_fail"
      checkin_status: "success" | "fail"
      member_role: "creator" | "member"
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
    Enums: {
      bet_rule: ["per_day", "end_fail"],
      checkin_status: ["success", "fail"],
      member_role: ["creator", "member"],
    },
  },
} as const
