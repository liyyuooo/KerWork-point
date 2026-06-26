import { NextRequest, NextResponse } from "next/server";
import { initDb, getCards, importCards, fulfillRedeems } from "@/lib/db";

export async function GET() {
  await initDb();
  const cards = await getCards();
  return NextResponse.json({ cards });
}

export async function POST(request: NextRequest) {
  try {
    await initDb();
    const body = await request.json();
    const { action } = body;

    if (action === "import") {
      const { cards: newCards } = body as {
        cards: { tier: number; cardNumber: string; cardSecret: string }[];
      };
      if (!newCards || !Array.isArray(newCards)) {
        return NextResponse.json({ error: "缺少卡密数据" }, { status: 400 });
      }
      const count = await importCards(newCards);
      return NextResponse.json({ success: true, imported: count });
    }

    if (action === "fulfill") {
      const fulfilled = await fulfillRedeems();
      return NextResponse.json({ success: true, fulfilled });
    }

    return NextResponse.json({ error: "无效操作" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
