/**
 * Unit tests for the status finite state machines.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/status-machine.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  IllegalStatusTransitionError,
  assertComplaintTransition,
  assertFeedbackTransition,
  assertRequestTransition,
  canTransitionComplaint,
  canTransitionFeedback,
  canTransitionRequest,
  complaintStatusMachine,
  feedbackStatusMachine,
  getAllowedComplaintTransitions,
  getAllowedFeedbackTransitions,
  getAllowedRequestTransitions,
  isTerminalComplaintStatus,
  isTerminalFeedbackStatus,
  isTerminalRequestStatus,
  normalizeComplaintLifecycleStatus,
  normalizeFeedbackLifecycleStatus,
  normalizeRequestLifecycleStatus,
  requestStatusMachine,
} from './status-machine.ts'

describe('request status machine', () => {
  it('starts at pending', () => {
    assert.equal(requestStatusMachine.initialState, 'pending')
  })

  it('allows the happy path pending -> processing -> approved', () => {
    assert.equal(canTransitionRequest('pending', 'processing'), true)
    assert.equal(canTransitionRequest('processing', 'approved'), true)
  })

  it('allows rejection from pending and processing', () => {
    assert.equal(canTransitionRequest('pending', 'rejected'), true)
    assert.equal(canTransitionRequest('processing', 'rejected'), true)
  })

  it('allows sending a processing request back to pending', () => {
    assert.equal(canTransitionRequest('processing', 'pending'), true)
  })

  it('blocks skipping straight from pending to approved', () => {
    assert.equal(canTransitionRequest('pending', 'approved'), false)
  })

  it('treats approved and rejected as terminal states', () => {
    assert.equal(isTerminalRequestStatus('approved'), true)
    assert.equal(isTerminalRequestStatus('rejected'), true)
    assert.equal(canTransitionRequest('approved', 'pending'), false)
    assert.equal(canTransitionRequest('rejected', 'processing'), false)
    assert.deepEqual(getAllowedRequestTransitions('approved'), [])
    assert.deepEqual(getAllowedRequestTransitions('rejected'), [])
  })

  it('normalizes legacy status aliases on the source side', () => {
    assert.equal(normalizeRequestLifecycleStatus('in-progress'), 'processing')
    assert.equal(normalizeRequestLifecycleStatus('in_progress'), 'processing')
    assert.equal(normalizeRequestLifecycleStatus('resolved'), 'approved')
    assert.equal(canTransitionRequest('in-progress', 'approved'), true)
    assert.equal(canTransitionRequest('resolved', 'pending'), false)
  })

  it('falls back to the initial state for unknown or empty values', () => {
    assert.equal(normalizeRequestLifecycleStatus(undefined), 'pending')
    assert.equal(normalizeRequestLifecycleStatus(''), 'pending')
    assert.equal(normalizeRequestLifecycleStatus('garbage'), 'pending')
  })

  it('rejects transitions to unknown statuses', () => {
    assert.equal(canTransitionRequest('pending', 'shredded'), false)
    assert.throws(() => assertRequestTransition('pending', 'shredded'), IllegalStatusTransitionError)
  })

  it('rejects no-op transitions', () => {
    assert.equal(canTransitionRequest('pending', 'pending'), false)
  })

  it('assertRequestTransition returns the canonical target on success', () => {
    assert.equal(assertRequestTransition('pending', 'PROCESSING'), 'processing')
    assert.equal(assertRequestTransition('in-progress', 'approved'), 'approved')
  })

  it('throws a descriptive error for illegal transitions', () => {
    assert.throws(
      () => assertRequestTransition('approved', 'pending'),
      (error: unknown) => {
        assert.ok(error instanceof IllegalStatusTransitionError)
        assert.equal(error.kind, 'request')
        assert.equal(error.from, 'approved')
        assert.equal(error.to, 'pending')
        assert.match(error.message, /terminal/)
        return true
      },
    )
  })

  it('lists allowed transitions with UI labels', () => {
    const transitions = getAllowedRequestTransitions('pending')
    assert.deepEqual(
      transitions.map((transition) => transition.to),
      ['processing', 'rejected'],
    )
    assert.ok(transitions.every((transition) => transition.label.length > 0))
  })
})

describe('complaint status machine', () => {
  it('starts at open', () => {
    assert.equal(complaintStatusMachine.initialState, 'open')
  })

  it('allows the investigation path open -> under_investigation -> resolved', () => {
    assert.equal(canTransitionComplaint('open', 'under_investigation'), true)
    assert.equal(canTransitionComplaint('under_investigation', 'resolved'), true)
  })

  it('allows resolving directly from open', () => {
    assert.equal(canTransitionComplaint('open', 'resolved'), true)
  })

  it('allows dismissing from open, under investigation, and resolved (archive)', () => {
    assert.equal(canTransitionComplaint('open', 'dismissed'), true)
    assert.equal(canTransitionComplaint('under_investigation', 'dismissed'), true)
    assert.equal(canTransitionComplaint('resolved', 'dismissed'), true)
  })

  it('allows reopening a resolved complaint (Unresolve)', () => {
    assert.equal(canTransitionComplaint('resolved', 'under_investigation'), true)
    assert.equal(isTerminalComplaintStatus('resolved'), false)
  })

  it('treats dismissed as the only terminal state', () => {
    assert.equal(isTerminalComplaintStatus('dismissed'), true)
    assert.equal(canTransitionComplaint('dismissed', 'open'), false)
    assert.deepEqual(getAllowedComplaintTransitions('dismissed'), [])
  })

  it('normalizes UI and legacy aliases', () => {
    assert.equal(normalizeComplaintLifecycleStatus('pending'), 'open')
    assert.equal(normalizeComplaintLifecycleStatus('under_review'), 'under_investigation')
    assert.equal(normalizeComplaintLifecycleStatus('in-progress'), 'under_investigation')
    assert.equal(normalizeComplaintLifecycleStatus('rejected'), 'dismissed')
    assert.equal(canTransitionComplaint('pending', 'under_review'), true)
  })

  it('throws a descriptive error for illegal transitions', () => {
    assert.throws(
      () => assertComplaintTransition('dismissed', 'open'),
      (error: unknown) => {
        assert.ok(error instanceof IllegalStatusTransitionError)
        assert.equal(error.kind, 'complaint')
        assert.match(error.message, /terminal/)
        return true
      },
    )
  })

  it('assertComplaintTransition returns the canonical target on success', () => {
    assert.equal(assertComplaintTransition('open', 'UNDER_INVESTIGATION'), 'under_investigation')
  })
})

describe('feedback status machine', () => {
  it('starts at submitted', () => {
    assert.equal(feedbackStatusMachine.initialState, 'submitted')
  })

  it('follows the charter pipeline in order', () => {
    assert.equal(canTransitionFeedback('submitted', 'acknowledged'), true)
    assert.equal(canTransitionFeedback('acknowledged', 'under_evaluation'), true)
    assert.equal(canTransitionFeedback('under_evaluation', 'action_taken'), true)
    assert.equal(canTransitionFeedback('action_taken', 'responded'), true)
    assert.equal(canTransitionFeedback('responded', 'documented'), true)
  })

  it('blocks skipping stages', () => {
    assert.equal(canTransitionFeedback('submitted', 'responded'), false)
    assert.equal(canTransitionFeedback('submitted', 'documented'), false)
    assert.equal(canTransitionFeedback('acknowledged', 'responded'), false)
  })

  it('allows returning from responded to action_taken for revision', () => {
    assert.equal(canTransitionFeedback('responded', 'action_taken'), true)
  })

  it('treats documented as the only terminal state', () => {
    assert.equal(isTerminalFeedbackStatus('documented'), true)
    assert.equal(isTerminalFeedbackStatus('responded'), false)
    assert.equal(canTransitionFeedback('documented', 'acknowledged'), false)
    assert.deepEqual(getAllowedFeedbackTransitions('documented'), [])
  })

  it('normalizes legacy and UI aliases', () => {
    assert.equal(normalizeFeedbackLifecycleStatus('new'), 'submitted')
    assert.equal(normalizeFeedbackLifecycleStatus('resolved'), 'action_taken')
    assert.equal(normalizeFeedbackLifecycleStatus('closed'), 'documented')
    assert.equal(normalizeFeedbackLifecycleStatus('garbage'), 'submitted')
  })

  it('assertFeedbackTransition returns the canonical target on success', () => {
    assert.equal(assertFeedbackTransition('submitted', 'ACKNOWLEDGED'), 'acknowledged')
    assert.throws(() => assertFeedbackTransition('submitted', 'documented'), IllegalStatusTransitionError)
  })
})
