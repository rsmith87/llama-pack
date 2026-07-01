import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import { EmptyState, FormField, Panel, Button } from "../../components/ui";
import type { ChatMessage, ChatSession } from "../../types/chat";
import type { DocumentCollectionRecord } from "../../api/documentCollections";
import { useDateTime } from "../../features/dateTime/dateTimeContext";
import {
  routeExplanationItems,
  sessionLabel,
  telemetryChips,
} from "../../features/chat";

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export function ChatSessionsPanel({
  sessionName,
  selectedSessionId,
  sessions,
  messages,
  onSessionNameChange,
  onSelectedSessionIdChange,
  onRefreshSessions,
  onLoadSession,
  onSaveSession,
  onSaveAsNewSession,
  onDeleteSession,
  onResumeRecentSession,
}: {
  sessionName: string;
  selectedSessionId: string;
  sessions: ChatSession[];
  messages: ChatMessage[];
  onSessionNameChange: (value: string) => void;
  onSelectedSessionIdChange: (value: string) => void;
  onRefreshSessions: () => void;
  onLoadSession: () => void;
  onSaveSession: () => void;
  onSaveAsNewSession: () => void;
  onDeleteSession: () => void;
  onResumeRecentSession: () => void;
}) {
  const { formatConfiguredDateTime } = useDateTime();
  const formatDisplayDateTime = (value: string | null | undefined) => formatConfiguredDateTime(value).label;
  return (
    <Panel title="Conversation History" eyebrow="Save and resume" className="chat-sessions-panel">
      <div className="chat-session-panel chat-session-panel-top">
        <FormField label="Session name"><input value={sessionName} onChange={(event) => onSessionNameChange(event.target.value)} placeholder="Session name" /></FormField>
        <FormField label="Saved sessions">
          <select value={selectedSessionId} onChange={(event) => onSelectedSessionIdChange(event.target.value)}>
            <option value="">Select a session</option>
            {sessions.map((session) => <option key={session.id} value={session.id}>{sessionLabel(session, formatDisplayDateTime)}</option>)}
          </select>
        </FormField>
        <div className="modal-actions">
          <Button type="button" onClick={onRefreshSessions}>Refresh Sessions</Button>
          <Button type="button" onClick={onLoadSession} disabled={!selectedSessionId.trim()}>Load Session</Button>
          <Button type="button" onClick={onSaveSession} disabled={!messages.length}>Save Session</Button>
          <Button type="button" onClick={onSaveAsNewSession} disabled={!messages.length}>Save As New</Button>
          <Button type="button" onClick={onDeleteSession} disabled={!selectedSessionId.trim()}>Delete Session</Button>
          <Button type="button" onClick={onResumeRecentSession}>Resume Recent</Button>
        </div>
      </div>
    </Panel>
  );
}

