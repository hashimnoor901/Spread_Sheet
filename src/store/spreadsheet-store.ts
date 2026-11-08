
import { create } from "zustand";
import type { Cell, Sheet, SpreadsheetState } from "@/types/spreadsheet";
import { getCellAddress, parseCellAddress } from "@/lib/spreadsheet-utils";

interface SpreadsheetActions {
  setActiveCell: (address: string) => void;
  updateCell: (address: string, raw: string) => void;
  addSheet: () => void;
  renameSheet: (id: string, name: string) => void;
  setActiveSheet: (id: string) => void;
}

type FormulaArgument = number | number[];

const initialSheet: Sheet = {
  id: "budget-2026",
  name: "Budget 2026",
  cells: {
    A1: { raw: "Category", value: "Category" },
    B1: { raw: "Budget", value: "Budget" },
    C1: { raw: "Actual", value: "Actual" },
    D1: { raw: "Variance", value: "Variance" },

    A2: { raw: "Marketing", value: "Marketing" },
    B2: { raw: "5000", value: 5000 },
    C2: { raw: "4200", value: 4200 },
    D2: { raw: "=B2-C2", value: 800 },

    A3: { raw: "Development", value: "Development" },
    B3: { raw: "8000", value: 8000 },
    C3: { raw: "7600", value: 7600 },
    D3: { raw: "=B3-C3", value: 400 },

    A4: { raw: "Operations", value: "Operations" },
    B4: { raw: "4000", value: 4000 },
    C4: { raw: "4500", value: 4500 },
    D4: { raw: "=B4-C4", value: -500 },

    A5: { raw: "Salaries", value: "Salaries" },
    B5: { raw: "12000", value: 12000 },
    C5: { raw: "11500", value: 11500 },
    D5: { raw: "=B5-C5", value: 500 },
  },
};

function calculateCells(
  cells: Record<string, Cell>
): Record<string, Cell> {
  const cache = new Map<string, Cell>();
  const visiting = new Set<string>();

  function getCell(address: string): Cell {
    const normalized = address.toUpperCase();

    if (cache.has(normalized)) {
      return cache.get(normalized)!;
    }

    const original = cells[normalized];

    if (!original) {
      return { raw: "", value: null };
    }

    if (visiting.has(normalized)) {
      throw new Error("#CYCLE!");
    }

    const raw = original.raw.trim();

    if (!raw.startsWith("=")) {
      const value =
        raw === ""
          ? null
          : /^-?\d+(\.\d+)?$/.test(raw)
            ? Number(raw)
            : raw;

      const result: Cell = { raw: original.raw, value };
      cache.set(normalized, result);
      return result;
    }

    visiting.add(normalized);

    try {
const value = evaluateFormula(
  raw.slice(1),
  getNumericValue,
  getRangeValues,
  cells
);

      const result: Cell = {
        raw: original.raw,
        value,
      };

      cache.set(normalized, result);
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "#ERROR!";

      const result: Cell = {
        raw: original.raw,
        value: null,
        error: message.startsWith("#") ? message : "#ERROR!",
      };

      cache.set(normalized, result);
      return result;
    } finally {
      visiting.delete(normalized);
    }
  }

  function getNumericValue(
    address: string,
    ignoreText = false
  ): number {
    const cell = getCell(address);

    if (cell.error) {
      throw new Error(cell.error);
    }

    if (cell.value === null || cell.value === "") return 0;

    if (typeof cell.value === "number") return cell.value;

    if (ignoreText) return 0;

    throw new Error("#VALUE!");
  }

  function getRangeValues(start: string, end: string): number[] {
    const first = parseCellAddress(start);
    const last = parseCellAddress(end);

    if (!first || !last) throw new Error("#REF!");

    const minRow = Math.min(first.row, last.row);
    const maxRow = Math.max(first.row, last.row);
    const minCol = Math.min(first.column, last.column);
    const maxCol = Math.max(first.column, last.column);

    if ((maxRow - minRow + 1) * (maxCol - minCol + 1) > 100000) {
      throw new Error("#VALUE!");
    }

    const values: number[] = [];

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const address = getCellAddress(row, col);
        const value = getNumericValue(address, true);

        const cell = getCell(address);

        if (typeof cell.value === "number") {
          values.push(value);
        }
      }
    }

    return values;
  }

  for (const address of Object.keys(cells)) {
    getCell(address);
  }

  return Object.fromEntries(cache);
}

