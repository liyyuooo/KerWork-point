import { NextRequest, NextResponse } from "next/server";
import { initDb, getRedeemRequests, cancelRedeem } from "@/lib/db";

export async function GET() {
  await initDb();
  const redeems = await getRedeemRequests();
  return NextResponse.json({ redeems });
}

export async function POST(request: NextRequest) {
  try {
    await initDb();
    const body = await request.json();
    const { redeemId, action } = body;

    if (!redeemId || action !== "cancel") {
      return NextResponse.json({ error: "无效操作" }, { status: 400 });
    }

    const redeem = await cancelRedeem(redeemId);
    if (!redeem) {
      return NextResponse.json({ error: "未找到该兑换记录" }, { status: 404 });
    }

    return NextResponse.json({ success: true, redeem });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
