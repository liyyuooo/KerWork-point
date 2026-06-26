import { NextRequest, NextResponse } from "next/server";
import { initDb, getSubmissions, updateSubmissionStatus } from "@/lib/db";

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

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "无效操作" }, { status: 400 });
    }

    const submission = await updateSubmissionStatus(recordId, action, reviewNote);
    if (!submission) {
      return NextResponse.json({ error: "未找到该记录" }, { status: 404 });
    }

    return NextResponse.json({ success: true, submission });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
