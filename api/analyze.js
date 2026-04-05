export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, mediaType, currency = 'USD' } = req.body;
  if (!image || !mediaType) {
    return res.status(400).json({ error: 'Missing image or mediaType' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `You are an expert home appliance analyst. Analyze this image of a home device or appliance and return ONLY valid JSON (no markdown, no extra text) matching this exact structure:

{
  "identified": true,
  "device_name": "Full product name",
  "brand": "Brand name",
  "model": "Model number/name if visible, else 'Unknown'",
  "category": "Category (e.g. Refrigerator, Washing Machine, AC Unit, Microwave, TV, etc.)",
  "year_estimate": "Estimated year range, e.g. '2018–2020'",
  "age_years": "Estimated current age in years, e.g. '5–7 years'",
  "manufacturing_quality": {
    "score": 7,
    "label": "Good / Average / Poor",
    "detail": "One sentence about build/manufacturing quality"
  },
  "market_status": {
    "status": "Current / Discontinued / Updated",
    "label": "Short label",
    "detail": "One sentence about market availability"
  },
  "overall_rating": {
    "score": 7,
    "label": "Excellent / Good / Average / Below Average / Poor",
    "verdict": "One sentence overall assessment"
  },
  "environmental_impact": {
    "score": 6,
    "label": "Eco-Friendly / Average / High Impact",
    "energy_rating": "Energy Star / A+++ / A++ / A+ / A / B / C / Unknown",
    "detail": "One sentence about environmental credentials"
  },
  "utility_bills": {
    "score": 6,
    "impact": "Low / Medium / High",
    "label": "Low / Medium / High running cost",
    "annual_estimate": "Rough annual running cost estimate or range expressed in ${currency}, e.g. '${currency} 80–120/yr'",
    "detail": "One sentence about energy/utility consumption"
  },
  "replacement": {
    "urgency": "Not needed / Consider soon / Replace now",
    "timeline": "e.g. '3–5 years' or 'Immediate'",
    "reason": "One sentence explaining why",
    "estimated_cost": "Rough replacement cost range in ${currency}"
  },
  "fun_fact": "One interesting or useful fact about this appliance model or category",
  "confidence": "high / medium / low"
}

Express all monetary costs in ${currency}. If you cannot identify any appliance in the image, set "identified" to false and fill other fields with null.
Scores are 1–10 (10 = best). Be accurate and concise.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();
    const text = data.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse response' });

    return res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
