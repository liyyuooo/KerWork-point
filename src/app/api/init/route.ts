import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";

export async function POST() {
  try {
    await initDb();
    return NextResponse.json({ success: true, message: "数据库初始化完成" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
