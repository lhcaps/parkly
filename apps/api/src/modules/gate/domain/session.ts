import { ApiError } from '../../../server/http';

export type SessionStatus =
  | 'OPEN'
  | 'WAITING_READ'
  | 'WAITING_DECISION'
  | 'APPROVED'
  | 'WAITING_PAYMENT'
  | 'DENIED'
  | 'PASSED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'ERROR';

export type SessionAllowedAction =
  | 'APPROVE'
  | 'REQUIRE_PAYMENT'
  | 'DENY'
  | 'CONFIRM_PASS'
  | 'CANCEL';

export type SessionReadType = 'ALPR' | 'RFID' | 'SENSOR';
export type SessionSensorState = 'PRESENT' | 'CLEARED' | 'TRIGGERED';

export type DecisionCode =
  | 'AUTO_APPROVED'
  | 'REVIEW_REQUIRED'
  | 'AUTO_DENIED'
  | 'PAYMENT_REQUIRED'
  | 'TICKET_NOT_FOUND'
  | 'PLATE_RFID_MISMATCH'
  | 'ANTI_PASSBACK_BLOCKED'
  | 'DEVICE_DEGRADED';

export type FinalAction = 'APPROVE' | 'REVIEW' | 'DENY' | 'PAYMENT_HOLD';

export const ACTIVE_SESSION_STATUSES: SessionStatus[] = [
  'OPEN',
  'WAITING_READ',
  'WAITING_DECISION',
  'APPROVED',
  'WAITING_PAYMENT',
];

export const TERMINAL_SESSION_STATUSES: SessionStatus[] = [
  'DENIED',
  'PASSED',
  'TIMEOUT',
  'CANCELLED',
  'ERROR',
];

const TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  OPEN: ['OPEN', 'WAITING_READ', 'WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT', 'DENIED', 'TIMEOUT', 'CANCELLED', 'ERROR'],
  WAITING_READ: ['WAITING_READ', 'WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT', 'DENIED', 'TIMEOUT', 'CANCELLED', 'ERROR'],
  WAITING_DECISION: ['WAITING_DECISION', 'APPROVED', 'WAITING_PAYMENT', 'DENIED', 'TIMEOUT', 'CANCELLED', 'ERROR'],
  APPROVED: ['APPROVED', 'PASSED', 'DENIED', 'TIMEOUT', 'CANCELLED', 'ERROR'],
  WAITING_PAYMENT: ['WAITING_PAYMENT', 'APPROVED', 'DENIED', 'TIMEOUT', 'CANCELLED', 'ERROR'],
  DENIED: ['DENIED'],
  PASSED: ['PASSED'],
  TIMEOUT: ['TIMEOUT'],
  CANCELLED: ['CANCELLED'],
  ERROR: ['ERROR'],
};

const ALLOWED_ACTIONS: Record<SessionStatus, SessionAllowedAction[]> = {
  OPEN: ['CANCEL'],
  WAITING_READ: ['CANCEL'],
  WAITING_DECISION: ['APPROVE', 'REQUIRE_PAYMENT', 'DENY', 'CANCEL'],
  APPROVED: ['CONFIRM_PASS', 'DENY', 'CANCEL'],
  WAITING_PAYMENT: ['APPROVE', 'DENY', 'CANCEL'],
  DENIED: [],
  PASSED: [],
  TIMEOUT: [],
  CANCELLED: [],
  ERROR: [],
};

export type ResolveSessionSignal = {
  currentStatus: SessionStatus;
  approved?: boolean;
  denied?: boolean;
  paymentRequired?: boolean;
  reviewRequired?: boolean;
  hasEvidence?: boolean;
  readType?: SessionReadType;
  sensorState?: SessionSensorState;
  presenceActive?: boolean;
};

export function isActiveSessionStatus(value: SessionStatus): boolean {
  return ACTIVE_SESSION_STATUSES.includes(value);
}

export function isTerminalSessionStatus(value: SessionStatus): boolean {
  return TERMINAL_SESSION_STATUSES.includes(value);
}

export function getAllowedActions(status: SessionStatus): SessionAllowedAction[] {
  return [...(ALLOWED_ACTIONS[status] ?? [])];
}

export function ensureSessionTransition(from: SessionStatus, to: SessionStatus) {
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ApiError({
      code: 'CONFLICT',
      message: `Không thể chuyển session từ ${from} sang ${to}`,
      details: { from, to, allowed },
    });
  }
}

