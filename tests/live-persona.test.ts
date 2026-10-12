/**
 * Persona Engine Tests
 *
 * Phase B — Persona Engine
 *
 * Test isolation: These tests import only from the persona module.
 * They do not touch the LLM provider, safety service, or any private API.
 */

import {
  PERSONA_REGISTRY,
  getPersona,
  buildSystemPrompt,
  buildTurnPrompt,
  buildEmotionPrompt,
  buildVietnameseSystemPrompt,
  PERSONA_SCHEMA,
} from "../apps/api/src/modules/live/persona/index";

import type { PromptMessage } from "../apps/api/src/ai/providers/provider";

describe("Persona Registry", () => {
  it("should contain exactly two versions", () => {
    const versions = Object.keys(PERSONA_REGISTRY);
    expect(versions).toHaveLength(2);
    expect(versions).toContain("mori-public-vi-v1");
    expect(versions).toContain("mori-public-en-v1");
  });

  it("should parse all versions successfully", () => {
    for (const [version, persona] of Object.entries(PERSONA_REGISTRY)) {
      const result = PERSONA_SCHEMA.safeParse(persona);
      expect(result.success).toBe(true);
      expect(result.data?.version).toBe(version);
    }
  });

  it("should have consistent structure across versions", () => {
    const versions = Object.values(PERSONA_REGISTRY);
    for (const persona of versions) {
      expect(persona.name).toBe("Mori");
      expect(persona.theme).toBe("winter");
      expect(persona.personality.primary).toBeTruthy();
      expect(persona.personality.secondary.length).toBeGreaterThanOrEqual(3);
      expect(persona.personality.avoid.length).toBeGreaterThanOrEqual(4);
      expect(persona.voice.speakingStyles).toBeTruthy();
      expect(persona.boundaries.disallowedTopics).toHaveLength(5);
      expect(persona.exampleDialogue).toHaveLength(10);
    }
  });

  it("should have no empty required fields", () => {
    for (const persona of Object.values(PERSONA_REGISTRY)) {
      expect(persona.name).toBeTruthy();
      expect(persona.tagline).toBeTruthy();
      expect(persona.characterNotes).toBeTruthy();
      expect(persona.exampleDialogue.length).toBeGreaterThan(0);
      for (const example of persona.exampleDialogue) {
        expect(example.viewerText).toBeTruthy();
        expect(example.moriResponse).toBeTruthy();
        expect(example.emotion).toBeTruthy();
      }
    }
  });

  it("should have valid emotion traits in all examples", () => {
    const validEmotions = [
      "neutral",
      "happy",
      "sad",
      "surprised",
      "confused",
      "curious",
      "playful",
      "thoughtful",
      "calm",
    ];
    for (const persona of Object.values(PERSONA_REGISTRY)) {
      for (const example of persona.exampleDialogue) {
        expect(validEmotions).toContain(example.emotion);
      }
    }
  });

  it("should have speaking styles that sum approximately to 1", () => {
    for (const persona of Object.values(PERSONA_REGISTRY)) {
      const sum = Object.values(persona.voice.speakingStyles).reduce(
        (acc, val) => acc + val,
        0,
      );
      expect(sum).toBeCloseTo(1.0, 2);
    }
  });

  it("should have safe redirects for all crisis topics", () => {
    const requiredTopics = ["medical", "legal", "crisis", "emotional"];
    for (const persona of Object.values(PERSONA_REGISTRY)) {
      for (const topic of requiredTopics) {
        expect(persona.boundaries.safeRedirects[topic]).toBeTruthy();
      }
    }
  });

  it("should require operator escalation for sensitive content", () => {
    for (const persona of Object.values(PERSONA_REGISTRY)) {
      expect(
        persona.boundaries.requireOperatorEscalation.length,
      ).toBeGreaterThan(0);
    }
  });
});

describe("getPersona", () => {
  it("should return Vietnamese persona by default", () => {
    const persona = getPersona("unknown-version");
    expect(persona.version).toBe("mori-public-vi-v1");
  });

  it("should return exact version when valid", () => {
    expect(getPersona("mori-public-vi-v1").locale).toBe("vi");
    expect(getPersona("mori-public-en-v1").locale).toBe("en");
  });
});

describe("buildSystemPrompt", () => {
  it("should include identity and tagline", () => {
    const persona = getPersona("mori-public-vi-v1");
    const prompt = buildSystemPrompt(persona);
    expect(prompt).toContain("Mori");
    expect(prompt).toContain(persona.tagline);
  });

  it("should include personality traits", () => {
    const persona = getPersona("mori-public-vi-v1");
    const prompt = buildSystemPrompt(persona);
    expect(prompt).toContain("Personality");
    expect(prompt).toContain(persona.personality.primary);
  });

  it("should include boundaries", () => {
    const persona = getPersona("mori-public-en-v1");
    const prompt = buildSystemPrompt(persona);
    expect(prompt).toContain("Boundaries");
    expect(prompt).toContain("Do not claim to access private");
  });

  it("should include persona version for traceability", () => {
    const persona = getPersona("mori-public-vi-v1");
    const prompt = buildSystemPrompt(persona);
    expect(prompt).toContain(`Persona version: ${persona.version}`);
  });

  it("should not contain placeholder text", () => {
    const persona = getPersona("mori-public-vi-v1");
    const prompt = buildSystemPrompt(persona);
    expect(prompt).not.toMatch(/\[TODO\]/i);
    expect(prompt).not.toMatch(/\[PLACEHOLDER\]/i);
    expect(prompt).not.toMatch(/FILL IN/i);
  });

  it("should include Vietnamese safe redirects for vi locale", () => {
    const persona = getPersona("mori-public-vi-v1");
    const prompt = buildVietnameseSystemPrompt(persona);
    expect(prompt).toContain("Không được");
    expect(prompt).toContain("Chuyển hướng an toàn");
  });

  it("should limit response length guidance", () => {
    const persona = getPersona("mori-public-en-v1");
    const prompt = buildSystemPrompt(persona);
    expect(prompt).toContain("1 to 3 sentences");
  });
});

