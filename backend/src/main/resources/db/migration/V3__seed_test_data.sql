-- Seed de prueba para tablas base y módulo de soporte

INSERT IGNORE INTO roles (name, description) VALUES
    ('USER', 'Usuario final de la plataforma'),
    ('ADMIN', 'Administrador del sistema');

INSERT IGNORE INTO user_statuses (name, description) VALUES
    ('ACTIVE', 'Usuario activo'),
    ('INACTIVE', 'Usuario inactivo');

INSERT IGNORE INTO ticket_categories (name, description) VALUES
    ('BIKE', 'Incidencias relacionadas a bicicletas'),
    ('APP', 'Problemas de aplicación o plataforma'),
    ('PAYMENT', 'Incidencias de cobros o pagos'),
    ('ACCOUNT', 'Problemas de cuenta de usuario'),
    ('TRIP', 'Problemas en viajes'),
    ('EMERGENCY', 'Emergencias operativas'),
    ('OTHER', 'Otras incidencias');

INSERT IGNORE INTO ticket_priorities (name, description) VALUES
    ('LOW', 'Baja'),
    ('MEDIUM', 'Media'),
    ('HIGH', 'Alta'),
    ('CRITICAL', 'Crítica');

INSERT IGNORE INTO ticket_statuses (name, description) VALUES
    ('OPEN', 'Abierto'),
    ('IN_PROGRESS', 'En progreso'),
    ('WAITING_USER', 'Esperando respuesta del usuario'),
    ('RESOLVED', 'Resuelto'),
    ('CLOSED', 'Cerrado');

-- password_hash para todos: Test1234* (BCrypt)
INSERT IGNORE INTO user (
    first_name,
    last_name,
    email,
    phone,
    password_hash,
    role_id,
    status_id,
    email_verified,
    last_login_at
)
VALUES
(
    'Diego',
    'Admin',
    'admin@cyclix.test',
    '88880001',
    '$2a$10$2y8J3pk8f4y0lYVn6AhJw.c7F2ZQ4nT4tXnH4NQYbK4sQ7dbU4tQK',
    (SELECT id FROM roles WHERE name = 'ADMIN'),
    (SELECT id FROM user_statuses WHERE name = 'ACTIVE'),
    TRUE,
    NOW()
),
(
    'Laura',
    'Mora',
    'laura@cyclix.test',
    '88880002',
    '$2a$10$2y8J3pk8f4y0lYVn6AhJw.c7F2ZQ4nT4tXnH4NQYbK4sQ7dbU4tQK',
    (SELECT id FROM roles WHERE name = 'USER'),
    (SELECT id FROM user_statuses WHERE name = 'ACTIVE'),
    TRUE,
    NOW()
),
(
    'Carlos',
    'Rojas',
    'carlos@cyclix.test',
    '88880003',
    '$2a$10$2y8J3pk8f4y0lYVn6AhJw.c7F2ZQ4nT4tXnH4NQYbK4sQ7dbU4tQK',
    (SELECT id FROM roles WHERE name = 'USER'),
    (SELECT id FROM user_statuses WHERE name = 'INACTIVE'),
    FALSE,
    NULL
);

INSERT IGNORE INTO support_tickets (
    user_id,
    bike_id,
    trip_id,
    payment_id,
    category,
    priority,
    status,
    title,
    description
)
VALUES
(
    (SELECT id FROM user WHERE email = 'laura@cyclix.test'),
    101,
    NULL,
    NULL,
    'BIKE',
    'HIGH',
    'OPEN',
    'Freno trasero no responde',
    'Durante el uso la bicicleta no frenó correctamente.'
),
(
    (SELECT id FROM user WHERE email = 'laura@cyclix.test'),
    NULL,
    NULL,
    NULL,
    'APP',
    'MEDIUM',
    'IN_PROGRESS',
    'La app se cierra al abrir mapa',
    'En Android la aplicación se cierra cuando intento iniciar un viaje.'
),
(
    (SELECT id FROM user WHERE email = 'carlos@cyclix.test'),
    NULL,
    NULL,
    7001,
    'PAYMENT',
    'HIGH',
    'WAITING_USER',
    'Cobro duplicado en tarjeta',
    'Se aplicaron dos cobros por un mismo viaje.'
),
(
    (SELECT id FROM user WHERE email = 'carlos@cyclix.test'),
    NULL,
    NULL,
    NULL,
    'ACCOUNT',
    'LOW',
    'RESOLVED',
    'No puedo actualizar mi foto de perfil',
    'Al guardar cambios, la imagen vuelve a la anterior.'
),
(
    (SELECT id FROM user WHERE email = 'laura@cyclix.test'),
    NULL,
    5001,
    NULL,
    'TRIP',
    'MEDIUM',
    'CLOSED',
    'Viaje no finaliza automáticamente',
    'El viaje siguió activo aunque ya estacioné la bicicleta.'
),
(
    (SELECT id FROM user WHERE email = 'admin@cyclix.test'),
    205,
    5002,
    NULL,
    'EMERGENCY',
    'CRITICAL',
    'OPEN',
    'Accidente reportado en ruta',
    'Usuario reporta caída y requiere atención inmediata.'
),
(
    (SELECT id FROM user WHERE email = 'laura@cyclix.test'),
    NULL,
    NULL,
    NULL,
    'OTHER',
    'LOW',
    'OPEN',
    'Sugerencia de mejora en notificaciones',
    'Sería útil configurar alertas por tipo de incidencia.'
);
