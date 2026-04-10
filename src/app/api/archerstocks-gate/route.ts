import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

const COOKIE_NAME = "as_gate";

export async function POST(request: NextRequest) {
  const pin = process.env.ARCHERSTOCKS_PIN;
  if (!pin) {
    return NextResponse.json(
      { error: "ARCHERSTOCKS_PIN is not configured on the server" },
      { status: 500 }
    );
  }

  let body: { pin?: string; redirect?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const submitted = typeof body.pin === "string" ? body.pin : "";

  // Constant-time comparison (guards against timing attacks)
  const a = Buffer.from(submitted);
  const b = Buffer.from(pin);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  // Derive the cookie token — same derivation the middleware computes and checks
  const token = crypto
    .createHash("sha256")
    .update(`archerstocks:${pin}`)
    .digest("hex");

  // Only honor whitelisted redirect targets (prevents open-redirect abuse)
  const redirect =
    typeof body.redirect === "string" &&
    body.redirect.startsWith("/archerstocks") &&
    !body.redirect.startsWith("/archerstocks-gate")
      ? body.redirect
      : "/archerstocks";

  const response = NextResponse.json({ ok: true, redirect });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
