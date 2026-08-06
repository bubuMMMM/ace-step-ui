import { defineAgent } from "eve";

export default defineAgent({
  // Gateway model id — routes through the Vercel AI Gateway, so the only
  // credential this app needs is AI_GATEWAY_API_KEY (or a linked Vercel
  // project supplying VERCEL_OIDC_TOKEN).
  model: "anthropic/claude-sonnet-5",
  reasoning: "low",
  limits: {
    // The studio is a public demo: keep any single session's spend bounded.
    maxInputTokensPerSession: 400_000,
    maxOutputTokensPerSession: 60_000,
  },
});
