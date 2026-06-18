export interface WeeklySurvey {
  id: string
  title: string
  description?: string | null
  week_start_date: string
  week_end_date: string
  is_active: boolean
  questions: SurveyQuestion[]
  target_roles: string[]
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface SurveyQuestion {
  id: string
  label: string
  type: 'textarea' | 'text' | 'rating' | 'select'
  required: boolean
  options?: string[]
}

export interface SurveyResponse {
  id: string
  survey_id: string
  user_id: string
  answers: Record<string, string>
  submitted_at: string
  created_at: string
}

export interface SurveyWithResponseCount extends WeeklySurvey {
  response_count: number
}
