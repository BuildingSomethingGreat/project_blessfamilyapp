const env = (k: string, d = ''): string => process.env[k] ?? d;

export const config = {
  port: Number(env('PORT', '8787')),
  nodeEnv: env('NODE_ENV', 'development'),
  isProd: env('NODE_ENV') === 'production',
  /** Public URL of the PWA (used in emails / magic links). */
  webUrl: env('WEB_URL', 'http://localhost:5173').replace(/\/$/, ''),
  /** Comma separated allowed origins for CORS. */
  corsOrigins: env('CORS_ORIGINS', 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  store: env('STORE', 'memory') as 'memory' | 'airtable',
  dataDir: env('DATA_DIR', './data'),
  airtable: {
    token: env('AIRTABLE_TOKEN'),
    baseId: env('AIRTABLE_BASE_ID', 'apphUgu1q4Z7ya3Tw'),
  },
  /** Secret used to sign admin sessions and magic links. */
  sessionSecret: env('SESSION_SECRET', 'dev-secret-change-me'),
  adminEmails: env('ADMIN_EMAILS', 'admin@example.com').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  notify: {
    driver: env('NOTIFY_DRIVER', 'console') as 'console' | 'resend',
    resendKey: env('RESEND_API_KEY'),
    from: env('EMAIL_FROM', 'The Konnection <bless@thekonnection.org>'),
    replyTo: env('EMAIL_REPLY_TO', 'info@thekonnection.org'),
    twilio: { sid: env('TWILIO_ACCOUNT_SID'), token: env('TWILIO_AUTH_TOKEN'), from: env('TWILIO_FROM') },
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
  seedDemo: env('SEED_DEMO', 'true') !== 'false',
};
