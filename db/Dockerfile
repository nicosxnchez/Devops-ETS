# Imagen base MySQL 8 oficial
FROM mysql:8

# Variables de entorno (se aplicaran automaticamente al iniciar el contenedor)
ENV MYSQL_ROOT_PASSWORD=admin123
ENV MYSQL_DATABASE=despachos_db
ENV MYSQL_USER=alumno
ENV MYSQL_PASSWORD=alumno123

# Copiar el script de inicializacion dentro de la imagen
# Se ejecuta automaticamente la primera vez que se levante el contenedor
COPY init.sql /docker-entrypoint-initdb.d/

# Exponer el puerto de MySQL
EXPOSE 3306