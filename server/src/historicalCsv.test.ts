import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHistoricalCsv } from './historicalCsv.js';

test('CSV parser handles CRLF, commas, quoted newlines, and escaped quotes', () => {
  assert.deepEqual(parseHistoricalCsv('name,description\r\nSolar,"clean, reliable"\r\n"Brand\nNew","said ""hello"""'), [
    ['name', 'description'],
    ['Solar', 'clean, reliable'],
    ['Brand\nNew', 'said "hello"'],
  ]);
});

test('CSV parser skips blank rows and preserves empty cells', () => {
  assert.deepEqual(parseHistoricalCsv('a,b,c\n1,,3\n\n  , , \n'), [['a', 'b', 'c'], ['1', '', '3']]);
});

test('CSV parser rejects unterminated quotes', () => {
  assert.throws(() => parseHistoricalCsv('a,b\n1,"oops'), /unterminated quoted field/i);
});

test('CSV parser rejects characters after a closing quote', () => {
  assert.throws(() => parseHistoricalCsv('a,b\n1,"value"tail'), /after a closing quote/i);
});
