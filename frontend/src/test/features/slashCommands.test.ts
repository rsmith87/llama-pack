import { describe, expect, it } from "vitest";
import { chatSlashCommands, parseSlashCommand } from "../../features/chat";

describe("chat slash commands", () => {
  it("parses remember commands with trimmed args", () => {
    expect(parseSlashCommand(" /remember   User prefers concise answers. ")).toEqual({
      name: "remember",
      args: "User prefers concise answers.",
      raw: "/remember   User prefers concise answers.",
    });
  });

  it("parses an empty remember command", () => {
    expect(parseSlashCommand("/remember")).toEqual({
      name: "remember",
      args: "",
      raw: "/remember",
    });
  });

  it("does not match command prefixes inside longer words", () => {
    expect(parseSlashCommand("/remembered User prefers concise answers.")).toBeNull();
  });

  it("returns null for normal chat prompts and unknown commands", () => {
    expect(parseSlashCommand("remember this")).toBeNull();
    expect(parseSlashCommand("/unknown value")).toBeNull();
  });

  it("exposes command metadata for help text", () => {
    expect(chatSlashCommands).toContainEqual({
      name: "remember",
      usage: "/remember <text>",
      description: "Save text to controller memory.",
    });
  });

  it("parses recall, forget, context, and use commands", () => {
    expect(parseSlashCommand("/recall answer style")).toMatchObject({ name: "recall", args: "answer style" });
    expect(parseSlashCommand("/forget stale note")).toMatchObject({ name: "forget", args: "stale note" });
    expect(parseSlashCommand("/context")).toMatchObject({ name: "context", args: "" });
    expect(parseSlashCommand("/use node:mac")).toMatchObject({ name: "use", args: "node:mac" });
  });

  it("does not match new command prefixes inside longer words", () => {
    expect(parseSlashCommand("/recalled answer style")).toBeNull();
    expect(parseSlashCommand("/forgettable stale note")).toBeNull();
    expect(parseSlashCommand("/contextual")).toBeNull();
    expect(parseSlashCommand("/user mistral")).toBeNull();
  });
});
