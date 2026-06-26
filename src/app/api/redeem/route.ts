import { NextRequest, NextResponse } from "next/server";
import {
  initDb,
  getUserPoints,
  getRewardPool,
  decrementReward,
  createRedeem,
} from "@/lib/db";

export async function GET() {
  await initDb();
  const pool = await getRewardPool();
  return NextResponse.json({ rewards: pool });
}

export async function POST(request: NextRequest) {
  try {
    await initDb();
    const body = await request.json();
    const { phone, tier } = body;

    if (!phone || !tier) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const pool = await getRewardPool();
    const reward = pool.find((r) => r.tier === tier);
    if (!reward) {
      return NextResponse.json({ error: "无效的兑换档位" }, { status: 400 });
    }

    if (reward.remainingCount <= 0) {
      return NextResponse.json({ error: "该档位礼品已兑完" }, { status: 400 });
    }

    const points = await getUserPoints(phone);
    if (points.available < reward.pointsCost) {
      return NextResponse.json(
        { error: `积分不足，当前可用 ${points.available} 分，需要 ${reward.pointsCost} 分` },
        { status: 400 }
      );
    }

    const decremented = await decrementReward(tier);
    if (!decremented) {
      return NextResponse.json({ error: "该档位礼品已兑完" }, { status: 400 });
    }

    const newRedeem = {
      id: `R${Date.now()}`,
      phone,
      rewardTier: tier,
      rewardName: reward.name,
      pointsCost: reward.pointsCost,
      status: "pending" as const,
      createdAt: Date.now(),
    };
    await createRedeem(newRedeem);

    return NextResponse.json({ success: true, redeem: newRedeem });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
