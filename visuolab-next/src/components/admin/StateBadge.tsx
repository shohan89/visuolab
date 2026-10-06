import { STATE_LABEL, type ConnectionState } from "@/lib/integrations/core";

/** The four states of an integration, always as a word (colour is only a second cue). */
export default function StateBadge({ state }: { state: ConnectionState }) {
  return <span className={`badge st-${state}`} data-state={state}>{STATE_LABEL[state]}</span>;
}
