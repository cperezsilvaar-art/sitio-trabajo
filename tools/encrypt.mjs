// Uso: node tools/encrypt.mjs <datos.json> <contraseña> <salida.enc.json>
// Cifra un JSON con el mismo formato que usa el sitio.
import { readFileSync, writeFileSync } from "node:fs";
import { encryptData, decryptData } from "../js/crypto.js";

const [inFile, password, outFile] = process.argv.slice(2);
if (!inFile || !password || !outFile) {
  console.error("Uso: node tools/encrypt.mjs <datos.json> <contraseña> <salida.enc.json>");
  process.exit(1);
}
const data = JSON.parse(readFileSync(inFile, "utf8"));
const payload = await encryptData(data, password);
const check = await decryptData(payload, password);
if (JSON.stringify(check) !== JSON.stringify(data)) throw new Error("Verificación fallida");
writeFileSync(outFile, JSON.stringify(payload));
console.log(`OK: ${outFile} (${data.people?.length ?? 0} personas, ${data.minutes?.length ?? 0} minutas)`);
