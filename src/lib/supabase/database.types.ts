export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          default_currency: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          default_currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          default_currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          kind: Database["public"]["Enums"]["transaction_kind"];
          color: string;
          icon: string | null;
          sort_order: number;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          kind?: Database["public"]["Enums"]["transaction_kind"];
          color?: string;
          icon?: string | null;
          sort_order?: number;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          kind?: Database["public"]["Enums"]["transaction_kind"];
          color?: string;
          icon?: string | null;
          sort_order?: number;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          address: string | null;
          phone: string | null;
          country: string | null;
          latitude: number | null;
          longitude: number | null;
          place_provider: string | null;
          place_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          place_provider?: string | null;
          place_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          place_provider?: string | null;
          place_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          store_id: string | null;
          kind: Database["public"]["Enums"]["transaction_kind"];
          title: string;
          amount: number;
          currency: string;
          occurred_at: string;
          local_date: string;
          memo: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          store_id?: string | null;
          kind?: Database["public"]["Enums"]["transaction_kind"];
          title: string;
          amount: number;
          currency?: string;
          occurred_at?: string;
          local_date: string;
          memo?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          store_id?: string | null;
          kind?: Database["public"]["Enums"]["transaction_kind"];
          title?: string;
          amount?: number;
          currency?: string;
          occurred_at?: string;
          local_date?: string;
          memo?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      receipts: {
        Row: {
          id: string;
          user_id: string;
          store_id: string | null;
          transaction_id: string | null;
          status: Database["public"]["Enums"]["receipt_status"];
          storage_bucket: string;
          storage_path: string;
          source_file_name: string | null;
          mime_type: string | null;
          country: string | null;
          language: string | null;
          currency: string | null;
          purchased_at: string | null;
          subtotal: number | null;
          tax: number;
          tip: number;
          total: number | null;
          confidence: number | null;
          ocr_text: string | null;
          parsed_json: Json;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          store_id?: string | null;
          transaction_id?: string | null;
          status?: Database["public"]["Enums"]["receipt_status"];
          storage_bucket?: string;
          storage_path: string;
          source_file_name?: string | null;
          mime_type?: string | null;
          country?: string | null;
          language?: string | null;
          currency?: string | null;
          purchased_at?: string | null;
          subtotal?: number | null;
          tax?: number;
          tip?: number;
          total?: number | null;
          confidence?: number | null;
          ocr_text?: string | null;
          parsed_json?: Json;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          store_id?: string | null;
          transaction_id?: string | null;
          status?: Database["public"]["Enums"]["receipt_status"];
          storage_bucket?: string;
          storage_path?: string;
          source_file_name?: string | null;
          mime_type?: string | null;
          country?: string | null;
          language?: string | null;
          currency?: string | null;
          purchased_at?: string | null;
          subtotal?: number | null;
          tax?: number;
          tip?: number;
          total?: number | null;
          confidence?: number | null;
          ocr_text?: string | null;
          parsed_json?: Json;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      receipt_items: {
        Row: {
          id: string;
          receipt_id: string;
          user_id: string;
          name: string;
          quantity: number;
          unit_price: number | null;
          total_price: number;
          currency: string;
          category_id: string | null;
          line_index: number;
          raw_text: string | null;
          confidence: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          receipt_id: string;
          user_id: string;
          name: string;
          quantity?: number;
          unit_price?: number | null;
          total_price: number;
          currency: string;
          category_id?: string | null;
          line_index?: number;
          raw_text?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          receipt_id?: string;
          user_id?: string;
          name?: string;
          quantity?: number;
          unit_price?: number | null;
          total_price?: number;
          currency?: string;
          category_id?: string | null;
          line_index?: number;
          raw_text?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      transaction_kind: "expense" | "income" | "transfer";
      receipt_status:
        | "uploaded"
        | "processing"
        | "completed"
        | "failed"
        | "confirmed";
    };
    CompositeTypes: Record<string, never>;
  };
};
