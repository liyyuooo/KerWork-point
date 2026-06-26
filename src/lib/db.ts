import fs from "fs";
import path from "path";

const USE_POSTGRES = !!process.env.POSTGRES_URL;

export interface TaskSubmission {
  recordId: string;
  phone: string;
  wechat: string;
  taskType: string;
  content: string;
  submittedAt: number;
  submitter: string;
  status: "pending" | "approved" | "rejected";
  points: number;
  reviewedAt?: number;
  reviewNote?: string;
}

export interface RedeemRequest {
  id: string;
  phone: string;
  rewardTier: number;
  rewardName: string;
  pointsCost: number;
  status: "pending" | "approved" | "fulfilled";
  createdAt: number;
  cardNumber?: string;
  cardSecret?: string;
}

export interface RewardPool {
  tier: number;
  name: string;
  pointsCost: number;
  totalCount: number;
  remainingCount: number;
}

export interface CardSecret {
  id: string;
  tier: number;
  cardNumber: string;
  cardSecret: string;
  assignedTo?: string;
  assignedAt?: number;
}

const DEFAULT_REWARDS: RewardPool[] = [
  { tier: 100, name: "瑞幸咖啡卡券 1 张", pointsCost: 100, totalCount: 100, remainingCount: 100 },
  { tier: 200, name: "京东卡 20 元", pointsCost: 200, totalCount: 60, remainingCount: 60 },
  { tier: 300, name: "京东卡 30 元", pointsCost: 300, totalCount: 40, remainingCount: 40 },
  { tier: 500, name: "京东卡 50 元", pointsCost: 500, totalCount: 20, remainingCount: 20 },
  { tier: 1000, name: "京东卡 100 元", pointsCost: 1000, totalCount: 10, remainingCount: 10 },
];

// ============ FILE STORAGE (local dev) ============

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, def: T): T {
  ensureDir();
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) return def;
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

