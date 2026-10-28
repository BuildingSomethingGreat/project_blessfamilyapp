import Anthropic from '@anthropic-ai/sdk';
import { toPublicFamily, SPONSORSHIP_STATUSES, FAMILY_STATUSES, canTransition, type SponsorshipStatus, type FamilyStatus } from '@bless/shared';
import { config } from '../config.ts';
import type { Services } from '../lib/services.ts';
import { buildReport } from '../lib/reporting.ts';
import { nowIso } from '../lib/ids.ts';

/**
 * Admin assistant: a Claude tool-use loop over the store. Reads are free;
 * writes are logged as agent_action and anything irreversible (release)
 * requires the admin to say so explicitly in the conversation.
 */

type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaTool = Anthropic.Beta.Messages.BetaTool;

export interface AgentTurn {
  conversationId: string;
  reply: string;
  actions: { tool: string; summary: string }[];
  usage?: { input: number; output: number };
}

const SYSTEM = `You are the operations assistant for The Konnection's Bless-A-Family holiday program. You help a small team of nonprofit admins make fast, confident decisions.

What the program is: families in the organization submit a holiday wishlist per child. Approved families appear in a public catalog. Gift givers are called "Holiday Konnectors" (the code and tools call them sponsors; always say "Holiday Konnector" or "Konnector" to admins). A Konnector "claims" a whole family, buys the same number of gifts for each child, wraps and labels them with the child's name, and either drops them off at the drop-off site or delivers directly to the family (staff connect them privately) by the deadline. The system follows up with sponsors automatically (the "dominoes": Claimed → Shopping → Purchased → Wrapped → Dropped Off → Delivered). After unanswered follow-ups a sponsorship is flagged for a human.

How to behave:
- Lead with the answer. Use the tools to get real numbers; never guess. Keep replies short and skimmable — plain sentences, short lists, no headers for short answers.
- When asked "what should we do", give a recommendation with the 1–3 highest-leverage actions and why.
- Reads are free. For writes: nudge, flag, approve, status changes are fine when the admin asks. Releasing a sponsorship (reopening a family) is irreversible — ask the admin to confirm first unless they already said "release" explicitly in this message.
- Never reveal guardian names, phone numbers, or addresses in a reply unless the admin explicitly asks for that family's contact info.
- Dates: the drop-off deadline matters for everything; mention days left when relevant.`;

const tools: BetaTool[] = [
  { name: 'get_report', description: 'Full program report: pipeline counts, families left, follow-up metrics (response rate, overdue sponsors), matching stats, deadline. Call this first for most questions.', input_schema: { type: 'object', properties: {}, additionalProperties: false }, strict: true },
  { name: 'list_families', description: 'List families with status, child count, nickname, views, days waiting. Filter by status or free-text query (nickname, family id, child name, city).', input_schema: { type: 'object', properties: { status: { type: 'array', items: { type: 'string', enum: [...FAMILY_STATUSES] } }, query: { type: 'string' } }, required: [], additionalProperties: false } },
  { name: 'get_family', description: 'Full detail for one family by family id (BF-2026-001) including children wishlists, sponsorship, and recent activity. Includes private contact info — only surface it if asked.', input_schema: { type: 'object', properties: { familyId: { type: 'string' } }, required: ['familyId'], additionalProperties: false }, strict: true },
  { name: 'list_sponsorships', description: 'List sponsorships (the dominoes tracker) with sponsor name, status, follow-up count, last response, flagged. Filter by status or onlyOverdue.', input_schema: { type: 'object', properties: { status: { type: 'array', items: { type: 'string', enum: [...SPONSORSHIP_STATUSES] } }, onlyOverdue: { type: 'boolean' } }, required: [], additionalProperties: false } },
  { name: 'send_nudge', description: 'Send a follow-up message to a sponsor now, on their preferred channel. Optionally provide a custom message body; otherwise the right template for their step is used.', input_schema: { type: 'object', properties: { sponsorshipId: { type: 'string' }, message: { type: 'string' } }, required: ['sponsorshipId'], additionalProperties: false } },
  { name: 'update_sponsorship', description: 'Move a sponsorship to a new step (e.g. mark Delivered after staff delivered gifts) or flag/unflag it with a reason. Releasing requires confirmed=true.', input_schema: { type: 'object', properties: { sponsorshipId: { type: 'string' }, status: { type: 'string', enum: [...SPONSORSHIP_STATUSES] }, flagged: { type: 'boolean' }, reason: { type: 'string' }, confirmed: { type: 'boolean' } }, required: ['sponsorshipId'], additionalProperties: false } },
  { name: 'update_family', description: 'Approve a family (status Available), decline, mark needs info, approve its story or photo for public display, or add admin notes.', input_schema: { type: 'object', properties: { familyId: { type: 'string' }, status: { type: 'string', enum: [...FAMILY_STATUSES] }, storyApproved: { type: 'boolean' }, photoApproved: { type: 'boolean' }, adminNotes: { type: 'string' }, nickname: { type: 'string' } }, required: ['familyId'], additionalProperties: false } },
  { name: 'draft_message', description: 'Draft (do not send) a message to a sponsor or family for the admin to review.', input_schema: { type: 'object', properties: { to: { type: 'string' }, intent: { type: 'string' } }, required: ['to', 'intent'], additionalProperties: false }, strict: true },
];

