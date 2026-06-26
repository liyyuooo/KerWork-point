import { NextResponse } from "next/server";
import { fetchTaskRecords, fetchXhsRecords } from "@/lib/feishu";
import { initDb, upsertSubmission, getSubmissions, deleteSubmission } from "@/lib/db";

const POINTS_MAP: Record<string, number> = {
  "场景体验反馈": 50,
  "金点子": 50,
  "Bug猎人": 100,
  "图文笔记": 200,
  "视频笔记": 300,
};

export async function POST() {
  try {
    await initDb();

    const existing = await getSubmissions();
    const existingIds = new Set(existing.map((s) => s.recordId));

    const taskRecords = await fetchTaskRecords();
    const xhsRecords = await fetchXhsRecords();

    const feishuIds = new Set([
      ...taskRecords.map((r) => r.recordId),
      ...xhsRecords.map((r) => r.recordId),
    ]);

    let newCount = 0;
    let deletedCount = 0;

    for (const rec of taskRecords) {
      if (existingIds.has(rec.recordId)) continue;
      const taskType = rec.taskType;
      await upsertSubmission({
        recordId: rec.recordId,
        phone: rec.phone,
        wechat: rec.wechat,
        taskType,
        content: rec.content,
        submittedAt: rec.submittedAt,
        submitter: rec.submitter,
        status: "pending",
        points: POINTS_MAP[taskType] || 0,
      });
      newCount++;
    }

    for (const rec of xhsRecords) {
      if (existingIds.has(rec.recordId)) continue;
      const noteType = rec.noteType.includes("视频") ? "视频笔记" : "图文笔记";
      await upsertSubmission({
        recordId: rec.recordId,
        phone: rec.phone,
        wechat: rec.wechat,
        taskType: `小红书${noteType}`,
        content: rec.noteLink,
        submittedAt: rec.submittedAt,
        submitter: rec.submitter,
        status: "pending",
        points: POINTS_MAP[noteType] || 0,
      });
      newCount++;
    }

    for (const sub of existing) {
      if (!feishuIds.has(sub.recordId)) {
        await deleteSubmission(sub.recordId);
        deletedCount++;
      }
    }

    const total = existing.length + newCount - deletedCount;
    return NextResponse.json({ success: true, newCount, deletedCount, total });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
