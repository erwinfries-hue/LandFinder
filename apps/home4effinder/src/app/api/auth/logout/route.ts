import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/authSession";

export async function POST(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
