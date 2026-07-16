Despliegue Despachos Logistics en EKS (namespace 'despachos')

1) Configurar kubectl contra tu cluster:
   aws eks update-kubeconfig --region us-east-1 --name <NOMBRE_TU_CLUSTER>

2) Aplicar namespace:
   kubectl apply -f namespace.yaml

3) Aplicar recursos de base de datos:
   kubectl apply -f mysql-secret.yaml
   kubectl apply -f mysql-deployment.yaml
   kubectl apply -f mysql-service.yaml

4) Aplicar backend:
   kubectl apply -f backend-deployment.yaml
   kubectl apply -f backend-service.yaml

5) Aplicar frontend:
   kubectl apply -f frontend-deployment.yaml
   kubectl apply -f frontend-service.yaml

6) Aplicar HPA (Autoescalado):
   kubectl apply -f backend-hpa.yaml
   kubectl apply -f frontend-hpa.yaml

7) Verificar:
   kubectl get pods -n despachos
   kubectl get svc despachos-frontend -n despachos

Copias el EXTERNAL-IP (DNS del ELB) -> lo abres en el navegador
-> deberías ver el Dashboard de Despachos Logistics 🚚

Nota: Si te da error, y sale el pod con estado Pending (valida correctamente la configuración de la Actividad 1 - paso 4).