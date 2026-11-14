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
            foreignKeyName: "invitations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
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
          category: string
          created_at: string
          day_number: number | null
          end_day_number: number | null
          id: string
          kind: string
          latitude: number | null
          location_name: string | null
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
        }
        Insert: {
          actual_amount?: number | null
          actual_currency?: string | null
          actual_rate?: number
          category: string
          created_at?: string
          day_number?: number | null
          end_day_number?: number | null
          id?: string
          kind: string
          latitude?: number | null
          location_name?: string | null
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
        }
        Update: {
          actual_amount?: number | null
          actual_currency?: string | null
          actual_rate?: number
          category?: string
          created_at?: string
          day_number?: number | null
          end_day_number?: number | null
          id?: string
          kind?: string
          latitude?: number | null
          location_name?: string | null
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
        }
        Relationships: [
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
          position: number
          trip_id: string
          user_id: string | null
        }
        Insert: {
          id?: string
          name: string
          position?: number
          trip_id: string
          user_id?: string | null
        }
        Update: {
          id?: string
          name?: string
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
          name?: string
          start_date?: string | null
          target_amount?: number | null
          target_scope?: string
        }
        Relationships: []
      }
    }
    Views: {
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
      accept_invitation: { Args: { p_token: string }; Returns: string }
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
      save_daily_estimate: {
        Args: {
          p_amount: number
          p_category: string
          p_currency: string
          p_days: number
          p_id: string | null
          p_label: string
          p_place_id: string | null
          p_rate: number | null
          p_travellers?: string[]
          p_trip_id: string
        }
        Returns: string
      }
      set_item_package: {
        Args: { p_item_id: string; p_package_id: string | null }
        Returns: undefined
      }
      set_item_dropped: {
        Args: { p_dropped: boolean; p_item_id: string }
        Returns: undefined
      }
      set_package_cover: {
        Args: { p_items: string[]; p_package_id: string }
        Returns: undefined
      }
      set_option_rooms: {
        Args: { p_option_id: string; p_rooms: Json }
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
      delete_place: { Args: { p_place_id: string }; Returns: undefined }
      leave_trip: { Args: { p_trip_id: string }; Returns: undefined }
      remove_traveller: { Args: { p_traveller_id: string }; Returns: undefined }
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
      item_category: { Args: { p_kind: string; p_place_id: string }; Returns: string }
      trip_settlement: {
        Args: { p_trip_id: string }
        Returns: {
          amount: number
          from_traveller: string
          to_traveller: string
        }[]
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
