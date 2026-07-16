const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3001;

const {
  DB_HOST = "tienda-db",
  DB_USER = "root",
  DB_PASSWORD = "admin123",
  DB_NAME = "despachos_db",
  DB_PORT = 3306,
} = process.env;

app.use(cors());
app.use(express.json());

let pool;

async function initDb() {
  try {
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    console.log("Pool de conexiones MySQL inicializado.");
    await createTables();
  } catch (err) {
    console.error("Error al inicializar pool de MySQL:", err);
  }
}

async function createTables() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
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
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        contacto VARCHAR(255),
        telefono VARCHAR(50),
        email VARCHAR(255),
        direccion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS productos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        precio DECIMAL(10,2) NOT NULL,
        stock INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
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
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS pedido_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pedido_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad INT NOT NULL,
        precio_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos(id)
      )
    `);

    await conn.query(`
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
      )
    `);

    await conn.query(`
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
      )
    `);

    await conn.query(`
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
      )
    `);

    await conn.query(`
      INSERT IGNORE INTO empresas (id, nombre, ruc, direccion, telefono) 
      VALUES (1, 'Despachos Logistics S.A.', '20123456789', 'Av. Principal 123, Lima', '+51 1 234 5678')
    `);

    console.log("Tablas creadas/verificadas correctamente.");
  } catch (err) {
    console.error("Error creando tablas:", err);
  } finally {
    conn.release();
  }
}

function handleError(res, error, message = "Error interno del servidor") {
  console.error(error);
  res.status(500).json({ message });
}

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Backend de Despachos Logistics en ejecución."
  });
});

app.get("/api/stats", async (req, res) => {
  try {
    const [[pedidosPendientes]] = await pool.query(
      "SELECT COUNT(*) as count FROM pedidos WHERE estado IN ('pendiente', 'procesando')"
    );
    const [[despachosHoy]] = await pool.query(
      "SELECT COUNT(*) as count FROM despachos WHERE DATE(fecha_salida) = CURDATE()"
    );
    const [[conductoresActivos]] = await pool.query(
      "SELECT COUNT(*) as count FROM conductores WHERE estado = 'activo'"
    );
    const [[rutasActivas]] = await pool.query(
      "SELECT COUNT(*) as count FROM rutas WHERE estado = 'activa'"
    );

    res.json({
      pedidos_pendientes: pedidosPendientes.count,
      despachos_hoy: despachosHoy.count,
      conductores_activos: conductoresActivos.count,
      rutas_activas: rutasActivas.count
    });
  } catch (err) {
    handleError(res, err, "No se pudieron obtener las estadísticas.");
  }
});

// ==================== CLIENTES ====================
app.get("/api/clientes", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM clientes ORDER BY nombre");
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "No se pudieron obtener los clientes.");
  }
});

app.post("/api/clientes", async (req, res) => {
  const { nombre, contacto, telefono, email, direccion } = req.body;
  if (!nombre) return res.status(400).json({ message: "El nombre es obligatorio." });
  try {
    const [result] = await pool.query(
      "INSERT INTO clientes (nombre, contacto, telefono, email, direccion) VALUES (?, ?, ?, ?, ?)",
      [nombre, contacto || null, telefono || null, email || null, direccion || null]
    );
    const [rows] = await pool.query("SELECT * FROM clientes WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, "No se pudo crear el cliente.");
  }
});

// ==================== PRODUCTOS ====================
app.get("/api/productos", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM productos ORDER BY nombre");
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "No se pudieron obtener los productos.");
  }
});

app.post("/api/productos", async (req, res) => {
  const { nombre, descripcion, precio, stock } = req.body;
  if (!nombre || precio == null || stock == null) {
    return res.status(400).json({ message: "Nombre, precio y stock son obligatorios." });
  }
  try {
    const [result] = await pool.query(
      "INSERT INTO productos (nombre, descripcion, precio, stock) VALUES (?, ?, ?, ?)",
      [nombre, descripcion || null, precio, stock]
    );
    const [rows] = await pool.query("SELECT * FROM productos WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, "No se pudo crear el producto.");
  }
});

// ==================== PEDIDOS (Órdenes de Compra) ====================
app.get("/api/pedidos", async (req, res) => {
  try {
    const { limit, sort = 'fecha_creacion', order = 'desc' } = req.query;
    let query = `
      SELECT p.*, c.nombre as cliente_nombre, c.contacto as cliente_contacto
      FROM pedidos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      ORDER BY p.\`${sort}\` ${order.toUpperCase()}
    `;
    if (limit) query += ` LIMIT ${parseInt(limit)}`;
    const [rows] = await pool.query(query);
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "No se pudieron obtener los pedidos.");
  }
});

