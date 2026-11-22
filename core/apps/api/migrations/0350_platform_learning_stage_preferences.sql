CREATE TABLE platform_learning_stage_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('first-solve','sub60','sub30','sub20','sub15','sub10'))
);
