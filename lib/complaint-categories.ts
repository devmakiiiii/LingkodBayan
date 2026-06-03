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

export const complaintCategoryBadgeClasses: Record<ComplaintCategory, string> = {
  'Noise Complaint': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Public Disturbance': 'border-amber-200 bg-amber-50 text-amber-700',
  'Sanitation': 'border-sky-200 bg-sky-50 text-sky-700',
  'Infrastructure Issue': 'border-violet-200 bg-violet-50 text-violet-700',
  'Barangay Incident': 'border-rose-200 bg-rose-50 text-rose-700',
  'Illegal Parking': 'border-orange-200 bg-orange-50 text-orange-700',
  'Street Light Problem': 'border-yellow-200 bg-yellow-50 text-yellow-800',
  'Other Concerns': 'border-slate-200 bg-slate-50 text-slate-700',
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