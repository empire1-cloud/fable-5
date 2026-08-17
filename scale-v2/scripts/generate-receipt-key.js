import { createHash, generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateKeyB64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const publicKeyB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const fingerprint = `sha256:${createHash("sha256").update(Buffer.from(publicKeyB64, "base64")).digest("hex")}`;
const keyId = `empire1-receipts-${new Date().toISOString().slice(0, 10)}`;

console.log("# Store the PRIVATE value in your secret manager. Never commit it.");
console.log(`RECEIPT_SIGNING_KEY_ID=${keyId}`);
console.log(`RECEIPT_SIGNING_PRIVATE_KEY_B64=${privateKeyB64}`);
console.log(`RECEIPT_SIGNING_PUBLIC_KEY_B64=${publicKeyB64}`);
console.log(`# fingerprint=${fingerprint}`);
