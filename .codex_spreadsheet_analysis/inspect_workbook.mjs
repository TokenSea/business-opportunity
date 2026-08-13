import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "C:/Users/李同鑫/Desktop/第三方模型评测验收标准v3.1 -- 对外版(1)(1).xlsx";
const outputDir = "C:/work/business opportunity/.codex_spreadsheet_analysis/rendered";

const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table,definedName,drawing",
  maxChars: 12000,
  tableMaxRows: 12,
  tableMaxCols: 16,
  tableMaxCellChars: 200,
});
console.log("===OVERVIEW===");
console.log(overview.ndjson);

const sheetInfo = [];
for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange();
  const address = used?.address ?? null;
  const values = used?.values ?? [];
  const formulas = used?.formulas ?? [];
  sheetInfo.push({ name: sheet.name, address, values, formulas });

  const safeName = sheet.name.replace(/[\\/:*?"<>|]/g, "_");
  try {
    const preview = await workbook.render({
      sheetName: sheet.name,
      autoCrop: "all",
      scale: 1.5,
      format: "png",
    });
    await fs.writeFile(
      path.join(outputDir, `${safeName}.png`),
      new Uint8Array(await preview.arrayBuffer()),
    );
  } catch (error) {
    console.error(`RENDER_ERROR ${sheet.name}: ${error?.message ?? error}`);
  }
}

console.log("===SHEETS_JSON===");
console.log(JSON.stringify(sheetInfo, null, 2));
