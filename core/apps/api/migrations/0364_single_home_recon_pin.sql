LOCK TABLE recon_home_pins IN SHARE ROW EXCLUSIVE MODE;

-- Keep the most recent pin that the homepage could actually display.
DELETE FROM recon_home_pins
WHERE recon_id IS DISTINCT FROM (
  SELECT pin.recon_id
  FROM recon_home_pins pin JOIN recons r ON r.id = pin.recon_id
  WHERE r.visibility = 'public' AND r.record_type IS DISTINCT FROM 'timing'
  ORDER BY pin.pinned_at DESC, pin.recon_id DESC
  LIMIT 1
);

CREATE UNIQUE INDEX recon_home_pins_singleton ON recon_home_pins ((true));
