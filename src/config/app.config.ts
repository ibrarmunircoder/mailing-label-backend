import { registerAs } from '@nestjs/config';

export const applicationConfig = registerAs('application', () => ({
  database: {
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    databaseName: process.env.DATABASE_NAME,
  },
  jwt: {
    access: {
      secret: process.env.JWT_SECRETE,
      expiresIn: process.env.JWT_ACCESS_TTL,
    },
  },
  usps: {
    mailingLabel: process.env.MAILING_LABEL_ENDPOINT,
    trackingLabelEndpoint: process.env.TRACKING_LABEL_ENDPOINT,
    username: process.env.USPS_USERNAME,
    password: process.env.USPS_PASSWORD,
  },
  sendGridApiKey: process.env.SENDGRID_API_KEY,
  senderEmail: `${process.env.SENDER_NAME} <${process.env.SENDER_EMAIL}>`,
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
  },
  shopify: {
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET_KEY,
  },
  basicAuth: {
    password: process.env.BASIC_AUTH_PASSWORD,
  },
}));
