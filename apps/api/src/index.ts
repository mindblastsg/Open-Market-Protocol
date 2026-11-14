import { buildApp } from "./app.js";
import { createDatabase } from "./database.js";
import { MarketplaceRepository } from "./marketplace.js";
import {
  FederationService,
  HttpFederationTransport,
  type FederationConfig,
} from "./federation.js";
import { nodeDescriptorSchema } from "@omp/protocol";

const databaseUrl = process.env.DATABASE_URL;
const database = databaseUrl ? createDatabase(databaseUrl) : null;
const marketplace = database ? new MarketplaceRepository(database.pool) : null;

function federationConfigFromEnvironment(): FederationConfig | null {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  const databaseId = process.env.NODE_DATABASE_ID;
  const name = process.env.NODE_NAME;
  const privateKeyBase64 = process.env.NODE_PRIVATE_KEY_BASE64;
  const publicKeyBase64 = process.env.NODE_PUBLIC_KEY_BASE64;
  if (
    !publicBaseUrl ||
    !databaseId ||
    !name ||
    !privateKeyBase64 ||
    !publicKeyBase64
  ) {
    return null;
  }
  const base = publicBaseUrl.replace(/\/$/, "");
  const descriptor = nodeDescriptorSchema.parse({
    id: `${base}/nodes/main`,
    databaseId,
    name,
    protocolVersion: "0.0.1-draft",
    inbox: `${base}/federation/inbox`,
    listings: `${base}/federation/listings`,
    publicKey: Buffer.from(publicKeyBase64, "base64").toString("utf8"),
  });
  const allowedDescriptorUrls = new Set(
    (process.env.FEDERATION_PEER_DESCRIPTOR_URLS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return {
    descriptor,
    privateKey: Buffer.from(privateKeyBase64, "base64").toString("utf8"),
    allowedDescriptorUrls,
  };
}

const federationConfig = federationConfigFromEnvironment();
const federation =
  marketplace && federationConfig
    ? new FederationService(
        marketplace,
        federationConfig,
        new HttpFederationTransport(),
      )
    : null;
await federation?.initialise();
const app = database
  ? buildApp({
      checkDatabase: () => database.ping(),
      marketplace: marketplace!,
      operatorToken: process.env.OPERATOR_TOKEN ?? "",
      ...(federation ? { federation } : {}),
    })
  : buildApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await database?.close();
    process.exit(0);
  });
}
