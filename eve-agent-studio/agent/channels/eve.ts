import { eveChannel } from "eve/channels/eve";
import { localDev, none, vercelOidc } from "eve/channels/auth";

/**
 * eve fails closed by default: without this file the agent's HTTP routes reject
 * every browser request with a 401. This studio is a public demo, so it opts
 * into anonymous access explicitly with `none()` as the final entry.
 *
 * ⚠️ `none()` means anyone who finds the URL can spend your model credits.
 * Before pointing anything real at this, drop `none()` and keep
 * `[vercelOidc(), localDev()]`, or add your own policy — httpBasic(), jwtHmac(),
 * and oidc() all ship in `eve/channels/auth`.
 */
export default eveChannel({
  auth: [vercelOidc(), localDev(), none()],
});
