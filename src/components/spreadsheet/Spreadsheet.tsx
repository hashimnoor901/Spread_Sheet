
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Undo2, Redo2, Search, Settings2,
  ChevronDown, Grid3X3, CloudCheck, MoreHorizontal,
  Bold, Italic, Filter, ArrowDownToLine
} from "lucide-react";
import { useSpreadsheetStore } from "@/store/spreadsheet-store";
import { getCellAddress, parseCellAddress } from "@/lib/spreadsheet-utils";

const ROWS = 50;
const COLS = 20;

export default function Spreadsheet() {
  const sheets = useSpreadsheetStore((s) => s.sheets);
  const activeSheetId = useSpreadsheetStore((s) => s.activeSheetId);
  const activeCell = useSpreadsheetStore((s) => s.activeCell);
  const selection = useSpreadsheetStore((s) => s.selection);
  const setActiveCell = useSpreadsheetStore((s) => s.setActiveCell);
  const setSelection = useSpreadsheetStore((s) => s.setSelection);
  const updateCell = useSpreadsheetStore((s) => s.updateCell);
  const pasteCells = useSpreadsheetStore((s) => s.pasteCells);
  const addSheet = useSpreadsheetStore((s) => s.addSheet);
  const setActiveSheet = useSpreadsheetStore((s) => s.setActiveSheet);
  const renameSheet = useSpreadsheetStore((s) => s.renameSheet);
  const undo = useSpreadsheetStore((s) => s.undo);
const redo = useSpreadsheetStore((s) => s.redo);
const canUndo = useSpreadsheetStore((s) => s.past.length > 0);
const canRedo = useSpreadsheetStore((s) => s.future.length > 0);

  const sheet = sheets.find((s) => s.id === activeSheetId)!;
  const activeValue = sheet.cells[activeCell]?.raw ?? "";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [sheetNameDraft, setSheetNameDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragAnchorRef = useRef(activeCell);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const parsedAddress = parseCellAddress(activeCell);

  const startEditing = (initial?: string) => {
    setDraft(initial ?? activeValue);
    setEditing(true);
  };

  const commitEdit = () => {
    updateCell(activeCell, draft);
    setEditing(false);
    gridRef.current?.focus();
  };

  const moveCell = (
    rowDelta: number,
    colDelta: number,
    extendSelection = false
  ) => {
    const position = parseCellAddress(activeCell);
    if (!position) return;

    const row = Math.max(1, Math.min(10000, position.row + rowDelta));
    const col = Math.max(1, Math.min(16384, position.column + colDelta));
    const nextAddress = getCellAddress(row, col);

    if (extendSelection) {
      setSelection(selection.start, nextAddress);
    } else {
      setActiveCell(nextAddress);
    }
  };

  const handleCellMouseDown = (
    address: string,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (editing) commitEdit();

    const anchor = event.shiftKey ? selection.start : address;
    dragAnchorRef.current = anchor;
    isDraggingRef.current = !event.shiftKey;

    if (event.shiftKey) {
      setSelection(anchor, address);
    } else {
      setActiveCell(address);
    }

    gridRef.current?.focus();
  };

  const handleCellMouseEnter = (address: string) => {
    if (isDraggingRef.current) {
      setSelection(dragAnchorRef.current, address);
    }
  };

  const handleGridPaste = (
    event: React.ClipboardEvent<HTMLDivElement>
  ) => {
    if (editing) return;

    event.preventDefault();

    const clipboard = event.clipboardData;
    const plainText = clipboard.getData("text/plain");
    let matrix: string[][] = [];

    if (plainText !== "") {
      const rows = plainText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n");

      if (rows[rows.length - 1] === "") {
        rows.pop();
      }

      matrix = rows.map((row) => row.split("\t"));
    } else {
      const html = clipboard.getData("text/html");

      if (html) {
        const parsedDocument = new DOMParser().parseFromString(
          html,
          "text/html"
        );

        matrix = Array.from(parsedDocument.querySelectorAll("tr")).map(
          (row) =>
            Array.from(row.querySelectorAll("td, th")).map(
              (cell) => cell.textContent?.trim() ?? ""
            )
        );
      }
    }

    if (matrix.length > 0) {
      pasteCells(activeCell, matrix);
    }
  };

  const handleGridKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (editing) return;

    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "z"
    ) {
      event.preventDefault();

      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }

      return;
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveCell(-1, 0, event.shiftKey);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveCell(1, 0, event.shiftKey);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveCell(0, -1, event.shiftKey);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveCell(0, 1, event.shiftKey);
    } else if (event.key === "Tab") {
      event.preventDefault();
      moveCell(0, event.shiftKey ? -1 : 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      startEditing();
    } else if (event.key === "F2") {
      event.preventDefault();
      startEditing();
    } else if (event.key === "Escape") {
      setEditing(false);
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      startEditing(event.key);
    }
  };

  const selectionStats = useMemo(() => {
    const start = parseCellAddress(selection.start);
    const end = parseCellAddress(selection.end);
    if (!start || !end) return { count: 0, sum: 0, average: 0 };

    let count = 0;
    let sum = 0;
    let numericCount = 0;

    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minColumn = Math.min(start.column, end.column);
    const maxColumn = Math.max(start.column, end.column);

    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        const address = getCellAddress(row, column);
        const cell = sheet.cells[address];
        if (!cell || cell.raw.trim() === "") continue;
        count++;
        if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
          sum += cell.value;
          numericCount++;
        }
      }
    }

    return {
      count,
      sum,
      average: numericCount > 0 ? sum / numericCount : 0,
    };
  }, [sheet.cells, selection]);

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#20242d] dark:bg-[#101319] dark:text-[#edf0f5]">
      {/* Top navigation */}
      <header className="h-16 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#171b23] flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
            <Grid3X3 size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Sheetly</h1>
            <p className="text-[10px] text-gray-500 tracking-widest uppercase">
              Spreadsheet workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-2 text-xs text-emerald-600">
            <CloudCheck size={15} /> Local workspace
          </span>
          <button className="icon-button" title="Search">
            <Search size={17} />
          </button>
          <button className="icon-button" title="Settings">
            <Settings2 size={17} />
          </button>
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
            SN
          </div>
        </div>
      </header>

      {/* Document heading */}
      <section className="px-5 pt-6 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span>My workspace</span>
              <span>/</span>
              <span>Spreadsheets</span>
              <span>/</span>
              <span className="text-emerald-600">{sheet.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={sheet.name}
                onChange={(e) =>
                  renameSheet(sheet.id, e.target.value)
                }
                aria-label="Spreadsheet name"
                className="text-2xl font-bold tracking-tight bg-transparent outline-none w-auto max-w-full"
              />
              <ChevronDown size={17} className="text-gray-400" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Changes are stored in your current workspace
            </p>
          </div>

          <div className="flex gap-2">
            <button className="action-button">
              <ArrowDownToLine size={15} /> Export
            </button>
            <button className="primary-button" onClick={addSheet}>
              <Plus size={16} /> New sheet
            </button>
          </div>
        </div>
      </section>

      {/* Spreadsheet panel */}
      <section className="mx-4 sm:mx-5 mb-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#171b23] shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="h-12 px-3 flex items-center gap-1 border-b border-gray-200 dark:border-white/10 overflow-x-auto">
<button
  className="icon-button"
  title="Undo (Cmd/Ctrl + Z)"
  onClick={undo}
  disabled={!canUndo}
>
  <Undo2 size={17} />
</button>

<button
  className="icon-button"
  title="Redo (Cmd/Ctrl + Shift + Z)"
  onClick={redo}
  disabled={!canRedo}
>
  <Redo2 size={17} />
</button>
          <div className="toolbar-divider" />
          <button className="icon-button" title="Bold">
            <Bold size={16} />
          </button>
          <button className="icon-button" title="Italic">
            <Italic size={16} />
          </button>
          <div className="toolbar-divider" />
          <button className="action-button text-xs">
            <Filter size={15} /> Filter
          </button>
          <button className="icon-button ml-auto" title="More options">
            <MoreHorizontal size={18} />
          </button>
        </div>

        {/* Formula bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-white/10">
          <div className="w-16 shrink-0 text-center font-semibold text-sm bg-gray-100 dark:bg-white/10 rounded-md py-2">
            {activeCell}
          </div>
          <span className="text-gray-400 font-serif italic text-lg">fx</span>
          <input
            value={editing ? draft : activeValue}
            onFocus={() => {
              if (!editing) startEditing();
            }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={() => {
              if (editing) commitEdit();
            }}
            placeholder="Enter a value or formula..."
            aria-label="Formula bar"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm px-2 py-2"
          />
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          tabIndex={0}
          role="grid"
          aria-label={`${sheet.name} spreadsheet`}
          onKeyDown={handleGridKeyDown}
          onPaste={handleGridPaste}
          onMouseUp={() => {
            isDraggingRef.current = false;
          }}
          className="spreadsheet-scroll outline-none"
        >
          <div
            className="spreadsheet-grid"
            style={{
              gridTemplateColumns: `52px repeat(${COLS}, 140px)`,
              gridTemplateRows: `34px repeat(${ROWS}, 34px)`,
            }}
          >
            {/* Column header corner */}
            <div className="grid-corner">#</div>

            {/* Column headers */}
            {Array.from({ length: COLS }, (_, col) => (
              <div key={`col-${col}`} className="column-header">
                {String.fromCharCode(65 + col)}
              </div>
            ))}

            {/* Rows and cells */}
            {Array.from({ length: ROWS }, (_, row) => (
              <div key={`row-${row}`} className="contents">
                <div className="row-header">{row + 1}</div>

                {Array.from({ length: COLS }, (_, col) => {
                  const address = getCellAddress(row + 1, col + 1);
                  const cell = sheet.cells[address];
                  const isActive = activeCell === address;
                  const isEditing = editing && isActive;

                  return (
                    <div
                      key={address}
                      role="gridcell"
                      aria-selected={isActive}
                      aria-label={`${address}, ${cell?.value ?? "empty"}`}
                      onMouseDown={(event) => handleCellMouseDown(address, event)}
                      onMouseEnter={() => handleCellMouseEnter(address)}
                      onDoubleClick={() => {
                        isDraggingRef.current = false;
                        setActiveCell(address);
                        startEditing();
                      }}
                      className={`spreadsheet-cell ${
                        isActive ? "active-cell" : ""
                      } ${
                        (() => {
                          const start = parseCellAddress(selection.start);
                          const end = parseCellAddress(selection.end);
                          const current = parseCellAddress(address);
                          if (!start || !end || !current) return "";
                          const inside =
                            current.row >= Math.min(start.row, end.row) &&
                            current.row <= Math.max(start.row, end.row) &&
                            current.column >= Math.min(start.column, end.column) &&
                            current.column <= Math.max(start.column, end.column);
                          return inside && !isActive ? "bg-emerald-100/70 dark:bg-emerald-500/20" : "";
                        })()
                      }`}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();

                            if (e.key === "Enter" || e.key === "Tab") {
                              e.preventDefault();
                              commitEdit();
                              if (e.key === "Tab") moveCell(0, 1);
                              else moveCell(1, 0);
                            }

                            if (e.key === "Escape") {
                              e.preventDefault();
                              setEditing(false);
                            }
                          }}
                          onBlur={commitEdit}
                          className="cell-input"
                          aria-label={`Edit ${address}`}
                        />
                      ) : (
                      <span
                        className={`truncate block ${
                          cell?.error ? "text-red-600 font-semibold" : ""
                        }`}
                        title={cell?.error || undefined}
                      >
                        {cell?.error
                          ? cell.error
                          : cell?.value === null
                            ? ""
                            : cell?.value ?? ""}
                      </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Sheet tabs */}
        <div className="h-12 px-3 flex items-center gap-2 border-t border-gray-200 dark:border-white/10 overflow-x-auto">
          {sheets.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSheet(item.id)}
              onDoubleClick={() => {
                setRenaming(item.id);
                setSheetNameDraft(item.name);
              }}
              className={`sheet-tab ${
                activeSheetId === item.id ? "sheet-tab-active" : ""
              }`}
            >
              {renaming === item.id ? (
                <input
                  autoFocus
                  value={sheetNameDraft}
                  onChange={(e) => setSheetNameDraft(e.target.value)}
                  onBlur={() => {
                    renameSheet(item.id, sheetNameDraft || item.name);
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      renameSheet(item.id, sheetNameDraft || item.name);
                      setRenaming(null);
                    }
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-24 bg-transparent outline-none"
                />
              ) : item.name}
            </button>
          ))}
          <button
            onClick={addSheet}
            className="icon-button"
            aria-label="Add sheet"
          >
            <Plus size={17} />
          </button>
        </div>

        {/* Status bar */}
        <div className="h-9 px-4 bg-gray-50 dark:bg-[#131720] border-t border-gray-200 dark:border-white/10 flex items-center justify-between text-xs text-gray-500">
          <span>
            {parsedAddress
              ? `Cell ${activeCell} selected`
              : "Ready"}
          </span>
          <div className="flex items-center gap-4">
            <span>Count: {selectionStats.count}</span>
            <span>Sum: {selectionStats.sum.toLocaleString()}</span>
            <span>Average: {selectionStats.average.toLocaleString()}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
