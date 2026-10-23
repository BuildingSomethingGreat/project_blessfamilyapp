/** Netlify scheduled function: runs the follow-up engine tick every 15 minutes. */
import { boot } from './netlify.ts';

export default async () => {
  const { services } = await boot();
  const result = await services.followUp.tick();
  console.log('[followups]', result);
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
};

export const config = { schedule: '*/15 * * * *' };
