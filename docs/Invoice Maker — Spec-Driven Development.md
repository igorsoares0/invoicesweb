# Invoice Maker — Spec-Driven Development

> **Decisões de implementação:** onde o código se afasta desta spec ou vai além dela, o registro está em [`decisions.md`](decisions.md). Em caso de conflito, `decisions.md` prevalece.

## 1. Visão do Produto

Invoice Maker é um SaaS de criação e gerenciamento de invoices e estimates voltado principalmente para:

- freelancers;
- profissionais autônomos;
- prestadores de serviços;
- pequenos negócios.

O produto terá inicialmente uma aplicação Web e posteriormente aplicativos mobile para:

- Android;
- iOS.

O principal objetivo do produto é permitir que um usuário:

> Crie um invoice profissional, gere o PDF e envie ao cliente em poucos minutos.

A aplicação deve priorizar simplicidade, velocidade e facilidade de uso.

---

# 2. Objetivos

## 2.1 Objetivos principais

- Criar invoices rapidamente.
- Gerenciar clientes.
- Gerenciar produtos/serviços.
- Criar estimates.
- Converter estimates em invoices.
- Gerar PDFs profissionais.
- Compartilhar invoices através de links públicos.
- Enviar invoices por email.
- Gerenciar status e pagamentos.
- Oferecer sincronização entre Web e Mobile.
- Possuir uma arquitetura API-first.
- Permitir monetização via Web, iOS e Android.

## 2.2 Não objetivos do MVP

Não implementar inicialmente:

- contabilidade completa;
- emissão fiscal específica de um país;
- integração bancária;
- reconciliação financeira;
- despesas avançadas;
- assinatura digital;
- pagamentos online;
- WhatsApp;
- SMS;
- IA;
- OCR;
- múltiplas organizações/equipes;
- RBAC complexo;
- recurring invoices;
- relatórios avançados.

Essas funcionalidades podem ser adicionadas posteriormente.

---

# 3. Stack

## Web

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

## Backend

- Next.js
- REST API
- API versionada
- Prisma
- Neon PostgreSQL

## Authentication

- Auth.js
- Google Login
- Email + Password

## Billing

### Web

- Paddle

### Mobile

- RevenueCat
- Apple App Store
- Google Play Billing

## Email

- Resend

## Infrastructure

- Hetzner
- Docker
- Reverse proxy

## Mobile — futuro

- Flutter
- Android
- iOS

---

# 4. Princípio Arquitetural

O produto deve ser desenvolvido como **API-first**.

O Next.js Web é apenas o primeiro cliente da API.

Arquitetura:

```text
                     ┌─────────────────┐
                     │    Next.js Web  │
                     └────────┬────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │    REST API     │
                     │    /api/v1      │
                     └────────┬────────┘
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
           Neon            Resend           Billing
         PostgreSQL                          System
                             
                              ▲
                              │
                     ┌────────┴────────┐
                     │     Flutter     │
                     │   iOS/Android   │
                     └─────────────────┘
```

Toda regra importante de negócio deve existir no backend.

O frontend não deve duplicar regras de negócio críticas.

---

# 5. Arquitetura de Usuários

O MVP não terá múltiplas organizações.

O modelo será:

```text
User
 │
 └── Business
      ├── Clients
      ├── Products
      ├── Invoices
      ├── Estimates
      └── Payments
```

Um usuário possui uma empresa/business.

A arquitetura deve, entretanto, utilizar `Business` como entidade pai dos recursos comerciais para permitir evolução futura.

Não implementar inicialmente:

- BusinessMember;
- roles;
- invitations;
- equipes;
- múltiplas organizações.

---

# 6. Modelo de Dados

## User

Responsável pela identidade e autenticação.

```text
User
- id
- name
- email
- image
- createdAt
- updatedAt
```

Auth.js será responsável pela autenticação.

---

## Business

Informações da empresa/profissional.

```text
Business
- id
- userId
- name
- email
- phone
- website
- logoUrl
- taxId
- address
- city
- state
- country
- postalCode
- defaultCurrency
- defaultLanguage
- invoicePrefix
- invoiceNextNumber
- createdAt
- updatedAt
```

