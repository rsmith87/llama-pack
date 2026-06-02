import { FormField } from "../../../components/ui";
import type { OsChoice } from "../../../features/setup/types";
import type { WizardNav } from "../../../features/setup/useOnboardingWizard";

const OS_DEFAULTS: Record<OsChoice, { llama_server_bin: string; llama_cpp_dir: string; hf_models_dir: string }> = {
  macos: {
    llama_server_bin: "./llama.cpp/build/bin/llama-server",
    llama_cpp_dir: "./llama.cpp",
    hf_models_dir: "./models/HFModels",
  },
  linux: {
    llama_server_bin: "/home/user/Apps/llama.cpp/build/bin/llama-server",
    llama_cpp_dir: "/home/user/Apps/llama.cpp",
    hf_models_dir: "/home/user/models/HFModels",
  },
};

export function AgentRuntimePaths({ nav }: { nav: WizardNav }) {
  const { state, setAgentRuntimePaths } = nav;
  const s = state.agentRuntimePaths;

  function handleOsChange(os: OsChoice) {
    setAgentRuntimePaths({ os, ...OS_DEFAULTS[os] });
  }

  return (
    <div className="wizard-step">
      <p className="wizard-step-desc">
        Tell the agent where to find llama.cpp and your models. Choose your OS
        to pre-fill sensible defaults.
      </p>
      <div className="wizard-form">
        <FormField label="Operating system">
          <select
            value={s.os}
            onChange={(e) => handleOsChange(e.target.value as OsChoice)}
          >
            <option value="macos">macOS</option>
            <option value="linux">Linux</option>
          </select>
        </FormField>

        <FormField
          label="llama-server binary"
          hint="Full path to the llama-server executable."
        >
          <input
            type="text"
            value={s.llama_server_bin}
            onChange={(e) => setAgentRuntimePaths({ llama_server_bin: e.target.value })}
          />
        </FormField>

        <FormField
          label="llama.cpp directory"
          hint="Root of your llama.cpp checkout (used for model conversion scripts)."
        >
          <input
            type="text"
            value={s.llama_cpp_dir}
            onChange={(e) => setAgentRuntimePaths({ llama_cpp_dir: e.target.value })}
          />
        </FormField>

        <FormField
          label="Python binary"
          hint="Python used for conversion and quantization scripts."
        >
          <input
            type="text"
            value={s.python_bin}
            onChange={(e) => setAgentRuntimePaths({ python_bin: e.target.value })}
          />
        </FormField>

        <FormField
          label="HuggingFace models directory"
          hint="Where downloaded HF model repos are stored."
        >
          <input
            type="text"
            value={s.hf_models_dir}
            onChange={(e) => setAgentRuntimePaths({ hf_models_dir: e.target.value })}
          />
        </FormField>

        <FormField
          label="Log directory"
          hint="Directory for runtime logs and state files."
        >
          <input
            type="text"
            value={s.log_dir}
            onChange={(e) => setAgentRuntimePaths({ log_dir: e.target.value })}
          />
        </FormField>
      </div>
    </div>
  );
}
