-- ============================================================================
-- Migration 46: Seed Mission, Vision & Service Pledge (Barangay Barretto)
--
-- Inserts the official mission/vision plus the six Service Pledge commitments
-- from the Barangay Barretto Citizen's Charter into the `mission_vision`
-- system setting consumed by the public homepage "About Our Barangay" section
-- and editable at /admin/settings.
--
-- Idempotent and admin-safe: if a `mission_vision` row already exists
-- (e.g., an admin has saved custom content), this script leaves it untouched.
-- ============================================================================

INSERT INTO public.system_settings (setting_key, value)
VALUES (
  'mission_vision',
  '{
    "mission": "Deliver transparent, efficient, and citizen-centered public service.",
    "vision": "A barangay with sufficient income, transparent governance, and active citizen participation.",
    "service_pledge": [
      {
        "title": "Prompt and Courteous Service",
        "description": "We will attend to all barangay-related concerns with efficiency, professionalism, and respect, ensuring that every resident is treated with fairness and dignity."
      },
      {
        "title": "Integrity and Accountability",
        "description": "Perform our duties ethically and manage public resources responsibly."
      },
      {
        "title": "People-Centered Governance",
        "description": "We will actively listen to the concerns of our constituents, involve them in decision-making processes, and ensure that programs and services reflect their real needs and aspirations."
      },
      {
        "title": "Peace and Order",
        "description": "Maintain peace and order, promote disaster preparedness, and support sustainable, community-driven growth."
      },
      {
        "title": "Accessible and Inclusive Services",
        "description": "Listen to community needs, involve citizens in planning, and ensure fair access to services."
      },
      {
        "title": "Resilience and Development",
        "description": "We aim to build a resilient and self-reliant community by promoting disaster preparedness, sustainable development, and responsive social programs."
      }
    ]
  }'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;