---

## Client

Cliente que recebe invoices/estimates.

```text
Client
- id
- businessId
- name
- email
- phone
- company
- taxId
- address
- city
- state
- country
- postalCode
- notes
- createdAt
- updatedAt
```

---

## Product

Produto ou serviço vendido.

```text
Product
- id
- businessId
- name
- description
- unit
- unitPrice
- taxRate
- createdAt
- updatedAt
```

---

# 7. Invoice

Invoice é o principal recurso do produto.

```text
Invoice
- id
- businessId
- clientId
- number
- status
- issueDate
- dueDate
- currency
- subtotal
- discount
- tax
- total
- amountPaid
- amountDue
- notes
- terms
- template
- color
- publicToken
- createdAt
- updatedAt
```

## Status

```text
DRAFT
SENT
VIEWED
PARTIALLY_PAID
PAID
OVERDUE
CANCELLED
```

---

# 8. InvoiceItem

```text
InvoiceItem
- id
- invoiceId
- description
- quantity
- unitPrice
- discount
- taxRate
- subtotal
- total
- position
```

Os valores calculados devem ser persistidos no banco.

Isso garante que alterações futuras nos produtos não alterem invoices históricos.

Exemplo:

```text
Product price today: $120

Old Invoice:
unitPrice = $80
```

O invoice antigo continua com `$80`.

---

# 9. Estimate

Estimates representam propostas/orçamentos.

```text
Estimate
- id
- businessId
- clientId
- number
- status
- issueDate
- expiryDate
- currency
- subtotal
- discount
- tax
- total
- notes
- terms
- template
- color
- publicToken
- createdAt
- updatedAt
```

## Status

```text
DRAFT
SENT
VIEWED
ACCEPTED
DECLINED
EXPIRED
CONVERTED
```

---

# 10. EstimateItem

```text
EstimateItem
- id
- estimateId
- description
- quantity
- unitPrice
- discount
- taxRate
- subtotal
- total
- position
```

---

# 11. Payment

O MVP não terá processamento de pagamentos online.

Entretanto, o sistema deve permitir registrar pagamentos manualmente.

```text
Payment
- id
- invoiceId
- amount
- currency
- paymentDate
- method
- reference
- notes
- createdAt
```

Exemplos de método:

```text
CASH
BANK_TRANSFER
CARD
PAYPAL
OTHER
```

Quando um pagamento é registrado:

```text
amountPaid += payment.amount
```

E o status deve ser recalculado.

Exemplo:

```text
total = $1000
amountPaid = $500

status = PARTIALLY_PAID
```

Quando:

```text
amountPaid = $1000
```

então:

```text
status = PAID
```

---

# 12. Invoice Events

Registrar eventos importantes do invoice.

```text
InvoiceEvent
- id
- invoiceId
- type
- metadata
- createdAt
```

Exemplos:

```text
CREATED
UPDATED
SENT
VIEWED
PAYMENT_ADDED
MARKED_PAID
CANCELLED
```

Isso permite futuramente construir histórico/auditoria.

---

# 13. Email Log

```text
EmailLog
- id
- businessId
- invoiceId
- estimateId
- recipient
- type
- status
- providerId
- sentAt
- createdAt
```

Tipos:

```text
INVOICE
ESTIMATE
REMINDER
```

---

# 14. Subscription

Billing deve ser associado ao usuário.

```text
Subscription
- id
- userId
- plan
- status
- provider
- providerCustomerId
- providerSubscriptionId
- revenueCatAppUserId
- currentPeriodStart
- currentPeriodEnd
- cancelAtPeriodEnd
- createdAt
- updatedAt
```

## Plans

Inicialmente:

```text
FREE
PRO
```

Pode existir também:

```text
LIFETIME
```

caso seja oferecido um LTD.

## Providers

```text
PADDLE
APPLE
GOOGLE
```

O plano representa o acesso ao produto, e não o método de pagamento.

Não criar:

```text
APPLE_PRO
GOOGLE_PRO
PADDLE_PRO
```

Criar apenas:

```text
PRO
```

---

# 15. Billing e Entitlements

