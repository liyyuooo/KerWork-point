const APP_ID = process.env.FEISHU_APP_ID!;
const APP_SECRET = process.env.FEISHU_APP_SECRET!;
const APP_TOKEN = "XLQBwzIOti1k4pkOt9QclHxQnFb";
const TASK_TABLE_ID = "tbl88BiKdZr7qnys";
const XHS_TABLE_ID = "tblyP4mzjY2ZN6XR";

let cachedToken: { token: string; expireAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expireAt) {
    return cachedToken.token;
  }
  const res = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    }
  );
  const data = await res.json();
  cachedToken = {
    token: data.tenant_access_token,
    expireAt: Date.now() + (data.expire - 60) * 1000,
  };
  return cachedToken.token;
}

export interface TaskRecord {
  recordId: string;
  phone: string;
  wechat: string;
  taskType: string;
  content: string;
  submittedAt: number;
  submitter: string;
}

export interface XhsRecord {
  recordId: string;
  phone: string;
  wechat: string;
  noteType: string;
  noteLink: string;
  submittedAt: number;
  submitter: string;
}

function parseTaskType(raw: string): string {
  if (raw.includes("场景体验")) return "场景体验反馈";
  if (raw.includes("金点子")) return "金点子";
  if (raw.includes("Bug")) return "Bug猎人";
  return raw;
}

export async function fetchTaskRecords(): Promise<TaskRecord[]> {
  const token = await getAccessToken();
  const records: TaskRecord[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TASK_TABLE_ID}/records`
    );
    url.searchParams.set("page_size", "100");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.msg);

    for (const item of data.data.items || []) {
      const f = item.fields;
      records.push({
        recordId: item.record_id,
        phone: f["KerWork的注册手机号"] || "",
        wechat: f["您的微信号"] || "",
        taskType: parseTaskType(f["体验任务类型"] || ""),
        content:
          f["功能建议/体验优化建议"] ||
          f["Bug描述及复现"] ||
          f["场景体验反馈"] ||
          "",
        submittedAt: f["提交时间"] || 0,
        submitter: f["提交人"]?.name || "",
      });
    }
    pageToken = data.data.page_token;
  } while (pageToken);

  return records;
}

export async function fetchXhsRecords(): Promise<XhsRecord[]> {
  const token = await getAccessToken();
  const records: XhsRecord[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${XHS_TABLE_ID}/records`
    );
    url.searchParams.set("page_size", "100");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.msg);

    for (const item of data.data.items || []) {
      const f = item.fields;
      records.push({
        recordId: item.record_id,
        phone: f["KerWork的注册手机号"] || "",
        wechat: f["您的微信号"] || "",
        noteType: f["您分享的笔记类型是"] || "",
        noteLink: f["请提供笔记链接"] || "",
        submittedAt: f["提交时间"] || 0,
        submitter: f["提交人"]?.name || "",
      });
    }
    pageToken = data.data.page_token;
  } while (pageToken);

  return records;
}