app.get("/api/pedidos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [[pedido]] = await pool.query(`
      SELECT p.*, c.nombre as cliente_nombre, c.contacto as cliente_contacto, c.telefono as cliente_telefono, c.email as cliente_email, c.direccion as cliente_direccion
      FROM pedidos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE p.id = ?
    `, [id]);
    
    if (!pedido) return res.status(404).json({ message: "Pedido no encontrado." });

    const [items] = await pool.query(`
      SELECT pi.*, pr.nombre as producto_nombre
      FROM pedido_items pi
      LEFT JOIN productos pr ON pi.producto_id = pr.id
      WHERE pi.pedido_id = ?
    `, [id]);

    pedido.items = items;
    res.json(pedido);
  } catch (err) {
    handleError(res, err, "No se pudo obtener el pedido.");
  }
});

app.post("/api/pedidos", async (req, res) => {
  const { cliente_id, fecha_entrega_estimada, observaciones, items } = req.body;
  if (!cliente_id || !items || !items.length) {
    return res.status(400).json({ message: "Cliente e items son obligatorios." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let total = 0;
    for (const item of items) {
      total += item.cantidad * item.precio_unitario;
    }

    const [result] = await conn.query(
      "INSERT INTO pedidos (cliente_id, fecha_entrega_estimada, estado, total, observaciones) VALUES (?, ?, 'pendiente', ?, ?)",
      [cliente_id, fecha_entrega_estimada || null, total, observaciones || null]
    );

    const pedidoId = result.insertId;

    for (const item of items) {
      const subtotal = item.cantidad * item.precio_unitario;
      await conn.query(
        "INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)",
        [pedidoId, item.producto_id, item.cantidad, item.precio_unitario, subtotal]
      );
    }

    await conn.commit();

    const [[pedido]] = await conn.query(`
      SELECT p.*, c.nombre as cliente_nombre
      FROM pedidos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE p.id = ?
    `, [pedidoId]);

    res.status(201).json(pedido);
  } catch (err) {
    await conn.rollback();
    handleError(res, err, "No se pudo crear el pedido.");
  } finally {
    conn.release();
  }
});

app.put("/api/pedidos/:id", async (req, res) => {
  const { id } = req.params;
  const { estado, observaciones, fecha_entrega_estimada } = req.body;

  try {
    const updates = [];
    const params = [];

    if (estado) {
      updates.push("estado = ?");
      params.push(estado);
    }
    if (observaciones !== undefined) {
      updates.push("observaciones = ?");
      params.push(observaciones);
    }
    if (fecha_entrega_estimada) {
      updates.push("fecha_entrega_estimada = ?");
      params.push(fecha_entrega_estimada);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No hay datos para actualizar." });
    }

    params.push(id);
    const [result] = await pool.query(
      `UPDATE pedidos SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Pedido no encontrado." });
    }

    const [[pedido]] = await pool.query(`
      SELECT p.*, c.nombre as cliente_nombre
      FROM pedidos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE p.id = ?
    `, [id]);

    res.json(pedido);
  } catch (err) {
    handleError(res, err, "No se pudo actualizar el pedido.");
  }
});

app.delete("/api/pedidos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM pedidos WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Pedido no encontrado." });
    }
    res.json({ message: "Pedido eliminado correctamente." });
  } catch (err) {
    handleError(res, err, "No se pudo eliminar el pedido.");
  }
});