O conceito central é:

> O usuário possui um entitlement/plano, independentemente de onde realizou a compra.

Exemplo:

```text
User
 ↓
PRO
```

Pode ter sido adquirido através de:

```text
Paddle
Apple
Google
```

O resultado é sempre:

```text
PRO = ACTIVE
```

---

# 16. Billing Web

No Web:

```text
Next.js
   ↓
Paddle Checkout
   ↓
Paddle
   ↓
Webhook
   ↓
Backend
   ↓
Subscription
```

O backend deve processar os webhooks do Paddle.

Eventos relevantes devem atualizar:

```text
Subscription.status
Subscription.plan
Subscription.currentPeriodStart
Subscription.currentPeriodEnd
Subscription.cancelAtPeriodEnd
```

Não confiar apenas no frontend para determinar se o usuário é PRO.

---

# 17. Billing Mobile

Os aplicativos Flutter utilizarão:

- RevenueCat;
- Apple App Store;
- Google Play Billing.

Arquitetura:

```text
Flutter
   │
   ▼
RevenueCat
   │
   ├── Apple
   │
   └── Google
```

RevenueCat será utilizado para unificar os produtos e entitlements mobile.

---

# 18. Identidade Universal

O mesmo usuário deve ser reconhecido em:

```text
Web
iOS
Android
```

O `User.id` do backend deve ser utilizado como identidade principal.

RevenueCat deve utilizar o mesmo identificador como `appUserID`.

Exemplo:

```text
User.id = usr_123
```

RevenueCat:

```text
appUserID = usr_123
```

Isso permite:

```text
Web subscription
      ↓
PRO
      ↓
Mobile

Mobile subscription
      ↓
PRO
      ↓
Web
```

---

# 19. Fluxo de compra via Web

```text
User
 ↓
Next.js
 ↓
Paddle Checkout
 ↓
Payment
 ↓
Paddle Webhook
 ↓
API
 ↓
Subscription = PRO / ACTIVE
```

---

# 20. Fluxo de compra via Mobile

```text
User
 ↓
Flutter
 ↓
RevenueCat
 ↓
Apple / Google
 ↓
RevenueCat entitlement
 ↓
RevenueCat webhook
 ↓
API
 ↓
Subscription = PRO / ACTIVE
```

---

# 21. Acesso às funcionalidades

O backend deve ser a autoridade para acesso às funcionalidades protegidas.

Exemplo:

```text
POST /api/v1/invoices
```

Fluxo:

```text
Authenticate user
        ↓
Load subscription
        ↓
Check entitlement
        ↓
Check usage limits
        ↓
Execute action
```

O Flutter e o Web podem utilizar RevenueCat/estado local para atualizar a interface, mas nunca devem ser a única camada de autorização.

---

# 22. Auth.js

Auth.js será utilizado no Web para:

- Google Login;
- Email + Password;
- gerenciamento de sessão.

A sessão Web utiliza cookies.

O Flutter não deve depender diretamente da sessão baseada em cookies do Auth.js.

Para mobile, a API deverá fornecer uma estratégia baseada em tokens.

Arquitetura:

```text
Web
 ↓
Auth.js
 ↓
Session
 ↓
API
```

Mobile:

```text
Flutter
 ↓
Mobile Authentication
 ↓
Access Token
 ↓
API
```

Ambos apontam para o mesmo:

```text
User
```

---

# 23. API

A API será versionada.

Base:

```text
/api/v1
```

## Me

```http
GET /api/v1/me
```

Retorna:

- user;
- business;
- subscription;
- permissions/features relevantes.

---

# 24. Business API

```http
GET   /api/v1/business
PATCH /api/v1/business
```

---

# 25. Client API

```http
GET    /api/v1/clients
POST   /api/v1/clients

GET    /api/v1/clients/:id
PATCH  /api/v1/clients/:id
DELETE /api/v1/clients/:id
```

Suportar:

- pagination;
- search;
- sorting.

---

# 26. Product API

```http
GET    /api/v1/products
POST   /api/v1/products

GET    /api/v1/products/:id
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id
```

---

# 27. Invoice API

