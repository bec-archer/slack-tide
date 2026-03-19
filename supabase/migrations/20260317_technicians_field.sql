-- Add technicians field to maintenance_records
-- Stores an array of tech names who performed the work
-- e.g., ["John Smith", "Jane Doe"] or manually entered names

ALTER TABLE maintenance_records
ADD COLUMN technicians JSONB DEFAULT '[]'::jsonb;

-- Index for querying records by technician name (GIN for JSONB containment)
CREATE INDEX idx_maintenance_records_technicians
  ON maintenance_records USING GIN (technicians);
