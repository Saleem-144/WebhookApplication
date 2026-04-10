-- Hide from bell dropdown only; inbox still lists all rows.
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS dismissed_from_popup_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_dismissed_popup
  ON notifications (dismissed_from_popup_at)
  WHERE dismissed_from_popup_at IS NULL;
