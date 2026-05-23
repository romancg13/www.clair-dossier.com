import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const aiApiKey = Deno.env.get('AI_API_KEY');
const aiEndpoint = Deno.env.get('AI_PROVIDER_URL') || 'https://api.openai.com/v1/chat/completions';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, request);
  if (!aiApiKey || !supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'AI configuration missing' }, 500, request);

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Authentication required' }, 401, request);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: 'Authentication required' }, 401, request);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (profileError) console.error('ai-blog-assistant role lookup error', profileError);
    if (profile?.role !== 'super_admin') return jsonResponse({ error: 'Access denied' }, 403, request);

    const { topic, audience = 'non juristes', goal = 'plan SEO/GEO prudent' } = await request.json();
    if (!topic || String(topic).length > 180) return jsonResponse({ error: 'topic is required' }, 400, request);

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
      return jsonResponse({ error: 'AI provider unavailable' }, 502, request);
    }

    return jsonResponse(await response.json(), 200, request);
  } catch (error) {
    console.error('ai-blog-assistant error', error);
    return jsonResponse({ error: 'Unable to generate content assistance' }, 500, request);
  }
});