```http
GET    /api/v1/invoices
POST   /api/v1/invoices

GET    /api/v1/invoices/:id
PATCH  /api/v1/invoices/:id
DELETE /api/v1/invoices/:id
```

Actions:

```http
POST /api/v1/invoices/:id/send
POST /api/v1/invoices/:id/duplicate
POST /api/v1/invoices/:id/mark-paid
POST /api/v1/invoices/:id/cancel
POST /api/v1/invoices/:id/pdf
```

---

# 28. Payment API

```http
GET  /api/v1/invoices/:id/payments
POST /api/v1/invoices/:id/payments
```

---

# 29. Estimate API

```http
GET    /api/v1/estimates
POST   /api/v1/estimates

GET    /api/v1/estimates/:id
PATCH  /api/v1/estimates/:id
DELETE /api/v1/estimates/:id
```

Actions:

```http
POST /api/v1/estimates/:id/send
POST /api/v1/estimates/:id/accept
POST /api/v1/estimates/:id/decline
POST /api/v1/estimates/:id/convert
POST /api/v1/estimates/:id/pdf
```

---

# 30. Public Documents

Invoices e estimates devem possuir links públicos.

Invoice:

```text
/i/{publicToken}
```

Estimate:

```text
/e/{publicToken}
```

O cliente não precisa possuir conta.

A página pública deve permitir:

- visualizar documento;
- visualizar informações da empresa;
- visualizar valores;
- visualizar vencimento;
- baixar PDF.

Futuramente:

- aceitar estimate;
- pagamento online.

---

# 31. PDF

PDFs devem ser gerados no backend.

Fluxo:

```text
Invoice
   ↓
InvoiceService
   ↓
Template Renderer
   ↓
PDF Generator
   ↓
PDF
```

O PDF deve utilizar os dados persistidos do invoice.

Não depender do frontend para geração do documento oficial.

Os mesmos PDFs devem poder ser utilizados por:

- Web;
- Flutter;
- Email;
- Public invoice.

---

# 32. Templates

O MVP deve oferecer aproximadamente 5 templates.

Exemplo:

```text
MODERN
CLASSIC
MINIMAL
PROFESSIONAL
BOLD
```

Cada invoice deve armazenar:

```text
template
color
```

Também suportar:

- logo;
- dados da empresa;
- dados do cliente;
- itens;
- subtotal;
- desconto;
- impostos;
- total;
- notas;
- termos.

Não implementar editor visual complexo no MVP.

---

# 33. Invoice Numbering

Cada Business deve possuir:

```text
invoicePrefix
invoiceNextNumber
```

Exemplo:

```text
INV-0001
INV-0002
INV-0003
```

O número deve ser gerado no backend.

Nunca confiar em geração no frontend.

Estimates podem utilizar uma sequência própria.

---

# 34. Cálculos Financeiros

Todos os cálculos financeiros devem ocorrer no backend.

Exemplo:

```text
item subtotal =
quantity × unitPrice

invoice subtotal =
sum(items)

discount =
calculated discount

tax =
calculated tax

total =
subtotal - discount + tax
```

Utilizar tipos numéricos apropriados para valores monetários.

Evitar cálculos financeiros críticos utilizando `float`.

---

# 35. Invoice Service

Criar camada de serviços.

Estrutura:

```text
server/
└── services/
    ├── InvoiceService
    ├── EstimateService
    ├── ClientService
    ├── ProductService
    ├── PaymentService
    ├── PdfService
    ├── EmailService
    └── BillingService
```

Os Route Handlers devem ser finos.

Exemplo:

```text
POST /api/v1/invoices
        ↓
InvoiceService.create()
        ↓
validate
        ↓
calculate
        ↓
persist
        ↓
return invoice
```

---

# 36. Repository/Data Access

Acesso ao banco deve ficar separado da lógica de negócio quando isso melhorar a organização.

Exemplo:

```text
server/
├── repositories/
│   ├── InvoiceRepository
│   ├── ClientRepository
│   └── ProductRepository
│
└── services/
    ├── InvoiceService
    ├── ClientService
    └── ProductService
```

---

# 37. Validação

