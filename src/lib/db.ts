import { sql } from "@vercel/postgres";

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

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      record_id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      wechat TEXT,
      task_type TEXT NOT NULL,
      content TEXT,
      submitted_at BIGINT,
      submitter TEXT,
      status TEXT DEFAULT 'pending',
      points INT DEFAULT 0,
      reviewed_at BIGINT,
      review_note TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS redeems (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      reward_tier INT NOT NULL,
      reward_name TEXT NOT NULL,
      points_cost INT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at BIGINT,
      card_number TEXT,
      card_secret TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS rewards (
      tier INT PRIMARY KEY,
      name TEXT NOT NULL,
      points_cost INT NOT NULL,
      total_count INT NOT NULL,
      remaining_count INT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      tier INT NOT NULL,
      card_number TEXT NOT NULL,
      card_secret TEXT NOT NULL,
      assigned_to TEXT,
      assigned_at BIGINT
    )
  `;

  const { rows } = await sql`SELECT COUNT(*) as cnt FROM rewards`;
  if (Number(rows[0].cnt) === 0) {
    await sql`INSERT INTO rewards (tier, name, points_cost, total_count, remaining_count) VALUES
      (100, '瑞幸咖啡卡券 1 张', 100, 100, 100),
      (200, '京东卡 20 元', 200, 60, 60),
      (300, '京东卡 30 元', 300, 40, 40),
      (500, '京东卡 50 元', 500, 20, 20),
      (1000, '京东卡 100 元', 1000, 10, 10)
    `;
  }
}

export async function getSubmissions(): Promise<TaskSubmission[]> {
  const { rows } = await sql`SELECT * FROM submissions ORDER BY submitted_at DESC`;
  return rows.map(mapSubmission);
}

export async function getSubmissionsByPhone(phone: string): Promise<TaskSubmission[]> {
  const { rows } = await sql`SELECT * FROM submissions WHERE phone = ${phone} ORDER BY submitted_at DESC`;
  return rows.map(mapSubmission);
}

export async function upsertSubmission(s: TaskSubmission): Promise<void> {
  await sql`
    INSERT INTO submissions (record_id, phone, wechat, task_type, content, submitted_at, submitter, status, points)
    VALUES (${s.recordId}, ${s.phone}, ${s.wechat}, ${s.taskType}, ${s.content}, ${s.submittedAt}, ${s.submitter}, ${s.status}, ${s.points})
    ON CONFLICT (record_id) DO NOTHING
  `;
}

export async function updateSubmissionStatus(
  recordId: string,
  status: "approved" | "rejected",
  reviewNote?: string
): Promise<TaskSubmission | null> {
  const now = Date.now();
  const { rows } = await sql`
    UPDATE submissions SET status = ${status}, reviewed_at = ${now}, review_note = ${reviewNote || ''}
    WHERE record_id = ${recordId}
    RETURNING *
  `;
  return rows.length > 0 ? mapSubmission(rows[0]) : null;
}

export async function getRedeemRequests(): Promise<RedeemRequest[]> {
  const { rows } = await sql`SELECT * FROM redeems ORDER BY created_at DESC`;
  return rows.map(mapRedeem);
}

export async function getRedeemsByPhone(phone: string): Promise<RedeemRequest[]> {
  const { rows } = await sql`SELECT * FROM redeems WHERE phone = ${phone} ORDER BY created_at DESC`;
  return rows.map(mapRedeem);
}

export async function createRedeem(r: RedeemRequest): Promise<void> {
  await sql`
    INSERT INTO redeems (id, phone, reward_tier, reward_name, points_cost, status, created_at)
    VALUES (${r.id}, ${r.phone}, ${r.rewardTier}, ${r.rewardName}, ${r.pointsCost}, ${r.status}, ${r.createdAt})
  `;
}

export async function getRewardPool(): Promise<RewardPool[]> {
  const { rows } = await sql`SELECT * FROM rewards ORDER BY tier`;
  return rows.map((r) => ({
    tier: r.tier,
    name: r.name,
    pointsCost: r.points_cost,
    totalCount: r.total_count,
    remainingCount: r.remaining_count,
  }));
}

export async function decrementReward(tier: number): Promise<boolean> {
  const { rows } = await sql`
    UPDATE rewards SET remaining_count = remaining_count - 1
    WHERE tier = ${tier} AND remaining_count > 0
    RETURNING *
  `;
  return rows.length > 0;
}

export async function getCards(): Promise<CardSecret[]> {
  const { rows } = await sql`SELECT * FROM cards ORDER BY tier`;
  return rows.map((r) => ({
    id: r.id,
    tier: r.tier,
    cardNumber: r.card_number,
    cardSecret: r.card_secret,
    assignedTo: r.assigned_to || undefined,
    assignedAt: r.assigned_at ? Number(r.assigned_at) : undefined,
  }));
}

export async function importCards(cards: { tier: number; cardNumber: string; cardSecret: string }[]): Promise<number> {
  let count = 0;
  for (const card of cards) {
    const id = `C${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await sql`INSERT INTO cards (id, tier, card_number, card_secret) VALUES (${id}, ${card.tier}, ${card.cardNumber}, ${card.cardSecret})`;
    count++;
  }
  return count;
}

export async function fulfillRedeems(): Promise<number> {
  const { rows: pendingRedeems } = await sql`SELECT * FROM redeems WHERE status = 'pending' ORDER BY created_at`;
  let fulfilled = 0;

  for (const redeem of pendingRedeems) {
    const { rows: availableCards } = await sql`
      SELECT * FROM cards WHERE tier = ${redeem.reward_tier} AND assigned_to IS NULL LIMIT 1
    `;
    if (availableCards.length === 0) continue;

    const card = availableCards[0];
    const now = Date.now();
    await sql`UPDATE cards SET assigned_to = ${redeem.phone}, assigned_at = ${now} WHERE id = ${card.id}`;
    await sql`UPDATE redeems SET status = 'fulfilled', card_number = ${card.card_number}, card_secret = ${card.card_secret} WHERE id = ${redeem.id}`;
    fulfilled++;
  }
  return fulfilled;
}

export async function getUserPoints(phone: string): Promise<{
  total: number;
  redeemed: number;
  available: number;
}> {
  const { rows: pointsRows } = await sql`
    SELECT COALESCE(SUM(points), 0) as total FROM submissions WHERE phone = ${phone} AND status = 'approved'
  `;
  const { rows: redeemedRows } = await sql`
    SELECT COALESCE(SUM(points_cost), 0) as redeemed FROM redeems WHERE phone = ${phone}
  `;
  const total = Number(pointsRows[0].total);
  const redeemed = Number(redeemedRows[0].redeemed);
  return { total, redeemed, available: total - redeemed };
}

function mapSubmission(r: any): TaskSubmission {
  return {
    recordId: r.record_id,
    phone: r.phone,
    wechat: r.wechat,
    taskType: r.task_type,
    content: r.content,
    submittedAt: Number(r.submitted_at),
    submitter: r.submitter,
    status: r.status,
    points: r.points,
    reviewedAt: r.reviewed_at ? Number(r.reviewed_at) : undefined,
    reviewNote: r.review_note || undefined,
  };
}

function mapRedeem(r: any): RedeemRequest {
  return {
    id: r.id,
    phone: r.phone,
    rewardTier: r.reward_tier,
    rewardName: r.reward_name,
    pointsCost: r.points_cost,
    status: r.status,
    createdAt: Number(r.created_at),
    cardNumber: r.card_number || undefined,
    cardSecret: r.card_secret || undefined,
  };
}
