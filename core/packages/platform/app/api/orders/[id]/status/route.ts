import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-user";
import { findByIdForUser } from "@/lib/db/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const order = await findByIdForUser(id, user.id);
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    status: order.status,
    paidAt: order.paidAt ?? null,
  });
}
