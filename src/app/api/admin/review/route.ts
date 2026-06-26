import { NextRequest, NextResponse } from "next/server";
import { initDb, getSubmissions, getSubmissionsByPhone, getApprovedCount, updateSubmissionStatus, TASK_LIMITS } from "@/lib/db";

export async function GET() {
  await initDb();
  const submissions = await getSubmissions();
  return NextResponse.json({ submissions });
}

export async function POST(request: NextRequest) {
  try {
    await initDb();
    const body = await request.json();
    const { recordId, action, reviewNote } = body;

    if (!recordId || !action) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    if (action !== "approve" && action !== "reject" && action !== "reset" && action !== "over_limit") {
      return NextResponse.json({ error: "无效操作" }, { status: 400 });
    }

    if (action === "approve") {
      const allSubs = await getSubmissions();
      const target = allSubs.find((s) => s.recordId === recordId);
      if (!target) {
        return NextResponse.json({ error: "未找到该记录" }, { status: 404 });
      }

      const limit = TASK_LIMITS[target.taskType];
      if (limit !== undefined) {
        const approvedCount = await getApprovedCount(target.phone, target.taskType);
        if (approvedCount >= limit) {
          const submission = await updateSubmissionStatus(recordId, "over_limit", `该用户「${target.taskType}」已达积分上限（${limit}次）`);
          return NextResponse.json({
            success: false,
            error: `该用户「${target.taskType}」已达积分上限（${approvedCount}/${limit}次），已标记为超限`,
            submission,
          }, { status: 400 });
        }
      }
    }

    const submission = await updateSubmissionStatus(recordId, action as "approve" | "reject" | "reset" | "over_limit", reviewNote);
    if (!submission) {
      return NextResponse.json({ error: "未找到该记录" }, { status: 404 });
    }

    return NextResponse.json({ success: true, submission });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
