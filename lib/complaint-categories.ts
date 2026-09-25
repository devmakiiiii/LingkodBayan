export const complaintCategories = [
  'Noise Complaint',
  'Public Disturbance',
  'Sanitation',
  'Infrastructure Issue',
  'Barangay Incident',
  'Illegal Parking',
  'Street Light Problem',
  'Other Concerns',
] as const

export type ComplaintCategory = (typeof complaintCategories)[number]

export const complaintCategoryKeywords: Record<ComplaintCategory, string[]> = {
  'Noise Complaint': ['noise', 'loud', 'karaoke', 'music', 'party'],
  'Public Disturbance': ['disturbance', 'dispute', 'gulo', 'fight', 'altercation', 'corruption', 'abuse of power', 'mismanagement'],
  'Sanitation': ['sanitation', 'garbage', 'trash', 'waste', 'sewer', 'drain', 'odor', 'dirty', 'environment', 'environmental'],
  'Infrastructure Issue': ['infrastructure', 'road', 'pothole', 'bridge', 'repair', 'drainage', 'unsafe conditions'],
  'Barangay Incident': ['incident', 'assault', 'theft', 'burglary', 'violence', 'crime', 'abuse'],
  'Illegal Parking': ['parking', 'parked', 'obstruction'],
  'Street Light Problem': ['street light', 'light', 'lamp', 'dark'],
  'Other Concerns': [],
}

export const complaintCategoryFallbackPriorities: Record<ComplaintCategory, 'low' | 'medium' | 'high' | 'critical'> = {
  'Noise Complaint': 'low',
  'Public Disturbance': 'high',
  'Sanitation': 'medium',
  'Infrastructure Issue': 'high',
  'Barangay Incident': 'critical',
  'Illegal Parking': 'low',
  'Street Light Problem': 'medium',
  'Other Concerns': 'low',
}

/**
 * Category badge recipes.
 *
 * Each entry keeps the original light-theme tint and adds a dark-theme
 * counterpart built from the same hue at low alpha (`/10` fill, `/30` border,
 * `-300` text) so the colours stay recognisable inside the layered dark
 * surfaces without glowing or causing eye strain.
 */
export const complaintCategoryBadgeClasses: Record<ComplaintCategory, string> = {
  'Noise Complaint':
    'rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300',
  'Public Disturbance':
    'rounded-full border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300',
  'Sanitation':
    'rounded-full border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300',
  'Infrastructure Issue':
    'rounded-full border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300',
  'Barangay Incident':
    'rounded-full border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300',
  'Illegal Parking':
    'rounded-full border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-300',
  'Street Light Problem':
    'rounded-full border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-200',
  'Other Concerns':
    'rounded-full border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-300',
}

const urgencyIndicators = [
  'urgent', 'immediate', 'emergency', 'asap', 'now', 'today', 'tonight',
  'happening', 'happening now', 'currently', 'ongoing', 'right now',
]

const severityIndicators = [
  'dangerous', 'danger', 'severe', 'serious', 'major', 'significant',
  'grave', 'critical', 'life-threatening', 'unsafe', 'hazardous',
  'accident', 'injured', 'injury', 'casualty', 'casualties',
  'violence', 'violent', 'attack', 'threat', 'threatening',
  'illegal', 'unauthorized', 'trespassing', 'damage', 'damaged',
]

const timeSensitiveIndicators = [
  'daily', 'weekly', 'every day', 'every night', 'frequent', 'repeated',
  'recurring', 'constant', 'continuous', 'persistent',
  'need immediate', 'requires immediate', 'required today', 'needed now',
]

const negationWords = ['not', 'no', 'none', 'never', 'without', 'unless', 'however']

function checkNegation(text: string, keyword: string): boolean {
  const keywordIndex = text.indexOf(keyword)
  if (keywordIndex === -1) return false
  const beforeKeyword = text.slice(Math.max(0, keywordIndex - 30), keywordIndex).toLowerCase()
  return negationWords.some((neg) => beforeKeyword.includes(neg))
}

function calculatePriorityScore(title: string, description: string): number {
  const fullText = `${title} ${description}`.toLowerCase()
  let score = 0

  urgencyIndicators.forEach((kw) => {
    if (fullText.includes(kw) && !checkNegation(fullText, kw)) score += 3
  })

  severityIndicators.forEach((kw) => {
    if (fullText.includes(kw) && !checkNegation(fullText, kw)) score += 2
  })

  timeSensitiveIndicators.forEach((kw) => {
    if (fullText.includes(kw) && !checkNegation(fullText, kw)) score += 1
  })

  return score
}

type PriorityAnalysis = {
  priority: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  reasons: string[]
}

export function analyzeComplaintPriority(
  title: string,
  description: string,
  categoryFallback: 'low' | 'medium' | 'high' | 'critical'
): PriorityAnalysis {
  const score = calculatePriorityScore(title, description)
  const reasons: string[] = []

  urgencyIndicators.forEach((kw) => {
    if (title.toLowerCase().includes(kw) || description.toLowerCase().includes(kw)) {
      reasons.push(`Urgency indicator: "${kw}"`)
    }
  })

  severityIndicators.forEach((kw) => {
    if (title.toLowerCase().includes(kw) || description.toLowerCase().includes(kw)) {
      reasons.push(`Severity indicator: "${kw}"`)
    }
  })

  const maxScore = urgencyIndicators.length * 3 + severityIndicators.length * 2 + timeSensitiveIndicators.length * 1

  if (score >= 5) {
    return { priority: 'critical', confidence: Math.min(0.9, 0.5 + score / maxScore), reasons }
  }
  if (score >= 3) {
    return { priority: 'high', confidence: Math.min(0.85, 0.4 + score / maxScore), reasons }
  }
  if (score >= 1) {
    return { priority: 'medium', confidence: Math.min(0.75, 0.3 + score / maxScore), reasons }
  }

  return { priority: categoryFallback, confidence: 0.5, reasons: ['Using category-based default priority'] }
}