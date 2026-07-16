CREATE DATABASE IF NOT EXISTS despachos_db;
USE despachos_db;

CREATE TABLE IF NOT EXISTS empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    ruc VARCHAR(20),
    direccion TEXT,
    telefono VARCHAR(50),
    tiempo_maximo_entrega INT DEFAULT 24,
    notificaciones_automaticas ENUM('activas', 'inactivas') DEFAULT 'activas',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    contacto VARCHAR(255),
    telefono VARCHAR(50),
    email VARCHAR(255),
    direccion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega_estimada DATETIME,
    estado ENUM('pendiente', 'procesando', 'despachado', 'entregado', 'cancelado') DEFAULT 'pendiente',
    total DECIMAL(10,2) DEFAULT 0,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS pedido_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS conductores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    licencia VARCHAR(50) NOT NULL UNIQUE,
    telefono VARCHAR(50),
    email VARCHAR(255),
    vehiculo_placa VARCHAR(20),
    vehiculo_marca VARCHAR(100),
    vehiculo_modelo VARCHAR(100),
    vehiculo_capacidad_kg DECIMAL(10,2),
    estado ENUM('activo', 'inactivo') DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rutas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    origen VARCHAR(255) NOT NULL,
    destino VARCHAR(255) NOT NULL,
    distancia_km DECIMAL(8,2),
    tiempo_estimado_horas DECIMAL(4,2),
    estado ENUM('activa', 'inactiva') DEFAULT 'activa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS despachos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    conductor_id INT,
    ruta_id INT,
    vehiculo_placa VARCHAR(20),
    fecha_salida DATETIME,
    fecha_llegada_estimada DATETIME,
    fecha_entrega_real DATETIME,
    estado ENUM('programado', 'en_ruta', 'entregado', 'fallido') DEFAULT 'programado',
    observaciones TEXT,
    interno_encargado VARCHAR(255),
    dueno_union VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (conductor_id) REFERENCES conductores(id),
    FOREIGN KEY (ruta_id) REFERENCES rutas(id)
);

INSERT IGNORE INTO empresas (id, nombre, ruc, direccion, telefono) 
VALUES (1, 'Despachos Logistics S.A.', '20123456789', 'Av. Principal 123, Lima', '+51 1 234 5678');

INSERT INTO clientes (nombre, contacto, telefono, email, direccion) VALUES
('Transkrizz', 'Juan Perez', '+51 999 123 456', 'contacto@transkrizz.com', 'Av. Industrial 456, Callao'),
('Tuple S.A.C.', 'Maria Lopez', '+51 988 654 321', 'ventas@tuple.com', 'Jr. Comercio 789, Lima'),
('SunnyCal', 'Carlos Ruiz', '+51 977 111 222', 'logistica@sunnycal.com', 'Calle Solar 321, Arequipa');

INSERT INTO productos (nombre, descripcion, precio, stock) VALUES
('Caja Cartón Pequeña', '30x20x15 cm', 2.50, 500),
('Caja Cartón Mediana', '40x30x20 cm', 3.80, 300),
('Caja Cartón Grande', '60x40x30 cm', 5.50, 200),
('Bolsa Polietileno', '50x70 cm - 50 micras', 0.80, 1000),
('Cinta Adhesiva', '48mm x 100m', 4.20, 150);

INSERT INTO conductores (nombre, licencia, telefono, email, vehiculo_placa, vehiculo_marca, vehiculo_modelo, vehiculo_capacidad_kg, estado) VALUES
('Roberto Sanchez', 'L12345678', '+51 944 555 666', 'roberto@despachos.com', 'ABC-123', 'Toyota', 'Hiace', 1200.00, 'activo'),
('Miguel Torres', 'L87654321', '+51 933 777 888', 'miguel@despachos.com', 'DEF-456', 'Hyundai', 'H100', 950.00, 'activo'),
('Luis Ramirez', 'L11223344', '+51 922 999 000', 'luis@despachos.com', 'GHI-789', 'Ford', 'Transit', 1500.00, 'activo'),
('Carlos Mendez', 'L55667788', '+51 911 333 444', 'carlos@despachos.com', 'JKL-012', 'Chevrolet', 'NHR', 2000.00, 'activo');

INSERT INTO rutas (nombre, origen, destino, distancia_km, tiempo_estimado_horas, estado) VALUES
('Ruta Lima - Callao', 'Lima', 'Callao', 15.5, 0.5, 'activa'),
('Ruta Lima - Arequipa', 'Lima', 'Arequipa', 1010.0, 14.0, 'activa'),
('Ruta Callao - Arequipa', 'Callao', 'Arequipa', 995.0, 13.5, 'activa'),
('Ruta Urbana Lima Norte', 'Lima Norte', 'Lima Centro', 25.0, 1.0, 'activa'),
('Ruta Urbana Lima Sur', 'Lima Sur', 'Lima Centro', 30.0, 1.2, 'activa');