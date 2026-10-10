/**
 * OpenRouter API Service
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const DEFAULT_MODEL = "meta-llama/llama-3.1-8b-instruct";

export async function generateRecommendations(
  context,
  candidates,
  model = DEFAULT_MODEL
) {
  if (!API_KEY) {
    throw new Error("VITE_OPENROUTER_API_KEY is missing in .env");
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(context, candidates);

  try {
    console.log("🧠 Sending prompt to OpenRouter (model:", model, ")...");

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "GamePod Recommendation",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenRouter API error ${response.status}: ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();
    const llmResponse = data.choices[0]?.message?.content || "";

    console.log(
      "✅ LLM response received, length:",
      llmResponse.length,
      "characters"
    );

    const parsed = parseLLMResponse(llmResponse);

    return {
      rawResponse: llmResponse,
      recommendations: parsed.recommendations || [],
      reasoning: parsed.reasoning || "",
      model: model,
      usage: data.usage,
    };
  } catch (error) {
    console.error("❌ Failed to call OpenRouter:", error);
    throw error;
  }
}

/**
 * System prompt with "Dynamic Intent Resolution" and strict age compliance
 * to prevent hallucinations and ensure safety.
 */
function buildSystemPrompt() {
  return `You are an expert video game recommendation AI assistant specializing in semantic matching and personalized curation. Your task is to analyze user preferences, seed games, and behavioral history to select the most relevant games from a provided candidate list.

CRITICAL RULES:
1. STRICT AGE COMPLIANCE: You MUST strictly adhere to the user's age restriction provided in the context. DO NOT recommend any game that violates the specified maximum age rating, regardless of how well it matches the vibe.
2. SEMANTIC MATCHING OVER KEYWORDS: The user's "VIBE QUERY" describes atmosphere, mechanics, and narrative themes. Do not just look for literal keyword matches in game titles or genres. Evaluate the deeper thematic, mechanical, and atmospheric connections.
3. DYNAMIC INTENT RESOLUTION: The user's "VIBE QUERY" and "Seed/Anchor Games" represent their IMMEDIATE, explicit intent. If these conflict with long-term "Preferred Genres", you MUST prioritize the Vibe Query and Seeds.
4. NO HALLUCINATIONS: Select ONLY games from the provided candidate list. NEVER invent game names, IDs, or attributes.
5. DIVERSITY: Avoid selecting multiple games from the same developer or with identical core mechanics to ensure a varied recommendation slate.
6. EXPLAINABILITY: For each selected game, provide a concise "reviewBody" (1-2 sentences) explaining WHY it matches the user's vibe query and seeds based on actual gameplay mechanics, narrative style, or developer/publisher similarities.

OUTPUT FORMAT:
Return your response as a VALID JSON object with this exact structure. DO NOT include markdown formatting (like \`\`\`json), code blocks, or any additional text outside the JSON object.
{
  "recommendations": [
    {
      "rawgId": <number>,
      "name": "<string>",
      "reviewBody": "<string explaining why this game fits the vibe query and seeds>"
    }
  ],
  "reasoning": "<brief overall reasoning for your selections, explicitly mentioning how the vibe query and seeds guided the choice>"
}`;
}

/**
 * User prompt that explicitly separates "Long-term Profile"
 * and "Current Session Explicit Intent" with the highest priority,
 * including ESRB ratings for the LLM to evaluate.
 */
function buildUserPrompt(context, candidates) {
  const {
    preferredGenres,
    seedGames,
    recentBehavior,
    vibeQuery,
    ageRestriction,
  } = context;

  const candidatesSummary = candidates
    .map((g, i) => {
      const genres = (g.genres || []).map(x => x.name).join(", ");
      const developers = (g.developers || []).map(x => x.name).join(", ");
      const publishers = (g.publishers || []).map(x => x.name).join(", ");
      const esrb = g.esrb_rating?.name || "NR";
      return `${i + 1}. [ID:${g.id}] "${g.name}" | ESRB: ${esrb} | Genres: ${
        genres || "-"
      } | Dev: ${developers || "-"} | Pub: ${publishers || "-"} | Rating: ${
        g.rating || "-"
      } | Released: ${g.released || "-"}`;
    })
    .join("\n");

  const seedSummary =
    seedGames.length > 0
      ? seedGames.map(g => `"${g.name}"`).join(", ")
      : "None";

  const behaviorSummary =
    recentBehavior.length > 0
      ? recentBehavior
          .slice(0, 10)
          .map(b => `${b.type} on "${b.gameName}"`)
          .join("; ")
      : "No recent behavior";

  return `USER CONTEXT (from their Solid Pod):
- Long-term Preferred Genres: ${preferredGenres?.join(", ") || "Not specified"}
- Recent Behavior: ${behaviorSummary}
- AGE RESTRICTION (STRICT): ${ageRestriction || "None"}

CURRENT SESSION EXPLICIT INTENT (HIGHEST PRIORITY):
- Vibe Query: "${vibeQuery || "Find games similar to my seeds and preferences"}"
- Seed/Anchor Games: ${seedSummary}

CANDIDATE GAMES (select from these ONLY):
${candidatesSummary}

TASK: Select the TOP 5-8 games from the candidate list that best match the CURRENT SESSION EXPLICIT INTENT (Vibe Query and Seeds). 
1. First, filter out any game that violates the AGE RESTRICTION.
2. Then, evaluate the remaining games semantically. If a game does not literally match the vibe query keywords, prioritize those that share developers, publishers, or core mechanics with the Seed Games.
3. Provide a highly specific, natural language "reviewBody" for each selection.

Return your response as a valid JSON object.`;
}

function parseLLMResponse(responseText) {
  try {
    return JSON.parse(responseText);
  } catch (e) {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
        console.warn("Failed to parse JSON from code block:", e2);
      }
    }

    const braceMatch = responseText.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch (e3) {
        console.warn("Failed to parse JSON from brace match:", e3);
      }
    }

    console.warn(
      "Unable to parse LLM response as JSON. Raw response:",
      responseText
    );
    return { recommendations: [], reasoning: "Failed to parse LLM response" };
  }
}

export const RECOMMENDED_MODELS = {
  fast: "meta-llama/llama-3.1-8b-instruct",
  balanced: "anthropic/claude-3-haiku",
  smart: "anthropic/claude-3.5-sonnet",
  openai: "openai/gpt-4o-mini",
};
