import { generateKeyPairSync, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signEnvelope, verifyEnvelope } from "./federation.js";

describe("federation signatures", () => {
  it("verifies an unchanged envelope and rejects tampering", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const envelope = signEnvelope(privateKey, {
      id: randomUUID(),
      type: "booking.proposed",
      sender: "https://manchester.example/nodes/main",
      sentAt: new Date().toISOString(),
      payload: { amount: 12000, currency: "GBP" },
    });

    expect(verifyEnvelope(publicKey, envelope)).toBe(true);
    expect(
      verifyEnvelope(publicKey, {
        ...envelope,
        payload: { amount: 1, currency: "GBP" },
      }),
    ).toBe(false);
  });
});