Todas as entradas da API devem ser validadas.

Utilizar schemas tipados.

Validar:

- IDs;
- datas;
- emails;
- valores;
- quantities;
- currency;
- status transitions;
- limites do plano.

Nunca confiar nos dados enviados pelo cliente.

---

# 38. Authorization

Cada recurso deve ser validado contra o usuário autenticado.

Exemplo:

```text
Current User
     ↓
Business
     ↓
Invoice.businessId
```

Nunca permitir:

```text
User A
  ↓
Invoice pertencente ao Business B
```

Mesmo que o usuário descubra o ID do invoice.

---

# 39. Email

Resend será utilizado para:

- enviar invoice;
- enviar estimate;
- futuramente reminders.

Fluxo:

```text
User
 ↓
Send Invoice
 ↓
API
 ↓
Generate/resolve PDF
 ↓
Resend
 ↓
Client
```

Email deve conter:

- nome da empresa;
- número do invoice;
- valor;
- vencimento;
- botão para visualizar;
- PDF quando aplicável.

---

# 40. Email Tracking

Registrar no banco:

```text
EmailLog
```

Permitir posteriormente acompanhar:

```text
SENT
DELIVERED
OPENED
FAILED
```

O MVP pode começar apenas com:

```text
SENT
FAILED
```

---

# 41. Web Application

Estrutura aproximada:

```text
src/
├── app/
│   ├── (marketing)/
│   ├── (auth)/
│   ├── dashboard/
│   │   ├── invoices/
│   │   ├── estimates/
│   │   ├── clients/
│   │   ├── products/
│   │   └── settings/
│   │
│   ├── i/
│   │   └── [token]/
│   │
│   ├── e/
│   │   └── [token]/
│   │
│   └── api/
│       └── v1/
│
├── components/
│
├── features/
│   ├── invoices/
│   ├── estimates/
│   ├── clients/
│   └── products/
│
├── lib/
│   ├── auth/
│   ├── db/
│   ├── billing/
│   ├── email/
│   └── pdf/
│
└── server/
    ├── repositories/
    └── services/
```

---

# 42. Dashboard

Dashboard inicial:

```text
Overview
```

Mostrar:

- invoices recentes;
- invoices pendentes;
- invoices overdue;
- total recebido;
- total pendente;
- estimates recentes.

Não implementar analytics complexo inicialmente.

---

# 43. Invoice Editor

O editor deve permitir:

```text
Client
Issue date
Due date

Items
├── Description
├── Quantity
├── Unit price
├── Discount
└── Tax

Notes
Terms

Template
Color
```

Resumo:

```text
Subtotal
Discount
Tax
Total
```

A interface deve ser rápida e simples.

---

# 44. Estimate Editor

Semelhante ao Invoice Editor.

Diferenças:

```text
Expiry date
Accept / Decline
Convert to Invoice
```

---

# 45. Convert Estimate → Invoice

Fluxo:

```text
Estimate
   ↓
ACCEPTED
   ↓
Convert
   ↓
New Invoice
```

O invoice deve copiar:

- cliente;
- itens;
- preços;
- impostos;
- descontos;
- notes/terms.

O estimate original deve permanecer intacto.

Status:

```text
Estimate = CONVERTED
```

---

# 46. Mobile Architecture — Futuro

O Flutter consumirá a mesma API.

```text
Flutter
   ↓
REST API
   ↓
Next.js Backend
   ↓
Neon
```

Não duplicar lógica de negócio no Flutter.

O Flutter será responsável por:

- UI;
- estado local;
- armazenamento local;
- sincronização;
- integração RevenueCat;
- integração com recursos nativos.

---

# 47. Mobile Authentication

Flutter não deve depender da sessão Web baseada em cookie.

Utilizar autenticação apropriada para mobile baseada em tokens.

Conceito:

```text
Flutter
 ↓
Authentication
 ↓
Access Token
 ↓
Authorization: Bearer <token>
 ↓
API
```

O usuário deve ser associado ao mesmo `User.id` utilizado no Web.

---

# 48. Mobile Sync

Não implementar sincronização offline completa no primeiro release Web.

