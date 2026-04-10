import { redirect } from 'next/navigation';

/** Agents use sub-routes only; there is no standalone hub at /agent-dashboard. */
export default function AgentDashboardIndex() {
  redirect('/agent-dashboard/inbox');
}
