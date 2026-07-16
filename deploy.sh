#!/bin/bash

set -e

REGION="us-east-1"
CLUSTER_NAME="devopseks"

ACCOUNT_ID=$(aws sts get-caller-identity \
  --query Account \
  --output text)

ECR_URL="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "===================================="
echo "Account ID : ${ACCOUNT_ID}"
echo "Cluster    : ${CLUSTER_NAME}"
echo "Region     : ${REGION}"
echo "ECR URL    : ${ECR_URL}"
echo "===================================="

echo ""
echo "Actualizando kubeconfig..."

aws eks update-kubeconfig \
  --region ${REGION} \
  --name ${CLUSTER_NAME}

echo ""
echo "Instalando Metrics Server..."

kubectl apply -f \
https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml


echo "Configurando manifests Kubernetes..."
find ./k8s -type f -name "*.yaml" \
  -exec sed -i "s|{{ECR_URL}}|${ECR_URL}|g" {} \;


echo ""
echo "Login ECR..."

aws ecr get-login-password \
  --region ${REGION} | \
docker login \
  --username AWS \
  --password-stdin ${ECR_URL}

echo ""
echo "Verificando repositorios ECR..."

for REPO in despachos-frontend despachos-backend despachos-db; do
  if ! aws ecr describe-repositories --repository-names "${REPO}" --region ${REGION} >/dev/null 2>&1; then
    echo "Creando repositorio ECR: ${REPO}"
    aws ecr create-repository \
      --repository-name "${REPO}" \
      --region ${REGION} \
      --image-scanning-configuration scanOnPush=true >/dev/null
  else
    echo "Repositorio ya existe: ${REPO}"
  fi
done

####################################################
# FRONTEND
####################################################

echo ""
echo "Build Frontend..."

docker build -t despachos-frontend ./frontend

docker tag \
  despachos-frontend:latest \
  ${ECR_URL}/despachos-frontend:eks-v1

docker push \
  ${ECR_URL}/despachos-frontend:eks-v1

####################################################
# BACKEND
####################################################

echo ""
echo "Build Backend..."

docker build -t despachos-backend ./backend

docker tag \
  despachos-backend:latest \
  ${ECR_URL}/despachos-backend:eks-v1

docker push \
  ${ECR_URL}/despachos-backend:eks-v1

####################################################
# DB
####################################################

echo ""
echo "Build DB..."

docker build -t despachos-db ./db

docker tag \
  despachos-db:latest \
  ${ECR_URL}/despachos-db:eks-v1

docker push \
  ${ECR_URL}/despachos-db:eks-v1

####################################################
# KUBERNETES
####################################################

echo ""
echo "Desplegando Namespace..."

kubectl apply -f ./k8s/namespace.yaml

####################################################
# MYSQL
####################################################

echo ""
echo "Desplegando MySQL..."

kubectl apply -f ./k8s/mysql-secret.yaml
kubectl apply -f ./k8s/mysql-deployment.yaml
kubectl apply -f ./k8s/mysql-service.yaml

echo ""
echo "Esperando que MySQL quede Ready..."

kubectl rollout status \
  deployment/despachos-db \
  -n despachos \
  --timeout=300s

echo ""
echo "Estado actual:"

kubectl get pods -n despachos
kubectl get svc -n despachos

####################################################
# BACKEND
####################################################

echo ""
echo "Desplegando Backend..."

kubectl apply -f ./k8s/backend-deployment.yaml
kubectl apply -f ./k8s/backend-service.yaml

kubectl rollout status \
  deployment/despachos-backend \
  -n despachos \
  --timeout=300s

####################################################
# FRONTEND
####################################################

echo ""
echo "Desplegando Frontend..."

kubectl apply -f ./k8s/frontend-deployment.yaml
kubectl apply -f ./k8s/frontend-service.yaml

kubectl rollout status \
  deployment/despachos-frontend \
  -n despachos \
  --timeout=300s

####################################################
# HPA (Autoescalado)
####################################################

echo ""
echo "Desplegando HPA..."

kubectl apply -f ./k8s/backend-hpa.yaml
kubectl apply -f ./k8s/frontend-hpa.yaml

####################################################
# LOAD BALANCER
####################################################

echo ""
echo "Esperando LoadBalancer..."

for i in {1..40}
do
  HOSTNAME=$(kubectl get svc despachos-frontend \
    -n despachos \
    -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

  IP=$(kubectl get svc despachos-frontend \
    -n despachos \
    -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

  if [ ! -z "$HOSTNAME" ]; then
    echo ""
    echo "===================================="
    echo "APLICACIÓN DISPONIBLE EN:"
    echo "http://${HOSTNAME}"
    echo "===================================="
    exit 0
  fi

  if [ ! -z "$IP" ]; then
    echo ""
    echo "===================================="
    echo "APLICACIÓN DISPONIBLE EN:"
    echo "http://${IP}"
    echo "===================================="
    exit 0
  fi

  echo "Esperando IP pública... (${i}/40)"
  sleep 15
done

echo ""
echo "No fue posible obtener la IP pública."
echo "Verificar manualmente con:"
echo "kubectl get svc despachos-frontend -n despachos"