Entretanto, a API deve ser preparada para isso.

Todas as entidades principais devem possuir:

```text
createdAt
updatedAt
```

IDs devem ser gerados de maneira segura para sincronização futura.

Preferir:

```text
UUID / CUID
```

em vez de IDs incrementais como identidade pública.

Futuro:

```text
Flutter Local DB
       ↓
Sync Engine
       ↓
REST API
       ↓
PostgreSQL
```

---

# 49. Free vs Pro

O MVP deve possuir limites simples.

Exemplo inicial:

## Free

```text
Limited invoices/month
Limited templates
Basic PDF
Basic features
```

## Pro

```text
Unlimited invoices
Unlimited clients
Unlimited products
All templates
Custom branding
Email sending
Estimates
Advanced features
```

Os valores exatos dos limites devem ser configuráveis no backend.

Não hardcode limites espalhados pelo frontend.

---

# 50. Feature Gating

Criar uma camada central:

```text
Entitlements
```

Exemplo:

```text
canCreateInvoice
canSendInvoice
canUseTemplate
canCreateEstimate
canUseCustomBranding
```

O backend deve verificar esses recursos.

---

# 51. Webhook Architecture

Criar endpoints separados para providers.

Exemplo:

```text
/api/webhooks/paddle
/api/webhooks/revenuecat
```

Os webhooks devem:

1. validar assinatura;
2. identificar evento;
3. processar idempotentemente;
4. atualizar banco;
5. registrar evento;
6. retornar sucesso.

Nunca processar o mesmo evento duas vezes de maneira destrutiva.

---

# 52. Idempotência

Operações sensíveis devem suportar idempotência.

Especialmente:

- criação de invoices;
- pagamentos;
- webhooks;
- billing;
- envio de emails.

Webhooks devem possuir identificação única do evento.

---

# 53. Segurança

Implementar:

- HTTPS;
- secure cookies;
- proteção CSRF quando aplicável;
- validação de input;
- rate limiting;
- autorização por recurso;
- webhook signature verification;
- secrets exclusivamente em environment variables;
- logs sem informações sensíveis;
- proteção de endpoints públicos.

---

# 54. API Rate Limiting

Inicialmente pode ser simples.

Endpoints especialmente sensíveis:

```text
/auth
/send
/pdf
/webhooks
/public documents
```

devem possuir proteção contra abuso.

Redis não é obrigatório inicialmente.

O rate limiting pode começar utilizando mecanismos simples compatíveis com a infraestrutura.

Adicionar Redis somente quando houver necessidade real.

---

# 55. Redis / Celery

Não utilizar Redis ou Celery no MVP.

Inicialmente:

```text
Next.js
Neon
Resend
Paddle
Hetzner
```

é suficiente.

Jobs assíncronos complexos podem ser adicionados posteriormente.

Exemplos futuros:

- recurring invoices;
- mass email;
- reminders;
- PDF batch generation;
- reports;
- background synchronization.

---

# 56. Infrastructure

Inicialmente:

```text
Hetzner
   │
   ├── Docker
   ├── Next.js
   └── Reverse Proxy
          │
          ├── Web
          └── API
```

Banco:

```text
Neon PostgreSQL
```

Não hospedar PostgreSQL dentro do VPS inicialmente.

---

# 57. Environment Variables

Exemplos:

```text
DATABASE_URL

AUTH_SECRET

GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

PADDLE_API_KEY
PADDLE_WEBHOOK_SECRET

RESEND_API_KEY

REVENUECAT_API_KEY
REVENUECAT_WEBHOOK_SECRET
```

Secrets nunca devem ser commitados.

---

# 58. Observability

Inicialmente implementar:

- application logs;
- error logs;
- webhook logs;
- billing logs;
- email logs.

Futuramente:

- error tracking;
- metrics;
- tracing;
- uptime monitoring.

---

# 59. Database Rules

Todas as tabelas devem utilizar IDs seguros.

Recursos pertencentes ao Business devem possuir:

```text
businessId
```

Exemplo:

```text
Invoice
  businessId

Client
  businessId

Product
  businessId

Estimate
  businessId
```

