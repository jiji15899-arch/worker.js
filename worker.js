export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const { type, topic, mode, lang, contentToRefine } = await request.json();

      // 1. 이미지 생성 (고화질 설정)
      if (type === "image") {
        const response = await env.AI.run('@cf/bytedance/stable-diffusion-xl-lightning', { 
          prompt: `High-quality professional blog hero image for "${topic}", clean, 4k, no text` 
        });
        const binary = await response.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(binary)));
        return new Response(JSON.stringify({ image: base64 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. 글 생성 (국가별 맥락 + 모드별 특성 100% 복구)
      if (type === "text") {
        const contexts = {
          'ko': { region: 'South Korea', currency: 'KRW', culture: 'Korean' },
          'en': { region: 'United States', currency: 'USD', culture: 'American' },
          'ja': { region: 'Japan', currency: 'JPY', culture: 'Japanese' }
        };
        const ctx = contexts[lang] || contexts['ko'];

        let modeSystem = "";
        if (mode === 'adsense_approval') {
          modeSystem = "Role: Expert Academic Blogger. Style: Informative, long-form (3000+ chars), formal tone. Structure: Background -> Technical Analysis -> Practical Implications -> Summary.";
        } else if (mode === 'pasona') {
          modeSystem = "Role: Direct Response Copywriter. Style: Persuasive, emotional, PASONA formula (Problem, Affinity, Solution, Offer, Narrow, Action). Focus on high CTR.";
        } else if (mode === 'grant') {
          modeSystem = "Role: Policy Specialist. Style: Clear, factual. MUST include an HTML <table> for eligibility/benefits. Step-by-step guide.";
        }

        const prompt = `Write a professional blog post about "${topic}" in ${lang}. 
          Target Region: ${ctx.region}. 
          ${modeSystem}
          Return ONLY a JSON object: {"title": "...", "body": "..."}. Use HTML tags (h2, h3, p, table, ul, li).`;

        const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: "system", content: "You are a JSON-only API. No conversation. No markdown blocks." },
            { role: "user", content: prompt }
          ]
        });
        return new Response(JSON.stringify({ result: response.response }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 3. 분석 및 점수 (SEO, 수익성, 승인 확률)
      if (type === "analyze") {
        const analysisPrompt = `Analyze this for SEO, Revenue, and Approval probability in ${lang}: "${contentToRefine.substring(0, 1000)}".
          Return JSON only: {"seo": 0-100, "rev": 0-100, "app": 0-100, "advice": "One sentence"}`;
        const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [{ role: "system", content: "Output raw JSON only." }, { role: "user", content: analysisPrompt }]
        });
        return new Response(JSON.stringify({ result: response.response }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
}
