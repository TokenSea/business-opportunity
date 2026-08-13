import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "C:/Users/李同鑫/Desktop/第三方模型评测验收标准v3.1 -- 对外版(1)(1).xlsx";
const range = process.argv[2] ?? "A1:F103";

const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);
const preview = await workbook.render({
  sheetName: "供应商版本",
  range,
  scale: 1,
  format: "png",
});
const bytes = new Uint8Array(await preview.arrayBuffer());
process.stdout.write(Buffer.from(bytes).toString("base64"));
