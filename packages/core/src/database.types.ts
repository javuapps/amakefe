// Generated from the Supabase schema — do not edit by hand.
// Regenerate with the Supabase MCP server's generate_typescript_types after any migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      cnt_categories: {
        Row: { id: string; is_active: boolean; name: string; slug: string; sort_order: number }
        Insert: { id?: string; is_active?: boolean; name: string; slug: string; sort_order?: number }
        Update: { id?: string; is_active?: boolean; name?: string; slug?: string; sort_order?: number }
        Relationships: []
      }
      cnt_creator_posts: {
        Row: { body: string; created_at: string; id: string; published_at: string | null; updated_at: string }
        Insert: { body: string; created_at?: string; id?: string; published_at?: string | null; updated_at?: string }
        Update: { body?: string; created_at?: string; id?: string; published_at?: string | null; updated_at?: string }
        Relationships: []
      }
      cnt_publications: {
        Row: {
          channel: Database['public']['Enums']['cnt_channel']
          created_at: string
          error: string | null
          external_id: string | null
          external_url: string | null
          id: string
          part_id: string | null
          payload: Json
          scheduled_for: string | null
          sent_at: string | null
          status: Database['public']['Enums']['cnt_publication_status']
          story_id: string
          updated_at: string
        }
        Insert: {
          channel: Database['public']['Enums']['cnt_channel']
          created_at?: string
          error?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          part_id?: string | null
          payload?: Json
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database['public']['Enums']['cnt_publication_status']
          story_id: string
          updated_at?: string
        }
        Update: {
          channel?: Database['public']['Enums']['cnt_channel']
          created_at?: string
          error?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          part_id?: string | null
          payload?: Json
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database['public']['Enums']['cnt_publication_status']
          story_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cnt_publications_part_id_fkey'
            columns: ['part_id']
            isOneToOne: false
            referencedRelation: 'cnt_story_parts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cnt_publications_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_stories'
            referencedColumns: ['id']
          },
        ]
      }
      cnt_stories: {
        Row: {
          category_id: string
          cover_image_path: string | null
          created_at: string
          id: string
          like_count: number
          meta_description: string | null
          planned_part_count: number | null
          search: unknown
          seo_title: string | null
          slug: string
          story_type: Database['public']['Enums']['cnt_story_type']
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          cover_image_path?: string | null
          created_at?: string
          id?: string
          like_count?: number
          meta_description?: string | null
          planned_part_count?: number | null
          search?: unknown
          seo_title?: string | null
          slug: string
          story_type?: Database['public']['Enums']['cnt_story_type']
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          cover_image_path?: string | null
          created_at?: string
          id?: string
          like_count?: number
          meta_description?: string | null
          planned_part_count?: number | null
          search?: unknown
          seo_title?: string | null
          slug?: string
          story_type?: Database['public']['Enums']['cnt_story_type']
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cnt_stories_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'cnt_categories'
            referencedColumns: ['id']
          },
        ]
      }
      cnt_story_views: {
        Row: {
          part_number: number
          story_id: string
          viewed_on: string
          views: number
        }
        Insert: {
          part_number: number
          story_id: string
          viewed_on: string
          views?: number
        }
        Update: {
          part_number?: number
          story_id?: string
          viewed_on?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: 'cnt_story_views_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_stories'
            referencedColumns: ['id']
          },
        ]
      }
      cnt_story_parts: {
        Row: {
          anonymise_terms: string[]
          body: Json
          body_text: string | null
          created_at: string
          creator_note: string | null
          facebook_teaser: string | null
          id: string
          part_number: number
          published_at: string | null
          read_minutes: number | null
          search: unknown
          story_id: string
          thumbnail_path: string | null
          title: string | null
          updated_at: string
          word_count: number | null
        }
        Insert: {
          anonymise_terms?: string[]
          body?: Json
          body_text?: never
          created_at?: string
          creator_note?: string | null
          facebook_teaser?: string | null
          id?: string
          part_number: number
          published_at?: string | null
          read_minutes?: never
          search?: never
          story_id: string
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string
          word_count?: never
        }
        Update: {
          anonymise_terms?: string[]
          body?: Json
          body_text?: never
          created_at?: string
          creator_note?: string | null
          facebook_teaser?: string | null
          id?: string
          part_number?: number
          published_at?: string | null
          read_minutes?: never
          search?: never
          story_id?: string
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string
          word_count?: never
        }
        Relationships: [
          {
            foreignKeyName: 'cnt_story_parts_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_stories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cnt_story_parts_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_story_cards'
            referencedColumns: ['id']
          },
        ]
      }
      com_answers: {
        Row: {
          body: string
          created_at: string
          id: string
          question_id: string
          status: Database['public']['Enums']['com_status']
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          question_id: string
          status?: Database['public']['Enums']['com_status']
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          question_id?: string
          status?: Database['public']['Enums']['com_status']
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'com_answers_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'com_question_cards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'com_answers_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'com_questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'com_answers_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'usr_profiles'
            referencedColumns: ['id']
          },
        ]
      }
      com_ask_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          body: string
          created_at: string
          id: string
          is_published: boolean
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          body: string
          created_at?: string
          id?: string
          is_published?: boolean
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          body?: string
          created_at?: string
          id?: string
          is_published?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      com_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string | null
          status: Database['public']['Enums']['com_status']
          story_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          status?: Database['public']['Enums']['com_status']
          story_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          status?: Database['public']['Enums']['com_status']
          story_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'com_comments_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'com_comments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'com_comments_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_stories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'com_comments_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_story_cards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'com_comments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'usr_profiles'
            referencedColumns: ['id']
          },
        ]
      }
      com_poll_options: {
        Row: { id: string; label: string; poll_id: string; sort_order: number }
        Insert: { id?: string; label: string; poll_id: string; sort_order?: number }
        Update: { id?: string; label?: string; poll_id?: string; sort_order?: number }
        Relationships: [
          {
            foreignKeyName: 'com_poll_options_poll_id_fkey'
            columns: ['poll_id']
            isOneToOne: false
            referencedRelation: 'com_polls'
            referencedColumns: ['id']
          },
        ]
      }
      com_poll_votes: {
        Row: { created_at: string; option_id: string; poll_id: string; user_id: string }
        Insert: { created_at?: string; option_id: string; poll_id: string; user_id: string }
        Update: { created_at?: string; option_id?: string; poll_id?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: 'com_poll_votes_option_id_fkey'
            columns: ['option_id']
            isOneToOne: false
            referencedRelation: 'com_poll_options'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'com_poll_votes_option_id_fkey'
            columns: ['option_id']
            isOneToOne: false
            referencedRelation: 'com_poll_results'
            referencedColumns: ['option_id']
          },
          {
            foreignKeyName: 'com_poll_votes_poll_id_fkey'
            columns: ['poll_id']
            isOneToOne: false
            referencedRelation: 'com_polls'
            referencedColumns: ['id']
          },
        ]
      }
      com_polls: {
        Row: { closes_at: string | null; created_at: string; id: string; is_active: boolean; question: string }
        Insert: { closes_at?: string | null; created_at?: string; id?: string; is_active?: boolean; question: string }
        Update: { closes_at?: string | null; created_at?: string; id?: string; is_active?: boolean; question?: string }
        Relationships: []
      }
      com_questions: {
        Row: {
          body: string
          created_at: string
          id: string
          status: Database['public']['Enums']['com_status']
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          status?: Database['public']['Enums']['com_status']
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          status?: Database['public']['Enums']['com_status']
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'com_questions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'usr_profiles'
            referencedColumns: ['id']
          },
        ]
      }
      com_reactions: {
        Row: { created_at: string; story_id: string; user_id: string }
        Insert: { created_at?: string; story_id: string; user_id: string }
        Update: { created_at?: string; story_id?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: 'com_reactions_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_stories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'com_reactions_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_story_cards'
            referencedColumns: ['id']
          },
        ]
      }
      mod_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: Database['public']['Enums']['mod_report_status']
          target_id: string
          target_kind: Database['public']['Enums']['mod_target_kind']
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: Database['public']['Enums']['mod_report_status']
          target_id: string
          target_kind: Database['public']['Enums']['mod_target_kind']
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: Database['public']['Enums']['mod_report_status']
          target_id?: string
          target_kind?: Database['public']['Enums']['mod_target_kind']
        }
        Relationships: []
      }
      sup_transactions: {
        Row: {
          amount_minor: number
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          is_monthly: boolean
          provider: string
          provider_reference: string | null
          status: Database['public']['Enums']['sup_status']
          user_id: string | null
        }
        Insert: {
          amount_minor: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_monthly?: boolean
          provider: string
          provider_reference?: string | null
          status?: Database['public']['Enums']['sup_status']
          user_id?: string | null
        }
        Update: {
          amount_minor?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_monthly?: boolean
          provider?: string
          provider_reference?: string | null
          status?: Database['public']['Enums']['sup_status']
          user_id?: string | null
        }
        Relationships: []
      }
      usr_bookmarks: {
        Row: { created_at: string; story_id: string; user_id: string }
        Insert: { created_at?: string; story_id: string; user_id: string }
        Update: { created_at?: string; story_id?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: 'usr_bookmarks_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_stories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'usr_bookmarks_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_story_cards'
            referencedColumns: ['id']
          },
        ]
      }
      usr_category_follows: {
        Row: { category_id: string; created_at: string; user_id: string }
        Insert: { category_id: string; created_at?: string; user_id: string }
        Update: { category_id?: string; created_at?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: 'usr_category_follows_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'cnt_categories'
            referencedColumns: ['id']
          },
        ]
      }
      usr_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      usr_read_progress: {
        Row: { last_part_number: number; story_id: string; updated_at: string; user_id: string }
        Insert: { last_part_number: number; story_id: string; updated_at?: string; user_id: string }
        Update: { last_part_number?: number; story_id?: string; updated_at?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: 'usr_read_progress_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_stories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'usr_read_progress_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_story_cards'
            referencedColumns: ['id']
          },
        ]
      }
      usr_roles: {
        Row: { granted_at: string; role: Database['public']['Enums']['usr_role']; user_id: string }
        Insert: { granted_at?: string; role: Database['public']['Enums']['usr_role']; user_id: string }
        Update: { granted_at?: string; role?: Database['public']['Enums']['usr_role']; user_id?: string }
        Relationships: []
      }
    }
    Views: {
      cnt_story_cards: {
        Row: {
          category_name: string | null
          category_slug: string | null
          cover_image_path: string | null
          id: string | null
          like_count: number | null
          part_count: number | null
          published_at: string | null
          read_minutes: number | null
          slug: string | null
          story_type: Database['public']['Enums']['cnt_story_type'] | null
          summary: string | null
          title: string | null
          total_part_count: number | null
        }
        Relationships: []
      }
      cnt_studio_stories: {
        Row: {
          category_name: string | null
          category_slug: string | null
          cover_image_path: string | null
          created_at: string | null
          first_published_at: string | null
          id: string | null
          live_part_count: number | null
          part_count: number | null
          planned_part_count: number | null
          scheduled_part_count: number | null
          slug: string | null
          status: string | null
          story_type: Database['public']['Enums']['cnt_story_type'] | null
          summary: string | null
          title: string | null
          word_count: number | null
          view_count: number | null
          view_count_7d: number | null
          reaction_count: number | null
          comment_count: number | null
        }
        Relationships: []
      }
      cnt_public_parts: {
        Row: {
          body: Json | null
          creator_note: string | null
          id: string | null
          part_number: number | null
          published_at: string | null
          read_minutes: number | null
          search: unknown
          story_id: string | null
          thumbnail_path: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'cnt_story_parts_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_stories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cnt_story_parts_story_id_fkey'
            columns: ['story_id']
            isOneToOne: false
            referencedRelation: 'cnt_story_cards'
            referencedColumns: ['id']
          },
        ]
      }
      com_poll_results: {
        Row: {
          label: string | null
          option_id: string | null
          poll_id: string | null
          sort_order: number | null
          vote_count: number | null
        }
        Insert: {
          label?: string | null
          option_id?: string | null
          poll_id?: string | null
          sort_order?: number | null
          vote_count?: never
        }
        Update: {
          label?: string | null
          option_id?: string | null
          poll_id?: string | null
          sort_order?: number | null
          vote_count?: never
        }
        Relationships: [
          {
            foreignKeyName: 'com_poll_options_poll_id_fkey'
            columns: ['poll_id']
            isOneToOne: false
            referencedRelation: 'com_polls'
            referencedColumns: ['id']
          },
        ]
      }
      com_question_cards: {
        Row: {
          answer_count: number | null
          body: string | null
          created_at: string | null
          id: string | null
          latest_answer: string | null
          latest_answer_author: string | null
        }
        Insert: {
          answer_count?: never
          body?: string | null
          created_at?: string | null
          id?: string | null
          latest_answer?: never
        }
        Update: {
          answer_count?: never
          body?: string | null
          created_at?: string | null
          id?: string | null
          latest_answer?: never
        }
        Relationships: []
      }
    }
    Functions: {
      cnt_facebook_disconnect: { Args: never; Returns: undefined }
      cnt_facebook_pending_pages: {
        Args: { p_pending_id: string }
        Returns: {
          page_avatar_url: string | null
          page_id: string
          page_name: string
        }[]
      }
      cnt_facebook_status: {
        Args: never
        Returns: {
          connected_at: string
          is_active: boolean
          last_error: string | null
          last_validated_at: string | null
          page_avatar_url: string | null
          page_id: string
          page_name: string
        }[]
      }
      cnt_schedule_part: {
        Args: { p_at: string; p_part_id: string }
        Returns: undefined
      }
      cnt_search_stories: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          category_name: string | null
          category_slug: string | null
          cover_image_path: string | null
          id: string | null
          like_count: number | null
          part_count: number | null
          published_at: string | null
          read_minutes: number | null
          slug: string | null
          story_type: Database['public']['Enums']['cnt_story_type'] | null
          summary: string | null
          title: string | null
          total_part_count: number | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'cnt_story_cards'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cnt_dashboard_stats: {
        Args: never
        Returns: {
          comments: number
          monthly_support_minor: number
          saves: number
          stories_finished: number
          stories_started: number
          supporters: number
          weekly_readers: number
        }[]
      }
      cnt_studio_totals: {
        Args: never
        Returns: {
          comments: number
          drafts: number
          published: number
          reactions: number
          stories: number
          views: number
          views_7d: number
        }[]
      }
      cnt_series_retention: {
        Args: { p_story_id: string }
        Returns: {
          part_number: number
          published_at: string | null
          readers: number
          share: number
        }[]
      }
      cnt_create_story: {
        Args: {
          p_category_slug?: string | null
          p_planned_part_count?: number | null
          p_story_type?: Database['public']['Enums']['cnt_story_type']
          p_summary?: string
          p_title: string
        }
        Returns: string
      }
      cnt_doc_plain_text: { Args: { doc: Json }; Returns: string }
      cnt_record_view: {
        Args: { p_part_number: number; p_story_id: string }
        Returns: undefined
      }
      cnt_redact_doc: { Args: { doc: Json; p_terms: string[] }; Returns: Json }
      cnt_redact_text: { Args: { p_text: string; p_terms: string[] }; Returns: string }
      cnt_doc_text: { Args: { doc: Json }; Returns: string }
      cnt_is_series: { Args: { p_story_id: string }; Returns: boolean }
      cnt_publish_part: { Args: { p_part_id: string }; Returns: undefined }
      cnt_unpublish_part: { Args: { p_part_id: string }; Returns: undefined }
      cnt_reorder_parts: { Args: { p_part_ids: string[]; p_story_id: string }; Returns: undefined }
      cnt_word_count: { Args: { doc: Json }; Returns: number }
      cnt_story_is_public: { Args: { p_story_id: string }; Returns: boolean }
      cnt_story_performance: {
        Args: { p_limit?: number }
        Returns: {
          category_name: string | null
          comments: number
          completion: number
          likes: number
          part_count: number
          readers: number
          saves: number
          story_id: string
          title: string
        }[]
      }
      sup_supporter_count: { Args: never; Returns: number }
      usr_is_editorial: { Args: never; Returns: boolean }
      usr_is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      cnt_channel: 'facebook' | 'push' | 'email'
      cnt_publication_status: 'planned' | 'sent' | 'failed' | 'skipped'
      cnt_story_type: 'single' | 'series'
      com_status: 'visible' | 'hidden'
      mod_report_status: 'open' | 'actioned' | 'dismissed'
      sup_status: 'pending' | 'successful' | 'failed' | 'reversed' | 'refunded'
      mod_target_kind: 'comment' | 'question' | 'answer' | 'story'
      usr_role:
        | 'member'
        | 'creator'
        | 'editor'
        | 'moderator'
        | 'admin'
        | 'finance'
        | 'super_admin'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database['public']

export type Tables<Name extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])> =
  (DefaultSchema['Tables'] & DefaultSchema['Views'])[Name] extends { Row: infer R } ? R : never

export type TablesInsert<Name extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][Name] extends { Insert: infer I } ? I : never

export type TablesUpdate<Name extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][Name] extends { Update: infer U } ? U : never

export type Enums<Name extends keyof DefaultSchema['Enums']> = DefaultSchema['Enums'][Name]
