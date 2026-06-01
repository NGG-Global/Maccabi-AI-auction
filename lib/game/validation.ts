export interface BidValidationInput {
  amount: number
  walletBalance: number
  existingBidAmount: number | null
  roundStatus: string
}

export interface BidValidationResult {
  valid: boolean
  error?: string
}

export function validateBid(input: BidValidationInput): BidValidationResult {
  const { amount, walletBalance, existingBidAmount, roundStatus } = input

  if (roundStatus !== 'open') {
    return { valid: false, error: 'הסבב אינו פתוח' }
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return { valid: false, error: 'סכום ההצעה חייב להיות מספר שלם חיובי' }
  }
  if (amount > walletBalance) {
    return { valid: false, error: 'אין מספיק מטבעות ביתרה' }
  }
  if (existingBidAmount !== null && amount <= existingBidAmount) {
    return { valid: false, error: 'הצעה חדשה חייבת להיות גבוהה מהקודמת' }
  }

  return { valid: true }
}
