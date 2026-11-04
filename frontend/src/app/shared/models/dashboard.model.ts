import { PipelineRun } from './pipeline.model';

export interface Dashboard {
  total_profiles: number;
  total_queries: number;
  avg_opportunity_score: number | null;
  recent_runs: PipelineRun[];
}
