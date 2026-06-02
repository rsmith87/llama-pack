import "./styles.css";
import { useEffect, useState, type FormEvent } from "react";
import { readChatStream } from "../../features/chat/chatStreaming";
import { Button, ErrorBanner, FormField, StatusBadge } from "../../components/ui";
import type { ModelProfileCatalog, ModelProfileFamily } from "../../types/models";
import type { TestChatBootstrap, TestChatSession, TestChatMessage, RouteMeta, ChatModel } from "../../types/chat";

function modelName(model: ChatModel) {
  return String(model.name || model.id || model.model || "");
}

function modelTarget(model: ChatModel) {
  const node = model.node || model.node_name;
  return node ? `node:${node}` : "auto";
}

function modelLabel(model: ChatModel) {
  const name = modelName(model);
  const target = modelTarget(model);
  return target.startsWith("node:") ? `${name} on ${target.slice("node:".length)}` : name;
}

function asModels(payload: unknown): ChatModel[] {
  if (Array.isArray(payload)) return payload as ChatModel[];
  return (payload as { models?: ChatModel[] } | null)?.models || [];
}

function nodeModelsToModels(payload: unknown): ChatModel[] {
  const nodes = Array.isArray(payload) ? payload : [];
  return nodes.flatMap((node) => {
    const nodeName = String((node as { name?: string }).name || "");
    const reachable = (node as { reachable?: boolean }).reachable;
    const models = (node as { models?: ChatModel[] }).models;
    if (!nodeName || reachable === false || !Array.isArray(models)) return [];
    return models.map((model) => ({ ...model, name: modelName(model), node: nodeName }));
  }).filter((model) => modelName(model));
}

function asSessions(payload: unknown): TestChatSession[] {
  if (Array.isArray(payload)) return payload as TestChatSession[];
  return (payload as { sessions?: TestChatSession[] } | null)?.sessions || [];
}

function asProfileCatalog(payload: unknown): ModelProfileCatalog {
  const families = (payload as { families?: ModelProfileFamily[] } | null)?.families;
  return { families: Array.isArray(families) ? families : [] };
}

function firstProfileForFamily(catalog: ModelProfileCatalog, family: string) {
  return catalog.families.find((item) => item.family === family)?.profiles[0]?.profile || "";
}

function sessionLabel(session: TestChatSession) {
  return session.name || [session.model, session.updated_at].filter(Boolean).join(" - ") || session.id || "Untitled session";
}

function routeMeta(route: unknown): RouteMeta {
  const item = route as Record<string, unknown> | null;
  if (!item) return {};
  return {
    node: typeof item.node === "string" ? item.node : "",
    model: typeof item.model === "string" ? item.model : "",
    reason: typeof item.reason === "string" ? item.reason : "",
  };
}

async function assertOk(response: Response) {
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
}

