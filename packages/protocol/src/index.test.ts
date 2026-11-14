import { describe, expect, it } from "vitest";
import { nodeDescriptorSchema, protocolVersion } from "./index.js";

describe("node descriptor", () => {
  it("accepts a minimal draft descriptor", () => {
    const descriptor = nodeDescriptorSchema.parse({
      id: "https://london.example/nodes/main",
      name: "London cooperative",
      protocolVersion,
      inbox: "https://london.example/federation/inbox",
    });

    expect(descriptor.protocolVersion).toBe("0.0.1-draft");
  });

  it("rejects unknown properties", () => {
    expect(() =>
      nodeDescriptorSchema.parse({
        id: "https://london.example/nodes/main",
        name: "London cooperative",
        protocolVersion,
        inbox: "https://london.example/federation/inbox",
        internalDatabaseId: 42,
      }),
    ).toThrow();
  });
});
