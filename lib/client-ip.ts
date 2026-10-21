import { isIP } from "node:net";

/** Only trust a single address explicitly overwritten by the deployment proxy. */
export function clientIpFromHeaders(headers: Pick<Headers, "get">): string {
  const name = process.env.HSFZ_CLIENT_IP_HEADER;
  if (!name) return "unknown";
  const value = headers.get(name)?.trim();
  return value && isIP(value) ? value : "unknown";
}
