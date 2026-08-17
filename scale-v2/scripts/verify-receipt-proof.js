import fs from "node:fs/promises";
import { verifyReceiptProof } from "../src/domain/receipt-integrity.js";

async function readInput() {
  const file = process.argv[2];
  if (file) return fs.readFile(file, "utf8");
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

try {
  const raw = await readInput();
  if (!raw.trim()) throw new Error("Provide a receipt proof JSON file or pipe proof JSON on stdin");
  const proof = JSON.parse(raw);
  const result = verifyReceiptProof(proof);
  console.log(JSON.stringify(result, null, 2));
  if (!result.verified) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ verified: false, error: error.message }, null, 2));
  process.exitCode = 2;
}
