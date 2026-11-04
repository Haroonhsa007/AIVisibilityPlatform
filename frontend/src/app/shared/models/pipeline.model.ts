export type RunStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed';
export type RunStage = 'discovery' | 'scoring' | 'recommendations';

export interface PipelineRun {
  run_uuid: string;
  profile_uuid: string;
  status: RunStatus;
  queries_discovered: number;
  queries_scored: number;
  tokens_used: number;
  stage?: RunStage | null;
  recommendations_created?: number;
  error_message?: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  profile_name?: string;
}
