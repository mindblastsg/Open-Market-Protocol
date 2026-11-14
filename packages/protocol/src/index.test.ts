import { describe, expect, it } from "vitest";
import {
  canTransitionBooking,
  nodeDescriptorSchema,
  protocolVersion,
} from "./index.js";

describe("node descriptor", () => {
  it("accepts a minimal draft descriptor", () => {
    const descriptor = nodeDescriptorSchema.parse({
      id: "https://london.example/nodes/main",
      databaseId: "10000000-0000-4000-8000-000000000001",
      name: "London cooperative",
      protocolVersion,
      inbox: "https://london.example/federation/inbox",
      listings: "https://london.example/federation/listings",
      publicKey:
        "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA000000000000000000000000000000000000000=\n-----END PUBLIC KEY-----",
    });

    expect(descriptor.protocolVersion).toBe("0.0.1-draft");
  });

  it("rejects unknown properties", () => {
    expect(() =>
      nodeDescriptorSchema.parse({
        id: "https://london.example/nodes/main",
        databaseId: "10000000-0000-4000-8000-000000000001",
        name: "London cooperative",
        protocolVersion,
        inbox: "https://london.example/federation/inbox",
        listings: "https://london.example/federation/listings",
        publicKey:
          "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA000000000000000000000000000000000000000=\n-----END PUBLIC KEY-----",
        internalDatabaseId: 42,
      }),
    ).toThrow();
  });
});

describe("booking state machine", () => {
  it("allows the expected successful path", () => {
    expect(canTransitionBooking("proposed", "confirmed")).toBe(true);
    expect(canTransitionBooking("confirmed", "completed")).toBe(true);
  });

  it("keeps terminal states terminal", () => {
    expect(canTransitionBooking("completed", "cancelled")).toBe(false);
    expect(canTransitionBooking("cancelled", "confirmed")).toBe(false);
  });
});
