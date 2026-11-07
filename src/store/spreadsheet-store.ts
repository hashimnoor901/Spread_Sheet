
import { create } from "zustand";
import type { Sheet, SpreadsheetState } from "@/types/spreadsheet";

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

interface SpreadsheetActions {
  setActiveCell: (address: string) => void;
  updateCell: (address: string, raw: string) => void;
  addSheet: () => void;
  renameSheet: (id: string, name: string) => void;
  setActiveSheet: (id: string) => void;
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

        const value =
          raw.trim() === ""
            ? null
            : /^-?\d+(\.\d+)?$/.test(raw.trim())
              ? Number(raw)
              : raw;

        return {
          ...sheet,
          cells: {
            ...sheet.cells,
            [address]: {
              raw,
              value,
            },
          },
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