// ==================== DESPACHOS (Órdenes de Despacho) ====================
app.get("/api/despachos", async (req, res) => {
  try {
    const { limit, sort = 'fecha_salida', order = 'desc' } = req.query;
    let query = `
      SELECT d.*, 
        p.id as pedido_id, p.cliente_id, p.total as pedido_total,
        c.nombre as cliente_nombre,
        co.nombre as conductor_nombre,
        co.licencia as conductor_licencia,
        r.nombre as ruta_nombre
      FROM despachos d
      LEFT JOIN pedidos p ON d.pedido_id = p.id
      LEFT JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN conductores co ON d.conductor_id = co.id
      LEFT JOIN rutas r ON d.ruta_id = r.id
      ORDER BY d.\`${sort}\` ${order.toUpperCase()}
    `;
    if (limit) query += ` LIMIT ${parseInt(limit)}`;
    const [rows] = await pool.query(query);
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "No se pudieron obtener los despachos.");
  }
});

app.get("/api/despachos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [[despacho]] = await pool.query(`
      SELECT d.*, 
        p.id as pedido_id, p.cliente_id, p.total as pedido_total, p.observaciones as pedido_observaciones,
        c.nombre as cliente_nombre, c.contacto as cliente_contacto, c.telefono as cliente_telefono, c.direccion as cliente_direccion,
        co.nombre as conductor_nombre, co.licencia as conductor_licencia, co.telefono as conductor_telefono,
        co.vehiculo_placa, co.vehiculo_marca, co.vehiculo_modelo, co.vehiculo_capacidad_kg,
        r.nombre as ruta_nombre, r.origen, r.destino, r.distancia_km, r.tiempo_estimado_horas
      FROM despachos d
      LEFT JOIN pedidos p ON d.pedido_id = p.id
      LEFT JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN conductores co ON d.conductor_id = co.id
      LEFT JOIN rutas r ON d.ruta_id = r.id
      WHERE d.id = ?
    `, [id]);

    if (!despacho) return res.status(404).json({ message: "Despacho no encontrado." });

    const [items] = await pool.query(`
      SELECT pi.*, pr.nombre as producto_nombre
      FROM pedido_items pi
      LEFT JOIN productos pr ON pi.producto_id = pr.id
      WHERE pi.pedido_id = ?
    `, [despacho.pedido_id]);

    despacho.items = items;
    res.json(despacho);
  } catch (err) {
    handleError(res, err, "No se pudo obtener el despacho.");
  }
});

app.post("/api/despachos", async (req, res) => {
  const { pedido_id, conductor_id, ruta_id, vehiculo_placa, fecha_salida, fecha_llegada_estimada, observaciones, interno_encargado, dueno_union } = req.body;
  
  if (!pedido_id) {
    return res.status(400).json({ message: "El pedido es obligatorio." });
  }

  try {
    const [[pedido]] = await pool.query("SELECT * FROM pedidos WHERE id = ?", [pedido_id]);
    if (!pedido) return res.status(404).json({ message: "Pedido no encontrado." });
    if (pedido.estado === 'cancelado') return res.status(400).json({ message: "No se puede despachar un pedido cancelado." });

    const [result] = await pool.query(
      `INSERT INTO despachos (pedido_id, conductor_id, ruta_id, vehiculo_placa, fecha_salida, fecha_llegada_estimada, estado, observaciones, interno_encargado, dueno_union)
       VALUES (?, ?, ?, ?, ?, ?, 'programado', ?, ?, ?)`,
      [pedido_id, conductor_id || null, ruta_id || null, vehiculo_placa || null, fecha_salida || null, fecha_llegada_estimada || null, observaciones || null, interno_encargado || null, dueno_union || null]
    );

    await pool.query("UPDATE pedidos SET estado = 'despachado' WHERE id = ?", [pedido_id]);

    const [[despacho]] = await pool.query(`
      SELECT d.*, c.nombre as conductor_nombre, r.nombre as ruta_nombre
      FROM despachos d
      LEFT JOIN conductores c ON d.conductor_id = c.id
      LEFT JOIN rutas r ON d.ruta_id = r.id
      WHERE d.id = ?
    `, [result.insertId]);

    res.status(201).json(despacho);
  } catch (err) {
    handleError(res, err, "No se pudo crear el despacho.");
  }
});

app.put("/api/despachos/:id", async (req, res) => {
  const { id } = req.params;
  const { conductor_id, ruta_id, vehiculo_placa, fecha_salida, fecha_llegada_estimada, estado, observaciones, interno_encargado, dueno_union, fecha_entrega_real } = req.body;

  try {
    const updates = [];
    const params = [];

    const fields = {
      conductor_id, ruta_id, vehiculo_placa, fecha_salida, fecha_llegada_estimada,
      estado, observaciones, interno_encargado, dueno_union, fecha_entrega_real
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No hay datos para actualizar." });
    }

    params.push(id);
    const [result] = await pool.query(
      `UPDATE despachos SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Despacho no encontrado." });
    }

    if (estado === 'entregado') {
      const [[despacho]] = await pool.query("SELECT pedido_id FROM despachos WHERE id = ?", [id]);
      if (despacho) {
        await pool.query("UPDATE pedidos SET estado = 'entregado' WHERE id = ?", [despacho.pedido_id]);
      }
    } else if (estado === 'en_ruta') {
      const [[despacho]] = await pool.query("SELECT pedido_id FROM despachos WHERE id = ?", [id]);
      if (despacho) {
        await pool.query("UPDATE pedidos SET estado = 'procesando' WHERE id = ?", [despacho.pedido_id]);
      }
    }

    const [[despacho]] = await pool.query(`
      SELECT d.*, co.nombre as conductor_nombre, r.nombre as ruta_nombre
      FROM despachos d
      LEFT JOIN conductores co ON d.conductor_id = co.id
      LEFT JOIN rutas r ON d.ruta_id = r.id
      WHERE d.id = ?
    `, [id]);

    res.json(despacho);
  } catch (err) {
    handleError(res, err, "No se pudo actualizar el despacho.");
  }
});

