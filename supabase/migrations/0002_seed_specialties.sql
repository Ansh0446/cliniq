insert into public.specialties (slug, label) values
  ('general_practice', 'General practice'),
  ('pediatrics', 'Pediatrics'),
  ('cardiology', 'Cardiology'),
  ('orthopedics', 'Orthopedics'),
  ('neurology', 'Neurology'),
  ('dermatology', 'Dermatology'),
  ('ent', 'Ear, nose and throat'),
  ('gastroenterology', 'Gastroenterology'),
  ('obstetrics_gynecology', 'Obstetrics and gynecology'),
  ('psychiatry', 'Psychiatry'),
  ('ophthalmology', 'Ophthalmology'),
  ('pulmonology', 'Pulmonology')
on conflict (slug) do nothing;
