/**
 * STRUCTURE DES COLLECTIONS FIRESTORE — ContribApp RDC
 *
 * Collection : users/{userId}
 * {
 *   uid: string               // = Firebase Auth UID
 *   full_name: string
 *   phone: string             // +243XXXXXXXXX
 *   operator: 'airtel' | 'orange' | 'mpesa' | 'mtn'
 *   profile_photo_url?: string  // URL Cloudflare R2
 *   is_verified: boolean
 *   created_at: Timestamp
 *   preferences: {
 *     language: 'fr' | 'ln' | 'sw'
 *     currency_display: 'CDF' | 'USD'
 *     push_enabled: boolean
 *     sms_enabled: boolean
 *   }
 * }
 *
 * Collection : groups/{groupId}
 * {
 *   name: string
 *   description?: string
 *   photo_url?: string          // URL Cloudflare R2
 *   admin_uid: string           // Firebase UID de l'admin
 *   treasurer_uid: string
 *   treasurer_phone: string
 *   treasurer_operator: string
 *   contribution_amount: number
 *   currency: 'CDF' | 'USD'
 *   payment_deadline_day: number  // 1-28
 *   late_penalty_percent: number  // 0 si pas de pénalité
 *   require_approval: boolean
 *   contributions_visible: boolean
 *   invite_code: string           // 8 caractères unique
 *   is_active: boolean
 *   created_at: Timestamp
 *   member_count: number          // dénormalisé pour performance
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
 * Collection : contributions/{contributionId}
 * {
 *   group_id: string
 *   member_uid: string
 *   member_name: string           // dénormalisé
 *   period_month: string          // format 'YYYY-MM'
 *   amount_due: number
 *   amount_paid?: number
 *   status: 'pending' | 'paid' | 'failed' | 'late'
 *   payment_method?: 'airtel' | 'orange' | 'mpesa' | 'mtn'
 *   transaction_ref?: string      // référence opérateur
 *   aggregator_ref?: string       // référence FlexPay/SerdiPay
 *   paid_at?: Timestamp
 *   is_late: boolean
 *   penalty_amount: number
 *   receipt_url?: string          // URL Cloudflare R2
 *   created_at: Timestamp
 * }
 *
 * Collection : notifications/{notificationId}
 * {
 *   recipient_uid: string
 *   type: 'payment_received' | 'payment_confirmed' | 'reminder' | 
 *         'late_payment' | 'new_member' | 'report_ready' | 'system'
 *   title: string
 *   body: string
 *   data?: Record<string, string>  // ex: { contribution_id, group_id }
 *   is_read: boolean
 *   created_at: Timestamp
 * }
 */

export {}; // fichier de documentation uniquement