Nunca acessar um recurso sem verificar sua relação com o usuário autenticado.

---

# 60. API Response Pattern

Manter respostas consistentes.

Sucesso:

```json
{
  "data": {}
}
```

Lista:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

Erro:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Invoice not found"
  }
}
```

---

# 61. Error Codes

Exemplos:

```text
UNAUTHORIZED
FORBIDDEN
RESOURCE_NOT_FOUND
VALIDATION_ERROR
SUBSCRIPTION_REQUIRED
PLAN_LIMIT_REACHED
INVALID_STATUS_TRANSITION
PAYMENT_ERROR
WEBHOOK_INVALID
RATE_LIMITED
INTERNAL_ERROR
```

---

# 62. Status Transitions

Invoices devem possuir transições controladas.

Exemplo:

```text
DRAFT
 ↓
SENT
 ↓
VIEWED
 ↓
PARTIALLY_PAID
 ↓
PAID
```

Também:

```text
DRAFT → CANCELLED
SENT → CANCELLED
```

Não permitir mudanças arbitrárias de status através de `PATCH`.

Ações específicas devem controlar mudanças importantes.

---

# 63. Public Invoice Security

Public tokens não devem expor IDs internos previsíveis.

Usar tokens seguros.

Exemplo:

```text
/i/inv_8F3K29X...
```

O token deve ser suficientemente imprevisível.

---

# 64. Privacy

Não exibir informações internas no documento público.

O public invoice deve expor apenas informações necessárias:

- empresa;
- cliente;
- invoice;
- itens;
- valores;
- vencimento;
- notas;
- termos.

---

# 65. Internationalization

O produto terá público global.

Desde o início, suportar:

```text
currency
language
date format
number format
```

O MVP pode começar com inglês como idioma principal.

Arquitetura deve permitir posteriormente:

- Portuguese;
- Spanish;
- German;
- French;
- etc.

---

# 66. Currency

Não assumir BRL.

Cada invoice deve armazenar sua própria:

```text
currency
```

Exemplos:

```text
USD
EUR
GBP
BRL
CAD
AUD
```

A moeda do invoice não deve mudar se o Business alterar sua moeda padrão posteriormente.

---

# 67. Timezone

Datas devem ser tratadas consistentemente.

O Business/User deve possuir timezone quando necessário.

Invoices devem preservar suas datas comerciais.

---

# 68. MVP — Fase 1

## Foundation

Implementar:

- Next.js;
- TypeScript;
- Tailwind;
- shadcn/ui;
- Prisma;
- Neon;
- Auth.js;
- User;
- Business;
- Clients;
- Products;
- REST API `/api/v1`.

---

# 69. MVP — Fase 2

## Invoicing

Implementar:

- invoice CRUD;
- invoice items;
- cálculos;
- numbering;
- status;
- invoice editor;
- templates;
- PDF;
- public invoice;
- duplicate invoice.

---

# 70. MVP — Fase 3

## Estimates

Implementar:

- estimate CRUD;
- estimate items;
- PDF;
- public estimate;
- accept;
- decline;
- convert to invoice.

---

# 71. MVP — Fase 4

## Email

Implementar:

- Resend;
- send invoice;
- send estimate;
- email logs;
- public links.

---

# 72. MVP — Fase 5

## Billing

Implementar:

- Paddle;
- Free;
- Pro;
- LTD opcional;
- subscription table;
- Paddle webhooks;
- feature gating.

---

# 73. Mobile — Fase 6

Criar:

```text
Flutter
```

com:

- login;
- business;
- clients;
- products;
- invoices;
- estimates;
- PDF;
- sync;
- RevenueCat.

---

# 74. Mobile Billing — Fase 7

Implementar:

```text
RevenueCat
   ├── Apple
   └── Google
```

Configurar:

```text
PRO entitlement
```

com produtos:

```text
Apple:
- pro_monthly
- pro_yearly

Google:
- pro_monthly
- pro_yearly
```

Os produtos devem liberar o mesmo entitlement:

```text
PRO
```

---

# 75. Cross-platform Subscription

Regra principal:

```text
One User
      ↓
One entitlement
      ↓
