import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const aiApiKey = Deno.env.get('AI_API_KEY');
const aiEndpoint = Deno.env.get('AI_PROVIDER_URL') || 'https://api.openai.com/v1/chat/completions';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!aiApiKey) return jsonResponse({ error: 'AI_API_KEY is not configured' }, 500);

  try {
    const { topic, audience = 'non juristes', goal = 'plan SEO/GEO prudent' } = await request.json();
    if (!topic) return jsonResponse({ error: 'topic is required' }, 400);

    const response = await fetch(aiEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: "Tu aides à préparer des contenus LegalTech informatifs. Reste prudent : pas de conseil juridique personnalisé, rappelle que l'IA ne remplace pas l'avocat." },
          { role: 'user', content: `Sujet: ${topic}. Audience: ${audience}. Objectif: ${goal}. Propose idées, plan, méta-description, FAQ, résumé et liens internes.` },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      console.error('AI provider error', await response.text());
      return jsonResponse({ error: 'AI provider unavailable' }, 502);
    }

    return jsonResponse(await response.json());
  } catch (error) {
    console.error('ai-blog-assistant error', error);
    return jsonResponse({ error: 'Unable to generate content assistance' }, 500);
  }
});
