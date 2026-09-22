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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cnt_categories: {
        Row: {
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      cnt_facebook_connection: {
        Row: {
          access_token: string
          connected_at: string
          id: string
          is_active: boolean
          last_error: string | null
          last_validated_at: string | null
          page_avatar_url: string | null
          page_id: string
          page_name: string
          scopes: string[]
          updated_at: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_validated_at?: string | null
          page_avatar_url?: string | null
          page_id: string
          page_name: string
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_validated_at?: string | null
          page_avatar_url?: string | null
          page_id?: string
          page_name?: string
          scopes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      cnt_facebook_pending: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          pages: Json
          user_token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          pages: Json
          user_token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          pages?: Json
          user_token?: string
        }
        Relationships: []
      }
      cnt_publications: {
        Row: {
          channel: Database["public"]["Enums"]["cnt_channel"]
          created_at: string
          error: string | null
          external_id: string | null
          external_url: string | null
          id: string
          part_id: string | null
          payload: Json
          scheduled_for: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["cnt_publication_status"]
          story_id: string
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["cnt_channel"]
          created_at?: string
          error?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          part_id?: string | null
          payload?: Json
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["cnt_publication_status"]
          story_id: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["cnt_channel"]
          created_at?: string
          error?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          part_id?: string | null
          payload?: Json
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["cnt_publication_status"]
          story_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cnt_publications_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "cnt_public_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnt_publications_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "cnt_story_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnt_publications_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnt_publications_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnt_publications_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_studio_stories"
            referencedColumns: ["id"]
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
          story_type: Database["public"]["Enums"]["cnt_story_type"]
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
          story_type?: Database["public"]["Enums"]["cnt_story_type"]
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
          story_type?: Database["public"]["Enums"]["cnt_story_type"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cnt_stories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cnt_categories"
            referencedColumns: ["id"]
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
          body_text?: string | null
          created_at?: string
          creator_note?: string | null
          facebook_teaser?: string | null
          id?: string
          part_number: number
          published_at?: string | null
          read_minutes?: number | null
          search?: unknown
          story_id: string
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          anonymise_terms?: string[]
          body?: Json
          body_text?: string | null
          created_at?: string
          creator_note?: string | null
          facebook_teaser?: string | null
          id?: string
          part_number?: number
          published_at?: string | null
          read_minutes?: number | null
          search?: unknown
          story_id?: string
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cnt_story_parts_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnt_story_parts_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnt_story_parts_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_studio_stories"
            referencedColumns: ["id"]
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
            foreignKeyName: "cnt_story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnt_story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnt_story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_studio_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      com_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "com_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      com_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          like_count: number
          parent_id: string | null
          status: Database["public"]["Enums"]["com_status"]
          story_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          like_count?: number
          parent_id?: string | null
          status?: Database["public"]["Enums"]["com_status"]
          story_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          like_count?: number
          parent_id?: string | null
          status?: Database["public"]["Enums"]["com_status"]
          story_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "com_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_studio_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usr_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      com_poll_options: {
        Row: {
          id: string
          label: string
          poll_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          poll_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          poll_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "com_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "com_post_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "com_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      com_poll_votes: {
        Row: {
          created_at: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "com_poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "com_poll_results"
            referencedColumns: ["option_id"]
          },
          {
            foreignKeyName: "com_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "com_post_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "com_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      com_post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          status: Database["public"]["Enums"]["com_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          status?: Database["public"]["Enums"]["com_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          status?: Database["public"]["Enums"]["com_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "com_post_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "com_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usr_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      com_post_reactions: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "com_post_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "com_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      com_posts: {
        Row: {
          answer: string | null
          answered_at: string | null
          asked_by: string | null
          body: string
          closes_at: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["com_post_kind"]
          like_count: number
          published_at: string | null
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          asked_by?: string | null
          body: string
          closes_at?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["com_post_kind"]
          like_count?: number
          published_at?: string | null
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          asked_by?: string | null
          body?: string
          closes_at?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["com_post_kind"]
          like_count?: number
          published_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_posts_asked_by_fkey"
            columns: ["asked_by"]
            isOneToOne: false
            referencedRelation: "usr_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      com_reactions: {
        Row: {
          created_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "com_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_studio_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      edt_editors: {
        Row: {
          created_at: string
          first_name: string
          last_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name: string
          last_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string
          last_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edt_editors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "sec_users"
            referencedColumns: ["id"]
          },
        ]
      }
      mod_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["mod_report_status"]
          target_id: string
          target_kind: Database["public"]["Enums"]["mod_target_kind"]
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["mod_report_status"]
          target_id: string
          target_kind: Database["public"]["Enums"]["mod_target_kind"]
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["mod_report_status"]
          target_id?: string
          target_kind?: Database["public"]["Enums"]["mod_target_kind"]
        }
        Relationships: []
      }
      opr_operators: {
        Row: {
          created_at: string
          first_name: string
          last_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name: string
          last_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string
          last_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opr_operators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "sec_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sec_users: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          mobile: string | null
          status: Database["public"]["Enums"]["sec_user_status"]
          updated_at: string
          user_type: Database["public"]["Enums"]["sec_user_type"]
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          mobile?: string | null
          status?: Database["public"]["Enums"]["sec_user_status"]
          updated_at?: string
          user_type: Database["public"]["Enums"]["sec_user_type"]
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          mobile?: string | null
          status?: Database["public"]["Enums"]["sec_user_status"]
          updated_at?: string
          user_type?: Database["public"]["Enums"]["sec_user_type"]
        }
        Relationships: []
      }
      sup_settlement_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          bank_name: string | null
          branch: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["sup_account_kind"]
          mobile_number: string | null
          mobile_operator: string | null
          retired_at: string | null
          retired_by: string | null
        }
        Insert: {
          account_name: string
          account_number?: string | null
          bank_name?: string | null
          branch?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["sup_account_kind"]
          mobile_number?: string | null
          mobile_operator?: string | null
          retired_at?: string | null
          retired_by?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string | null
          bank_name?: string | null
          branch?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["sup_account_kind"]
          mobile_number?: string | null
          mobile_operator?: string | null
          retired_at?: string | null
          retired_by?: string | null
        }
        Relationships: []
      }
      sup_settlements: {
        Row: {
          account_id: string | null
          account_kind: Database["public"]["Enums"]["sup_account_kind"]
          account_name: string
          account_number: string | null
          bank_name: string | null
          branch: string | null
          commission_minor: number
          gross_minor: number
          id: string
          idempotency_key: string
          mobile_number: string | null
          mobile_operator: string | null
          net_minor: number
          notes: string | null
          payment_count: number
          period_from: string
          period_to: string
          reference: string
          settled_at: string
          settled_by: string | null
          transfer_reference: string | null
        }
        Insert: {
          account_id?: string | null
          account_kind: Database["public"]["Enums"]["sup_account_kind"]
          account_name: string
          account_number?: string | null
          bank_name?: string | null
          branch?: string | null
          commission_minor: number
          gross_minor: number
          id?: string
          idempotency_key: string
          mobile_number?: string | null
          mobile_operator?: string | null
          net_minor: number
          notes?: string | null
          payment_count: number
          period_from: string
          period_to: string
          reference: string
          settled_at?: string
          settled_by?: string | null
          transfer_reference?: string | null
        }
        Update: {
          account_id?: string | null
          account_kind?: Database["public"]["Enums"]["sup_account_kind"]
          account_name?: string
          account_number?: string | null
          bank_name?: string | null
          branch?: string | null
          commission_minor?: number
          gross_minor?: number
          id?: string
          idempotency_key?: string
          mobile_number?: string | null
          mobile_operator?: string | null
          net_minor?: number
          notes?: string | null
          payment_count?: number
          period_from?: string
          period_to?: string
          reference?: string
          settled_at?: string
          settled_by?: string | null
          transfer_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sup_settlements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "sup_settlement_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sup_transactions: {
        Row: {
          amount_minor: number
          checkout_url: string | null
          commission_minor: number
          commission_rate_bps: number
          completed_at: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          internal_reference: string | null
          is_monthly: boolean
          net_minor: number | null
          operator: string | null
          payer_mobile: string | null
          payer_name: string | null
          placement: Database["public"]["Enums"]["sup_placement"] | null
          provider: string
          provider_reference: string | null
          raw_provider_json: Json | null
          settlement_id: string | null
          settlement_status: Database["public"]["Enums"]["sup_settlement_status"]
          status: Database["public"]["Enums"]["sup_status"]
          user_id: string | null
        }
        Insert: {
          amount_minor: number
          checkout_url?: string | null
          commission_minor?: number
          commission_rate_bps?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          internal_reference?: string | null
          is_monthly?: boolean
          net_minor?: number | null
          operator?: string | null
          payer_mobile?: string | null
          payer_name?: string | null
          placement?: Database["public"]["Enums"]["sup_placement"] | null
          provider: string
          provider_reference?: string | null
          raw_provider_json?: Json | null
          settlement_id?: string | null
          settlement_status?: Database["public"]["Enums"]["sup_settlement_status"]
          status?: Database["public"]["Enums"]["sup_status"]
          user_id?: string | null
        }
        Update: {
          amount_minor?: number
          checkout_url?: string | null
          commission_minor?: number
          commission_rate_bps?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          internal_reference?: string | null
          is_monthly?: boolean
          net_minor?: number | null
          operator?: string | null
          payer_mobile?: string | null
          payer_name?: string | null
          placement?: Database["public"]["Enums"]["sup_placement"] | null
          provider?: string
          provider_reference?: string | null
          raw_provider_json?: Json | null
          settlement_id?: string | null
          settlement_status?: Database["public"]["Enums"]["sup_settlement_status"]
          status?: Database["public"]["Enums"]["sup_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sup_transactions_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "sup_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      sup_webhook_events: {
        Row: {
          created_at: string
          event: string | null
          headers: Json | null
          id: string
          process_error: string | null
          processed_at: string | null
          provider: string
          raw_body: string
          reference: string | null
          signature_valid: boolean
        }
        Insert: {
          created_at?: string
          event?: string | null
          headers?: Json | null
          id?: string
          process_error?: string | null
          processed_at?: string | null
          provider?: string
          raw_body: string
          reference?: string | null
          signature_valid: boolean
        }
        Update: {
          created_at?: string
          event?: string | null
          headers?: Json | null
          id?: string
          process_error?: string | null
          processed_at?: string | null
          provider?: string
          raw_body?: string
          reference?: string | null
          signature_valid?: boolean
        }
        Relationships: []
      }
      usr_bookmarks: {
        Row: {
          created_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usr_bookmarks_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usr_bookmarks_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usr_bookmarks_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_studio_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      usr_category_follows: {
        Row: {
          category_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usr_category_follows_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cnt_categories"
            referencedColumns: ["id"]
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
        Relationships: [
          {
            foreignKeyName: "usr_profiles_user"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "sec_users"
            referencedColumns: ["id"]
          },
        ]
      }
      usr_read_progress: {
        Row: {
          last_part_number: number
          story_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_part_number: number
          story_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_part_number?: number
          story_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usr_read_progress_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usr_read_progress_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usr_read_progress_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_studio_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      usr_roles: {
        Row: {
          granted_at: string
          role: Database["public"]["Enums"]["usr_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          role: Database["public"]["Enums"]["usr_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          role?: Database["public"]["Enums"]["usr_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
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
        Insert: {
          body?: never
          creator_note?: never
          id?: string | null
          part_number?: number | null
          published_at?: string | null
          read_minutes?: number | null
          search?: unknown
          story_id?: string | null
          thumbnail_path?: string | null
          title?: never
        }
        Update: {
          body?: never
          creator_note?: never
          id?: string | null
          part_number?: number | null
          published_at?: string | null
          read_minutes?: number | null
          search?: unknown
          story_id?: string | null
          thumbnail_path?: string | null
          title?: never
        }
        Relationships: [
          {
            foreignKeyName: "cnt_story_parts_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnt_story_parts_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnt_story_parts_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "cnt_studio_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      cnt_story_cards: {
        Row: {
          category_name: string | null
          category_slug: string | null
          comment_count: number | null
          cover_image_path: string | null
          cover_path: string | null
          id: string | null
          like_count: number | null
          part_count: number | null
          published_at: string | null
          read_minutes: number | null
          slug: string | null
          story_type: Database["public"]["Enums"]["cnt_story_type"] | null
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
          comment_count: number | null
          cover_image_path: string | null
          created_at: string | null
          first_published_at: string | null
          id: string | null
          live_part_count: number | null
          part_count: number | null
          planned_part_count: number | null
          reaction_count: number | null
          scheduled_part_count: number | null
          slug: string | null
          status: string | null
          story_type: Database["public"]["Enums"]["cnt_story_type"] | null
          summary: string | null
          title: string | null
          view_count: number | null
          view_count_7d: number | null
          word_count: number | null
        }
        Relationships: []
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
            foreignKeyName: "com_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "com_post_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "com_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "com_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      com_post_cards: {
        Row: {
          answer: string | null
          answered_at: string | null
          asked_by: string | null
          body: string | null
          closes_at: string | null
          comment_count: number | null
          created_at: string | null
          id: string | null
          kind: Database["public"]["Enums"]["com_post_kind"] | null
          like_count: number | null
          published_at: string | null
          vote_count: number | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          asked_by?: string | null
          body?: string | null
          closes_at?: string | null
          comment_count?: never
          created_at?: string | null
          id?: string | null
          kind?: Database["public"]["Enums"]["com_post_kind"] | null
          like_count?: number | null
          published_at?: string | null
          vote_count?: never
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          asked_by?: string | null
          body?: string | null
          closes_at?: string | null
          comment_count?: never
          created_at?: string | null
          id?: string | null
          kind?: Database["public"]["Enums"]["com_post_kind"] | null
          like_count?: number | null
          published_at?: string | null
          vote_count?: never
        }
        Relationships: [
          {
            foreignKeyName: "com_posts_asked_by_fkey"
            columns: ["asked_by"]
            isOneToOne: false
            referencedRelation: "usr_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mod_comment_queue: {
        Row: {
          author_name: string | null
          body: string | null
          context: string | null
          created_at: string | null
          id: string | null
          report_count: number | null
          status: Database["public"]["Enums"]["com_status"] | null
          target_kind: Database["public"]["Enums"]["mod_target_kind"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      cnt_create_story: {
        Args: {
          p_category_slug?: string
          p_planned_part_count?: number
          p_story_type?: Database["public"]["Enums"]["cnt_story_type"]
          p_summary?: string
          p_title: string
        }
        Returns: string
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
      cnt_doc_plain_text: { Args: { doc: Json }; Returns: string }
      cnt_doc_text: { Args: { doc: Json }; Returns: string }
      cnt_facebook_disconnect: { Args: never; Returns: undefined }
      cnt_facebook_due: {
        Args: never
        Returns: {
          id: string
          payload: Json
        }[]
      }
      cnt_facebook_pending_pages: {
        Args: { p_pending_id: string }
        Returns: {
          page_avatar_url: string
          page_id: string
          page_name: string
        }[]
      }
      cnt_facebook_status: {
        Args: never
        Returns: {
          connected_at: string
          is_active: boolean
          last_error: string
          last_validated_at: string
          page_avatar_url: string
          page_id: string
          page_name: string
        }[]
      }
      cnt_is_series: { Args: { p_story_id: string }; Returns: boolean }
      cnt_publish_part: { Args: { p_part_id: string }; Returns: undefined }
      cnt_record_view: {
        Args: { p_part_number: number; p_story_id: string }
        Returns: undefined
      }
      cnt_redact_doc: { Args: { doc: Json; p_terms: string[] }; Returns: Json }
      cnt_redact_text: {
        Args: { p_terms: string[]; p_text: string }
        Returns: string
      }
      cnt_reorder_parts: {
        Args: { p_part_ids: string[]; p_story_id: string }
        Returns: undefined
      }
      cnt_schedule_part: {
        Args: { p_at: string; p_part_id: string }
        Returns: undefined
      }
      cnt_search_stories: {
        Args: { p_limit?: number; p_offset?: number; p_query: string }
        Returns: {
          category_name: string | null
          category_slug: string | null
          comment_count: number | null
          cover_image_path: string | null
          cover_path: string | null
          id: string | null
          like_count: number | null
          part_count: number | null
          published_at: string | null
          read_minutes: number | null
          slug: string | null
          story_type: Database["public"]["Enums"]["cnt_story_type"] | null
          summary: string | null
          title: string | null
          total_part_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "cnt_story_cards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cnt_send_due_facebook_posts: { Args: never; Returns: undefined }
      cnt_series_retention: {
        Args: { p_story_id: string }
        Returns: {
          part_number: number
          published_at: string
          readers: number
          share: number
        }[]
      }
      cnt_slugify: { Args: { p_text: string }; Returns: string }
      cnt_story_is_public: { Args: { p_story_id: string }; Returns: boolean }
      cnt_story_performance: {
        Args: { p_limit?: number }
        Returns: {
          category_name: string
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
      cnt_text_to_doc: { Args: { body: string }; Returns: Json }
      cnt_unpublish_part: { Args: { p_part_id: string }; Returns: undefined }
      cnt_word_count: { Args: { doc: Json }; Returns: number }
      edt_save_name: {
        Args: { p_first_name: string; p_last_name: string }
        Returns: undefined
      }
      mod_hide_comment: {
        Args: {
          p_id: string
          p_kind: Database["public"]["Enums"]["mod_target_kind"]
        }
        Returns: undefined
      }
      mod_keep_comment: {
        Args: {
          p_id: string
          p_kind: Database["public"]["Enums"]["mod_target_kind"]
        }
        Returns: undefined
      }
      sec_is_editorial: { Args: never; Returns: boolean }
      sec_is_operator: { Args: never; Returns: boolean }
      sec_is_reader: { Args: never; Returns: boolean }
      sec_provision_account: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_mobile?: string
          p_role: Database["public"]["Enums"]["usr_role"]
          p_type: Database["public"]["Enums"]["sec_user_type"]
        }
        Returns: string
      }
      sec_user_type: {
        Args: never
        Returns: Database["public"]["Enums"]["sec_user_type"]
      }
      sup_by_placement: {
        Args: never
        Returns: {
          collected_minor: number
          net_minor: number
          payment_count: number
          placement: Database["public"]["Enums"]["sup_placement"]
        }[]
      }
      sup_collection_status: {
        Args: { p_reference: string }
        Returns: {
          amount_minor: number
          completed_at: string
          operator: string
          status: Database["public"]["Enums"]["sup_status"]
        }[]
      }
      sup_commission_minor: {
        Args: { p_amount_minor: number; p_rate_bps: number }
        Returns: number
      }
      sup_reconcile_due: { Args: never; Returns: undefined }
      sup_settle: {
        Args: {
          p_account_id: string
          p_idempotency_key: string
          p_notes?: string
          p_transfer_reference?: string
        }
        Returns: string
      }
      sup_settle_collection: {
        Args: {
          p_provider_reference?: string
          p_raw?: Json
          p_reference: string
          p_successful: boolean
        }
        Returns: boolean
      }
      sup_supporter_count: { Args: never; Returns: number }
      sup_totals: {
        Args: never
        Returns: {
          awaiting_count: number
          awaiting_minor: number
          collected_minor: number
          commission_minor: number
          net_minor: number
          settled_minor: number
          supporters: number
        }[]
      }
      usr_is_editorial: { Args: never; Returns: boolean }
      usr_is_operator: { Args: never; Returns: boolean }
      usr_is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      cnt_channel: "facebook" | "push" | "email"
      cnt_publication_status: "planned" | "sent" | "failed" | "skipped"
      cnt_story_type: "single" | "series"
      com_post_kind: "question" | "poll" | "notice"
      com_status: "visible" | "hidden"
      mod_report_status: "open" | "actioned" | "dismissed"
      mod_target_kind: "story_comment" | "post_comment" | "story"
      sec_user_status: "active" | "suspended"
      sec_user_type: "reader" | "editorial" | "operator"
      sup_account_kind: "bank" | "mobile_money"
      sup_placement:
        | "support_screen"
        | "home_card"
        | "profile_row"
        | "story_end"
        | "community_post"
        | "stories_rail"
        | "community_rail"
      sup_settlement_status: "not_applicable" | "pending" | "settled"
      sup_status: "pending" | "successful" | "failed" | "reversed" | "refunded"
      usr_role:
        | "member"
        | "creator"
        | "editor"
        | "moderator"
        | "admin"
        | "finance"
        | "super_admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      cnt_channel: ["facebook", "push", "email"],
      cnt_publication_status: ["planned", "sent", "failed", "skipped"],
      cnt_story_type: ["single", "series"],
      com_post_kind: ["question", "poll", "notice"],
      com_status: ["visible", "hidden"],
      mod_report_status: ["open", "actioned", "dismissed"],
      mod_target_kind: ["story_comment", "post_comment", "story"],
      sec_user_status: ["active", "suspended"],
      sec_user_type: ["reader", "editorial", "operator"],
      sup_account_kind: ["bank", "mobile_money"],
      sup_placement: [
        "support_screen",
        "home_card",
        "profile_row",
        "story_end",
        "community_post",
        "stories_rail",
        "community_rail",
      ],
      sup_settlement_status: ["not_applicable", "pending", "settled"],
      sup_status: ["pending", "successful", "failed", "reversed", "refunded"],
      usr_role: [
        "member",
        "creator",
        "editor",
        "moderator",
        "admin",
        "finance",
        "super_admin",
      ],
    },
  },
} as const
