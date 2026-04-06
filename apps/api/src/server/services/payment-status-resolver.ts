import { prisma } from '../../lib/prisma'
import { quoteTariff } from './tariff.service'

export type PaymentResolutionStatus =
  | 'PAID'
  | 'UNPAID'
  | 'PENDING'
  | 'WAIVED'
  | 'SUBSCRIPTION_COVERED'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN'

export type PaymentResolution = {
  paymentStatus: PaymentResolutionStatus
  ticketId: string
  ticketCode: string | null
  amountDue: number
  amountPaid: number
  outstandingAmount: number
  lastPaymentStatus: string | null
  lastPaymentAt: string | null
  activeSubscription: boolean
  reasonDetail: string
  tariff: {
    tariffId: string | null
    minutes: number
    subtotal: number
    total: number
    breakdown: Array<{ ruleType: string; amount: number; note?: string }>
  } | null
}

type TicketTariffBridge = {
  ticketId: bigint
  ticketCode: string | null
  siteId: bigint
  entryTime: Date
  vehicleType: 'CAR' | 'MOTORBIKE'
  credentialId: bigint | null
  subscriptionId: bigint | null
  subscriptionStatus: string | null
  subscriptionStartDate: Date | null
  subscriptionEndDate: Date | null
}

function toMoney(value: unknown) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return 0
  return Number(n.toFixed(2))
}

function normalizeDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function isSubscriptionActive(args: {
  occurredAt: Date
  subscriptionId: bigint | null
  subscriptionStatus: string | null
  subscriptionStartDate: Date | null
  subscriptionEndDate: Date | null
}) {
  if (!args.subscriptionId) return false
  if ((args.subscriptionStatus ?? '').toUpperCase() !== 'ACTIVE') return false
  const occurredDate = normalizeDateOnly(args.occurredAt)
  const start = args.subscriptionStartDate ? normalizeDateOnly(args.subscriptionStartDate) : null
  const end = args.subscriptionEndDate ? normalizeDateOnly(args.subscriptionEndDate) : null
  if (start && occurredDate.getTime() < start.getTime()) return false
  if (end && occurredDate.getTime() > end.getTime()) return false
  return true
}

