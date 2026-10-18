export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      events: {
        Row: {
          created_at: string;
          dress_code: string | null;
          end_time: string | null;
          event_date: string | null;
          event_timezone: string | null;
          event_title: string | null;
          event_type: string | null;
          hero_image_storage_path: string | null;
          host_display_names: string[];
          id: string;
          invitation_message: string | null;
          organizer_contact_information: string | null;
          owner_user_id: string;
          publication_status: Database["public"]["Enums"]["event_publication_status"];
          published_at: string | null;
          rsvp_deadline_local: string | null;
          start_time: string | null;
          updated_at: string;
          venue_address: string | null;
          venue_arrival_notes: string | null;
          venue_map_url: string | null;
          venue_name: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dress_code?: string | null;
          end_time?: string | null;
          event_date?: string | null;
          event_timezone?: string | null;
          event_title?: string | null;
          event_type?: string | null;
          hero_image_storage_path?: string | null;
          host_display_names?: string[];
          id?: string;
          invitation_message?: string | null;
          organizer_contact_information?: string | null;
          owner_user_id: string;
          publication_status?: Database["public"]["Enums"]["event_publication_status"];
          published_at?: string | null;
          rsvp_deadline_local?: string | null;
          start_time?: string | null;
          updated_at?: string;
          venue_address?: string | null;
          venue_arrival_notes?: string | null;
          venue_map_url?: string | null;
          venue_name?: string | null;
        };
        Update: {
          created_at?: string;
          dress_code?: string | null;
          end_time?: string | null;
          event_date?: string | null;
          event_timezone?: string | null;
          event_title?: string | null;
          event_type?: string | null;
          hero_image_storage_path?: string | null;
          host_display_names?: string[];
          id?: string;
          invitation_message?: string | null;
          organizer_contact_information?: string | null;
          owner_user_id?: string;
          publication_status?: Database["public"]["Enums"]["event_publication_status"];
          published_at?: string | null;
          rsvp_deadline_local?: string | null;
          start_time?: string | null;
          updated_at?: string;
          venue_address?: string | null;
          venue_arrival_notes?: string | null;
          venue_map_url?: string | null;
          venue_name?: string | null;
        };
        Relationships: [];
      };
      invitation_access_credentials: {
        Row: {
          invitation_id: string;
          token_ciphertext: string;
          token_created_at: string;
          token_key_version: number;
          token_lookup_hash: string;
        };
        ComputedFields: never;
        Insert: {
          invitation_id: string;
          token_ciphertext: string;
          token_created_at?: string;
          token_key_version: number;
          token_lookup_hash: string;
        };
        Update: {
          invitation_id?: string;
          token_ciphertext?: string;
          token_created_at?: string;
          token_key_version?: number;
          token_lookup_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitation_access_credentials_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: true;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          invitee_name: string;
          maximum_party_size: number;
          revoked_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          invitee_name: string;
          maximum_party_size: number;
          revoked_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          invitee_name?: string;
          maximum_party_size?: number;
          revoked_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      rsvps: {
        Row: {
          attendee_count: number;
          attendee_names: string[];
          created_at: string;
          dietary_requirements: string | null;
          guest_message: string | null;
          invitation_id: string;
          responded_at: string | null;
          response_updated_at: string | null;
          status: Database["public"]["Enums"]["rsvp_status"];
        };
        ComputedFields: never;
        Insert: {
          attendee_count?: number;
          attendee_names?: string[];
          created_at?: string;
          dietary_requirements?: string | null;
          guest_message?: string | null;
          invitation_id: string;
          responded_at?: string | null;
          response_updated_at?: string | null;
          status?: Database["public"]["Enums"]["rsvp_status"];
        };
        Update: {
          attendee_count?: number;
          attendee_names?: string[];
          created_at?: string;
          dietary_requirements?: string | null;
          guest_message?: string | null;
          invitation_id?: string;
          responded_at?: string | null;
          response_updated_at?: string | null;
          status?: Database["public"]["Enums"]["rsvp_status"];
        };
        Relationships: [
          {
            foreignKeyName: "rsvps_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: true;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_invitation_record: {
        Args: {
          p_event_id: string;
          p_invitee_name: string;
          p_maximum_party_size: number;
          p_owner_user_id: string;
          p_token_ciphertext: string;
          p_token_key_version: number;
          p_token_lookup_hash: string;
        };
        Returns: string;
      };
      delete_event_record: { Args: { p_event_id: string }; Returns: string };
      publish_event: { Args: { p_event_id: string }; Returns: undefined };
      replace_invitation_credential: {
        Args: {
          p_invitation_id: string;
          p_owner_user_id: string;
          p_token_ciphertext: string;
          p_token_key_version: number;
          p_token_lookup_hash: string;
        };
        Returns: string;
      };
      revoke_invitation_record: {
        Args: { p_event_id: string; p_invitation_id: string };
        Returns: string;
      };
      submit_guest_rsvp: {
        Args: {
          p_attendee_count: number;
          p_attendee_names: string[];
          p_dietary_requirements: string;
          p_guest_message: string;
          p_guest_message_present: boolean;
          p_observed_at?: string;
          p_status: string;
          p_token_lookup_hash: string;
        };
        Returns: Json;
      };
      update_invitation_record: {
        Args: {
          p_event_id: string;
          p_invitation_id: string;
          p_invitee_name: string;
          p_maximum_party_size: number;
        };
        Returns: {
          created_at: string;
          event_id: string;
          id: string;
          invitee_name: string;
          maximum_party_size: number;
          revoked_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "invitations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_organizer_rsvp: {
        Args: {
          p_attendee_count: number;
          p_attendee_names: string[];
          p_dietary_requirements: string;
          p_event_id: string;
          p_invitation_id: string;
          p_status: string;
        };
        Returns: {
          attendee_count: number;
          attendee_names: string[];
          created_at: string;
          dietary_requirements: string | null;
          guest_message: string | null;
          invitation_id: string;
          responded_at: string | null;
          response_updated_at: string | null;
          status: Database["public"]["Enums"]["rsvp_status"];
        };
        SetofOptions: {
          from: "*";
          to: "rsvps";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      event_publication_status: "draft" | "published";
      rsvp_status: "awaiting_response" | "attending" | "declined";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      event_publication_status: ["draft", "published"],
      rsvp_status: ["awaiting_response", "attending", "declined"],
    },
  },
} as const;
