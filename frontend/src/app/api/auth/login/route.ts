import { NextRequest, NextResponse } from "next/server";
import {
  VALID_EMAIL,
  VALID_PASSWORD,
  createSessionToken,
  COOKIE_NAME,
  MAX_AGE_S,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.toLowerCase() !== VALID_EMAIL.toLowerCase() ||
    password !== VALID_PASSWORD
  ) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken(email.toLowerCase());

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_S,
    path: "/",
  });
  return res;
}
