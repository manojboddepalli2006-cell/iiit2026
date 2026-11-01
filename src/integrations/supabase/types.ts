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
      analyses: {
        Row: {
          confidence: number
          created_at: string
          ecr: number
          execution_ms: number
          expected_loss: number
          id: string
          model: string
          portfolio_id: string | null
          portfolio_name: string
          samples: number
          seed: number
          summary: Json
          var: number
        }
        Insert: {
          confidence: number
          created_at?: string
          ecr: number
          execution_ms: number
          expected_loss: number
          id?: string
          model: string
          portfolio_id?: string | null
          portfolio_name: string
          samples: number
          seed: number
          summary: Json
          var: number
        }
        Update: {
          confidence?: number
          created_at?: string
          ecr?: number
          execution_ms?: number
          expected_loss?: number
          id?: string
          model?: string
          portfolio_id?: string | null
          portfolio_name?: string
          samples?: number
          seed?: number
          summary?: Json
          var?: number
        }
        Relationships: [
          {
            foreignKeyName: "analyses_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_code: string
          borrower_name: string
          created_at: string
          exposure: number
          id: string
          lgd: number
          pd: number
          portfolio_id: string
          rho: number
          status: string
        }
        Insert: {
          asset_code: string
          borrower_name: string
          created_at?: string
          exposure: number
          id?: string
          lgd: number
          pd: number
          portfolio_id: string
          rho: number
          status?: string
        }
        Update: {
          asset_code?: string
          borrower_name?: string
          created_at?: string
          exposure?: number
          id?: string
          lgd?: number
          pd?: number
          portfolio_id?: string
          rho?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      comparisons: {
        Row: {
          classical_var: number | null
          confidence: number
          created_at: string
          exact_var: number | null
          id: string
          mode: string
          portfolio_id: string | null
          problem_label: string
          quantum_var: number | null
          result: Json
          unit: number
        }
        Insert: {
          classical_var?: number | null
          confidence: number
          created_at?: string
          exact_var?: number | null
          id?: string
          mode?: string
          portfolio_id?: string | null
          problem_label: string
          quantum_var?: number | null
          result: Json
          unit?: number
        }
        Update: {
          classical_var?: number | null
          confidence?: number
          created_at?: string
          exact_var?: number | null
          id?: string
          mode?: string
          portfolio_id?: string | null
          problem_label?: string
          quantum_var?: number | null
          result?: Json
          unit?: number
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          last_result: Json | null
          last_status: string
          name: string
          portfolio_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          last_result?: Json | null
          last_status?: string
          name: string
          portfolio_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          last_result?: Json | null
          last_status?: string
          name?: string
          portfolio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      quantum_runs: {
        Row: {
          confidence: number
          created_at: string
          depth: number
          ecr_units: number
          eval_qubits: number
          execution_ms: number
          gate_count: number
          id: string
          model: string
          n_assets: number
          problem_label: string
          qubits: number
          result: Json
          shots: number
          unit: number
          var_units: number
        }
        Insert: {
          confidence: number
          created_at?: string
          depth: number
          ecr_units: number
          eval_qubits: number
          execution_ms: number
          gate_count: number
          id?: string
          model: string
          n_assets: number
          problem_label: string
          qubits: number
          result: Json
          shots: number
          unit: number
          var_units: number
        }
        Update: {
          confidence?: number
          created_at?: string
          depth?: number
          ecr_units?: number
          eval_qubits?: number
          execution_ms?: number
          gate_count?: number
          id?: string
          model?: string
          n_assets?: number
          problem_label?: string
          qubits?: number
          result?: Json
          shots?: number
          unit?: number
          var_units?: number
        }
        Relationships: []
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
