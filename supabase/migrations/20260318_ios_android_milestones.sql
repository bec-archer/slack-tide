-- Add iOS App and Android App milestones with features for the QRSTKR project
DO $$
DECLARE
  v_project_id uuid;
  v_ios_milestone_id uuid;
  v_android_milestone_id uuid;
BEGIN
  -- Look up the project ID dynamically
  SELECT id INTO v_project_id FROM projects WHERE slug = 'qrstkr';
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Project with slug "qrstkr" not found';
  END IF;

  -- Create iOS App milestone
  INSERT INTO milestones (project_id, name, status, sort_order)
  VALUES (v_project_id, 'iOS App', 'planned', 6)
  RETURNING id INTO v_ios_milestone_id;

  -- iOS App features
  INSERT INTO features (milestone_id, project_id, name, status, priority, is_scope_creep, sort_order) VALUES
    (v_ios_milestone_id, v_project_id, 'Wireframes & design system',  'planned', 'high',     false, 0),
    (v_ios_milestone_id, v_project_id, 'Supabase auth integration',   'planned', 'critical', false, 1),
    (v_ios_milestone_id, v_project_id, 'QR code scanner',             'planned', 'critical', false, 2),
    (v_ios_milestone_id, v_project_id, 'Item detail view',            'planned', 'high',     false, 3),
    (v_ios_milestone_id, v_project_id, 'Claim/register item flow',    'planned', 'high',     false, 4),
    (v_ios_milestone_id, v_project_id, 'Push notifications',          'planned', 'medium',   false, 5),
    (v_ios_milestone_id, v_project_id, 'App Store submission',        'planned', 'medium',   false, 6);

  -- Create Android App milestone
  INSERT INTO milestones (project_id, name, status, sort_order)
  VALUES (v_project_id, 'Android App', 'planned', 7)
  RETURNING id INTO v_android_milestone_id;

  -- Android App features
  INSERT INTO features (milestone_id, project_id, name, status, priority, is_scope_creep, sort_order) VALUES
    (v_android_milestone_id, v_project_id, 'Wireframes & design system',  'planned', 'high',     false, 0),
    (v_android_milestone_id, v_project_id, 'Supabase auth integration',   'planned', 'critical', false, 1),
    (v_android_milestone_id, v_project_id, 'QR code scanner',             'planned', 'critical', false, 2),
    (v_android_milestone_id, v_project_id, 'Item detail view',            'planned', 'high',     false, 3),
    (v_android_milestone_id, v_project_id, 'Claim/register item flow',    'planned', 'high',     false, 4),
    (v_android_milestone_id, v_project_id, 'Push notifications',          'planned', 'medium',   false, 5),
    (v_android_milestone_id, v_project_id, 'Play Store submission',       'planned', 'medium',   false, 6);
END $$;
