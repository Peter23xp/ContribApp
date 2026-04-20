/**
 * ============================================================
 * SCHÉMA FIRESTORE COMPLET — ContribApp RDC v2.0
 * Firebase est l'UNIQUE base de données (SQLite supprimé)
 * ============================================================
 *
 * ─────────────────────────────────────────────────────────
 * Collection : users/{uid}
 * ─────────────────────────────────────────────────────────
 * {
 *   uid: string                 // = Firebase Auth UID
 *   full_name: string
 *   phone: string               // +243XXXXXXXXX — indexé pour login queries
 *   operator: 'airtel' | 'orange' | 'mpesa' | 'mtn'
 *   profile_photo_url?: string  // URL Cloudflare R2
 *   is_verified: boolean        // true après vérification OTP
 *   active_group_id?: string    // groupId du groupe actif
 *
 *   // ── SÉCURITÉ ──────────────────────────────────────
 *   pin_hash: string            // SHA-256 + sel du PIN 6 chiffres
 *                               // JAMAIS le PIN en clair
 *   login_attempts: number      // Reset à 0 après succès
 *   locked_until?: Timestamp    // null si non bloqué
 *   biometric_enabled: boolean
 *   fcm_token?: string
 *   last_login?: Timestamp
 *
 *   // ── PRÉFÉRENCES ───────────────────────────────────
 *   preferences: {
 *     language: 'fr' | 'ln' | 'sw'
 *     currency_display: 'CDF' | 'USD'
 *     push_enabled: boolean
 *     sms_reminders: boolean
 *     sms_confirmation: boolean
 *     monthly_report: boolean
 *     biometric_payment_confirm: boolean
 *   }
 *
 *   created_at: Timestamp
 *   updated_at: Timestamp
 * }
 *
 * INDEX FIRESTORE REQUIS sur users :
 *   - phone ASC
 *   - phone + is_verified (composite)
 *
 * ─────────────────────────────────────────────────────────
 * Collection temporaire : pending_registrations/{phoneHash}
 * ─────────────────────────────────────────────────────────
 * Clé = SHA-256 du numéro de téléphone (pas le numéro en clair)
 * TTL auto via champ expires_at (Firestore TTL policy)
 * {
 *   full_name: string
 *   phone: string
 *   operator: string
 *   pin_hash: string
 *   created_at: Timestamp
 *   expires_at: Timestamp  // +10 minutes
 * }
 *
 * ─────────────────────────────────────────────────────────
 * Collection : groups/{groupId}
 * ─────────────────────────────────────────────────────────
 * {
 *   name: string
 *   description?: string
 *   photo_url?: string
 *   admin_uid: string
 *   treasurer_uid: string
 *   treasurer_name: string
 *   treasurer_phone: string
 *   treasurer_operator: 'airtel' | 'orange' | 'mpesa' | 'mtn'
 *   contribution_amount: number
 *   currency: 'CDF' | 'USD'
 *   payment_deadline_day: number
 *   late_penalty_percent: number
 *   require_approval: boolean
 *   contributions_visible: boolean
 *   invite_code: string
 *   is_active: boolean
 *   member_count: number
 *   collected_amount: number
 *   created_at: Timestamp
 *   updated_at: Timestamp
 * }
 *
 * Sous-collection : groups/{groupId}/members/{userId}
 * {
 *   uid: string
 *   full_name: string
 *   phone: string
 *   operator: string
 *   role: 'admin' | 'treasurer' | 'member' | 'auditor'
 *   status: 'active' | 'suspended' | 'removed'
 *   joined_at: Timestamp
 * }
 *
 * ─────────────────────────────────────────────────────────
 * Collection : contributions/{contributionId}
 * ─────────────────────────────────────────────────────────
 * {
 *   group_id: string
 *   member_uid: string
 *   member_name: string
 *   period_month: string          // 'YYYY-MM'
 *   amount_due: number
 *   amount_paid?: number
 *   currency: 'CDF' | 'USD'
 *   status: 'pending_approval' | 'paid' | 'rejected' | 'late'
 *   capture_image_url?: string
 *   capture_uploaded_at?: Timestamp
 *   member_note?: string
 *   gemini_analysis?: {
 *     is_payment_proof: boolean
 *     amount: number | null
 *     currency: string | null
 *     operator: string | null
 *     transaction_ref: string | null
 *     detected_date: string | null
 *     confidence: number
 *     warning_flags: string[]
 *     raw_text: string
 *   }
 *   approved_by?: string
 *   approved_at?: Timestamp
 *   rejection_reason?: string
 *   treasurer_notes?: string
 *   is_late: boolean
 *   penalty_amount: number
 *   receipt_url?: string
 *   created_at: Timestamp
 *   updated_at: Timestamp
 * }
 *
 * INDEX FIRESTORE REQUIS sur contributions :
 *   - group_id + period_month
 *   - group_id + status
 *   - group_id + member_uid + period_month
 *   - member_uid + period_month
 *
 * ─────────────────────────────────────────────────────────
 * Collection : notifications/{notificationId}
 * ─────────────────────────────────────────────────────────
 * {
 *   recipient_uid: string
 *   type: 'payment_confirmed' | 'payment_rejected' | 'new_submission' |
 *         'reminder' | 'late_payment' | 'new_member' | 'report_ready' |
 *         'info_requested' | 'system'
 *   title: string
 *   body: string
 *   data?: { contribution_id?: string; group_id?: string; month?: string }
 *   is_read: boolean
 *   created_at: Timestamp
 * }
 */

export {};
