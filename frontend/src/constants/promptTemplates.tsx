export const PROMPT_TEMPLATE_OPTIONS = [
  { value: "", label: "Auto / server default" },
  { value: "llama3", label: "Llama 3" },
  { value: "llama-3", label: "Llama 3 (alias)" },
  { value: "chatml", label: "ChatML" },
  { value: "qwen", label: "Qwen (ChatML)" },
  { value: "gemma", label: "Gemma" },
  { value: "gpt-oss", label: "GPT-OSS (ChatML)" },
  { value: "gptoss", label: "GPTOSS (ChatML alias)" },
] as const;