Multiple billing providers
```

Exemplo:

```text
Paddle → PRO
Apple  → PRO
Google → PRO
```

Todos desbloqueiam:

```text
Web
Android
iOS
```

---

# 76. Futuras funcionalidades

Após validar o MVP:

## Recurring invoices

```text
Weekly
Monthly
Quarterly
Yearly
```

## Payment reminders

```text
Before due date
On due date
After due date
```

## Online payments

Integrações futuras.

## Expenses

```text
Expense tracking
Categories
Reports
```

## Reports

```text
Revenue
Outstanding
Paid
Overdue
Clients
```

## Team support

Adicionar:

```text
Organization
Members
Roles
Invitations
```

somente quando houver demanda real.

---

# 77. Futuro — RevenueCat Web

Uma possível evolução é utilizar a integração Web do RevenueCat com Paddle para centralizar ainda mais os entitlements.

Arquitetura futura:

```text
                  RevenueCat
                      │
          ┌───────────┼───────────┐
          │           │           │
       Paddle       Apple       Google
          │           │           │
         Web         iOS       Android
```

Essa possibilidade não é requisito do MVP.

---

# 78. Princípios de Desenvolvimento

## Simplicidade

Não adicionar infraestrutura sem necessidade.

## API-first

Toda lógica importante deve existir na API.

## Mobile-ready

A API deve ser criada desde o início pensando em Flutter.

## Secure by default

Toda operação deve autenticar e autorizar o usuário.

## Provider-agnostic billing

O produto trabalha com:

```text
PRO
```

e não com:

```text
Apple PRO
Google PRO
Paddle PRO
```

## Histórico imutável

Invoices emitidos devem preservar seus valores históricos.

## International-first

Não assumir que o produto será utilizado apenas no Brasil.

---

# 79. MVP Definition of Done

O MVP Web estará pronto quando um usuário conseguir:

```text
Sign up
   ↓
Create Business
   ↓
Create Client
   ↓
Create Product
   ↓
Create Invoice
   ↓
Generate PDF
   ↓
Share public URL
   ↓
Send by Email
   ↓
Track status
   ↓
Register payment
```

E também:

```text
Create Estimate
   ↓
Send Estimate
   ↓
Client views
   ↓
Accept
   ↓
Convert to Invoice
```

E:

```text
Subscribe to Pro
   ↓
Paddle
   ↓
Webhook
   ↓
Backend
   ↓
PRO entitlement
```

---

# 80. Target Architecture

```text
                              ┌───────────────────┐
                              │     Next.js Web   │
                              │                   │
                              │ Dashboard         │
                              │ Invoice Editor    │
                              │ Estimate Editor   │
                              │ Public Documents  │
                              └─────────┬─────────┘
                                        │
                                        ▼
                              ┌───────────────────┐
                              │     REST API      │
                              │     /api/v1       │
                              └─────────┬─────────┘
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 │                      │                      │
                 ▼                      ▼                      ▼
          ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
          │    Neon     │       │   Resend    │       │   Billing   │
          │ PostgreSQL  │       │   Emails    │       │             │
          └─────────────┘       └─────────────┘       └──────┬──────┘
                                                             │
                                                    ┌────────┴────────┐
                                                    │                 │
                                                 Paddle          RevenueCat
                                                    │                 │
                                                   Web          ┌──────┴──────┐
                                                              Apple         Google
                                                                │             │
                                                                └──────┬──────┘
                                                                       │
                                                                       ▼
                                                                 ┌───────────┐
                                                                 │  Flutter  │
                                                                 │ iOS/Android│
                                                                 └───────────┘
```

---

# 81. Final Product Philosophy

O produto deve ser:

> **Simple enough for a freelancer, powerful enough for a small business, and architected well enough to work across Web, Android and iOS.**

A primeira versão deve evitar complexidade desnecessária.

A prioridade é construir muito bem:

1. Authentication;
2. Business;
3. Clients;
4. Products;
5. Invoices;
6. Estimates;
7. PDF;
8. Email;
9. Public documents;
10. API;
11. Billing.

Depois, adicionar mobile e funcionalidades avançadas conforme validação do produto.