describe("buildTurnPrompt", () => {
  it("should start with system prompt", () => {
    const persona = getPersona("mori-public-vi-v1");
    const messages = buildTurnPrompt(persona, "Hello Mori!", []);
    expect(messages[0].role).toBe("system");
  });

  it("should include viewer message at the end", () => {
    const persona = getPersona("mori-public-vi-v1");
    const viewerText = "What do you think about snow?";
    const messages = buildTurnPrompt(persona, viewerText, []);
    const last = messages[messages.length - 1];
    expect(last.role).toBe("user");
    expect(typeof last.content).toBe("string");
    const content = last.content as string;
    expect(content).toContain(viewerText);
    expect(content).toContain("public_viewer");
  });

  it("should serialize viewer message as JSON", () => {
    const persona = getPersona("mori-public-en-v1");
    const viewerText = "Hello! How are you?";
    const messages = buildTurnPrompt(persona, viewerText, []);
    const last = messages[messages.length - 1];
    const content = last.content as string;
    let parsed: { source: string; text: string };
    expect(() => {
      parsed = JSON.parse(content);
    }).not.toThrow();
    parsed = JSON.parse(content);
    expect(parsed.source).toBe("public_viewer");
    expect(parsed.text).toBe(viewerText);
  });

  it("should handle special characters in viewer text", () => {
    const persona = getPersona("mori-public-vi-v1");
    const specialText = 'Hello "Mori" & <World>!';
    const messages = buildTurnPrompt(persona, specialText, []);
    const last = messages[messages.length - 1];
    const content = last.content as string;
    const parsed = JSON.parse(content);
    expect(parsed.text).toBe(specialText);
  });

  it("should limit history to 4 turns", () => {
    const persona = getPersona("mori-public-vi-v1");
    const history: PromptMessage[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: JSON.stringify({
        source: "public_viewer",
        text: `Message ${i}`,
      }),
    }));
    const messages = buildTurnPrompt(persona, "Latest message", history);
    const userMessages = messages.filter((m) => m.role === "user");
    // System + at most 4 viewer messages
    expect(userMessages.length).toBeLessThanOrEqual(5);
  });
});

describe("buildEmotionPrompt", () => {
  it("should be concise (< 500 chars)", () => {
    for (const persona of Object.values(PERSONA_REGISTRY)) {
      const prompt = buildEmotionPrompt(persona);
      expect(prompt.length).toBeLessThan(500);
    }
  });

  it("should request JSON output", () => {
    for (const persona of Object.values(PERSONA_REGISTRY)) {
      const prompt = buildEmotionPrompt(persona);
      expect(prompt).toContain("JSON");
      expect(prompt).toContain("emotion");
    }
  });

  it("should reference persona name and theme", () => {
    const persona = getPersona("mori-public-vi-v1");
    const prompt = buildEmotionPrompt(persona);
    expect(prompt).toContain("Mori");
    expect(prompt).toContain("winter");
  });
});

describe("Character Safety Boundaries", () => {
  it("should explicitly prevent human impersonation", () => {
    for (const persona of Object.values(PERSONA_REGISTRY)) {
      const text = persona.boundaries.disallowedTopics.join(" ");
      // Check both English and Vietnamese equivalents
      const hasHuman = /human|real person|người thật|mori là người/i.test(text);
      expect(hasHuman).toBe(true);
    }
  });

  it("should prevent emotional dependency creation", () => {
    for (const persona of Object.values(PERSONA_REGISTRY)) {
      const text = persona.boundaries.disallowedTopics.join(" ");
      // Check both English and Vietnamese equivalents
      const hasEmotional = /emotional|dependenc|cảm xúc|phụ thuộc/i.test(text);
      expect(hasEmotional).toBe(true);
    }
  });

  it("should disallow medical/legal/financial advice", () => {
    for (const persona of Object.values(PERSONA_REGISTRY)) {
      const text = persona.boundaries.disallowedTopics.join(" ");
      // Check both English and Vietnamese equivalents
      const hasMedical = /medical|bác sĩ|y tế/i.test(text);
      const hasLegal = /legal|luật pháp|pháp lý/i.test(text);
      const hasFinancial = /financial|tài chính|đầu tư/i.test(text);
      expect(hasMedical).toBe(true);
      expect(hasLegal).toBe(true);
      expect(hasFinancial).toBe(true);
    }
  });
});
