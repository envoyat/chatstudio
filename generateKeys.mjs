import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const { privateKey, publicKey } = await generateKeyPair("RS256", {
  extractable: true,
});
const pkcs8 = await exportPKCS8(privateKey);
const jwk = await exportJWK(publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...jwk }] });

console.log(`JWT_PRIVATE_KEY="${pkcs8.trim().replace(/\n/g, " ")}"`);
console.log(`JWKS=${jwks}`);