export function TestChatPage() {
  const [sessionActive, setSessionActive] = useState(false);
  const [keyHint, setKeyHint] = useState("");
  const [models, setModels] = useState<ChatModel[]>([]);
  const [profileCatalog, setProfileCatalog] = useState<ModelProfileCatalog>({ families: [] });
  const [selectedFamily, setSelectedFamily] = useState("");
  const [selectedProfile, setSelectedProfile] = useState("");
  const [sessions, setSessions] = useState<TestChatSession[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [target, setTarget] = useState("auto");
  const [requestType, setRequestType] = useState("coding");
  const [threadId, setThreadId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<TestChatMessage[]>([]);
  const [status, setStatus] = useState("Loading test chat");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [controllerTestChatUrl, setControllerTestChatUrl] = useState("");

  async function scopedFetch(path: string, init: RequestInit = {}) {
    const headers = {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    };
    const response = await fetch(path, { ...init, credentials: "same-origin", headers });
    await assertOk(response as Response);
    return response.json();
  }

  async function refreshModels() {
    const fetchWithSession = async (path: string) => {
      const response = await fetch(path, { credentials: "same-origin", headers: { Accept: "application/json" } });
      await assertOk(response as Response);
      return response.json();
    };
    let items = asModels(await fetchWithSession("/lm-api/v1/models"));
    if (!items.length) items = nodeModelsToModels(await fetchWithSession("/lm-api/v1/nodes/models"));
    setModels(items);
    setSelectedModel((current) => current || modelName(items[0] || {}));
    setTarget((current) => current === "auto" && modelTarget(items[0] || {}) !== "auto" ? modelTarget(items[0] || {}) : current);
    try {
      const catalog = asProfileCatalog(await fetchWithSession("/lm-api/v1/models/profiles"));
      setProfileCatalog(catalog);
      setSelectedFamily((current) => current || catalog.families[0]?.family || "");
      setSelectedProfile((current) => current || catalog.families[0]?.profiles[0]?.profile || "");
    } catch {
      setProfileCatalog({ families: [] });
    }
  }

  async function refreshSessions() {
    const response = await fetch("/lm-api/v1/chat/sessions", { credentials: "same-origin", headers: { Accept: "application/json" } });
    await assertOk(response as Response);
    setSessions(asSessions(await response.json()));
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setError("");
      try {
        const response = await fetch("/lm-api/v1/test-chat/bootstrap", { credentials: "same-origin", headers: { Accept: "application/json" } });
        await assertOk(response as Response);
        const bootstrap = await response.json() as TestChatBootstrap;
        if (!active) return;
        if (!bootstrap.enabled) {
          if (bootstrap.mode === "agent" && bootstrap.controller_test_chat_url) {
            setControllerTestChatUrl(bootstrap.controller_test_chat_url);
            setStatus("Controller mode required");
            return;
          }
          setStatus("Test chat API key is not configured");
          setError("Set LLAMA_MANAGER_TEST_CHAT_API_KEY and restart the server.");
          return;
        }
        setSessionActive(true);
        setKeyHint(bootstrap.key_hint || "");
        setStatus("Ready");
        await refreshModels();
        await refreshSessions();
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load test chat");
        setStatus("Unavailable");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function createThread() {
    const thread = await scopedFetch("/lm-api/v1/threads", {
      method: "POST",
      body: JSON.stringify({
        title: null,
        default_model: selectedModel || null,
        metadata: { app: "test-chat", purpose: "chat", priority: "medium", request_type: requestType },
      }),
    });
    const id = String((thread as { id?: string }).id || "");
    setThreadId(id);
    return id;
  }

  async function sendPrompt(event: FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || pending || !sessionActive) return;
    setError("");
    setPending(true);
    setStatus("Routing through controller");
    const userMessage: TestChatMessage = { role: "user", content: trimmed };
    const assistantPending: TestChatMessage = {
      role: "assistant",
      content: "",
      reasoningContent: "",
      pending: true,
      reasoningCollapsed: false,
    };
    setMessages((current) => [...current, userMessage, assistantPending]);
    setPrompt("");
    try {
      const activeThreadId = threadId || await createThread();
      const response = await fetch(`/lm-api/v1/threads/${encodeURIComponent(activeThreadId)}/messages/stream`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          role: "user",
          content: trimmed,
          model: selectedModel || null,
          model_family: selectedFamily || undefined,
          context_profile: selectedProfile || undefined,
          target,
          metadata: { app: "test-chat", purpose: "chat", priority: "medium", request_type: requestType },
        }),
      });
      await assertOk(response);
      if (!response.body) throw new Error("Response did not include a readable stream");

      await readChatStream(response.body.getReader(), {
        onRoute(event) {
          const meta = routeMeta(event.route as unknown);
          setMessages((current) => current.map((msg) =>
            msg.pending ? { ...msg, routeMeta: meta } : msg,
          ));
        },
        onDelta({ content, reasoning }) {
          setMessages((current) => current.map((msg) => {
            if (!msg.pending) return msg;
            const nextContent = msg.content + content;
            const nextReasoning = (msg.reasoningContent || "") + reasoning;
            // Collapse reasoning drawer once first answer content arrives
            const nextCollapsed = !msg.reasoningCollapsed && nextContent.length > 0
              ? true
              : msg.reasoningCollapsed;
            return {
              ...msg,
              content: nextContent,
              reasoningContent: nextReasoning,
              reasoningCollapsed: nextCollapsed,
            };
          }));
        },
        onError(event) {
          setMessages((current) => current.map((msg) =>
            msg.pending ? { ...msg, role: "error", content: event.error, pending: false } : msg,
          ));
        },
      });

      setMessages((current) => current.map((msg) => {
        if (!msg.pending) return msg;
        const finalContent = msg.content || "(empty response)";
        return { ...msg, content: finalContent, pending: false };
      }));
      setStatus(activeThreadId ? `Thread ${activeThreadId.slice(0, 8)}` : "Ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat request failed";
      setError(message);
      setMessages((current) => current.map((msg) =>
        msg.pending ? { role: "error", content: message } : msg,
      ));
      setStatus("Error");
    } finally {
      setPending(false);
    }
  }

  async function loadSession(sessionId: string) {
    if (!sessionId) return;
    try {
      const session = await scopedFetch(`/lm-api/v1/chat/sessions/${encodeURIComponent(sessionId)}`) as TestChatSession & { target_selector?: string };
      setMessages(session.messages || []);
      if (session.model) setSelectedModel(session.model);
      setTarget(session.target_selector || "auto");
      setStatus("Session loaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    }
  }

  async function saveSession() {
    if (!selectedModel || !messages.length) return;
    try {
      await scopedFetch("/lm-api/v1/chat/sessions", {
        method: "POST",
        body: JSON.stringify({
          name: `Test Chat ${new Date().toLocaleString()}`,
          model: selectedModel,
          target,
          messages: messages.filter((message) => message.role !== "error").map((message) => {
            const item: Record<string, unknown> = { role: message.role, content: message.content };
            if (message.reasoningContent) item.reasoning_content = message.reasoningContent;
            return item;
          }),
          request_defaults: {
            chat_mode: "thread",
            thread_id: threadId,
            thread_metadata: { app: "test-chat", request_type: requestType },
            model_family: selectedFamily || undefined,
            context_profile: selectedProfile || undefined,
          },
        }),
      });
      await refreshSessions();
      setStatus("Session saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save session");
    }
  }

  const targetOptions = ["auto", target, ...models.map(modelTarget)].filter((item, index, items) => item && items.indexOf(item) === index);
  const profileFamilies = profileCatalog.families.filter((family) => family.family && family.profiles.length);
  const selectedProfileFamily = profileFamilies.find((family) => family.family === selectedFamily);

  return (
    <div className="test-chat-shell">
      <aside className="test-chat-sidebar">
        <div className="test-chat-brand">
          <span className="eyebrow">Key status</span>
          <strong>{sessionActive ? "Test chat session active" : "Test chat session unavailable"}</strong>
          <small>{keyHint || "No scoped session"}</small>
        </div>
        <Button type="button" onClick={() => { setThreadId(""); setMessages([]); setStatus("New routed chat"); }}>New routed chat</Button>
        <section>
          <span className="eyebrow">Sessions</span>
          <div className="test-chat-session-list">
            {sessions.length ? sessions.map((session) => (
              <button type="button" key={session.id} aria-label={sessionLabel(session)} onClick={() => void loadSession(session.id)}>
                <strong>{sessionLabel(session)}</strong>
                <small>{[session.model, session.updated_at].filter(Boolean).join(" - ") || session.id}</small>
              </button>
            )) : <p>No saved sessions.</p>}
          </div>
        </section>
        <p className="test-chat-limit">Limited page: no admin nav, no settings, no node mutation. Only routed chat, session/thread reads, and session saves.</p>
      </aside>

      <main className="test-chat-main">
        <header className="test-chat-header">
          <div>
            <span className="eyebrow">Route controls</span>
            <div className="test-chat-controls">
              <FormField label="Model">
                <select value={selectedModel} onChange={(event) => {
                  const next = models.find((model) => modelName(model) === event.target.value);
                  setSelectedModel(event.target.value);
                  if (next) setTarget(modelTarget(next));
                }}>
                  {models.map((model) => <option key={`${modelName(model)}-${modelTarget(model)}`} value={modelName(model)}>{modelLabel(model)}</option>)}
                </select>
              </FormField>
              <FormField label="Target">
                <select value={target} onChange={(event) => setTarget(event.target.value)}>
                  {targetOptions.map((option) => <option value={option} key={option}>{option}</option>)}
                </select>
              </FormField>
              {profileFamilies.length ? (
                <>
                  <FormField label="Model Family"><select value={selectedFamily} onChange={(event) => {
                    const family = event.target.value;
                    setSelectedFamily(family);
                    setSelectedProfile(firstProfileForFamily(profileCatalog, family));
                  }}>{profileFamilies.map((family) => <option key={family.family} value={family.family}>{family.family}</option>)}</select></FormField>
                  <FormField label="Context Profile"><select value={selectedProfile} onChange={(event) => setSelectedProfile(event.target.value)}>
                    {(selectedProfileFamily?.profiles || []).map((profile) => <option key={profile.profile} value={profile.profile}>{profile.label || profile.profile}</option>)}
                  </select></FormField>
                </>
              ) : null}
              <FormField label="Request type">
                <select value={requestType} onChange={(event) => setRequestType(event.target.value)}>
                  <option value="coding">coding</option>
                  <option value="general">general</option>
                  <option value="research">research</option>
                </select>
              </FormField>
            </div>
          </div>
          <StatusBadge tone={pending ? "warning" : error ? "danger" : "success"}>{status}</StatusBadge>
        </header>
        <ErrorBanner message={error} />
        <section className="test-chat-transcript" aria-live="polite">
          {controllerTestChatUrl ? (
            <div className="test-chat-controller-launcher">
              <h2>Controller mode required</h2>
              <p>This routed chat test page runs on the controller because routing, sessions, and thread events are controller-owned.</p>
              <a className="btn btn-ghost" href={controllerTestChatUrl}>Open controller test chat</a>
            </div>
          ) : messages.length ? messages.map((message, index) => (
            <article className={`test-chat-bubble test-chat-bubble-${message.role}${message.pending ? " test-chat-bubble-pending" : ""}`} key={`${message.role}-${index}`}>
              {message.routeMeta ? (
                <div className="test-chat-route-tokens">
                  {message.routeMeta.node ? <code>agent: {message.routeMeta.node}</code> : null}
                  {message.routeMeta.model ? <code>model: {message.routeMeta.model}</code> : null}
                  {message.routeMeta.reason ? <code>reason: {message.routeMeta.reason}</code> : null}
                </div>
              ) : null}
              {message.reasoningContent ? (
                <details className="test-chat-reasoning" open={!message.reasoningCollapsed}>
                  <summary>{message.pending && !message.content ? "Reasoning" : "Reasoning"}</summary>
                  <pre>{message.reasoningContent}</pre>
                </details>
              ) : null}
              <p>{message.content || (message.pending ? "Generating answer..." : "(empty response)")}</p>
            </article>
          )) : <p className="empty">Send a prompt to verify controller routing and agent selection.</p>}
        </section>
        <form className="test-chat-composer" onSubmit={sendPrompt}>
          <FormField label="Prompt">
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} />
          </FormField>
          <div className="modal-actions">
            <Button type="submit" disabled={!prompt.trim() || pending || !sessionActive}>Send</Button>
            <Button type="button" onClick={() => void saveSession()} disabled={!messages.length || pending}>Save session</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
