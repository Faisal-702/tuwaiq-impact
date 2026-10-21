-- Initial categories and settings requested for the platform.
-- Administrators can add, rename and archive categories from the dashboard.

insert into public.categories (slug, name_en, name_ar, keywords, icon, accent, kind, sort_order) values
  ('innovation',              'Innovation',              'الابتكار',             'innovate, invention, ابتكار, اختراع', 'lightbulb',     'teal',      'project',   10),
  ('research',                'Research',                'البحث العلمي',          'science, scientific, بحث, علوم',     'flask-conical', 'deep-teal', 'project',   20),
  ('programming',             'Programming',             'البرمجة',              'code, coding, software, app, برمجة, تطبيق', 'code-xml', 'purple', 'project', 30),
  ('artificial-intelligence', 'Artificial Intelligence', 'الذكاء الاصطناعي',      'ai, machine learning, ml, ذكاء اصطناعي', 'brain-circuit', 'purple', 'project', 40),
  ('cybersecurity',           'Cybersecurity',           'الأمن السيبراني',       'cyber, security, أمن, سيبراني',       'shield-check',  'graphite',  'project',   50),
  ('robotics',                'Robotics',                'الروبوتات',            'robot, robots, روبوت',              'bot',           'violet',    'project',   60),
  ('media',                   'Media',                   'الإعلام',              'film, video, design, إعلام, تصميم',  'clapperboard',  'slate',     'project',   70),
  ('volunteering',            'Volunteering',            'التطوع',               'volunteer, community, تطوع, مجتمع',  'hand-heart',    'teal',      'activity',  80),
  ('competitions',            'Competitions',            'المسابقات',            'competition, contest, olympiad, مسابقة, أولمبياد', 'trophy', 'purple', 'project', 90),
  ('school-activities',       'School Activities',       'الأنشطة المدرسية',      'activity, activities, school, نشاط, أنشطة', 'school', 'deep-teal', 'activity', 100),
  ('national-day',            'National Day',            'اليوم الوطني',          'national day, saudi national day, اليوم الوطني', 'flag', 'teal', 'activity', 110),
  ('founding-day',            'Founding Day',            'يوم التأسيس',           'founding day, يوم التأسيس',          'landmark',      'deep-teal', 'activity',  120),
  ('mawhiba',                 'Mawhiba',                 'موهبة',                'mawhiba, موهبة',                    'sparkles',      'violet',    'project',   130),
  ('saif',                    'SAIF',                    'SAIF',                 'saif',                             'award',         'purple',    'project',   140),
  ('isef',                    'ISEF',                    'آيسف',                 'isef, ايسف',                        'medal',         'deep-teal', 'project',   150)
on conflict (slug) do nothing;

insert into public.settings (key, value) values
  ('default_points', '10'::jsonb),
  ('current_academic_year', 'null'::jsonb)
on conflict (key) do nothing;