const conversations = new Map<string, { messages: BetaMessageParam[]; updatedAt: number }>();

export class AdminAgent {
  private client: Anthropic | null;
  constructor(private services: Services) {
    this.client = config.anthropic.apiKey ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;
  }

  get enabled() {
    return !!this.client;
  }

  private async exec(name: string, input: any, admin: string): Promise<{ result: string; summary?: string }> {
    const { store, followUp } = this.services;
    const log = (subject: string, meta: Record<string, unknown> = {}) =>
      store.logActivity({ type: 'agent_action', channel: 'system', familyId: (meta.familyId as string) ?? null, sponsorshipId: (meta.sponsorshipId as string) ?? null, subject, body: '', meta: { ...meta, admin }, occurredAt: nowIso() });

    switch (name) {
      case 'get_report': {
        const r = await buildReport(store);
        return { result: JSON.stringify(r) };
      }
      case 'list_families': {
        const settings = await store.getSettings();
        let fams = await store.listFamilies({ season: settings.season, status: input.status?.length ? input.status : undefined });
        if (input.query) {
          const q = String(input.query).toLowerCase();
          fams = fams.filter((f) => [f.familyId, f.nickname, f.city, toPublicFamily(f).nickname, ...f.children.map((c) => c.name)].some((x) => x?.toLowerCase().includes(q)));
        }
        return { result: JSON.stringify(fams.map((f) => { const p = toPublicFamily(f); return { familyId: f.familyId, nickname: p.nickname, status: f.status, children: f.children.map((c) => `${c.name.split(' ')[0]} (${c.age})`), city: f.city, views: f.views, claimStarts: f.claimStarts, daysWaiting: p.daysWaiting, storyApproved: f.storyApproved, hasStory: !!f.familyStory, tags: p.tags }; })) };
      }
      case 'get_family': {
        const f = await store.getFamilyByCode(input.familyId);
        if (!f) return { result: `No family ${input.familyId}` };
        const [sps, activity] = await Promise.all([store.listSponsorships({ familyId: f.id }), store.listActivity({ familyId: f.id, limit: 20 })]);
        const sponsors = await Promise.all(sps.map(async (s) => ({ ...s, sponsor: await store.getSponsor(s.sponsorId) })));
        return { result: JSON.stringify({ ...f, public: toPublicFamily(f), sponsorships: sponsors.map((s) => ({ sponsorshipId: s.sponsorshipId, status: s.status, sponsor: s.sponsor?.name, email: s.sponsor?.email, claimedAt: s.claimedAt, lastResponseAt: s.lastResponseAt, followUpCount: s.followUpCount, flagged: s.flagged, flagReason: s.flagReason, nextFollowUpAt: s.nextFollowUpAt })), activity: activity.map((a) => ({ type: a.type, subject: a.subject, at: a.occurredAt })) }) };
      }
      case 'list_sponsorships': {
        const list = await store.listSponsorships({ status: input.status?.length ? input.status : undefined });
        const rows = await Promise.all(list.map(async (s) => {
          const [f, sp] = await Promise.all([store.getFamily(s.familyId), store.getSponsor(s.sponsorId)]);
          const last = s.lastResponseAt ?? s.claimedAt;
          const daysSilent = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
          return { sponsorshipId: s.sponsorshipId, familyId: f?.familyId, nickname: f ? toPublicFamily(f).nickname : '', sponsor: sp?.name, sponsorEmail: sp?.email, status: s.status, claimedAt: s.claimedAt, lastResponseAt: s.lastResponseAt, lastNudgedAt: s.lastNudgedAt, nextFollowUpAt: s.nextFollowUpAt, followUpCount: s.followUpCount, flagged: s.flagged, flagReason: s.flagReason, daysSilent, note: s.sponsorNote };
        }));
        return { result: JSON.stringify(input.onlyOverdue ? rows.filter((r) => r.flagged || (r.daysSilent >= 3 && !['Delivered', 'Released', 'Dropped Off'].includes(r.status))) : rows) };
      }
      case 'send_nudge': {
        const s = await store.getSponsorshipByCode(input.sponsorshipId);
        if (!s) return { result: 'No such sponsorship' };
        const kind = s.status === 'Claimed' ? 'confirm_nudge' : 'shopping_checkin';
        const res = await followUp.send(kind, s, { custom: input.message, actor: 'agent' });
        await store.updateSponsorship(s.id, { lastNudgedAt: nowIso(), followUpCount: s.followUpCount + 1 });
        await log(`Agent sent ${kind} to ${s.sponsorshipId}`, { sponsorshipId: s.id, familyId: s.familyId });
        return { result: JSON.stringify(res), summary: `Sent "${res.subject}" to sponsor of ${s.sponsorshipId}` };
      }
      case 'update_sponsorship': {
        const s = await store.getSponsorshipByCode(input.sponsorshipId);
        if (!s) return { result: 'No such sponsorship' };
        const out: string[] = [];
        if (input.status && input.status !== s.status) {
          if (input.status === 'Released' && !input.confirmed) return { result: 'Refused: releasing is irreversible. Ask the admin to confirm, then call again with confirmed=true.' };
          if (!canTransition(s.status, input.status as SponsorshipStatus)) return { result: `Cannot move from ${s.status} to ${input.status}` };
          await followUp.transition(s, input.status, { actor: 'agent', reason: input.reason });
          out.push(`status → ${input.status}`);
        }
        if (typeof input.flagged === 'boolean') {
          await store.updateSponsorship(s.id, { flagged: input.flagged, flagReason: input.flagged ? input.reason ?? 'Flagged by assistant' : '' });
          out.push(input.flagged ? 'flagged' : 'unflagged');
        }
        await log(`Agent updated ${s.sponsorshipId}: ${out.join(', ')}`, { sponsorshipId: s.id, familyId: s.familyId, reason: input.reason });
        return { result: `Updated ${s.sponsorshipId}: ${out.join(', ') || 'nothing changed'}`, summary: `${s.sponsorshipId}: ${out.join(', ')}` };
      }
      case 'update_family': {
        const f = await store.getFamilyByCode(input.familyId);
        if (!f) return { result: 'No such family' };
        const patch: Record<string, unknown> = {};
        if (input.status) {
          patch.status = input.status as FamilyStatus;
          if (input.status === 'Available' && !f.approvedAt) patch.approvedAt = nowIso();
        }
        if (typeof input.storyApproved === 'boolean') patch.storyApproved = input.storyApproved;
        if (typeof input.photoApproved === 'boolean') patch.photoApproved = input.photoApproved;
        if (input.adminNotes) patch.adminNotes = (f.adminNotes ? f.adminNotes + '\n' : '') + `[${new Date().toLocaleDateString()}] ${input.adminNotes}`;
        if (input.nickname) patch.nickname = input.nickname;
        await store.updateFamily(f.id, patch);
        if (input.status === 'Available' && f.status !== 'Available') followUp.sendToFamily('family_approved', { ...f, ...patch } as any).catch(() => {});
        await log(`Agent updated ${f.familyId}: ${Object.keys(patch).join(', ')}`, { familyId: f.id, patch });
        return { result: `Updated ${f.familyId}: ${Object.keys(patch).join(', ')}`, summary: `${f.familyId}: ${Object.keys(patch).join(', ')}` };
      }
      case 'draft_message':
        return { result: 'Write the draft yourself in the reply, clearly labeled as a draft. The admin will copy or ask you to send it.' };
      default:
        return { result: `Unknown tool ${name}` };
    }
  }

