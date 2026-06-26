import { NextRequest, NextResponse } from "next/server";
import { initDb, getSubmissionsByPhone, getUserPoints, getRedeemsByPhone, TASK_LIMITS } from "@/lib/db";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "请输入手机号" }, { status: 400 });
  }

  await initDb();

  const submissions = await getSubmissionsByPhone(phone);
  if (submissions.length === 0) {
    return NextResponse.json({ error: "未找到该手机号的任务记录" }, { status: 404 });
  }

  const points = await getUserPoints(phone);
  const redeems = await getRedeemsByPhone(phone);

  const taskDetails = submissions.map((s) => ({
    taskType: s.taskType,
    status: s.status,
    points: s.status === "approved" ? s.points : 0,
    submittedAt: s.submittedAt,
    reviewNote: s.reviewNote,
  }));

  const taskProgress = Object.entries(TASK_LIMITS).map(([taskType, limit]) => ({
    taskType,
    approved: submissions.filter((s) => s.taskType === taskType && s.status === "approved").length,
    limit,
  }));

  return NextResponse.json({
    phone,
    points,
    tasks: taskDetails,
    taskProgress,
    redeems: redeems.map((r) => ({
      rewardName: r.rewardName,
      pointsCost: r.pointsCost,
      status: r.status,
      createdAt: r.createdAt,
      cardNumber: r.status === "fulfilled" ? r.cardNumber : undefined,
      cardSecret: r.status === "fulfilled" ? r.cardSecret : undefined,
    })),
  });
}