export async function getTicketTariffBridge(args: {
  ticketId: bigint
}): Promise<TicketTariffBridge | null> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        t.ticket_id AS ticketId,
        t.ticket_code AS ticketCode,
        t.site_id AS siteId,
        t.entry_time AS entryTime,
        t.credential_id AS credentialId,
        v.vehicle_type AS vehicleType,
        c.subscription_id AS subscriptionId,
        s.status AS subscriptionStatus,
        s.start_date AS subscriptionStartDate,
        s.end_date AS subscriptionEndDate
      FROM tickets t
      JOIN vehicles v
        ON v.vehicle_id = t.vehicle_id
      LEFT JOIN credentials c
        ON c.credential_id = t.credential_id
      LEFT JOIN subscriptions s
        ON s.subscription_id = c.subscription_id
      WHERE t.ticket_id = ?
      LIMIT 1
    `,
    String(args.ticketId),
  )

  const row = rows[0]
  if (!row?.ticketId || !row?.siteId || !row?.entryTime) return null

  const vehicleTypeRaw = String(row.vehicleType ?? '').toUpperCase()
  return {
    ticketId: BigInt(row.ticketId as any),
    ticketCode: row.ticketCode == null ? null : String(row.ticketCode),
    siteId: BigInt(row.siteId as any),
    entryTime: new Date(String(row.entryTime)),
    vehicleType: vehicleTypeRaw === 'CAR' ? 'CAR' : 'MOTORBIKE',
    credentialId: row.credentialId == null ? null : BigInt(row.credentialId as any),
    subscriptionId: row.subscriptionId == null ? null : BigInt(row.subscriptionId as any),
    subscriptionStatus: row.subscriptionStatus == null ? null : String(row.subscriptionStatus),
    subscriptionStartDate: row.subscriptionStartDate == null ? null : new Date(String(row.subscriptionStartDate)),
    subscriptionEndDate: row.subscriptionEndDate == null ? null : new Date(String(row.subscriptionEndDate)),
  }
}

async function hasActiveSubscriptionTariff(args: {
  siteId: bigint
  vehicleType: 'CAR' | 'MOTORBIKE'
  occurredAt: Date
}) {
  const row = await prisma.tariffs.findFirst({
    where: {
      site_id: args.siteId,
      applies_to: 'SUBSCRIPTION',
      vehicle_type: args.vehicleType,
      is_active: true,
      valid_from: { lte: args.occurredAt },
    },
    orderBy: { valid_from: 'desc' },
    select: { tariff_id: true },
  })

  return row?.tariff_id != null ? BigInt(row.tariff_id) : null
}

async function getPaymentAggregate(args: { ticketId: bigint }) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) AS paidAmount,
        COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN amount ELSE 0 END), 0) AS refundedAmount,
        COUNT(*) AS paymentCount,
        MAX(paid_at) AS lastPaymentAt
      FROM payments
      WHERE ticket_id = ?
    `,
    String(args.ticketId),
  )

  const latestRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT status AS status, paid_at AS paidAt, amount AS amount
      FROM payments
      WHERE ticket_id = ?
      ORDER BY paid_at DESC, payment_id DESC
      LIMIT 1
    `,
    String(args.ticketId),
  )

  const totals = rows[0] ?? {}
  const latest = latestRows[0] ?? {}
  const amountPaid = toMoney(totals.paidAmount) - toMoney(totals.refundedAmount)

  return {
    amountPaid: toMoney(amountPaid),
    paymentCount: Number(totals.paymentCount ?? 0),
    lastPaymentStatus: latest.status == null ? null : String(latest.status),
    lastPaymentAt: latest.paidAt == null ? null : new Date(String(latest.paidAt)).toISOString(),
    lastPaymentAmount: toMoney(latest.amount),
  }
}

export async function resolvePaymentStatusForTicket(args: {
  ticketId: bigint
  occurredAt: Date
}): Promise<PaymentResolution> {
  const bridge = await getTicketTariffBridge({ ticketId: args.ticketId })
  if (!bridge) {
    return {
      paymentStatus: 'UNKNOWN',
      ticketId: String(args.ticketId),
      ticketCode: null,
      amountDue: 0,
      amountPaid: 0,
      outstandingAmount: 0,
      lastPaymentStatus: null,
      lastPaymentAt: null,
      activeSubscription: false,
      reasonDetail: 'Không tải được ticket/tariff context để đánh giá payment status.',
      tariff: null,
    }
  }

  const [paymentAgg, quote, subscriptionTariffId] = await Promise.all([
    getPaymentAggregate({ ticketId: bridge.ticketId }),
    quoteTariff({
      siteId: bridge.siteId,
      vehicleType: bridge.vehicleType,
      entryTime: bridge.entryTime,
      exitTime: args.occurredAt,
    }),
    hasActiveSubscriptionTariff({
      siteId: bridge.siteId,
      vehicleType: bridge.vehicleType,
      occurredAt: args.occurredAt,
    }),
  ])

  const activeSubscription = isSubscriptionActive({
    occurredAt: args.occurredAt,
    subscriptionId: bridge.subscriptionId,
    subscriptionStatus: bridge.subscriptionStatus,
    subscriptionStartDate: bridge.subscriptionStartDate,
    subscriptionEndDate: bridge.subscriptionEndDate,
  })

  const amountDue = toMoney(quote.total)
  const amountPaid = toMoney(paymentAgg.amountPaid)
  const outstandingAmount = toMoney(Math.max(0, amountDue - amountPaid))
  const tariff = {
    tariffId: quote.tariffId == null ? null : String(quote.tariffId),
    minutes: quote.minutes,
    subtotal: toMoney(quote.subtotal),
    total: toMoney(quote.total),
    breakdown: quote.breakdown,
  }

  if (activeSubscription && subscriptionTariffId != null) {
    return {
      paymentStatus: 'SUBSCRIPTION_COVERED',
      ticketId: String(bridge.ticketId),
      ticketCode: bridge.ticketCode,
      amountDue,
      amountPaid,
      outstandingAmount: 0,
      lastPaymentStatus: paymentAgg.lastPaymentStatus,
      lastPaymentAt: paymentAgg.lastPaymentAt,
      activeSubscription: true,
      reasonDetail: 'Ticket được credential có subscription ACTIVE bao phủ tại thời điểm EXIT.',
      tariff,
    }
  }

  if (amountDue <= 0) {
    return {
      paymentStatus: 'WAIVED',
      ticketId: String(bridge.ticketId),
      ticketCode: bridge.ticketCode,
      amountDue,
      amountPaid,
      outstandingAmount: 0,
      lastPaymentStatus: paymentAgg.lastPaymentStatus,
      lastPaymentAt: paymentAgg.lastPaymentAt,
      activeSubscription,
      reasonDetail: 'Tariff bridge tính ra số tiền phải thu bằng 0 nên ticket được xem là miễn phí/waived.',
      tariff,
    }
  }

  if (amountPaid >= amountDue) {
    return {
      paymentStatus: 'PAID',
      ticketId: String(bridge.ticketId),
      ticketCode: bridge.ticketCode,
      amountDue,
      amountPaid,
      outstandingAmount: 0,
      lastPaymentStatus: paymentAgg.lastPaymentStatus,
      lastPaymentAt: paymentAgg.lastPaymentAt,
      activeSubscription,
      reasonDetail: 'Tổng số tiền PAID cho ticket đã đủ hoặc vượt số tiền tariff yêu cầu.',
      tariff,
    }
  }

  if (amountPaid > 0 && outstandingAmount > 0) {
    return {
      paymentStatus: 'PENDING',
      ticketId: String(bridge.ticketId),
      ticketCode: bridge.ticketCode,
      amountDue,
      amountPaid,
      outstandingAmount,
      lastPaymentStatus: paymentAgg.lastPaymentStatus,
      lastPaymentAt: paymentAgg.lastPaymentAt,
      activeSubscription,
      reasonDetail: `Ticket đã có thanh toán một phần nhưng vẫn còn thiếu ${outstandingAmount.toFixed(2)}.`,
      tariff,
    }
  }

  return {
    paymentStatus: 'UNPAID',
    ticketId: String(bridge.ticketId),
    ticketCode: bridge.ticketCode,
    amountDue,
    amountPaid,
    outstandingAmount,
    lastPaymentStatus: paymentAgg.lastPaymentStatus,
    lastPaymentAt: paymentAgg.lastPaymentAt,
    activeSubscription,
    reasonDetail: 'Chưa có thanh toán hợp lệ đủ để cho phép mở barrier ở EXIT.',
    tariff,
  }
}
