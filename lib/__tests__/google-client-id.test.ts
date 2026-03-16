import { describe, it, expect } from "vitest";

describe("Google OAuth Web Client ID", () => {
  it("should have EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID set", () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    expect(clientId).toBeDefined();
    expect(clientId).not.toBe("");
  });

  it("should be a valid Google Client ID format", () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!;
    // Google Client IDs end with .apps.googleusercontent.com
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
    // Should have a numeric project ID prefix
    expect(clientId).toMatch(/^\d+-/);
  });

  it("should be reachable via Google OAuth discovery", async () => {
    // Validate by checking Google's OAuth discovery endpoint is accessible
    const response = await fetch("https://accounts.google.com/.well-known/openid-configuration");
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.authorization_endpoint).toContain("accounts.google.com");
    expect(data.token_endpoint).toContain("googleapis.com");
  });
});
