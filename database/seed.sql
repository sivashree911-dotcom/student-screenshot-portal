-- ==============================================================================
-- STUDENT SCREENSHOT PORTAL - SEED DATA
-- Default Admin credentials:
-- Email: admin@college.edu
-- Password: AdminPassword@123
-- (Bcrypt hash: $2b$10$w82eLcq2jO5a6aGzW.qXue9m3a7s0rWcM.O4kM01s7eMfZY84xK8W)
-- ==============================================================================

USE `student_screenshot_portal`;

-- Seed Admin (Password: AdminPassword@123)
INSERT INTO `admins` (`id`, `name`, `email`, `password_hash`)
VALUES (
  1,
  'Portal Administrator',
  'admin@college.edu',
  '$2b$10$iKz5bV67gXG6NmvYf1kHbu5O6x0vj9324h9r36L3a74q5kP8Vqj1W'
)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Seed Hackathons
INSERT INTO `hackathons` (
  `id`, `name`, `institution`, `description`, `start_date`, `end_date`, `registration_deadline`,
  `mode`, `location`, `min_team_size`, `max_team_size`, `allow_external_participants`,
  `registration_url`, `poster_path`, `is_active`
) VALUES
(
  1,
  'Hack Odyssey 4.0',
  'Kalasalingam Academy of Research and Education',
  'A national-level 24-hour flagship hackathon bringing together creative minds to build impactful solutions in AI, Web3, Smart Healthcare, and Clean Energy.',
  '2026-10-25',
  '2026-10-26',
  '2026-10-20',
  'Offline',
  'Main Campus Auditorium, Block 4',
  3,
  5,
  1,
  'https://unstop.com/hackathons/hack-odyssey-4-0',
  'sample-hackathon-1.webp',
  1
),
(
  2,
  'Smart India Innovation Sprint 2026',
  'Ministry of Education & Innovation Cell',
  'Solve real-world problem statements submitted by premier government bodies, municipal corporations, and industry leaders.',
  '2026-11-10',
  '2026-11-12',
  '2026-11-01',
  'Hybrid',
  'Center for Excellence & Virtual Stage',
  4,
  6,
  0,
  'https://sih.gov.in',
  'sample-hackathon-2.webp',
  1
),
(
  3,
  'DevHacks Global AI Challenge',
  'Google Cloud Student Developer Clubs',
  'Build and deploy cutting-edge multimodal AI agents and cloud applications using modern web stacks and foundational models.',
  '2026-11-18',
  '2026-11-19',
  '2026-11-14',
  'Online',
  'Discord & Virtual DevPlatform',
  2,
  4,
  1,
  'https://devpost.com/hackathons/devhacks-ai',
  'sample-hackathon-3.webp',
  1
),
(
  4,
  'GreenTech Cyberathon 2026',
  'Indian Institute of Information Technology',
  'Focusing on smart agriculture, environmental IoT monitoring, sustainable urban transit, and green computing architectures.',
  '2026-12-05',
  '2026-12-06',
  '2026-11-28',
  'Offline',
  'IIIT Incubation & Research Park',
  3,
  4,
  1,
  'https://unstop.com/hackathons/greentech-2026',
  'sample-hackathon-4.webp',
  1
)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
