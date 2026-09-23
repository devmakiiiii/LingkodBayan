/**
 * Unit tests for the official workload balancing helpers.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/workload.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  computeOfficialWorkloads,
  normalizeWorkloadPriority,
  planEvenDistribution,
  suggestAssignee,
} from './workload.ts'

const OFFICIALS = [
  { id: 'o1', name: 'Alice Cruz', designationLabel: 'Punong Barangay', status: 'active' },
  { id: 'o2', name: 'Bob Santos', designationLabel: 'Kagawad', status: 'active' },
  { id: 'o3', name: 'Carol Reyes', designationLabel: 'Staff Member', status: 'inactive' },
]

describe('normalizeWorkloadPriority', () => {
  it('maps canonical and legacy values onto the canonical set', () => {
    assert.equal(normalizeWorkloadPriority('critical'), 'critical')
    assert.equal(normalizeWorkloadPriority('HIGH'), 'high')
    assert.equal(normalizeWorkloadPriority('urgent'), 'high')
    assert.equal(normalizeWorkloadPriority('low'), 'low')
    assert.equal(normalizeWorkloadPriority('medium'), 'medium')
    assert.equal(normalizeWorkloadPriority('normal'), 'medium')
    assert.equal(normalizeWorkloadPriority(undefined), 'medium')
    assert.equal(normalizeWorkloadPriority('nonsense'), 'medium')
  })
})

describe('computeOfficialWorkloads', () => {
  it('counts active and completed complaints with priority weights', () => {
    const workloads = computeOfficialWorkloads(OFFICIALS, [
      { assignedOfficialId: 'o1', status: 'open', priority: 'critical' },
      { assignedOfficialId: 'o1', status: 'under_investigation', priority: 'low' },
      { assignedOfficialId: 'o1', status: 'resolved', priority: 'high' },
      { assignedOfficialId: 'o2', status: 'open', priority: 'medium' },
      { assignedOfficialId: 'o2', status: 'dismissed', priority: 'low' },
      { assignedOfficialId: 'unknown', status: 'open', priority: 'critical' },
      { assignedOfficialId: null, status: 'open', priority: 'critical' },
      { assignedOfficialId: 'o1', status: 'open', priority: 'critical', archivedAt: '2026-01-01T00:00:00Z' },
    ])

    const o1 = workloads.find((w) => w.officialId === 'o1')!
    const o2 = workloads.find((w) => w.officialId === 'o2')!
    const o3 = workloads.find((w) => w.officialId === 'o3')!

    assert.equal(o1.activeComplaints, 2)
    assert.equal(o1.weightedLoad, 5)
    assert.equal(o1.completedTotal, 1)

    assert.equal(o2.activeComplaints, 1)
    assert.equal(o2.weightedLoad, 2)
    assert.equal(o2.completedTotal, 1)

    // Inactive official is tracked but not assignable.
    assert.equal(o3.isAssignable, false)
    assert.equal(o3.activeTotal, 0)

    // loadShare is relative to the busiest official (o1 = max load 5).
    assert.equal(o1.loadShare, 1)
    assert.ok(Math.abs(o2.loadShare - 2 / 5) < 1e-9)
    assert.equal(o3.loadShare, 0)
  })

  it('includes assigned requests in the active load', () => {
    const workloads = computeOfficialWorkloads(
      OFFICIALS,
      [{ assignedOfficialId: 'o1', status: 'open', priority: 'low' }],
      [
        { assignedOfficialId: 'o1', status: 'pending', priority: 'high' },
        { assignedOfficialId: 'o1', status: 'processing', priority: 'low' },
        { assignedOfficialId: 'o1', status: 'approved', priority: 'critical' },
        { assignedOfficialId: 'o2', status: 'rejected', priority: 'medium' },
      ],
    )

    const o1 = workloads.find((w) => w.officialId === 'o1')!
    const o2 = workloads.find((w) => w.officialId === 'o2')!

    assert.equal(o1.activeRequests, 2)
    assert.equal(o1.activeTotal, 3)
    assert.equal(o1.weightedLoad, 1 + 3 + 1)
    assert.equal(o1.completedTotal, 1)


describe('suggestAssignee', () => {
  it('picks the least-loaded active official deterministically', () => {
    const workloads = computeOfficialWorkloads(OFFICIALS, [
      { assignedOfficialId: 'o1', status: 'open', priority: 'critical' },
      { assignedOfficialId: 'o2', status: 'open', priority: 'low' },
    ])

    const suggestion = suggestAssignee(workloads)
    assert.equal(suggestion?.officialId, 'o2')
  })

  it('skips inactive and explicitly excluded officials', () => {
    const workloads = computeOfficialWorkloads(OFFICIALS, [
      { assignedOfficialId: 'o2', status: 'open', priority: 'critical' },
      { assignedOfficialId: 'o3', status: 'open', priority: 'low' },
    ])

    // o3 is inactive -> never suggested even though its load is lowest.
    assert.equal(suggestAssignee(workloads)?.officialId, 'o1')
    // Excluding the least-loaded eligible official promotes the next one.
    assert.equal(suggestAssignee(workloads, { excludeIds: ['o1'] })?.officialId, 'o2')
  })

  it('returns null when nobody can take work', () => {
    assert.equal(suggestAssignee([]), null)
    assert.equal(suggestAssignee(null), null)
    const allInactive = computeOfficialWorkloads(
      [{ id: 'x', name: 'X', status: 'archived' }],
      [],
    )
    assert.equal(suggestAssignee(allInactive), null)
  })
})

describe('planEvenDistribution', () => {
  it('spreads items across assignable officials without exceeding a one-item gap', () => {
    const workloads = computeOfficialWorkloads(OFFICIALS, [])
    const items = [
      { id: 'a', priority: 'low' },
      { id: 'b', priority: 'low' },
      { id: 'c', priority: 'low' },
      { id: 'd', priority: 'low' },
      { id: 'e', priority: 'low' },
    ]

    const plan = planEvenDistribution(items, workloads)
    assert.equal(plan.length, items.length)

    const perOfficial = new Map<string, number>()
    for (const entry of plan) {
      perOfficial.set(entry.officialId, (perOfficial.get(entry.officialId) ?? 0) + 1)
    }
    // Only the two active officials receive work (o3 is inactive).
    assert.equal(perOfficial.size, 2)
    const counts = [...perOfficial.values()].sort((x, y) => x - y)
    assert.deepEqual(counts, [2, 3])
  })

  it('places heavier items first and respects existing load', () => {
    const workloads = computeOfficialWorkloads(OFFICIALS, [
      { assignedOfficialId: 'o2', status: 'open', priority: 'critical' },
    ])
    const plan = planEvenDistribution(
      [
        { id: 'heavy', priority: 'critical' },
        { id: 'light', priority: 'low' },
      ],
      workloads,
    )

    // o1 is empty, so both go to o1 until its simulated load passes o2.
    assert.equal(plan[0].itemId, 'heavy')
    assert.equal(plan[0].officialId, 'o1')
    assert.equal(plan[1].officialId, 'o1')
    // Input workloads are not mutated by the simulation.
    assert.equal(workloads.find((w) => w.officialId === 'o1')!.weightedLoad, 0)
  })

  it('returns an empty plan when no official is assignable', () => {
    assert.deepEqual(planEvenDistribution([{ id: 'a' }], []), [])
    const allArchived = computeOfficialWorkloads([{ id: 'x', name: 'X', status: 'archived' }], [])
    assert.deepEqual(planEvenDistribution([{ id: 'a' }], allArchived), [])
  })
})

    assert.equal(o2.activeTotal, 0)
    assert.equal(o2.completedTotal, 1)
  })

  it('normalizes legacy status aliases and tolerates empty input', () => {
    const workloads = computeOfficialWorkloads(OFFICIALS, [
      { assignedOfficialId: 'o1', status: 'in-progress', priority: 'medium' },
    ])
    assert.equal(workloads.find((w) => w.officialId === 'o1')!.activeComplaints, 1)

    assert.deepEqual(computeOfficialWorkloads([], null).length, 0)
    const nobodyBusy = computeOfficialWorkloads(OFFICIALS, [], [])
    assert.ok(nobodyBusy.every((w) => w.loadShare === 0))
  })
})