export function ChatTranscriptPanel({
  transcriptRef,
  controllerChatUrl,
  messages,
}: {
  transcriptRef: RefObject<HTMLDivElement | null>;
  controllerChatUrl: string;
  messages: ChatMessage[];
}) {
  return (
    <div ref={transcriptRef} className="chat-transcript" aria-live="polite">
      {controllerChatUrl ? (
        <div className="test-chat-controller-launcher">
          <h2>Controller mode required</h2>
          <p>Routed chat conversations, sessions, and thread events are controller-owned.</p>
          <a className="btn btn-ghost" href={controllerChatUrl}>Open controller chat</a>
        </div>
      ) : messages.length ? messages.map((message, index) => {
        const routeItems = routeExplanationItems(message);
        return (
          <article className={`chat-bubble chat-bubble-${message.role}`} key={`${message.role}-${index}`}>
            <span className="chat-role">{message.role}</span>
            {telemetryChips(message).length ? (
              <div className="chat-chips">
                {telemetryChips(message).map((chip) => <span className="chat-chip" key={chip}>{chip}</span>)}
              </div>
            ) : null}
            {message.reasoningContent ? (
              <details className="chat-reasoning" open={message.pending ? true : undefined}>
                <summary>{message.pending ? "Reasoning (streaming...)" : "Reasoning"}</summary>
                <pre>{message.reasoningContent}</pre>
              </details>
            ) : null}
            {message.content ? (
              message.role === "user" ? <p>{message.content}</p> : <MarkdownMessage content={message.content} />
            ) : message.pending ? (
              <div className="chat-activity" data-testid="assistant-activity-indicator" role="status">
                <span className="chat-activity-dots" aria-hidden="true"><span /> <span /> <span /></span>
                <span>Agent is responding</span>
              </div>
            ) : (
              <p>(empty response)</p>
            )}
            {message.imageName ? <small>image: {message.imageName}</small> : null}
            {routeItems.length ? (
              <details className="chat-route-detail">
                <summary>Route</summary>
                <ul>
                  {routeItems.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </details>
            ) : null}
            {message.documentCitations?.length ? (
              <details className="chat-source-detail" open>
                <summary>Sources</summary>
                <ul>
                  {message.documentCitations.map((citation) => (
                    <li key={citation.chunk_id}>
                      <strong>{citation.filename}</strong>
                      <span>{citation.collection_name} chunk {citation.chunk_index}</span>
                      <p>{citation.text}</p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {message.stopped ? <small>stopped</small> : null}
          </article>
        );
      }) : <EmptyState message="Start a running model, choose it here, and send a test prompt." />}
    </div>
  );
}

export function ChatComposer({
  prompt,
  pending,
  enterToSend,
  canSend,
  lastPrompt,
  showImageUpload,
  selectedImage,
  documentCollections,
  selectedDocumentCollectionIds,
  onSubmit,
  onPromptChange,
  onPromptKeyDown,
  onImageChange,
  onRemoveImage,
  onDocumentCollectionToggle,
  onEnterToSendChange,
  onStop,
  onRegenerate,
  onClear,
}: {
  prompt: string;
  pending: boolean;
  enterToSend: boolean;
  canSend: boolean;
  lastPrompt: string;
  showImageUpload: boolean;
  selectedImage: { name: string; dataUrl: string } | null;
  documentCollections: DocumentCollectionRecord[];
  selectedDocumentCollectionIds: string[];
  onSubmit: (event: FormEvent) => void;
  onPromptChange: (value: string) => void;
  onPromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onDocumentCollectionToggle: (collectionId: string, selected: boolean) => void;
  onEnterToSendChange: (value: boolean) => void;
  onStop: () => void;
  onRegenerate: () => void;
  onClear: () => void;
}) {
  const selectableCollections = Array.isArray(documentCollections) ? documentCollections : [];
  const selectedCollectionIds = Array.isArray(selectedDocumentCollectionIds) ? selectedDocumentCollectionIds : [];
  return (
    <form className="chat-composer" onSubmit={onSubmit}>
      <FormField label="Prompt">
        <textarea value={prompt} onChange={(event) => onPromptChange(event.target.value)} onKeyDown={onPromptKeyDown} rows={4} disabled={pending} placeholder="/remember saves text to controller memory" />
      </FormField>
      {showImageUpload ? (
        <div className="chat-image-upload">
          <FormField label="Image">
            <input type="file" accept="image/*" onChange={onImageChange} disabled={pending} />
          </FormField>
          {selectedImage ? (
            <div className="chat-image-preview">
              <img src={selectedImage.dataUrl} alt="" />
              <span>{selectedImage.name}</span>
              <Button type="button" onClick={onRemoveImage} disabled={pending}>Remove</Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {selectableCollections.length ? (
        <fieldset className="chat-collection-picker">
          <legend>Collections</legend>
          {selectableCollections.map((collection) => (
            <label className="checkbox-label" key={collection.id}>
              <input
                type="checkbox"
                checked={selectedCollectionIds.includes(collection.id)}
                disabled={pending}
                onChange={(event) => onDocumentCollectionToggle(collection.id, event.target.checked)}
              />
              {collection.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="modal-actions">
        <label className="checkbox-label"><input type="checkbox" checked={enterToSend} onChange={(event) => onEnterToSendChange(event.target.checked)} />Enter to send</label>
        <Button type="submit" disabled={!canSend}>Send</Button>
        <Button type="button" onClick={onStop} disabled={!pending}>Stop</Button>
        <Button type="button" onClick={onRegenerate} disabled={pending || !lastPrompt}>Regenerate</Button>
        <Button type="button" onClick={onClear} disabled={pending}>Clear</Button>
      </div>
    </form>
  );
}
