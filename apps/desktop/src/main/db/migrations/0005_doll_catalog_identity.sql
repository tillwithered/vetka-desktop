ALTER TABLE dolls ADD COLUMN official_name TEXT;
ALTER TABLE dolls ADD COLUMN mattel_url TEXT;
ALTER TABLE dolls ADD COLUMN image_source TEXT CHECK (image_source IN ('manual', 'mattel', 'amazon'));

UPDATE dolls
SET image_source = CASE
  WHEN image_path LIKE '%amazon.%' OR image_path LIKE '%images-na.%' THEN 'amazon'
  WHEN image_path IS NOT NULL THEN 'manual'
  ELSE NULL
END
WHERE image_source IS NULL;
