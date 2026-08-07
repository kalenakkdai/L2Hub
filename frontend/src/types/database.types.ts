/**
 * Supabase Database types for the normalized authentication/RBAC schema.
 *
 * Source migration:
 *   supabase/migrations/20260807020000_normalize_auth_and_rls.sql
 *
 * Regenerate with `supabase gen types typescript` after linking a hosted
 * project; this checked-in copy keeps local builds typed without the CLI.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          status: string
          last_active_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          status?: string
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          status?: string
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          name: string
          slug: string
          rank: number
          is_system: boolean
          is_assignable: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          rank: number
          is_system?: boolean
          is_assignable?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          rank?: number
          is_system?: boolean
          is_assignable?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          id: string
          key: string
          description: string
          category: string
        }
        Insert: {
          id?: string
          key: string
          description?: string
          category?: string
        }
        Update: {
          id?: string
          key?: string
          description?: string
          category?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: string
          role_id: string
          permission_id: string
          effect: string
        }
        Insert: {
          id?: string
          role_id: string
          permission_id: string
          effect?: string
        }
        Update: {
          id?: string
          role_id?: string
          permission_id?: string
          effect?: string
        }
        Relationships: [
          {
            foreignKeyName: 'role_permissions_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'role_permissions_permission_id_fkey'
            columns: ['permission_id']
            isOneToOne: false
            referencedRelation: 'permissions'
            referencedColumns: ['id']
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role_id: string
          committee_id: string | null
          event_id: string | null
          starts_at: string | null
          ends_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role_id: string
          committee_id?: string | null
          event_id?: string | null
          starts_at?: string | null
          ends_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role_id?: string
          committee_id?: string | null
          event_id?: string | null
          starts_at?: string | null
          ends_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_roles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_roles_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_roles_committee_id_fkey'
            columns: ['committee_id']
            isOneToOne: false
            referencedRelation: 'committees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_roles_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      committees: {
        Row: {
          id: string
          slug: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      committee_memberships: {
        Row: {
          id: string
          user_id: string
          committee_id: string
          membership_type: string
          is_head: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          committee_id: string
          membership_type?: string
          is_head?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          committee_id?: string
          membership_type?: string
          is_head?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'committee_memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'committee_memberships_committee_id_fkey'
            columns: ['committee_id']
            isOneToOne: false
            referencedRelation: 'committees'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          id: string
          name: string
          slug: string
          year: number
          status: string
          managing_committee_id: string | null
          starts_at: string | null
          ends_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          year: number
          status?: string
          managing_committee_id?: string | null
          starts_at?: string | null
          ends_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          year?: number
          status?: string
          managing_committee_id?: string | null
          starts_at?: string | null
          ends_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_managing_committee_id_fkey'
            columns: ['managing_committee_id']
            isOneToOne: false
            referencedRelation: 'committees'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      current_user_has_role: {
        Args: { role_slugs: string[] }
        Returns: boolean
      }
      current_user_rank: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      current_user_has_permission: {
        Args: {
          permission_key: string
          requested_committee_id?: string | null
          requested_event_id?: string | null
        }
        Returns: boolean
      }
      current_user_is_committee_member: {
        Args: { target_committee_id: string }
        Returns: boolean
      }
      current_user_heads_committee: {
        Args: { target_committee_id: string }
        Returns: boolean
      }
      current_user_can_access_event: {
        Args: { target_event_id: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<
  TableName extends keyof Database['public']['Tables'],
> = Database['public']['Tables'][TableName]['Row']

export type TablesInsert<
  TableName extends keyof Database['public']['Tables'],
> = Database['public']['Tables'][TableName]['Insert']

export type TablesUpdate<
  TableName extends keyof Database['public']['Tables'],
> = Database['public']['Tables'][TableName]['Update']
