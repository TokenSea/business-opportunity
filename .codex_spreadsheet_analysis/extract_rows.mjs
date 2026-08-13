import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "C:/Users/李同鑫/Desktop/第三方模型评测验收标准v3.1 -- 对外版(1)(1).xlsx";
const startRow = Number(process.argv[2] ?? 1);
const endRow = Number(process.argv[3] ?? 103);

const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("供应商版本");
const values = sheet.getRange(`A${startRow}:F${endRow}`).values;

for (let i = 0; i < values.length; i += 1) {
  const rowNumber = startRow + i;
  const cells = values[i].map((value) => value == null ? "" : String(value).replace(/\r?\n/g, " / "));
  console.log(`${rowNumber}\t${cells.join("\t")}`);
}
