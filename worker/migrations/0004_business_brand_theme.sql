-- Per-salon color branding for provider workspace and public booking pages.
alter table private.businesses
  add column if not exists brand_theme jsonb not null
  default '{"primary":"#68477B","accent":"#9675A8","background":"#F7F4F8","surface":"#FFFFFF"}'::jsonb;
