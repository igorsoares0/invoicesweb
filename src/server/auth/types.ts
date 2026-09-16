export interface UserContext {
  userId: string;
}

export interface BusinessContext extends UserContext {
  businessId: string;
}
