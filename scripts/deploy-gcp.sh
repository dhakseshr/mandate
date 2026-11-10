#!/usr/bin/env bash
# Build and deploy Writ to Google Cloud Run (Cloud SQL Postgres + Vertex AI Gemini).
# One-time setup (already done for writ-hackathon-1110) is described in README → "Deploying to Google Cloud".
# Usage: scripts/deploy-gcp.sh            (reads NEXT_PUBLIC_PAYPAL_CLIENT_ID from .env; never prints secrets)
set -euo pipefail
PROJECT="${PROJECT:-writ-hackathon-1110}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-writ}"
IMG="${REGION}-docker.pkg.dev/${PROJECT}/writ/web:$(git rev-parse --short HEAD)-$(date +%s)"
CID="$(grep -E '^NEXT_PUBLIC_PAYPAL_CLIENT_ID=' .env | cut -d= -f2- | sed 's/[[:space:]]*#.*$//;s/[[:space:]]*$//')"

docker build -q --build-arg NEXT_PUBLIC_PAYPAL_CLIENT_ID="${CID}" -t "${IMG}" .
docker push -q "${IMG}"
# One instance, always on: Writ's per-tree money lock and background agent loops live in-process.
gcloud run deploy "${SERVICE}" --project "${PROJECT}" --region "${REGION}" --image "${IMG}" \
  --service-account "writ-run@${PROJECT}.iam.gserviceaccount.com" \
  --add-cloudsql-instances "${PROJECT}:${REGION}:writ-db" --allow-unauthenticated \
  --min-instances 1 --max-instances 1 --no-cpu-throttling --cpu 1 --memory 1Gi --timeout 3600 \
  --update-env-vars "PAYPAL_ENV=sandbox,AI_PROVIDER=vertex,GOOGLE_VERTEX_PROJECT=${PROJECT},GOOGLE_VERTEX_LOCATION=global,VERTEX_MODEL=gemini-3-flash-preview,NEXT_PUBLIC_PAYPAL_CLIENT_ID=${CID}" \
  --update-secrets "DATABASE_URL=DATABASE_URL:latest,MANDATE_SIGNING_KEY=MANDATE_SIGNING_KEY:latest,PAYPAL_CLIENT_ID=PAYPAL_CLIENT_ID:latest,PAYPAL_CLIENT_SECRET=PAYPAL_CLIENT_SECRET:latest,CHANNEL3_API_KEY=CHANNEL3_API_KEY:latest,PAYPAL_WEBHOOK_ID=PAYPAL_WEBHOOK_ID:latest" \
  --quiet
