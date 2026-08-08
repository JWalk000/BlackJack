/**
 * Excel export / import for Estate deals (SheetJS).
 * Sheets: Deal (metadata + underwriting) and Costs (line items).
 */

import * as XLSX from "xlsx";
import type { CostItem, Deal } from "@/lib/types";
import {
  createDeal,
  dealTitle,
  saveDeal,
  templateCostItems,
} from "@/lib/deals";

const DEAL_KEYS = [
  ["id", "id"],
  ["name", "property.name"],
  ["description", "property.description"],
  ["address", "property.address"],
  ["city", "property.city"],
  ["state", "property.state"],
  ["zip", "property.zip"],
  ["apn", "property.apn"],
  ["buildMode", "buildMode"],
  ["propertyClass", "propertyClass"],
  ["exitStrategy", "exitStrategy"],
  ["propertyType", "property.propertyType"],
  ["condition", "property.condition"],
  ["bedrooms", "property.bedrooms"],
  ["bathsFull", "property.bathsFull"],
  ["bathsHalf", "property.bathsHalf"],
  ["yearBuilt", "property.yearBuilt"],
  ["buildingSf", "property.buildingSf"],
  ["lotSf", "property.lotSf"],
  ["units", "property.units"],
  ["floors", "property.floors"],
  ["zoning", "property.zoning"],
  ["lastSaleAmount", "property.lastSaleAmount"],
  ["lastSaleDate", "property.lastSaleDate"],
  ["taxAssessment", "property.taxAssessment"],
  ["taxAmount", "property.taxAmount"],
  ["purchasePrice", "assumptions.purchasePrice"],
  ["closingCosts", "assumptions.closingCosts"],
  ["closingCostsManual", "assumptions.closingCostsManual"],
  ["projectMonths", "assumptions.projectMonths"],
  ["monthsToSaleOrRent", "assumptions.monthsToSaleOrRent"],
  ["costOfSalePct", "assumptions.costOfSalePct"],
  ["arv", "assumptions.arv"],
  ["grossRentMonthly", "assumptions.grossRentMonthly"],
  ["otherIncomeMonthly", "assumptions.otherIncomeMonthly"],
  ["vacancyPct", "assumptions.vacancyPct"],
  ["operatingExpensesMonthly", "assumptions.operatingExpensesMonthly"],
  ["refinance", "assumptions.refinance"],
  ["permanentLtvPct", "assumptions.permanentLtvPct"],
  ["permanentRatePct", "assumptions.permanentRatePct"],
  ["permanentTermYears", "assumptions.permanentTermYears"],
  ["financingStyle", "financing.style"],
  ["ltvPct", "financing.ltvPct"],
  ["interestRatePct", "financing.interestRatePct"],
  ["pointsPct", "financing.pointsPct"],
  ["termMonths", "financing.termMonths"],
] as const;

function getPath(deal: Deal, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = deal;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setPath(deal: Deal, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = deal as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1]!;
  cur[last] = value;
}

function parseCell(raw: unknown): string | number | boolean | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim();
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "—") return null;
  const n = Number(s.replace(/[$,]/g, ""));
  if (s !== "" && Number.isFinite(n) && /^-?[\d.,]+$/.test(s.replace(/[$,]/g, ""))) {
    return n;
  }
  return s;
}

