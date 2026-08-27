export type Role = 'student' | 'agent' | 'admin'

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  role: Role
  status: 'active' | 'inactive'
  created_at: string
}

export interface StudentProfile {
  id: string
  user_id: string
  registration_number: string | null
  programme: string | null
  school: string | null
  graduation_year: number | null
  school_id: string | null
  programme_id: string | null
  created_at: string
}

export interface School {
  id: string
  name: string
  short_name: string | null
  order: number
  active: boolean
}

export interface Programme {
  id: string
  school_id: string
  name: string
  code: string | null
  order: number
  active: boolean
}

export type RequestStatus =
  | 'payment_pending'
  | 'payment_confirmed'
  | 'request_submitted'
  | 'agent_assigned'
  | 'in_progress'
  | 'action_required'
  | 'final_verification'
  | 'completed'
  | 'cancelled'

export interface ClearanceRequest {
  id: string
  request_number: string
  student_user_id: string
  service_name: string
  service_fee: number
  status: RequestStatus
  assigned_agent_id: string | null
  passport_photo_url: string | null
  priority: 'normal' | 'high'
  current_note: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  student?: {
    full_name?: string | null
    phone?: string | null
    email?: string | null
    registration_number?: string | null
    programme?: string | null
    school?: string | null
    graduation_year?: number | null
    student_profiles?: {
      school?: string | null
      school_id?: string | null
      programme?: string | null
    }[] | null
  } | null
  agent?: {
    full_name?: string | null
  } | null
}

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'action_required' | 'completed' | 'failed'

export interface ClearanceTask {
  id: string
  request_id: string
  stage_id: string
  agent_id: string | null
  status: TaskStatus
  notes: string | null
  started_at: string | null
  completed_at: string | null
  updated_at: string
  stage?: { id: string; name: string; order: number }
}

export interface Evidence {
  id: string
  task_id: string
  file_path: string
  file_name: string
  uploaded_by: string | null
  created_at: string
}

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'

export interface Payment {
  id: string
  request_id: string | null
  gown_order_id: string | null
  kind: 'service_fee' | 'gown'
  amount: number
  transaction_reference: string | null
  provider: string
  status: PaymentStatus
  failure_reason: string | null
  paid_at: string | null
  created_at: string
}

export type GownSize = 'small' | 'medium' | 'large'
export type GownStatus = 'ordered' | 'paid' | 'ready_for_pickup' | 'collected' | 'cancelled'
export type RegaliaCategory = 'gown' | 'sash' | 'suit' | 'shoes'
export type RegaliaGender = 'male' | 'female' | 'unisex'

export interface RegaliaItem {
  id: string
  category: RegaliaCategory
  name: string
  description: string | null
  image_path: string
  gender: RegaliaGender | null
  price: number
  active: boolean
  sort_order: number
  created_at: string
}

export interface GownOrder {
  id: string
  student_user_id: string
  agent_id: string | null
  item_type: RegaliaCategory
  gender: RegaliaGender | null
  size: string
  ceremony_date: string
  pickup_location: string
  status: GownStatus
  price: number
  receipt_url: string | null
  notes: string | null
  custom_name: string | null
  custom_note: string | null
  catalog_item_id: string | null
  custom_design_url: string | null
  created_at: string
  updated_at: string
  student?: {
    full_name?: string | null
    phone?: string | null
    registration_number?: string | null
    student_profiles?: {
      registration_number?: string | null
    }[] | null
  } | null
  agent?: {
    full_name?: string | null
  } | null
  catalog_item?: {
    id: string
    name: string
    image_path: string
  } | null
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  read: boolean
  link: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  request_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Stage {
  id: string
  name: string
  description: string | null
  order: number
  active: boolean
}