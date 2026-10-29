const env = (k: string, d = ''): string => process.env[k] ?? d;
const fromAddress = (v: string) => (v.includes('<') ? v : `Bless-A-Family <${v.trim()}>`);

export const config = {
  port: Number(env('PORT', '8787')),
  nodeEnv: env('NODE_ENV', 'development'),
  /** Netlify sets NETLIFY=true (and URL) at build and runtime. */
  isNetlify: !!process.env.NETLIFY,
  isProd: env('NODE_ENV') === 'production' || !!process.env.NETLIFY,
  /** Public URL of the PWA (used in emails / magic links). On Netlify this defaults to the site URL. */
  webUrl: env('WEB_URL', env('URL', 'http://localhost:5173')).replace(/\/$/, ''),
  /** Comma separated allowed origins for CORS. */
  corsOrigins: env('CORS_ORIGINS', 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  /** Airtable whenever a token is present, unless STORE=memory is forced. */
  store: (env('STORE') || (env('AIRTABLE_TOKEN') ? 'airtable' : 'memory')) as 'memory' | 'airtable',
  dataDir: env('DATA_DIR', './data'),
  airtable: {
    token: env('AIRTABLE_TOKEN'),
    baseId: env('AIRTABLE_BASE_ID', 'apphUgu1q4Z7ya3Tw'),
  },
  /** Secret used to sign admin sessions and magic links. */
  sessionSecret: env('SESSION_SECRET', 'dev-secret-change-me'),
  adminEmails: env('ADMIN_EMAILS', 'admin@example.com').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  /** Optional shared passcode so admins can sign in before an email provider is configured. */
  adminPasscode: env('ADMIN_PASSCODE'),
  notify: {
    /** Resend sends every email once RESEND_API_KEY is set; otherwise emails print to the server log. */
    driver: (env('NOTIFY_DRIVER') || (env('RESEND_API_KEY') ? 'resend' : 'console')) as 'console' | 'resend',
    resendKey: env('RESEND_API_KEY'),
    /** RESEND_EMAIL is the verified sender, e.g. bless@thekonnection.org (a display name is added if missing). */
    from: fromAddress(env('RESEND_EMAIL') || env('EMAIL_FROM') || 'bless@thekonnection.org'),
    /** Optional fixed reply-to. Empty = the contact email from admin Settings. */
    replyTo: env('EMAIL_REPLY_TO'),
  },
  anthropic: {
    apiKey: env('ANTHROPIC_API_KEY'),
    agentModel: env('AGENT_MODEL', 'claude-opus-5-5'),
    writerModel: env('WRITER_MODEL', 'claude-opus-5-5'),
  },
  followUp: {
    /** How often the scheduler ticks. */
    tickMinutes: Number(env('FOLLOWUP_TICK_MINUTES', '10')),
    /** Hours after a claim before we ask the sponsor to confirm. */
    confirmHours: Number(env('FOLLOWUP_CONFIRM_HOURS', '48')),
    /** Unanswered nudges before a sponsorship is flagged for admins. */
    flagAfterNudges: Number(env('FOLLOWUP_FLAG_AFTER', '2')),
    enabled: env('FOLLOWUP_ENABLED', 'true') !== 'false',
  },
  /** Load the bundled test households into the in-memory store. Never on by default in production. */
  seedDemo: env('SEED_DEMO', env('NODE_ENV') === 'production' || process.env.NETLIFY ? 'false' : 'true') !== 'false',
};
