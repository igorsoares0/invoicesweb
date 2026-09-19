import type { Business, Client } from "@/generated/prisma/client";

/** The issuer as printed on a document. Frozen into the invoice when it's sent. */
export interface IssuerSnapshot {
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  logoUrl: string | null;
  paymentInstructions: string | null;
  /**
   * Whether the issuer was on Free when the document was sent, so it carries "Made with Invoice
   * Maker". Upgrading later removes the mark; downgrading never adds it to what was already sent.
   * Missing on documents sent before billing existed, which read as unbranded.
   */
  branded?: boolean;
}

export interface BillToSnapshot {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export function issuerSnapshot(business: Business, branded = false): IssuerSnapshot {
  return {
    branded,
    name: business.name,
    email: business.email,
    phone: business.phone,
    website: business.website,
    taxId: business.taxId,
    address: business.address,
    city: business.city,
    state: business.state,
    postalCode: business.postalCode,
    country: business.country,
    logoUrl: business.logoUrl,
    paymentInstructions: business.paymentInstructions,
  };
}

export function billToSnapshot(client: Client): BillToSnapshot {
  return {
    name: client.name,
    email: client.email,
    phone: client.phone,
    company: client.company,
    taxId: client.taxId,
    address: client.address,
    city: client.city,
    state: client.state,
    postalCode: client.postalCode,
    country: client.country,
  };
}