function evaluateFormula(
  formula: string,
  getNumericValue: (address: string, ignoreText?: boolean) => number,
  getRangeValues: (start: string, end: string) => number[],
  cells: Record<string, Cell>
): number {
  const tokens: string[] = [];
  const pattern =
    /\s*(?:(\d+(?:\.\d*)?|\.\d+)|([A-Za-z]+\d+)|([A-Za-z]+)|([()+\-*/^,:]))/y;

  let position = 0;

  while (position < formula.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(formula);

    if (!match) throw new Error("#ERROR!");

    tokens.push(match[1] || match[2] || match[3] || match[4]);
    position = pattern.lastIndex;
  }

  let index = 0;

  const peek = () => tokens[index];
  const consume = () => tokens[index++];

  function expression(): number {
    let value = term();

    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = term();

      value =
        operator === "+"
          ? value + right
          : value - right;
    }

    return value;
  }

  function term(): number {
    let value = power();

    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const right = power();

      if (operator === "/" && right === 0) {
        throw new Error("#DIV/0!");
      }

      value =
        operator === "*"
          ? value * right
          : value / right;
    }

    return value;
  }

  function power(): number {
    let value = unary();

    if (peek() === "^") {
      consume();
      value = Math.pow(value, power());
    }

    return value;
  }

  function unary(): number {
    if (peek() === "-") {
      consume();
      return -unary();
    }

    if (peek() === "+") {
      consume();
      return unary();
    }

    return primary();
  }

  function primary(): number {
    const token = peek();

    if (!token) throw new Error("#ERROR!");

    if (token === "(") {
      consume();
      const value = expression();

      if (consume() !== ")") throw new Error("#ERROR!");

      return value;
    }

    if (/^\d+(\.\d*)?$|^\.\d+$/.test(token)) {
      consume();
      return Number(token);
    }

    if (/^[A-Za-z]+\d+$/.test(token)) {
      consume();
      return getNumericValue(token.toUpperCase());
    }

    if (/^[A-Za-z]+$/.test(token)) {
      consume();

      const functionName = token.toUpperCase();

      if (consume() !== "(") throw new Error("#NAME?");

      const args: FormulaArgument[] = [];

      if (peek() !== ")") {
        while (true) {
          if (/^[A-Za-z]+\d+$/.test(peek() || "")) {
            const address = consume().toUpperCase();

            if (peek() === ":") {
              consume();

              const end = consume();

              if (!/^[A-Za-z]+\d+$/.test(end || "")) {
                throw new Error("#REF!");
              }

              args.push(getRangeValues(address, end.toUpperCase()));
            } else {
              const cellValue = getNumericValue(address, true);
              const cell = getCellForFunction(address);

              args.push(
                typeof cell.value === "number" ? cellValue : []
              );
            }
          } else {
            args.push(expression());
          }

          if (peek() !== ",") break;

          consume();
        }
      }

      if (consume() !== ")") throw new Error("#ERROR!");

      const numbers = args.flatMap((arg) =>
        Array.isArray(arg) ? arg : [arg]
      );

      if (functionName === "SUM") {
        return numbers.reduce((sum, value) => sum + value, 0);
      }

      if (functionName === "AVG") {
        if (numbers.length === 0) throw new Error("#DIV/0!");

        return numbers.reduce((sum, value) => sum + value, 0) /
          numbers.length;
      }

      throw new Error("#NAME?");
    }

    throw new Error("#ERROR!");
  }

  // Helper used by aggregate functions to distinguish text from numbers.
  function getCellForFunction(address: string): Cell {
    return cells[ address.toUpperCase() ] || {
      raw: "",
      value: null,
    };
  }

  const result = expression();

  if (index !== tokens.length) throw new Error("#ERROR!");

  if (!Number.isFinite(result)) throw new Error("#VALUE!");

  return result;
}

export const useSpreadsheetStore = create<
  SpreadsheetState & SpreadsheetActions
>((set) => ({
  sheets: [initialSheet],
  activeSheetId: initialSheet.id,
  activeCell: "A1",
  selection: {
    start: "A1",
    end: "A1",
  },

  setActiveCell: (address) =>
    set({
      activeCell: address,
      selection: { start: address, end: address },
    }),

  updateCell: (address, raw) =>
    set((state) => ({
      sheets: state.sheets.map((sheet) => {
        if (sheet.id !== state.activeSheetId) return sheet;

        const updatedCells = {
          ...sheet.cells,
          [address.toUpperCase()]: {
            raw,
            value: null,
          },
        };

        return {
          ...sheet,
          cells: calculateCells(updatedCells),
        };
      }),
    })),

  addSheet: () =>
    set((state) => {
      const id = `sheet-${state.sheets.length + 1}`;

      return {
        sheets: [
          ...state.sheets,
          {
            id,
            name: `Sheet ${state.sheets.length + 1}`,
            cells: {},
          },
        ],
        activeSheetId: id,
        activeCell: "A1",
        selection: { start: "A1", end: "A1" },
      };
    }),

  renameSheet: (id, name) =>
    set((state) => ({
      sheets: state.sheets.map((sheet) =>
        sheet.id === id ? { ...sheet, name } : sheet
      ),
    })),

  setActiveSheet: (id) =>
    set({
      activeSheetId: id,
      activeCell: "A1",
      selection: { start: "A1", end: "A1" },
    }),
}));