/** Build workbook and trigger browser download. */
export function downloadDealExcel(deal: Deal): void {
  const dealRows: { Field: string; Value: string | number | boolean }[] =
    DEAL_KEYS.map(([key, path]) => ({
      Field: key,
      Value: (getPath(deal, path) ?? "") as string | number | boolean,
    }));
  dealRows.push({ Field: "title", Value: dealTitle(deal) });
  dealRows.push({ Field: "exportedAt", Value: new Date().toISOString() });

  const costRows = deal.costItems.map((c) => ({
    category: c.category,
    label: c.label,
    amount: c.amount,
    notes: c.notes || "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(dealRows),
    "Deal",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      costRows.length
        ? costRows
        : [{ category: "", label: "", amount: 0, notes: "" }],
    ),
    "Costs",
  );

  const safe = dealTitle(deal)
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .slice(0, 40) || "deal";
  XLSX.writeFile(wb, `estate-${safe}.xlsx`);
}

/**
 * Parse Excel workbook into a Deal. Prefer Costs sheet for line items.
 * Unknown / blank keys keep defaults from template.
 */
export function dealFromExcelArrayBuffer(
  buf: ArrayBuffer,
  options?: { replaceId?: string },
): { deal: Deal; error?: string } {
  try {
    const wb = XLSX.read(buf, { type: "array" });
    const dealSheet = wb.Sheets["Deal"] || wb.Sheets[wb.SheetNames[0]!];
    if (!dealSheet) {
      return {
        deal: createDeal({}),
        error: "No Deal sheet found in workbook",
      };
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(dealSheet, {
      defval: "",
    });
    const map = new Map<string, unknown>();
    for (const row of rows) {
      const field = String(row.Field ?? row.field ?? row.Key ?? Object.values(row)[0] ?? "")
        .trim();
      const value =
        row.Value !== undefined
          ? row.Value
          : row.value !== undefined
            ? row.value
            : Object.values(row)[1];
      if (field) map.set(field, value);
    }

    const buildModeRaw = String(map.get("buildMode") || "rehab");
    const propertyClassRaw = String(map.get("propertyClass") || "residential");
    const buildMode =
      buildModeRaw === "new_build" ? "new_build" : "rehab";
    const propertyClass =
      propertyClassRaw === "commercial" ? "commercial" : "residential";

    const deal = createDeal({
      buildMode,
      propertyClass,
      costItems: templateCostItems(buildMode, propertyClass),
    });
    if (options?.replaceId) {
      deal.id = options.replaceId;
    }

    for (const [key, path] of DEAL_KEYS) {
      if (key === "id" && !options?.replaceId) continue;
      if (!map.has(key)) continue;
      const parsed = parseCell(map.get(key));
      if (parsed === null && key !== "description") continue;
      if (key === "buildMode" || key === "propertyClass") continue;
      if (key === "exitStrategy") {
        deal.exitStrategy = parsed === "hold" ? "hold" : "flip";
        continue;
      }
      if (key === "financingStyle") {
        const s = String(parsed);
        if (s === "hard_money" || s === "conventional" || s === "all_cash") {
          deal.financing.style = s;
        }
        continue;
      }
      setPath(deal, path, parsed);
    }

    const costsSheet = wb.Sheets["Costs"];
    if (costsSheet) {
      const costRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        costsSheet,
        { defval: "" },
      );
      const items: CostItem[] = [];
      for (const row of costRows) {
        const label = String(row.label ?? row.Label ?? "").trim();
        if (!label) continue;
        items.push({
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `c-${Date.now()}-${items.length}`,
          category: String(row.category ?? row.Category ?? "Custom").trim() || "Custom",
          label,
          amount: Number(parseCell(row.amount ?? row.Amount) || 0) || 0,
          notes: String(row.notes ?? row.Notes ?? "").trim() || undefined,
        });
      }
      if (items.length) deal.costItems = items;
    }

    deal.updatedAt = new Date().toISOString();
    return { deal };
  } catch (e) {
    return {
      deal: createDeal({}),
      error: e instanceof Error ? e.message : "Could not read Excel file",
    };
  }
}

/** Import file and save to localStorage; returns saved deal. */
export async function importDealFromExcelFile(
  file: File,
  options?: { replaceId?: string },
): Promise<{ deal?: Deal; error?: string }> {
  const buf = await file.arrayBuffer();
  const { deal, error } = dealFromExcelArrayBuffer(buf, options);
  if (error && !deal.id) return { error };
  const saved = saveDeal(deal);
  return { deal: saved, error };
}
