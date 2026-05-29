-- Corrige contraseñas de usuarios seed para entorno local
-- Password plano: Test1234*

UPDATE user
SET password_hash = '$2y$10$vk/hfdcsiMo.w8O8Op6anOrbUfG/hFclbM2MJ7gyTg8jDmbw3tlYm'
WHERE email IN ('admin@cyclix.test', 'laura@cyclix.test', 'carlos@cyclix.test');
