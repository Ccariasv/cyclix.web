CREATE TABLE ticket_categories (
    name VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ticket_categories (name, description) VALUES
    ('BIKE', 'Incidencias relacionadas a bicicletas'),
    ('APP', 'Problemas de aplicación o plataforma'),
    ('PAYMENT', 'Incidencias de cobros o pagos'),
    ('ACCOUNT', 'Problemas de cuenta de usuario'),
    ('TRIP', 'Problemas en viajes'),
    ('EMERGENCY', 'Emergencias operativas'),
    ('OTHER', 'Otras incidencias');

CREATE TABLE ticket_priorities (
    name VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ticket_priorities (name, description) VALUES
    ('LOW', 'Baja'),
    ('MEDIUM', 'Media'),
    ('HIGH', 'Alta'),
    ('CRITICAL', 'Crítica');

CREATE TABLE ticket_statuses (
    name VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ticket_statuses (name, description) VALUES
    ('OPEN', 'Abierto'),
    ('IN_PROGRESS', 'En progreso'),
    ('WAITING_USER', 'Esperando respuesta del usuario'),
    ('RESOLVED', 'Resuelto'),
    ('CLOSED', 'Cerrado');

CREATE TABLE support_tickets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    bike_id BIGINT UNSIGNED NULL,
    trip_id BIGINT UNSIGNED NULL,
    payment_id BIGINT UNSIGNED NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_support_tickets_user
        FOREIGN KEY (user_id) REFERENCES user(id),

    CONSTRAINT fk_support_tickets_category
        FOREIGN KEY (category) REFERENCES ticket_categories(name),

    CONSTRAINT fk_support_tickets_priority
        FOREIGN KEY (priority) REFERENCES ticket_priorities(name),

    CONSTRAINT fk_support_tickets_status
        FOREIGN KEY (status) REFERENCES ticket_statuses(name),

    CONSTRAINT chk_support_title_not_blank
        CHECK (CHAR_LENGTH(TRIM(title)) > 0),

    CONSTRAINT chk_support_description_not_blank
        CHECK (CHAR_LENGTH(TRIM(description)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_support_tickets_user_id ON support_tickets (user_id);
CREATE INDEX idx_support_tickets_status_created_at ON support_tickets (status, created_at);
CREATE INDEX idx_support_tickets_category_created_at ON support_tickets (category, created_at);
CREATE INDEX idx_support_tickets_bike_id ON support_tickets (bike_id);
CREATE INDEX idx_support_tickets_trip_id ON support_tickets (trip_id);
CREATE INDEX idx_support_tickets_payment_id ON support_tickets (payment_id);
