export type Priority = 'high' | 'medium' | 'low';
export type ContentType = 'blog_post' | 'landing_page' | 'faq';

export interface Recommendation {
  recommendation_uuid: string;
  target_query_uuid: string;
  content_type: ContentType;
  title: string;
  rationale: string;
  target_keywords: string[];
  priority: Priority;
  profile_uuid?: string;
  target_query_text?: string;
  created_at?: string;
}
