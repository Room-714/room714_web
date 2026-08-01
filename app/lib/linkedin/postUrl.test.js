import { describe, expect, it } from "vitest";
import { linkedInUrlFrom } from "./postUrl";

describe("linkedInUrlFrom", () => {
  it("construye la URL del feed a partir de un URN de share", () => {
    expect(linkedInUrlFrom({ postUrn: "urn:li:share:7123456789" })).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:7123456789/",
    );
  });

  it("acepta también ugcPost y activity", () => {
    expect(linkedInUrlFrom({ postUrn: "urn:li:ugcPost:7123456789" })).toBe(
      "https://www.linkedin.com/feed/update/urn:li:ugcPost:7123456789/",
    );
    expect(linkedInUrlFrom({ postUrn: "urn:li:activity:7123456789" })).toBe(
      "https://www.linkedin.com/feed/update/urn:li:activity:7123456789/",
    );
  });

  it("acepta una URL de linkedin ya formada", () => {
    const url = "https://www.linkedin.com/feed/update/urn:li:share:7123456789/";
    expect(linkedInUrlFrom({ postUrl: url })).toBe(url);
  });

  it("rechaza hosts que no son de linkedin", () => {
    expect(
      linkedInUrlFrom({ postUrl: "https://evil.example.com/phishing" }),
    ).toBeNull();
    expect(
      linkedInUrlFrom({ postUrl: "https://linkedin.com.evil.example/x" }),
    ).toBeNull();
  });

  it("rechaza esquemas que no son https", () => {
    expect(linkedInUrlFrom({ postUrl: "http://www.linkedin.com/feed" })).toBeNull();
    expect(
      linkedInUrlFrom({ postUrl: "javascript:alert(document.domain)" }),
    ).toBeNull();
  });

  it("rechaza URNs con formato inesperado y entradas vacías", () => {
    expect(linkedInUrlFrom({ postUrn: "urn:li:share:no-numerico" })).toBeNull();
    expect(linkedInUrlFrom({ postUrn: "cualquier cosa" })).toBeNull();
    expect(linkedInUrlFrom({})).toBeNull();
    expect(linkedInUrlFrom({ postUrl: "" })).toBeNull();
  });
});
