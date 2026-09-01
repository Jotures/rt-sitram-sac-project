export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      advances: {
        Row: {
          amount: number;
          company_id: string;
          concept: string | null;
          created_at: string;
          created_by: string;
          currency: string;
          delivered_at: string;
          delivery_method: string;
          driver_id: string;
          id: string;
          idempotency_key: string | null;
          receipt_file_id: string | null;
          reference: string | null;
          status: Database["public"]["Enums"]["advance_status"];
          trip_id: string;
        };
        Insert: {
          amount: number;
          company_id: string;
          concept?: string | null;
          created_at?: string;
          created_by: string;
          currency?: string;
          delivered_at: string;
          delivery_method: string;
          driver_id: string;
          id?: string;
          idempotency_key?: string | null;
          receipt_file_id?: string | null;
          reference?: string | null;
          status?: Database["public"]["Enums"]["advance_status"];
          trip_id: string;
        };
        Update: {
          amount?: number;
          company_id?: string;
          concept?: string | null;
          created_at?: string;
          created_by?: string;
          currency?: string;
          delivered_at?: string;
          delivery_method?: string;
          driver_id?: string;
          id?: string;
          idempotency_key?: string | null;
          receipt_file_id?: string | null;
          reference?: string | null;
          status?: Database["public"]["Enums"]["advance_status"];
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "advances_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "advances_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advances_driver_fk";
            columns: ["company_id", "driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "advances_file_fk";
            columns: ["company_id", "receipt_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "advances_trip_fk";
            columns: ["company_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      alerts: {
        Row: {
          alert_type: string;
          company_id: string;
          due_at: string | null;
          entity_id: string;
          entity_type: string;
          generated_at: string;
          id: string;
          message: string;
          priority: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["alert_status"];
          title: string;
        };
        Insert: {
          alert_type: string;
          company_id: string;
          due_at?: string | null;
          entity_id: string;
          entity_type: string;
          generated_at?: string;
          id?: string;
          message: string;
          priority: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["alert_status"];
          title: string;
        };
        Update: {
          alert_type?: string;
          company_id?: string;
          due_at?: string | null;
          entity_id?: string;
          entity_type?: string;
          generated_at?: string;
          id?: string;
          message?: string;
          priority?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["alert_status"];
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerts_resolver_fk";
            columns: ["company_id", "resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          after_data: Json | null;
          before_data: Json | null;
          company_id: string;
          entity_id: string;
          entity_type: string;
          id: string;
          occurred_at: string;
          reason: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          company_id: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          occurred_at?: string;
          reason?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          company_id?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          occurred_at?: string;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_fk";
            columns: ["company_id", "actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "audit_events_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          active: boolean;
          address: string | null;
          company_id: string;
          created_at: string;
          id: string;
          legal_name: string;
          notes: string | null;
          payment_terms_days: number;
          phone: string | null;
          relationship_type: Database["public"]["Enums"]["client_relationship_type"] | null;
          tax_id: string | null;
          trade_name: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          legal_name: string;
          notes?: string | null;
          payment_terms_days?: number;
          phone?: string | null;
          relationship_type?: Database["public"]["Enums"]["client_relationship_type"] | null;
          tax_id?: string | null;
          trade_name?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          legal_name?: string;
          notes?: string | null;
          payment_terms_days?: number;
          phone?: string | null;
          relationship_type?: Database["public"]["Enums"]["client_relationship_type"] | null;
          tax_id?: string | null;
          trade_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          legal_name: string;
          tax_id: string | null;
          trade_name: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          legal_name: string;
          tax_id?: string | null;
          trade_name?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          legal_name?: string;
          tax_id?: string | null;
          trade_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          blocks_operation: boolean;
          client_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string;
          document_number: string | null;
          document_type: string;
          driver_id: string | null;
          entity_type: string;
          expires_on: string | null;
          file_id: string | null;
          id: string;
          issued_on: string | null;
          notes: string | null;
          status: Database["public"]["Enums"]["document_status"];
          trip_id: string | null;
          updated_at: string;
          vehicle_id: string | null;
        };
        Insert: {
          blocks_operation?: boolean;
          client_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by: string;
          document_number?: string | null;
          document_type: string;
          driver_id?: string | null;
          entity_type: string;
          expires_on?: string | null;
          file_id?: string | null;
          id?: string;
          issued_on?: string | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          trip_id?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          blocks_operation?: boolean;
          client_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          document_number?: string | null;
          document_type?: string;
          driver_id?: string | null;
          entity_type?: string;
          expires_on?: string | null;
          file_id?: string | null;
          id?: string;
          issued_on?: string | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          trip_id?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "documents_client_fk";
            columns: ["company_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "documents_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_driver_fk";
            columns: ["company_id", "driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "documents_file_fk";
            columns: ["company_id", "file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "documents_trip_fk";
            columns: ["company_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "documents_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      driver_availability: {
        Row: {
          company_id: string;
          driver_id: string;
          ended_at: string | null;
          id: string;
          reason: string | null;
          recorded_by: string;
          started_at: string;
          status: Database["public"]["Enums"]["driver_status"];
        };
        Insert: {
          company_id: string;
          driver_id: string;
          ended_at?: string | null;
          id?: string;
          reason?: string | null;
          recorded_by: string;
          started_at?: string;
          status: Database["public"]["Enums"]["driver_status"];
        };
        Update: {
          company_id?: string;
          driver_id?: string;
          ended_at?: string | null;
          id?: string;
          reason?: string | null;
          recorded_by?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["driver_status"];
        };
        Relationships: [
          {
            foreignKeyName: "driver_availability_actor_fk";
            columns: ["company_id", "recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "driver_availability_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "driver_availability_driver_fk";
            columns: ["company_id", "driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      drivers: {
        Row: {
          active: boolean;
          company_id: string;
          contract_ended_on: string | null;
          contract_started_on: string | null;
          contract_type: string | null;
          created_at: string;
          current_status: Database["public"]["Enums"]["driver_status"];
          display_name: string;
          document_number: string | null;
          document_type: string | null;
          id: string;
          license_expires_on: string | null;
          license_number: string | null;
          notes: string | null;
          phone: string | null;
          profile_id: string | null;
          updated_at: string;
          usual_vehicle_id: string | null;
        };
        Insert: {
          active?: boolean;
          company_id: string;
          contract_ended_on?: string | null;
          contract_started_on?: string | null;
          contract_type?: string | null;
          created_at?: string;
          current_status?: Database["public"]["Enums"]["driver_status"];
          display_name: string;
          document_number?: string | null;
          document_type?: string | null;
          id?: string;
          license_expires_on?: string | null;
          license_number?: string | null;
          notes?: string | null;
          phone?: string | null;
          profile_id?: string | null;
          updated_at?: string;
          usual_vehicle_id?: string | null;
        };
        Update: {
          active?: boolean;
          company_id?: string;
          contract_ended_on?: string | null;
          contract_started_on?: string | null;
          contract_type?: string | null;
          created_at?: string;
          current_status?: Database["public"]["Enums"]["driver_status"];
          display_name?: string;
          document_number?: string | null;
          document_type?: string | null;
          id?: string;
          license_expires_on?: string | null;
          license_number?: string | null;
          notes?: string | null;
          phone?: string | null;
          profile_id?: string | null;
          updated_at?: string;
          usual_vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "drivers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drivers_profile_fk";
            columns: ["company_id", "profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "drivers_usual_vehicle_fk";
            columns: ["company_id", "usual_vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      expense_categories: {
        Row: {
          active: boolean;
          code: string;
          company_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          company_id: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          approved_amount: number | null;
          assignment_type: Database["public"]["Enums"]["assignment_type"];
          category_id: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          description: string | null;
          driver_id: string | null;
          id: string;
          idempotency_key: string | null;
          incurred_at: string;
          receipt_file_id: string | null;
          receipt_number: string | null;
          receipt_type: string | null;
          source: string;
          source_device_id: string | null;
          supplier_id: string | null;
          trip_id: string | null;
          updated_at: string;
          validation_status: Database["public"]["Enums"]["validation_status"];
          vehicle_id: string | null;
        };
        Insert: {
          amount: number;
          approved_amount?: number | null;
          assignment_type: Database["public"]["Enums"]["assignment_type"];
          category_id: string;
          company_id: string;
          created_at?: string;
          created_by: string;
          currency?: string;
          description?: string | null;
          driver_id?: string | null;
          id?: string;
          idempotency_key?: string | null;
          incurred_at: string;
          receipt_file_id?: string | null;
          receipt_number?: string | null;
          receipt_type?: string | null;
          source: string;
          source_device_id?: string | null;
          supplier_id?: string | null;
          trip_id?: string | null;
          updated_at?: string;
          validation_status?: Database["public"]["Enums"]["validation_status"];
          vehicle_id?: string | null;
        };
        Update: {
          amount?: number;
          approved_amount?: number | null;
          assignment_type?: Database["public"]["Enums"]["assignment_type"];
          category_id?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          description?: string | null;
          driver_id?: string | null;
          id?: string;
          idempotency_key?: string | null;
          incurred_at?: string;
          receipt_file_id?: string | null;
          receipt_number?: string | null;
          receipt_type?: string | null;
          source?: string;
          source_device_id?: string | null;
          supplier_id?: string | null;
          trip_id?: string | null;
          updated_at?: string;
          validation_status?: Database["public"]["Enums"]["validation_status"];
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "expenses_category_fk";
            columns: ["company_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "expenses_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_driver_fk";
            columns: ["company_id", "driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "expenses_file_fk";
            columns: ["company_id", "receipt_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "expenses_supplier_fk";
            columns: ["company_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "expenses_trip_fk";
            columns: ["company_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "expenses_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      files: {
        Row: {
          company_id: string;
          content_hash: string | null;
          created_at: string;
          id: string;
          mime_type: string;
          original_name: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by: string;
        };
        Insert: {
          company_id: string;
          content_hash?: string | null;
          created_at?: string;
          id?: string;
          mime_type: string;
          original_name: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by: string;
        };
        Update: {
          company_id?: string;
          content_hash?: string | null;
          created_at?: string;
          id?: string;
          mime_type?: string;
          original_name?: string;
          size_bytes?: number;
          storage_path?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_actor_fk";
            columns: ["company_id", "uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "files_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      fuel_entries: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          driver_id: string | null;
          fueled_at: string;
          id: string;
          idempotency_key: string | null;
          location: string | null;
          odometer_km: number;
          payment_method: string | null;
          quantity: number;
          receipt_file_id: string | null;
          receipt_number: string | null;
          receipt_type: string | null;
          source_device_id: string | null;
          supplier_id: string | null;
          total_amount: number;
          trip_id: string | null;
          unit_price: number;
          updated_at: string;
          validation_status: Database["public"]["Enums"]["validation_status"];
          vehicle_id: string;
          volume_unit: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          created_by: string;
          currency?: string;
          driver_id?: string | null;
          fueled_at: string;
          id?: string;
          idempotency_key?: string | null;
          location?: string | null;
          odometer_km: number;
          payment_method?: string | null;
          quantity: number;
          receipt_file_id?: string | null;
          receipt_number?: string | null;
          receipt_type?: string | null;
          source_device_id?: string | null;
          supplier_id?: string | null;
          total_amount: number;
          trip_id?: string | null;
          unit_price: number;
          updated_at?: string;
          validation_status?: Database["public"]["Enums"]["validation_status"];
          vehicle_id: string;
          volume_unit: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          driver_id?: string | null;
          fueled_at?: string;
          id?: string;
          idempotency_key?: string | null;
          location?: string | null;
          odometer_km?: number;
          payment_method?: string | null;
          quantity?: number;
          receipt_file_id?: string | null;
          receipt_number?: string | null;
          receipt_type?: string | null;
          source_device_id?: string | null;
          supplier_id?: string | null;
          total_amount?: number;
          trip_id?: string | null;
          unit_price?: number;
          updated_at?: string;
          validation_status?: Database["public"]["Enums"]["validation_status"];
          vehicle_id?: string;
          volume_unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fuel_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "fuel_driver_fk";
            columns: ["company_id", "driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "fuel_entries_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fuel_file_fk";
            columns: ["company_id", "receipt_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "fuel_supplier_fk";
            columns: ["company_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "fuel_trip_fk";
            columns: ["company_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "fuel_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      gps_odometer_authorities: {
        Row: {
          activated_at: string;
          activated_by: string;
          activation_request_id: string;
          baseline_position_id: string;
          bootstrap_mode: Database["public"]["Enums"]["gps_odometer_bootstrap_mode"];
          company_id: string;
          id: string;
          provider_link_id: string;
          status: Database["public"]["Enums"]["gps_odometer_authority_status"];
          suspended_at: string | null;
          suspended_by: string | null;
          suspension_reason: string | null;
          vehicle_id: string;
        };
        Insert: {
          activated_at?: string;
          activated_by: string;
          activation_request_id: string;
          baseline_position_id: string;
          bootstrap_mode: Database["public"]["Enums"]["gps_odometer_bootstrap_mode"];
          company_id: string;
          id?: string;
          provider_link_id: string;
          status?: Database["public"]["Enums"]["gps_odometer_authority_status"];
          suspended_at?: string | null;
          suspended_by?: string | null;
          suspension_reason?: string | null;
          vehicle_id: string;
        };
        Update: {
          activated_at?: string;
          activated_by?: string;
          activation_request_id?: string;
          baseline_position_id?: string;
          bootstrap_mode?: Database["public"]["Enums"]["gps_odometer_bootstrap_mode"];
          company_id?: string;
          id?: string;
          provider_link_id?: string;
          status?: Database["public"]["Enums"]["gps_odometer_authority_status"];
          suspended_at?: string | null;
          suspended_by?: string | null;
          suspension_reason?: string | null;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gps_odometer_authorities_actor_fk";
            columns: ["company_id", "activated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_odometer_authorities_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps_odometer_authorities_link_fk";
            columns: ["company_id", "provider_link_id"];
            isOneToOne: false;
            referencedRelation: "gps_provider_vehicle_links";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_odometer_authorities_suspended_by_fk";
            columns: ["company_id", "suspended_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_odometer_authorities_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      gps_odometer_plausibility_policies: {
        Row: {
          company_id: string;
          configured_at: string;
          configured_by: string;
          max_auto_advance_km: number;
          max_average_speed_kmh: number;
          reason: string;
          version: number;
        };
        Insert: {
          company_id: string;
          configured_at?: string;
          configured_by: string;
          max_auto_advance_km: number;
          max_average_speed_kmh: number;
          reason: string;
          version?: number;
        };
        Update: {
          company_id?: string;
          configured_at?: string;
          configured_by?: string;
          max_auto_advance_km?: number;
          max_average_speed_kmh?: number;
          reason?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "gps_odometer_plausibility_policies_actor_fk";
            columns: ["company_id", "configured_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_odometer_plausibility_policies_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      gps_odometer_plausibility_policy_requests: {
        Row: {
          company_id: string;
          idempotency_key: string;
          max_auto_advance_km: number;
          max_average_speed_kmh: number;
          reason: string;
          requested_at: string;
          requested_by: string;
          resulting_policy_configured_at: string | null;
          resulting_policy_version: number | null;
        };
        Insert: {
          company_id: string;
          idempotency_key: string;
          max_auto_advance_km: number;
          max_average_speed_kmh: number;
          reason: string;
          requested_at?: string;
          requested_by: string;
          resulting_policy_configured_at?: string | null;
          resulting_policy_version?: number | null;
        };
        Update: {
          company_id?: string;
          idempotency_key?: string;
          max_auto_advance_km?: number;
          max_average_speed_kmh?: number;
          reason?: string;
          requested_at?: string;
          requested_by?: string;
          resulting_policy_configured_at?: string | null;
          resulting_policy_version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "gps_odometer_plausibility_policy_requests_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps_odometer_policy_requests_actor_fk";
            columns: ["company_id", "requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      gps_odometer_promotion_reviews: {
        Row: {
          authority_id: string;
          company_id: string;
          decision: Database["public"]["Enums"]["gps_odometer_review_decision"];
          id: string;
          idempotency_key: string;
          odometer_entry_id: string | null;
          previous_odometer_km: number;
          promotion_id: string;
          reason: string;
          resulting_odometer_km: number;
          reviewed_at: string;
          reviewed_by: string;
          vehicle_id: string;
        };
        Insert: {
          authority_id: string;
          company_id: string;
          decision: Database["public"]["Enums"]["gps_odometer_review_decision"];
          id?: string;
          idempotency_key: string;
          odometer_entry_id?: string | null;
          previous_odometer_km: number;
          promotion_id: string;
          reason: string;
          resulting_odometer_km: number;
          reviewed_at?: string;
          reviewed_by: string;
          vehicle_id: string;
        };
        Update: {
          authority_id?: string;
          company_id?: string;
          decision?: Database["public"]["Enums"]["gps_odometer_review_decision"];
          id?: string;
          idempotency_key?: string;
          odometer_entry_id?: string | null;
          previous_odometer_km?: number;
          promotion_id?: string;
          reason?: string;
          resulting_odometer_km?: number;
          reviewed_at?: string;
          reviewed_by?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gps_odometer_promotion_reviews_actor_fk";
            columns: ["company_id", "reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_odometer_promotion_reviews_authority_fk";
            columns: ["company_id", "authority_id"];
            isOneToOne: false;
            referencedRelation: "gps_odometer_authorities";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_odometer_promotion_reviews_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps_odometer_promotion_reviews_entry_fk";
            columns: ["company_id", "odometer_entry_id"];
            isOneToOne: false;
            referencedRelation: "odometer_entries";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_odometer_promotion_reviews_promotion_fk";
            columns: ["company_id", "promotion_id"];
            isOneToOne: true;
            referencedRelation: "gps_odometer_promotions";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_odometer_promotion_reviews_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      gps_odometer_promotions: {
        Row: {
          authority_id: string;
          authorized_by: string;
          bootstrap_mode: Database["public"]["Enums"]["gps_odometer_bootstrap_mode"] | null;
          company_id: string;
          created_at: string;
          id: string;
          odometer_entry_id: string | null;
          outcome: Database["public"]["Enums"]["gps_odometer_promotion_outcome"];
          previous_odometer_km: number;
          promotion_kind: Database["public"]["Enums"]["gps_odometer_promotion_kind"];
          reason: string;
          reported_odometer_km: number;
          resulting_odometer_km: number;
          source_kind: Database["public"]["Enums"]["gps_position_source_kind"];
          source_odometer_semantic: Database["public"]["Enums"]["gps_odometer_source_semantic"];
          source_position_id: string;
          source_received_at: string;
          source_recorded_at: string;
          sync_run_id: string | null;
          vehicle_id: string;
        };
        Insert: {
          authority_id: string;
          authorized_by: string;
          bootstrap_mode?: Database["public"]["Enums"]["gps_odometer_bootstrap_mode"] | null;
          company_id: string;
          created_at?: string;
          id?: string;
          odometer_entry_id?: string | null;
          outcome: Database["public"]["Enums"]["gps_odometer_promotion_outcome"];
          previous_odometer_km: number;
          promotion_kind: Database["public"]["Enums"]["gps_odometer_promotion_kind"];
          reason: string;
          reported_odometer_km: number;
          resulting_odometer_km: number;
          source_kind: Database["public"]["Enums"]["gps_position_source_kind"];
          source_odometer_semantic: Database["public"]["Enums"]["gps_odometer_source_semantic"];
          source_position_id: string;
          source_received_at: string;
          source_recorded_at: string;
          sync_run_id?: string | null;
          vehicle_id: string;
        };
        Update: {
          authority_id?: string;
          authorized_by?: string;
          bootstrap_mode?: Database["public"]["Enums"]["gps_odometer_bootstrap_mode"] | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          odometer_entry_id?: string | null;
          outcome?: Database["public"]["Enums"]["gps_odometer_promotion_outcome"];
          previous_odometer_km?: number;
          promotion_kind?: Database["public"]["Enums"]["gps_odometer_promotion_kind"];
          reason?: string;
          reported_odometer_km?: number;
          resulting_odometer_km?: number;
          source_kind?: Database["public"]["Enums"]["gps_position_source_kind"];
          source_odometer_semantic?: Database["public"]["Enums"]["gps_odometer_source_semantic"];
          source_position_id?: string;
          source_received_at?: string;
          source_recorded_at?: string;
          sync_run_id?: string | null;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gps_odometer_promotions_actor_fk";
            columns: ["company_id", "authorized_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_odometer_promotions_authority_fk";
            columns: ["company_id", "authority_id"];
            isOneToOne: false;
            referencedRelation: "gps_odometer_authorities";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_odometer_promotions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps_odometer_promotions_entry_fk";
            columns: ["company_id", "odometer_entry_id"];
            isOneToOne: true;
            referencedRelation: "odometer_entries";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_odometer_promotions_sync_run_id_fkey";
            columns: ["sync_run_id"];
            isOneToOne: false;
            referencedRelation: "gps_sync_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps_odometer_promotions_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      gps_positions: {
        Row: {
          altitude_meters: number | null;
          company_id: string;
          external_asset_id: string;
          heading_degrees: number | null;
          id: string;
          ignition: boolean | null;
          latitude: number;
          longitude: number;
          observation_key: string;
          odometer_km: number | null;
          odometer_source_semantic: Database["public"]["Enums"]["gps_odometer_source_semantic"];
          persisted_at: string;
          provider_event_id: string | null;
          provider_kind: string;
          provider_link_id: string;
          received_at: string;
          recorded_at: string;
          source_kind: Database["public"]["Enums"]["gps_position_source_kind"];
          speed_kmh: number | null;
          sync_run_id: string | null;
          vehicle_id: string;
        };
        Insert: {
          altitude_meters?: number | null;
          company_id: string;
          external_asset_id: string;
          heading_degrees?: number | null;
          id?: string;
          ignition?: boolean | null;
          latitude: number;
          longitude: number;
          observation_key: string;
          odometer_km?: number | null;
          odometer_source_semantic?: Database["public"]["Enums"]["gps_odometer_source_semantic"];
          persisted_at?: string;
          provider_event_id?: string | null;
          provider_kind: string;
          provider_link_id: string;
          received_at: string;
          recorded_at: string;
          source_kind?: Database["public"]["Enums"]["gps_position_source_kind"];
          speed_kmh?: number | null;
          sync_run_id?: string | null;
          vehicle_id: string;
        };
        Update: {
          altitude_meters?: number | null;
          company_id?: string;
          external_asset_id?: string;
          heading_degrees?: number | null;
          id?: string;
          ignition?: boolean | null;
          latitude?: number;
          longitude?: number;
          observation_key?: string;
          odometer_km?: number | null;
          odometer_source_semantic?: Database["public"]["Enums"]["gps_odometer_source_semantic"];
          persisted_at?: string;
          provider_event_id?: string | null;
          provider_kind?: string;
          provider_link_id?: string;
          received_at?: string;
          recorded_at?: string;
          source_kind?: Database["public"]["Enums"]["gps_position_source_kind"];
          speed_kmh?: number | null;
          sync_run_id?: string | null;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gps_positions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps_positions_link_fk";
            columns: ["company_id", "provider_link_id"];
            isOneToOne: false;
            referencedRelation: "gps_provider_vehicle_links";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_positions_sync_run_fk";
            columns: ["sync_run_id"];
            isOneToOne: false;
            referencedRelation: "gps_sync_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps_positions_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      gps_provider_vehicle_links: {
        Row: {
          active: boolean;
          company_id: string;
          created_at: string;
          external_asset_id: string;
          external_display_name: string | null;
          id: string;
          linked_at: string;
          linked_by: string;
          provider_kind: string;
          unlink_reason: string | null;
          unlinked_at: string | null;
          unlinked_by: string | null;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          active?: boolean;
          company_id: string;
          created_at?: string;
          external_asset_id: string;
          external_display_name?: string | null;
          id?: string;
          linked_at?: string;
          linked_by: string;
          provider_kind: string;
          unlink_reason?: string | null;
          unlinked_at?: string | null;
          unlinked_by?: string | null;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          active?: boolean;
          company_id?: string;
          created_at?: string;
          external_asset_id?: string;
          external_display_name?: string | null;
          id?: string;
          linked_at?: string;
          linked_by?: string;
          provider_kind?: string;
          unlink_reason?: string | null;
          unlinked_at?: string | null;
          unlinked_by?: string | null;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gps_provider_vehicle_links_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps_provider_vehicle_links_linked_by_fk";
            columns: ["company_id", "linked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_provider_vehicle_links_unlinked_by_fk";
            columns: ["company_id", "unlinked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "gps_provider_vehicle_links_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      gps_sync_runs: {
        Row: {
          assets_seen: number;
          company_id: string;
          deadline_at: string | null;
          error_code: string | null;
          error_message: string | null;
          finished_at: string | null;
          heartbeat_at: string | null;
          id: string;
          initiated_by: string | null;
          lease_expires_at: string | null;
          positions_deduplicated: number;
          positions_persisted: number;
          positions_received: number;
          positions_unlinked: number;
          provider_checkpoint_at: string | null;
          provider_kind: string;
          request_id: string | null;
          source_attempts: number;
          started_at: string;
          status: Database["public"]["Enums"]["gps_sync_run_status"];
          trigger_kind: string;
        };
        Insert: {
          assets_seen?: number;
          company_id: string;
          deadline_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          finished_at?: string | null;
          heartbeat_at?: string | null;
          id?: string;
          initiated_by?: string | null;
          lease_expires_at?: string | null;
          positions_deduplicated?: number;
          positions_persisted?: number;
          positions_received?: number;
          positions_unlinked?: number;
          provider_checkpoint_at?: string | null;
          provider_kind: string;
          request_id?: string | null;
          source_attempts?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["gps_sync_run_status"];
          trigger_kind?: string;
        };
        Update: {
          assets_seen?: number;
          company_id?: string;
          deadline_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          finished_at?: string | null;
          heartbeat_at?: string | null;
          id?: string;
          initiated_by?: string | null;
          lease_expires_at?: string | null;
          positions_deduplicated?: number;
          positions_persisted?: number;
          positions_received?: number;
          positions_unlinked?: number;
          provider_checkpoint_at?: string | null;
          provider_kind?: string;
          request_id?: string | null;
          source_attempts?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["gps_sync_run_status"];
          trigger_kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gps_sync_runs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps_sync_runs_initiated_by_fk";
            columns: ["company_id", "initiated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      gps_telemetry_retention_policies: {
        Row: {
          company_id: string;
          configured_at: string;
          configured_by: string;
          historical_position_retention_days: number;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          configured_at?: string;
          configured_by: string;
          historical_position_retention_days: number;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          configured_at?: string;
          configured_by?: string;
          historical_position_retention_days?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gps_telemetry_retention_policies_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gps_telemetry_retention_policies_configured_by_fk";
            columns: ["company_id", "configured_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      incidents: {
        Row: {
          action_taken: string | null;
          company_id: string;
          created_at: string;
          created_by: string;
          description: string;
          driver_id: string | null;
          estimated_cost: number | null;
          file_id: string | null;
          id: string;
          idempotency_key: string | null;
          incident_type: string;
          location: string | null;
          occurred_at: string;
          severity: Database["public"]["Enums"]["incident_severity"];
          source_device_id: string | null;
          status: Database["public"]["Enums"]["incident_status"];
          trip_id: string | null;
          updated_at: string;
          vehicle_id: string | null;
        };
        Insert: {
          action_taken?: string | null;
          company_id: string;
          created_at?: string;
          created_by: string;
          description: string;
          driver_id?: string | null;
          estimated_cost?: number | null;
          file_id?: string | null;
          id?: string;
          idempotency_key?: string | null;
          incident_type: string;
          location?: string | null;
          occurred_at: string;
          severity: Database["public"]["Enums"]["incident_severity"];
          source_device_id?: string | null;
          status?: Database["public"]["Enums"]["incident_status"];
          trip_id?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          action_taken?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string;
          driver_id?: string | null;
          estimated_cost?: number | null;
          file_id?: string | null;
          id?: string;
          idempotency_key?: string | null;
          incident_type?: string;
          location?: string | null;
          occurred_at?: string;
          severity?: Database["public"]["Enums"]["incident_severity"];
          source_device_id?: string | null;
          status?: Database["public"]["Enums"]["incident_status"];
          trip_id?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "incidents_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "incidents_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "incidents_driver_fk";
            columns: ["company_id", "driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "incidents_file_fk";
            columns: ["company_id", "file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "incidents_trip_fk";
            columns: ["company_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "incidents_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      invoices: {
        Row: {
          client_id: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          due_on: string | null;
          file_id: string | null;
          id: string;
          issued_on: string;
          notes: string | null;
          number: string;
          series: string;
          status: Database["public"]["Enums"]["invoice_status"];
          subtotal: number;
          tax: number;
          total: number;
          trip_id: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          company_id: string;
          created_at?: string;
          created_by: string;
          currency?: string;
          due_on?: string | null;
          file_id?: string | null;
          id?: string;
          issued_on: string;
          notes?: string | null;
          number: string;
          series: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          subtotal: number;
          tax?: number;
          total: number;
          trip_id: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          due_on?: string | null;
          file_id?: string | null;
          id?: string;
          issued_on?: string;
          notes?: string | null;
          number?: string;
          series?: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          subtotal?: number;
          tax?: number;
          total?: number;
          trip_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "invoices_client_fk";
            columns: ["company_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "invoices_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_file_fk";
            columns: ["company_id", "file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "invoices_trip_fk";
            columns: ["company_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      loads: {
        Row: {
          cargo_type: string | null;
          company_id: string;
          created_at: string;
          description: string;
          id: string;
          notes: string | null;
          package_count: number | null;
          tons: number | null;
          trip_id: string;
          updated_at: string;
        };
        Insert: {
          cargo_type?: string | null;
          company_id: string;
          created_at?: string;
          description: string;
          id?: string;
          notes?: string | null;
          package_count?: number | null;
          tons?: number | null;
          trip_id: string;
          updated_at?: string;
        };
        Update: {
          cargo_type?: string | null;
          company_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          notes?: string | null;
          package_count?: number | null;
          tons?: number | null;
          trip_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loads_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loads_trip_fk";
            columns: ["company_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      maintenance_plans: {
        Row: {
          active: boolean;
          company_id: string;
          created_at: string;
          description: string | null;
          frequency_days: number | null;
          frequency_km: number | null;
          id: string;
          last_date: string | null;
          last_odometer_km: number | null;
          maintenance_type: string;
          name: string;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          active?: boolean;
          company_id: string;
          created_at?: string;
          description?: string | null;
          frequency_days?: number | null;
          frequency_km?: number | null;
          id?: string;
          last_date?: string | null;
          last_odometer_km?: number | null;
          maintenance_type: string;
          name: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          active?: boolean;
          company_id?: string;
          created_at?: string;
          description?: string | null;
          frequency_days?: number | null;
          frequency_km?: number | null;
          id?: string;
          last_date?: string | null;
          last_odometer_km?: number | null;
          maintenance_type?: string;
          name?: string;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_plans_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      odometer_entries: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          idempotency_key: string | null;
          reading_at: string;
          reading_km: number;
          reading_type: string;
          recorded_by: string;
          source: string;
          source_device_id: string | null;
          trip_id: string | null;
          vehicle_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          idempotency_key?: string | null;
          reading_at: string;
          reading_km: number;
          reading_type: string;
          recorded_by: string;
          source: string;
          source_device_id?: string | null;
          trip_id?: string | null;
          vehicle_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          idempotency_key?: string | null;
          reading_at?: string;
          reading_km?: number;
          reading_type?: string;
          recorded_by?: string;
          source?: string;
          source_device_id?: string | null;
          trip_id?: string | null;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "odometer_actor_fk";
            columns: ["company_id", "recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "odometer_entries_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "odometer_trip_fk";
            columns: ["company_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "odometer_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      operational_cycles: {
        Row: {
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          ended_at: string | null;
          id: string;
          idempotency_key: string | null;
          notes: string | null;
          primary_driver_id: string | null;
          return_status: Database["public"]["Enums"]["return_status"];
          started_at: string | null;
          status: Database["public"]["Enums"]["operational_cycle_status"];
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        Insert: {
          code: string;
          company_id: string;
          created_at?: string;
          created_by: string;
          ended_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          notes?: string | null;
          primary_driver_id?: string | null;
          return_status?: Database["public"]["Enums"]["return_status"];
          started_at?: string | null;
          status?: Database["public"]["Enums"]["operational_cycle_status"];
          updated_at?: string;
          vehicle_id?: string | null;
          version?: number;
        };
        Update: {
          code?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          ended_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          notes?: string | null;
          primary_driver_id?: string | null;
          return_status?: Database["public"]["Enums"]["return_status"];
          started_at?: string | null;
          status?: Database["public"]["Enums"]["operational_cycle_status"];
          updated_at?: string;
          vehicle_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cycles_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "cycles_driver_fk";
            columns: ["company_id", "primary_driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "cycles_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "operational_cycles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      parts: {
        Row: {
          active: boolean;
          brand: string | null;
          category: string | null;
          company_id: string;
          created_at: string;
          id: string;
          internal_code: string | null;
          name: string;
          unit: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          brand?: string | null;
          category?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          internal_code?: string | null;
          name: string;
          unit: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          brand?: string | null;
          category?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          internal_code?: string | null;
          name?: string;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          client_id: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          file_id: string | null;
          id: string;
          idempotency_key: string;
          invoice_id: string;
          notes: string | null;
          paid_at: string;
          payment_method: string;
          reference: string | null;
        };
        Insert: {
          amount: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          client_id: string;
          company_id: string;
          created_at?: string;
          created_by: string;
          currency?: string;
          file_id?: string | null;
          id?: string;
          idempotency_key: string;
          invoice_id: string;
          notes?: string | null;
          paid_at: string;
          payment_method: string;
          reference?: string | null;
        };
        Update: {
          amount?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          client_id?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          file_id?: string | null;
          id?: string;
          idempotency_key?: string;
          invoice_id?: string;
          notes?: string | null;
          paid_at?: string;
          payment_method?: string;
          reference?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "payments_client_fk";
            columns: ["company_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "payments_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_file_fk";
            columns: ["company_id", "file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "payments_invoice_fk";
            columns: ["company_id", "invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      profiles: {
        Row: {
          active: boolean;
          company_id: string;
          created_at: string;
          display_name: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          company_id: string;
          created_at?: string;
          display_name: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          company_id?: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      routes: {
        Row: {
          active: boolean;
          company_id: string;
          created_at: string;
          destination: string;
          id: string;
          name: string;
          notes: string | null;
          origin: string;
          reference_distance_km: number | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          company_id: string;
          created_at?: string;
          destination: string;
          id?: string;
          name: string;
          notes?: string | null;
          origin: string;
          reference_distance_km?: number | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          company_id?: string;
          created_at?: string;
          destination?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          origin?: string;
          reference_distance_km?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "routes_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      settlement_expenses: {
        Row: {
          company_id: string;
          expense_id: string;
          included_at: string;
          included_by: string;
          settlement_id: string;
        };
        Insert: {
          company_id: string;
          expense_id: string;
          included_at?: string;
          included_by: string;
          settlement_id: string;
        };
        Update: {
          company_id?: string;
          expense_id?: string;
          included_at?: string;
          included_by?: string;
          settlement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_expenses_actor_fk";
            columns: ["company_id", "included_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "settlement_expenses_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_expenses_expense_fk";
            columns: ["company_id", "expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "settlement_expenses_settlement_fk";
            columns: ["company_id", "settlement_id"];
            isOneToOne: false;
            referencedRelation: "settlements";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      settlements: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          balance: number;
          closed_at: string | null;
          company_id: string;
          created_at: string;
          driver_id: string;
          id: string;
          notes: string | null;
          resolution_direction: string | null;
          resolution_method: string | null;
          resolution_note: string | null;
          resolution_reference: string | null;
          resolved_amount: number | null;
          resolved_at: string | null;
          resolved_by: string | null;
          started_at: string;
          status: Database["public"]["Enums"]["settlement_status"];
          submitted_at: string | null;
          total_advances: number;
          total_expenses: number;
          trip_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          balance?: number;
          closed_at?: string | null;
          company_id: string;
          created_at?: string;
          driver_id: string;
          id?: string;
          notes?: string | null;
          resolution_direction?: string | null;
          resolution_method?: string | null;
          resolution_note?: string | null;
          resolution_reference?: string | null;
          resolved_amount?: number | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["settlement_status"];
          submitted_at?: string | null;
          total_advances?: number;
          total_expenses?: number;
          trip_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          balance?: number;
          closed_at?: string | null;
          company_id?: string;
          created_at?: string;
          driver_id?: string;
          id?: string;
          notes?: string | null;
          resolution_direction?: string | null;
          resolution_method?: string | null;
          resolution_note?: string | null;
          resolution_reference?: string | null;
          resolved_amount?: number | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["settlement_status"];
          submitted_at?: string | null;
          total_advances?: number;
          total_expenses?: number;
          trip_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_approver_fk";
            columns: ["company_id", "approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "settlements_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_driver_fk";
            columns: ["company_id", "driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "settlements_resolver_fk";
            columns: ["company_id", "resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "settlements_trip_fk";
            columns: ["company_id", "trip_id"];
            isOneToOne: true;
            referencedRelation: "trips";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      spike_records: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          updated_at?: string;
          value: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          active: boolean;
          address: string | null;
          company_id: string;
          created_at: string;
          id: string;
          legal_name: string;
          notes: string | null;
          phone: string | null;
          supplier_type: string;
          tax_id: string | null;
          trade_name: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          legal_name: string;
          notes?: string | null;
          phone?: string | null;
          supplier_type: string;
          tax_id?: string | null;
          trade_name?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          legal_name?: string;
          notes?: string | null;
          phone?: string | null;
          supplier_type?: string;
          tax_id?: string | null;
          trade_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_evaluation_exceptions: {
        Row: {
          approval_reason: string | null;
          approved_at: string | null;
          approved_by: string | null;
          company_id: string;
          evaluation_id: string;
          id: string;
          input_snapshot: Json;
          policy_snapshot: Json;
          requested_at: string;
          requested_by: string;
          result_snapshot: Json;
          status: Database["public"]["Enums"]["trip_evaluation_exception_status"];
        };
        Insert: {
          approval_reason?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          company_id: string;
          evaluation_id: string;
          id?: string;
          input_snapshot: Json;
          policy_snapshot: Json;
          requested_at?: string;
          requested_by: string;
          result_snapshot: Json;
          status?: Database["public"]["Enums"]["trip_evaluation_exception_status"];
        };
        Update: {
          approval_reason?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          company_id?: string;
          evaluation_id?: string;
          id?: string;
          input_snapshot?: Json;
          policy_snapshot?: Json;
          requested_at?: string;
          requested_by?: string;
          result_snapshot?: Json;
          status?: Database["public"]["Enums"]["trip_evaluation_exception_status"];
        };
        Relationships: [
          {
            foreignKeyName: "trip_evaluation_exceptions_approved_by_fk";
            columns: ["company_id", "approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trip_evaluation_exceptions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_evaluation_exceptions_evaluation_fk";
            columns: ["company_id", "evaluation_id"];
            isOneToOne: true;
            referencedRelation: "trip_evaluations";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trip_evaluation_exceptions_requested_by_fk";
            columns: ["company_id", "requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      trip_evaluation_policies: {
        Row: {
          active: boolean;
          company_id: string;
          cost_coverage: Json;
          created_at: string;
          created_by: string;
          currency: string;
          effective_from: string;
          effective_to: string | null;
          id: string;
          margin_basis: Database["public"]["Enums"]["trip_evaluation_margin_basis"];
          minimum_margin_rate: number;
          name: string;
          policy_key: string;
          target_margin_rate: number;
          tax_basis: Database["public"]["Enums"]["trip_evaluation_tax_basis"];
          tax_rate: number;
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          company_id: string;
          cost_coverage: Json;
          created_at?: string;
          created_by: string;
          currency: string;
          effective_from: string;
          effective_to?: string | null;
          id?: string;
          margin_basis: Database["public"]["Enums"]["trip_evaluation_margin_basis"];
          minimum_margin_rate: number;
          name: string;
          policy_key: string;
          target_margin_rate: number;
          tax_basis: Database["public"]["Enums"]["trip_evaluation_tax_basis"];
          tax_rate: number;
          updated_at?: string;
          version: number;
        };
        Update: {
          active?: boolean;
          company_id?: string;
          cost_coverage?: Json;
          created_at?: string;
          created_by?: string;
          currency?: string;
          effective_from?: string;
          effective_to?: string | null;
          id?: string;
          margin_basis?: Database["public"]["Enums"]["trip_evaluation_margin_basis"];
          minimum_margin_rate?: number;
          name?: string;
          policy_key?: string;
          target_margin_rate?: number;
          tax_basis?: Database["public"]["Enums"]["trip_evaluation_tax_basis"];
          tax_rate?: number;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "trip_evaluation_policies_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trip_evaluation_policies_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_evaluations: {
        Row: {
          client_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          fixed_at: string | null;
          fixed_by: string | null;
          id: string;
          idempotency_key: string | null;
          input_snapshot: Json;
          policy_id: string;
          policy_snapshot: Json;
          policy_version: number;
          reference: string | null;
          result_snapshot: Json;
          status: Database["public"]["Enums"]["trip_evaluation_status"];
          supersedes_evaluation_id: string | null;
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        Insert: {
          client_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by: string;
          currency: string;
          fixed_at?: string | null;
          fixed_by?: string | null;
          id?: string;
          idempotency_key?: string | null;
          input_snapshot: Json;
          policy_id: string;
          policy_snapshot: Json;
          policy_version: number;
          reference?: string | null;
          result_snapshot: Json;
          status?: Database["public"]["Enums"]["trip_evaluation_status"];
          supersedes_evaluation_id?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
          version?: number;
        };
        Update: {
          client_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          fixed_at?: string | null;
          fixed_by?: string | null;
          id?: string;
          idempotency_key?: string | null;
          input_snapshot?: Json;
          policy_id?: string;
          policy_snapshot?: Json;
          policy_version?: number;
          reference?: string | null;
          result_snapshot?: Json;
          status?: Database["public"]["Enums"]["trip_evaluation_status"];
          supersedes_evaluation_id?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "trip_evaluations_client_fk";
            columns: ["company_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trip_evaluations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_evaluations_created_by_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trip_evaluations_fixed_by_fk";
            columns: ["company_id", "fixed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trip_evaluations_policy_fk";
            columns: ["company_id", "policy_id"];
            isOneToOne: false;
            referencedRelation: "trip_evaluation_policies";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trip_evaluations_supersedes_fk";
            columns: ["company_id", "supersedes_evaluation_id"];
            isOneToOne: false;
            referencedRelation: "trip_evaluations";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trip_evaluations_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      trip_status_events: {
        Row: {
          actor_id: string;
          company_id: string;
          dimension: string;
          id: string;
          new_status: string;
          notes: string | null;
          occurred_at: string;
          previous_status: string | null;
          reason: string | null;
          trip_id: string;
        };
        Insert: {
          actor_id: string;
          company_id: string;
          dimension: string;
          id?: string;
          new_status: string;
          notes?: string | null;
          occurred_at?: string;
          previous_status?: string | null;
          reason?: string | null;
          trip_id: string;
        };
        Update: {
          actor_id?: string;
          company_id?: string;
          dimension?: string;
          id?: string;
          new_status?: string;
          notes?: string | null;
          occurred_at?: string;
          previous_status?: string | null;
          reason?: string | null;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_events_actor_fk";
            columns: ["company_id", "actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trip_events_trip_fk";
            columns: ["company_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trip_status_events_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_transition_requests: {
        Row: {
          actor_id: string;
          applied_at: string;
          cargo_delivered: boolean;
          company_id: string;
          created_at: string;
          id: string;
          occurred_at: string;
          odometer_km: number | null;
          requested_action: string;
          source_device_id: string | null;
          trip_id: string;
        };
        Insert: {
          actor_id: string;
          applied_at?: string;
          cargo_delivered?: boolean;
          company_id: string;
          created_at?: string;
          id: string;
          occurred_at: string;
          odometer_km?: number | null;
          requested_action: string;
          source_device_id?: string | null;
          trip_id: string;
        };
        Update: {
          actor_id?: string;
          applied_at?: string;
          cargo_delivered?: boolean;
          company_id?: string;
          created_at?: string;
          id?: string;
          occurred_at?: string;
          odometer_km?: number | null;
          requested_action?: string;
          source_device_id?: string | null;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transition_requests_actor_fk";
            columns: ["company_id", "actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "transition_requests_trip_fk";
            columns: ["company_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trip_transition_requests_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      trips: {
        Row: {
          additional_amount: number;
          administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
          client_id: string;
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          cycle_id: string | null;
          cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
          cycle_sequence: number | null;
          destination: string;
          driver_id: string | null;
          financial_status: Database["public"]["Enums"]["trip_financial_status"];
          financially_closed_at: string | null;
          freight_amount: number;
          freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
          freight_rate_per_ton: number | null;
          id: string;
          notes: string | null;
          operational_finished_at: string | null;
          operational_status: Database["public"]["Enums"]["trip_operational_status"];
          origin: string;
          route_id: string | null;
          scheduled_at: string;
          started_at: string | null;
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        Insert: {
          additional_amount?: number;
          administrative_status?: Database["public"]["Enums"]["trip_administrative_status"];
          client_id: string;
          code: string;
          company_id: string;
          created_at?: string;
          created_by: string;
          currency?: string;
          cycle_id?: string | null;
          cycle_leg_kind?: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
          cycle_sequence?: number | null;
          destination: string;
          driver_id?: string | null;
          financial_status?: Database["public"]["Enums"]["trip_financial_status"];
          financially_closed_at?: string | null;
          freight_amount?: number;
          freight_pricing_mode?: Database["public"]["Enums"]["freight_pricing_mode"];
          freight_rate_per_ton?: number | null;
          id?: string;
          notes?: string | null;
          operational_finished_at?: string | null;
          operational_status?: Database["public"]["Enums"]["trip_operational_status"];
          origin: string;
          route_id?: string | null;
          scheduled_at: string;
          started_at?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
          version?: number;
        };
        Update: {
          additional_amount?: number;
          administrative_status?: Database["public"]["Enums"]["trip_administrative_status"];
          client_id?: string;
          code?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          cycle_id?: string | null;
          cycle_leg_kind?: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
          cycle_sequence?: number | null;
          destination?: string;
          driver_id?: string | null;
          financial_status?: Database["public"]["Enums"]["trip_financial_status"];
          financially_closed_at?: string | null;
          freight_amount?: number;
          freight_pricing_mode?: Database["public"]["Enums"]["freight_pricing_mode"];
          freight_rate_per_ton?: number | null;
          id?: string;
          notes?: string | null;
          operational_finished_at?: string | null;
          operational_status?: Database["public"]["Enums"]["trip_operational_status"];
          origin?: string;
          route_id?: string | null;
          scheduled_at?: string;
          started_at?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "trips_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trips_client_fk";
            columns: ["company_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trips_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_cycle_fk";
            columns: ["company_id", "cycle_id"];
            isOneToOne: false;
            referencedRelation: "operational_cycles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trips_driver_fk";
            columns: ["company_id", "driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trips_route_fk";
            columns: ["company_id", "route_id"];
            isOneToOne: false;
            referencedRelation: "routes";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "trips_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      vehicle_latest_positions: {
        Row: {
          altitude_meters: number | null;
          company_id: string;
          external_asset_id: string;
          heading_degrees: number | null;
          id: string;
          ignition: boolean | null;
          latitude: number;
          longitude: number;
          odometer_km: number | null;
          position_id: string;
          provider_kind: string;
          received_at: string;
          recorded_at: string;
          speed_kmh: number | null;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          altitude_meters?: number | null;
          company_id: string;
          external_asset_id: string;
          heading_degrees?: number | null;
          id?: string;
          ignition?: boolean | null;
          latitude: number;
          longitude: number;
          odometer_km?: number | null;
          position_id: string;
          provider_kind: string;
          received_at: string;
          recorded_at: string;
          speed_kmh?: number | null;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          altitude_meters?: number | null;
          company_id?: string;
          external_asset_id?: string;
          heading_degrees?: number | null;
          id?: string;
          ignition?: boolean | null;
          latitude?: number;
          longitude?: number;
          odometer_km?: number | null;
          position_id?: string;
          provider_kind?: string;
          received_at?: string;
          recorded_at?: string;
          speed_kmh?: number | null;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_latest_positions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_latest_positions_position_fk";
            columns: ["company_id", "position_id"];
            isOneToOne: false;
            referencedRelation: "gps_positions";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "vehicle_latest_positions_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: true;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      vehicle_status_history: {
        Row: {
          company_id: string;
          ended_at: string | null;
          id: string;
          reason: string | null;
          recorded_by: string;
          started_at: string;
          status: Database["public"]["Enums"]["vehicle_status"];
          vehicle_id: string;
        };
        Insert: {
          company_id: string;
          ended_at?: string | null;
          id?: string;
          reason?: string | null;
          recorded_by: string;
          started_at?: string;
          status: Database["public"]["Enums"]["vehicle_status"];
          vehicle_id: string;
        };
        Update: {
          company_id?: string;
          ended_at?: string | null;
          id?: string;
          reason?: string | null;
          recorded_by?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["vehicle_status"];
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_status_actor_fk";
            columns: ["company_id", "recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "vehicle_status_history_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_status_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      vehicles: {
        Row: {
          active: boolean;
          capacity_tons: number | null;
          company_id: string;
          created_at: string;
          current_odometer_km: number;
          current_status: Database["public"]["Enums"]["vehicle_status"];
          id: string;
          make: string | null;
          model: string | null;
          model_year: number | null;
          notes: string | null;
          owner_name: string | null;
          ownership_type: Database["public"]["Enums"]["vehicle_ownership_type"] | null;
          plate: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          capacity_tons?: number | null;
          company_id: string;
          created_at?: string;
          current_odometer_km?: number;
          current_status?: Database["public"]["Enums"]["vehicle_status"];
          id?: string;
          make?: string | null;
          model?: string | null;
          model_year?: number | null;
          notes?: string | null;
          owner_name?: string | null;
          ownership_type?: Database["public"]["Enums"]["vehicle_ownership_type"] | null;
          plate: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          capacity_tons?: number | null;
          company_id?: string;
          created_at?: string;
          current_odometer_km?: number;
          current_status?: Database["public"]["Enums"]["vehicle_status"];
          id?: string;
          make?: string | null;
          model?: string | null;
          model_year?: number | null;
          notes?: string | null;
          owner_name?: string | null;
          ownership_type?: Database["public"]["Enums"]["vehicle_ownership_type"] | null;
          plate?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      work_order_evidence: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string;
          file_id: string;
          id: string;
          idempotency_key: string;
          notes: string | null;
          work_order_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          created_by: string;
          file_id: string;
          id?: string;
          idempotency_key: string;
          notes?: string | null;
          work_order_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string;
          file_id?: string;
          id?: string;
          idempotency_key?: string;
          notes?: string | null;
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_order_evidence_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "work_order_evidence_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_order_evidence_file_fk";
            columns: ["company_id", "file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "work_order_evidence_order_fk";
            columns: ["company_id", "work_order_id"];
            isOneToOne: false;
            referencedRelation: "work_orders";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      work_order_parts: {
        Row: {
          company_id: string;
          id: string;
          idempotency_key: string | null;
          installation_odometer_km: number | null;
          installed_at: string | null;
          notes: string | null;
          part_id: string;
          quantity: number;
          supplier_id: string | null;
          unit_cost: number;
          work_order_id: string;
        };
        Insert: {
          company_id: string;
          id?: string;
          idempotency_key?: string | null;
          installation_odometer_km?: number | null;
          installed_at?: string | null;
          notes?: string | null;
          part_id: string;
          quantity: number;
          supplier_id?: string | null;
          unit_cost: number;
          work_order_id: string;
        };
        Update: {
          company_id?: string;
          id?: string;
          idempotency_key?: string | null;
          installation_odometer_km?: number | null;
          installed_at?: string | null;
          notes?: string | null;
          part_id?: string;
          quantity?: number;
          supplier_id?: string | null;
          unit_cost?: number;
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_order_parts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_order_parts_order_fk";
            columns: ["company_id", "work_order_id"];
            isOneToOne: false;
            referencedRelation: "work_orders";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "work_order_parts_part_fk";
            columns: ["company_id", "part_id"];
            isOneToOne: false;
            referencedRelation: "parts";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "work_order_parts_supplier_fk";
            columns: ["company_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      work_orders: {
        Row: {
          admitted_at: string | null;
          blocks_operation: boolean;
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          diagnosis: string | null;
          finished_at: string | null;
          id: string;
          idempotency_key: string | null;
          labor_cost: number;
          maintenance_type: string;
          notes: string | null;
          odometer_km: number | null;
          parts_cost: number;
          reported_problem: string | null;
          source: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["work_order_status"];
          supplier_id: string | null;
          updated_at: string;
          vehicle_id: string;
          work_performed: string | null;
        };
        Insert: {
          admitted_at?: string | null;
          blocks_operation?: boolean;
          code: string;
          company_id: string;
          created_at?: string;
          created_by: string;
          diagnosis?: string | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          labor_cost?: number;
          maintenance_type: string;
          notes?: string | null;
          odometer_km?: number | null;
          parts_cost?: number;
          reported_problem?: string | null;
          source: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["work_order_status"];
          supplier_id?: string | null;
          updated_at?: string;
          vehicle_id: string;
          work_performed?: string | null;
        };
        Update: {
          admitted_at?: string | null;
          blocks_operation?: boolean;
          code?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          diagnosis?: string | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          labor_cost?: number;
          maintenance_type?: string;
          notes?: string | null;
          odometer_km?: number | null;
          parts_cost?: number;
          reported_problem?: string | null;
          source?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["work_order_status"];
          supplier_id?: string | null;
          updated_at?: string;
          vehicle_id?: string;
          work_performed?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "work_orders_actor_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "work_orders_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_supplier_fk";
            columns: ["company_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "work_orders_vehicle_fk";
            columns: ["company_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
    };
    Views: {
      vehicle_gps_context: {
        Row: {
          ignition: boolean | null;
          odometer_km: number | null;
          provider_kind: string | null;
          received_at: string | null;
          recorded_at: string | null;
          speed_kmh: number | null;
          vehicle_id: string | null;
        };
        Relationships: [];
      };
      vehicle_gps_odometer_candidate: {
        Row: {
          authority_status: Database["public"]["Enums"]["gps_odometer_authority_status"] | null;
          current_odometer_km: number | null;
          odometer_km: number | null;
          position_id: string | null;
          provider_kind: string | null;
          received_at: string | null;
          recorded_at: string | null;
          vehicle_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      activate_gps_odometer_authority: {
        Args: {
          p_bootstrap_mode: Database["public"]["Enums"]["gps_odometer_bootstrap_mode"];
          p_expected_current_odometer_km: number;
          p_idempotency_key: string;
          p_position_id: string;
          p_provider_link_id: string;
          p_reason: string;
        };
        Returns: {
          authority_id: string;
          authorized_by: string;
          bootstrap_mode: Database["public"]["Enums"]["gps_odometer_bootstrap_mode"] | null;
          company_id: string;
          created_at: string;
          id: string;
          odometer_entry_id: string | null;
          outcome: Database["public"]["Enums"]["gps_odometer_promotion_outcome"];
          previous_odometer_km: number;
          promotion_kind: Database["public"]["Enums"]["gps_odometer_promotion_kind"];
          reason: string;
          reported_odometer_km: number;
          resulting_odometer_km: number;
          source_kind: Database["public"]["Enums"]["gps_position_source_kind"];
          source_odometer_semantic: Database["public"]["Enums"]["gps_odometer_source_semantic"];
          source_position_id: string;
          source_received_at: string;
          source_recorded_at: string;
          sync_run_id: string | null;
          vehicle_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "gps_odometer_promotions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      add_trip_to_operational_cycle: {
        Args: {
          p_cycle_id: string;
          p_expected_cycle_version: number;
          p_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"];
          p_trip_id: string;
        };
        Returns: {
          additional_amount: number;
          administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
          client_id: string;
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          cycle_id: string | null;
          cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
          cycle_sequence: number | null;
          destination: string;
          driver_id: string | null;
          financial_status: Database["public"]["Enums"]["trip_financial_status"];
          financially_closed_at: string | null;
          freight_amount: number;
          freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
          freight_rate_per_ton: number | null;
          id: string;
          notes: string | null;
          operational_finished_at: string | null;
          operational_status: Database["public"]["Enums"]["trip_operational_status"];
          origin: string;
          route_id: string | null;
          scheduled_at: string;
          started_at: string | null;
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "trips";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      apply_driver_trip_transition: {
        Args: {
          p_action: string;
          p_cargo_delivered: boolean;
          p_occurred_at: string;
          p_odometer_km: number;
          p_request_id: string;
          p_source_device_id: string;
          p_trip_id: string;
        };
        Returns: {
          additional_amount: number;
          administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
          client_id: string;
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          cycle_id: string | null;
          cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
          cycle_sequence: number | null;
          destination: string;
          driver_id: string | null;
          financial_status: Database["public"]["Enums"]["trip_financial_status"];
          financially_closed_at: string | null;
          freight_amount: number;
          freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
          freight_rate_per_ton: number | null;
          id: string;
          notes: string | null;
          operational_finished_at: string | null;
          operational_status: Database["public"]["Enums"]["trip_operational_status"];
          origin: string;
          route_id: string | null;
          scheduled_at: string;
          started_at: string | null;
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "trips";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      approve_trip: {
        Args: { trip_id: string };
        Returns: {
          additional_amount: number;
          administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
          client_id: string;
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          cycle_id: string | null;
          cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
          cycle_sequence: number | null;
          destination: string;
          driver_id: string | null;
          financial_status: Database["public"]["Enums"]["trip_financial_status"];
          financially_closed_at: string | null;
          freight_amount: number;
          freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
          freight_rate_per_ton: number | null;
          id: string;
          notes: string | null;
          operational_finished_at: string | null;
          operational_status: Database["public"]["Enums"]["trip_operational_status"];
          origin: string;
          route_id: string | null;
          scheduled_at: string;
          started_at: string | null;
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "trips";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      approve_trip_evaluation_exception: {
        Args: { exception_id: string; reason: string };
        Returns: {
          approval_reason: string | null;
          approved_at: string | null;
          approved_by: string | null;
          company_id: string;
          evaluation_id: string;
          id: string;
          input_snapshot: Json;
          policy_snapshot: Json;
          requested_at: string;
          requested_by: string;
          result_snapshot: Json;
          status: Database["public"]["Enums"]["trip_evaluation_exception_status"];
        };
        SetofOptions: {
          from: "*";
          to: "trip_evaluation_exceptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      attach_document_file: {
        Args: {
          p_document_id: string;
          p_expected_updated_at: string;
          p_file_id: string;
        };
        Returns: {
          blocks_operation: boolean;
          client_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string;
          document_number: string | null;
          document_type: string;
          driver_id: string | null;
          entity_type: string;
          expires_on: string | null;
          file_id: string | null;
          id: string;
          issued_on: string | null;
          notes: string | null;
          status: Database["public"]["Enums"]["document_status"];
          trip_id: string | null;
          updated_at: string;
          vehicle_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      attach_trip_file: {
        Args: { p_entity_id: string; p_entity_type: string; p_file_id: string };
        Returns: string;
      };
      attach_work_order_evidence: {
        Args: {
          p_file_id: string;
          p_id: string;
          p_idempotency_key: string;
          p_notes: string;
          p_work_order_id: string;
        };
        Returns: {
          company_id: string;
          created_at: string;
          created_by: string;
          file_id: string;
          id: string;
          idempotency_key: string;
          notes: string | null;
          work_order_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "work_order_evidence";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      begin_gps_sync_run: {
        Args: {
          p_company_id: string;
          p_initiated_by: string;
          p_lease_seconds: number;
          p_max_duration_seconds: number;
          p_provider_kind: string;
          p_request_id: string;
        };
        Returns: {
          assets_seen: number;
          company_id: string;
          deadline_at: string | null;
          error_code: string | null;
          error_message: string | null;
          finished_at: string | null;
          heartbeat_at: string | null;
          id: string;
          initiated_by: string | null;
          lease_expires_at: string | null;
          positions_deduplicated: number;
          positions_persisted: number;
          positions_received: number;
          positions_unlinked: number;
          provider_checkpoint_at: string | null;
          provider_kind: string;
          request_id: string | null;
          source_attempts: number;
          started_at: string;
          status: Database["public"]["Enums"]["gps_sync_run_status"];
          trigger_kind: string;
        };
        SetofOptions: {
          from: "*";
          to: "gps_sync_runs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      close_settlement:
        | {
            Args: { p_expected_version: number; p_settlement_id: string };
            Returns: {
              approved_at: string | null;
              approved_by: string | null;
              balance: number;
              closed_at: string | null;
              company_id: string;
              created_at: string;
              driver_id: string;
              id: string;
              notes: string | null;
              resolution_direction: string | null;
              resolution_method: string | null;
              resolution_note: string | null;
              resolution_reference: string | null;
              resolved_amount: number | null;
              resolved_at: string | null;
              resolved_by: string | null;
              started_at: string;
              status: Database["public"]["Enums"]["settlement_status"];
              submitted_at: string | null;
              total_advances: number;
              total_expenses: number;
              trip_id: string;
              updated_at: string;
              version: number;
            };
            SetofOptions: {
              from: "*";
              to: "settlements";
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: {
              resolution_method: string;
              resolution_note: string;
              resolution_reference: string;
              settlement_id: string;
            };
            Returns: {
              approved_at: string | null;
              approved_by: string | null;
              balance: number;
              closed_at: string | null;
              company_id: string;
              created_at: string;
              driver_id: string;
              id: string;
              notes: string | null;
              resolution_direction: string | null;
              resolution_method: string | null;
              resolution_note: string | null;
              resolution_reference: string | null;
              resolved_amount: number | null;
              resolved_at: string | null;
              resolved_by: string | null;
              started_at: string;
              status: Database["public"]["Enums"]["settlement_status"];
              submitted_at: string | null;
              total_advances: number;
              total_expenses: number;
              trip_id: string;
              updated_at: string;
              version: number;
            };
            SetofOptions: {
              from: "*";
              to: "settlements";
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      complete_trip:
        | {
            Args: {
              p_cargo_delivered: boolean;
              p_expected_version: number;
              p_idempotency_key: string;
              p_odometer_km: number;
              p_trip_id: string;
            };
            Returns: {
              additional_amount: number;
              administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
              client_id: string;
              code: string;
              company_id: string;
              created_at: string;
              created_by: string;
              currency: string;
              cycle_id: string | null;
              cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
              cycle_sequence: number | null;
              destination: string;
              driver_id: string | null;
              financial_status: Database["public"]["Enums"]["trip_financial_status"];
              financially_closed_at: string | null;
              freight_amount: number;
              freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
              freight_rate_per_ton: number | null;
              id: string;
              notes: string | null;
              operational_finished_at: string | null;
              operational_status: Database["public"]["Enums"]["trip_operational_status"];
              origin: string;
              route_id: string | null;
              scheduled_at: string;
              started_at: string | null;
              updated_at: string;
              vehicle_id: string | null;
              version: number;
            };
            SetofOptions: {
              from: "*";
              to: "trips";
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: {
              cargo_delivered: boolean;
              final_mileage: number;
              trip_id: string;
            };
            Returns: {
              additional_amount: number;
              administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
              client_id: string;
              code: string;
              company_id: string;
              created_at: string;
              created_by: string;
              currency: string;
              cycle_id: string | null;
              cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
              cycle_sequence: number | null;
              destination: string;
              driver_id: string | null;
              financial_status: Database["public"]["Enums"]["trip_financial_status"];
              financially_closed_at: string | null;
              freight_amount: number;
              freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
              freight_rate_per_ton: number | null;
              id: string;
              notes: string | null;
              operational_finished_at: string | null;
              operational_status: Database["public"]["Enums"]["trip_operational_status"];
              origin: string;
              route_id: string | null;
              scheduled_at: string;
              started_at: string | null;
              updated_at: string;
              vehicle_id: string | null;
              version: number;
            };
            SetofOptions: {
              from: "*";
              to: "trips";
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      complete_work_order: {
        Args: {
          final_mileage: number;
          labour_cost: number;
          parts_cost: number;
          work_order_id: string;
        };
        Returns: {
          admitted_at: string | null;
          blocks_operation: boolean;
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          diagnosis: string | null;
          finished_at: string | null;
          id: string;
          idempotency_key: string | null;
          labor_cost: number;
          maintenance_type: string;
          notes: string | null;
          odometer_km: number | null;
          parts_cost: number;
          reported_problem: string | null;
          source: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["work_order_status"];
          supplier_id: string | null;
          updated_at: string;
          vehicle_id: string;
          work_performed: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "work_orders";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      configure_gps_odometer_plausibility_policy: {
        Args: {
          p_idempotency_key: string;
          p_max_auto_advance_km: number;
          p_max_average_speed_kmh: number;
          p_reason: string;
        };
        Returns: {
          company_id: string;
          configured_at: string;
          configured_by: string;
          max_auto_advance_km: number;
          max_average_speed_kmh: number;
          reason: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "gps_odometer_plausibility_policies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      configure_gps_telemetry_retention: {
        Args: { p_historical_position_retention_days: number };
        Returns: {
          company_id: string;
          configured_at: string;
          configured_by: string;
          historical_position_retention_days: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "gps_telemetry_retention_policies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_operational_cycle: {
        Args: {
          p_code: string;
          p_id: string;
          p_idempotency_key: string;
          p_notes: string;
          p_primary_driver_id: string;
          p_return_status: Database["public"]["Enums"]["return_status"];
          p_vehicle_id: string;
        };
        Returns: {
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          ended_at: string | null;
          id: string;
          idempotency_key: string | null;
          notes: string | null;
          primary_driver_id: string | null;
          return_status: Database["public"]["Enums"]["return_status"];
          started_at: string | null;
          status: Database["public"]["Enums"]["operational_cycle_status"];
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "operational_cycles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_supplier: {
        Args: {
          p_address: string;
          p_legal_name: string;
          p_notes: string;
          p_phone: string;
          p_supplier_type: string;
          p_tax_id: string;
          p_trade_name: string;
        };
        Returns: {
          active: boolean;
          address: string | null;
          company_id: string;
          created_at: string;
          id: string;
          legal_name: string;
          notes: string | null;
          phone: string | null;
          supplier_type: string;
          tax_id: string | null;
          trade_name: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "suppliers";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_trip_evaluation_policy: {
        Args: {
          cost_coverage: Json;
          currency: string;
          effective_from?: string;
          effective_to?: string;
          margin_basis: Database["public"]["Enums"]["trip_evaluation_margin_basis"];
          minimum_margin_rate: number;
          name: string;
          policy_key: string;
          target_margin_rate: number;
          tax_basis: Database["public"]["Enums"]["trip_evaluation_tax_basis"];
          tax_rate: number;
        };
        Returns: {
          active: boolean;
          company_id: string;
          cost_coverage: Json;
          created_at: string;
          created_by: string;
          currency: string;
          effective_from: string;
          effective_to: string | null;
          id: string;
          margin_basis: Database["public"]["Enums"]["trip_evaluation_margin_basis"];
          minimum_margin_rate: number;
          name: string;
          policy_key: string;
          target_margin_rate: number;
          tax_basis: Database["public"]["Enums"]["trip_evaluation_tax_basis"];
          tax_rate: number;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "trip_evaluation_policies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_trip_invoice:
        | {
            Args: {
              p_client_id: string;
              p_due_on: string;
              p_issued_on: string;
              p_number: string;
              p_series: string;
              p_subtotal: number;
              p_tax: number;
              p_trip_id: string;
            };
            Returns: string;
          }
        | {
            Args: {
              client_id: string;
              due_at: string;
              issued_at: string;
              number: string;
              series: string;
              total: number;
              trip_id: string;
            };
            Returns: string;
          };
      create_trip_with_load:
        | {
            Args: {
              cargo_description: string;
              cargo_tons: number;
              client_id: string;
              destination: string;
              freight_amount: number;
              origin: string;
              scheduled_at: string;
            };
            Returns: {
              additional_amount: number;
              administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
              client_id: string;
              code: string;
              company_id: string;
              created_at: string;
              created_by: string;
              currency: string;
              cycle_id: string | null;
              cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
              cycle_sequence: number | null;
              destination: string;
              driver_id: string | null;
              financial_status: Database["public"]["Enums"]["trip_financial_status"];
              financially_closed_at: string | null;
              freight_amount: number;
              freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
              freight_rate_per_ton: number | null;
              id: string;
              notes: string | null;
              operational_finished_at: string | null;
              operational_status: Database["public"]["Enums"]["trip_operational_status"];
              origin: string;
              route_id: string | null;
              scheduled_at: string;
              started_at: string | null;
              updated_at: string;
              vehicle_id: string | null;
              version: number;
            };
            SetofOptions: {
              from: "*";
              to: "trips";
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: {
              cargo_description: string;
              cargo_tons: number;
              client_id: string;
              destination: string;
              freight_amount: number;
              freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
              freight_rate_per_ton: number;
              origin: string;
              scheduled_at: string;
            };
            Returns: {
              additional_amount: number;
              administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
              client_id: string;
              code: string;
              company_id: string;
              created_at: string;
              created_by: string;
              currency: string;
              cycle_id: string | null;
              cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
              cycle_sequence: number | null;
              destination: string;
              driver_id: string | null;
              financial_status: Database["public"]["Enums"]["trip_financial_status"];
              financially_closed_at: string | null;
              freight_amount: number;
              freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
              freight_rate_per_ton: number | null;
              id: string;
              notes: string | null;
              operational_finished_at: string | null;
              operational_status: Database["public"]["Enums"]["trip_operational_status"];
              origin: string;
              route_id: string | null;
              scheduled_at: string;
              started_at: string | null;
              updated_at: string;
              vehicle_id: string | null;
              version: number;
            };
            SetofOptions: {
              from: "*";
              to: "trips";
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      create_work_order: {
        Args: {
          p_admitted_at: string;
          p_blocks_operation: boolean;
          p_id: string;
          p_idempotency_key: string;
          p_maintenance_type: string;
          p_notes: string;
          p_reported_problem: string;
          p_supplier_id: string;
          p_vehicle_id: string;
        };
        Returns: {
          admitted_at: string | null;
          blocks_operation: boolean;
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          diagnosis: string | null;
          finished_at: string | null;
          id: string;
          idempotency_key: string | null;
          labor_cost: number;
          maintenance_type: string;
          notes: string | null;
          odometer_km: number | null;
          parts_cost: number;
          reported_problem: string | null;
          source: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["work_order_status"];
          supplier_id: string | null;
          updated_at: string;
          vehicle_id: string;
          work_performed: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "work_orders";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      finish_gps_sync_run: {
        Args: {
          p_assets_seen: number;
          p_error_code?: string;
          p_positions_deduplicated: number;
          p_positions_persisted: number;
          p_positions_received: number;
          p_positions_unlinked: number;
          p_provider_checkpoint_at?: string;
          p_run_id: string;
          p_source_attempts: number;
          p_status: Database["public"]["Enums"]["gps_sync_run_status"];
        };
        Returns: {
          assets_seen: number;
          company_id: string;
          deadline_at: string | null;
          error_code: string | null;
          error_message: string | null;
          finished_at: string | null;
          heartbeat_at: string | null;
          id: string;
          initiated_by: string | null;
          lease_expires_at: string | null;
          positions_deduplicated: number;
          positions_persisted: number;
          positions_received: number;
          positions_unlinked: number;
          provider_checkpoint_at: string | null;
          provider_kind: string;
          request_id: string | null;
          source_attempts: number;
          started_at: string;
          status: Database["public"]["Enums"]["gps_sync_run_status"];
          trigger_kind: string;
        };
        SetofOptions: {
          from: "*";
          to: "gps_sync_runs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fix_trip_evaluation: {
        Args: { evaluation_id: string };
        Returns: {
          client_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          fixed_at: string | null;
          fixed_by: string | null;
          id: string;
          idempotency_key: string | null;
          input_snapshot: Json;
          policy_id: string;
          policy_snapshot: Json;
          policy_version: number;
          reference: string | null;
          result_snapshot: Json;
          status: Database["public"]["Enums"]["trip_evaluation_status"];
          supersedes_evaluation_id: string | null;
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "trip_evaluations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      heartbeat_gps_sync_run: {
        Args: { p_lease_seconds: number; p_run_id: string };
        Returns: {
          assets_seen: number;
          company_id: string;
          deadline_at: string | null;
          error_code: string | null;
          error_message: string | null;
          finished_at: string | null;
          heartbeat_at: string | null;
          id: string;
          initiated_by: string | null;
          lease_expires_at: string | null;
          positions_deduplicated: number;
          positions_persisted: number;
          positions_received: number;
          positions_unlinked: number;
          provider_checkpoint_at: string | null;
          provider_kind: string;
          request_id: string | null;
          source_attempts: number;
          started_at: string;
          status: Database["public"]["Enums"]["gps_sync_run_status"];
          trigger_kind: string;
        };
        SetofOptions: {
          from: "*";
          to: "gps_sync_runs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ingest_goldcar_detail_position_for_sync: {
        Args: {
          p_altitude_meters?: number;
          p_external_asset_id: string;
          p_heading_degrees?: number;
          p_ignition?: boolean;
          p_latitude: number;
          p_longitude: number;
          p_observation_key: string;
          p_odometer_km?: number;
          p_provider_event_id: string;
          p_received_at: string;
          p_recorded_at: string;
          p_run_id: string;
          p_speed_kmh?: number;
        };
        Returns: {
          disposition: string;
          position_id: string;
        }[];
      };
      ingest_gps_position: {
        Args: {
          p_altitude_meters?: number;
          p_external_asset_id: string;
          p_heading_degrees?: number;
          p_ignition?: boolean;
          p_latitude: number;
          p_longitude: number;
          p_observation_key: string;
          p_odometer_km?: number;
          p_provider_event_id: string;
          p_provider_kind: string;
          p_received_at: string;
          p_recorded_at: string;
          p_speed_kmh?: number;
        };
        Returns: string;
      };
      ingest_gps_position_for_sync: {
        Args: {
          p_altitude_meters?: number;
          p_external_asset_id: string;
          p_heading_degrees?: number;
          p_ignition?: boolean;
          p_latitude: number;
          p_longitude: number;
          p_observation_key: string;
          p_odometer_km?: number;
          p_provider_event_id: string;
          p_provider_kind: string;
          p_received_at: string;
          p_recorded_at: string;
          p_run_id: string;
          p_speed_kmh?: number;
        };
        Returns: {
          disposition: string;
          position_id: string;
        }[];
      };
      issue_trip_advance:
        | {
            Args: {
              p_amount: number;
              p_concept: string;
              p_delivered_at: string;
              p_delivery_method: string;
              p_driver_id: string;
              p_idempotency_key: string;
              p_trip_id: string;
            };
            Returns: string;
          }
        | {
            Args: {
              amount: number;
              concept: string;
              driver_id: string;
              trip_id: string;
            };
            Returns: string;
          };
      link_driver_profile: {
        Args: { driver_id: string; profile_id: string };
        Returns: {
          active: boolean;
          company_id: string;
          contract_ended_on: string | null;
          contract_started_on: string | null;
          contract_type: string | null;
          created_at: string;
          current_status: Database["public"]["Enums"]["driver_status"];
          display_name: string;
          document_number: string | null;
          document_type: string | null;
          id: string;
          license_expires_on: string | null;
          license_number: string | null;
          notes: string | null;
          phone: string | null;
          profile_id: string | null;
          updated_at: string;
          usual_vehicle_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "drivers";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      link_gps_vehicle: {
        Args: {
          p_external_asset_id: string;
          p_external_display_name: string;
          p_provider_kind: string;
          p_vehicle_id: string;
        };
        Returns: {
          active: boolean;
          company_id: string;
          created_at: string;
          external_asset_id: string;
          external_display_name: string | null;
          id: string;
          linked_at: string;
          linked_by: string;
          provider_kind: string;
          unlink_reason: string | null;
          unlinked_at: string | null;
          unlinked_by: string | null;
          updated_at: string;
          vehicle_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "gps_provider_vehicle_links";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      purge_expired_gps_positions: {
        Args: { p_company_id: string };
        Returns: number;
      };
      record_expense: {
        Args: {
          p_amount: number;
          p_category_id: string;
          p_currency: string;
          p_description: string;
          p_id: string;
          p_idempotency_key: string;
          p_incurred_at: string;
          p_receipt_file_id: string;
          p_receipt_number: string;
          p_receipt_type: string;
          p_source_device_id: string;
          p_supplier_id: string;
          p_trip_id: string;
        };
        Returns: {
          amount: number;
          approved_amount: number | null;
          assignment_type: Database["public"]["Enums"]["assignment_type"];
          category_id: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          description: string | null;
          driver_id: string | null;
          id: string;
          idempotency_key: string | null;
          incurred_at: string;
          receipt_file_id: string | null;
          receipt_number: string | null;
          receipt_type: string | null;
          source: string;
          source_device_id: string | null;
          supplier_id: string | null;
          trip_id: string | null;
          updated_at: string;
          validation_status: Database["public"]["Enums"]["validation_status"];
          vehicle_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "expenses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_fuel_entry: {
        Args: {
          p_currency: string;
          p_fueled_at: string;
          p_id: string;
          p_idempotency_key: string;
          p_location: string;
          p_odometer_km: number;
          p_payment_method: string;
          p_quantity: number;
          p_receipt_file_id: string;
          p_receipt_number: string;
          p_receipt_type: string;
          p_source_device_id: string;
          p_supplier_id: string;
          p_total_amount: number;
          p_trip_id: string;
          p_unit_price: number;
          p_volume_unit: string;
        };
        Returns: {
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          driver_id: string | null;
          fueled_at: string;
          id: string;
          idempotency_key: string | null;
          location: string | null;
          odometer_km: number;
          payment_method: string | null;
          quantity: number;
          receipt_file_id: string | null;
          receipt_number: string | null;
          receipt_type: string | null;
          source_device_id: string | null;
          supplier_id: string | null;
          total_amount: number;
          trip_id: string | null;
          unit_price: number;
          updated_at: string;
          validation_status: Database["public"]["Enums"]["validation_status"];
          vehicle_id: string;
          volume_unit: string;
        };
        SetofOptions: {
          from: "*";
          to: "fuel_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_odometer_entry: {
        Args: {
          p_id: string;
          p_idempotency_key: string;
          p_reading_at: string;
          p_reading_km: number;
          p_reading_type: string;
          p_source_device_id: string;
          p_trip_id: string;
        };
        Returns: {
          company_id: string;
          created_at: string;
          id: string;
          idempotency_key: string | null;
          reading_at: string;
          reading_km: number;
          reading_type: string;
          recorded_by: string;
          source: string;
          source_device_id: string | null;
          trip_id: string | null;
          vehicle_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "odometer_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_staff_trip_expense: {
        Args: {
          p_amount: number;
          p_category_id: string;
          p_currency: string;
          p_description: string;
          p_id: string;
          p_idempotency_key: string;
          p_incurred_at: string;
          p_reason: string;
          p_receipt_file_id: string;
          p_receipt_number: string;
          p_receipt_type: string;
          p_supplier_id: string;
          p_trip_id: string;
        };
        Returns: {
          amount: number;
          approved_amount: number | null;
          assignment_type: Database["public"]["Enums"]["assignment_type"];
          category_id: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          description: string | null;
          driver_id: string | null;
          id: string;
          idempotency_key: string | null;
          incurred_at: string;
          receipt_file_id: string | null;
          receipt_number: string | null;
          receipt_type: string | null;
          source: string;
          source_device_id: string | null;
          supplier_id: string | null;
          trip_id: string | null;
          updated_at: string;
          validation_status: Database["public"]["Enums"]["validation_status"];
          vehicle_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "expenses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_staff_trip_fuel_entry: {
        Args: {
          p_currency: string;
          p_fueled_at: string;
          p_id: string;
          p_idempotency_key: string;
          p_location: string;
          p_odometer_km: number;
          p_payment_method: string;
          p_quantity: number;
          p_reason: string;
          p_receipt_file_id: string;
          p_receipt_number: string;
          p_receipt_type: string;
          p_supplier_id: string;
          p_total_amount: number;
          p_trip_id: string;
          p_unit_price: number;
          p_volume_unit: string;
        };
        Returns: {
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          driver_id: string | null;
          fueled_at: string;
          id: string;
          idempotency_key: string | null;
          location: string | null;
          odometer_km: number;
          payment_method: string | null;
          quantity: number;
          receipt_file_id: string | null;
          receipt_number: string | null;
          receipt_type: string | null;
          source_device_id: string | null;
          supplier_id: string | null;
          total_amount: number;
          trip_id: string | null;
          unit_price: number;
          updated_at: string;
          validation_status: Database["public"]["Enums"]["validation_status"];
          vehicle_id: string;
          volume_unit: string;
        };
        SetofOptions: {
          from: "*";
          to: "fuel_entries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_work_order_part: {
        Args: {
          p_id: string;
          p_idempotency_key: string;
          p_installation_odometer_km: number;
          p_installed_at: string;
          p_notes: string;
          p_part_id: string;
          p_quantity: number;
          p_supplier_id: string;
          p_unit_cost: number;
          p_work_order_id: string;
        };
        Returns: {
          company_id: string;
          id: string;
          idempotency_key: string | null;
          installation_odometer_km: number | null;
          installed_at: string | null;
          notes: string | null;
          part_id: string;
          quantity: number;
          supplier_id: string | null;
          unit_cost: number;
          work_order_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "work_order_parts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refresh_operational_alerts: { Args: never; Returns: number };
      register_invoice_payment: {
        Args: {
          amount: number;
          invoice_id: string;
          method: string;
          paid_at: string;
          reference: string;
        };
        Returns: string;
      };
      register_payment: {
        Args: {
          p_amount: number;
          p_idempotency_key: string;
          p_invoice_id: string;
          p_paid_at: string;
          p_payment_id: string;
          p_payment_method: string;
          p_reference: string;
        };
        Returns: {
          amount: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          client_id: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          file_id: string | null;
          id: string;
          idempotency_key: string;
          invoice_id: string;
          notes: string | null;
          paid_at: string;
          payment_method: string;
          reference: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      remove_trip_from_operational_cycle: {
        Args: {
          p_cycle_id: string;
          p_expected_cycle_version: number;
          p_reason: string;
          p_trip_id: string;
        };
        Returns: {
          additional_amount: number;
          administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
          client_id: string;
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          cycle_id: string | null;
          cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
          cycle_sequence: number | null;
          destination: string;
          driver_id: string | null;
          financial_status: Database["public"]["Enums"]["trip_financial_status"];
          financially_closed_at: string | null;
          freight_amount: number;
          freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
          freight_rate_per_ton: number | null;
          id: string;
          notes: string | null;
          operational_finished_at: string | null;
          operational_status: Database["public"]["Enums"]["trip_operational_status"];
          origin: string;
          route_id: string | null;
          scheduled_at: string;
          started_at: string | null;
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "trips";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reopen_settlement: {
        Args: { reason: string; settlement_id: string };
        Returns: {
          approved_at: string | null;
          approved_by: string | null;
          balance: number;
          closed_at: string | null;
          company_id: string;
          created_at: string;
          driver_id: string;
          id: string;
          notes: string | null;
          resolution_direction: string | null;
          resolution_method: string | null;
          resolution_note: string | null;
          resolution_reference: string | null;
          resolved_amount: number | null;
          resolved_at: string | null;
          resolved_by: string | null;
          started_at: string;
          status: Database["public"]["Enums"]["settlement_status"];
          submitted_at: string | null;
          total_advances: number;
          total_expenses: number;
          trip_id: string;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "settlements";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      report_incident: {
        Args: {
          p_action_taken: string;
          p_description: string;
          p_estimated_cost: number;
          p_file_id: string;
          p_id: string;
          p_idempotency_key: string;
          p_incident_type: string;
          p_location: string;
          p_occurred_at: string;
          p_severity: Database["public"]["Enums"]["incident_severity"];
          p_source_device_id: string;
          p_trip_id: string;
        };
        Returns: {
          action_taken: string | null;
          company_id: string;
          created_at: string;
          created_by: string;
          description: string;
          driver_id: string | null;
          estimated_cost: number | null;
          file_id: string | null;
          id: string;
          idempotency_key: string | null;
          incident_type: string;
          location: string | null;
          occurred_at: string;
          severity: Database["public"]["Enums"]["incident_severity"];
          source_device_id: string | null;
          status: Database["public"]["Enums"]["incident_status"];
          trip_id: string | null;
          updated_at: string;
          vehicle_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "incidents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resolve_alert: {
        Args: { alert_id: string; note: string };
        Returns: {
          alert_type: string;
          company_id: string;
          due_at: string | null;
          entity_id: string;
          entity_type: string;
          generated_at: string;
          id: string;
          message: string;
          priority: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["alert_status"];
          title: string;
        };
        SetofOptions: {
          from: "*";
          to: "alerts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      review_expense: {
        Args: {
          approved_amount: number;
          expense_id: string;
          note?: string;
          validation_status: Database["public"]["Enums"]["validation_status"];
        };
        Returns: {
          amount: number;
          approved_amount: number | null;
          assignment_type: Database["public"]["Enums"]["assignment_type"];
          category_id: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          description: string | null;
          driver_id: string | null;
          id: string;
          idempotency_key: string | null;
          incurred_at: string;
          receipt_file_id: string | null;
          receipt_number: string | null;
          receipt_type: string | null;
          source: string;
          source_device_id: string | null;
          supplier_id: string | null;
          trip_id: string | null;
          updated_at: string;
          validation_status: Database["public"]["Enums"]["validation_status"];
          vehicle_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "expenses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      review_gps_odometer_promotion: {
        Args: {
          p_decision: Database["public"]["Enums"]["gps_odometer_review_decision"];
          p_idempotency_key: string;
          p_promotion_id: string;
          p_reason: string;
        };
        Returns: {
          authority_id: string;
          company_id: string;
          decision: Database["public"]["Enums"]["gps_odometer_review_decision"];
          id: string;
          idempotency_key: string;
          odometer_entry_id: string | null;
          previous_odometer_km: number;
          promotion_id: string;
          reason: string;
          resulting_odometer_km: number;
          reviewed_at: string;
          reviewed_by: string;
          vehicle_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "gps_odometer_promotion_reviews";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_trip_evaluation: {
        Args: {
          client_id?: string;
          evaluation_id?: string;
          expected_version?: number;
          idempotency_key?: string;
          input: Json;
          policy_id: string;
          reference?: string;
          vehicle_id?: string;
        };
        Returns: {
          client_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          fixed_at: string | null;
          fixed_by: string | null;
          id: string;
          idempotency_key: string | null;
          input_snapshot: Json;
          policy_id: string;
          policy_snapshot: Json;
          policy_version: number;
          reference: string | null;
          result_snapshot: Json;
          status: Database["public"]["Enums"]["trip_evaluation_status"];
          supersedes_evaluation_id: string | null;
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "trip_evaluations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      schedule_trip:
        | {
            Args: {
              p_driver_id: string;
              p_expected_version: number;
              p_trip_id: string;
              p_vehicle_id: string;
            };
            Returns: {
              additional_amount: number;
              administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
              client_id: string;
              code: string;
              company_id: string;
              created_at: string;
              created_by: string;
              currency: string;
              cycle_id: string | null;
              cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
              cycle_sequence: number | null;
              destination: string;
              driver_id: string | null;
              financial_status: Database["public"]["Enums"]["trip_financial_status"];
              financially_closed_at: string | null;
              freight_amount: number;
              freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
              freight_rate_per_ton: number | null;
              id: string;
              notes: string | null;
              operational_finished_at: string | null;
              operational_status: Database["public"]["Enums"]["trip_operational_status"];
              origin: string;
              route_id: string | null;
              scheduled_at: string;
              started_at: string | null;
              updated_at: string;
              vehicle_id: string | null;
              version: number;
            };
            SetofOptions: {
              from: "*";
              to: "trips";
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: { driver_id: string; trip_id: string; vehicle_id: string };
            Returns: {
              additional_amount: number;
              administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
              client_id: string;
              code: string;
              company_id: string;
              created_at: string;
              created_by: string;
              currency: string;
              cycle_id: string | null;
              cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
              cycle_sequence: number | null;
              destination: string;
              driver_id: string | null;
              financial_status: Database["public"]["Enums"]["trip_financial_status"];
              financially_closed_at: string | null;
              freight_amount: number;
              freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
              freight_rate_per_ton: number | null;
              id: string;
              notes: string | null;
              operational_finished_at: string | null;
              operational_status: Database["public"]["Enums"]["trip_operational_status"];
              origin: string;
              route_id: string | null;
              scheduled_at: string;
              started_at: string | null;
              updated_at: string;
              vehicle_id: string | null;
              version: number;
            };
            SetofOptions: {
              from: "*";
              to: "trips";
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      set_driver_availability: {
        Args: {
          p_driver_id: string;
          p_expected_updated_at: string;
          p_reason?: string;
          p_status: Database["public"]["Enums"]["driver_status"];
        };
        Returns: {
          active: boolean;
          company_id: string;
          contract_ended_on: string | null;
          contract_started_on: string | null;
          contract_type: string | null;
          created_at: string;
          current_status: Database["public"]["Enums"]["driver_status"];
          display_name: string;
          document_number: string | null;
          document_type: string | null;
          id: string;
          license_expires_on: string | null;
          license_number: string | null;
          notes: string | null;
          phone: string | null;
          profile_id: string | null;
          updated_at: string;
          usual_vehicle_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "drivers";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      start_trip:
        | {
            Args: {
              p_expected_version: number;
              p_idempotency_key: string;
              p_odometer_km: number;
              p_trip_id: string;
            };
            Returns: {
              additional_amount: number;
              administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
              client_id: string;
              code: string;
              company_id: string;
              created_at: string;
              created_by: string;
              currency: string;
              cycle_id: string | null;
              cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
              cycle_sequence: number | null;
              destination: string;
              driver_id: string | null;
              financial_status: Database["public"]["Enums"]["trip_financial_status"];
              financially_closed_at: string | null;
              freight_amount: number;
              freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
              freight_rate_per_ton: number | null;
              id: string;
              notes: string | null;
              operational_finished_at: string | null;
              operational_status: Database["public"]["Enums"]["trip_operational_status"];
              origin: string;
              route_id: string | null;
              scheduled_at: string;
              started_at: string | null;
              updated_at: string;
              vehicle_id: string | null;
              version: number;
            };
            SetofOptions: {
              from: "*";
              to: "trips";
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: { initial_mileage: number; trip_id: string };
            Returns: {
              additional_amount: number;
              administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
              client_id: string;
              code: string;
              company_id: string;
              created_at: string;
              created_by: string;
              currency: string;
              cycle_id: string | null;
              cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
              cycle_sequence: number | null;
              destination: string;
              driver_id: string | null;
              financial_status: Database["public"]["Enums"]["trip_financial_status"];
              financially_closed_at: string | null;
              freight_amount: number;
              freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
              freight_rate_per_ton: number | null;
              id: string;
              notes: string | null;
              operational_finished_at: string | null;
              operational_status: Database["public"]["Enums"]["trip_operational_status"];
              origin: string;
              route_id: string | null;
              scheduled_at: string;
              started_at: string | null;
              updated_at: string;
              vehicle_id: string | null;
              version: number;
            };
            SetofOptions: {
              from: "*";
              to: "trips";
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      suspend_gps_odometer_authority: {
        Args: { p_authority_id: string; p_reason: string };
        Returns: {
          activated_at: string;
          activated_by: string;
          activation_request_id: string;
          baseline_position_id: string;
          bootstrap_mode: Database["public"]["Enums"]["gps_odometer_bootstrap_mode"];
          company_id: string;
          id: string;
          provider_link_id: string;
          status: Database["public"]["Enums"]["gps_odometer_authority_status"];
          suspended_at: string | null;
          suspended_by: string | null;
          suspension_reason: string | null;
          vehicle_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "gps_odometer_authorities";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      transition_trip_operational: {
        Args: {
          p_expected_version: number;
          p_reason?: string;
          p_target: Database["public"]["Enums"]["trip_operational_status"];
          p_trip_id: string;
        };
        Returns: {
          additional_amount: number;
          administrative_status: Database["public"]["Enums"]["trip_administrative_status"];
          client_id: string;
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          cycle_id: string | null;
          cycle_leg_kind: Database["public"]["Enums"]["operational_cycle_leg_kind"] | null;
          cycle_sequence: number | null;
          destination: string;
          driver_id: string | null;
          financial_status: Database["public"]["Enums"]["trip_financial_status"];
          financially_closed_at: string | null;
          freight_amount: number;
          freight_pricing_mode: Database["public"]["Enums"]["freight_pricing_mode"];
          freight_rate_per_ton: number | null;
          id: string;
          notes: string | null;
          operational_finished_at: string | null;
          operational_status: Database["public"]["Enums"]["trip_operational_status"];
          origin: string;
          route_id: string | null;
          scheduled_at: string;
          started_at: string | null;
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "trips";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      unlink_gps_vehicle: {
        Args: { p_link_id: string; p_reason: string };
        Returns: {
          active: boolean;
          company_id: string;
          created_at: string;
          external_asset_id: string;
          external_display_name: string | null;
          id: string;
          linked_at: string;
          linked_by: string;
          provider_kind: string;
          unlink_reason: string | null;
          unlinked_at: string | null;
          unlinked_by: string | null;
          updated_at: string;
          vehicle_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "gps_provider_vehicle_links";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_client_master: {
        Args: {
          p_active: boolean;
          p_address: string;
          p_client_id: string;
          p_expected_updated_at: string;
          p_legal_name: string;
          p_notes: string;
          p_payment_terms_days: number;
          p_phone: string;
          p_relationship_type: Database["public"]["Enums"]["client_relationship_type"];
          p_tax_id: string;
          p_trade_name: string;
        };
        Returns: {
          active: boolean;
          address: string | null;
          company_id: string;
          created_at: string;
          id: string;
          legal_name: string;
          notes: string | null;
          payment_terms_days: number;
          phone: string | null;
          relationship_type: Database["public"]["Enums"]["client_relationship_type"] | null;
          tax_id: string | null;
          trade_name: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "clients";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_driver_master: {
        Args: {
          p_active: boolean;
          p_contract_ended_on: string;
          p_contract_started_on: string;
          p_contract_type: string;
          p_display_name: string;
          p_document_number: string;
          p_document_type: string;
          p_driver_id: string;
          p_expected_updated_at: string;
          p_license_expires_on: string;
          p_license_number: string;
          p_notes: string;
          p_phone: string;
          p_usual_vehicle_id: string;
        };
        Returns: {
          active: boolean;
          company_id: string;
          contract_ended_on: string | null;
          contract_started_on: string | null;
          contract_type: string | null;
          created_at: string;
          current_status: Database["public"]["Enums"]["driver_status"];
          display_name: string;
          document_number: string | null;
          document_type: string | null;
          id: string;
          license_expires_on: string | null;
          license_number: string | null;
          notes: string | null;
          phone: string | null;
          profile_id: string | null;
          updated_at: string;
          usual_vehicle_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "drivers";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_operational_cycle: {
        Args: {
          p_cycle_id: string;
          p_expected_version: number;
          p_notes: string;
          p_return_status: Database["public"]["Enums"]["return_status"];
          p_status: Database["public"]["Enums"]["operational_cycle_status"];
        };
        Returns: {
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          ended_at: string | null;
          id: string;
          idempotency_key: string | null;
          notes: string | null;
          primary_driver_id: string | null;
          return_status: Database["public"]["Enums"]["return_status"];
          started_at: string | null;
          status: Database["public"]["Enums"]["operational_cycle_status"];
          updated_at: string;
          vehicle_id: string | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "operational_cycles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_supplier_master: {
        Args: {
          p_active: boolean;
          p_address: string;
          p_expected_updated_at: string;
          p_legal_name: string;
          p_notes: string;
          p_phone: string;
          p_supplier_id: string;
          p_supplier_type: string;
          p_tax_id: string;
          p_trade_name: string;
        };
        Returns: {
          active: boolean;
          address: string | null;
          company_id: string;
          created_at: string;
          id: string;
          legal_name: string;
          notes: string | null;
          phone: string | null;
          supplier_type: string;
          tax_id: string | null;
          trade_name: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "suppliers";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_vehicle_master: {
        Args: {
          p_active: boolean;
          p_capacity_tons: number;
          p_expected_updated_at: string;
          p_make: string;
          p_model: string;
          p_model_year: number;
          p_notes: string;
          p_owner_name: string;
          p_ownership_type: Database["public"]["Enums"]["vehicle_ownership_type"];
          p_plate: string;
          p_vehicle_id: string;
        };
        Returns: {
          active: boolean;
          capacity_tons: number | null;
          company_id: string;
          created_at: string;
          current_odometer_km: number;
          current_status: Database["public"]["Enums"]["vehicle_status"];
          id: string;
          make: string | null;
          model: string | null;
          model_year: number | null;
          notes: string | null;
          owner_name: string | null;
          ownership_type: Database["public"]["Enums"]["vehicle_ownership_type"] | null;
          plate: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "vehicles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_work_order_progress: {
        Args: {
          p_admitted_at: string;
          p_blocks_operation: boolean;
          p_diagnosis: string;
          p_notes: string;
          p_started_at: string;
          p_status: Database["public"]["Enums"]["work_order_status"];
          p_supplier_id: string;
          p_work_order_id: string;
          p_work_performed: string;
        };
        Returns: {
          admitted_at: string | null;
          blocks_operation: boolean;
          code: string;
          company_id: string;
          created_at: string;
          created_by: string;
          diagnosis: string | null;
          finished_at: string | null;
          id: string;
          idempotency_key: string | null;
          labor_cost: number;
          maintenance_type: string;
          notes: string | null;
          odometer_km: number | null;
          parts_cost: number;
          reported_problem: string | null;
          source: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["work_order_status"];
          supplier_id: string | null;
          updated_at: string;
          vehicle_id: string;
          work_performed: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "work_orders";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      advance_status: "delivered" | "partially_settled" | "settled" | "cancelled";
      alert_status: "new" | "seen" | "in_progress" | "resolved" | "dismissed";
      app_role: "management" | "administration" | "driver" | "accounting";
      assignment_type: "trip" | "vehicle" | "general";
      client_relationship_type: "direct" | "intermediary" | "third_party";
      document_status: "valid" | "expiring" | "expired" | "replaced" | "cancelled";
      driver_status:
        | "available"
        | "assigned"
        | "in_trip"
        | "rest"
        | "vacation"
        | "leave"
        | "unavailable"
        | "inactive";
      freight_pricing_mode: "total" | "per_ton";
      gps_odometer_authority_status: "active" | "suspended";
      gps_odometer_bootstrap_mode: "standard" | "test_placeholder";
      gps_odometer_promotion_kind: "baseline" | "sync";
      gps_odometer_promotion_outcome:
        | "advanced"
        | "confirmed"
        | "test_placeholder_replaced"
        | "regression"
        | "requires_review";
      gps_odometer_review_decision: "approved" | "rejected";
      gps_odometer_source_semantic: "unverified" | "vehicle_odometer";
      gps_position_source_kind: "snapshot_csv" | "goldcar_detail_html";
      gps_sync_run_status: "started" | "succeeded" | "failed" | "cancelled";
      incident_severity: "low" | "medium" | "high" | "critical";
      incident_status: "open" | "in_progress" | "resolved" | "closed";
      invoice_status: "draft" | "issued" | "partial" | "paid" | "overdue" | "cancelled";
      operational_cycle_leg_kind: "outbound" | "return" | "continuation";
      operational_cycle_status: "planned" | "active" | "completed" | "cancelled";
      return_status: "unidentified" | "probable" | "confirmed" | "completed" | "empty_return";
      settlement_status:
        | "pending"
        | "under_review"
        | "observed"
        | "approved"
        | "closed"
        | "cancelled";
      trip_administrative_status:
        | "not_required"
        | "settlement_pending"
        | "settlement_review"
        | "settlement_observed"
        | "settlement_closed";
      trip_evaluation_exception_status: "PENDING" | "APPROVED";
      trip_evaluation_margin_basis: "REVENUE" | "COST";
      trip_evaluation_scenario: "CONSERVATIVE" | "PROBABLE" | "FAVORABLE";
      trip_evaluation_status: "DRAFT" | "EXCEPTION_REQUIRED" | "FIXED";
      trip_evaluation_tax_basis: "INCLUDED" | "EXCLUDED";
      trip_financial_status:
        | "unbilled"
        | "billed"
        | "partially_paid"
        | "paid"
        | "financially_closed";
      trip_operational_status:
        | "draft"
        | "approved"
        | "scheduled"
        | "loading"
        | "in_transit"
        | "unloading"
        | "completed"
        | "cancelled";
      validation_status: "pending_review" | "validated" | "observed" | "rejected";
      vehicle_ownership_type: "owned" | "leased" | "third_party";
      vehicle_status:
        | "available"
        | "scheduled"
        | "in_trip"
        | "waiting_load"
        | "returning_empty"
        | "preventive_maintenance"
        | "repair"
        | "waiting_workshop"
        | "without_driver"
        | "blocked"
        | "immobilized"
        | "out_of_service";
      work_order_status:
        | "scheduled"
        | "waiting_workshop"
        | "in_workshop"
        | "in_progress"
        | "waiting_part"
        | "finished"
        | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      advance_status: ["delivered", "partially_settled", "settled", "cancelled"],
      alert_status: ["new", "seen", "in_progress", "resolved", "dismissed"],
      app_role: ["management", "administration", "driver", "accounting"],
      assignment_type: ["trip", "vehicle", "general"],
      client_relationship_type: ["direct", "intermediary", "third_party"],
      document_status: ["valid", "expiring", "expired", "replaced", "cancelled"],
      driver_status: [
        "available",
        "assigned",
        "in_trip",
        "rest",
        "vacation",
        "leave",
        "unavailable",
        "inactive",
      ],
      freight_pricing_mode: ["total", "per_ton"],
      gps_odometer_authority_status: ["active", "suspended"],
      gps_odometer_bootstrap_mode: ["standard", "test_placeholder"],
      gps_odometer_promotion_kind: ["baseline", "sync"],
      gps_odometer_promotion_outcome: [
        "advanced",
        "confirmed",
        "test_placeholder_replaced",
        "regression",
        "requires_review",
      ],
      gps_odometer_review_decision: ["approved", "rejected"],
      gps_odometer_source_semantic: ["unverified", "vehicle_odometer"],
      gps_position_source_kind: ["snapshot_csv", "goldcar_detail_html"],
      gps_sync_run_status: ["started", "succeeded", "failed", "cancelled"],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: ["open", "in_progress", "resolved", "closed"],
      invoice_status: ["draft", "issued", "partial", "paid", "overdue", "cancelled"],
      operational_cycle_leg_kind: ["outbound", "return", "continuation"],
      operational_cycle_status: ["planned", "active", "completed", "cancelled"],
      return_status: ["unidentified", "probable", "confirmed", "completed", "empty_return"],
      settlement_status: ["pending", "under_review", "observed", "approved", "closed", "cancelled"],
      trip_administrative_status: [
        "not_required",
        "settlement_pending",
        "settlement_review",
        "settlement_observed",
        "settlement_closed",
      ],
      trip_evaluation_exception_status: ["PENDING", "APPROVED"],
      trip_evaluation_margin_basis: ["REVENUE", "COST"],
      trip_evaluation_scenario: ["CONSERVATIVE", "PROBABLE", "FAVORABLE"],
      trip_evaluation_status: ["DRAFT", "EXCEPTION_REQUIRED", "FIXED"],
      trip_evaluation_tax_basis: ["INCLUDED", "EXCLUDED"],
      trip_financial_status: ["unbilled", "billed", "partially_paid", "paid", "financially_closed"],
      trip_operational_status: [
        "draft",
        "approved",
        "scheduled",
        "loading",
        "in_transit",
        "unloading",
        "completed",
        "cancelled",
      ],
      validation_status: ["pending_review", "validated", "observed", "rejected"],
      vehicle_ownership_type: ["owned", "leased", "third_party"],
      vehicle_status: [
        "available",
        "scheduled",
        "in_trip",
        "waiting_load",
        "returning_empty",
        "preventive_maintenance",
        "repair",
        "waiting_workshop",
        "without_driver",
        "blocked",
        "immobilized",
        "out_of_service",
      ],
      work_order_status: [
        "scheduled",
        "waiting_workshop",
        "in_workshop",
        "in_progress",
        "waiting_part",
        "finished",
        "cancelled",
      ],
    },
  },
} as const;
