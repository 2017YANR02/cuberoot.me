-- Match the organization-wide student roster ORDER BY display_name, id.
CREATE INDEX idx_student_profiles_org_display_name
  ON student_profiles(organization_id, display_name, id);
