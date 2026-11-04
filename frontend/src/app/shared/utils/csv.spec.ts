import { csvCell, csvRows, queriesCsv, queryCsvFilename } from './csv';
import { QueryItem } from '../models';

describe('CSV export', () => {
  it('quotes commas, CRLFs and double quotes using RFC 4180', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('one\r\ntwo')).toBe('"one\r\ntwo"');
    expect(csvCell('say "hello"')).toBe('"say ""hello"""');
    expect(
      csvRows([
        ['a', 'b'],
        ['one,two', 'three'],
      ]),
    ).toBe('\uFEFFa,b\r\n"one,two",three\r\n');
  });
  for (const value of ['=SUM(A1)', '+cmd', '-cmd', '@SUM(A1)', '\t=cmd', '  +cmd']) {
    it(`guards spreadsheet formula ${JSON.stringify(value)}`, () =>
      expect(csvCell(value)).toBe("'" + value));
  }
  it('preserves zeros and booleans while representing missing values as empty cells', () => {
    expect(csvRows([[0, false, true, null, undefined]])).toBe('\uFEFF0,false,true,,\r\n');
  });
  it('exports only the seven contract columns with a BOM and does not invent null scores', () => {
    const query: QueryItem = {
      query_uuid: 'q',
      profile_uuid: 'p',
      run_uuid: 'r',
      query_text: 'Which tool?',
      opportunity_score: null,
      domain_visible: null,
      visibility_position: null,
      discovered_at: '2026-11-04T12:00:00Z',
    };
    const csv = queriesCsv([query]);
    expect(
      csv.startsWith(
        '\uFEFFquery_text,estimated_search_volume,competitive_difficulty,opportunity_score,domain_visible,visibility_position,discovered_at\r\n',
      ),
    ).toBeTrue();
    expect(csv).toContain('Which tool?,,,,,,2026-11-04T12:00:00Z');
    expect(csv).not.toContain('query_uuid');
  });
  it('uses a safe domain and the browser-local calendar date in the filename', () => {
    expect(queryCsvFilename('surferseo.com', new Date(2026, 10, 4, 23, 0))).toBe(
      'surferseo.com-queries-2026-11-04.csv',
    );
  });
});