export function deriveStatusFromRead(signal: {
  currentStatus: SessionStatus;
  readType?: SessionReadType;
  sensorState?: SessionSensorState;
  presenceActive?: boolean;
  hasEvidence?: boolean;
}): SessionStatus {
  if (signal.currentStatus === 'APPROVED' || signal.currentStatus === 'WAITING_PAYMENT') {
    return signal.currentStatus;
  }

  if (
    signal.readType === 'SENSOR' &&
    (signal.sensorState === 'PRESENT' || signal.sensorState === 'TRIGGERED' || signal.presenceActive)
  ) {
    return signal.currentStatus === 'OPEN' || signal.currentStatus === 'WAITING_READ'
      ? 'WAITING_READ'
      : signal.currentStatus;
  }

  if (
    signal.readType === 'ALPR' ||
    signal.readType === 'RFID' ||
    signal.hasEvidence
  ) {
    if (signal.currentStatus === 'OPEN' || signal.currentStatus === 'WAITING_READ' || signal.currentStatus === 'WAITING_DECISION') {
      return 'WAITING_DECISION';
    }
  }

  if (signal.currentStatus === 'WAITING_READ' && signal.presenceActive) {
    return 'WAITING_READ';
  }

  return signal.currentStatus;
}

export function resolveStatusFromSignal(signal: ResolveSessionSignal): {
  nextStatus: SessionStatus;
  decisionCode: DecisionCode | null;
  finalAction: FinalAction | null;
  reasonCode: string;
} {
  if (signal.denied) {
    return { nextStatus: 'DENIED', decisionCode: 'AUTO_DENIED', finalAction: 'DENY', reasonCode: 'SESSION_DENIED' };
  }
  if (signal.paymentRequired) {
    return { nextStatus: 'WAITING_PAYMENT', decisionCode: 'PAYMENT_REQUIRED', finalAction: 'PAYMENT_HOLD', reasonCode: 'PAYMENT_REQUIRED' };
  }
  if (signal.approved) {
    return { nextStatus: 'APPROVED', decisionCode: 'AUTO_APPROVED', finalAction: 'APPROVE', reasonCode: 'SESSION_APPROVED' };
  }

  const readDrivenStatus = deriveStatusFromRead({
    currentStatus: signal.currentStatus,
    readType: signal.readType,
    sensorState: signal.sensorState,
    presenceActive: signal.presenceActive,
    hasEvidence: signal.hasEvidence,
  });

  if (readDrivenStatus === 'WAITING_READ') {
    return {
      nextStatus: 'WAITING_READ',
      decisionCode: null,
      finalAction: null,
      reasonCode: 'WAITING_READ_FOR_DEVICE_INPUT',
    };
  }

  if (readDrivenStatus === 'WAITING_DECISION') {
    const shouldEmitDecision = signal.currentStatus === 'OPEN' || signal.currentStatus === 'WAITING_READ';
    return {
      nextStatus: 'WAITING_DECISION',
      decisionCode: shouldEmitDecision ? 'REVIEW_REQUIRED' : null,
      finalAction: shouldEmitDecision ? 'REVIEW' : null,
      reasonCode: signal.reviewRequired ? 'PLATE_REVIEW_REQUIRED' : 'WAITING_MANUAL_DECISION',
    };
  }

  return {
    nextStatus: readDrivenStatus,
    decisionCode: null,
    finalAction: null,
    reasonCode: 'SESSION_NOOP',
  };
}

export function computeWindowCutoff(now: Date, windowMs: number): Date {
  return new Date(now.getTime() - Math.max(1, windowMs));
}

export function shouldReuseSession(args: { openedAt: Date; lastReadAt: Date | null; now: Date; windowMs: number }): boolean {
  const anchor = args.lastReadAt ?? args.openedAt;
  return anchor.getTime() >= computeWindowCutoff(args.now, args.windowMs).getTime();
}


export function decisionActionToSessionStatus(action: FinalAction): SessionStatus {
  if (action === 'APPROVE') return 'APPROVED';
  if (action === 'PAYMENT_HOLD') return 'WAITING_PAYMENT';
  if (action === 'DENY') return 'DENIED';
  return 'WAITING_DECISION';
}
