export type ChatSlashCommandName = "remember" | "recall" | "forget" | "context" | "use";

export type ChatSlashCommandDefinition = {
  name: ChatSlashCommandName;
  usage: string;
  description: string;
};

export type ParsedSlashCommand = {
  name: ChatSlashCommandName;
  args: string;
  raw: string;
};

export const chatSlashCommands: ChatSlashCommandDefinition[] = [
  {
    name: "remember",
    usage: "/remember <text>",
    description: "Save text to controller memory.",
  },
  {
    name: "recall",
    usage: "/recall <query>",
    description: "Search controller memory and show matching memories.",
  },
  {
    name: "forget",
    usage: "/forget <query-or-id>",
    description: "Preview memory entries that may need deletion.",
  },
  {
    name: "context",
    usage: "/context",
    description: "Show the current context budget and selected routing state.",
  },
  {
    name: "use",
    usage: "/use <model-or-target>",
    description: "Switch the selected model or target.",
  },
];

export function parseSlashCommand(value: string): ParsedSlashCommand | null {
  const raw = value.trim();
  if (!raw.startsWith("/")) return null;

  for (const command of chatSlashCommands) {
    const token = `/${command.name}`;
    if (raw === token) return { name: command.name, args: "", raw };
    if (raw.startsWith(`${token} `) || raw.startsWith(`${token}\t`)) {
      return { name: command.name, args: raw.slice(token.length).trim(), raw };
    }
  }

  return null;
}