function writeJson<T>(file: string, data: T): void {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// ============ POSTGRES (production) ============

async function pgSql() {
  const { sql } = await import("@vercel/postgres");
  return sql;
}

// ============ PUBLIC API ============

export async function initDb() {
  if (!USE_POSTGRES) return;
  const sql = await pgSql();
  await sql`CREATE TABLE IF NOT EXISTS submissions (record_id TEXT PRIMARY KEY, phone TEXT NOT NULL, wechat TEXT, task_type TEXT NOT NULL, content TEXT, submitted_at BIGINT, submitter TEXT, status TEXT DEFAULT 'pending', points INT DEFAULT 0, reviewed_at BIGINT, review_note TEXT)`;
  await sql`CREATE TABLE IF NOT EXISTS redeems (id TEXT PRIMARY KEY, phone TEXT NOT NULL, reward_tier INT NOT NULL, reward_name TEXT NOT NULL, points_cost INT NOT NULL, status TEXT DEFAULT 'pending', created_at BIGINT, card_number TEXT, card_secret TEXT)`;
  await sql`CREATE TABLE IF NOT EXISTS rewards (tier INT PRIMARY KEY, name TEXT NOT NULL, points_cost INT NOT NULL, total_count INT NOT NULL, remaining_count INT NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, tier INT NOT NULL, card_number TEXT NOT NULL, card_secret TEXT NOT NULL, assigned_to TEXT, assigned_at BIGINT)`;
  const { rows } = await sql`SELECT COUNT(*) as cnt FROM rewards`;
  if (Number(rows[0].cnt) === 0) {
    await sql`INSERT INTO rewards (tier, name, points_cost, total_count, remaining_count) VALUES (100, '瑞幸咖啡卡券 1 张', 100, 100, 100),(200, '京东卡 20 元', 200, 60, 60),(300, '京东卡 30 元', 300, 40, 40),(500, '京东卡 50 元', 500, 20, 20),(1000, '京东卡 100 元', 1000, 10, 10)`;
  }
}

export async function getSubmissions(): Promise<TaskSubmission[]> {
  if (!USE_POSTGRES) return readJson<TaskSubmission[]>("submissions.json", []);
  const sql = await pgSql();
  const { rows } = await sql`SELECT * FROM submissions ORDER BY submitted_at DESC`;
  return rows.map(mapSubmission);
}

export async function getSubmissionsByPhone(phone: string): Promise<TaskSubmission[]> {
  if (!USE_POSTGRES) {
    return readJson<TaskSubmission[]>("submissions.json", []).filter((s) => s.phone === phone);
  }
  const sql = await pgSql();
  const { rows } = await sql`SELECT * FROM submissions WHERE phone = ${phone} ORDER BY submitted_at DESC`;
  return rows.map(mapSubmission);
}

export async function upsertSubmission(s: TaskSubmission): Promise<void> {
  if (!USE_POSTGRES) {
    const all = readJson<TaskSubmission[]>("submissions.json", []);
    if (!all.find((x) => x.recordId === s.recordId)) {
      all.push(s);
      writeJson("submissions.json", all);
    }
    return;
  }
  const sql = await pgSql();
  await sql`INSERT INTO submissions (record_id, phone, wechat, task_type, content, submitted_at, submitter, status, points) VALUES (${s.recordId}, ${s.phone}, ${s.wechat}, ${s.taskType}, ${s.content}, ${s.submittedAt}, ${s.submitter}, ${s.status}, ${s.points}) ON CONFLICT (record_id) DO NOTHING`;
}

export async function updateSubmissionStatus(recordId: string, action: "approve" | "reject" | "reset", reviewNote?: string): Promise<TaskSubmission | null> {
  const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending";
  if (!USE_POSTGRES) {
    const all = readJson<TaskSubmission[]>("submissions.json", []);
    const sub = all.find((s) => s.recordId === recordId);
    if (!sub) return null;
    sub.status = status;
    sub.reviewedAt = action === "reset" ? undefined : Date.now();
    sub.reviewNote = action === "reset" ? "" : (reviewNote || "");
    writeJson("submissions.json", all);
    return sub;
  }
  const sql = await pgSql();
  const now = action === "reset" ? null : Date.now();
  const { rows } = await sql`UPDATE submissions SET status = ${status}, reviewed_at = ${now}, review_note = ${action === "reset" ? "" : (reviewNote || '')} WHERE record_id = ${recordId} RETURNING *`;
  return rows.length > 0 ? mapSubmission(rows[0]) : null;
}

export async function getRedeemRequests(): Promise<RedeemRequest[]> {
  if (!USE_POSTGRES) return readJson<RedeemRequest[]>("redeems.json", []);
  const sql = await pgSql();
  const { rows } = await sql`SELECT * FROM redeems ORDER BY created_at DESC`;
  return rows.map(mapRedeem);
}

export async function getRedeemsByPhone(phone: string): Promise<RedeemRequest[]> {
  if (!USE_POSTGRES) {
    return readJson<RedeemRequest[]>("redeems.json", []).filter((r) => r.phone === phone);
  }
  const sql = await pgSql();
  const { rows } = await sql`SELECT * FROM redeems WHERE phone = ${phone} ORDER BY created_at DESC`;
  return rows.map(mapRedeem);
}

export async function createRedeem(r: RedeemRequest): Promise<void> {
  if (!USE_POSTGRES) {
    const all = readJson<RedeemRequest[]>("redeems.json", []);
    all.push(r);
    writeJson("redeems.json", all);
    return;
  }
  const sql = await pgSql();
  await sql`INSERT INTO redeems (id, phone, reward_tier, reward_name, points_cost, status, created_at) VALUES (${r.id}, ${r.phone}, ${r.rewardTier}, ${r.rewardName}, ${r.pointsCost}, ${r.status}, ${r.createdAt})`;
}

export async function cancelRedeem(redeemId: string): Promise<RedeemRequest | null> {
  if (!USE_POSTGRES) {
    const all = readJson<RedeemRequest[]>("redeems.json", []);
    const idx = all.findIndex((r) => r.id === redeemId);
    if (idx === -1) return null;
    const redeem = all[idx];
    const rewards = readJson<RewardPool[]>("rewards.json", DEFAULT_REWARDS);
    const reward = rewards.find((r) => r.tier === redeem.rewardTier);
    if (reward) {
      reward.remainingCount++;
      writeJson("rewards.json", rewards);
    }
    if (redeem.cardNumber) {
      const cards = readJson<CardSecret[]>("cards.json", []);
      const card = cards.find((c) => c.cardNumber === redeem.cardNumber);
      if (card) {
        card.assignedTo = undefined;
        card.assignedAt = undefined;
        writeJson("cards.json", cards);
      }
    }
    all.splice(idx, 1);
    writeJson("redeems.json", all);
    return redeem;
  }
  const sql = await pgSql();
  const { rows } = await sql`SELECT * FROM redeems WHERE id = ${redeemId}`;
  if (rows.length === 0) return null;
  const redeem = rows[0];
  await sql`UPDATE rewards SET remaining_count = remaining_count + 1 WHERE tier = ${redeem.reward_tier}`;
  if (redeem.card_number) {
    await sql`UPDATE cards SET assigned_to = NULL, assigned_at = NULL WHERE card_number = ${redeem.card_number}`;
  }
  await sql`DELETE FROM redeems WHERE id = ${redeemId}`;
  return mapRedeem(redeem);
}

export async function getRewardPool(): Promise<RewardPool[]> {
  if (!USE_POSTGRES) return readJson<RewardPool[]>("rewards.json", DEFAULT_REWARDS);
  const sql = await pgSql();
  const { rows } = await sql`SELECT * FROM rewards ORDER BY tier`;
  return rows.map((r) => ({ tier: r.tier, name: r.name, pointsCost: r.points_cost, totalCount: r.total_count, remainingCount: r.remaining_count }));
}

export async function decrementReward(tier: number): Promise<boolean> {
  if (!USE_POSTGRES) {
    const all = readJson<RewardPool[]>("rewards.json", DEFAULT_REWARDS);
    const reward = all.find((r) => r.tier === tier);
    if (!reward || reward.remainingCount <= 0) return false;
    reward.remainingCount--;
    writeJson("rewards.json", all);
    return true;
  }
  const sql = await pgSql();
  const { rows } = await sql`UPDATE rewards SET remaining_count = remaining_count - 1 WHERE tier = ${tier} AND remaining_count > 0 RETURNING *`;
  return rows.length > 0;
}

export async function getCards(): Promise<CardSecret[]> {
  if (!USE_POSTGRES) return readJson<CardSecret[]>("cards.json", []);
  const sql = await pgSql();
  const { rows } = await sql`SELECT * FROM cards ORDER BY tier`;
  return rows.map((r) => ({ id: r.id, tier: r.tier, cardNumber: r.card_number, cardSecret: r.card_secret, assignedTo: r.assigned_to || undefined, assignedAt: r.assigned_at ? Number(r.assigned_at) : undefined }));
}

export async function importCards(cards: { tier: number; cardNumber: string; cardSecret: string }[]): Promise<number> {
  if (!USE_POSTGRES) {
    const all = readJson<CardSecret[]>("cards.json", []);
    for (const card of cards) {
      all.push({ id: `C${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, tier: card.tier, cardNumber: card.cardNumber, cardSecret: card.cardSecret });
    }
    writeJson("cards.json", all);
    return cards.length;
  }
  const sql = await pgSql();
  for (const card of cards) {
    const id = `C${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await sql`INSERT INTO cards (id, tier, card_number, card_secret) VALUES (${id}, ${card.tier}, ${card.cardNumber}, ${card.cardSecret})`;
  }
  return cards.length;
}

export async function fulfillRedeems(): Promise<number> {
  if (!USE_POSTGRES) {
    const redeems = readJson<RedeemRequest[]>("redeems.json", []);
    const cards = readJson<CardSecret[]>("cards.json", []);
    let fulfilled = 0;
    for (const redeem of redeems) {
      if (redeem.status !== "pending") continue;
      const card = cards.find((c) => c.tier === redeem.rewardTier && !c.assignedTo);
      if (!card) continue;
      card.assignedTo = redeem.phone;
      card.assignedAt = Date.now();
      redeem.status = "fulfilled";
      redeem.cardNumber = card.cardNumber;
      redeem.cardSecret = card.cardSecret;
      fulfilled++;
    }
    writeJson("redeems.json", redeems);
    writeJson("cards.json", cards);
    return fulfilled;
  }
  const sql = await pgSql();
  const { rows: pendingRedeems } = await sql`SELECT * FROM redeems WHERE status = 'pending' ORDER BY created_at`;
  let fulfilled = 0;
  for (const redeem of pendingRedeems) {
    const { rows: availableCards } = await sql`SELECT * FROM cards WHERE tier = ${redeem.reward_tier} AND assigned_to IS NULL LIMIT 1`;
    if (availableCards.length === 0) continue;
    const card = availableCards[0];
    const now = Date.now();
    await sql`UPDATE cards SET assigned_to = ${redeem.phone}, assigned_at = ${now} WHERE id = ${card.id}`;
    await sql`UPDATE redeems SET status = 'fulfilled', card_number = ${card.card_number}, card_secret = ${card.card_secret} WHERE id = ${redeem.id}`;
    fulfilled++;
  }
  return fulfilled;
}

export async function getUserPoints(phone: string): Promise<{ total: number; redeemed: number; available: number }> {
  if (!USE_POSTGRES) {
    const submissions = readJson<TaskSubmission[]>("submissions.json", []);
    const redeems = readJson<RedeemRequest[]>("redeems.json", []);
    const total = submissions.filter((s) => s.phone === phone && s.status === "approved").reduce((sum, s) => sum + s.points, 0);
    const redeemed = redeems.filter((r) => r.phone === phone).reduce((sum, r) => sum + r.pointsCost, 0);
    return { total, redeemed, available: total - redeemed };
  }
  const sql = await pgSql();
  const { rows: p } = await sql`SELECT COALESCE(SUM(points), 0) as total FROM submissions WHERE phone = ${phone} AND status = 'approved'`;
  const { rows: r } = await sql`SELECT COALESCE(SUM(points_cost), 0) as redeemed FROM redeems WHERE phone = ${phone}`;
  const total = Number(p[0].total);
  const redeemed = Number(r[0].redeemed);
  return { total, redeemed, available: total - redeemed };
}

function mapSubmission(r: any): TaskSubmission {
  return { recordId: r.record_id, phone: r.phone, wechat: r.wechat, taskType: r.task_type, content: r.content, submittedAt: Number(r.submitted_at), submitter: r.submitter, status: r.status, points: r.points, reviewedAt: r.reviewed_at ? Number(r.reviewed_at) : undefined, reviewNote: r.review_note || undefined };
}

function mapRedeem(r: any): RedeemRequest {
  return { id: r.id, phone: r.phone, rewardTier: r.reward_tier, rewardName: r.reward_name, pointsCost: r.points_cost, status: r.status, createdAt: Number(r.created_at), cardNumber: r.card_number || undefined, cardSecret: r.card_secret || undefined };
}
