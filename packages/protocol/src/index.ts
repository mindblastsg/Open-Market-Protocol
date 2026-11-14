import { z } from "zod";

export const protocolVersion = "0.0.1-draft" as const;

export const nodeDescriptorSchema = z.object({
  id: z.string().url(),
  name: z.string().trim().min(1).max(120),
  protocolVersion: z.literal(protocolVersion),
  inbox: z.string().url()
}).strict();

export type NodeDescriptor = z.infer<typeof nodeDescriptorSchema>;

