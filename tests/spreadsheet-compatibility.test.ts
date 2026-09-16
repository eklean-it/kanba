import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

describe('patched spreadsheet parser compatibility', () => {
  it('preserves the Monday export title, status, date and blank cells', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Name', 'Status', 'Due Date', 'Person'],
      ['Staging follow-up', 'Working on it', new Date('2026-09-17T00:00:00Z'), ''],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Tasks');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const parsed = XLSX.read(bytes, { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]], { header: 1, defval: '' }) as unknown[][];
    expect(rows[0]).toEqual(['Name', 'Status', 'Due Date', 'Person']);
    expect(rows[1][0]).toBe('Staging follow-up');
    expect(rows[1][1]).toBe('Working on it');
    expect(rows[1][2]).toBeInstanceOf(Date);
    expect((rows[1][2] as Date).toISOString().slice(0, 10)).toBe('2026-09-17');
    expect(rows[1][3]).toBe('');
  });

  it('retains quoted commas in CSV exports', () => {
    const parsed = XLSX.read('Name,Status\n"Call office, confirm",Done\n', { type: 'string' });
    expect(XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]]))
      .toEqual([{ Name: 'Call office, confirm', Status: 'Done' }]);
  });
});
