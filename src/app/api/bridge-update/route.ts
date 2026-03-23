import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const BRIDGE_SYSTEM_PROMPT = `You are a traffic monitoring assistant focused EXCLUSIVELY on the Wilson Pigott Bridge and State Road 31 (SR-31/Babcock Ranch Road) in Lee County, Florida. This bridge carries SR-31 over the Caloosahatchee River near Fort Myers/North Fort Myers.

Search for the latest news and updates about this bridge. Focus on:
1. Current bridge status (open/closed/restricted)
2. Upcoming closure dates
3. Lane restrictions or delays
4. Construction progress
5. Emergency repairs or schedule changes
6. Detour information

Return ONLY a raw JSON object (no markdown, no backticks, no prose before or after) with this exact structure:
{
  "bridge_status": "OPEN" or "RESTRICTED" or "CLOSED",
  "status_detail": "Brief description of current status",
  "source_updated": "When the most recent news was published",
  "upcoming_closure": {
    "expected_date": "Date or range if known",
    "duration": "Expected duration if known",
    "reason": "Why"
  },
  "current_restrictions": ["List of active restrictions"],
  "detour_info": "Current detour details",
  "recent_updates": [
    {
      "date": "Publication date",
      "source": "News source",
      "headline": "Brief headline",
      "summary": "2-3 sentence summary",
      "url": "Source URL"
    }
  ],
  "alerts": ["Any urgent or time-sensitive alerts"]
}`;

function extractJSON(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text.trim());
  } catch {
    // continue
  }
  const stripped = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // continue
  }
  const start = stripped.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === "{") depth++;
    else if (stripped[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(stripped.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: BRIDGE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content:
              "Search for the latest news about the Wilson Pigott Bridge and SR-31 construction in Lee County, Florida. Find the most recent updates. Return ONLY the raw JSON object as specified — no markdown, no backticks, no other text.",
          },
        ],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Anthropic API error", details: errorText },
        { status: 502 }
      );
    }

    const result = await response.json();

    const allText = (result.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    const parsed = extractJSON(allText);
    if (!parsed) {
      console.error("Failed to parse JSON from response:", allText);
      return NextResponse.json(
        { error: "Failed to parse bridge data", raw: allText },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const upcomingClosure = parsed.upcoming_closure as {
      expected_date?: string;
      duration?: string;
      reason?: string;
    } | null;

    const { error: statusError } = await supabase.from("bridge_status").insert({
      bridge_status: parsed.bridge_status,
      status_detail: parsed.status_detail,
      upcoming_closure_date: upcomingClosure?.expected_date || null,
      upcoming_closure_duration: upcomingClosure?.duration || null,
      upcoming_closure_reason: upcomingClosure?.reason || null,
      current_restrictions: parsed.current_restrictions || [],
      detour_info: parsed.detour_info,
      alerts: parsed.alerts || [],
      source_updated: parsed.source_updated,
    });

    if (statusError) {
      console.error("Error inserting bridge_status:", statusError);
      return NextResponse.json(
        { error: "Database insert error", details: statusError },
        { status: 500 }
      );
    }

    const recentUpdates = (parsed.recent_updates as Array<{
      date?: string;
      source?: string;
      headline?: string;
      summary?: string;
      url?: string;
    }>) || [];

    if (recentUpdates.length > 0) {
      // Get existing headlines to avoid duplicates
      const { data: existing } = await supabase
        .from("bridge_updates")
        .select("headline");

      const existingHeadlines = new Set(
        (existing || []).map((r: { headline: string }) => r.headline)
      );

      const newUpdates = recentUpdates
        .filter((u) => u.headline && !existingHeadlines.has(u.headline))
        .map((u) => ({
          published_date: u.date || null,
          source_name: u.source || null,
          headline: u.headline,
          summary: u.summary || null,
          source_url: u.url || null,
        }));

      if (newUpdates.length > 0) {
        const { error: updatesError } = await supabase
          .from("bridge_updates")
          .insert(newUpdates);

        if (updatesError) {
          console.error("Error inserting bridge_updates:", updatesError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: parsed.bridge_status,
    });
  } catch (err) {
    console.error("Bridge update error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
