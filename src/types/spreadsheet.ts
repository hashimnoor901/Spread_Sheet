
export type CellAddress = string;

export interface Cell {
  raw: string;
  value: string | number | null;
  error?: string;
}

export interface Sheet {
  id: string;
  name: string;
  cells: Record<CellAddress, Cell>;
}

export interface Selection {
  start: CellAddress;
  end: CellAddress;
}

export interface SpreadsheetState {
  sheets: Sheet[];
  activeSheetId: string;
  activeCell: CellAddress;
  selection: Selection;
}
