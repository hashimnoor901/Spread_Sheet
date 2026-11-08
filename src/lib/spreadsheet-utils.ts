
import type { CellAddress } from "@/types/spreadsheet";

export function columnToLetter(column: number): string {
  let result = "";
  let n = column;

  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }

  return result;
}

export function letterToColumn(letter: string): number {
  let result = 0;

  for (const char of letter.toUpperCase()) {
    result = result * 26 + char.charCodeAt(0) - 64;
  }

  return result;
}

export function getCellAddress(
  row: number,
  column: number
): CellAddress {
  return `${columnToLetter(column)}${row}`;
}

export function parseCellAddress(address: CellAddress) {
  const match = address.toUpperCase().match(/^([A-Z]+)([1-9]\d*)$/);

  if (!match) return null;

  return {
    column: letterToColumn(match[1]),
    row: Number(match[2]),
  };
}

export function getColumnLabel(index: number) {
  return columnToLetter(index + 1);
}
