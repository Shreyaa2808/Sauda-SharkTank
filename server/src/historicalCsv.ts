/** RFC 4180-style CSV parser for bounded historical import requests. */
export function parseHistoricalCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let justClosedQuote = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
        justClosedQuote = true;
      } else {
        field += char;
      }
      continue;
    }

    if (justClosedQuote && char !== ',' && char !== '\n' && char !== '\r') {
      throw new Error('CSV has unexpected characters after a closing quote.');
    }
    if (char === '"' && field.length === 0 && !justClosedQuote) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
      justClosedQuote = false;
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      justClosedQuote = false;
    } else {
      field += char;
      if (char !== '\r') justClosedQuote = false;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  row.push(field.replace(/\r$/, ''));
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}