app.delete("/api/despachos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [[despacho]] = await pool.query("SELECT pedido_id FROM despachos WHERE id = ?", [id]);
    const [result] = await pool.query("DELETE FROM despachos WHERE id = ?", [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Despacho no encontrado." });
    }

    if (despacho) {
      const [[otherDespachos]] = await pool.query("SELECT COUNT(*) as count FROM despachos WHERE pedido_id = ?", [despacho.pedido_id]);
      if (otherDespachos.count === 0) {
        await pool.query("UPDATE pedidos SET estado = 'pendiente' WHERE id = ?", [despacho.pedido_id]);
      }
    }

    res.json({ message: "Despacho eliminado correctamente." });
  } catch (err) {
    handleError(res, err, "No se pudo eliminar el despacho.");
  }
});

// ==================== CONDUCTORES ====================
app.get("/api/conductores", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM conductores ORDER BY nombre");
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "No se pudieron obtener los conductores.");
  }
});

app.get("/api/conductores/:id", async (req, res) => {
  try {
    const [[conductor]] = await pool.query("SELECT * FROM conductores WHERE id = ?", [req.params.id]);
    if (!conductor) return res.status(404).json({ message: "Conductor no encontrado." });
    res.json(conductor);
  } catch (err) {
    handleError(res, err, "No se pudo obtener el conductor.");
  }
});

app.post("/api/conductores", async (req, res) => {
  const { nombre, licencia, telefono, email, vehiculo_placa, vehiculo_marca, vehiculo_modelo, vehiculo_capacidad_kg, estado } = req.body;
  
  if (!nombre || !licencia) {
    return res.status(400).json({ message: "Nombre y licencia son obligatorios." });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO conductores (nombre, licencia, telefono, email, vehiculo_placa, vehiculo_marca, vehiculo_modelo, vehiculo_capacidad_kg, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, licencia, telefono || null, email || null, vehiculo_placa || null, vehiculo_marca || null, vehiculo_modelo || null, vehiculo_capacidad_kg || null, estado || 'activo']
    );
    
    const [[conductor]] = await pool.query("SELECT * FROM conductores WHERE id = ?", [result.insertId]);
    res.status(201).json(conductor);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: "La licencia ya existe." });
    }
    handleError(res, err, "No se pudo crear el conductor.");
  }
});

