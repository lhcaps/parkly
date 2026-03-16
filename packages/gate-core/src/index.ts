export {
  MAX_RAW_LENGTH,
  MIN_RAW_LENGTH,
  OCR_TO_ALPHA_MAP,
  OCR_TO_DIGIT_MAP,
  PLATE_FAMILY_RULES,
  RESERVED_SERIES,
  classifyPlateFamily,
  type PlateFamily,
  type PlateFamilyRule,
  type PlateValidity,
} from './plate-rules'

export {
  buildPlateCanonical,
  detectSuspiciousPlate,
  formatPlateDisplay,
  normalizePlate,
  parsePlate,
  validatePlateStrict,
  type PlateCanonicalResult,
  type PlateNormalizationResult,
  type PlateParseResult,
} from './plate-parser'

export {
  DEFAULT_GATE_DECISION_THRESHOLDS,
  evaluateGateDecision,
  normalizeGateDecisionThresholds,
  type GateActivePresenceContext,
  type GateCredentialStatus,
  type GateDecisionCode,
  type GateDecisionMatchedBy,
  type GateDecisionRuleInput,
  type GateDecisionRuleOutput,
  type GateDecisionThresholds,
  type GateDeviceHealth,
  type GateOpenTicketContext,
  type GatePaymentStatus,
  type GateRecommendedAction,
} from './decision'
