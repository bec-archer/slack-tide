import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const JOB_KEYWORDS = [
  "career",
  "hiring",
  "job opening",
  "position available",
  "now hiring",
  "join our team",
  "employment",
  "apply",
];

interface JobPosting {
  source: string;
  url: string;
  title: string;
  snippet: string;
}

// --- Helpers ---

/** Strip <script>, <style>, and HTML comments to get visible text only */
function stripNonVisible(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

// --- Scrapers ---

async function fetchHTML(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; JobScraper/1.0; +https://slack-tide.vercel.app)",
    },
  });
  if (!resp.ok) {
    console.error(`Failed to fetch ${url}: ${resp.status}`);
    return "";
  }
  return await resp.text();
}

async function scrapeFlSeaGrant(): Promise<JobPosting[]> {
  const url = "https://www.flseagrant.org/about-us/careers/";
  const html = await fetchHTML(url);
  if (!html) return [];

  const postings: JobPosting[] = [];
  const linkRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, "").trim();
    const lowerHref = href.toLowerCase();
    const lowerText = linkText.toLowerCase();

    const isJobLink = lowerHref.includes("jobs.ufl.edu");

    if (isJobLink && href.startsWith("http")) {
      postings.push({
        source: "FL Sea Grant",
        url: href,
        title: linkText || "Job Posting",
        snippet: `Found on FL Sea Grant careers page`,
      });
    }
  }

  return postings;
}

async function scrapeReturnEmRight(): Promise<JobPosting[]> {
  const urls = [
    "https://returnemright.org/",
    "https://returnemright.org/about-us/",
  ];
  const postings: JobPosting[] = [];

  for (const url of urls) {
    const html = await fetchHTML(url);
    if (!html) continue;

    // Strip scripts/styles so we only match visible page content
    const visibleHTML = stripNonVisible(html);
    const visibleText = visibleHTML.replace(/<[^>]+>/g, " ").toLowerCase();

    for (const keyword of JOB_KEYWORDS) {
      if (visibleText.includes(keyword)) {
        const idx = visibleText.indexOf(keyword);
        const start = Math.max(0, idx - 80);
        const end = Math.min(visibleText.length, idx + keyword.length + 80);
        const snippet = visibleText.slice(start, end).trim();

        postings.push({
          source: "Return Em Right",
          url: url,
          title: `Job-related keyword found: "${keyword}"`,
          snippet: snippet.slice(0, 200),
        });
        break; // One match per page is enough to flag it
      }
    }
  }

  return postings;
}

