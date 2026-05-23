import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const aiApiKey = Deno.env.get('AI_API_KEY');
const aiEndpoint = Deno.env.get('AI_PROVIDER_URL') || 'https://api.openai.com/v1/chat/completions';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!aiApiKey) return jsonResponse({ error: 'AI_API_KEY is not configured' }, 500);
  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Supabase auth is not configured' }, 500);

  try {
    const token = getBearerToken(request);
    if (!token) return jsonResponse({ error: 'Authentication required' }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return jsonResponse({ error: 'Authentication required' }, 401);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (profileError) {
      console.error('ai-blog-assistant profile lookup error', profileError);
      return jsonResponse({ error: 'Unable to verify user role' }, 500);
    }
    if (!['admin', 'lawyer', 'cabinet_admin'].includes(String(profile?.role || ''))) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

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
