export interface SeedOptions {
  username: string;
  password: string;
  template: 'riggsandporter';
  productFilePath?: string;
  categoryFilePath?: string;
  buyerID?: string;
  catalogID?: string;
  marketplaceID: string;
  environment: 'sandbox' | 'staging' | 'production';
}
