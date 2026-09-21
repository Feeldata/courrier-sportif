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
      clubs: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          entity_id: string
          founded_year: number | null
          official_name: string
          short_name: string | null
          slug: string | null
          status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          entity_id: string
          founded_year?: number | null
          official_name: string
          short_name?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          entity_id?: string
          founded_year?: number | null
          official_name?: string
          short_name?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      competitions: {
        Row: {
          age_category: string
          competition_type: string
          country_code: string | null
          created_at: string
          entity_id: string
          gender: string
          level: number | null
          name: string
          organizer_name: string | null
          short_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          age_category?: string
          competition_type: string
          country_code?: string | null
          created_at?: string
          entity_id: string
          gender?: string
          level?: number | null
          name: string
          organizer_name?: string | null
          short_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          age_category?: string
          competition_type?: string
          country_code?: string | null
          created_at?: string
          entity_id?: string
          gender?: string
          level?: number | null
          name?: string
          organizer_name?: string | null
          short_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      duplicate_candidates: {
        Row: {
          created_at: string
          duplicate_candidate_id: string
          entity_a_id: string
          entity_b_id: string
          reason: Json
          reviewed_at: string | null
          similarity_score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duplicate_candidate_id?: string
          entity_a_id: string
          entity_b_id: string
          reason?: Json
          reviewed_at?: string | null
          similarity_score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duplicate_candidate_id?: string
          entity_a_id?: string
          entity_b_id?: string
          reason?: Json
          reviewed_at?: string | null
          similarity_score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_candidates_entity_a_id_fkey"
            columns: ["entity_a_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "duplicate_candidates_entity_b_id_fkey"
            columns: ["entity_b_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      entities: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id?: string
          entity_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      entity_aliases: {
        Row: {
          alias: string
          alias_id: string
          alias_type: string
          created_at: string
          entity_id: string
          language_code: string | null
          normalized_alias: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          alias: string
          alias_id?: string
          alias_type?: string
          created_at?: string
          entity_id: string
          language_code?: string | null
          normalized_alias: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          alias?: string
          alias_id?: string
          alias_type?: string
          created_at?: string
          entity_id?: string
          language_code?: string | null
          normalized_alias?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_aliases_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      entity_merges: {
        Row: {
          merge_id: string
          merged_at: string
          merged_entity_id: string
          reason: string | null
          survivor_entity_id: string
        }
        Insert: {
          merge_id?: string
          merged_at?: string
          merged_entity_id: string
          reason?: string | null
          survivor_entity_id: string
        }
        Update: {
          merge_id?: string
          merged_at?: string
          merged_entity_id?: string
          reason?: string | null
          survivor_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_merges_merged_entity_id_fkey"
            columns: ["merged_entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "entity_merges_survivor_entity_id_fkey"
            columns: ["survivor_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      external_ids: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          external_id_id: string
          external_url: string | null
          external_value: string
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          external_id_id?: string
          external_url?: string | null
          external_value: string
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          external_id_id?: string
          external_url?: string | null
          external_value?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_ids_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      match_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          match_id: string
          metadata: Json
          minute: number | null
          period: string
          player_id: string | null
          related_player_id: string | null
          sequence_number: number | null
          stoppage_minute: number | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id?: string
          event_type: string
          match_id: string
          metadata?: Json
          minute?: number | null
          period?: string
          player_id?: string | null
          related_player_id?: string | null
          sequence_number?: number | null
          stoppage_minute?: number | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          match_id?: string
          metadata?: Json
          minute?: number | null
          period?: string
          player_id?: string | null
          related_player_id?: string | null
          sequence_number?: number | null
          stoppage_minute?: number | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "match_events_related_player_id_fkey"
            columns: ["related_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      match_players: {
        Row: {
          captain: boolean
          created_at: string
          match_id: string
          match_player_id: string
          minute_in: number | null
          minute_out: number | null
          player_id: string
          shirt_number: number | null
          squad_role: string
          starting_position: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          captain?: boolean
          created_at?: string
          match_id: string
          match_player_id?: string
          minute_in?: number | null
          minute_out?: number | null
          player_id: string
          shirt_number?: number | null
          squad_role?: string
          starting_position?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          captain?: boolean
          created_at?: string
          match_id?: string
          match_player_id?: string
          minute_in?: number | null
          minute_out?: number | null
          player_id?: string
          shirt_number?: number | null
          squad_role?: string
          starting_position?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "match_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "match_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      match_results: {
        Row: {
          created_at: string
          decision_type: string
          match_id: string
          match_result_id: string
          official_score_away: number | null
          official_score_home: number | null
          penalties_away: number | null
          penalties_home: number | null
          score_90_away: number | null
          score_90_home: number | null
          score_et_away: number | null
          score_et_home: number | null
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          created_at?: string
          decision_type?: string
          match_id: string
          match_result_id?: string
          official_score_away?: number | null
          official_score_home?: number | null
          penalties_away?: number | null
          penalties_home?: number | null
          score_90_away?: number | null
          score_90_home?: number | null
          score_et_away?: number | null
          score_et_home?: number | null
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          created_at?: string
          decision_type?: string
          match_id?: string
          match_result_id?: string
          official_score_away?: number | null
          official_score_home?: number | null
          penalties_away?: number | null
          penalties_home?: number | null
          score_90_away?: number | null
          score_90_home?: number | null
          score_et_away?: number | null
          score_et_home?: number | null
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "match_results_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      matches: {
        Row: {
          away_team_id: string
          created_at: string
          entity_id: string
          home_team_id: string
          kickoff_at: string | null
          kickoff_precision: string
          leg: string | null
          matchday: number | null
          neutral_venue: boolean
          replay_of_match_id: string | null
          round_label: string | null
          scheduled_date: string | null
          season_id: string
          status: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          away_team_id: string
          created_at?: string
          entity_id: string
          home_team_id: string
          kickoff_at?: string | null
          kickoff_precision?: string
          leg?: string | null
          matchday?: number | null
          neutral_venue?: boolean
          replay_of_match_id?: string | null
          round_label?: string | null
          scheduled_date?: string | null
          season_id: string
          status?: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          away_team_id?: string
          created_at?: string
          entity_id?: string
          home_team_id?: string
          kickoff_at?: string | null
          kickoff_precision?: string
          leg?: string | null
          matchday?: number | null
          neutral_venue?: boolean
          replay_of_match_id?: string | null
          round_label?: string | null
          scheduled_date?: string | null
          season_id?: string
          status?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "matches_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "matches_replay_of_match_id_fkey"
            columns: ["replay_of_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      player_team_memberships: {
        Row: {
          created_at: string
          end_date: string | null
          end_date_precision: string
          membership_id: string
          membership_type: string
          player_id: string
          start_date: string | null
          start_date_precision: string
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          end_date_precision?: string
          membership_id?: string
          membership_type?: string
          player_id: string
          start_date?: string | null
          start_date_precision?: string
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          end_date_precision?: string
          membership_id?: string
          membership_type?: string
          player_id?: string
          start_date?: string | null
          start_date_precision?: string
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_team_memberships_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "player_team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      players: {
        Row: {
          birth_date_precision: string
          birth_place: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string
          entity_id: string
          first_name: string | null
          gender: string
          last_name: string | null
          nationality_code: string | null
          preferred_foot: string | null
          primary_position: string | null
          status: string
          updated_at: string
        }
        Insert: {
          birth_date_precision?: string
          birth_place?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name: string
          entity_id: string
          first_name?: string | null
          gender?: string
          last_name?: string | null
          nationality_code?: string | null
          preferred_foot?: string | null
          primary_position?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          birth_date_precision?: string
          birth_place?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          entity_id?: string
          first_name?: string | null
          gender?: string
          last_name?: string | null
          nationality_code?: string | null
          preferred_foot?: string | null
          primary_position?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      seasons: {
        Row: {
          competition_id: string
          created_at: string
          end_date: string | null
          entity_id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          end_date?: string | null
          entity_id: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          end_date?: string | null
          entity_id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "seasons_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      source_observations: {
        Row: {
          confidence: number | null
          created_at: string
          field_name: string
          normalized_value: Json | null
          observation_id: string
          observed_at: string
          raw_value: Json
          source_record_id: string
          status: string
          subject_entity_id: string | null
          subject_entity_type: string
          subject_key: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          field_name: string
          normalized_value?: Json | null
          observation_id?: string
          observed_at?: string
          raw_value: Json
          source_record_id: string
          status?: string
          subject_entity_id?: string | null
          subject_entity_type: string
          subject_key?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          field_name?: string
          normalized_value?: Json | null
          observation_id?: string
          observed_at?: string
          raw_value?: Json
          source_record_id?: string
          status?: string
          subject_entity_id?: string | null
          subject_entity_type?: string
          subject_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_observations_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["source_record_id"]
          },
          {
            foreignKeyName: "source_observations_subject_entity_id_fkey"
            columns: ["subject_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      source_records: {
        Row: {
          collected_at: string
          content_hash: string | null
          created_at: string
          external_ref: string | null
          metadata: Json
          published_at: string | null
          record_type: string
          source_id: string
          source_record_id: string
          url: string | null
        }
        Insert: {
          collected_at?: string
          content_hash?: string | null
          created_at?: string
          external_ref?: string | null
          metadata?: Json
          published_at?: string | null
          record_type?: string
          source_id: string
          source_record_id?: string
          url?: string | null
        }
        Update: {
          collected_at?: string
          content_hash?: string | null
          created_at?: string
          external_ref?: string | null
          metadata?: Json
          published_at?: string | null
          record_type?: string
          source_id?: string
          source_record_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_records_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      sources: {
        Row: {
          base_url: string | null
          created_at: string
          name: string
          publisher: string | null
          reliability_level: number | null
          source_id: string
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          name: string
          publisher?: string | null
          reliability_level?: number | null
          source_id?: string
          source_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          name?: string
          publisher?: string | null
          reliability_level?: number | null
          source_id?: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      stat_definitions: {
        Row: {
          aggregation_method: string
          applicable_entity_types: string[]
          code: string
          created_at: string
          data_type: string
          description: string | null
          name: string
          stat_definition_id: string
          status: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          aggregation_method?: string
          applicable_entity_types?: string[]
          code: string
          created_at?: string
          data_type: string
          description?: string | null
          name: string
          stat_definition_id?: string
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          aggregation_method?: string
          applicable_entity_types?: string[]
          code?: string
          created_at?: string
          data_type?: string
          description?: string | null
          name?: string
          stat_definition_id?: string
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stat_values: {
        Row: {
          boolean_value: boolean | null
          calculation_version: string | null
          context_match_id: string | null
          context_season_id: string | null
          created_at: string
          entry_method: string
          numeric_value: number | null
          source_record_id: string | null
          stat_definition_id: string
          stat_value_id: string
          subject_entity_id: string
          text_value: string | null
          updated_at: string
          value_kind: string
        }
        Insert: {
          boolean_value?: boolean | null
          calculation_version?: string | null
          context_match_id?: string | null
          context_season_id?: string | null
          created_at?: string
          entry_method?: string
          numeric_value?: number | null
          source_record_id?: string | null
          stat_definition_id: string
          stat_value_id?: string
          subject_entity_id: string
          text_value?: string | null
          updated_at?: string
          value_kind: string
        }
        Update: {
          boolean_value?: boolean | null
          calculation_version?: string | null
          context_match_id?: string | null
          context_season_id?: string | null
          created_at?: string
          entry_method?: string
          numeric_value?: number | null
          source_record_id?: string | null
          stat_definition_id?: string
          stat_value_id?: string
          subject_entity_id?: string
          text_value?: string | null
          updated_at?: string
          value_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "stat_values_context_match_id_fkey"
            columns: ["context_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "stat_values_context_season_id_fkey"
            columns: ["context_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "stat_values_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["source_record_id"]
          },
          {
            foreignKeyName: "stat_values_stat_definition_id_fkey"
            columns: ["stat_definition_id"]
            isOneToOne: false
            referencedRelation: "stat_definitions"
            referencedColumns: ["stat_definition_id"]
          },
          {
            foreignKeyName: "stat_values_subject_entity_id_fkey"
            columns: ["subject_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      team_season_entries: {
        Row: {
          created_at: string
          entry_id: string
          entry_status: string
          group_label: string | null
          season_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_id?: string
          entry_status?: string
          group_label?: string | null
          season_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          entry_status?: string
          group_label?: string | null
          season_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_season_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "team_season_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      teams: {
        Row: {
          age_category: string
          club_id: string | null
          country_code: string | null
          created_at: string
          entity_id: string
          gender: string
          name: string
          status: string
          team_scope: string
          updated_at: string
        }
        Insert: {
          age_category?: string
          club_id?: string | null
          country_code?: string | null
          created_at?: string
          entity_id: string
          gender?: string
          name: string
          status?: string
          team_scope: string
          updated_at?: string
        }
        Update: {
          age_category?: string
          club_id?: string | null
          country_code?: string | null
          created_at?: string
          entity_id?: string
          gender?: string
          name?: string
          status?: string
          team_scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "teams_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      validation_issues: {
        Row: {
          created_at: string
          details: Json
          detected_at: string
          entity_id: string | null
          message: string
          resolved_at: string | null
          rule_code: string
          severity: string
          status: string
          subject_locator: Json
          validation_issue_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          detected_at?: string
          entity_id?: string | null
          message: string
          resolved_at?: string | null
          rule_code: string
          severity: string
          status?: string
          subject_locator?: Json
          validation_issue_id?: string
        }
        Update: {
          created_at?: string
          details?: Json
          detected_at?: string
          entity_id?: string | null
          message?: string
          resolved_at?: string | null
          rule_code?: string
          severity?: string
          status?: string
          subject_locator?: Json
          validation_issue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_issues_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      venues: {
        Row: {
          capacity: number | null
          city: string | null
          country_code: string | null
          created_at: string
          entity_id: string
          latitude: number | null
          longitude: number | null
          name: string
          region: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          entity_id: string
          latitude?: number | null
          longitude?: number | null
          name: string
          region?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          entity_id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          region?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["entity_id"]
          },
        ]
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