app.put("/api/conductores/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, licencia, telefono, email, vehiculo_placa, vehiculo_marca, vehiculo_modelo, vehiculo_capacidad_kg, estado } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE conductores SET 
        nombre = ?, licencia = ?, telefono = ?, email = ?, 
        vehiculo_placa = ?, vehiculo_marca = ?, vehiculo_modelo = ?, vehiculo_capacidad_kg = ?, estado = ?
       WHERE id = ?`,
      [nombre, licencia, telefono || null, email || null, vehiculo_placa || null, vehiculo_marca || null, vehiculo_modelo || null, vehiculo_capacidad_kg || null, estado || 'activo', id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Conductor no encontrado." });
    }

    const [[conductor]] = await pool.query("SELECT * FROM conductores WHERE id = ?", [id]);
    res.json(conductor);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: "La licencia ya existe." });
    }
    handleError(res, err, "No se pudo actualizar el conductor.");
  }
});

app.delete("/api/conductores/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM conductores WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Conductor no encontrado." });
    }
    res.json({ message: "Conductor eliminado correctamente." });
  } catch (err) {
    handleError(res, err, "No se pudo eliminar el conductor.");
  }
});

// ==================== RUTAS ====================
app.get("/api/rutas", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM rutas ORDER BY nombre");
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "No se pudieron obtener las rutas.");
  }
});

app.get("/api/rutas/:id", async (req, res) => {
  try {
    const [[ruta]] = await pool.query("SELECT * FROM rutas WHERE id = ?", [req.params.id]);
    if (!ruta) return res.status(404).json({ message: "Ruta no encontrada." });
    res.json(ruta);
  } catch (err) {
    handleError(res, err, "No se pudo obtener la ruta.");
  }
});

app.post("/api/rutas", async (req, res) => {
  const { nombre, origen, destino, distancia_km, tiempo_estimado_horas, estado } = req.body;
  
  if (!nombre || !origen || !destino) {
    return res.status(400).json({ message: "Nombre, origen y destino son obligatorios." });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO rutas (nombre, origen, destino, distancia_km, tiempo_estimado_horas, estado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, origen, destino, distancia_km || null, tiempo_estimado_horas || null, estado || 'activa']
    );
    
    const [[ruta]] = await pool.query("SELECT * FROM rutas WHERE id = ?", [result.insertId]);
    res.status(201).json(ruta);
  } catch (err) {
    handleError(res, err, "No se pudo crear la ruta.");
  }
});

app.put("/api/rutas/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, origen, destino, distancia_km, tiempo_estimado_horas, estado } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE rutas SET nombre = ?, origen = ?, destino = ?, distancia_km = ?, tiempo_estimado_horas = ?, estado = ? WHERE id = ?`,
      [nombre, origen, destino, distancia_km || null, tiempo_estimado_horas || null, estado || 'activa', id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Ruta no encontrada." });
    }

    const [[ruta]] = await pool.query("SELECT * FROM rutas WHERE id = ?", [id]);
    res.json(ruta);
  } catch (err) {
    handleError(res, err, "No se pudo actualizar la ruta.");
  }
});

app.delete("/api/rutas/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM rutas WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Ruta no encontrada." });
    }
    res.json({ message: "Ruta eliminada correctamente." });
  } catch (err) {
    handleError(res, err, "No se pudo eliminar la ruta.");
  }
});

// ==================== CONFIGURACIÓN ====================
app.get("/api/config", async (req, res) => {
  try {
    const [[config]] = await pool.query("SELECT * FROM empresas WHERE id = 1");
    res.json(config || {});
  } catch (err) {
    handleError(res, err, "No se pudo obtener la configuración.");
  }
});

app.put("/api/config", async (req, res) => {
  const { nombre, ruc, direccion, telefono, tiempo_maximo_entrega, notificaciones_automaticas } = req.body;

  try {
    await pool.query(
      `UPDATE empresas SET 
        nombre = ?, ruc = ?, direccion = ?, telefono = ?, 
        tiempo_maximo_entrega = ?, notificaciones_automaticas = ?
       WHERE id = 1`,
      [nombre, ruc, direccion, telefono, tiempo_maximo_entrega, notificaciones_automaticas]
    );
    
    const [[config]] = await pool.query("SELECT * FROM empresas WHERE id = 1");
    res.json(config);
  } catch (err) {
    handleError(res, err, "No se pudo actualizar la configuración.");
  }
});

app.listen(PORT, async () => {
  console.log(`Servidor backend escuchando en puerto ${PORT}`);
  await initDb();
});