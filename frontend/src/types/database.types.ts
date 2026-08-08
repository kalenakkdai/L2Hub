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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          metadata_json: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata_json?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata_json?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campsite_settings: {
        Row: {
          accent_color: string
          category: string | null
          created_at: string
          icon: string | null
          id: string
          is_public: boolean
          join_code: string | null
          modules_enabled: Json
          name: string
          points_config: Json
          requires_approval: boolean
          singleton: boolean
          tagline: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          category?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_public?: boolean
          join_code?: string | null
          modules_enabled?: Json
          name?: string
          points_config?: Json
          requires_approval?: boolean
          singleton?: boolean
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          category?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_public?: boolean
          join_code?: string | null
          modules_enabled?: Json
          name?: string
          points_config?: Json
          requires_approval?: boolean
          singleton?: boolean
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      committee_memberships: {
        Row: {
          committee_id: string
          created_at: string
          id: string
          is_head: boolean
          membership_type: string
          user_id: string
        }
        Insert: {
          committee_id: string
          created_at?: string
          id?: string
          is_head?: boolean
          membership_type?: string
          user_id: string
        }
        Update: {
          committee_id?: string
          created_at?: string
          id?: string
          is_head?: boolean
          membership_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_memberships_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      committees: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      debrief_participants: {
        Row: {
          display_name: string
          event_id: string
          id: string
          status: string
          submitted_at: string | null
          user_id: string | null
        }
        Insert: {
          display_name: string
          event_id: string
          id?: string
          status?: string
          submitted_at?: string | null
          user_id?: string | null
        }
        Update: {
          display_name?: string
          event_id?: string
          id?: string
          status?: string
          submitted_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debrief_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debrief_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_agendas: {
        Row: {
          content_json: string
          created_at: string
          event_id: string
          id: string
          status: string
          summary_id: string | null
          updated_at: string
        }
        Insert: {
          content_json?: string
          created_at?: string
          event_id: string
          id?: string
          status?: string
          summary_id?: string | null
          updated_at?: string
        }
        Update: {
          content_json?: string
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          summary_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_agendas_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_agendas_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "event_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      event_summaries: {
        Row: {
          created_at: string
          event_id: string
          generation_stage: string | null
          id: string
          payload_json: string | null
          presented_at: string | null
          presented_by: string | null
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          generation_stage?: string | null
          id?: string
          payload_json?: string | null
          presented_at?: string | null
          presented_by?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          generation_stage?: string | null
          id?: string
          payload_json?: string | null
          presented_at?: string | null
          presented_by?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_summaries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_summaries_presented_by_fkey"
            columns: ["presented_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_summaries_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_summary_requests: {
        Row: {
          created_at: string
          event_id: string
          id: string
          note: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_summary_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_summary_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_summary_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          managing_committee_id: string | null
          name: string
          slug: string
          starts_at: string | null
          status: string
          year: number
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          managing_committee_id?: string | null
          name: string
          slug: string
          starts_at?: string | null
          status?: string
          year: number
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          managing_committee_id?: string | null
          name?: string
          slug?: string
          starts_at?: string | null
          status?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_managing_committee_id_fkey"
            columns: ["managing_committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: string
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          payload_json: string | null
          read_at: string | null
          recipient_user_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          payload_json?: string | null
          read_at?: string | null
          recipient_user_id: string
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          payload_json?: string | null
          read_at?: string | null
          recipient_user_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_overrides: {
        Row: {
          committee_id: string | null
          created_at: string
          created_by_user_id: string | null
          effect: string
          event_id: string | null
          id: string
          permission_id: string
          reason: string | null
          role_id: string | null
          user_id: string | null
        }
        Insert: {
          committee_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          effect: string
          event_id?: string | null
          id?: string
          permission_id: string
          reason?: string | null
          role_id?: string | null
          user_id?: string | null
        }
        Update: {
          committee_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          effect?: string
          event_id?: string | null
          id?: string
          permission_id?: string
          reason?: string | null
          role_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_overrides_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_overrides_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_overrides_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          description: string
          id: string
          key: string
        }
        Insert: {
          category?: string
          description?: string
          id?: string
          key: string
        }
        Update: {
          category?: string
          description?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          compact_density: boolean
          created_at: string
          display_name: string | null
          email: string
          email_verified: boolean
          full_name: string | null
          grade_year: number | null
          id: string
          last_active_at: string | null
          notifications_paused: boolean
          phone: string | null
          phone_verified: boolean
          pronouns: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reduce_motion: boolean
          status: string
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          compact_density?: boolean
          created_at?: string
          display_name?: string | null
          email: string
          email_verified?: boolean
          full_name?: string | null
          grade_year?: number | null
          id: string
          last_active_at?: string | null
          notifications_paused?: boolean
          phone?: string | null
          phone_verified?: boolean
          pronouns?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reduce_motion?: boolean
          status?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          compact_density?: boolean
          created_at?: string
          display_name?: string | null
          email?: string
          email_verified?: boolean
          full_name?: string | null
          grade_year?: number | null
          id?: string
          last_active_at?: string | null
          notifications_paused?: boolean
          phone?: string | null
          phone_verified?: boolean
          pronouns?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reduce_motion?: boolean
          status?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          effect: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          effect?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          effect?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_assignable: boolean
          is_system: boolean
          name: string
          rank: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_assignable?: boolean
          is_system?: boolean
          name: string
          rank: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_assignable?: boolean
          is_system?: boolean
          name?: string
          rank?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          committee_id: string | null
          created_at: string
          ends_at: string | null
          event_id: string | null
          id: string
          role_id: string
          starts_at: string | null
          user_id: string
        }
        Insert: {
          committee_id?: string | null
          created_at?: string
          ends_at?: string | null
          event_id?: string | null
          id?: string
          role_id: string
          starts_at?: string | null
          user_id: string
        }
        Update: {
          committee_id?: string | null
          created_at?: string
          ends_at?: string | null
          event_id?: string | null
          id?: string
          role_id?: string
          starts_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_can_access_event: {
        Args: { target_event_id: string }
        Returns: boolean
      }
      current_user_has_permission: {
        Args: {
          permission_key: string
          requested_committee_id?: string
          requested_event_id?: string
        }
        Returns: boolean
      }
      current_user_has_role: {
        Args: { role_slugs: string[] }
        Returns: boolean
      }
      current_user_heads_committee: {
        Args: { target_committee_id: string }
        Returns: boolean
      }
      current_user_is_committee_member: {
        Args: { target_committee_id: string }
        Returns: boolean
      }
      current_user_rank: { Args: never; Returns: number }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
