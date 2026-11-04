import { ChartData } from 'chart.js';
import { QueryItem } from '../../../shared/models';

export interface ChartPalette {
  visible: string;
  notVisible: string;
  unknown: string;
  text: string;
  border: string;
}

export function truncateQuery(text: string): string {
  return text.length > 30 ? text.slice(0, 29) + '…' : text;
}
export function buildChartData(
  queries: readonly QueryItem[],
  palette: ChartPalette,
): ChartData<'bar', (number | null)[], string> {
  return {
    labels: queries.map((query) => truncateQuery(query.query_text)),
    datasets: [
      {
        label: 'Opportunity score',
        data: queries.map((query) => query.opportunity_score),
        backgroundColor: queries.map((query) =>
          query.domain_visible === true
            ? palette.visible
            : query.domain_visible === false
              ? palette.notVisible
              : palette.unknown,
        ),
        borderRadius: 2,
        maxBarThickness: 28,
      },
    ],
  };
}

export function readChartPalette(document: Document): ChartPalette {
  const style = document.defaultView?.getComputedStyle(document.documentElement);
  const token = (name: string): string => style?.getPropertyValue(name).trim() ?? '';
  return {
    visible: token('--chart-visible'),
    notVisible: token('--chart-not-visible'),
    unknown: token('--muted'),
    text: token('--text'),
    border: token('--border'),
  };
}
