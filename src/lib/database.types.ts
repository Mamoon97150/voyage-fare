// Generated from the Supabase project (voyage-fare). Do not edit by hand: regenerate after each migration.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      someday_ideas: {
        Row: {
          id: string
          user_id: string
          place_name: string | null
          place_country: string | null
          place_latitude: number | null
          place_longitude: number | null
          kind: string
          name: string
          link: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          place_name?: string | null
          place_country?: string | null
          place_latitude?: number | null
          place_longitude?: number | null
          kind?: string
          name: string
          link?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          place_name?: string | null
          place_country?: string | null
          place_latitude?: number | null
          place_longitude?: number | null
          kind?: string
          name?: string
          link?: string | null
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      daily_estimate_travellers: {
        Row: {
          daily_estimate_id: string
          traveller_id: string
          trip_id: string
        }
        Insert: {
          daily_estimate_id: string
          traveller_id: string
          trip_id: string
        }
        Update: {
          daily_estimate_id?: string
          traveller_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_estimate_travellers_daily_estimate_id_trip_id_fkey"
            columns: ["daily_estimate_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "daily_estimates"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "daily_estimate_travellers_daily_estimate_id_trip_id_fkey"
            columns: ["daily_estimate_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_daily_estimate_checks"
            referencedColumns: ["daily_estimate_id", "trip_id"]
          },
          {
            foreignKeyName: "daily_estimate_travellers_daily_estimate_id_trip_id_fkey"
            columns: ["daily_estimate_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_daily_estimate_people"
            referencedColumns: ["daily_estimate_id", "trip_id"]
          },
          {
            foreignKeyName: "daily_estimate_travellers_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "daily_estimate_travellers_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_balances"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "daily_estimate_travellers_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_shares"
            referencedColumns: ["traveller_id", "trip_id"]
          },
        ]
      }
      daily_estimates: {
        Row: {
          amount: number
          category: string
          currency: string
          days: number
          id: string
          label: string
          place_id: string | null
          rate: number
          trip_id: string
        }
        Insert: {
          amount: number
          category: string
          currency: string
          days: number
          id?: string
          label: string
          place_id?: string | null
          rate?: number
          trip_id: string
        }
        Update: {
          amount?: number
          category?: string
          currency?: string
          days?: number
          id?: string
          label?: string
          place_id?: string | null
          rate?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_estimates_place_id_trip_id_fkey"
            columns: ["place_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "daily_estimates_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_estimates_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      day_split_travellers: {
        Row: {
          day_number: number
          traveller_id: string
          trip_id: string
        }
        Insert: {
          day_number: number
          traveller_id: string
          trip_id: string
        }
        Update: {
          day_number?: number
          traveller_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_split_travellers_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "day_split_travellers_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_balances"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "day_split_travellers_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_shares"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "day_split_travellers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_split_travellers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      feedback: {
        Row: {
          can_reply: boolean
          created_at: string
          device: string | null
          id: string
          kind: string
          message: string
          page: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          can_reply?: boolean
          created_at?: string
          device?: string | null
          id?: string
          kind: string
          message: string
          page?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          can_reply?: boolean
          created_at?: string
          device?: string | null
          id?: string
          kind?: string
          message?: string
          page?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          cancelled_at: string | null
          created_at: string
          expires_at: string
          id: string
          invited_by: string | null
          token: string
          traveller_id: string
          trip_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          token?: string
          traveller_id: string
          trip_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          token?: string
          traveller_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "invitations_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_balances"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "invitations_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_shares"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "invitations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      trip_mails: {
        Row: {
          forwarded_by: string | null
          forwarder: string | null
          found: Json | null
          id: string
          problem: string | null
          received_at: string
          resend_id: string
          status: string
          subject: string | null
          trip_id: string
        }
        Insert: {
          forwarded_by?: string | null
          forwarder?: string | null
          found?: Json | null
          id?: string
          problem?: string | null
          received_at?: string
          resend_id: string
          status?: string
          subject?: string | null
          trip_id: string
        }
        Update: {
          forwarded_by?: string | null
          forwarder?: string | null
          found?: Json | null
          id?: string
          problem?: string | null
          received_at?: string
          resend_id?: string
          status?: string
          subject?: string | null
          trip_id?: string
        }
        Relationships: []
      }
      item_files: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          item_id: string
          mime: string
          name: string
          path: string
          size: number
          trip_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          item_id: string
          mime: string
          name: string
          path: string
          size: number
          trip_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          item_id?: string
          mime?: string
          name?: string
          path?: string
          size?: number
          trip_id?: string
        }
        Relationships: []
      }
      item_legs: {
        Row: {
          after_place_id: string | null
          day_number: number | null
          from_name: string
          id: string
          item_id: string
          leg_number: number
          mode: string
          position: number
          to_name: string
          travel_date: string | null
          trip_id: string
          via: string | null
        }
        Insert: {
          after_place_id?: string | null
          day_number?: number | null
          from_name: string
          id?: string
          item_id: string
          leg_number: number
          mode?: string
          position?: number
          to_name: string
          travel_date?: string | null
          trip_id: string
          via?: string | null
        }
        Update: {
          after_place_id?: string | null
          day_number?: number | null
          from_name?: string
          id?: string
          item_id?: string
          leg_number?: number
          mode?: string
          position?: number
          to_name?: string
          travel_date?: string | null
          trip_id?: string
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_legs_after_place_id_trip_id_fkey"
            columns: ["after_place_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "item_legs_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "item_legs_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_item_amounts"
            referencedColumns: ["item_id", "trip_id"]
          },
          {
            foreignKeyName: "item_legs_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_item_left"
            referencedColumns: ["item_id", "trip_id"]
          },
        ]
      }
      item_split_travellers: {
        Row: {
          item_id: string
          traveller_id: string
          trip_id: string
        }
        Insert: {
          item_id: string
          traveller_id: string
          trip_id: string
        }
        Update: {
          item_id?: string
          traveller_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_split_travellers_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "item_split_travellers_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_item_amounts"
            referencedColumns: ["item_id", "trip_id"]
          },
          {
            foreignKeyName: "item_split_travellers_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_item_left"
            referencedColumns: ["item_id", "trip_id"]
          },
          {
            foreignKeyName: "item_split_travellers_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "item_split_travellers_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_balances"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "item_split_travellers_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_shares"
            referencedColumns: ["traveller_id", "trip_id"]
          },
        ]
      }
      items: {
        Row: {
          actual_amount: number | null
          actual_currency: string | null
          actual_rate: number
          booking_link: string | null
          booking_ref: string | null
          category: string
          created_at: string
          day_number: number | null
          due_on: string | null
          end_day_number: number | null
          id: string
          is_cash: boolean
          kind: string
          latitude: number | null
          link: string | null
          location_name: string | null
          meal: string | null
          longitude: number | null
          name: string
          note: string | null
          package_id: string | null
          paid_by: string | null
          paid_each: boolean
          paid_on: string | null
          place_id: string | null
          position: number
          status: string
          trip_id: string
          verdict: string | null
          start_time: string | null
          price_per_person: boolean
          needs_booking: boolean | null
          duration: string | null
          food_kind: string | null
          from_place: string | null
          to_place: string | null
          local_mode: string | null
          insurance_included: boolean | null
          deposit: number | null
        }
        Insert: {
          actual_amount?: number | null
          actual_currency?: string | null
          actual_rate?: number
          booking_link?: string | null
          booking_ref?: string | null
          category: string
          created_at?: string
          day_number?: number | null
          due_on?: string | null
          end_day_number?: number | null
          id?: string
          is_cash?: boolean
          kind: string
          latitude?: number | null
          link?: string | null
          location_name?: string | null
          meal?: string | null
          longitude?: number | null
          name: string
          note?: string | null
          package_id?: string | null
          paid_by?: string | null
          paid_each?: boolean
          paid_on?: string | null
          place_id?: string | null
          position?: number
          status?: string
          trip_id: string
          verdict?: string | null
          start_time?: string | null
          price_per_person?: boolean | null
          needs_booking?: boolean | null
          duration?: string | null
          food_kind?: string | null
          from_place?: string | null
          to_place?: string | null
          local_mode?: string | null
          insurance_included?: boolean | null
          deposit?: number | null
        }
        Update: {
          actual_amount?: number | null
          actual_currency?: string | null
          actual_rate?: number
          booking_link?: string | null
          booking_ref?: string | null
          category?: string
          created_at?: string
          day_number?: number | null
          due_on?: string | null
          end_day_number?: number | null
          id?: string
          is_cash?: boolean
          kind?: string
          latitude?: number | null
          link?: string | null
          location_name?: string | null
          meal?: string | null
          longitude?: number | null
          name?: string
          note?: string | null
          package_id?: string | null
          paid_by?: string | null
          paid_each?: boolean
          paid_on?: string | null
          place_id?: string | null
          position?: number
          status?: string
          trip_id?: string
          verdict?: string | null
          start_time?: string | null
          price_per_person?: boolean | null
          needs_booking?: boolean | null
          duration?: string | null
          food_kind?: string | null
          from_place?: string | null
          to_place?: string | null
          local_mode?: string | null
          insurance_included?: boolean | null
          deposit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_package_fk"
            columns: ["package_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "items_package_fk"
            columns: ["package_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_item_amounts"
            referencedColumns: ["item_id", "trip_id"]
          },
          {
            foreignKeyName: "items_package_fk"
            columns: ["package_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_item_left"
            referencedColumns: ["item_id", "trip_id"]
          },
          {
            foreignKeyName: "items_paid_by_trip_id_fkey"
            columns: ["paid_by", "trip_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "items_paid_by_trip_id_fkey"
            columns: ["paid_by", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_balances"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "items_paid_by_trip_id_fkey"
            columns: ["paid_by", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_shares"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "items_place_id_trip_id_fkey"
            columns: ["place_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      options: {
        Row: {
          amount: number | null
          created_at: string
          currency: string
          details: Json
          id: string
          is_chosen: boolean
          is_favourite: boolean
          item_id: string
          latitude: number | null
          link: string | null
          location_name: string | null
          longitude: number | null
          name: string
          note: string | null
          position: number
          rate: number
          rate_is_manual: boolean
          trip_id: string
          photo_url: string | null
          photo_path: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency: string
          details?: Json
          id?: string
          is_chosen?: boolean
          is_favourite?: boolean
          item_id: string
          latitude?: number | null
          link?: string | null
          location_name?: string | null
          longitude?: number | null
          name: string
          note?: string | null
          position?: number
          rate?: number
          rate_is_manual?: boolean
          trip_id: string
          photo_url?: string | null
          photo_path?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string
          details?: Json
          id?: string
          is_chosen?: boolean
          is_favourite?: boolean
          item_id?: string
          latitude?: number | null
          link?: string | null
          location_name?: string | null
          longitude?: number | null
          name?: string
          note?: string | null
          position?: number
          rate?: number
          rate_is_manual?: boolean
          trip_id?: string
          photo_url?: string | null
          photo_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "options_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "options_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_item_amounts"
            referencedColumns: ["item_id", "trip_id"]
          },
          {
            foreignKeyName: "options_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_item_left"
            referencedColumns: ["item_id", "trip_id"]
          },
        ]
      }
      pay_groups: {
        Row: {
          id: string
          trip_id: string
        }
        Insert: {
          id?: string
          trip_id: string
        }
        Update: {
          id?: string
          trip_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          for_payer: boolean
          currency: string
          id: string
          item_id: string
          kind: string
          note: string | null
          paid_by: string | null
          paid_each: boolean
          paid_on: string
          rate: number
          trip_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          for_payer?: boolean
          currency: string
          id?: string
          item_id: string
          kind?: string
          note?: string | null
          paid_by?: string | null
          paid_each?: boolean
          paid_on?: string
          rate?: number
          trip_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          for_payer?: boolean
          currency?: string
          id?: string
          item_id?: string
          kind?: string
          note?: string | null
          paid_by?: string | null
          paid_each?: boolean
          paid_on?: string
          rate?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "payments_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_item_amounts"
            referencedColumns: ["item_id", "trip_id"]
          },
          {
            foreignKeyName: "payments_item_id_trip_id_fkey"
            columns: ["item_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_item_left"
            referencedColumns: ["item_id", "trip_id"]
          },
          {
            foreignKeyName: "payments_paid_by_trip_id_fkey"
            columns: ["paid_by", "trip_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "payments_paid_by_trip_id_fkey"
            columns: ["paid_by", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_balances"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "payments_paid_by_trip_id_fkey"
            columns: ["paid_by", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_shares"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      places: {
        Row: {
          country: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          nights: number
          position: number
          trip_id: string
        }
        Insert: {
          country?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          nights?: number
          position?: number
          trip_id: string
        }
        Update: {
          country?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          nights?: number
          position?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: { auth: string; created_at: string; endpoint: string; p256dh: string; user_id: string }
        Insert: { auth: string; created_at?: string; endpoint: string; p256dh: string; user_id?: string }
        Update: { auth?: string; created_at?: string; endpoint?: string; p256dh?: string; user_id?: string }
        Relationships: []
      }
      repayments: {
        Row: {
          amount: number
          from_traveller: string
          id: string
          note: string | null
          paid_on: string
          to_traveller: string
          trip_id: string
        }
        Insert: {
          amount: number
          from_traveller: string
          id?: string
          note?: string | null
          paid_on?: string
          to_traveller: string
          trip_id: string
        }
        Update: {
          amount?: number
          from_traveller?: string
          id?: string
          note?: string | null
          paid_on?: string
          to_traveller?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repayments_from_traveller_trip_id_fkey"
            columns: ["from_traveller", "trip_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "repayments_from_traveller_trip_id_fkey"
            columns: ["from_traveller", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_balances"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "repayments_from_traveller_trip_id_fkey"
            columns: ["from_traveller", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_shares"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "repayments_to_traveller_trip_id_fkey"
            columns: ["to_traveller", "trip_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "repayments_to_traveller_trip_id_fkey"
            columns: ["to_traveller", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_balances"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "repayments_to_traveller_trip_id_fkey"
            columns: ["to_traveller", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_shares"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "repayments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      room_occupants: {
        Row: {
          room_id: string
          traveller_id: string
          trip_id: string
        }
        Insert: {
          room_id: string
          traveller_id: string
          trip_id: string
        }
        Update: {
          room_id?: string
          traveller_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_occupants_room_id_trip_id_fkey"
            columns: ["room_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "room_occupants_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "room_occupants_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_balances"
            referencedColumns: ["traveller_id", "trip_id"]
          },
          {
            foreignKeyName: "room_occupants_traveller_id_trip_id_fkey"
            columns: ["traveller_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "v_traveller_shares"
            referencedColumns: ["traveller_id", "trip_id"]
          },
        ]
      }
      rooms: {
        Row: {
          amount: number
          id: string
          name: string
          option_id: string
          position: number
          trip_id: string
        }
        Insert: {
          amount: number
          id?: string
          name: string
          option_id: string
          position?: number
          trip_id: string
        }
        Update: {
          amount?: number
          id?: string
          name?: string
          option_id?: string
          position?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_option_id_trip_id_fkey"
            columns: ["option_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id", "trip_id"]
          },
        ]
      }
      travellers: {
        Row: {
          id: string
          name: string
          pay_group_id: string | null
          position: number
          trip_id: string
          user_id: string | null
        }
        Insert: {
          id?: string
          name: string
          pay_group_id?: string | null
          position?: number
          trip_id: string
          user_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          pay_group_id?: string | null
          position?: number
          trip_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travellers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travellers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      trip_members: {
        Row: {
          created_at: string
          role: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          end_date: string | null
          home_city: string | null
          home_latitude: number | null
          home_longitude: number | null
          id: string
          is_demo: boolean
          mail_code: string | null
          name: string
          start_date: string | null
          target_amount: number | null
          target_scope: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          home_city?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
          is_demo?: boolean
          mail_code?: string | null
          name: string
          start_date?: string | null
          target_amount?: number | null
          target_scope?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          home_city?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
          is_demo?: boolean
          mail_code?: string | null
          name?: string
          start_date?: string | null
          target_amount?: number | null
          target_scope?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_group_between: {
        Row: {
          amount: number | null
          group_id: string | null
          item_id: string | null
          owed_by: string | null
          owed_to: string | null
          paid_on: string | null
          trip_id: string | null
        }
        Relationships: []
      }
      v_item_bills: {
        Row: {
          common_part: number | null
          item_id: string | null
          left_to_pay: number | null
          paid_own: number | null
          share: number | null
          traveller_id: string | null
          trip_id: string | null
        }
        Relationships: []
      }
      v_party_balances: {
        Row: {
          balance: number | null
          group_id: string | null
          lead_traveller: string | null
          paid: number | null
          position: number | null
          share_of_paid: number | null
          traveller_id: string | null
          trip_id: string | null
        }
        Relationships: []
      }
      v_budget_by_category: {
        Row: {
          category: string | null
          confirmed: number | null
          current: number | null
          estimated: number | null
          planned: number | null
          trip_id: string | null
        }
        Relationships: []
      }
      v_budget_by_place: {
        Row: {
          confirmed: number | null
          current: number | null
          estimated: number | null
          place_id: string | null
          planned: number | null
          trip_id: string | null
        }
        Relationships: []
      }
      v_budget_lines: {
        Row: {
          actual: number | null
          category: string | null
          current: number | null
          has_choice: boolean | null
          is_confirmed: boolean | null
          place_id: string | null
          planned: number | null
          source: string | null
          source_id: string | null
          trip_id: string | null
        }
        Relationships: []
      }
      v_daily_estimate_checks: {
        Row: {
          daily_estimate_id: string | null
          days: number | null
          days_mismatch: boolean | null
          expected_days: number | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_estimates_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_estimates_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      v_daily_estimate_people: {
        Row: {
          daily_estimate_id: string | null
          traveller_id: string | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_estimates_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_estimates_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      v_item_amounts: {
        Row: {
          actual: number | null
          category: string | null
          chosen_option_id: string | null
          current: number | null
          is_confirmed: boolean | null
          item_id: string | null
          place_id: string | null
          planned: number | null
          status: string | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_place_id_trip_id_fkey"
            columns: ["place_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      v_item_left: {
        Row: {
          due_on: string | null
          item_id: string | null
          left_to_pay: number | null
          paid: number | null
          place_id: string | null
          price: number | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_place_id_trip_id_fkey"
            columns: ["place_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      v_item_payments: {
        Row: {
          amount: number | null
          item_id: string | null
          kind: string | null
          paid_by: string | null
          paid_each: boolean | null
          paid_on: string | null
          payment_id: string | null
          trip_id: string | null
        }
        Relationships: []
      }
      v_item_shares: {
        Row: {
          fraction: number | null
          item_id: string | null
          traveller_id: string | null
          trip_id: string | null
        }
        Relationships: []
      }
      v_traveller_balances: {
        Row: {
          balance: number | null
          paid: number | null
          received: number | null
          repaid: number | null
          share_of_paid: number | null
          traveller_id: string | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travellers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travellers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      v_traveller_by_category: {
        Row: {
          category: string | null
          confirmed: number | null
          current: number | null
          estimated: number | null
          traveller_id: string | null
          trip_id: string | null
        }
        Relationships: []
      }
      v_traveller_by_place: {
        Row: {
          confirmed: number | null
          current: number | null
          estimated: number | null
          place_id: string | null
          traveller_id: string | null
          trip_id: string | null
        }
        Relationships: []
      }
      v_traveller_lines: {
        Row: {
          amount: number | null
          category: string | null
          is_confirmed: boolean | null
          place_id: string | null
          traveller_id: string | null
          trip_id: string | null
        }
        Relationships: []
      }
      v_traveller_shares: {
        Row: {
          share_confirmed: number | null
          share_current: number | null
          share_estimated: number | null
          traveller_id: string | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travellers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travellers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_budget"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      v_trip_budget: {
        Row: {
          confirmed_per_person: number | null
          confirmed_total: number | null
          currency: string | null
          current_per_person: number | null
          current_total: number | null
          difference_total: number | null
          estimated_per_person: number | null
          estimated_total: number | null
          missing_amount_count: number | null
          planned_total: number | null
          target_status: string | null
          target_total: number | null
          traveller_count: number | null
          trip_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_cash: {
        Args: {
          p_amount: number
          p_category: string
          p_currency?: string
          p_day_number?: number
          p_for?: string[]
          p_name: string
          p_paid_by: string
          p_paid_on?: string
          p_place_id?: string
          p_rate?: number
          p_trip_id: string
        }
        Returns: string
      }
      party_name: {
        Args: { p_group_id: string; p_traveller_id: string }
        Returns: string
      }
      remove_pay_group: { Args: { p_group_id: string }; Returns: undefined }
      set_pay_group: {
        Args: { p_group_id?: string; p_traveller_ids: string[]; p_trip_id: string }
        Returns: string
      }
      delete_my_account: { Args: never; Returns: undefined }
      add_to_try: {
        Args: {
          p_amount?: number
          p_link?: string
          p_name: string
          p_kind?: string
          p_note?: string
          p_place_id: string
        }
        Returns: string
      }
      accept_invitation: { Args: { p_token: string }; Returns: string }
      start_trip_from_someday: { Args: { p_place_name: string; p_me?: string }; Returns: string }
      someday_into_place: { Args: { p_place_id: string }; Returns: number }
      import_lines: { Args: { p_payload: Json; p_trip_id: string }; Returns: Json }
      am_i_admin: { Args: never; Returns: boolean }
      admin_overview: { Args: never; Returns: Json }
      admin_people: {
        Args: never
        Returns: {
          confirmed: boolean
          created_at: string
          email: string
          first_name: string | null
          is_admin: boolean
          is_first: boolean
          last_seen: string | null
          trips: number
          user_id: string
        }[]
      }
      admin_feedback: {
        Args: never
        Returns: {
          can_reply: boolean
          created_at: string
          device: string | null
          email: string | null
          first_name: string | null
          id: string
          kind: string
          message: string
          page: string | null
          status: string
        }[]
      }
      admin_add: { Args: { p_email: string }; Returns: string }
      admin_ai: { Args: never; Returns: Json }
      trip_mail_address: { Args: { p_trip_id: string; p_new?: boolean }; Returns: string }
      share_link: {
        Args: { p_trip_id: string }
        Returns: { token: string; show_prices: boolean; show_names: boolean }[]
      }
      set_share: { Args: { p_trip_id: string; p_show_prices: boolean; p_show_names: boolean }; Returns: undefined }
      stop_share: { Args: { p_trip_id: string }; Returns: undefined }
      shared_trip: { Args: { p_token: string }; Returns: Json }
      admin_set_ai: { Args: { p_enabled: boolean }; Returns: undefined }
      apply_booking: {
        Args: {
          p_trip_id: string
          p_item_id?: string
          p_kind?: string
          p_name?: string
          p_place_id?: string
          p_day_number?: number
          p_option_name?: string
          p_amount?: number
          p_currency?: string
          p_rate?: number
          p_ref?: string
          p_link?: string
        }
        Returns: string
      }
      admin_remove: { Args: { p_user_id: string }; Returns: undefined }
      admin_list: {
        Args: never
        Returns: {
          added_by_name: string | null
          created_at: string
          first_name: string | null
          is_first: boolean
          user_id: string
        }[]
      }
      duplicate_trip: {
        Args: { p_all_options?: boolean; p_name: string; p_travellers?: string[]; p_trip_id: string }
        Returns: string
      }
      add_item: {
        Args: {
          p_amount?: number
          p_day_number?: number
          p_end_day_number?: number
          p_kind: string
          p_name: string
          p_note?: string
          p_place_id?: string
          p_trip_id: string
        }
        Returns: string
      }
      add_payment: {
        Args: {
          p_amount: number
          p_currency?: string
          p_for_payer?: boolean
          p_item_id: string
          p_kind: string
          p_note?: string
          p_paid_by?: string
          p_paid_each?: boolean
          p_paid_on?: string
          p_rate?: number
        }
        Returns: string
      }
      add_ticket: {
        Args: {
          p_after_place_id?: string
          p_amount?: number
          p_from: string
          p_mode?: string
          p_name?: string
          p_return_after_place_id?: string
          p_round_trip?: boolean
          p_to: string
          p_trip_id: string
          p_via?: string
        }
        Returns: string
      }
      cancel_invitation: {
        Args: { p_traveller_id: string }
        Returns: undefined
      }
      change_trip_currency: {
        Args: { p_currency: string; p_rate: number; p_trip_id: string }
        Returns: undefined
      }
      create_trip: {
        Args: {
          p_currency?: string
          p_end_date?: string
          p_home_city?: string
          p_home_latitude?: number
          p_home_longitude?: number
          p_me: string
          p_name: string
          p_start_date?: string
          p_target_amount?: number
          p_target_scope?: string
          p_travellers?: string[]
        }
        Returns: string
      }
      delete_payment: { Args: { p_payment_id: string }; Returns: undefined }
      delete_place: { Args: { p_place_id: string }; Returns: undefined }
      invitation_preview: {
        Args: { p_token: string }
        Returns: {
          end_date: string
          invited_by_name: string
          places: string[]
          start_date: string
          state: string
          traveller_name: string
          trip_id: string
          trip_name: string
        }[]
      }
      invite_traveller: {
        Args: { p_traveller_id: string }
        Returns: {
          expires_at: string
          token: string
        }[]
      }
      item_category: {
        Args: { p_kind: string; p_place_id: string }
        Returns: string
      }
      leave_trip: { Args: { p_trip_id: string }; Returns: undefined }
      remove_traveller: { Args: { p_traveller_id: string }; Returns: undefined }
      save_daily_estimate: {
        Args: {
          p_amount: number
          p_category: string
          p_currency: string
          p_days: number
          p_id: string
          p_label: string
          p_place_id: string
          p_rate: number
          p_travellers?: string[]
          p_trip_id: string
        }
        Returns: string
      }
      set_item_dropped: {
        Args: { p_dropped: boolean; p_item_id: string }
        Returns: undefined
      }
      set_item_due: {
        Args: { p_due_on: string; p_item_id: string }
        Returns: undefined
      }
      set_item_package: {
        Args: { p_item_id: string; p_package_id: string }
        Returns: undefined
      }
      set_restaurant_day: {
        Args: { p_day: number; p_item_id: string; p_meal?: string }
        Returns: undefined
      }
      set_item_split: {
        Args: { p_item_id: string; p_travellers: string[] }
        Returns: undefined
      }
      set_item_status: {
        Args: {
          p_actual_amount?: number
          p_actual_currency?: string
          p_actual_rate?: number
          p_item_id: string
          p_paid_by?: string
          p_paid_each?: boolean
          p_paid_on?: string
          p_status: string
        }
        Returns: undefined
      }
      set_option_rooms: {
        Args: { p_option_id: string; p_rooms: Json }
        Returns: undefined
      }
      set_package_cover: {
        Args: { p_items: string[]; p_package_id: string }
        Returns: undefined
      }
      trip_cards: {
        Args: never
        Returns: {
          created_at: string
          currency: string
          end_date: string
          home_city: string
          id: string
          name: string
          next_due: Json
          places: Json
          settle: Json
          settled: boolean
          share_confirmed: number
          share_estimated: number
          start_date: string
          today: string[]
          travellers: Json
          undecided: Json
          undecided_count: number
        }[]
      }
      trip_settlement: {
        Args: { p_trip_id: string }
        Returns: {
          amount: number
          from_group: string
          from_traveller: string
          to_group: string
          to_traveller: string
        }[]
      }
      update_to_try: {
        Args: {
          p_amount?: number
          p_item_id: string
          p_link?: string
          p_name: string
          p_note?: string
          p_place_id: string
        }
        Returns: undefined
      }
      update_item: {
        Args: {
          p_amount?: number
          p_day_number?: number
          p_end_day_number?: number
          p_item_id: string
          p_keep_price?: boolean
          p_kind: string
          p_name: string
        }
        Returns: undefined
      }
      update_ticket: {
        Args: {
          p_after_place_id?: string
          p_amount?: number
          p_from: string
          p_item_id: string
          p_keep_price?: boolean
          p_mode?: string
          p_return_after_place_id?: string
          p_round_trip?: boolean
          p_to: string
          p_via?: string
        }
        Returns: undefined
      }
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
    Enums: {},
  },
} as const