  async chat(conversationId: string | undefined, userMessage: string, admin: string): Promise<AgentTurn> {
    if (!this.client) throw new Error('Assistant is not configured (ANTHROPIC_API_KEY missing).');
    for (const [k, v] of conversations) if (Date.now() - v.updatedAt > 6 * 3_600_000) conversations.delete(k);
    const id = conversationId && conversations.has(conversationId) ? conversationId : crypto.randomUUID();
    const convo = conversations.get(id) ?? { messages: [], updatedAt: Date.now() };
    conversations.set(id, convo);
    const settings = await this.services.store.getSettings();
    convo.messages.push({ role: 'user', content: userMessage });

    const actions: AgentTurn['actions'] = [];
    let reply = '';
    let usage = { input: 0, output: 0 };
    for (let i = 0; i < 12; i++) {
      const res = await this.client.beta.messages.create({
        model: config.anthropic.agentModel,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        system: [{ type: 'text', text: SYSTEM + `\n\nSeason ${settings.season}. Drop-off deadline ${settings.dropoffDeadline}. Today is ${new Date().toISOString().slice(0, 10)}. Admin: ${admin}.`, cache_control: { type: 'ephemeral' } }],
        tools,
        messages: convo.messages,
      });
      usage = { input: usage.input + res.usage.input_tokens, output: usage.output + res.usage.output_tokens };
      convo.messages.push({ role: 'assistant', content: res.content });
      if (res.stop_reason === 'refusal') { reply = "I can't help with that one."; break; }
      if (res.stop_reason === 'pause_turn') continue;
      const toolUses = res.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !toolUses.length) {
        reply = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
        break;
      }
      const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        try {
          const r = await this.exec(tu.name, tu.input, admin);
          if (r.summary) actions.push({ tool: tu.name, summary: r.summary });
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: r.result.slice(0, 60_000) });
        } catch (e) {
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: `Error: ${(e as Error).message}`, is_error: true });
        }
      }
      convo.messages.push({ role: 'user', content: results });
    }
    convo.updatedAt = Date.now();
    return { conversationId: id, reply: reply || 'Done.', actions, usage };
  }
}
