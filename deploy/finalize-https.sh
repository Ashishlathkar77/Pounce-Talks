#!/usr/bin/env bash
# Finish HTTPS for pounce-api.hemut.com once the ACM cert has validated.
#
# Prereq (you, in Cloudflare):
#   1. Add the ACM DNS-validation CNAME (printed when the cert was requested),
#      as DNS-only (grey cloud).
#   2. Add the app record:  pounce-api.hemut.com  CNAME  <ALB DNS below>
#      Proxied (orange) is fine with SSL/TLS mode "Full (strict)" since the ALB
#      now serves a valid ACM cert.
#
# Then run:  bash deploy/finalize-https.sh
set -euo pipefail

REGION=us-east-2
ALB_ARN="arn:aws:elasticloadbalancing:us-east-2:869935092934:loadbalancer/app/pounce-backend-alb/ccfc428098220f2c"
TG_ARN="arn:aws:elasticloadbalancing:us-east-2:869935092934:targetgroup/pounce-backend-tg/7b618171a7252f30"
CERT_ARN="arn:aws:acm:us-east-2:869935092934:certificate/f6fa8098-af13-4e6f-a4f0-c33c87bfa030"
ALB_SG="sg-07b14724c29d37ae3"
ALB_DNS="pounce-backend-alb-1587866154.us-east-2.elb.amazonaws.com"
DOMAIN="pounce-api.hemut.com"

echo "ALB DNS (point Cloudflare CNAME here): $ALB_DNS"

status=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region "$REGION" \
          --query 'Certificate.Status' --output text)
if [ "$status" != "ISSUED" ]; then
  echo "Cert status is $status (need ISSUED). Add the Cloudflare validation CNAME first."
  exit 1
fi

# Allow 443 inbound to the ALB.
aws ec2 authorize-security-group-ingress --group-id "$ALB_SG" \
  --protocol tcp --port 443 --cidr 0.0.0.0/0 --region "$REGION" 2>/dev/null \
  && echo "opened :443 on ALB SG" || echo ":443 ingress already present"

# HTTPS listener -> target group.
aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" \
  --protocol HTTPS --port 443 \
  --certificates CertificateArn="$CERT_ARN" \
  --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06 \
  --default-actions Type=forward,TargetGroupArn="$TG_ARN" \
  --region "$REGION" --query 'Listeners[0].ListenerArn' --output text \
  && echo "created :443 listener" || echo ":443 listener may already exist"

# Redirect :80 -> :443.
HTTP_LISTENER=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
  --region "$REGION" --query "Listeners[?Port==\`80\`].ListenerArn" --output text)
aws elbv2 modify-listener --listener-arn "$HTTP_LISTENER" \
  --default-actions '[{"Type":"redirect","RedirectConfig":{"Protocol":"HTTPS","Port":"443","StatusCode":"HTTP_301"}}]' \
  --region "$REGION" >/dev/null && echo "redirected :80 -> :443"

# Point the backend at the domain and redeploy so the worker posts to it.
TMP=$(mktemp)
aws secretsmanager get-secret-value --secret-id Pounce-Prod-Env --region "$REGION" \
  --query SecretString --output text \
  | jq --arg u "https://$DOMAIN" '.WEBHOOK_BASE_URL=$u' > "$TMP"
aws secretsmanager put-secret-value --secret-id Pounce-Prod-Env \
  --secret-string "file://$TMP" --region "$REGION" --query Name --output text
rm -f "$TMP"
echo "secret WEBHOOK_BASE_URL -> https://$DOMAIN"

aws ecs update-service --cluster pounce-ecs --service pounce-backend-service \
  --force-new-deployment --region "$REGION" --query 'service.serviceName' --output text
aws ecs update-service --cluster pounce-ecs --service pounce-livekit-worker \
  --force-new-deployment --region "$REGION" --query 'service.serviceName' --output text

echo "✅ HTTPS live at https://$DOMAIN once Cloudflare DNS propagates."