async function scrapeUFJobs(): Promise<JobPosting[]> {
  const searchTerms = [
    "Sea Grant",
    "Return Em Right",
    "reef fish",
    "marine outreach",
  ];
  const postings: JobPosting[] = [];
  const seenUrls = new Set<string>();

  for (const term of searchTerms) {
    const searchUrl = `https://explore.jobs.ufl.edu/en-us/search/?search-text=${encodeURIComponent(term)}`;
    const html = await fetchHTML(searchUrl);
    if (!html) continue;

    const jobLinkRegex =
      /<a\s[^>]*href=["'](\/en-us\/job\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    // Collect candidate URLs from search results
    const candidates: { url: string; title: string }[] = [];
    while ((match = jobLinkRegex.exec(html)) !== null) {
      const path = match[1];
      const fullUrl = `https://explore.jobs.ufl.edu${path}`;
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      if (!seenUrls.has(fullUrl)) {
        seenUrls.add(fullUrl);
        candidates.push({ url: fullUrl, title: title || "UF Job Listing" });
      }
    }

    // Verify each candidate by checking if the search term appears on the detail page
    for (const candidate of candidates) {
      const detailHTML = await fetchHTML(candidate.url);
      if (!detailHTML) continue;

      const visibleText = stripNonVisible(detailHTML)
        .replace(/<[^>]+>/g, " ")
        .toLowerCase();

      if (visibleText.includes(term.toLowerCase())) {
        postings.push({
          source: "UF Jobs",
          url: candidate.url,
          title: candidate.title,
          snippet: `Verified match for "${term}"`,
        });
      } else {
        console.log(`SKIP (no match for "${term}"): ${candidate.url}`);
      }
    }
  }

  return postings;
}

async function scrapeLinkedIn(): Promise<JobPosting[]> {
  const url = "https://www.linkedin.com/company/floridaseagrant/posts/";
  const html = await fetchHTML(url);
  if (!html) return [];

  const postings: JobPosting[] = [];
  const linkedInKeywords = [
    "hiring",
    "job opening",
    "now hiring",
    "join our team",
    "apply now",
  ];

  const visibleText = stripNonVisible(html)
    .replace(/<[^>]+>/g, " ")
    .toLowerCase();

  for (const keyword of linkedInKeywords) {
    if (visibleText.includes(keyword)) {
      const idx = visibleText.indexOf(keyword);
      const start = Math.max(0, idx - 80);
      const end = Math.min(visibleText.length, idx + keyword.length + 80);
      const snippet = visibleText.slice(start, end).trim();

      postings.push({
        source: "LinkedIn - FL Sea Grant",
        url: url,
        title: `Job-related keyword found: "${keyword}"`,
        snippet: snippet.slice(0, 200),
      });
      break;
    }
  }

  return postings;
}

// --- Email ---

async function sendEmail(newPostings: JobPosting[]): Promise<boolean> {
  const listHTML = newPostings
    .map(
      (p) => `
    <li style="margin-bottom: 12px;">
      <strong>${escapeHTML(p.title)}</strong><br/>
      Source: ${escapeHTML(p.source)}<br/>
      <a href="${escapeHTML(p.url)}">${escapeHTML(p.url)}</a><br/>
      <em>${escapeHTML(p.snippet)}</em>
    </li>`
    )
    .join("\n");

  const html = `
    <h2>New Job Posting(s) Found!</h2>
    <p>The job scraper found ${newPostings.length} new posting(s):</p>
    <ul>${listHTML}</ul>
    <p style="color: #666; font-size: 12px;">— Slack Tide Job Scraper</p>
  `;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Job Scraper <onboarding@resend.dev>",
      to: ["beckeeper78@gmail.com"],
      subject: "New Job Posting(s) Found!",
      html: html,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Resend API error: ${resp.status} ${err}`);
    return false;
  }

  return true;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Main Handler ---

Deno.serve(async (_req) => {
  try {
    console.log("Job scraper starting...");

    // Scrape all sources in parallel
    const [flSeaGrant, returnEmRight, ufJobs, linkedIn] = await Promise.all([
      scrapeFlSeaGrant(),
      scrapeReturnEmRight(),
      scrapeUFJobs(),
      scrapeLinkedIn(),
    ]);

    const allPostings = [...flSeaGrant, ...returnEmRight, ...ufJobs, ...linkedIn];
    console.log(`Total postings scraped: ${allPostings.length}`);

    // Try to insert each posting — duplicates will be rejected by the unique constraint
    const newPostings: JobPosting[] = [];

    for (const posting of allPostings) {
      const { error } = await supabase.from("job_postings_seen").insert({
        source: posting.source,
        url: posting.url,
        title: posting.title,
        snippet: posting.snippet,
      });

      if (!error) {
        newPostings.push(posting);
        console.log(`NEW: ${posting.title} (${posting.source})`);
      } else if (error.code === "23505") {
        // Duplicate — already seen
        console.log(`SEEN: ${posting.url}`);
      } else {
        console.error(`DB error for ${posting.url}: ${error.message}`);
      }
    }

    console.log(`New postings: ${newPostings.length}`);

    // Send email if there are new postings
    if (newPostings.length > 0) {
      const emailSent = await sendEmail(newPostings);

      if (emailSent) {
        // Update notified_at for new postings
        for (const posting of newPostings) {
          await supabase
            .from("job_postings_seen")
            .update({ notified_at: new Date().toISOString() })
            .eq("source", posting.source)
            .eq("url", posting.url);
        }
        console.log("Email sent and notified_at updated.");
      }
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          new_count: newPostings.length,
          new_postings: newPostings,
          total_scanned: allPostings.length,
        },
        null,
        2
      ),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Job scraper error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
