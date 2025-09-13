/*
  # Create Announcements System for Supabase

  1. New Tables
    - `announcements`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `content` (text, required)
      - `created_by` (uuid, foreign key to auth.users)
      - `team_id` (uuid, foreign key to teams)
      - `target_type` (enum: 'entire_team', 'specific_members')
      - `target_members` (jsonb, array of user IDs for specific targeting)
      - `status` (enum: 'draft', 'active', 'scheduled', 'archived')
      - `start_date` (timestamptz, when announcement becomes visible)
      - `end_date` (timestamptz, when announcement expires)
      - `attachment_url` (text, optional file attachment)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `announcement_reads`
      - `announcement_id` (uuid, foreign key to announcements)
      - `user_id` (uuid, foreign key to auth.users)
      - `read_at` (timestamptz)
      - Primary key: (announcement_id, user_id)

  2. Enums
    - `announcement_target_type` ('entire_team', 'specific_members')
    - `announcement_status` ('draft', 'active', 'scheduled', 'archived')

  3. Security
    - Enable RLS on both tables
    - Team owners and admins can create/manage announcements
    - Team members can read announcements targeted to them
    - Users can manage their own read status
*/

-- Create enums
CREATE TYPE announcement_target_type AS ENUM ('entire_team', 'specific_members');
CREATE TYPE announcement_status AS ENUM ('draft', 'active', 'scheduled', 'archived');

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  target_type announcement_target_type NOT NULL DEFAULT 'entire_team',
  target_members jsonb DEFAULT '[]'::jsonb,
  status announcement_status NOT NULL DEFAULT 'active',
  start_date timestamptz DEFAULT now(),
  end_date timestamptz DEFAULT NULL,
  attachment_url text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create announcement_reads table for tracking read status
CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_team_id ON announcements(team_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_start_date ON announcements(start_date);
CREATE INDEX IF NOT EXISTS idx_announcements_end_date ON announcements(end_date);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id ON announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id ON announcement_reads(announcement_id);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for announcements table

-- Team owners and admins can manage all announcements in their team
CREATE POLICY "Team owners and admins can manage announcements"
  ON announcements
  FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT tm.team_id
      FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT tm.team_id
      FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Team members can view announcements targeted to them
CREATE POLICY "Team members can view targeted announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (
    -- Must be an active team member
    team_id IN (
      SELECT tm.team_id
      FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
    AND
    -- Announcement must be active and within date range
    status = 'active'
    AND
    (start_date IS NULL OR start_date <= now())
    AND
    (end_date IS NULL OR end_date > now())
    AND
    (
      -- Either targeted to entire team
      target_type = 'entire_team'
      OR
      -- Or user is specifically included in target_members
      (
        target_type = 'specific_members'
        AND
        jsonb_path_exists(target_members, ('$ ? (@ == "' || auth.uid()::text || '")')::jsonpath)
      )
    )
  );

-- RLS Policies for announcement_reads table

-- Users can manage their own read status
CREATE POLICY "Users can manage their own read status"
  ON announcement_reads
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Team owners and admins can view read status for their team announcements
CREATE POLICY "Team owners and admins can view read status"
  ON announcement_reads
  FOR SELECT
  TO authenticated
  USING (
    announcement_id IN (
      SELECT a.id
      FROM announcements a
      JOIN team_members tm ON a.team_id = tm.team_id
      WHERE tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();